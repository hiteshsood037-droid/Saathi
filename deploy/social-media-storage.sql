-- Jodi social media storage hardening
-- Run AFTER the social-feature data-model migration and before enabling uploads.
-- Contract source: deploy/social-media-contract.json
--
-- Media stays private. Users can access their own objects directly; profile/story
-- viewers receive short-lived signed URLs only after application-level visibility
-- checks. Do not change these buckets to public.

BEGIN;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  (
    'profile-voice',
    'profile-voice',
    false,
    5242880,
    ARRAY['audio/mpeg', 'audio/mp4', 'audio/aac', 'audio/ogg', 'audio/wav', 'audio/webm']::text[]
  ),
  (
    'profile-videos',
    'profile-videos',
    false,
    26214400,
    ARRAY['video/mp4', 'video/quicktime', 'video/webm']::text[]
  ),
  (
    'story-media',
    'story-media',
    false,
    15728640,
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime', 'video/webm']::text[]
  )
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Re-runnable policies for direct uploads and owner maintenance.  Application
-- code must always use `{auth.uid()}/{uuid}.{extension}`; the first path segment
-- is the authorization boundary.
DROP POLICY IF EXISTS "Social media owner upload" ON storage.objects;
DROP POLICY IF EXISTS "Social media owner read" ON storage.objects;
DROP POLICY IF EXISTS "Social media owner update" ON storage.objects;
DROP POLICY IF EXISTS "Social media owner delete" ON storage.objects;

CREATE POLICY "Social media owner upload"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id IN ('profile-voice', 'profile-videos', 'story-media')
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Social media owner read"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id IN ('profile-voice', 'profile-videos', 'story-media')
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.is_admin(auth.uid())
  )
);

CREATE POLICY "Social media owner update"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id IN ('profile-voice', 'profile-videos', 'story-media')
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id IN ('profile-voice', 'profile-videos', 'story-media')
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Social media owner delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id IN ('profile-voice', 'profile-videos', 'story-media')
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Storage can enforce bytes and MIME types, but cannot inspect audio/video
-- duration. The social-feature migration must enforce the declared duration in
-- its media metadata table; the upload/finalize worker must measure it before
-- publishing. The policy values are intentionally duplicated in the JSON
-- contract for client and worker preflight validation.

-- Story records expire at 24h. This cleanup provides a storage backstop for
-- abandoned/orphaned files; it deliberately keeps a one-hour grace period so a
-- story and its database row cannot disappear at slightly different moments.
CREATE OR REPLACE FUNCTION public.cleanup_expired_story_objects()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage
AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM storage.objects
  WHERE bucket_id = 'story-media'
    AND created_at < (timezone('utc', now()) - interval '25 hours');

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_expired_story_objects() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_story_objects() TO service_role;

-- Provider-search abuse guard. The music Edge Function consumes one slot before
-- calling Spotify, so a valid app user cannot turn the provider credentials into
-- an unbounded catalog proxy. No client is granted direct table access.
CREATE TABLE IF NOT EXISTS public.music_catalog_rate_limits (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  window_started_at timestamptz NOT NULL DEFAULT date_trunc('minute', now()),
  request_count smallint NOT NULL DEFAULT 0 CHECK (request_count >= 0)
);

ALTER TABLE public.music_catalog_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.music_catalog_rate_limits FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.consume_music_catalog_request()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $rate_limit$
DECLARE
  caller_id uuid := auth.uid();
  active_window timestamptz := date_trunc('minute', now());
  new_count smallint;
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  INSERT INTO public.music_catalog_rate_limits (user_id, window_started_at, request_count)
  VALUES (caller_id, active_window, 1)
  ON CONFLICT (user_id) DO UPDATE
  SET
    window_started_at = CASE
      WHEN music_catalog_rate_limits.window_started_at < active_window THEN active_window
      ELSE music_catalog_rate_limits.window_started_at
    END,
    request_count = CASE
      WHEN music_catalog_rate_limits.window_started_at < active_window THEN 1
      ELSE music_catalog_rate_limits.request_count + 1
    END
  RETURNING request_count INTO new_count;

  RETURN new_count <= 30;
END;
$rate_limit$;

REVOKE ALL ON FUNCTION public.consume_music_catalog_request() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consume_music_catalog_request() TO authenticated;

COMMIT;

-- Optional owner-gated schedule: enable only after confirming pg_cron is
-- available for this Supabase project. Run this once in SQL Editor:
-- SELECT cron.schedule(
--   'jodi-cleanup-expired-story-media',
--   '17 * * * *',
--   $$SELECT public.cleanup_expired_story_objects();$$
-- );
