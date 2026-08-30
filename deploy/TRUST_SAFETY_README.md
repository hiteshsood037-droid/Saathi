# Trust & Safety Hardening — Module Summary

Four idempotent SQL modules extend the Jodi backend safety architecture.
All files live in `deploy/` and are ready to paste into the Supabase SQL Editor
(live DB is firewalled from this environment — no direct `pg` connection).

## Deploy order (respect dependencies)
1. `trust_safety_gov_id.sql` — creates `recompute_verification_level` + `id_verifications`
2. `trust_safety_photo_moderation.sql` — `photo_moderation` (trigger calls recompute fn)
3. `trust_safety_scam_detection.sql` — message columns + trigger + RPC
4. `trust_safety_fake_profile.sql` — scoring fn + admin view

---

## 1. Government ID Verification
**File:** `trust_safety_gov_id.sql`

**New table `id_verifications`:**
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK → profiles | |
| id_type | text | 'passport' \| 'driver_license' \| 'national_id' |
| id_number_encrypted | text | ciphertext/vault-token ONLY (never plaintext) |
| document_url | text | reference to private `id-documents` bucket |
| status | text | 'pending' \| 'approved' \| 'rejected' |
| submitted_at / reviewed_at | timestamptz | |
| reviewed_by | uuid FK → profiles | admin |
| rejection_reason | text | |

**Verification level ladder:** `profiles.verification_level` ∈
`none → photo → selfie → government` (cumulative, highest wins).

**Functions:**
- `recompute_verification_level(p_user_id UUID) → TEXT`
- `review_id_verification(p_verification_id UUID, p_approved BOOLEAN, p_rejection_reason TEXT DEFAULT NULL) → VOID`

**Frontend flags:** `profiles.verification_level` for badges. `id_verifications.status`
for the user's submission state.

**Security:** documents go to a **private** `id-documents` storage bucket.
RLS: user reads own submission; admins read/review all.
Production encryption: AES-256-GCM with keys in Supabase Vault / KMS / HSM —
encrypt before writing `id_number_encrypted` (raw number never touches the DB).

## 2. Fake Profile Detection
**File:** `trust_safety_fake_profile.sql`

**Function:**
- `score_fake_profile_detection(profile_id UUID) → TABLE(risk_score INT, signals TEXT[])`

**View:**
- `admin_high_risk_profiles` — profiles with risk_score ≥ 40, ranked desc.

**Signals (deterministic heuristics):**
`new_account_high_activity` (+30), `no_photos` (+25), `suspicious_name` (+15),
`device_fingerprint_blacklisted` (+15), `empty_or_short_bio` (+10),
`no_languages` (+10), `all_caps_bio` (+10), `missing_required_fields` (+10),
`suspicious_email` (+10), `rapid_swipes` (+5). Clamped to 0–100.

**Frontend flags:** none required — this is an admin-side signal. Optionally
gate new-account capabilities on `risk_score` via an RPC.

## 3. Scam Detection in Chat
**File:** `trust_safety_scam_detection.sql`

**New message columns (frontend MUST consume):**
- `messages.scam_detected BOOLEAN` — show a warning banner when true
- `messages.scam_severity TEXT` — 'none' | 'low' | 'medium' | 'high'

**Trigger:** `filter_message_content()` was **replaced** (CREATE OR REPLACE).
Existing abuse redaction + `is_flagged` behavior is **preserved**; scam
classification is additive.

**Patterns → severity:**
| severity | patterns |
|---|---|
| high | threats/blackmail; money/UPI/bank-transfer/PayPal/crypto |
| medium | move off-platform (WhatsApp/Telegram/Instagram); phishing/OAuth/login |
| low | suspicious URLs; phone-number drops |

**RPC:**
- `flag_scam_message(p_message_id UUID) → VOID` — match participant or admin
  manually flags a message (sets is_flagged + scam_severity='high', auto-files
  a report when a participant flags).

## 4. Photo Moderation
**File:** `trust_safety_photo_moderation.sql`

**New table `photo_moderation`:**
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK → profiles | |
| photo_url | text | |
| status | text | 'pending' \| 'approved' \| 'rejected' |
| moderation_score | numeric(5,2) | 0.00 safe → 1.00 inappropriate |
| reviewed_by / rejection_reason / reviewed_at | | admin review |

**View:** `admin_photo_moderation_queue` — pending photos for human review.

**Functions:**
- `review_photo_moderation(p_moderation_id UUID, p_approved BOOLEAN, p_rejection_reason TEXT DEFAULT NULL) → VOID`

**AI/ML integration:** new edge function `edge-functions/photo-moderation/index.ts`
(mirrors selfie-moderation). Call AWS Rekognition / Google Vision / Sightengine,
then write `moderation_score` + `status`.

**Frontend flags:** `photo_moderation.status` (a photo rejected by AI can be
hidden from the profile grid).
