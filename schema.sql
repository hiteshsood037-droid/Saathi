-- ==========================================
-- Jodi App Core Database Schema & Policies
-- Created on: 2026-06-21
-- Author: Backend Engineer (Saathi Team)
-- ==========================================

-- Clean up existing objects (useful for clean reinstalls)
DROP TRIGGER IF EXISTS trigger_swipe_match ON swipes CASCADE;
DROP TRIGGER IF EXISTS trigger_filter_message ON messages CASCADE;
DROP TRIGGER IF EXISTS trigger_update_match_streak ON messages CASCADE;
DROP TRIGGER IF EXISTS trigger_generate_referral_code ON profiles CASCADE;

DROP FUNCTION IF EXISTS handle_swipe_match() CASCADE;
DROP FUNCTION IF EXISTS filter_message_content() CASCADE;
DROP FUNCTION IF EXISTS update_match_streak() CASCADE;
DROP FUNCTION IF EXISTS generate_profile_referral_code() CASCADE;
DROP FUNCTION IF EXISTS calculate_compatibility_score(UUID, UUID) CASCADE;
DROP FUNCTION IF EXISTS calculate_distance(NUMERIC, NUMERIC, NUMERIC, NUMERIC) CASCADE;
DROP FUNCTION IF EXISTS generate_daily_picks(UUID, INT) CASCADE;
DROP FUNCTION IF EXISTS approve_selfie_verification(UUID, BOOLEAN) CASCADE;
DROP FUNCTION IF EXISTS handle_stripe_subscription_update(UUID, TEXT, TIMESTAMPTZ) CASCADE;
DROP FUNCTION IF EXISTS increment_and_check_swipe_limit(UUID) CASCADE;
DROP FUNCTION IF EXISTS is_admin(UUID) CASCADE;

DROP TABLE IF EXISTS boost_events CASCADE;
DROP TABLE IF EXISTS daily_picks CASCADE;
DROP TABLE IF EXISTS blocks CASCADE;
DROP TABLE IF EXISTS reports CASCADE;
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS matches CASCADE;
DROP TABLE IF EXISTS swipes CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

DROP TYPE IF EXISTS family_values_type CASCADE;
DROP TYPE IF EXISTS diet_type CASCADE;
DROP TYPE IF EXISTS subscription_tier_type CASCADE;
DROP TYPE IF EXISTS verification_status_type CASCADE;
DROP TYPE IF EXISTS swipe_type_enum CASCADE;

-- ==========================================
-- 1. Create Customized ENUM Types
-- ==========================================

CREATE TYPE verification_status_type AS ENUM ('none', 'pending', 'approved', 'rejected');
CREATE TYPE subscription_tier_type AS ENUM ('Free', 'Premium', 'Gold');
CREATE TYPE diet_type AS ENUM ('Veg', 'Non-Veg', 'Eggetarian', 'Vegan');
CREATE TYPE family_values_type AS ENUM ('Traditional', 'Moderate', 'Liberal');
CREATE TYPE swipe_type_enum AS ENUM ('like', 'dislike', 'super_like');

-- ==========================================
-- 2. Define Table: profiles
-- ==========================================

CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  full_name TEXT NOT NULL,
  birth_date DATE NOT NULL,
  gender TEXT NOT NULL,
  latitude NUMERIC(9,6) NOT NULL,
  longitude NUMERIC(9,6) NOT NULL,
  location_name TEXT NOT NULL,
  occupation TEXT,
  education TEXT,
  height_cm NUMERIC(5,2),
  diet diet_type DEFAULT 'Non-Veg',
  smoking_pref TEXT, -- 'Non-smoker', 'Light smoker', 'Regular smoker'
  drinking_pref TEXT, -- 'Non-drinker', 'Social drinker', 'Regular drinker'
  languages_spoken TEXT[] DEFAULT '{}'::TEXT[],
  religion TEXT NOT NULL,
  caste TEXT, -- Optional
  relationship_goal TEXT NOT NULL, -- 'Marriage', 'Dating', 'Long-term'
  family_values family_values_type DEFAULT 'Moderate',
  immigration_status TEXT NOT NULL, -- 'Citizen', 'PR', 'Student Visa', 'Work Permit', 'Other'
  activity_level TEXT NOT NULL, -- 'High', 'Moderate', 'Low'
  bio TEXT,
  photos TEXT[] DEFAULT '{}'::TEXT[],
  is_verified BOOLEAN DEFAULT FALSE NOT NULL,
  selfie_url TEXT,
  verification_status verification_status_type DEFAULT 'none' NOT NULL,
  is_banned BOOLEAN DEFAULT FALSE NOT NULL,
  ip_address TEXT,
  device_fingerprint TEXT,
  subscription_tier subscription_tier_type DEFAULT 'Free' NOT NULL,
  subscription_ends_at TIMESTAMPTZ,
  referral_code TEXT UNIQUE, -- Made nullable temporarily during trigger creation, set by trigger
  referred_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  daily_swipes_count INT DEFAULT 0 NOT NULL,
  last_swipe_reset_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  is_admin BOOLEAN DEFAULT FALSE NOT NULL
);

