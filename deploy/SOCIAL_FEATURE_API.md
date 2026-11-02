# Saathi Social Feature API

**Version:** 1 (paired with `social-media-contract.json` version 1)

**Audience:** authenticated Saathi clients

**Canonical mutation endpoint:** `POST /functions/v1/social-media`

This document is the frontend integration contract for voice introductions, profile videos, 24-hour stories, prompts, Green Flag badges, icebreakers, favorite music, and match-streak reads. Do not persist social content, storage paths, or signed media URLs in browser-local storage. Post mutations to the Edge Function and re-read server state with the RPCs below.

## Deployment order and security model

1. Apply `deploy/social-feature-production.sql`.
2. Apply the already-merged `deploy/social-media-storage.sql` from PR #3.
3. Deploy `edge-functions/_shared/cors.ts` and `edge-functions/social-media/index.ts` as `social-media`, using `deploy/supabase_functions/social-media/config.toml` (`verify_jwt = true`).
4. Configure server-only secrets: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `APP_ALLOWED_ORIGINS`, `MEDIA_DURATION_VALIDATOR_URL`, and `MEDIA_DURATION_VALIDATOR_TOKEN`.

All social buckets are private. A member can upload into their own generated path, but no app screen should construct a public storage URL. Playback/rendering must request a fresh five-minute signed URL through `signed_read_url` after reading content metadata. The server verifies profile eligibility, blocks, match-only privacy, story expiry, and ownership before signing.

The duration validator is mandatory for voice, profile-video, and video-story finalization. It is a trusted server-side media probe that receives a five-minute object URL and responds with `{"duration_seconds": number}` after measuring the stream. Client duration is advisory only; it never authorizes publication.

## Shared function behavior

### Request

```http
POST /functions/v1/social-media
Authorization: Bearer <Supabase access token>
Content-Type: application/json
```

Every request body is a JSON object with an `action`. Browser requests must come from an origin in `APP_ALLOWED_ORIGINS`; native authenticated clients may omit `Origin`.

### Error shape

Every function error has this exact shape:

```json
{
  "error": {
    "code": "MACHINE_READABLE_CODE",
    "message": "Human readable explanation",
    "details": { "optional": "only for limit metadata" }
  }
}
```

Common statuses/codes: `401 UNAUTHORIZED`, `400 INVALID_JSON|INVALID_REQUEST|UNKNOWN_ACTION|INVALID_SETTINGS|INVALID_MEDIA_TYPE`, `404 UPLOAD_NOT_FOUND|STORY_NOT_FOUND|MEDIA_NOT_AVAILABLE`, `409 UPLOAD_EXPIRED|UPLOAD_NOT_FOUND`, `413 FILE_TOO_LARGE`, `415 UNSUPPORTED_MIME_TYPE`, `422 UPLOAD_METADATA_INVALID|MEDIA_DURATION_INVALID|MEDIA_DURATION_EXCEEDED`, `503 *_UNAVAILABLE`, and `500 INTERNAL_ERROR`.

## Media limits (must match client preflight)

| `media_type` | Bucket | Accepted MIME | Maximum bytes | Maximum duration |
| --- | --- | --- | ---: | ---: |
| `voice_intro` | `profile-voice` | `audio/mpeg`, `audio/mp4`, `audio/aac`, `audio/ogg`, `audio/wav`, `audio/webm` | 5,242,880 | 60 seconds |
| `profile_video` | `profile-videos` | `video/mp4`, `video/quicktime`, `video/webm` | 26,214,400 | **30 seconds** |
| `story_media` | `story-media` | `image/jpeg`, `image/png`, `image/webp`, `video/mp4`, `video/quicktime`, `video/webm` | 15,728,640 | video: 15 seconds; image: no duration |

Stories are server-expired exactly 24 hours after creation. The server owns the object path and uses `{authenticated-user-id}/{uuid}.{extension}`; do not accept or send arbitrary paths from the UI.

## Edge Function actions

### 1. `create_upload`

Creates a one-time storage upload target and a 15-minute finalization session. Request before uploading each file.

```json
{
  "action": "create_upload",
  "media_type": "profile_video",
  "mime_type": "video/mp4",
  "byte_size": 10485760
}
```

Success (`200`):

