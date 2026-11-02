import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, isAllowedBrowserOrigin, jsonResponse } from "../_shared/cors.ts";

const METHODS = "POST, OPTIONS";
const SIGNED_READ_TTL_SECONDS = 300;
const UPLOAD_SESSION_TTL_MS = 15 * 60 * 1000;

type MediaType = "voice_intro" | "profile_video" | "story_media";
type Visibility = "everyone" | "matches" | "hidden";
type Json = Record<string, unknown>;

type MediaPolicy = {
  bucket: string;
  maxBytes: number;
  maxDurationSeconds: number | null;
  mimeTypes: readonly string[];
  extensionForMime: Record<string, string>;
};

const MEDIA: Record<MediaType, MediaPolicy> = {
  voice_intro: {
    bucket: "profile-voice",
    maxBytes: 5242880,
    maxDurationSeconds: 60,
    mimeTypes: ["audio/mpeg", "audio/mp4", "audio/aac", "audio/ogg", "audio/wav", "audio/webm"],
    extensionForMime: { "audio/mpeg": "mp3", "audio/mp4": "m4a", "audio/aac": "aac", "audio/ogg": "ogg", "audio/wav": "wav", "audio/webm": "webm" },
  },
  profile_video: {
    bucket: "profile-videos",
    maxBytes: 26214400,
    maxDurationSeconds: 30,
    mimeTypes: ["video/mp4", "video/quicktime", "video/webm"],
    extensionForMime: { "video/mp4": "mp4", "video/quicktime": "mov", "video/webm": "webm" },
  },
  story_media: {
    bucket: "story-media",
    maxBytes: 15728640,
    maxDurationSeconds: 15,
    mimeTypes: ["image/jpeg", "image/png", "image/webp", "video/mp4", "video/quicktime", "video/webm"],
    extensionForMime: { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "video/mp4": "mp4", "video/quicktime": "mov", "video/webm": "webm" },
  },
};

class ApiError extends Error {
  constructor(readonly status: number, readonly code: string, message: string, readonly details?: Json) {
    super(message);
  }
}

function fail(status: number, code: string, message: string, details?: Json): never {
  throw new ApiError(status, code, message, details);
}

function errorResponse(request: Request, error: unknown): Response {
  if (error instanceof ApiError) {
    return jsonResponse(request, METHODS, { error: { code: error.code, message: error.message, ...(error.details ? { details: error.details } : {}) } }, error.status);
  }
  console.error("social-media unexpected error", error);
  return jsonResponse(request, METHODS, { error: { code: "INTERNAL_ERROR", message: "Social media is temporarily unavailable" } }, 500);
}

function asObject(value: unknown, name: string): Json {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(400, "INVALID_REQUEST", `${name} must be an object`);
  return value as Json;
}

function requiredString(value: unknown, name: string, max = 500): string {
  if (typeof value !== "string") fail(400, "INVALID_REQUEST", `${name} is required`);
  const normalized = value.trim();
  if (!normalized || normalized.length > max) fail(400, "INVALID_REQUEST", `${name} must be between 1 and ${max} characters`);
  return normalized;
}

function optionalString(value: unknown, name: string, max: number): string | null {
  if (value === undefined || value === null) return null;
  return requiredString(value, name, max);
}

function positiveInteger(value: unknown, name: string): number {
  if (!Number.isInteger(value) || (value as number) <= 0) fail(400, "INVALID_REQUEST", `${name} must be a positive integer`);
  return value as number;
}

function numberOrNull(value: unknown, name: string): number | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) fail(400, "INVALID_REQUEST", `${name} must be a positive number or null`);
  return value;
}

function mediaType(value: unknown): MediaType {
  if (value !== "voice_intro" && value !== "profile_video" && value !== "story_media") fail(400, "INVALID_MEDIA_TYPE", "media_type must be voice_intro, profile_video, or story_media");
  return value;
}

function validateVisibility(value: unknown, name: string): Visibility {
  if (value !== "everyone" && value !== "matches" && value !== "hidden") fail(400, "INVALID_SETTINGS", `${name} must be everyone, matches, or hidden`);
  return value;
}