-- ==========================================
-- 3. Define Table: swipes
-- ==========================================

CREATE TABLE swipes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  swiper_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  swiped_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  type swipe_type_enum NOT NULL,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT unique_swipe UNIQUE (swiper_id, swiped_id)
);

-- ==========================================
-- 4. Define Table: matches
-- ==========================================

CREATE TABLE matches (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user1_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  user2_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  compatibility_score INT NOT NULL CHECK (compatibility_score >= 0 AND compatibility_score <= 100),
  streak_count INT DEFAULT 0 NOT NULL,
  last_message_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT unique_match UNIQUE (user1_id, user2_id),
  CONSTRAINT user_order CHECK (user1_id < user2_id) -- Ensures unique pairs irrespective of order
);

-- ==========================================
-- 5. Define Table: messages
-- ==========================================

CREATE TABLE messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  match_id UUID REFERENCES matches(id) ON DELETE CASCADE NOT NULL,
  sender_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE NOT NULL,
  is_flagged BOOLEAN DEFAULT FALSE NOT NULL, -- True if filtered/flagged by AI
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==========================================
-- 6. Define Table: reports
-- ==========================================

CREATE TABLE reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  reporter_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  reported_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  reason TEXT NOT NULL,
  status TEXT DEFAULT 'pending' NOT NULL, -- 'pending', 'resolved', 'ignored'
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==========================================
-- 7. Define Table: blocks
-- ==========================================

CREATE TABLE blocks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  blocker_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  blocked_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT unique_block UNIQUE (blocker_id, blocked_id)
);

-- ==========================================
-- 8. Define Table: daily_picks
-- ==========================================

CREATE TABLE daily_picks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  pick_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  score INT NOT NULL,
  created_at DATE DEFAULT CURRENT_DATE NOT NULL,
  CONSTRAINT unique_daily_pick UNIQUE (user_id, pick_id, created_at)
);

-- ==========================================
-- 9. Define Table: boost_events
-- ==========================================

CREATE TABLE boost_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN DEFAULT TRUE NOT NULL
);

-- ==========================================
-- 10. Database Indexes for Performance
-- ==========================================

-- Profiles
CREATE INDEX idx_profiles_banned_verified ON profiles(is_banned, is_verified);
CREATE INDEX idx_profiles_subscription ON profiles(subscription_tier);
CREATE INDEX idx_profiles_location ON profiles(latitude, longitude);

-- Swipes
CREATE INDEX idx_swipes_swiper_id ON swipes(swiper_id);
CREATE INDEX idx_swipes_swiped_id ON swipes(swiped_id);

-- Matches
CREATE INDEX idx_matches_user1_user2 ON matches(user1_id, user2_id);

-- Messages
CREATE INDEX idx_messages_match_id ON messages(match_id);
CREATE INDEX idx_messages_created_at ON messages(created_at);

-- Reports & Blocks
CREATE INDEX idx_reports_reported_id ON reports(reported_id);
CREATE INDEX idx_blocks_blocker_id ON blocks(blocker_id);

-- Daily Picks
CREATE INDEX idx_daily_picks_user_date ON daily_picks(user_id, created_at);

-- ==========================================
-- 11. Core Helper & Business Logic Functions
-- ==========================================

