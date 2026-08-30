-- ============================================================
-- Jodi App — Trust & Safety: Fake Profile Detection
-- Module 2 of 4 (idempotent — safe to re-run)
-- Created: 2026-08-29 · Backend Engineer: supa_dev (Saathi Team)
--
-- Heuristic, deterministic SQL scoring (no external ML required).
-- `score_fake_profile_detection(profile_id)` returns:
--   risk_score INT   — 0 (legit) → 100 (definitely fake)
--   signals    TEXT[]— human-readable list of triggered heuristics
--
-- Deploy: paste this entire file into Supabase SQL Editor.
-- ============================================================

-- 2.1 Scoring function
CREATE OR REPLACE FUNCTION score_fake_profile_detection(profile_id UUID)
RETURNS TABLE (risk_score INT, signals TEXT[])
LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $$
DECLARE
  p profiles%ROWTYPE;
  v_score INT := 0;
  v_signals TEXT[] := '{}';
  v_age_days NUMERIC;
  v_recent_swipes BIGINT;
  v_recent_messages BIGINT;
  v_banned_fp_match BOOLEAN := false;
  v_email TEXT;
BEGIN
  SELECT * INTO p FROM profiles WHERE id = profile_id;

  IF p.id IS NULL THEN
    RETURN QUERY SELECT 0, ARRAY['profile_not_found']::TEXT[];
    RETURN;
  END IF;

  -- Signal A: brand-new account with high activity (classic bot/fake)
  v_age_days := EXTRACT(EPOCH FROM (timezone('utc'::text, now()) - p.created_at)) / 86400.0;
  SELECT COUNT(*) INTO v_recent_swipes FROM swipes
    WHERE swiper_id = profile_id AND created_at > now() - INTERVAL '1 day';
  SELECT COUNT(*) INTO v_recent_messages FROM messages
    WHERE sender_id = profile_id AND created_at > now() - INTERVAL '1 day';

  IF v_age_days < 1 AND (v_recent_swipes + v_recent_messages) > 3 THEN
    v_score := v_score + 30;
    v_signals := array_append(v_signals, 'new_account_high_activity');
  END IF;

  -- Signal B: zero photos
  IF COALESCE(cardinality(p.photos), 0) = 0 THEN
    v_score := v_score + 25;
    v_signals := array_append(v_signals, 'no_photos');
  END IF;

  -- Signal C: empty or very short bio
  IF p.bio IS NULL OR length(trim(p.bio)) < 10 THEN
    v_score := v_score + 10;
    v_signals := array_append(v_signals, 'empty_or_short_bio');
  END IF;

  -- Signal D: no languages spoken
  IF COALESCE(cardinality(p.languages_spoken), 0) = 0 THEN
    v_score := v_score + 10;
    v_signals := array_append(v_signals, 'no_languages');
  END IF;

  -- Signal E: suspicious name pattern (digits, repeated chars, too short)
  IF p.full_name ~ '[0-9]'
     OR p.full_name ~ '(.)\1{2,}'
     OR length(trim(p.full_name)) < 2 THEN
    v_score := v_score + 15;
    v_signals := array_append(v_signals, 'suspicious_name');
  END IF;

  -- Signal F: all-caps bio (shouting / spammy)
  IF p.bio IS NOT NULL
     AND length(trim(p.bio)) > 5
     AND p.bio = upper(p.bio) THEN
    v_score := v_score + 10;
    v_signals := array_append(v_signals, 'all_caps_bio');
  END IF;

  -- Signal G: rapid swipe volume (automation-like)
  IF v_recent_swipes > 50 THEN
    v_score := v_score + 5;
    v_signals := array_append(v_signals, 'rapid_swipes');
  END IF;

  -- Signal H: missing required immigration / activity fields
  IF p.immigration_status IS NULL OR p.immigration_status = ''
     OR p.activity_level IS NULL OR p.activity_level = '' THEN
    v_score := v_score + 10;
    v_signals := array_append(v_signals, 'missing_required_fields');
  END IF;

  -- Signal I: device fingerprint previously seen on a banned account
  IF p.device_fingerprint IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM ip_device_blacklist b
      WHERE b.device_fingerprint = p.device_fingerprint
    ) INTO v_banned_fp_match;

    IF v_banned_fp_match THEN
      v_score := v_score + 15;
      v_signals := array_append(v_signals, 'device_fingerprint_blacklisted');
    END IF;
  END IF;

  -- Signal J: suspicious email pattern (best-effort; auth.users may be
  -- restricted in some environments, so we tolerate access failures)
  BEGIN
    SELECT email INTO v_email FROM auth.users WHERE id = profile_id;
    IF v_email IS NOT NULL
       AND (v_email ~ '[0-9]{4,}' OR v_email ~ '\.(xyz|top|tk|ml|ga)$') THEN
      v_score := v_score + 10;
      v_signals := array_append(v_signals, 'suspicious_email');
    END IF;
  EXCEPTION WHEN insufficient_privilege OR undefined_table THEN
    NULL; -- auth.users not readable here; skip email heuristic
  END;

  -- Clamp to 0–100
  v_score := GREATEST(0, LEAST(v_score, 100));

  RETURN QUERY SELECT v_score, v_signals;
END;
$$;

-- 2.2 Admin view: rank all profiles by fake-risk score
CREATE OR REPLACE VIEW admin_high_risk_profiles AS
SELECT
  p.id AS user_id,
  p.full_name,
  p.gender,
  p.location_name,
  p.created_at,
  p.is_banned,
  p.verification_status,
  s.risk_score,
  s.signals
FROM profiles p
CROSS JOIN LATERAL score_fake_profile_detection(p.id) AS s(risk_score, signals)
WHERE s.risk_score >= 40
ORDER BY s.risk_score DESC;

-- 2.3 (Optional) Scheduled recompute note.
-- The function is deterministic & cheap; the view computes live on read.
-- For scale, snapshot results nightly with pg_cron:
--
--   CREATE TABLE IF NOT EXISTS fake_profile_snapshots (
--     user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
--     risk_score INT NOT NULL,
--     signals TEXT[] NOT NULL,
--     computed_at TIMESTAMPTZ DEFAULT now() NOT NULL
--   );
--
--   SELECT cron.schedule(
--     'nightly-fake-profile-scan',
--     '0 3 * * *',
--     $$ INSERT INTO fake_profile_snapshots (user_id, risk_score, signals)
--        SELECT p.id, s.risk_score, s.signals
--        FROM profiles p
--        CROSS JOIN LATERAL score_fake_profile_detection(p.id) s
--        ON CONFLICT (user_id) DO UPDATE SET
--          risk_score = EXCLUDED.risk_score,
--          signals = EXCLUDED.signals,
--          computed_at = now(); $$
--   );
