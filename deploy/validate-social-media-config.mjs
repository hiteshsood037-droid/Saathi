#!/usr/bin/env node
/**
 * Offline production-readiness validation for the social-media deployment
 * contract. No secrets are printed, sent, or stored.
 *
 * Usage:
 *   node deploy/validate-social-media-config.mjs
 *   APP_ALLOWED_ORIGINS='https://app.example.com' \
 *     SUPABASE_URL='https://project.supabase.co' \
 *     SUPABASE_SERVICE_ROLE_KEY='set' SPOTIFY_CLIENT_ID='set' \
 *     SPOTIFY_CLIENT_SECRET='set' \
 *     node deploy/validate-social-media-config.mjs --production
 */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const contractPath = resolve(process.cwd(), 'deploy/social-media-contract.json');
const requiredProductionVariables = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SPOTIFY_CLIENT_ID',
  'SPOTIFY_CLIENT_SECRET',
  'APP_ALLOWED_ORIGINS',
];

export function validateContract(contract) {
  const issues = [];
  const media = contract?.media ?? {};
  const expected = {
    voice_intro: { bucket: 'profile-voice', duration: 60, bytes: 5 * 1024 * 1024 },
    profile_video: { bucket: 'profile-videos', duration: 30, bytes: 25 * 1024 * 1024 },
    story_media: { bucket: 'story-media', duration: 15, bytes: 15 * 1024 * 1024 },
  };

  for (const [name, expectedPolicy] of Object.entries(expected)) {
    const policy = media[name];
    if (!policy) {
      issues.push(`Missing media policy: ${name}`);
      continue;
    }
    if (policy.bucket !== expectedPolicy.bucket) issues.push(`${name}: unexpected bucket`);
    if (policy.max_bytes !== expectedPolicy.bytes) issues.push(`${name}: incorrect max_bytes`);
    const duration = policy.max_duration_seconds ?? policy.max_video_duration_seconds;
    if (duration !== expectedPolicy.duration) issues.push(`${name}: incorrect maximum duration`);
    if (!Array.isArray(policy.allowed_mime_types) || policy.allowed_mime_types.length === 0) {
      issues.push(`${name}: allowed_mime_types must be non-empty`);
    }
  }

  if (contract?.access?.bucket_visibility !== 'private') {
    issues.push('Social media buckets must remain private');
  }
  if (!Number.isInteger(contract?.access?.signed_url_ttl_seconds) || contract.access.signed_url_ttl_seconds < 1 || contract.access.signed_url_ttl_seconds > 600) {
    issues.push('signed_url_ttl_seconds must be an integer between 1 and 600');
  }
  if (media.story_media?.expires_after_seconds !== 86400) {
    issues.push('story_media must expire after 86,400 seconds (24 hours)');
  }
  if (contract?.music?.provider !== 'spotify' || contract?.music?.mode !== 'server_side_catalog_search') {
    issues.push('Music integration must use the approved server-side Spotify catalog contract');
  }
  if ((contract?.music?.requested_user_scopes ?? []).length !== 0) {
    issues.push('Catalog search must not request user Spotify scopes');
  }
  return issues;
}

export function validateProductionEnvironment(environment) {
  const issues = [];
  for (const variable of requiredProductionVariables) {
    if (!environment[variable]?.trim()) issues.push(`Missing required environment variable: ${variable}`);
  }

  if (environment.SUPABASE_URL && !/^https:\/\/[^/]+\.supabase\.co\/?$/.test(environment.SUPABASE_URL)) {
    issues.push('SUPABASE_URL must be an HTTPS Supabase project URL');
  }

  const origins = (environment.APP_ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  if (origins.length === 0) issues.push('APP_ALLOWED_ORIGINS must include at least one exact HTTPS origin');
  for (const origin of origins) {
    if (origin === '*' || origin.includes('*')) issues.push('APP_ALLOWED_ORIGINS may not contain a wildcard');
    try {
      const parsed = new URL(origin);
      if (parsed.protocol !== 'https:' || parsed.pathname !== '/' || parsed.search || parsed.hash) {
        issues.push(`Invalid production origin: ${origin}`);
      }
    } catch {
      issues.push(`Invalid production origin: ${origin}`);
    }
  }
  return issues;
}

const production = process.argv.includes('--production');
const contract = JSON.parse(await readFile(contractPath, 'utf8'));
const issues = validateContract(contract);
if (production) issues.push(...validateProductionEnvironment(process.env));

if (issues.length) {
  console.error('Social media configuration is not ready:');
  for (const issue of issues) console.error(`- ${issue}`);
  process.exitCode = 1;
} else {
  console.log(`Social media contract v${contract.version} is valid${production ? ' for production' : ''}.`);
}
