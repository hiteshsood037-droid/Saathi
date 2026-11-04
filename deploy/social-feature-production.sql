-- Saathi social features: production data model, RLS, and read RPCs
-- Apply this migration BEFORE deploy/social-media-storage.sql.
-- Canonical media constraints: deploy/social-media-contract.json (v1).
--
-- Direct client writes are intentionally unavailable. The authenticated
-- `social-media` Edge Function is the only mutation surface for these tables.

BEGIN;

CREATE TYPE public.social_visibility AS ENUM ('everyone', 'matches', 'hidden');
CREATE TYPE public.social_media_type AS ENUM ('voice_intro', 'profile_video', 'story_media');
CREATE TYPE public.social_upload_status AS ENUM ('issued', 'finalized', 'rejected', 'expired');

CREATE TABLE public.social_settings (
  profile_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  voice_visibility public.social_visibility NOT NULL DEFAULT 'matches',
  video_visibility public.social_visibility NOT NULL DEFAULT 'matches',
  story_visibility public.social_visibility NOT NULL DEFAULT 'matches',
  profile_content_visibility public.social_visibility NOT NULL DEFAULT 'everyone',
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

-- Ensure every current and future profile has explicit privacy defaults. The
-- defaults are restrictive for media and discoverable for text profile content.
INSERT INTO public.social_settings (profile_id)
SELECT id FROM public.profiles
ON CONFLICT (profile_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.create_default_social_settings()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $social_settings$
BEGIN
  INSERT INTO public.social_settings (profile_id) VALUES (NEW.id)
  ON CONFLICT (profile_id) DO NOTHING;
  RETURN NEW;
END;
$social_settings$;

DROP TRIGGER IF EXISTS social_settings_after_profile_insert ON public.profiles;
CREATE TRIGGER social_settings_after_profile_insert
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.create_default_social_settings();

CREATE TABLE public.social_upload_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  media_type public.social_media_type NOT NULL,
  bucket text NOT NULL,
  object_path text NOT NULL,
  mime_type text NOT NULL,
  declared_byte_size bigint NOT NULL CHECK (declared_byte_size > 0),
  status public.social_upload_status NOT NULL DEFAULT 'issued',
  expires_at timestamptz NOT NULL,
  finalized_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE (bucket, object_path)
);

CREATE TABLE public.social_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  upload_session_id uuid NOT NULL UNIQUE REFERENCES public.social_upload_sessions(id) ON DELETE RESTRICT,
  media_type public.social_media_type NOT NULL,
  bucket text NOT NULL,
  object_path text NOT NULL,
  mime_type text NOT NULL,
  byte_size bigint NOT NULL CHECK (byte_size > 0),
  duration_seconds numeric(8,3),
  is_published boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE (bucket, object_path)
);

-- At most one active voice intro and profile video per profile. Story media is
-- published only when it is attached to a non-deleted story.
CREATE UNIQUE INDEX social_media_one_published_profile_asset
  ON public.social_media (profile_id, media_type)
  WHERE is_published AND media_type IN ('voice_intro', 'profile_video');
CREATE INDEX social_media_profile_type_idx ON public.social_media (profile_id, media_type, created_at DESC);

CREATE TABLE public.social_stories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  media_id uuid NOT NULL UNIQUE REFERENCES public.social_media(id) ON DELETE CASCADE,
  caption text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  expires_at timestamptz NOT NULL,
  deleted_at timestamptz,
  CONSTRAINT social_story_caption_length CHECK (caption IS NULL OR char_length(caption) <= 220)
);
CREATE INDEX social_stories_active_idx ON public.social_stories (profile_id, expires_at DESC) WHERE deleted_at IS NULL;

CREATE TABLE public.social_prompts (
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  position smallint NOT NULL CHECK (position BETWEEN 1 AND 3),
  prompt text NOT NULL CHECK (char_length(prompt) BETWEEN 1 AND 160),
  answer text NOT NULL CHECK (char_length(answer) BETWEEN 1 AND 300),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  PRIMARY KEY (profile_id, position)
);

CREATE TABLE public.social_green_flag_badges (
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  badge_code text NOT NULL CHECK (badge_code ~ '^[a-z0-9][a-z0-9_-]{1,63}$'),
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  PRIMARY KEY (profile_id, badge_code)
);