-- Admin check helper
CREATE OR REPLACE FUNCTION is_admin(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = user_id AND is_admin = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Haversine formula distance calculator
CREATE OR REPLACE FUNCTION calculate_distance(
  lat1 NUMERIC, lon1 NUMERIC,
  lat2 NUMERIC, lon2 NUMERIC
) RETURNS NUMERIC AS $$
DECLARE
  r NUMERIC := 6371; -- Earth's radius in km
  dlat NUMERIC;
  dlon NUMERIC;
  a NUMERIC;
  c NUMERIC;
BEGIN
  dlat := radians(lat2 - lat1);
  dlon := radians(lon2 - lon1);
  a := sin(dlat/2) * sin(dlat/2) + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon/2) * sin(dlon/2);
  c := 2 * atan2(sqrt(a), sqrt(1-a));
  RETURN r * c;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Smart Jodi Compatibility Score Formulation
CREATE OR REPLACE FUNCTION calculate_compatibility_score(u1_id UUID, u2_id UUID)
RETURNS INT AS $$
DECLARE
  u1_lat NUMERIC; u1_lon NUMERIC; u1_langs TEXT[]; u1_rel TEXT; u1_birth DATE; u1_goal TEXT; u1_act TEXT;
  u2_lat NUMERIC; u2_lon NUMERIC; u2_langs TEXT[]; u2_rel TEXT; u2_birth DATE; u2_goal TEXT; u2_act TEXT;
  
  dist NUMERIC;
  loc_score INT := 0;
  lang_score INT := 0;
  rel_score INT := 0;
  age_score INT := 0;
  goal_score INT := 0;
  act_score INT := 0;
  
  shared_langs_count INT;
  u1_langs_len INT;
  u2_langs_len INT;
  age_diff INT;
  act1 INT;
  act2 INT;
  act_diff INT;
BEGIN
  -- Fetch details for User 1
  SELECT latitude, longitude, languages_spoken, religion, birth_date, relationship_goal, activity_level
  INTO u1_lat, u1_lon, u1_langs, u1_rel, u1_birth, u1_goal, u1_act
  FROM profiles WHERE id = u1_id;
  
  -- Fetch details for User 2
  SELECT latitude, longitude, languages_spoken, religion, birth_date, relationship_goal, activity_level
  INTO u2_lat, u2_lon, u2_langs, u2_rel, u2_birth, u2_goal, u2_act
  FROM profiles WHERE id = u2_id;
  
  -- 1. Location Proximity (25 pts)
  dist := calculate_distance(u1_lat, u1_lon, u2_lat, u2_lon);
  IF dist < 20 THEN
    loc_score := 25;
  ELSIF dist <= 50 THEN
    loc_score := 20;
  ELSIF dist <= 150 THEN
    loc_score := 15;
  ELSE
    loc_score := 5;
  END IF;
  
  -- 2. Language Preference (20 pts)
  u1_langs_len := COALESCE(cardinality(u1_langs), 0);
  u2_langs_len := COALESCE(cardinality(u2_langs), 0);
  IF u1_langs_len > 0 AND u2_langs_len > 0 THEN
    SELECT COALESCE(cardinality(array(SELECT unnest(u1_langs) INTERSECT SELECT unnest(u2_langs))), 0) INTO shared_langs_count;
    IF shared_langs_count = u1_langs_len AND shared_langs_count = u2_langs_len THEN
      lang_score := 20;
    ELSIF shared_langs_count > 0 THEN
      lang_score := 12;
    ELSE
      lang_score := 0;
    END IF;
  ELSE
    lang_score := 0;
  END IF;
  
  -- 3. Religion Preference (15 pts)
  IF u1_rel = u2_rel THEN
    rel_score := 15;
  ELSE
    rel_score := 0;
  END IF;
  
  -- 4. Age Proximity (15 pts)
  age_diff := ABS(EXTRACT(YEAR FROM age(u1_birth)) - EXTRACT(YEAR FROM age(u2_birth)));
  IF age_diff <= 2 THEN
    age_score := 15;
  ELSIF age_diff <= 5 THEN
    age_score := 10;
  ELSIF age_diff <= 8 THEN
    age_score := 5;
  ELSE
    age_score := 0;
  END IF;
  
  -- 5. Relationship Goals Match (15 pts)
  IF u1_goal = u2_goal THEN
    goal_score := 15;
  ELSIF (u1_goal = 'Marriage' AND u2_goal = 'Long-term') OR (u1_goal = 'Long-term' AND u2_goal = 'Marriage') THEN
    goal_score := 8;
  ELSIF (u1_goal = 'Dating' AND u2_goal = 'Long-term') OR (u1_goal = 'Long-term' AND u2_goal = 'Dating') THEN
    goal_score := 8;
  ELSE
    goal_score := 0;
  END IF;
  
  -- 6. Activity Level Compatibility (10 pts)
  IF u1_act = 'High' THEN act1 := 3; ELSIF u1_act = 'Moderate' THEN act1 := 2; ELSE act1 := 1; END IF;
  IF u2_act = 'High' THEN act2 := 3; ELSIF u2_act = 'Moderate' THEN act2 := 2; ELSE act2 := 1; END IF;
  
  act_diff := ABS(act1 - act2);
  IF act_diff = 0 THEN
    act_score := 10;
  ELSIF act_diff = 1 THEN
    act_score := 5;
  ELSE
    act_score := 0;
  END IF;
  
  RETURN (loc_score + lang_score + rel_score + age_score + goal_score + act_score);
