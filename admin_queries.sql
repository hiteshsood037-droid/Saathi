-- ==========================================
-- Jodi App Admin Dashboard Queries, Views, and RPCs
-- Created on: 2026-06-21
-- Author: Backend Engineer (Saathi Team)
-- Description: Advanced PostgreSQL analytical views and secure stored procedures
--              supporting the live Operations Admin Dashboard.
-- ==========================================

-- Clean up existing objects (if they exist to avoid conflicts on redeploy)
DROP TRIGGER IF EXISTS trigger_detect_ban_evasion ON profiles CASCADE;
DROP FUNCTION IF EXISTS detect_ban_evasion() CASCADE;
DROP FUNCTION IF EXISTS ban_user(UUID, TEXT) CASCADE;
DROP FUNCTION IF EXISTS unban_user(UUID) CASCADE;
DROP FUNCTION IF EXISTS get_revenue_by_date_range(DATE, DATE) CASCADE;
DROP VIEW IF EXISTS admin_analytics_summary CASCADE;
DROP VIEW IF EXISTS admin_subscription_revenue CASCADE;
DROP VIEW IF EXISTS admin_verification_queue CASCADE;
DROP VIEW IF EXISTS admin_reported_users CASCADE;
DROP VIEW IF EXISTS admin_user_management_list CASCADE;
DROP TABLE IF EXISTS ip_device_blacklist CASCADE;

-- ==========================================
-- 1. Table: ip_device_blacklist (Ban Evasion Protection)
-- ==========================================

CREATE TABLE ip_device_blacklist (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ip_address TEXT,
  device_fingerprint TEXT,
  banned_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Indexes for lightning-fast lookups during sign-ups/login
CREATE INDEX idx_blacklist_ip ON ip_device_blacklist(ip_address);
CREATE INDEX idx_blacklist_fingerprint ON ip_device_blacklist(device_fingerprint);

-- ==========================================
-- 2. Trigger Function: detect_ban_evasion
-- ==========================================

CREATE OR REPLACE FUNCTION detect_ban_evasion()
RETURNS TRIGGER AS $$
BEGIN
  -- Search for matching blacklisted attributes
  IF EXISTS (
    SELECT 1 FROM ip_device_blacklist
    WHERE (ip_address IS NOT NULL AND ip_address = NEW.ip_address)
       OR (device_fingerprint IS NOT NULL AND device_fingerprint = NEW.device_fingerprint)
  ) THEN
    -- Automatically set account state to banned to mitigate evasion
    NEW.is_banned := true;
    NEW.verification_status := 'rejected';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Bind evasion protection to profiles table
CREATE TRIGGER trigger_detect_ban_evasion
BEFORE INSERT OR UPDATE ON profiles
FOR EACH ROW
EXECUTE FUNCTION detect_ban_evasion();

-- ==========================================
-- 3. View: admin_analytics_summary
-- ==========================================

CREATE OR REPLACE VIEW admin_analytics_summary AS
WITH active_users AS (
  -- Aggregate distinct users active in the past 24 hours (DAU)
  SELECT COUNT(DISTINCT user_id) AS dau FROM (
    SELECT id AS user_id FROM profiles WHERE updated_at >= now() - INTERVAL '24 hours'
    UNION
    SELECT swiper_id AS user_id FROM swipes WHERE created_at >= now() - INTERVAL '24 hours'
    UNION
    SELECT sender_id AS user_id FROM messages WHERE created_at >= now() - INTERVAL '24 hours'
  ) au
),
subs_rev AS (
  -- Aggregate active subscriptions and calculate Estimated Monthly Recurring Revenue (MRR)
  SELECT
    COALESCE(SUM(CASE WHEN subscription_tier = 'Premium' THEN 14.99 WHEN subscription_tier = 'Gold' THEN 29.99 ELSE 0 END), 0) AS mrr,
    COUNT(CASE WHEN subscription_tier = 'Premium' THEN 1 END) AS premium_count,
    COUNT(CASE WHEN subscription_tier = 'Gold' THEN 1 END) AS gold_count
  FROM profiles
  WHERE subscription_tier IN ('Premium', 'Gold')
    AND (subscription_ends_at IS NULL OR subscription_ends_at > now())
    AND is_banned = false
)
SELECT
  (SELECT COUNT(*) FROM profiles) AS total_users,
  (SELECT dau FROM active_users) AS dau_24h,
  (SELECT COUNT(*) FROM profiles WHERE is_verified = true AND is_banned = false) AS verified_users,
  (SELECT COUNT(*) FROM profiles WHERE is_banned = true) AS banned_users,
  (SELECT COUNT(*) FROM profiles WHERE verification_status = 'pending' AND is_banned = false) AS pending_verifications,
  (SELECT COUNT(*) FROM reports) AS total_reports,
  (SELECT COUNT(*) FROM reports WHERE status = 'pending') AS pending_reports,
  (SELECT premium_count FROM subs_rev) AS active_premium_subscribers,
  (SELECT gold_count FROM subs_rev) AS active_gold_subscribers,
  (SELECT mrr FROM subs_rev) AS estimated_mrr;

-- ==========================================
-- 4. View: admin_subscription_revenue
-- ==========================================

CREATE OR REPLACE VIEW admin_subscription_revenue AS
SELECT
  subscription_tier,
  COUNT(*) AS active_subscribers,
  SUM(
    CASE
      WHEN subscription_tier = 'Premium' THEN 14.99
      WHEN subscription_tier = 'Gold' THEN 29.99
      ELSE 0.00
    END
  ) AS estimated_monthly_revenue
FROM profiles
WHERE subscription_tier IN ('Premium', 'Gold')
  AND (subscription_ends_at IS NULL OR subscription_ends_at > now())
  AND is_banned = false
GROUP BY subscription_tier;

-- ==========================================
-- 5. View: admin_verification_queue
-- ==========================================

CREATE OR REPLACE VIEW admin_verification_queue AS
SELECT
  id AS user_id,
  full_name,
  gender,
  birth_date,
  selfie_url,
  photos,
  created_at
FROM profiles
WHERE verification_status = 'pending' 
  AND is_banned = false;

-- ==========================================
-- 6. View: admin_reported_users (Moderation Pipeline)
-- ==========================================

CREATE OR REPLACE VIEW admin_reported_users AS
SELECT
  r.id AS report_id,
  r.reporter_id,
  p_rep.full_name AS reporter_name,
  r.reported_id,
  p_bad.full_name AS reported_name,
  p_bad.is_banned AS reported_is_banned,
  p_bad.ip_address AS reported_ip_address,
  p_bad.device_fingerprint AS reported_device_fingerprint,
  r.reason,
  r.status AS report_status,
  r.created_at
FROM reports r
JOIN profiles p_rep ON r.reporter_id = p_rep.id
JOIN profiles p_bad ON r.reported_id = p_bad.id;

-- ==========================================
-- 7. View: admin_user_management_list
-- ==========================================

CREATE OR REPLACE VIEW admin_user_management_list AS
SELECT
  p.id AS user_id,
  p.full_name,
  p.gender,
  p.birth_date,
  p.location_name,
  p.subscription_tier,
  p.is_verified,
  p.verification_status,
  p.is_banned,
  p.created_at,
  (SELECT COUNT(*) FROM reports WHERE reported_id = p.id) AS report_count
FROM profiles p;

-- ==========================================
-- 8. RPC: ban_user (Secure Account Lockout & Evasion Flagging)
-- ==========================================

CREATE OR REPLACE FUNCTION ban_user(
  target_user_id UUID,
  p_reason TEXT
)
RETURNS VOID AS $$
DECLARE
  v_ip TEXT;
  v_fingerprint TEXT;
BEGIN
  -- Authenticated user validation
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND is_admin = true
  ) THEN
    RAISE EXCEPTION 'Access denied. Only platform administrators can ban users.';
  END IF;

  -- Pull user attributes for blacklist propagation
  SELECT ip_address, device_fingerprint
  INTO v_ip, v_fingerprint
  FROM profiles
  WHERE id = target_user_id;

  -- Update target user account parameters
  UPDATE profiles
  SET is_banned = true,
      subscription_tier = 'Free',
      subscription_ends_at = null,
      verification_status = 'rejected',
      is_verified = false,
      updated_at = timezone('utc'::text, now())
  WHERE id = target_user_id;

  -- Add to persistent IP/Device Blacklist for ban evasion protection
  IF v_ip IS NOT NULL OR v_fingerprint IS NOT NULL THEN
    INSERT INTO ip_device_blacklist (ip_address, device_fingerprint, banned_user_id, reason)
    VALUES (v_ip, v_fingerprint, target_user_id, p_reason)
    ON CONFLICT DO NOTHING;
  END IF;

  -- Automatically resolve outstanding report tickets targeting this user
  UPDATE reports
  SET status = 'resolved'
  WHERE reported_id = target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- 9. RPC: unban_user