function isHttpsUrl(value: string | null, name: string): string | null {
  if (value === null) return null;
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:") throw new Error();
    return parsed.toString();
  } catch {
    fail(400, "INVALID_SETTINGS", `${name} must be an https URL or null`);
  }
}

function nowIsoAfter(milliseconds: number): string {
  return new Date(Date.now() + milliseconds).toISOString();
}

async function authenticatedClients(request: Request) {
  const authorization = request.headers.get("Authorization");
  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!authorization || !url || !anonKey || !serviceRoleKey) fail(401, "UNAUTHORIZED", "A valid authenticated session is required");

  const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authorization } } });
  const { data, error } = await userClient.auth.getUser();
  if (error || !data.user) fail(401, "UNAUTHORIZED", "A valid authenticated session is required");

  return { userId: data.user.id, userClient, admin: createClient(url, serviceRoleKey) };
}

function mediaResponse(media: Record<string, unknown>) {
  return {
    media_id: media.id,
    media_type: media.media_type,
    mime_type: media.mime_type,
    byte_size: media.byte_size,
    duration_seconds: media.duration_seconds,
    published: media.is_published,
    created_at: media.created_at,
  };
}

async function removeObject(admin: ReturnType<typeof createClient>, bucket: string, objectPath: string) {
  const { error } = await admin.storage.from(bucket).remove([objectPath]);
  if (error) console.error("social-media unable to remove rejected object", { bucket, objectPath, error: error.message });
}