END;
$$ LANGUAGE plpgsql STABLE;

-- Daily Picks Generator for a given User
CREATE OR REPLACE FUNCTION generate_daily_picks(target_user_id UUID, limit_val INT DEFAULT 5)
RETURNS VOID AS $$
DECLARE
  target_gender TEXT;
BEGIN
  -- Get the target user's gender
  SELECT gender INTO target_gender FROM profiles WHERE id = target_user_id;

  -- Insert top potential matches into daily_picks
  INSERT INTO daily_picks (user_id, pick_id, score)
  SELECT
    target_user_id,
    p.id AS pick_id,
    calculate_compatibility_score(target_user_id, p.id) AS score
  FROM profiles p
  WHERE p.id != target_user_id
    AND p.is_banned = false
    AND p.gender != target_gender -- Opposite gender match
    -- Exclude users already swiped
    AND NOT EXISTS (
      SELECT 1 FROM swipes s
      WHERE s.swiper_id = target_user_id AND s.swiped_id = p.id
    )
    -- Exclude users already matched
    AND NOT EXISTS (
      SELECT 1 FROM matches m
      WHERE (m.user1_id = target_user_id AND m.user2_id = p.id)
         OR (m.user2_id = target_user_id AND m.user1_id = p.id)
    )
    -- Exclude blocks (both ways)
    AND NOT EXISTS (
      SELECT 1 FROM blocks b
      WHERE (b.blocker_id = target_user_id AND b.blocked_id = p.id)
         OR (b.blocker_id = p.id AND b.blocked_id = target_user_id)
    )
  ORDER BY score DESC
  LIMIT limit_val
  ON CONFLICT (user_id, pick_id, created_at) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Swipe limit checker and incrementer
