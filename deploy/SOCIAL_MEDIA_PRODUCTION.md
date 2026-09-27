# Social Media and Favorite Music — Production Runbook

**Prepared September 21, 2026.** This package configures the production boundary for voice introductions, profile videos, stories, and provider-backed favorite-music selection. It deliberately contains **no live credentials**.

## What this package adds

| Capability | Deployment control | Product limit |
| --- | --- | --- |
| Voice introduction | Private `profile-voice` bucket, strict MIME/size allowlist | 60 seconds; 5 MiB |
| Profile video | Private `profile-videos` bucket, strict MIME/size allowlist | 30 seconds; 25 MiB |
| Story photo/video | Private `story-media` bucket plus cleanup backstop | video: 15 seconds; 15 MiB; expires after 24 hours |
| Favorite music | Authenticated `music-catalog` Edge Function proxying Spotify catalog search | 10 safe metadata-only results/query |

The canonical machine-readable limits live in [`social-media-contract.json`](./social-media-contract.json). Client preflight, the social-feature API, and media processing must use these same values.

## Security model

1. **All new media buckets are private.** Do not make them public simply to simplify rendering.
2. Clients upload only to `{authenticated-user-id}/{uuid}.{extension}`. Storage RLS verifies that first path segment.
3. Clients can directly read only their own media. Profile, match, and story viewers receive a **five-minute signed URL** only after a trusted API or Edge Function checks the relevant visibility rule.
4. The storage layer rejects non-allowlisted MIME types and files above the defined byte limit. It cannot inspect an audio/video stream for true duration. The application’s upload-finalization worker must measure duration and reject/delete media that exceeds the contract before publishing it. The social-feature database migration must also reject a declared duration over the applicable limit.
5. `story-media` object cleanup runs separately from story-record expiry, with a one-hour grace period. It prevents orphaned story uploads from being retained if a client abandons an upload or a database write fails.
6. Spotify credentials and all Supabase service credentials stay server-side. Nothing named `SPOTIFY_*`, `SUPABASE_SERVICE_ROLE_KEY`, or a storage-signing credential may use an `EXPO_PUBLIC_` prefix.
7. The `music-catalog` function consumes a database-backed per-user limit of 30 searches per rolling minute window before it calls the provider. This table has RLS enabled and no direct client access.

## Owner-gated setup

### 1. Apply the migrations in the correct order

1. Apply the backend engineer’s social-feature data-model migration first. It creates the media records, story-expiry rule, and media-duration validation used by the product.
2. In the Supabase SQL Editor, run [`social-media-storage.sql`](./social-media-storage.sql).
3. Verify the three buckets are **private** and have the exact byte/MIME settings in the contract file.
4. If the project has `pg_cron` enabled, create the hourly schedule shown at the bottom of `social-media-storage.sql`. The schedule invokes `cleanup_expired_story_objects()` at minute 17. If `pg_cron` is not available, run that function hourly from the platform’s scheduled-job mechanism instead.

The two layers are intentional: product data drives user-visible story expiry at 24 hours; storage cleanup removes abandoned/orphaned files after at most roughly 25 hours.

### 2. Configure browser CORS

Set `APP_ALLOWED_ORIGINS` to a comma-separated list of **exact** production browser origins, for example `https://<public-web-origin>`. Do not use `*`, path segments, query strings, or development origins in production.

New Edge Functions should use [`edge-functions/_shared/cors.ts`](../edge-functions/_shared/cors.ts). It reflects only an allowlisted `Origin`, sends `Vary: Origin`, and rejects non-allowlisted browser preflights. Native Expo apps normally do not send an `Origin` header; their Supabase JWT remains the authorization control.

The existing older Edge Functions use permissive CORS and should be migrated to the shared helper in a follow-up hardening pass; this package does not silently alter those live endpoints.

### 3. Provision the music catalog provider

This release uses **Spotify catalog search**, not a user’s Spotify account. A member searches for a song and Jodi stores only the selected track’s provider ID and display metadata through the social-feature contract. It does not import listening history, request user scopes, cache audio, or stream tracks.

1. In the Spotify developer dashboard, create an application for Jodi.
2. Copy its client ID and client secret into the deployment secret manager as `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET`.
3. Copy [`social-media.env.example`](./social-media.env.example) into your private deployment environment and fill in the values. Do not commit the resulting file.
4. Set these **Supabase Edge Function secrets**: `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, and `APP_ALLOWED_ORIGINS`. `SUPABASE_URL` and `SUPABASE_ANON_KEY` are also required by the authenticated handler.
5. Copy `edge-functions/_shared/cors.ts` and `edge-functions/music-catalog/index.ts` into the equivalent folders of the Supabase Functions project, then deploy `music-catalog` with JWT verification enabled.
6. From an authenticated app session, invoke `music-catalog?q=<at-least-two-character-query>`. It returns a capped, normalized list of track metadata and never returns an app access token.

`SPOTIFY_REDIRECT_URI` is intentionally optional. It is only needed if a later, separately reviewed feature lets members connect their own Spotify account. That future feature must use Authorization Code with PKCE, must request the minimum necessary scope, and must keep refresh tokens server-side. It is not part of this catalog-search release.

### 4. Validate before release

The validator makes no network calls and never prints secrets:

```bash
# Validates MIME, size, duration, 24-hour lifecycle, private-bucket and provider contract.
node deploy/validate-social-media-config.mjs

# Also fails if required production variables are absent or a browser origin is unsafe.
node deploy/validate-social-media-config.mjs --production
```

Run the second command with the deployment environment loaded. A successful run prints only the contract version and readiness status.

## Build and release checklist

- [ ] Social-feature database migration has been applied before the storage policy migration.
- [ ] `profile-voice`, `profile-videos`, and `story-media` are private and match the contract MIME/byte limits.
- [ ] Story expiry is enforced by the data model, and the hourly storage cleanup job is enabled.
- [ ] Upload finalization measures actual duration, not only client-provided metadata.
- [ ] All media rendering paths request time-limited signed URLs after visibility checks; no static public media URL is persisted.
- [ ] `APP_ALLOWED_ORIGINS` contains all and only production web origins, with no wildcard.
- [ ] `music-catalog` deploys with JWT verification enabled and valid Spotify server secrets.
- [ ] The client bundle contains no Spotify secret, service-role key, or signed-URL credential.
- [ ] `node deploy/validate-social-media-config.mjs --production` passes with the release environment loaded.

## API contract: music catalog

`GET music-catalog?q=<query>` requires a valid Supabase bearer token. The query is trimmed, must be 2–100 characters, and returns at most ten objects:

```json
{
  "tracks": [
    {
      "provider": "spotify",
      "provider_track_id": "provider-track-id",
      "track_name": "Song title",
      "artist_name": "Artist name",
      "album_image_url": "https://… or null",
      "external_url": "https://… or null"
    }
  ]
}
```

Persist only those display fields (and the authenticated profile relation) in the social-feature database. Do not persist provider access tokens, refresh tokens, audio streams, or full raw provider responses.