CREATE TABLE public.social_icebreakers (
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  position smallint NOT NULL CHECK (position BETWEEN 1 AND 3),
  text text NOT NULL CHECK (char_length(text) BETWEEN 1 AND 200),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  PRIMARY KEY (profile_id, position)
);

-- Only safe Spotify catalog display metadata is stored. No token, playback URL,
-- or raw provider response has a column in this table.
CREATE TABLE public.social_favorite_music (
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  position smallint NOT NULL CHECK (position BETWEEN 1 AND 5),
  provider text NOT NULL CHECK (provider = 'spotify'),
  provider_track_id text NOT NULL CHECK (char_length(provider_track_id) BETWEEN 1 AND 255),
  track_name text NOT NULL CHECK (char_length(track_name) BETWEEN 1 AND 300),
  artist_name text NOT NULL CHECK (char_length(artist_name) BETWEEN 1 AND 300),
  album_image_url text,
  external_url text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  PRIMARY KEY (profile_id, position),
  UNIQUE (profile_id, provider, provider_track_id),
  CONSTRAINT social_music_album_image_url CHECK (album_image_url IS NULL OR album_image_url ~ '^https://'),
  CONSTRAINT social_music_external_url CHECK (external_url IS NULL OR external_url ~ '^https://')
);

CREATE OR REPLACE FUNCTION public.validate_social_media_record()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  max_bytes bigint;
  max_duration numeric;
  valid_mime boolean := false;
BEGIN
  IF split_part(NEW.object_path, '/', 1) <> NEW.profile_id::text
     OR strpos(NEW.object_path, '/') = 0 THEN
    RAISE EXCEPTION 'social object path must start with its profile id';
  END IF;

  CASE NEW.media_type
    WHEN 'voice_intro' THEN
      max_bytes := 5242880;
      max_duration := 60;
      valid_mime := NEW.bucket = 'profile-voice'
        AND NEW.mime_type = ANY (ARRAY['audio/mpeg', 'audio/mp4', 'audio/aac', 'audio/ogg', 'audio/wav', 'audio/webm']);
    WHEN 'profile_video' THEN
      max_bytes := 26214400;
      max_duration := 30;
      valid_mime := NEW.bucket = 'profile-videos'
        AND NEW.mime_type = ANY (ARRAY['video/mp4', 'video/quicktime', 'video/webm']);
    WHEN 'story_media' THEN
      max_bytes := 15728640;
      max_duration := 15;
      valid_mime := NEW.bucket = 'story-media'
        AND NEW.mime_type = ANY (ARRAY['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime', 'video/webm']);
  END CASE;

  IF NOT valid_mime THEN
    RAISE EXCEPTION 'bucket or MIME type is not allowed for %', NEW.media_type;
  END IF;
  IF NEW.byte_size > max_bytes THEN
    RAISE EXCEPTION 'media byte size exceeds limit for %', NEW.media_type;
  END IF;

  IF NEW.media_type = 'story_media' AND NEW.mime_type LIKE 'image/%' THEN
    IF NEW.duration_seconds IS NOT NULL THEN
      RAISE EXCEPTION 'image stories must not have a duration';
    END IF;
  ELSIF NEW.duration_seconds IS NULL OR NEW.duration_seconds <= 0 OR NEW.duration_seconds > max_duration THEN
    RAISE EXCEPTION 'media duration exceeds limit for %', NEW.media_type;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER social_media_validate_before_write
  BEFORE INSERT OR UPDATE ON public.social_media
  FOR EACH ROW EXECUTE FUNCTION public.validate_social_media_record();

CREATE OR REPLACE FUNCTION public.validate_social_story_record()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  asset public.social_media;
BEGIN
  SELECT * INTO asset FROM public.social_media WHERE id = NEW.media_id;
  IF NOT FOUND OR asset.profile_id <> NEW.profile_id OR asset.media_type <> 'story_media' THEN
    RAISE EXCEPTION 'story must use its owner''s finalized story media';
  END IF;
  NEW.expires_at := NEW.created_at + interval '24 hours';
  RETURN NEW;
END;
$$;

CREATE TRIGGER social_story_validate_before_write
  BEFORE INSERT OR UPDATE ON public.social_stories
  FOR EACH ROW EXECUTE FUNCTION public.validate_social_story_record();