CREATE OR REPLACE FUNCTION increment_and_check_swipe_limit(p_swiper_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_tier subscription_tier_type;
  v_swipes_count INT;
  v_last_reset TIMESTAMPTZ;
BEGIN
  SELECT subscription_tier, daily_swipes_count, last_swipe_reset_at
  INTO v_tier, v_swipes_count, v_last_reset
  FROM profiles
  WHERE id = p_swiper_id;

  -- Unlimited swipes for Premium and Gold
  IF v_tier = 'Premium' OR v_tier = 'Gold' THEN
    RETURN TRUE;
  END IF;

  -- Reset swipe counter if 24 hours have passed since last reset
  IF v_last_reset < timezone('utc'::text, now() - INTERVAL '24 hours') THEN
    UPDATE profiles
    SET daily_swipes_count = 1,
        last_swipe_reset_at = timezone('utc'::text, now())
    WHERE id = p_swiper_id;
    RETURN TRUE;
  END IF;

  -- Limit free tier to 20 daily swipes
  IF v_swipes_count < 20 THEN
    UPDATE profiles
    SET daily_swipes_count = daily_swipes_count + 1
    WHERE id = p_swiper_id;
    RETURN TRUE;
  ELSE
    RETURN FALSE;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Admin approval of Selfie verification
CREATE OR REPLACE FUNCTION approve_selfie_verification(
  target_user_id UUID,
  p_approved BOOLEAN
)
RETURNS VOID AS $$
BEGIN
  -- Verify calling user is an Admin
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND is_admin = true
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Only platform administrators can approve/reject selfies.';
  END IF;

  IF p_approved THEN
    UPDATE profiles
    SET verification_status = 'approved',
        is_verified = true,
        updated_at = timezone('utc'::text, now())
    WHERE id = target_user_id;
  ELSE
    UPDATE profiles
    SET verification_status = 'rejected',
        is_verified = false,
        updated_at = timezone('utc'::text, now())
    WHERE id = target_user_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Stripe lifecycle update processor
CREATE OR REPLACE FUNCTION handle_stripe_subscription_update(
  p_user_id UUID,
  p_tier subscription_tier_type,
  p_ends_at TIMESTAMPTZ
)
RETURNS VOID AS $$
BEGIN
  UPDATE profiles
  SET subscription_tier = p_tier,
      subscription_ends_at = p_ends_at,
      updated_at = timezone('utc'::text, now())
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Built-in referral program handler
CREATE OR REPLACE FUNCTION handle_referral(
  new_user_id UUID,
  p_referral_code TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  referrer_id UUID;
BEGIN
  -- Search for referrer matching code
  SELECT id INTO referrer_id
  FROM profiles
  WHERE referral_code = p_referral_code;

  IF referrer_id IS NOT NULL AND referrer_id != new_user_id THEN
    -- Assign referral
    UPDATE profiles
    SET referred_by = referrer_id
    WHERE id = new_user_id;

    -- Reward Referrer: grant 7 days of Premium subscription
    UPDATE profiles
    SET subscription_tier = CASE 
                              WHEN subscription_tier = 'Free' THEN 'Premium'::subscription_tier_type 
                              ELSE subscription_tier 
                            END,
        subscription_ends_at = CASE 
                                 WHEN subscription_ends_at IS NULL THEN timezone('utc'::text, now() + INTERVAL '7 days')
                                 ELSE subscription_ends_at + INTERVAL '7 days'
                               END
    WHERE id = referrer_id;

    -- Reward Referee: grant 3 days of Premium subscription
    UPDATE profiles
    SET subscription_tier = 'Premium'::subscription_tier_type,
        subscription_ends_at = timezone('utc'::text, now() + INTERVAL '3 days')
    WHERE id = new_user_id;

    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- 12. Row Level Security (RLS) Policies
-- ==========================================

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE swipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_picks ENABLE ROW LEVEL SECURITY;
ALTER TABLE boost_events ENABLE ROW LEVEL SECURITY;

-- ---- PROFILES POLICIES ----
CREATE POLICY "Profiles viewable by authenticated, non-banned users"
  ON profiles FOR SELECT TO authenticated
  USING (auth.uid() = id OR (NOT is_banned AND NOT EXISTS (
    SELECT 1 FROM blocks b 
    WHERE (b.blocker_id = auth.uid() AND b.blocked_id = id) 
       OR (b.blocker_id = id AND b.blocked_id = auth.uid())
  )));

CREATE POLICY "Users can insert their own profile"
  ON profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins have total control of profiles"
  ON profiles FOR ALL TO authenticated
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));


-- ---- SWIPES POLICIES ----
CREATE POLICY "Users can select their own swipes"
  ON swipes FOR SELECT TO authenticated
  USING (auth.uid() = swiper_id);

CREATE POLICY "Users can create their own swipes"
  ON swipes FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = swiper_id AND NOT EXISTS (
    -- Prevent swiping on blocked users
    SELECT 1 FROM blocks b 
    WHERE (b.blocker_id = auth.uid() AND b.blocked_id = swiped_id)
       OR (b.blocker_id = swiped_id AND b.blocked_id = auth.uid())
  ));

CREATE POLICY "Users can delete their own swipes (rewind perk)"
  ON swipes FOR DELETE TO authenticated
  USING (auth.uid() = swiper_id);


-- ---- MATCHES POLICIES ----
CREATE POLICY "Users can view matches they are a part of"
  ON matches FOR SELECT TO authenticated
  USING (auth.uid() = user1_id OR auth.uid() = user2_id);

