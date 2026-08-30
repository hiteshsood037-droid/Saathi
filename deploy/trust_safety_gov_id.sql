-- ============================================================
-- Jodi App — Trust & Safety: Government ID Verification
-- Module 1 of 4 (idempotent — safe to re-run)
-- Created: 2026-08-29 · Backend Engineer: supa_dev (Saathi Team)
--
-- Provides a FUTURE-READY government ID verification architecture.
-- Design principles:
--   * NEVER store the raw ID number in a queryable column. The
--     `id_number_encrypted` column is a placeholder that must hold a
--     ciphertext reference (e.g. AES-256-GCM output or a vault token),
--     NOT the plaintext number.
--   * Only a reference to the uploaded document (private storage bucket
--     object path) is stored in `document_url`.
--   * Production integration point: encrypt with a key held in Supabase
--     Vault / an HSM (e.g. AWS KMS, GCP KMS) before writing
--     `id_number_encrypted`. The raw value should only exist transiently
--     inside the encryption edge function, never in the database.
--
-- Deploy: paste this entire file into Supabase SQL Editor:
--   https://supabase.com/dashboard/project/gkzmhonyrbvwjgwolqum/sql/new
-- ============================================================

-- 1.1 Private storage bucket for ID documents (never public)
INSERT INTO storage.buckets (id, name, public)
VALUES ('id-documents', 'id-documents', false)
ON CONFLICT (id) DO NOTHING;

-- 1.2 Government ID verification table
CREATE TABLE IF NOT EXISTS id_verifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  -- Type of government-issued document
  id_type TEXT NOT NULL CHECK (id_type IN ('passport', 'driver_license', 'national_id')),
  -- ENCRYPTION PLACEHOLDER: store ciphertext / vault reference only.
  -- DO NOT store the plaintext ID number here. See header note re: HSM/KMS.
  id_number_encrypted TEXT,
  -- Reference to the uploaded document in the private 'id-documents' bucket
  document_url TEXT NOT NULL,
  -- Review lifecycle
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  submitted_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  rejection_reason TEXT
);

-- 1.3 Indexes
CREATE INDEX IF NOT EXISTS idx_id_verifications_user_id ON id_verifications(user_id);
CREATE INDEX IF NOT EXISTS idx_id_verifications_status ON id_verifications(status);
CREATE INDEX IF NOT EXISTS idx_id_verifications_submitted ON id_verifications(submitted_at);

-- 1.4 Verification level concept on profiles
-- Order: none → photo → selfie → government  (each is cumulative)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS verification_level TEXT
  NOT NULL DEFAULT 'none'
  CHECK (verification_level IN ('none', 'photo', 'selfie', 'government'));

-- 1.5 RLS: enable + policies
ALTER TABLE id_verifications ENABLE ROW LEVEL SECURITY;

-- Users can read their own ID submissions
CREATE POLICY "Users read own id verifications"
  ON id_verifications FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Users can submit their own ID for review (document already in private bucket)
CREATE POLICY "Users submit own id verification"
  ON id_verifications FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Admins read + review all ID verifications
CREATE POLICY "Admins manage id verifications"
  ON id_verifications FOR ALL TO authenticated
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

-- 1.6 Recompute a user's verification_level (highest achieved wins)
CREATE OR REPLACE FUNCTION recompute_verification_level(p_user_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_level TEXT := 'none';
BEGIN
  -- government: an approved government ID is the strongest signal
  IF EXISTS (SELECT 1 FROM id_verifications WHERE user_id = p_user_id AND status = 'approved') THEN
    v_level := 'government';
  -- selfie: profile selfie verification approved
  ELSIF EXISTS (SELECT 1 FROM profiles WHERE id = p_user_id AND verification_status = 'approved') THEN
    v_level := 'selfie';
  -- photo: at least one approved photo via photo moderation
  ELSIF EXISTS (SELECT 1 FROM photo_moderation WHERE user_id = p_user_id AND status = 'approved') THEN
    v_level := 'photo';
  END IF;

  UPDATE profiles
  SET verification_level = v_level,
      updated_at = timezone('utc'::text, now())
  WHERE id = p_user_id;

  RETURN v_level;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 1.7 Trigger: recompute verification_level whenever an ID submission changes
CREATE OR REPLACE FUNCTION trigger_id_verification_recompute()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM recompute_verification_level(NEW.user_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_id_verification_recompute ON id_verifications;
CREATE TRIGGER trigger_id_verification_recompute
AFTER INSERT OR UPDATE OF status ON id_verifications
FOR EACH ROW
EXECUTE FUNCTION trigger_id_verification_recompute();

-- 1.8 RPC: admin review of a government ID submission
CREATE OR REPLACE FUNCTION review_id_verification(
  p_verification_id UUID,
  p_approved BOOLEAN,
  p_rejection_reason TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true
  ) THEN
    RAISE EXCEPTION 'Access denied. Only platform administrators can review ID verifications.';
  END IF;

  UPDATE id_verifications
  SET status = CASE WHEN p_approved THEN 'approved' ELSE 'rejected' END,
      reviewed_at = timezone('utc'::text, now()),
      reviewed_by = auth.uid(),
      rejection_reason = CASE WHEN p_approved THEN NULL ELSE COALESCE(p_rejection_reason, 'Rejected by admin') END
  WHERE id = p_verification_id;

  -- The AFTER UPDATE trigger will recompute the user's verification_level.
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
