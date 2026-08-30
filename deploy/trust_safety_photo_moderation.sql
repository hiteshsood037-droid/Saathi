-- ============================================================
-- Jodi App — Trust & Safety: Photo Moderation
-- Module 4 of 4 (idempotent — safe to re-run)
-- Created: 2026-08-29 · Backend Engineer: supa_dev (Saathi Team)
--
-- Tracks AI/ML moderation of user profile photos.
--
-- AI/ML provider integration point (mirrors the existing selfie-moderation
-- edge function pattern): a `photo-moderation` edge function uploads a photo,
-- calls an image-safety provider (AWS Rekognition, Google Cloud Vision,
-- Sightengine, or Hive Moderation), then writes a row here with
-- `moderation_score` + `status`. The admin queue view lets a human reviewer
-- confirm or override the AI decision.
--
-- Deploy: paste this entire file into Supabase SQL Editor.
-- ============================================================

-- 4.1 Photo moderation table
CREATE TABLE IF NOT EXISTS photo_moderation (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  photo_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  -- 0.00 (safe) → 1.00 (highly inappropriate) — provider confidence
  moderation_score NUMERIC(5,2),
  reviewed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  reviewed_at TIMESTAMPTZ
);

-- 4.2 Indexes
CREATE INDEX IF NOT EXISTS idx_photo_moderation_user_id ON photo_moderation(user_id);
CREATE INDEX IF NOT EXISTS idx_photo_moderation_status ON photo_moderation(status);
CREATE INDEX IF NOT EXISTS idx_photo_moderation_created ON photo_moderation(created_at);

-- 4.3 RLS
ALTER TABLE photo_moderation ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own photo moderation"
  ON photo_moderation FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users submit own photos for moderation"
  ON photo_moderation FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins manage photo moderation"
  ON photo_moderation FOR ALL TO authenticated
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

-- 4.4 Admin review queue view
CREATE OR REPLACE VIEW admin_photo_moderation_queue AS
SELECT
  pm.id AS moderation_id,
  pm.user_id,
  p.full_name,
  pm.photo_url,
  pm.status,
  pm.moderation_score,
  pm.rejection_reason,
  pm.created_at
FROM photo_moderation pm
JOIN profiles p ON p.id = pm.user_id
WHERE pm.status = 'pending'
ORDER BY pm.created_at ASC;

-- 4.5 Trigger: recompute verification_level when a photo is approved/rejected
-- (photo level is the lowest tier above 'none')
CREATE OR REPLACE FUNCTION trigger_photo_moderation_recompute()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM recompute_verification_level(NEW.user_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_photo_moderation_recompute ON photo_moderation;
CREATE TRIGGER trigger_photo_moderation_recompute
AFTER INSERT OR UPDATE OF status ON photo_moderation
FOR EACH ROW
EXECUTE FUNCTION trigger_photo_moderation_recompute();

-- 4.6 RPC: admin reviews a photo (approve / reject)
CREATE OR REPLACE FUNCTION review_photo_moderation(
  p_moderation_id UUID,
  p_approved BOOLEAN,
  p_rejection_reason TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true
  ) THEN
    RAISE EXCEPTION 'Access denied. Only platform administrators can review photos.';
  END IF;

  UPDATE photo_moderation
  SET status = CASE WHEN p_approved THEN 'approved' ELSE 'rejected' END,
      reviewed_at = timezone('utc'::text, now()),
      reviewed_by = auth.uid(),
      rejection_reason = CASE WHEN p_approved THEN NULL ELSE COALESCE(p_rejection_reason, 'Rejected by admin') END
  WHERE id = p_moderation_id;

  -- AFTER UPDATE trigger recomputes the user's verification_level.
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