-- Matches are managed programmatically via auto-match triggers; admins can manage
CREATE POLICY "Admins can manage matches"
  ON matches FOR ALL TO authenticated
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));


-- ---- MESSAGES POLICIES ----
CREATE POLICY "Users can view messages in their active matches"
  ON messages FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM matches m 
    WHERE m.id = match_id AND (m.user1_id = auth.uid() OR m.user2_id = auth.uid())
  ));

CREATE POLICY "Users can send messages to their matches"
  ON messages FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid() AND EXISTS (
      SELECT 1 FROM matches m 
      WHERE m.id = match_id AND (m.user1_id = auth.uid() OR m.user2_id = auth.uid())
    )
  );

CREATE POLICY "Users can edit messages in their matches (e.g. mark as read)"
  ON messages FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM matches m 
    WHERE m.id = match_id AND (m.user1_id = auth.uid() OR m.user2_id = auth.uid())
  ));


-- ---- REPORTS POLICIES ----
CREATE POLICY "Users can view reports they filed"
  ON reports FOR SELECT TO authenticated
  USING (auth.uid() = reporter_id);

CREATE POLICY "Users can file safety reports"
  ON reports FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "Admins can manage reports"
  ON reports FOR ALL TO authenticated
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));


-- ---- BLOCKS POLICIES ----
CREATE POLICY "Users can view their own blocks"
  ON blocks FOR SELECT TO authenticated
  USING (auth.uid() = blocker_id);

CREATE POLICY "Users can block another profile"
  ON blocks FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = blocker_id);

CREATE POLICY "Users can unblock profiles"
  ON blocks FOR DELETE TO authenticated
  USING (auth.uid() = blocker_id);


-- ---- DAILY PICKS POLICIES ----
CREATE POLICY "Users can view their own customized daily picks"
  ON daily_picks FOR SELECT TO authenticated
  USING (auth.uid() = user_id);


-- ---- BOOST EVENTS POLICIES ----
CREATE POLICY "Boost events are visible to all users"
  ON boost_events FOR SELECT TO authenticated
  USING (is_active = TRUE);

CREATE POLICY "Admins can manage boost events"
  ON boost_events FOR ALL TO authenticated
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));


-- ==========================================
-- 13. Database Triggers (Automated Operations)
-- ==========================================

-- Trigger 1: Auto-generate unique Referral Code
CREATE OR REPLACE FUNCTION generate_profile_referral_code()
RETURNS TRIGGER AS $$
DECLARE
  new_code TEXT;
  code_exists BOOLEAN;
BEGIN
  LOOP
    new_code := upper(substring(md5(random()::text) from 1 for 8));
    SELECT EXISTS(SELECT 1 FROM profiles WHERE referral_code = new_code) INTO code_exists;
    EXIT WHEN NOT code_exists;
  END LOOP;
  
  NEW.referral_code := new_code;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_generate_referral_code
BEFORE INSERT ON profiles
FOR EACH ROW
WHEN (NEW.referral_code IS NULL)
EXECUTE FUNCTION generate_profile_referral_code();


-- Trigger 2: Automated Match Creation on Mutual Swipes
CREATE OR REPLACE FUNCTION handle_swipe_match()
RETURNS TRIGGER AS $$
DECLARE
  mutual_exists BOOLEAN;
  compatibility_score_val INT;
  u1 UUID;
  u2 UUID;