CREATE OR REPLACE FUNCTION public.enforce_social_badge_limit()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF (SELECT count(*) FROM public.social_green_flag_badges WHERE profile_id = NEW.profile_id) >= 5 THEN
    RAISE EXCEPTION 'a profile may have at most five green flag badges';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER social_green_flag_limit_before_insert
  BEFORE INSERT ON public.social_green_flag_badges
  FOR EACH ROW EXECUTE FUNCTION public.enforce_social_badge_limit();

CREATE OR REPLACE FUNCTION public.social_viewer_is_eligible(p_viewer_id uuid, p_profile_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p_viewer_id = p_profile_id
    OR EXISTS (
      SELECT 1
      FROM public.profiles viewer
      JOIN public.profiles target ON target.id = p_profile_id
      WHERE viewer.id = p_viewer_id
        AND NOT viewer.is_banned
        AND NOT target.is_banned
        AND NOT EXISTS (
          SELECT 1 FROM public.blocks b
          WHERE (b.blocker_id = p_viewer_id AND b.blocked_id = p_profile_id)
             OR (b.blocker_id = p_profile_id AND b.blocked_id = p_viewer_id)
        )
    );
$$;

CREATE OR REPLACE FUNCTION public.can_view_social_visibility(
  p_viewer_id uuid,
  p_profile_id uuid,
  p_visibility public.social_visibility
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_viewer_id = p_profile_id THEN true
    WHEN NOT public.social_viewer_is_eligible(p_viewer_id, p_profile_id) THEN false
    WHEN p_visibility = 'everyone' THEN true
    WHEN p_visibility = 'matches' THEN EXISTS (
      SELECT 1 FROM public.matches m
      WHERE (m.user1_id = p_viewer_id AND m.user2_id = p_profile_id)
         OR (m.user2_id = p_viewer_id AND m.user1_id = p_profile_id)
    )
    ELSE false
  END;
$$;

CREATE OR REPLACE FUNCTION public.get_profile_social_content(p_profile_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id uuid := auth.uid();
  settings public.social_settings;
  can_view_profile boolean;
  can_view_voice boolean;
  can_view_video boolean;
BEGIN
  IF caller_id IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  IF NOT public.social_viewer_is_eligible(caller_id, p_profile_id) THEN
    RAISE EXCEPTION 'social content is not available';
  END IF;

  SELECT * INTO settings FROM public.social_settings WHERE profile_id = p_profile_id;
  IF NOT FOUND THEN
    settings.profile_id := p_profile_id;
    settings.voice_visibility := 'matches';
    settings.video_visibility := 'matches';
    settings.profile_content_visibility := 'everyone';
  END IF;

  can_view_profile := public.can_view_social_visibility(caller_id, p_profile_id, settings.profile_content_visibility);
  can_view_voice := public.can_view_social_visibility(caller_id, p_profile_id, settings.voice_visibility);
  can_view_video := public.can_view_social_visibility(caller_id, p_profile_id, settings.video_visibility);

  RETURN jsonb_build_object(
    'profile_id', p_profile_id,
    'voice_intro', CASE WHEN can_view_voice THEN (
      SELECT jsonb_build_object('media_id', id, 'mime_type', mime_type, 'byte_size', byte_size, 'duration_seconds', duration_seconds)
      FROM public.social_media
      WHERE profile_id = p_profile_id AND media_type = 'voice_intro' AND is_published
      ORDER BY created_at DESC LIMIT 1
    ) ELSE NULL END,
    'profile_video', CASE WHEN can_view_video THEN (
      SELECT jsonb_build_object('media_id', id, 'mime_type', mime_type, 'byte_size', byte_size, 'duration_seconds', duration_seconds)
      FROM public.social_media
      WHERE profile_id = p_profile_id AND media_type = 'profile_video' AND is_published
      ORDER BY created_at DESC LIMIT 1
    ) ELSE NULL END,
    'prompts', CASE WHEN can_view_profile THEN COALESCE((
      SELECT jsonb_agg(jsonb_build_object('position', position, 'prompt', prompt, 'answer', answer) ORDER BY position)
      FROM public.social_prompts WHERE profile_id = p_profile_id
    ), '[]'::jsonb) ELSE '[]'::jsonb END,
    'green_flag_badges', CASE WHEN can_view_profile THEN COALESCE((
      SELECT jsonb_agg(badge_code ORDER BY badge_code) FROM public.social_green_flag_badges WHERE profile_id = p_profile_id
    ), '[]'::jsonb) ELSE '[]'::jsonb END,
    'icebreakers', CASE WHEN can_view_profile THEN COALESCE((
      SELECT jsonb_agg(jsonb_build_object('position', position, 'text', text) ORDER BY position)
      FROM public.social_icebreakers WHERE profile_id = p_profile_id
    ), '[]'::jsonb) ELSE '[]'::jsonb END,
    'favorite_music', CASE WHEN can_view_profile THEN COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'position', position, 'provider', provider, 'provider_track_id', provider_track_id,
        'track_name', track_name, 'artist_name', artist_name,
        'album_image_url', album_image_url, 'external_url', external_url
      ) ORDER BY position) FROM public.social_favorite_music WHERE profile_id = p_profile_id
    ), '[]'::jsonb) ELSE '[]'::jsonb END
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_active_stories(p_profile_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(jsonb_agg(item ORDER BY (item->>'created_at')::timestamptz DESC), '[]'::jsonb)
  FROM (
    SELECT jsonb_build_object(
      'story_id', s.id,
      'profile_id', s.profile_id,
      'media_id', m.id,
      'mime_type', m.mime_type,
      'byte_size', m.byte_size,
      'duration_seconds', m.duration_seconds,
      'caption', s.caption,
      'created_at', s.created_at,
      'expires_at', s.expires_at
    ) AS item
    FROM public.social_stories s
    JOIN public.social_media m ON m.id = s.media_id AND m.is_published
    JOIN public.social_settings cfg ON cfg.profile_id = s.profile_id
    WHERE auth.uid() IS NOT NULL
      AND s.deleted_at IS NULL
      AND s.expires_at > timezone('utc', now())
      AND (p_profile_id IS NULL OR s.profile_id = p_profile_id)
      AND public.can_view_social_visibility(auth.uid(), s.profile_id, cfg.story_visibility)
  ) visible;
$$;

CREATE OR REPLACE FUNCTION public.get_match_streaks(p_match_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'match_id', m.id,
    'streak_count', m.streak_count,
    'last_message_at', m.last_message_at,
    'created_at', m.created_at
  ) ORDER BY m.last_message_at DESC), '[]'::jsonb)
  FROM public.matches m
  WHERE auth.uid() IS NOT NULL
    AND (m.user1_id = auth.uid() OR m.user2_id = auth.uid())
    AND (p_match_id IS NULL OR m.id = p_match_id);