```json
{
  "upload": {
    "upload_id": "uuid",
    "media_type": "profile_video",
    "bucket": "profile-videos",
    "object_path": "current-user-uuid/generated-uuid.mp4",
    "upload_url": "https://...signed storage upload URL...",
    "finalize_before": "2026-11-02T12:34:56.000Z",
    "required_headers": {
      "Content-Type": "video/mp4",
      "x-upsert": "false"
    },
    "max_bytes": 26214400,
    "max_duration_seconds": 30
  }
}
```

**Signed upload URL behavior:** immediately issue a `PUT` to `upload_url` with the raw binary file body and **exactly** the returned `required_headers`. Do **not** add the Supabase bearer token, do not change the returned path, and do not use `x-upsert: true`. A storage success does not publish the asset; call `finalize_upload` next. If the app misses `finalize_before`, create a new upload session rather than retrying the old one.

### 2. `finalize_upload`

Checks actual storage metadata and trusted measured duration, creates the media record, and publishes voice/video. Story media is finalized but remains unpublished until `create_story`.

```json
{
  "action": "finalize_upload",
  "upload_id": "uuid returned by create_upload",
  "duration_seconds": 28.42
}
```

For an image story omit `duration_seconds` (or send `null`). `duration_seconds` is useful for the validator but is not trusted.

Success (`200`):

```json
{
  "media": {
    "media_id": "uuid",
    "media_type": "profile_video",
    "mime_type": "video/mp4",
    "byte_size": 10485760,
    "duration_seconds": 28.42,
    "published": true,
    "created_at": "2026-11-02T12:20:00.000Z"
  },
  "idempotent": false
}
```

A repeat finalization of an already finalized session returns the same `media` with `idempotent: true`. For `voice_intro` and `profile_video`, a successful finalization replaces the previous published asset of that type. Do not optimistically display a media item until finalization returns successfully.

### 3. `signed_read_url`

Mints a five-minute private playback/render URL after a server-side visibility check. Provide **exactly one** target ID.

```json
{ "action": "signed_read_url", "media_id": "uuid from profile RPC" }
```

or

```json
{ "action": "signed_read_url", "story_id": "uuid from stories RPC" }
```

Success (`200`):

```json
{
  "signed_url": "https://...signed read URL...",
  "expires_at": "2026-11-02T12:25:00.000Z",
  "media_id": "uuid"
}
```

Treat `signed_url` as short-lived in-memory view state only. Refresh it by calling this action again after expiry, a playback `403`, or a story viewer reopen.

### 4. `create_story`

Attaches finalized, unpublished `story_media` to a story. The database sets `expires_at` to exactly 24 hours after `created_at`.

```json
{
  "action": "create_story",
  "media_id": "uuid returned by finalize_upload",
  "caption": "Sunday chai walk"
}
```

`caption` is optional and limited to 220 characters.

Success (`200`):

```json
{
  "story": {
    "story_id": "uuid",
    "media_id": "uuid",
    "caption": "Sunday chai walk",
    "created_at": "2026-11-02T12:20:00.000Z",
    "expires_at": "2026-11-03T12:20:00.000Z"
  }
}
```

### 5. `delete_story`

Deletes an owned story and asks private storage to remove its media. Expired stories are not returned by reads even before scheduled cleanup.

```json
{ "action": "delete_story", "story_id": "uuid" }
```

Success (`200`):

```json
{ "deleted": true, "story_id": "uuid" }
```

### 6. `update_settings`

This is the only client mutation surface for profile social settings, Hinge-style prompts, Green Flag badges, icebreakers, and favorite music. Every collection field is **replace-all only when it is present**. Omit a field to leave it unchanged; send `[]` to clear it.

```json
{
  "action": "update_settings",
  "settings": {
    "voice_visibility": "matches",
    "video_visibility": "matches",
    "story_visibility": "matches",
    "profile_content_visibility": "everyone"
  },
  "prompts": [
    {
      "position": 1,
      "prompt": "The way to win me over is…",
      "answer": "Be kind to waitstaff and bring strong opinions about chai."
    }
  ],
  "green_flag_badges": ["great_listener", "family_oriented"],
  "icebreakers": ["What is your perfect Sunday?", "What song never gets old for you?"],
  "favorite_music": [
    {
      "provider": "spotify",
      "provider_track_id": "spotify-track-id",
      "track_name": "Song title",
      "artist_name": "Artist name",
      "album_image_url": "https://image.example/cover.jpg",
      "external_url": "https://open.spotify.com/track/example"
    }
  ]
}
```

Success (`200`):

```json
{ "updated": true }
```

Rules:

- Every visibility is `everyone`, `matches`, or `hidden`. Defaults: media/stories `matches`, profile text `everyone`.
- `prompts`: 0–3, unique `position` values 1–3; prompt ≤160 characters; answer ≤300.
- `green_flag_badges`: 0–5 unique lowercase codes matching `^[a-z0-9][a-z0-9_-]{1,63}$`.
- `icebreakers`: 0–3 ordered strings, each ≤200 characters.
- `favorite_music`: 0–5 unique Spotify tracks, in display order. It may contain **only** `provider`, `provider_track_id`, `track_name`, `artist_name`, `album_image_url`, and `external_url`; URL fields are `https` or `null`. Obtain track metadata with the existing authenticated `music-catalog` function. Never send, store, or render provider access tokens, refresh tokens, or audio stream URLs.

## Read RPCs

Use Supabase RPC with the current authenticated session. Each returns a JSON array/object, never raw storage paths. If a content element includes `media_id` or a story includes `story_id`, call `signed_read_url` when it must be rendered.

### `get_profile_social_content`

```ts
supabase.rpc("get_profile_social_content", { p_profile_id: profileId })
```

Returns (`data`):

```json
{
  "profile_id": "uuid",
  "voice_intro": {
    "media_id": "uuid",
    "mime_type": "audio/mpeg",
    "byte_size": 12345,
    "duration_seconds": 31.2
  },
  "profile_video": null,
  "prompts": [{ "position": 1, "prompt": "…", "answer": "…" }],
  "green_flag_badges": ["great_listener"],
  "icebreakers": [{ "position": 1, "text": "…" }],
  "favorite_music": [{
    "position": 1,
    "provider": "spotify",
    "provider_track_id": "…",
    "track_name": "…",
    "artist_name": "…",
    "album_image_url": "https://… or null",
    "external_url": "https://… or null"
  }]
}
```

The RPC requires an eligible, non-blocked caller. It returns media only when the relevant voice/video visibility permits the caller; it returns prompts, badges, icebreakers, and music only when `profile_content_visibility` permits the caller. It raises an RPC error for blocked, banned, unauthenticated, or unavailable profiles.

### `get_active_stories`

```ts
// Story feed visible to the caller:
supabase.rpc("get_active_stories", { p_profile_id: null })

// One profile's visible active stories:
supabase.rpc("get_active_stories", { p_profile_id: profileId })
```

Returns an array ordered newest first:

```json
[
  {
    "story_id": "uuid",
    "profile_id": "uuid",
    "media_id": "uuid",
    "mime_type": "image/jpeg",
    "byte_size": 12345,
    "duration_seconds": null,
    "caption": "Sunday chai walk",
    "created_at": "2026-11-02T12:20:00.000Z",
    "expires_at": "2026-11-03T12:20:00.000Z"
  }
]
```

Only non-deleted, unexpired stories that the caller may view under `story_visibility` are returned. Request `signed_read_url` by `story_id`; never derive a URL from `media_id` for stories.

### `get_match_streaks`

```ts
// All caller-owned matches:
supabase.rpc("get_match_streaks", { p_match_id: null })

// One caller-owned match:
supabase.rpc("get_match_streaks", { p_match_id: matchId })
```

Returns:

```json
[
  {
    "match_id": "uuid",
    "streak_count": 7,
    "last_message_at": "2026-11-02T12:20:00.000Z",
    "created_at": "2026-10-20T12:20:00.000Z"
  }
]
```

A caller can read only matches in which they are a participant. A non-participant gets `[]` for a supplied ID, not another member’s streak data.

## Frontend integration rules

1. Keep source file bytes only until upload/finalization completes; do not cache source or signed URLs in local storage, IndexedDB, or profile rows.
2. Use client-side duration/size checks for UX, but show success only after `finalize_upload`; server-side byte/MIME and trusted duration checks are authoritative.
3. Re-fetch `get_profile_social_content`, `get_active_stories`, and `get_match_streaks` after successful mutations instead of mutating durable client state by hand.
4. Handle `MEDIA_VALIDATION_UNAVAILABLE` as retryable without forcing a re-upload. Handle `MEDIA_DURATION_*`, `FILE_TOO_LARGE`, and `UNSUPPORTED_MIME_TYPE` as rejected uploads requiring a new file.
5. Do not query/write `social_*` tables directly from the frontend. RLS allows owner operational reads only; all social profile/story visibility reads are the documented RPCs and all mutations are the Edge Function.
