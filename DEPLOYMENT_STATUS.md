# Jodi App - Backend Deployment Guide
# Created: 2026-08-29 · Updated: 2026-08-29 (trust & safety hardening)
# Backend Engineer: supa_dev (Saathi Team)

## Supabase Project
- **URL:** https://gkzmhonyrbvwjgwolqum.supabase.co
- **Project Ref:** gkzmhonyrbvwjgwolqum
- **Region:** ap-southeast-1 (Singapore)
- **Anon Key:** In `/home/team/shared/frontend/.env` (EXPO_PUBLIC_SUPABASE_ANON_KEY)
- **Webapp Key:** In `/home/team/shared/webapp/src/supabase.js`

## Deployed State

### Schema (✅ Deployed)
All 8 core tables deployed with full RLS policies:
- `profiles` — User profiles with cultural attributes (religion, languages, caste, etc.)
- `swipes` — Like/dislike/super_like tracking (column: `type`, ENUM: swipe_type_enum)
- `matches` — Mutual likes + compatibility scores + streak tracking
- `messages` — Chat messages with content moderation
- `daily_picks` — AI-generated daily recommendations (column: `score`)
- `boost_events` — Profile visibility boosts
- `reports` — User/moderation reports
- `blocks` — User blocks for safety

### Triggers (✅ Deployed + Verified)
- `trigger_swipe_match` — Creates match on mutual 'like' swipes ✅ VERIFIED
- `trigger_filter_message` — AI content moderation on messages
- `trigger_update_match_streak` — Updates streak count on daily messaging
- `trigger_generate_referral_code` — Auto-generates referral codes for new profiles

### Core Functions (✅ Deployed + Verified)
- `calculate_compatibility_score(u1_id, u2_id)` → 0-100 score ✅ VERIFIED (score: 57 Aarav↔Priya)
- `calculate_distance(lat1, lon1, lat2, lon2)` → km distance (Haversine)
- `generate_daily_picks(limit_val, target_user_id)` → Populates daily_picks ✅ VERIFIED (7 active picks)
- `approve_selfie_verification(profile_id, approved)` → Verification approval
- `handle_stripe_subscription_update(user_id, tier, expiry)` → Subscription management
- `increment_and_check_swipe_limit(user_id)` → Free tier swipe limits

### Seed Data (✅ 20 profiles)
20 diverse profiles across 10 cities, 5 religions, 10 languages:
- **Cities:** Mumbai, Delhi, Bangalore, Chennai, Kolkata, Jaipur, Hyderabad, Pune, London, New York, San Francisco, Dubai, Melbourne, Leicester, Brampton, Mississauga
- **Religions:** Hindu (13), Sikh (3), Muslim (2), Jain (2)
- **Languages:** Hindi, English, Punjabi, Tamil, Telugu, Gujarati, Bengali, Marathi, Urdu, Arabic, Malayalam, Kannada
- **Ages:** 21-38, mixed genders (10 male, 10 female)
- **Occupations:** SWE, Doctor, Architect, Banker, Professor, Data Scientist, UX Designer, CA, Pharmacist, Barrister, Chef, HR, Product Manager

### Live State (2026-08-29 18:50 UTC)
| Table | Count | HTTP |
|-------|-------|------|
| profiles | 20 | 200 |
| swipes | 2 | 200 |
| matches | 1 | 200 |
| messages | 0 | 200 |
| daily_picks | 7 | 200 |
| boost_events | 0 | 200 |
| reports | 0 | 200 |
| blocks | 0 | 200 |

### RLS Verification (anon key testing)
- ✅ RPCs callable with anon key (calculate_compatibility_score, generate_daily_picks)
- ✅ Reads work with anon key (profiles, matches, daily_picks queries)
- ✅ Writes properly blocked (401 on unauthenticated swipes/messages — correct RLS)

### Edge Functions (4 stubs created)
Located in `/home/team/shared/backend/edge-functions/`:
- `stripe-webhook/` — Stripe event handler
- `stripe-checkout/` — Checkout session creator
- `ai-icebreakers/` — AI-generated conversation starters
- `selfie-moderation/` — Photo verification handler

## Pending: Convenience RPCs

### Option A: Deploy SQL functions to Supabase
1. Open: https://supabase.com/dashboard/project/gkzmhonyrbvwjgwolqum/sql/new
2. Paste contents of: `/home/team/shared/backend/deploy/convenience_rpcs.sql`
3. Run SQL
4. Verify by calling POST `/rest/v1/rpc/get_discover_profiles`
5. Verify by calling POST `/rest/v1/rpc/get_matches_for_user`

After deployment, the frontend can call:
```ts
const { data } = await supabase.rpc('get_discover_profiles', { p_user_id: userId });
const { data } = await supabase.rpc('get_matches_for_user', { p_user_id: userId });
```

### Option B: Use client-side JS implementation
The file `/home/team/shared/backend/deploy/convenience-rpcs.js` implements the 
same discover/match logic using supabase-js REST queries. No SQL deployment needed.
```ts
import { getDiscoverProfiles, getMatchesForUser } from './convenience-rpcs';
```