async function verifiedDuration(
  admin: ReturnType<typeof createClient>,
  policy: MediaPolicy,
  session: Record<string, unknown>,
  declaredDurationSeconds: number | null,
): Promise<number | null> {
  const mimeType = session.mime_type as string;
  if (mimeType.startsWith("image/")) {
    if (declaredDurationSeconds !== null) fail(400, "INVALID_REQUEST", "duration_seconds must be null or omitted for image stories");
    return null;
  }

  // Duration is a security boundary. The validator fetches the short-lived
  // signed object URL and returns a measured stream duration; the client value
  // is advisory only and is never used to publish media.
  const validatorUrl = Deno.env.get("MEDIA_DURATION_VALIDATOR_URL");
  const validatorToken = Deno.env.get("MEDIA_DURATION_VALIDATOR_TOKEN");
  if (!validatorUrl || !validatorToken) {
    fail(503, "MEDIA_VALIDATION_UNAVAILABLE", "Media duration validation is not configured");
  }
  const { data: signed, error: signError } = await admin.storage
    .from(session.bucket as string)
    .createSignedUrl(session.object_path as string, SIGNED_READ_TTL_SECONDS);
  if (signError || !signed?.signedUrl) fail(503, "MEDIA_VALIDATION_UNAVAILABLE", "Media duration validation is temporarily unavailable");

  let response: Response;
  try {
    response = await fetch(validatorUrl, {
      method: "POST",
      headers: { Authorization: `Bearer ${validatorToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        media_type: session.media_type,
        mime_type: mimeType,
        download_url: signed.signedUrl,
        declared_duration_seconds: declaredDurationSeconds,
      }),
    });
  } catch {
    fail(503, "MEDIA_VALIDATION_UNAVAILABLE", "Media duration validation is temporarily unavailable");
  }
  if (!response.ok) fail(422, "MEDIA_DURATION_INVALID", "The uploaded media duration could not be verified");

  const payload = await response.json().catch(() => null) as Record<string, unknown> | null;
  const measured = payload?.duration_seconds;
  if (typeof measured !== "number" || !Number.isFinite(measured) || measured <= 0) {
    fail(422, "MEDIA_DURATION_INVALID", "The uploaded media duration could not be verified");
  }
  if (policy.maxDurationSeconds === null || measured > policy.maxDurationSeconds) {
    fail(422, "MEDIA_DURATION_EXCEEDED", `Media duration exceeds the ${policy.maxDurationSeconds}-second limit`, { max_duration_seconds: policy.maxDurationSeconds });
  }
  return Math.round(measured * 1000) / 1000;
}

async function objectMetadata(
  admin: ReturnType<typeof createClient>,
  session: Record<string, unknown>,
): Promise<{ byteSize: number; mimeType: string }> {
  const objectPath = session.object_path as string;
  const slash = objectPath.lastIndexOf("/");
  const folder = objectPath.slice(0, slash);
  const filename = objectPath.slice(slash + 1);
  const { data, error } = await admin.storage.from(session.bucket as string).list(folder, { limit: 10, search: filename });
  if (error) fail(409, "UPLOAD_NOT_FOUND", "The uploaded object is not available yet");
  const item = (data ?? []).find((entry: Record<string, unknown>) => entry.name === filename) as Record<string, unknown> | undefined;
  if (!item) fail(409, "UPLOAD_NOT_FOUND", "The uploaded object is not available yet");
  const metadata = (item.metadata ?? {}) as Record<string, unknown>;
  const byteSize = metadata.size;
  const mimeType = metadata.mimetype;
  if (!Number.isInteger(byteSize) || (byteSize as number) <= 0 || typeof mimeType !== "string") {
    fail(422, "UPLOAD_METADATA_INVALID", "The uploaded object metadata is incomplete");
  }
  return { byteSize: byteSize as number, mimeType };
}

async function createUpload(request: Json, userId: string, admin: ReturnType<typeof createClient>) {
  const type = mediaType(request.media_type);
  const policy = MEDIA[type];
  const mimeType = requiredString(request.mime_type, "mime_type", 100).toLowerCase();
  const declaredByteSize = positiveInteger(request.byte_size, "byte_size");
  if (!policy.mimeTypes.includes(mimeType)) fail(415, "UNSUPPORTED_MIME_TYPE", "mime_type is not allowed for this media_type", { allowed_mime_types: [...policy.mimeTypes] });
  if (declaredByteSize > policy.maxBytes) fail(413, "FILE_TOO_LARGE", `byte_size exceeds the ${policy.maxBytes}-byte limit`, { max_bytes: policy.maxBytes });

  const objectPath = `${userId}/${crypto.randomUUID()}.${policy.extensionForMime[mimeType]}`;
  const expiresAt = nowIsoAfter(UPLOAD_SESSION_TTL_MS);
  const { data: session, error: sessionError } = await admin.from("social_upload_sessions").insert({
    profile_id: userId, media_type: type, bucket: policy.bucket, object_path: objectPath,
    mime_type: mimeType, declared_byte_size: declaredByteSize, expires_at: expiresAt,
  }).select().single();
  if (sessionError || !session) fail(503, "UPLOAD_UNAVAILABLE", "Unable to prepare an upload");

  const { data: signed, error: signedError } = await admin.storage.from(policy.bucket).createSignedUploadUrl(objectPath);
  if (signedError || !signed?.signedUrl) {
    await admin.from("social_upload_sessions").update({ status: "rejected" }).eq("id", session.id);
    fail(503, "UPLOAD_UNAVAILABLE", "Unable to prepare an upload");
  }

  return {
    upload: {
      upload_id: session.id,
      media_type: type,
      bucket: policy.bucket,
      object_path: objectPath,
      upload_url: signed.signedUrl,
      finalize_before: expiresAt,
      required_headers: { "Content-Type": mimeType, "x-upsert": "false" },
      max_bytes: policy.maxBytes,
      max_duration_seconds: policy.maxDurationSeconds,
    },
  };
}

async function finalizeUpload(request: Json, userId: string, admin: ReturnType<typeof createClient>) {
  const uploadId = requiredString(request.upload_id, "upload_id", 36);
  const declaredDuration = numberOrNull(request.duration_seconds, "duration_seconds");
  const { data: session, error } = await admin.from("social_upload_sessions").select().eq("id", uploadId).maybeSingle();
  if (error || !session || session.profile_id !== userId) fail(404, "UPLOAD_NOT_FOUND", "Upload session was not found");
  if (session.status === "finalized") {
    const { data: existing } = await admin.from("social_media").select().eq("upload_session_id", session.id).maybeSingle();
    if (existing) return { media: mediaResponse(existing as Record<string, unknown>), idempotent: true };
  }
  if (session.status !== "issued" || new Date(session.expires_at).getTime() < Date.now()) {
    if (session.status === "issued") await admin.from("social_upload_sessions").update({ status: "expired" }).eq("id", session.id);
    fail(409, "UPLOAD_EXPIRED", "Upload session has expired or is no longer finalizable");
  }

  const policy = MEDIA[session.media_type as MediaType];
  let metadata: { byteSize: number; mimeType: string };
  let duration: number | null;
  try {
    metadata = await objectMetadata(admin, session as Record<string, unknown>);
    if (metadata.byteSize > policy.maxBytes) fail(413, "FILE_TOO_LARGE", `Uploaded file exceeds the ${policy.maxBytes}-byte limit`, { max_bytes: policy.maxBytes });
    if (metadata.mimeType.toLowerCase() !== session.mime_type) fail(415, "UNSUPPORTED_MIME_TYPE", "Uploaded Content-Type does not match the prepared upload");
    duration = await verifiedDuration(admin, policy, session as Record<string, unknown>, declaredDuration);
  } catch (caught) {
    // Retain uploads when a validator is temporarily unavailable so the member
    // can retry finalization. Invalid/rejected content is removed immediately.
    if (caught instanceof ApiError && caught.code !== "MEDIA_VALIDATION_UNAVAILABLE" && caught.code !== "UPLOAD_NOT_FOUND") {
      await removeObject(admin, session.bucket, session.object_path);
      await admin.from("social_upload_sessions").update({ status: "rejected" }).eq("id", session.id);
    }
    throw caught;
  }

  if (session.media_type === "voice_intro" || session.media_type === "profile_video") {
    await admin.from("social_media").update({ is_published: false })
      .eq("profile_id", userId).eq("media_type", session.media_type).eq("is_published", true);
  }
  const { data: media, error: insertError } = await admin.from("social_media").insert({
    profile_id: userId, upload_session_id: session.id, media_type: session.media_type,
    bucket: session.bucket, object_path: session.object_path, mime_type: session.mime_type,
    byte_size: metadata.byteSize, duration_seconds: duration,
    is_published: session.media_type !== "story_media",
  }).select().single();
  if (insertError || !media) fail(503, "FINALIZE_UNAVAILABLE", "Unable to finalize uploaded media");
  await admin.from("social_upload_sessions").update({ status: "finalized", finalized_at: new Date().toISOString() }).eq("id", session.id);
  return { media: mediaResponse(media as Record<string, unknown>), idempotent: false };
}

async function createStory(request: Json, userId: string, admin: ReturnType<typeof createClient>) {
  const mediaId = requiredString(request.media_id, "media_id", 36);
  const caption = optionalString(request.caption, "caption", 220);
  const { data: asset, error: assetError } = await admin.from("social_media").select().eq("id", mediaId).maybeSingle();
  if (assetError || !asset || asset.profile_id !== userId || asset.media_type !== "story_media" || asset.is_published) {
    fail(404, "STORY_MEDIA_NOT_FOUND", "Finalized unpublished story media was not found");
  }
  const { data: story, error } = await admin.from("social_stories").insert({
    profile_id: userId, media_id: mediaId, caption,
    // The database trigger sets this to exactly 24 hours after created_at.
    expires_at: nowIsoAfter(24 * 60 * 60 * 1000),
  }).select().single();
  if (error || !story) fail(503, "STORY_UNAVAILABLE", "Unable to create the story");
  await admin.from("social_media").update({ is_published: true }).eq("id", mediaId);
  return { story: { story_id: story.id, media_id: story.media_id, caption: story.caption, created_at: story.created_at, expires_at: story.expires_at } };
}

async function deleteStory(request: Json, userId: string, admin: ReturnType<typeof createClient>) {
  const storyId = requiredString(request.story_id, "story_id", 36);
  const { data: story, error } = await admin.from("social_stories").select("id, profile_id, media_id").eq("id", storyId).maybeSingle();
  if (error || !story || story.profile_id !== userId) fail(404, "STORY_NOT_FOUND", "Story was not found");
  const { data: asset } = await admin.from("social_media").select("bucket, object_path").eq("id", story.media_id).maybeSingle();
  if (asset) await removeObject(admin, asset.bucket, asset.object_path);
  const { error: deleteError } = await admin.from("social_media").delete().eq("id", story.media_id);
  if (deleteError) fail(503, "STORY_UNAVAILABLE", "Unable to delete the story");
  return { deleted: true, story_id: storyId };
}

async function signedReadUrl(request: Json, userClient: ReturnType<typeof createClient>, admin: ReturnType<typeof createClient>) {
  const mediaId = request.media_id === undefined ? null : requiredString(request.media_id, "media_id", 36);
  const storyId = request.story_id === undefined ? null : requiredString(request.story_id, "story_id", 36);
  if ((mediaId === null) === (storyId === null)) fail(400, "INVALID_REQUEST", "Provide exactly one of media_id or story_id");
  const { data: target, error } = await userClient.rpc("resolve_social_read_target", { p_media_id: mediaId, p_story_id: storyId });
  if (error || !target) fail(404, "MEDIA_NOT_AVAILABLE", "Media is not available");
  const readable = target as Record<string, unknown>;
  const { data: signed, error: signError } = await admin.storage
    .from(readable.bucket as string)
    .createSignedUrl(readable.object_path as string, SIGNED_READ_TTL_SECONDS);
  if (signError || !signed?.signedUrl) fail(503, "SIGNED_URL_UNAVAILABLE", "Unable to prepare media playback");
  return { signed_url: signed.signedUrl, expires_at: nowIsoAfter(SIGNED_READ_TTL_SECONDS * 1000), media_id: readable.media_id };
}

function validatePrompts(value: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(value) || value.length > 3) fail(400, "INVALID_SETTINGS", "prompts must contain at most three items");
  const positions = new Set<number>();
  return value.map((raw) => {
    const item = asObject(raw, "prompt");
    const position = positiveInteger(item.position, "prompt.position");
    if (position > 3 || positions.has(position)) fail(400, "INVALID_SETTINGS", "prompt positions must be unique values from 1 through 3");
    positions.add(position);
    return { position, prompt: requiredString(item.prompt, "prompt.prompt", 160), answer: requiredString(item.answer, "prompt.answer", 300) };
  });
}

function validateIcebreakers(value: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(value) || value.length > 3) fail(400, "INVALID_SETTINGS", "icebreakers must contain at most three items");
  return value.map((raw, index) => ({ position: index + 1, text: requiredString(raw, "icebreaker", 200) }));
}

function validateBadges(value: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(value) || value.length > 5) fail(400, "INVALID_SETTINGS", "green_flag_badges must contain at most five items");
  const seen = new Set<string>();
  return value.map((raw) => {
    const badgeCode = requiredString(raw, "green_flag_badge", 64);
    if (!/^[a-z0-9][a-z0-9_-]{1,63}$/.test(badgeCode) || seen.has(badgeCode)) fail(400, "INVALID_SETTINGS", "green_flag_badges must be unique lowercase badge codes");
    seen.add(badgeCode);
    return { badge_code: badgeCode };
  });
}

function validateMusic(value: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(value) || value.length > 5) fail(400, "INVALID_SETTINGS", "favorite_music must contain at most five items");
  const seen = new Set<string>();
  return value.map((raw, index) => {
    const item = asObject(raw, "favorite_music item");
    if (item.provider !== "spotify") fail(400, "INVALID_SETTINGS", "favorite_music.provider must be spotify");
    const providerTrackId = requiredString(item.provider_track_id, "favorite_music.provider_track_id", 255);
    if (seen.has(providerTrackId)) fail(400, "INVALID_SETTINGS", "favorite_music track IDs must be unique");
    seen.add(providerTrackId);
    return {
      position: index + 1, provider: "spotify", provider_track_id: providerTrackId,
      track_name: requiredString(item.track_name, "favorite_music.track_name", 300),
      artist_name: requiredString(item.artist_name, "favorite_music.artist_name", 300),
      album_image_url: isHttpsUrl(optionalString(item.album_image_url, "favorite_music.album_image_url", 2048), "favorite_music.album_image_url"),
      external_url: isHttpsUrl(optionalString(item.external_url, "favorite_music.external_url", 2048), "favorite_music.external_url"),
    };
  });
}

async function updateSettings(request: Json, userId: string, admin: ReturnType<typeof createClient>) {
  const settingsRaw = request.settings === undefined ? {} : asObject(request.settings, "settings");
  const settings: Record<string, unknown> = { profile_id: userId, updated_at: new Date().toISOString() };
  for (const key of ["voice_visibility", "video_visibility", "story_visibility", "profile_content_visibility"]) {
    if (settingsRaw[key] !== undefined) settings[key] = validateVisibility(settingsRaw[key], key);
  }
  const { error: settingsError } = await admin.from("social_settings").upsert(settings);
  if (settingsError) fail(503, "SETTINGS_UNAVAILABLE", "Unable to update social settings");

  if (request.prompts !== undefined) {
    const rows = validatePrompts(request.prompts);
    await admin.from("social_prompts").delete().eq("profile_id", userId);
    if (rows.length) { const { error } = await admin.from("social_prompts").insert(rows.map((row) => ({ ...row, profile_id: userId }))); if (error) fail(503, "SETTINGS_UNAVAILABLE", "Unable to update prompts"); }
  }
  if (request.green_flag_badges !== undefined) {
    const rows = validateBadges(request.green_flag_badges);
    await admin.from("social_green_flag_badges").delete().eq("profile_id", userId);
    if (rows.length) { const { error } = await admin.from("social_green_flag_badges").insert(rows.map((row) => ({ ...row, profile_id: userId }))); if (error) fail(503, "SETTINGS_UNAVAILABLE", "Unable to update green flag badges"); }
  }
  if (request.icebreakers !== undefined) {
    const rows = validateIcebreakers(request.icebreakers);
    await admin.from("social_icebreakers").delete().eq("profile_id", userId);
    if (rows.length) { const { error } = await admin.from("social_icebreakers").insert(rows.map((row) => ({ ...row, profile_id: userId }))); if (error) fail(503, "SETTINGS_UNAVAILABLE", "Unable to update icebreakers"); }
  }
  if (request.favorite_music !== undefined) {
    const rows = validateMusic(request.favorite_music);
    await admin.from("social_favorite_music").delete().eq("profile_id", userId);
    if (rows.length) { const { error } = await admin.from("social_favorite_music").insert(rows.map((row) => ({ ...row, profile_id: userId }))); if (error) fail(503, "SETTINGS_UNAVAILABLE", "Unable to update favorite music"); }
  }
  return { updated: true };
}

serve(async (request) => {
  if (!isAllowedBrowserOrigin(request)) return new Response(null, { status: 403, headers: { Vary: "Origin" } });
  if (request.method === "OPTIONS") return new Response("ok", { status: 204, headers: corsHeaders(request, METHODS) });
  if (request.method !== "POST") return jsonResponse(request, METHODS, { error: { code: "METHOD_NOT_ALLOWED", message: "Only POST is supported" } }, 405);

  try {
    const body = asObject(await request.json().catch(() => fail(400, "INVALID_JSON", "Request body must be valid JSON")), "request body");
    const action = requiredString(body.action, "action", 40);
    const { userId, userClient, admin } = await authenticatedClients(request);
    let result: Json;
    switch (action) {
      case "create_upload": result = await createUpload(body, userId, admin); break;
      case "finalize_upload": result = await finalizeUpload(body, userId, admin); break;
      case "signed_read_url": result = await signedReadUrl(body, userClient, admin); break;
      case "create_story": result = await createStory(body, userId, admin); break;
      case "delete_story": result = await deleteStory(body, userId, admin); break;
      case "update_settings": result = await updateSettings(body, userId, admin); break;
      default: fail(400, "UNKNOWN_ACTION", "action must be create_upload, finalize_upload, signed_read_url, create_story, delete_story, or update_settings");
    }
    return jsonResponse(request, METHODS, result);
  } catch (error) {
    return errorResponse(request, error);
  }
});
