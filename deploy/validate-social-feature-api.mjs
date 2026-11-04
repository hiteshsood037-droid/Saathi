#!/usr/bin/env node
/**
 * Offline static contract checks for the social-feature migration, Edge Function,
 * and frontend API guide. This intentionally makes no network/database calls.
 * Usage: node deploy/validate-social-feature-api.mjs
 */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = process.cwd();
const read = (path) => readFile(resolve(root, path), 'utf8');
const [contractRaw, migration, handler, docs, storage] = await Promise.all([
  read('deploy/social-media-contract.json'),
  read('deploy/social-feature-production.sql'),
  read('edge-functions/social-media/index.ts'),
  read('deploy/SOCIAL_FEATURE_API.md'),
  read('deploy/social-media-storage.sql'),
]);
const contract = JSON.parse(contractRaw);
const issues = [];
if (/\nAS \$\n/.test(migration) || /\n\$;\n/.test(migration)) {
  issues.push('social-feature-production.sql has an invalid one-dollar PL/pgSQL delimiter');
}
const requireText = (text, needle, file) => {
  if (!text.includes(needle)) issues.push(`${file} is missing: ${needle}`);
};

for (const [name, policy] of Object.entries(contract.media)) {
  requireText(migration, `'${policy.bucket}'`, 'social-feature-production.sql');
  requireText(handler, `bucket: "${policy.bucket}"`, 'social-media Edge Function');
  requireText(handler, `maxBytes: ${policy.max_bytes}`, 'social-media Edge Function');
  requireText(storage, `'${policy.bucket}'`, 'social-media-storage.sql');
  for (const mime of policy.allowed_mime_types) {
    requireText(migration, `'${mime}'`, 'social-feature-production.sql');
    requireText(handler, `"${mime}"`, 'social-media Edge Function');
    requireText(storage, `'${mime}'`, 'social-media-storage.sql');
  }
  const duration = policy.max_duration_seconds ?? policy.max_video_duration_seconds;
  requireText(migration, `max_duration := ${duration}`, 'social-feature-production.sql');
  requireText(docs, `| \`${name}\` |`, 'SOCIAL_FEATURE_API.md');
}

for (const action of ['create_upload', 'finalize_upload', 'signed_read_url', 'create_story', 'delete_story', 'update_settings']) {
  requireText(handler, `case "${action}"`, 'social-media Edge Function');
  requireText(docs, `\`${action}\``, 'SOCIAL_FEATURE_API.md');
}
for (const rpc of ['get_profile_social_content', 'get_active_stories', 'get_match_streaks']) {
  requireText(migration, `FUNCTION public.${rpc}`, 'social-feature-production.sql');
  requireText(docs, `\`${rpc}\``, 'SOCIAL_FEATURE_API.md');
}

// Atomic social mutations must remain database RPCs. These checks intentionally
// guard the production consistency design without needing a live Supabase DB.
const atomicRpcs = [
  'create_social_story',
  'stage_social_story_delete',
  'complete_social_story_delete',
  'update_social_settings',
];
const sqlFunction = (name) => {
  const start = migration.indexOf(`CREATE OR REPLACE FUNCTION public.${name}(`);
  if (start < 0) return '';
  const end = migration.indexOf('\n$$;', start);
  return end < 0 ? '' : migration.slice(start, end + 4);
};
const requireAtomicFunctionText = (name, needle) => {
  const body = sqlFunction(name);
  if (!body.includes(needle)) issues.push(`atomic RPC ${name} is missing: ${needle}`);
};
for (const rpc of atomicRpcs) {
  requireText(migration, `FUNCTION public.${rpc}`, 'social-feature-production.sql');
  requireText(migration, `REVOKE ALL ON FUNCTION public.${rpc}`, 'social-feature-production.sql');
  requireText(handler, `rpc("${rpc}"`, 'social-media Edge Function');
  requireAtomicFunctionText(rpc, 'SECURITY DEFINER');
}
for (const [rpc, requirement] of [
  ['create_social_story', 'INSERT INTO public.social_stories'],
  ['create_social_story', 'UPDATE public.social_media\n  SET is_published = true'],
  ['stage_social_story_delete', 'UPDATE public.social_stories SET deleted_at'],
  ['stage_social_story_delete', 'UPDATE public.social_media SET is_published = false'],
  ['complete_social_story_delete', 'DELETE FROM public.social_media m'],
  ['update_social_settings', 'DELETE FROM public.social_prompts'],
  ['update_social_settings', 'DELETE FROM public.social_green_flag_badges'],
  ['update_social_settings', 'DELETE FROM public.social_icebreakers'],
  ['update_social_settings', 'DELETE FROM public.social_favorite_music'],
  ['update_social_settings', 'INSERT INTO public.social_prompts'],
  ['update_social_settings', 'INSERT INTO public.social_green_flag_badges'],
  ['update_social_settings', 'INSERT INTO public.social_icebreakers'],
  ['update_social_settings', 'INSERT INTO public.social_favorite_music'],
]) requireAtomicFunctionText(rpc, requirement);
for (const directMutation of [
  'admin.from("social_stories")',
  'admin.from("social_settings")',
  'admin.from("social_prompts")',
  'admin.from("social_green_flag_badges")',
  'admin.from("social_icebreakers")',
  'admin.from("social_favorite_music")',
]) {
  if (handler.includes(directMutation)) issues.push(`social-media Edge Function bypasses atomic RPC with ${directMutation}`);
}
requireText(docs, 'STORY_CLEANUP_UNAVAILABLE', 'SOCIAL_FEATURE_API.md');
requireText(docs, 'one atomic database mutation', 'SOCIAL_FEATURE_API.md');
for (const securityRequirement of [
  'ENABLE ROW LEVEL SECURITY',
  'resolve_social_read_target',
  'createSignedUploadUrl',
  'createSignedUrl',
  'MEDIA_DURATION_VALIDATOR_URL',
  "interval '24 hours'",
  'x-upsert',
]) {
  if (!migration.includes(securityRequirement) && !handler.includes(securityRequirement)) {
    issues.push(`required security behavior is absent: ${securityRequirement}`);
  }
}

if (issues.length) {
  console.error('Social feature API contract is not ready:');
  for (const issue of issues) console.error(`- ${issue}`);
  process.exitCode = 1;
} else {
  console.log(`Social feature API static contract is valid for social-media contract v${contract.version}.`);
}