### Option C: Frontend queries profiles/matches directly
The RLS policies allow authenticated users to query their own data:
```ts
// Discover
const { data } = await supabase.from('profiles').select('*').eq('is_banned',false)...;
// Matches
const { data } = await supabase.from('matches').select('*').or(`user1_id.eq.${uid},user2_id.eq.${uid}`);
```

## Schema Conventions (important for frontend)
- **Swipes** use `type` column (NOT `direction`): values 'like', 'dislike', 'super_like'
- **Daily picks** use `score` column (NOT `compatibility_score`)
- **Matches** use `compatibility_score` column
- **Calculated field**: `calculate_distance()` for lat/lon — separate from `compatibility_score`

## Verified End-to-End (2026-08-29)
✅ 9 profiles visible via REST API
✅ Compatibility scoring: 57 between Aarav Sharma and Priya Patel
✅ Daily pick generation: 4 picks created, scores 57-72
✅ Mutual swipe → match creation (trigger-based)
✅ Match data includes streak_count, compatibility_score, last_message_at
✅ All 8 table endpoints return 200

---

# Trust & Safety Hardening (2026-08-29)

Four new modules delivered as idempotent SQL files in `deploy/`.
**Status: SQL ready to paste into Supabase SQL Editor** (live DB is
firewalled from this env per prior work — no direct `pg` connection).

Deploy order (dependencies):
1. `trust_safety_gov_id.sql`
2. `trust_safety_photo_moderation.sql` (depends on `recompute_verification_level` from gov_id)
3. `trust_safety_scam_detection.sql`
4. `trust_safety_fake_profile.sql`

## Module 1 — Government ID Verification
File: `deploy/trust_safety_gov_id.sql`

| Object | Type | Signature |
|--------|------|-----------|
| `id_verifications` | table | id, user_id, id_type ('passport'/'driver_license'/'national_id'), id_number_encrypted, document_url, status ('pending'/'approved'/'rejected'), submitted_at, reviewed_at, reviewed_by, rejection_reason |
| `profiles.verification_level` | column | 'none' → 'photo' → 'selfie' → 'government' |
| `recompute_verification_level(p_user_id UUID)` | fn → TEXT | highest achieved level |
| `review_id_verification(p_verification_id UUID, p_approved BOOLEAN, p_rejection_reason TEXT)` | RPC → VOID | admin review |

**Security note:** `id_number_encrypted` is a placeholder that MUST hold
ciphertext/vault-token (AES-256-GCM via KMS/HSM), never plaintext. Documents
go to a **private** `id-documents` storage bucket. RLS: user reads own, admins read all.

## Module 2 — Fake Profile Detection
File: `deploy/trust_safety_fake_profile.sql`

| Object | Type | Signature |
|--------|------|-----------|
| `score_fake_profile_detection(profile_id UUID)` | fn → TABLE(risk_score INT, signals TEXT[]) | 0–100 heuristic score + signal list |
| `admin_high_risk_profiles` | view | ranks profiles with score ≥ 40 |

Signals: new_account_high_activity, no_photos, empty_or_short_bio, no_languages,
suspicious_name, all_caps_bio, rapid_swipes, missing_required_fields,
device_fingerprint_blacklisted, suspicious_email.

## Module 3 — Scam Detection in Chat
File: `deploy/trust_safety_scam_detection.sql`

| Object | Type | Signature |
|--------|------|-----------|
| `messages.scam_detected` | column | BOOLEAN |
| `messages.scam_severity` | column | 'none'/'low'/'medium'/'high' |
| `filter_message_content()` | trigger fn (REPLACED) | abuse redaction (unchanged) + scam classification |
| `flag_scam_message(p_message_id UUID)` | RPC → VOID | participant/admin manual flag |

**Frontend flags to consume:** `messages.scam_detected` + `messages.scam_severity`
for warning banners. Existing `is_flagged` still set for abuse redaction.
Patterns detected: threats/blackmail, money/UPI/bank-transfer, move-off-platform
(WhatsApp/Telegram), phishing/OAuth, suspicious URLs, phone-number drops.

## Module 4 — Photo Moderation
File: `deploy/trust_safety_photo_moderation.sql`

| Object | Type | Signature |
|--------|------|-----------|
| `photo_moderation` | table | id, user_id, photo_url, status ('pending'/'approved'/'rejected'), moderation_score (0–1), reviewed_by, rejection_reason, created_at, reviewed_at |
| `admin_photo_moderation_queue` | view | pending photos for human review |
| `review_photo_moderation(p_moderation_id UUID, p_approved BOOLEAN, p_rejection_reason TEXT)` | RPC → VOID | admin review |

AI/ML integration point: new `photo-moderation` edge function stub
(`edge-functions/photo-moderation/index.ts`) mirrors the selfie-moderation
pattern — call AWS Rekognition / Google Vision / Sightengine, write
`moderation_score` + `status`.