$$;

-- This RPC deliberately exposes a storage path only to an authorized caller.
-- The Edge Function uses it immediately to mint a five-minute signed URL.
CREATE OR REPLACE FUNCTION public.resolve_social_read_target(
  p_media_id uuid DEFAULT NULL,
  p_story_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id uuid := auth.uid();
  asset public.social_media;
  story public.social_stories;
  cfg public.social_settings;
  allowed boolean := false;
BEGIN
  IF caller_id IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  IF (p_media_id IS NULL) = (p_story_id IS NULL) THEN
    RAISE EXCEPTION 'exactly one media_id or story_id is required';
  END IF;

  IF p_story_id IS NOT NULL THEN
    SELECT * INTO story FROM public.social_stories WHERE id = p_story_id AND deleted_at IS NULL AND expires_at > timezone('utc', now());
    IF NOT FOUND THEN RAISE EXCEPTION 'story not found'; END IF;
    SELECT * INTO asset FROM public.social_media WHERE id = story.media_id AND is_published;
    SELECT * INTO cfg FROM public.social_settings WHERE profile_id = story.profile_id;
    allowed := public.can_view_social_visibility(caller_id, story.profile_id, COALESCE(cfg.story_visibility, 'matches'));
  ELSE
    SELECT * INTO asset FROM public.social_media WHERE id = p_media_id AND is_published;
    IF NOT FOUND THEN RAISE EXCEPTION 'media not found'; END IF;
    SELECT * INTO cfg FROM public.social_settings WHERE profile_id = asset.profile_id;
    allowed := CASE asset.media_type
      WHEN 'voice_intro' THEN public.can_view_social_visibility(caller_id, asset.profile_id, COALESCE(cfg.voice_visibility, 'matches'))
      WHEN 'profile_video' THEN public.can_view_social_visibility(caller_id, asset.profile_id, COALESCE(cfg.video_visibility, 'matches'))
      ELSE false
    END;
  END IF;

  IF NOT allowed THEN RAISE EXCEPTION 'media is not available'; END IF;
  RETURN jsonb_build_object('media_id', asset.id, 'bucket', asset.bucket, 'object_path', asset.object_path);
END;
$$;

CREATE OR REPLACE FUNCTION public.cleanup_expired_social_stories()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE deleted_count integer;
BEGIN
  DELETE FROM public.social_media m
  USING public.social_stories s
  WHERE s.media_id = m.id
    AND (s.deleted_at IS NOT NULL OR s.expires_at <= timezone('utc', now()));
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;


-- The Edge Function calls these service-role-only RPCs instead of issuing
-- multi-request table mutations. PostgreSQL executes every function call in a
-- single transaction, so failed insert/validation paths roll back all changes.
CREATE OR REPLACE FUNCTION public.create_social_story(
  p_profile_id uuid,
  p_media_id uuid,
  p_caption text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  asset public.social_media;
  story public.social_stories;
BEGIN
  SELECT * INTO asset
  FROM public.social_media
  WHERE id = p_media_id
  FOR UPDATE;

  IF NOT FOUND
     OR asset.profile_id <> p_profile_id
     OR asset.media_type <> 'story_media'
     OR asset.is_published THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.social_stories (profile_id, media_id, caption, expires_at)
  VALUES (p_profile_id, p_media_id, p_caption, timezone('utc', now()) + interval '24 hours')
  RETURNING * INTO story;

  UPDATE public.social_media
  SET is_published = true
  WHERE id = asset.id;

  RETURN jsonb_build_object(
    'story_id', story.id,
    'media_id', story.media_id,
    'caption', story.caption,
    'created_at', story.created_at,
    'expires_at', story.expires_at
  );
END;
$$;

-- Storage deletion is not part of the database transaction. Stage a delete by
-- atomically making both records invisible, then let the Edge Function remove
-- the object and call complete_social_story_delete. A failed cleanup leaves a
-- hidden, retryable tombstone rather than a readable story with missing media.
CREATE OR REPLACE FUNCTION public.stage_social_story_delete(
  p_profile_id uuid,
  p_story_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  story public.social_stories;
  asset public.social_media;
BEGIN
  SELECT * INTO story
  FROM public.social_stories
  WHERE id = p_story_id
  FOR UPDATE;
  IF NOT FOUND OR story.profile_id <> p_profile_id THEN
    RETURN NULL;
  END IF;

  SELECT * INTO asset
  FROM public.social_media
  WHERE id = story.media_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'story media is missing';
  END IF;

  IF story.deleted_at IS NULL THEN
    UPDATE public.social_stories SET deleted_at = timezone('utc', now()) WHERE id = story.id;
    UPDATE public.social_media SET is_published = false WHERE id = asset.id;
  END IF;

  RETURN jsonb_build_object('bucket', asset.bucket, 'object_path', asset.object_path);
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_social_story_delete(
  p_profile_id uuid,
  p_story_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  story_exists boolean;
BEGIN
  DELETE FROM public.social_media m
  USING public.social_stories s
  WHERE s.id = p_story_id
    AND s.profile_id = p_profile_id
    AND s.deleted_at IS NOT NULL
    AND s.media_id = m.id;

  IF FOUND THEN
    RETURN true;
  END IF;

  -- A repeated completion after a prior successful purge is harmless. An
  -- existing non-deleted story, however, must never be purged by this RPC.
  SELECT EXISTS (SELECT 1 FROM public.social_stories WHERE id = p_story_id)
  INTO story_exists;
  IF story_exists THEN
    RAISE EXCEPTION 'story deletion has not been staged';
  END IF;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_social_settings(
  p_profile_id uuid,
  p_settings jsonb DEFAULT '{}'::jsonb,
  p_prompts jsonb DEFAULT NULL,
  p_green_flag_badges jsonb DEFAULT NULL,
  p_icebreakers jsonb DEFAULT NULL,
  p_favorite_music jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_profile_id IS NULL OR p_settings IS NULL OR jsonb_typeof(p_settings) <> 'object' THEN
    RAISE EXCEPTION 'invalid social settings payload';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_object_keys(p_settings) AS setting_key(key)
    WHERE setting_key.key NOT IN ('voice_visibility', 'video_visibility', 'story_visibility', 'profile_content_visibility')
  ) THEN
    RAISE EXCEPTION 'invalid social settings key';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM unnest(ARRAY['voice_visibility', 'video_visibility', 'story_visibility', 'profile_content_visibility']) AS setting_key(key)
    WHERE p_settings ? setting_key.key
      AND (jsonb_typeof(p_settings -> setting_key.key) <> 'string' OR p_settings ->> setting_key.key NOT IN ('everyone', 'matches', 'hidden'))
  ) THEN
    RAISE EXCEPTION 'invalid social visibility';
  END IF;
  IF (p_prompts IS NOT NULL AND jsonb_typeof(p_prompts) <> 'array')
     OR (p_green_flag_badges IS NOT NULL AND jsonb_typeof(p_green_flag_badges) <> 'array')
     OR (p_icebreakers IS NOT NULL AND jsonb_typeof(p_icebreakers) <> 'array')
     OR (p_favorite_music IS NOT NULL AND jsonb_typeof(p_favorite_music) <> 'array') THEN
    RAISE EXCEPTION 'social content collections must be arrays';
  END IF;
  IF (p_prompts IS NOT NULL AND (jsonb_array_length(p_prompts) > 3 OR EXISTS (SELECT 1 FROM jsonb_array_elements(p_prompts) item WHERE jsonb_typeof(item) <> 'object')))
     OR (p_green_flag_badges IS NOT NULL AND (jsonb_array_length(p_green_flag_badges) > 5 OR EXISTS (SELECT 1 FROM jsonb_array_elements(p_green_flag_badges) item WHERE jsonb_typeof(item) <> 'string')))
     OR (p_icebreakers IS NOT NULL AND (jsonb_array_length(p_icebreakers) > 3 OR EXISTS (SELECT 1 FROM jsonb_array_elements(p_icebreakers) item WHERE jsonb_typeof(item) <> 'string')))
     OR (p_favorite_music IS NOT NULL AND (jsonb_array_length(p_favorite_music) > 5 OR EXISTS (SELECT 1 FROM jsonb_array_elements(p_favorite_music) item WHERE jsonb_typeof(item) <> 'object'))) THEN
    RAISE EXCEPTION 'invalid social content collection';
  END IF;

  INSERT INTO public.social_settings (
    profile_id, voice_visibility, video_visibility, story_visibility, profile_content_visibility, updated_at
  ) VALUES (
    p_profile_id,
    CASE WHEN p_settings ? 'voice_visibility' THEN (p_settings ->> 'voice_visibility')::public.social_visibility ELSE 'matches'::public.social_visibility END,
    CASE WHEN p_settings ? 'video_visibility' THEN (p_settings ->> 'video_visibility')::public.social_visibility ELSE 'matches'::public.social_visibility END,
    CASE WHEN p_settings ? 'story_visibility' THEN (p_settings ->> 'story_visibility')::public.social_visibility ELSE 'matches'::public.social_visibility END,
    CASE WHEN p_settings ? 'profile_content_visibility' THEN (p_settings ->> 'profile_content_visibility')::public.social_visibility ELSE 'everyone'::public.social_visibility END,
    timezone('utc', now())
  )
  ON CONFLICT (profile_id) DO UPDATE SET
    voice_visibility = CASE WHEN p_settings ? 'voice_visibility' THEN (p_settings ->> 'voice_visibility')::public.social_visibility ELSE social_settings.voice_visibility END,
    video_visibility = CASE WHEN p_settings ? 'video_visibility' THEN (p_settings ->> 'video_visibility')::public.social_visibility ELSE social_settings.video_visibility END,
    story_visibility = CASE WHEN p_settings ? 'story_visibility' THEN (p_settings ->> 'story_visibility')::public.social_visibility ELSE social_settings.story_visibility END,
    profile_content_visibility = CASE WHEN p_settings ? 'profile_content_visibility' THEN (p_settings ->> 'profile_content_visibility')::public.social_visibility ELSE social_settings.profile_content_visibility END,
    updated_at = EXCLUDED.updated_at;

  IF p_prompts IS NOT NULL THEN
    DELETE FROM public.social_prompts WHERE profile_id = p_profile_id;
    INSERT INTO public.social_prompts (profile_id, position, prompt, answer)
    SELECT p_profile_id, item.position, item.prompt, item.answer
    FROM jsonb_to_recordset(p_prompts) AS item(position smallint, prompt text, answer text);
  END IF;

  IF p_green_flag_badges IS NOT NULL THEN
    DELETE FROM public.social_green_flag_badges WHERE profile_id = p_profile_id;
    INSERT INTO public.social_green_flag_badges (profile_id, badge_code)
    SELECT p_profile_id, jsonb_array_elements_text(p_green_flag_badges);
  END IF;

  IF p_icebreakers IS NOT NULL THEN
    DELETE FROM public.social_icebreakers WHERE profile_id = p_profile_id;
    INSERT INTO public.social_icebreakers (profile_id, position, text)
    SELECT p_profile_id, item.ordinality::smallint, item.value
    FROM jsonb_array_elements_text(p_icebreakers) WITH ORDINALITY AS item(value, ordinality);
  END IF;

  IF p_favorite_music IS NOT NULL THEN
    DELETE FROM public.social_favorite_music WHERE profile_id = p_profile_id;
    INSERT INTO public.social_favorite_music (
      profile_id, position, provider, provider_track_id, track_name, artist_name, album_image_url, external_url
    )
    SELECT p_profile_id, item.position, item.provider, item.provider_track_id, item.track_name, item.artist_name,
      item.album_image_url, item.external_url
    FROM jsonb_to_recordset(p_favorite_music) AS item(
      position smallint, provider text, provider_track_id text, track_name text, artist_name text,
      album_image_url text, external_url text
    );
  END IF;
END;
$$;

ALTER TABLE public.social_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_upload_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_green_flag_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_icebreakers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_favorite_music ENABLE ROW LEVEL SECURITY;

-- A member may inspect only their own private operational records. Public/social
-- reads always go through the visibility-aware RPCs above. No mutation policy is
-- granted to authenticated users.
CREATE POLICY social_settings_owner_select ON public.social_settings FOR SELECT TO authenticated USING (profile_id = auth.uid());
CREATE POLICY social_upload_sessions_owner_select ON public.social_upload_sessions FOR SELECT TO authenticated USING (profile_id = auth.uid());
CREATE POLICY social_media_owner_select ON public.social_media FOR SELECT TO authenticated USING (profile_id = auth.uid());
CREATE POLICY social_stories_owner_select ON public.social_stories FOR SELECT TO authenticated USING (profile_id = auth.uid());
CREATE POLICY social_prompts_owner_select ON public.social_prompts FOR SELECT TO authenticated USING (profile_id = auth.uid());
CREATE POLICY social_badges_owner_select ON public.social_green_flag_badges FOR SELECT TO authenticated USING (profile_id = auth.uid());
CREATE POLICY social_icebreakers_owner_select ON public.social_icebreakers FOR SELECT TO authenticated USING (profile_id = auth.uid());
CREATE POLICY social_music_owner_select ON public.social_favorite_music FOR SELECT TO authenticated USING (profile_id = auth.uid());

REVOKE ALL ON TABLE public.social_settings, public.social_upload_sessions, public.social_media, public.social_stories, public.social_prompts, public.social_green_flag_badges, public.social_icebreakers, public.social_favorite_music FROM anon;
REVOKE ALL ON TABLE public.social_settings, public.social_upload_sessions, public.social_media, public.social_stories, public.social_prompts, public.social_green_flag_badges, public.social_icebreakers, public.social_favorite_music FROM authenticated;
GRANT SELECT ON TABLE public.social_settings, public.social_upload_sessions, public.social_media, public.social_stories, public.social_prompts, public.social_green_flag_badges, public.social_icebreakers, public.social_favorite_music TO authenticated;

REVOKE ALL ON FUNCTION public.get_profile_social_content(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_active_stories(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_match_streaks(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.resolve_social_read_target(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cleanup_expired_social_stories() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_social_story(uuid, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.stage_social_story_delete(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.complete_social_story_delete(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_social_settings(uuid, jsonb, jsonb, jsonb, jsonb, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_profile_social_content(uuid), public.get_active_stories(uuid), public.get_match_streaks(uuid), public.resolve_social_read_target(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_social_stories(), public.create_social_story(uuid, uuid, text), public.stage_social_story_delete(uuid, uuid), public.complete_social_story_delete(uuid, uuid), public.update_social_settings(uuid, jsonb, jsonb, jsonb, jsonb, jsonb) TO service_role;

COMMIT;

-- Optional owner-gated scheduled cleanup. Schedule this only when pg_cron is
-- enabled, alongside cleanup_expired_story_objects() from social-media-storage.sql:
-- SELECT cron.schedule('saathi-cleanup-expired-social-stories', '23 * * * *',
--   $$SELECT public.cleanup_expired_social_stories();$$);