BEGIN
  -- Only trigger matching on likes and super_likes
  IF NEW.type = 'dislike' THEN
    RETURN NEW;
  END IF;

  -- Check if the target user has also swiped positively on the swiper
  SELECT EXISTS (
    SELECT 1 FROM swipes
    WHERE swiper_id = NEW.swiped_id
      AND swiped_id = NEW.swiper_id
      AND type IN ('like', 'super_like')
  ) INTO mutual_exists;

  IF mutual_exists THEN
    -- Match constraint enforcement: user1_id < user2_id
    IF NEW.swiper_id < NEW.swiped_id THEN
      u1 := NEW.swiper_id;
      u2 := NEW.swiped_id;
    ELSE
      u1 := NEW.swiped_id;
      u2 := NEW.swiper_id;
    END IF;

    -- Calculate Smart Jodi Compatibility Score
    compatibility_score_val := calculate_compatibility_score(u1, u2);

    -- Insert new match
    INSERT INTO matches (user1_id, user2_id, compatibility_score)
    VALUES (u1, u2, compatibility_score_val)
    ON CONFLICT (user1_id, user2_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_swipe_match
AFTER INSERT ON swipes
FOR EACH ROW
EXECUTE FUNCTION handle_swipe_match();


-- Trigger 3: In-chat Messaging Safe Content Filtering
CREATE OR REPLACE FUNCTION filter_message_content()
RETURNS TRIGGER AS $$
DECLARE
  blacklist TEXT[] := ARRAY[
    'abuse', 'scam', 'fraud', 'cheat', 'asshole', 'bitch', 'bastard', 'idiot', 'spam', 'fake',
    'offensive_keyword1', 'offensive_keyword2'
  ];
  word TEXT;
  lower_content TEXT;
  cleaned_content TEXT;
  found_flag BOOLEAN := FALSE;
BEGIN
  cleaned_content := NEW.content;
  lower_content := lower(NEW.content);

  FOREACH word IN ARRAY blacklist LOOP
    IF position(word in lower_content) > 0 THEN
      -- Replace abusive keyword with asterisks
      cleaned_content := regexp_replace(cleaned_content, word, repeat('*', length(word)), 'gi');
      found_flag := TRUE;
    END IF;
  END LOOP;

  NEW.content := cleaned_content;
  IF found_flag THEN
    NEW.is_flagged := TRUE;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_filter_message
BEFORE INSERT ON messages
FOR EACH ROW
EXECUTE FUNCTION filter_message_content();


-- Trigger 4: Automatic Match Communication Streaks
CREATE OR REPLACE FUNCTION update_match_streak()
RETURNS TRIGGER AS $$
DECLARE
  prev_msg_time TIMESTAMPTZ;
  curr_streak INT;
  hours_diff NUMERIC;
  days_diff INT;
BEGIN
  -- Obtain the previous state
  SELECT last_message_at, streak_count
  INTO prev_msg_time, curr_streak
  FROM matches
  WHERE id = NEW.match_id;

  IF prev_msg_time IS NULL THEN
    -- Start communication streak at 1
    UPDATE matches
    SET last_message_at = NEW.created_at,
        streak_count = 1
    WHERE id = NEW.match_id;
  ELSE
    hours_diff := EXTRACT(EPOCH FROM (NEW.created_at - prev_msg_time)) / 3600.0;
    days_diff := DATE_PART('day', NEW.created_at::timestamp - prev_msg_time::timestamp);

    IF days_diff = 1 THEN
      -- Active communication on successive calendar day! Increment streak
      UPDATE matches
      SET last_message_at = NEW.created_at,
          streak_count = streak_count + 1
      WHERE id = NEW.match_id;
    ELSIF days_diff > 1 OR hours_diff > 36.0 THEN
      -- Interval exceeded! Reset streak to 1
      UPDATE matches
      SET last_message_at = NEW.created_at,
          streak_count = 1
      WHERE id = NEW.match_id;
    ELSE
      -- Communication on same day: update last message timestamp only
      UPDATE matches
      SET last_message_at = NEW.created_at
      WHERE id = NEW.match_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_update_match_streak
AFTER INSERT ON messages
FOR EACH ROW
EXECUTE FUNCTION update_match_streak();


-- ==========================================
-- 14. Storage Buckets & Policies Setup
-- ==========================================

-- Establish Storage schema tables reference and insert buckets
INSERT INTO storage.buckets (id, name, public)
VALUES ('user-photos', 'user-photos', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('selfie-verification', 'selfie-verification', false)
ON CONFLICT (id) DO NOTHING;

-- RLS setup for Storage Objects
CREATE POLICY "Public user profile photos are viewable" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'user-photos');

CREATE POLICY "Users can upload their own profile photos" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'user-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own profile photos" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'user-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Admins can inspect selfie-verifications" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'selfie-verification' AND is_admin(auth.uid()));

CREATE POLICY "Users can upload selfie-verification photos" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'selfie-verification' AND auth.uid()::text = (storage.foldername(name))[1]);