-- ==========================================

CREATE OR REPLACE FUNCTION unban_user(
  target_user_id UUID
)
RETURNS VOID AS $$
BEGIN
  -- Authenticated user validation
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND is_admin = true
  ) THEN
    RAISE EXCEPTION 'Access denied. Only platform administrators can unban users.';
  END IF;

  -- Restore profile status
  UPDATE profiles
  SET is_banned = false,
      updated_at = timezone('utc'::text, now())
  WHERE id = target_user_id;

  -- Clean up blacklisted IP/Fingerprint to enable re-registration
  DELETE FROM ip_device_blacklist
  WHERE banned_user_id = target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- 10. RPC: get_revenue_by_date_range (Analytical Reporting)
-- ==========================================

CREATE OR REPLACE FUNCTION get_revenue_by_date_range(
  p_start_date DATE,
  p_end_date DATE
)
RETURNS TABLE (
  revenue_date DATE,
  premium_tier_count BIGINT,
  gold_tier_count BIGINT,
  daily_estimated_revenue NUMERIC
) AS $$
BEGIN
  -- Validate calling user is an administrator
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND is_admin = true
  ) THEN
    RAISE EXCEPTION 'Access denied. Only platform administrators can query historical metrics.';
  END IF;

  RETURN QUERY
  WITH date_series AS (
    SELECT generate_series(p_start_date::timestamp, p_end_date::timestamp, '1 day'::interval)::date AS d_date
  )
  SELECT
    ds.d_date AS revenue_date,
    COUNT(CASE WHEN p.subscription_tier = 'Premium' THEN 1 END) AS premium_tier_count,
    COUNT(CASE WHEN p.subscription_tier = 'Gold' THEN 1 END) AS gold_tier_count,
    ROUND(
      (
        COUNT(CASE WHEN p.subscription_tier = 'Premium' THEN 1 END) * (14.99 / 30.0) +
        COUNT(CASE WHEN p.subscription_tier = 'Gold' THEN 1 END) * (29.99 / 30.0)
      )::numeric, 
      2
    ) AS daily_estimated_revenue
  FROM date_series ds
  LEFT JOIN profiles p ON 
    p.created_at::date <= ds.d_date 
    AND (p.subscription_ends_at IS NULL OR p.subscription_ends_at::date >= ds.d_date)
    AND p.subscription_tier IN ('Premium', 'Gold')
    AND p.is_banned = false
  GROUP BY ds.d_date
  ORDER BY ds.d_date ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
