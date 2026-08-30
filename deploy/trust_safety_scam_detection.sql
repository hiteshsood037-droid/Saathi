-- ============================================================
-- Jodi App — Trust & Safety: Scam Detection in Chat
-- Module 3 of 4 (idempotent — safe to re-run)
-- Created: 2026-08-29 · Backend Engineer: supa_dev (Saathi Team)
--
-- Extends the existing message moderation (abuse keyword redaction) with
-- scam pattern classification. Preserves existing behavior:
--   * Abuse keywords still get redacted (***) and set is_flagged.
--   * NEW: messages also get scam_detected + scam_severity flags so the
--     frontend can surface a warning banner.
--
-- Deploy: paste this entire file into Supabase SQL Editor.
-- ============================================================

-- 3.1 Add scam columns to messages (keep existing columns intact)
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS scam_detected BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS scam_severity TEXT NOT NULL DEFAULT 'none'
  CHECK (scam_severity IN ('none', 'low', 'medium', 'high'));

-- Index for admin scam review
CREATE INDEX IF NOT EXISTS idx_messages_scam ON messages(scam_detected, scam_severity);

-- 3.2 Enhanced message filter (replaces existing filter_message_content).
-- NOTE: the existing trigger `trigger_filter_message` continues to call this
-- function automatically (CREATE OR REPLACE keeps the same OID).
CREATE OR REPLACE FUNCTION filter_message_content()
RETURNS TRIGGER AS $$
DECLARE
  -- Existing abuse blacklist (unchanged behavior)
  abuse_blacklist TEXT[] := ARRAY[
    'abuse', 'scam', 'fraud', 'cheat', 'asshole', 'bitch', 'bastard', 'idiot', 'spam', 'fake',
    'offensive_keyword1', 'offensive_keyword2'
  ];
  -- Scam pattern lists (lowercase; severity: 3=high, 2=medium, 1=low)
  threat_patterns   TEXT[] := ARRAY['blackmail', 'i will ruin', 'expose you', 'leak your', 'i know where you live', 'ransom', 'pay me or else'];
  money_patterns    TEXT[] := ARRAY['upi', 'bank transfer', 'western union', 'moneygram', 'send money', 'transfer money', 'google pay', 'paytm', 'phonepe', 'cashapp', 'venmo', 'zelle', 'paypal', 'bitcoin', 'crypto'];
  off_platform      TEXT[] := ARRAY['whatsapp', 'telegram', 'instagram', 'snapchat', 'kik', 'wechat', 'hangouts', 'signal app', 'line app'];
  phishing_patterns TEXT[] := ARRAY['verify your account', 'verification code', 'login to', 'confirm your password', 'account suspended', 'click here', 'oauth', 'reset password'];

  word TEXT;
  lower_content TEXT;
  cleaned_content TEXT;
  found_flag BOOLEAN := FALSE;
  pat TEXT;
  v_sev_level INT := 0;  -- 0 none, 1 low, 2 medium, 3 high
BEGIN
  -- ---- Phase 1: existing abuse keyword redaction ----
  cleaned_content := NEW.content;
  lower_content := lower(NEW.content);

  FOREACH word IN ARRAY abuse_blacklist LOOP
    IF position(word in lower_content) > 0 THEN
      cleaned_content := regexp_replace(cleaned_content, word, repeat('*', length(word)), 'gi');
      found_flag := TRUE;
    END IF;
  END LOOP;

  NEW.content := cleaned_content;
  IF found_flag THEN
    NEW.is_flagged := TRUE;
  END IF;

  -- ---- Phase 2: scam pattern detection (additive, does NOT redact) ----
  -- HIGH severity (3): threats / blackmail
  FOREACH pat IN ARRAY threat_patterns LOOP
    IF position(pat in lower_content) > 0 THEN
      v_sev_level := GREATEST(v_sev_level, 3);
    END IF;
  END LOOP;

  -- HIGH severity (3): money / UPI / bank transfer requests
  FOREACH pat IN ARRAY money_patterns LOOP
    IF position(pat in lower_content) > 0 THEN
      v_sev_level := GREATEST(v_sev_level, 3);
    END IF;
  END LOOP;

  -- MEDIUM severity (2): move off-platform
  FOREACH pat IN ARRAY off_platform LOOP
    IF position(pat in lower_content) > 0 THEN
      v_sev_level := GREATEST(v_sev_level, 2);
    END IF;
  END LOOP;

  -- MEDIUM severity (2): OAuth / login / phishing
  FOREACH pat IN ARRAY phishing_patterns LOOP
    IF position(pat in lower_content) > 0 THEN
      v_sev_level := GREATEST(v_sev_level, 2);
    END IF;
  END LOOP;

  -- LOW severity (1): suspicious external URLs / phone-number drops
  IF lower_content ~ '(https?://|www\.)[^\s]+' OR lower_content ~ '(\+?\d[\d\s\-]{7,}\d)' THEN
    v_sev_level := GREATEST(v_sev_level, 1);
  END IF;

  -- Map numeric level to severity text
  IF v_sev_level > 0 THEN
    NEW.scam_detected := true;
    NEW.scam_severity := CASE
      WHEN v_sev_level >= 3 THEN 'high'
      WHEN v_sev_level = 2 THEN 'medium'
      ELSE 'low'
    END;
  ELSE
    NEW.scam_detected := false;
    NEW.scam_severity := 'none';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure the trigger exists (drop + recreate for idempotency)
DROP TRIGGER IF EXISTS trigger_filter_message ON messages;
CREATE TRIGGER trigger_filter_message
BEFORE INSERT ON messages
FOR EACH ROW
EXECUTE FUNCTION filter_message_content();

-- 3.3 RPC: manually flag a message as scam (match participant or admin)
CREATE OR REPLACE FUNCTION flag_scam_message(p_message_id UUID)
RETURNS VOID AS $$
DECLARE
  v_match_id UUID;
  v_sender_id UUID;
  v_is_participant BOOLEAN;
  v_is_admin BOOLEAN;
BEGIN
  SELECT match_id, sender_id INTO v_match_id, v_sender_id
  FROM messages WHERE id = p_message_id;

  IF v_match_id IS NULL THEN
    RAISE EXCEPTION 'Message not found';
  END IF;

  v_is_admin := EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true
  );
  v_is_participant := EXISTS (
    SELECT 1 FROM matches m
    WHERE m.id = v_match_id AND (m.user1_id = auth.uid() OR m.user2_id = auth.uid())
  );

  IF NOT (v_is_admin OR v_is_participant) THEN
    RAISE EXCEPTION 'Unauthorized: only match participants or admins can flag a message';
  END IF;

  UPDATE messages
  SET is_flagged = true,
      scam_detected = true,
      scam_severity = 'high'
  WHERE id = p_message_id;

  -- Auto-create a safety report so the flagged content reaches the admin
  -- moderation queue (skip if a user somehow flags their own message).
  IF v_is_participant AND NOT v_is_admin AND v_sender_id IS DISTINCT FROM auth.uid() THEN
    INSERT INTO reports (reporter_id, reported_id, reason, status)
    VALUES (auth.uid(), v_sender_id, 'Scam message flagged by recipient', 'pending')
    ON CONFLICT DO NOTHING;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
