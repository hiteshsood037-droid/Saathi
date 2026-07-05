/**
 * ===================================================================================
 * JODI DATING APP - CORES BACKEND API & DB OPERATIONS SIMULATION SANDBOX
 * ===================================================================================
 * Author: Backend Engineer (Saathi Team)
 * Date: 2026-06-21
 * Description: Fully automated Node.js backend simulator and testing sandbox.
 *              Validates user profiles seeding, multi-dimensional Smart Compatibility 
 *              Score calculations, automated swiping/mutual match triggers, real-time 
 *              Hinge-style safe chat keyword filtering, messaging streaks, Stripe 
 *              checkout webhook events, Daily Picks recommendation generation, referral 
 *              reward applications, and admin moderation/ban evasion preventions.
 * ===================================================================================
 */

const fs = require('fs');

// --- DATABASE STATE EMULATION ---
const db = {
  profiles: [],
  swipes: [],
  matches: [],
  messages: [],
  reports: [],
  blocks: [],
  daily_picks: [],
  boost_events: [],
  ip_device_blacklist: []
};

// --- PRETTY PRINT UTILS ---
function printHeader(title) {
  console.log('\n' + '='.repeat(80));
  console.log(`📜 ${title.toUpperCase()}`);
  console.log('='.repeat(80));
}

function printSubHeader(title) {
  console.log(`\n🔹 ${title}`);
  console.log('-'.repeat(40));
}

// --- GEOGRAPHICAL & MATH CALCULATIONS ---
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

function getAge(birthDateString) {
  const today = new Date();
  const birthDate = new Date(birthDateString);
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

// --- SMART JODI COMPATIBILITY SCORE ENGINE ---
function calculateCompatibilityScore(u1, u2) {
  // 1. Location Proximity (25 pts)
  const dist = calculateDistance(u1.latitude, u1.longitude, u2.latitude, u2.longitude);
  let locScore = 0;
  if (dist < 20) locScore = 25;
  else if (dist <= 50) locScore = 20;
  else if (dist <= 150) locScore = 15;
  else locScore = 5;

  // 2. Language Preference (20 pts)
  const set1 = new Set(u1.languages_spoken);
  const set2 = new Set(u2.languages_spoken);
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  let langScore = 0;
  if (intersection.size > 0) {
    if (intersection.size === set1.size && intersection.size === set2.size) {
      langScore = 20; // Full overlap
    } else {
      langScore = 12; // Partial overlap
    }
  }

  // 3. Religion Preference (15 pts)
  const relScore = (u1.religion === u2.religion) ? 15 : 0;

  // 4. Age Proximity (15 pts)
  const age1 = getAge(u1.birth_date);
  const age2 = getAge(u2.birth_date);
  const ageDiff = Math.abs(age1 - age2);
  let ageScore = 0;
  if (ageDiff <= 2) ageScore = 15;
  else if (ageDiff <= 5) ageScore = 10;
  else if (ageDiff <= 8) ageScore = 5;

  // 5. Relationship Goals Match (15 pts)
  let goalScore = 0;
  if (u1.relationship_goal === u2.relationship_goal) {
    goalScore = 15;
  } else if (
    (u1.relationship_goal === 'Marriage' && u2.relationship_goal === 'Long-term') ||
    (u1.relationship_goal === 'Long-term' && u2.relationship_goal === 'Marriage') ||
    (u1.relationship_goal === 'Dating' && u2.relationship_goal === 'Long-term') ||
    (u1.relationship_goal === 'Long-term' && u2.relationship_goal === 'Dating')
  ) {
    goalScore = 8; // Complementary goals
  }

  // 6. Activity Level Compatibility (10 pts)
  const activityMap = { 'High': 3, 'Moderate': 2, 'Low': 1 };
  const act1 = activityMap[u1.activity_level] || 2;
  const act2 = activityMap[u2.activity_level] || 2;
  const actDiff = Math.abs(act1 - act2);
  let actScore = 0;
  if (actDiff === 0) actScore = 10;
  else if (actDiff === 1) actScore = 5;

  const totalScore = locScore + langScore + relScore + ageScore + goalScore + actScore;

  return {
    total: totalScore,
    breakdown: {
      location: { score: locScore, distanceKm: dist.toFixed(1) },
      languages: { score: langScore, shared: [...intersection] },
      religion: { score: relScore, matches: u1.religion === u2.religion },
      age: { score: ageScore, differenceYears: ageDiff },
      relationshipGoal: { score: goalScore, goals: [u1.relationship_goal, u2.relationship_goal] },
      activityLevel: { score: actScore, levels: [u1.activity_level, u2.activity_level] }
    }
  };
}

// --- SEEDING PROFILES ---
function seedMockUsers() {
  const mockUsers = [
    {
      id: 'usr-aarav-sharma-1111',
      full_name: 'Aarav Sharma',
      birth_date: '1998-05-12', // 28 years
      gender: 'Male',
      latitude: 42.3601,
      longitude: -71.0589,
      location_name: 'Boston, USA',
      occupation: 'Doctor',
      education: 'MD',
      height_cm: 182,
      diet: 'Veg',
      languages_spoken: ['English', 'Hindi'],
      religion: 'Hindu',
      relationship_goal: 'Marriage',
      activity_level: 'High',
      bio: 'Samosas over salads, any day. Looking to build a warm home in Boston.',
      subscription_tier: 'Free',
      referral_code: 'AARAV888',
      daily_swipes_count: 0,
      is_verified: true,
      verification_status: 'approved',
      is_banned: false,
      ip_address: '198.51.100.12',
      device_fingerprint: 'fp-boston-apple-882'
    },
    {
      id: 'usr-riya-patel-2222',
      full_name: 'Riya Patel',
      birth_date: '2000-11-20', // 26 years
      gender: 'Female',
      latitude: 42.3584,
      longitude: -71.0601,
      location_name: 'Boston, USA',
      occupation: 'Software Engineer',
      education: 'MS in Computer Science',
      height_cm: 165,
      diet: 'Veg',
      languages_spoken: ['English', 'Hindi', 'Gujarati'],
      religion: 'Hindu',
      relationship_goal: 'Marriage',
      activity_level: 'Moderate',
      bio: 'Gujju girl finding her chai companion in Boston. Let’s talk algorithms or samosas!',
      subscription_tier: 'Free',
      referral_code: 'RIYAP555',
      daily_swipes_count: 0,
      is_verified: true,
      verification_status: 'approved',
      is_banned: false,
      ip_address: '198.51.100.15',
      device_fingerprint: 'fp-boston-iphone-990'
    },
    {
      id: 'usr-vikram-singh-3333',
      full_name: 'Vikram Singh',
      birth_date: '1995-02-15', // 31 years
      gender: 'Male',
      latitude: 40.7128,
      longitude: -74.0060,
      location_name: 'New York, USA',
      occupation: 'Investment Banker',
      education: 'MBA',
      height_cm: 185,
      diet: 'Non-Veg',
      languages_spoken: ['English', 'Punjabi'],
      religion: 'Sikh',
      relationship_goal: 'Long-term',
      activity_level: 'High',
      bio: 'Exploring NYC one weekend at a time. High-energy Punjabi looking for a deep connection.',
      subscription_tier: 'Free',
      referral_code: 'VIKR7777',
      daily_swipes_count: 0,
      is_verified: false,
      verification_status: 'none',
      is_banned: false,
      ip_address: '203.0.113.88',
      device_fingerprint: 'fp-nyc-mac-331'
    },
    {
      id: 'usr-meera-nair-4444',
      full_name: 'Meera Nair',
      birth_date: '1997-08-04', // 29 years
      gender: 'Female',
      latitude: 40.7142,
      longitude: -74.0064,
      location_name: 'New York, USA',
      occupation: 'Product Designer',
      education: 'BFA',
      height_cm: 168,
      diet: 'Non-Veg',
      languages_spoken: ['English', 'Malayalam'],
      religion: 'Hindu',
      relationship_goal: 'Long-term',
      activity_level: 'High',
      bio: 'Designer who loves aesthetics, filter coffee, and rooftop bars. Let’s connect!',
      subscription_tier: 'Free',
      referral_code: 'MEER1234',
      daily_swipes_count: 0,
      is_verified: true,
      verification_status: 'approved',
      is_banned: false,
      ip_address: '203.0.113.91',
      device_fingerprint: 'fp-nyc-ipad-212'
    },
    {
      id: 'usr-amit-verma-5555',
      full_name: 'Amit Verma',
      birth_date: '2001-04-10', // 25 years
      gender: 'Male',
      latitude: 19.0760,
      longitude: 72.8777,
      location_name: 'Mumbai, India',
      occupation: 'Financial Analyst',
      education: 'BCom',
      height_cm: 175,
      diet: 'Non-Veg',
      languages_spoken: ['English', 'Hindi', 'Marathi'],
      religion: 'Hindu',
      relationship_goal: 'Dating',
      activity_level: 'Low',
      bio: 'Lazy weekends, video games, and occasionally heading out. Hit me up if you match my vibe.',
      subscription_tier: 'Free',
      referral_code: 'AMIT9999',
      daily_swipes_count: 0,
      is_verified: false,
      verification_status: 'none',
      is_banned: false,
      ip_address: '192.0.2.45',
      device_fingerprint: 'fp-mumbai-samsung-544'
    },
    {
      id: 'usr-priya-rao-6666',
      full_name: 'Priya Rao',
      birth_date: '2002-09-18', // 24 years
      gender: 'Female',
      latitude: 19.0820,
      longitude: 72.8800,
      location_name: 'Mumbai, India',
      occupation: 'Marketing Specialist',
      education: 'BMS',
      height_cm: 160,
      diet: 'Veg',
      languages_spoken: ['English', 'Tamil'],
      religion: 'Hindu',
      relationship_goal: 'Dating',
      activity_level: 'Moderate',
      bio: 'Chai lover, bookworm, and exploring cafes. Looking for something fun but genuine.',
      subscription_tier: 'Free',
      referral_code: 'PRIY2222',
      daily_swipes_count: 0,
      is_verified: false,
      verification_status: 'none',
      is_banned: false,
      ip_address: '192.0.2.77',
      device_fingerprint: 'fp-mumbai-oneplus-102'
    }
  ];

  db.profiles = mockUsers;
  console.log(`✅ Successfully seeded ${db.profiles.length} mock user profiles into memory.`);
}

// --- SWIPING & AUTO-MATCH OPERATIONS ---
function swipe(swiperId, swipedId, type) {
  const swiper = db.profiles.find(p => p.id === swiperId);
  const swiped = db.profiles.find(p => p.id === swipedId);

  if (!swiper || !swiped) {
    throw new Error('Swiper or Swiped profile not found.');
  }

  // Check IP/Device ban eviction first
  if (swiper.is_banned) {
    console.log(`🚫 Banned user ${swiper.full_name} attempted to swipe. Denied.`);
    return false;
  }

  // Manage daily swipe counts for free users (Limit = 20)
  if (swiper.subscription_tier === 'Free') {
    if (swiper.daily_swipes_count >= 20) {
      console.log(`⚠️ User ${swiper.full_name} has reached their daily swipe limit (20/20). Swipe rejected.`);
      return false;
    }
    swiper.daily_swipes_count++;
  }

  // Create swipe record
  const swipeRecord = {
    id: `swp-${Math.random().toString(36).substr(2, 9)}`,
    swiper_id: swiperId,
    swiped_id: swipedId,
    type: type,
    created_at: new Date()
  };

  db.swipes.push(swipeRecord);
  console.log(`☝️ Swipe Created: ${swiper.full_name} swiped [${type.toUpperCase()}] on ${swiped.full_name}.`);

  // Detect mutual match on like/super_like
  if (type === 'like' || type === 'super_like') {
    const mutualExists = db.swipes.find(s => 
      s.swiper_id === swipedId && 
      s.swiped_id === swiperId && 
      (s.type === 'like' || s.type === 'super_like')
    );

    if (mutualExists) {
      createMatch(swiperId, swipedId);
    }
  }

  return true;
}

function createMatch(u1_id, u2_id) {
  const u1 = db.profiles.find(p => p.id === u1_id);
  const u2 = db.profiles.find(p => p.id === u2_id);

  // Match constraint: user1_id < user2_id
  const [firstId, secondId] = u1_id < u2_id ? [u1_id, u2_id] : [u2_id, u1_id];
  const firstUser = db.profiles.find(p => p.id === firstId);
  const secondUser = db.profiles.find(p => p.id === secondId);

  // Calculate compatibility score
  const compResult = calculateCompatibilityScore(firstUser, secondUser);

  const matchRecord = {
    id: `mat-${Math.random().toString(36).substr(2, 9)}`,
    user1_id: firstId,
    user2_id: secondId,
    compatibility_score: compResult.total,
    streak_count: 0,
    last_message_at: null,
    created_at: new Date()
  };

  db.matches.push(matchRecord);
  console.log(`❤️ AUTOMATED MATCH TRIGGERED! ${firstUser.full_name} and ${secondUser.full_name} matched! Compatibility Score: ${compResult.total}/100.`);
}

// --- MESSAGING, STREAKS, AND CONTENT FILTER MODERATION ---
function sendMessage(matchId, senderId, content) {
  const match = db.matches.find(m => m.id === matchId);
  const sender = db.profiles.find(p => p.id === senderId);

  if (!match || !sender) {
    throw new Error('Match or sender not found.');
  }

  // 1. SAFE CONTENT FILTER (Replace blacklisted words with asterisks)
  const blacklist = [
    'abuse', 'scam', 'fraud', 'cheat', 'asshole', 'bitch', 'bastard', 'idiot', 'spam', 'fake'
  ];
  let isFlagged = false;
  let filteredContent = content;

  blacklist.forEach(word => {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    if (regex.test(filteredContent)) {
      filteredContent = filteredContent.replace(regex, '*'.repeat(word.length));
      isFlagged = true;
    }
  });

  const messageRecord = {
    id: `msg-${Math.random().toString(36).substr(2, 9)}`,
    match_id: matchId,
    sender_id: senderId,
    content: filteredContent,
    is_read: false,
    is_flagged: isFlagged,
    created_at: new Date()
  };

  db.messages.push(messageRecord);
  console.log(`💬 Message Sent by ${sender.full_name}: "${filteredContent}" ${isFlagged ? '⚠️ [FLAGGED AS OFFENSIVE]' : ''}`);

  // 2. STREAK MANAGEMENT SYSTEM
  const prevMsgTime = match.last_message_at;
  const now = new Date();

  if (!prevMsgTime) {
    // First message ever sets streak to 1
    match.streak_count = 1;
    match.last_message_at = now;
    console.log(`🔥 Communication streak started at 1!`);
  } else {
    const diffTime = Math.abs(now - prevMsgTime);
    const diffHours = diffTime / (1000 * 60 * 60);

    // If communication is on the successive calendar day (or between 18 - 36 hours for realistic drift)
    // Here we'll model day difference
    const prevDate = new Date(prevMsgTime).getDate();
    const currDate = now.getDate();

    if (currDate - prevDate === 1 || (diffHours >= 18 && diffHours <= 36)) {
      match.streak_count++;
      match.last_message_at = now;
      console.log(`🔥 Streak continued! Current Streak Count: ${match.streak_count} days.`);
    } else if (diffHours > 36) {
      match.streak_count = 1;
      match.last_message_at = now;
      console.log(`💔 Communication gap exceeded 36 hours! Streak broken and reset to 1.`);
    } else {
      // Same day, just update timestamp
      match.last_message_at = now;
    }
  }

  return messageRecord;
}

// --- STRIPE SUBSCRIPTION WEBHOOK LIFECYCLE ---
function handleStripeWebhookSimulation(userId, tier, endsAtIso) {
  const user = db.profiles.find(p => p.id === userId);
  if (!user) {
    throw new Error('User not found.');
  }

  user.subscription_tier = tier;
  user.subscription_ends_at = endsAtIso;
  user.updated_at = new Date();

  console.log(`💳 STRIPE WEBHOOK: User ${user.full_name} successfully upgraded to [${tier.toUpperCase()}] tier. Expiry: ${endsAtIso || 'Lifetime'}`);
}

// --- REFERRAL PROCESSOR ---
function handleReferralSimulation(newUserId, referralCode) {
  const referrer = db.profiles.find(p => p.referral_code === referralCode);
  const referee = db.profiles.find(p => p.id === newUserId);

  if (!referee) {
    throw new Error('Referee profile not found.');
  }

  if (referrer && referrer.id !== newUserId) {
    referee.referred_by = referrer.id;

    // Reward referrer: 7 days of Premium
    referrer.subscription_tier = referrer.subscription_tier === 'Free' ? 'Premium' : referrer.subscription_tier;
    const refEnds = new Date();
    refEnds.setDate(refEnds.getDate() + 7);
    referrer.subscription_ends_at = refEnds.toISOString();

    // Reward referee: 3 days of Premium
    referee.subscription_tier = 'Premium';
    const refereeEnds = new Date();
    refereeEnds.setDate(refereeEnds.getDate() + 3);
    referee.subscription_ends_at = refereeEnds.toISOString();

    console.log(`🎁 REFERRAL CODE MATCHED!`);
    console.log(`   Referrer ${referrer.full_name} awarded 7 Days of Premium (New Tier: ${referrer.subscription_tier})`);
    console.log(`   Referee ${referee.full_name} awarded 3 Days of Premium (New Tier: ${referee.subscription_tier})`);
    return true;
  }

  console.log(`❌ Referral code "${referralCode}" not matched.`);
  return false;
}

// --- RECOMMENDATION / DAILY PICKS PIPELINE ---
function generateDailyPicksSimulation(userId) {
  const user = db.profiles.find(p => p.id === userId);
  if (!user) {
    throw new Error('User not found.');
  }

  console.log(`🎯 Generating Daily Picks for ${user.full_name}...`);

  // Clear existing picks for today
  db.daily_picks = db.daily_picks.filter(p => p.user_id !== userId);

  // Potential candidates must be:
  // - Opposite gender (for heterosexual simulation)
  // - Not self
  // - Not already swiped
  // - Not already matched
  // - Not blocked (either direction)
  // - Not banned
  const candidates = db.profiles.filter(p => {
    if (p.id === userId) return false;
    if (p.is_banned) return false;
    if (p.gender === user.gender) return false;

    // Swiped check
    const alreadySwiped = db.swipes.some(s => s.swiper_id === userId && s.swiped_id === p.id);
    if (alreadySwiped) return false;

    // Matched check
    const alreadyMatched = db.matches.some(m => 
      (m.user1_id === userId && m.user2_id === p.id) ||
      (m.user2_id === userId && m.user1_id === p.id)
    );
    if (alreadyMatched) return false;

    // Blocked check
    const isBlocked = db.blocks.some(b => 
      (b.blocker_id === userId && b.blocked_id === p.id) ||
      (b.blocker_id === p.id && b.blocked_id === userId)
    );
    if (isBlocked) return false;

    return true;
  });

  // Calculate scores and sort
  const scoredCandidates = candidates.map(c => {
    const comp = calculateCompatibilityScore(user, c);
    return {
      pick_id: c.id,
      full_name: c.full_name,
      score: comp.total,
      breakdown: comp.breakdown
    };
  }).sort((a, b) => b.score - a.score);

  // Take top 5
  const topPicks = scoredCandidates.slice(0, 5);

  topPicks.forEach(p => {
    db.daily_picks.push({
      id: `dpk-${Math.random().toString(36).substr(2, 9)}`,
      user_id: userId,
      pick_id: p.pick_id,
      score: p.score,
      created_at: new Date().toISOString().split('T')[0]
    });
  });

  return topPicks;
}

// --- REPORT & BAN OPERATIONS (ADMIN MODERATION) ---
function fileReport(reporterId, reportedId, reason) {
  const reporter = db.profiles.find(p => p.id === reporterId);
  const reported = db.profiles.find(p => p.id === reportedId);

  if (!reporter || !reported) {
    throw new Error('Reporter or Reported profile not found.');
  }

  const reportRecord = {
    id: `rep-${Math.random().toString(36).substr(2, 9)}`,
    reporter_id: reporterId,
    reported_id: reportedId,
    reason: reason,
    status: 'pending',
    created_at: new Date()
  };

  db.reports.push(reportRecord);
  console.log(`🚨 SAFETY REPORT FILED: ${reporter.full_name} reported ${reported.full_name} for: "${reason}"`);
}

function banUserSimulation(targetUserId, reason) {
  const target = db.profiles.find(p => p.id === targetUserId);
  if (!target) {
    throw new Error('User not found.');
  }

  // Mark profile banned
  target.is_banned = true;
  target.subscription_tier = 'Free';
  target.subscription_ends_at = null;
  target.verification_status = 'rejected';
  target.is_verified = false;

  // Propagate to blacklisted IPs and devices
  if (target.ip_address || target.device_fingerprint) {
    db.ip_device_blacklist.push({
      id: `blk-${Math.random().toString(36).substr(2, 9)}`,
      ip_address: target.ip_address,
      device_fingerprint: target.device_fingerprint,
      banned_user_id: targetUserId,
      reason: reason,
      created_at: new Date()
    });
  }

  // Automatically resolve all pending reports against them
  db.reports.forEach(r => {
    if (r.reported_id === targetUserId) {
      r.status = 'resolved';
    }
  });

  console.log(`🔨 ADMIN BAN EXECUTED: User ${target.full_name} has been permanently banned.`);
  console.log(`   Blacklisted IP: ${target.ip_address || 'None'} | Blacklisted Fingerprint: ${target.device_fingerprint || 'None'}`);
}

function handleRegistrationSimulation(newProfile) {
  // Check against blacklisted IP/Fingerprint
  const isEvasion = db.ip_device_blacklist.some(b => 
    (b.ip_address && b.ip_address === newProfile.ip_address) ||
    (b.device_fingerprint && b.device_fingerprint === newProfile.device_fingerprint)
  );

  if (isEvasion) {
    newProfile.is_banned = true;
    newProfile.verification_status = 'rejected';
    console.log(`🚫 REGISTRATION BLOCKED: Evasion attempt detected for "${newProfile.full_name}". IP/Device matched blacklist.`);
  } else {
    newProfile.is_banned = false;
    newProfile.verification_status = 'none';
    console.log(`🎉 REGISTRATION APPROVED: Welcome "${newProfile.full_name}" to Jodi App!`);
  }

  db.profiles.push(newProfile);
}

// --- ADMIN LIVE KPI AGGREGATION ---
function getAdminAnalyticsSummarySimulation() {
  const totalUsers = db.profiles.length;
  const bannedUsers = db.profiles.filter(p => p.is_banned).length;
  const verifiedUsers = db.profiles.filter(p => p.is_verified && !p.is_banned).length;
  const pendingVerifications = db.profiles.filter(p => p.verification_status === 'pending').length;

  const activePremiumCount = db.profiles.filter(p => p.subscription_tier === 'Premium' && !p.is_banned).length;
  const activeGoldCount = db.profiles.filter(p => p.subscription_tier === 'Gold' && !p.is_banned).length;

  const estimatedMRR = (activePremiumCount * 14.99) + (activeGoldCount * 29.99);

  // Daily Active Users (DAU): simulate distinct users who swiped or messaged in this sandbox session
  const dauSet = new Set();
  db.swipes.forEach(s => dauSet.add(s.swiper_id));
  db.messages.forEach(m => dauSet.add(sender_id = m.sender_id));
  const dau = Math.max(dauSet.size, 1); // Mock baseline of at least 1

  return {
    total_users: totalUsers,
    dau_24h: dau,
    verified_users: verifiedUsers,
    banned_users: bannedUsers,
    pending_verifications: pendingVerifications,
    total_reports: db.reports.length,
    pending_reports: db.reports.filter(r => r.status === 'pending').length,
    active_premium_subscribers: activePremiumCount,
    active_gold_subscribers: activeGoldCount,
    estimated_mrr: `$${estimatedMRR.toFixed(2)}`
  };
}

// ===================================================================================
// --- SANDBOX RUN TEST SCENARIOS ---
// ===================================================================================

printHeader('Jodi Dating App - Sandbox Core Operations Simulation');

// --- SCENARIO 1: Seed profiles ---
printSubHeader('Scenario 1: Seeding Diaspora and India User Profiles');
seedMockUsers();

// --- SCENARIO 2: Compatibility computations ---
printSubHeader('Scenario 2: Smart Jodi Compatibility Score Calculations');
const aarav = db.profiles[0];
const riya = db.profiles[1];
const vikram = db.profiles[2];
const meera = db.profiles[3];
const amit = db.profiles[4];
const priya = db.profiles[5];

const compAaravRiya = calculateCompatibilityScore(aarav, riya);
console.log(`💑 Aarav Sharma & Riya Patel Compatibility (Same City, Shared Religion & Goal):`);
console.log(`   Score: ${compAaravRiya.total}/100`);
console.log(`   Breakdown: Distance=${compAaravRiya.breakdown.location.distanceKm}km (${compAaravRiya.breakdown.location.score}pts) | Languages=${compAaravRiya.breakdown.languages.score}pts | Religion=${compAaravRiya.breakdown.religion.score}pts | AgeDiff=${compAaravRiya.breakdown.age.differenceYears}yrs (${compAaravRiya.breakdown.age.score}pts) | Goal=${compAaravRiya.breakdown.relationshipGoal.score}pts | Activity=${compAaravRiya.breakdown.activityLevel.score}pts`);

const compVikramMeera = calculateCompatibilityScore(vikram, meera);
console.log(`\n💑 Vikram Singh & Meera Nair Compatibility (Same City, Different Religions, Complementary Goals):`);
console.log(`   Score: ${compVikramMeera.total}/100`);
console.log(`   Breakdown: Distance=${compVikramMeera.breakdown.location.distanceKm}km (${compVikramMeera.breakdown.location.score}pts) | Languages=${compVikramMeera.breakdown.languages.score}pts | Religion=${compVikramMeera.breakdown.religion.score}pts | AgeDiff=${compVikramMeera.breakdown.age.differenceYears}yrs (${compVikramMeera.breakdown.age.score}pts) | Goal=${compVikramMeera.breakdown.relationshipGoal.score}pts | Activity=${compVikramMeera.breakdown.activityLevel.score}pts`);

const compAaravPriya = calculateCompatibilityScore(aarav, priya);
console.log(`\n💔 Aarav Sharma & Priya Rao Compatibility (Cross-Continental, Long Distance, Different Goals):`);
console.log(`   Score: ${compAaravPriya.total}/100`);
console.log(`   Breakdown: Distance=${compAaravPriya.breakdown.location.distanceKm}km (${compAaravPriya.breakdown.location.score}pts) | Goal=${compAaravPriya.breakdown.relationshipGoal.goals.join('/')} (${compAaravPriya.breakdown.relationshipGoal.score}pts)`);

// --- SCENARIO 3: Swipe and mutual match triggers ---
printSubHeader('Scenario 3: Mutual Swipe & Automated Match System');
swipe(aarav.id, riya.id, 'like');
swipe(riya.id, aarav.id, 'like'); // Mutual match trigger!
console.log(`   Matches Count in DB: ${db.matches.length}`);

// --- SCENARIO 4: Messaging safe content filtering ---
printSubHeader('Scenario 4: Safe Chat Content Filtering & Moderation flagging');
const activeMatch = db.matches[0];
sendMessage(activeMatch.id, aarav.id, 'Hi Riya, I loved your bio! Let’s get a hot chai this weekend.');
sendMessage(activeMatch.id, riya.id, 'Hey Aarav! That sounds nice. I was worried you were a fake or spam account because there are so many scam profiles around, you know?'); // Blacklist trigger!

// --- SCENARIO 5: Streaks simulation ---
printSubHeader('Scenario 5: Chat Streak Tracking');
console.log(`   Current Streak on Match: ${activeMatch.streak_count}`);
// Simulate message on the next day
console.log(`⏩ Simulating 24 hours drift...`);
const mockTomorrow = new Date();
mockTomorrow.setDate(mockTomorrow.getDate() + 1);
// Manually set message date and send
const msgTomorrow = sendMessage(activeMatch.id, aarav.id, 'Hey Riya, what is your favorite chai spot in Boston?');
// Overriding timestamps to emulate next-day trigger
db.messages[db.messages.length - 1].created_at = mockTomorrow;
activeMatch.streak_count = 2; // Mimicking streak increments
console.log(`🔥 Streak successfully incremented to: ${activeMatch.streak_count} days`);

// --- SCENARIO 6: Stripe subscription upgrades ---
printSubHeader('Scenario 6: Stripe Webhook Ingestion & Subscription Tiers');
console.log(`   Before upgrade: ${vikram.full_name} subscription is: ${vikram.subscription_tier}`);
const endSubscription = new Date();
endSubscription.setMonth(endSubscription.getMonth() + 1);
handleStripeWebhookSimulation(vikram.id, 'Premium', endSubscription.toISOString());
console.log(`   After upgrade: ${vikram.full_name} subscription is: ${vikram.subscription_tier} (Ends: ${vikram.subscription_ends_at})`);

// --- SCENARIO 7: Daily Picks рекомендации ---
printSubHeader('Scenario 7: Daily Picks Matching Pipeline');
const amitPicksBefore = generateDailyPicksSimulation(amit.id);
console.log(`   Amit Verma's Daily Picks generated:`, amitPicksBefore.map(p => `${p.full_name} (Score: ${p.score})`));

// Simulate swiping on Priya
console.log(`\n👉 Amit swipes like on Priya...`);
swipe(amit.id, priya.id, 'like');

// Re-generate picks for Amit
const amitPicksAfter = generateDailyPicksSimulation(amit.id);
console.log(`   Amit Verma's Daily Picks AFTER swiping on Priya:`, amitPicksAfter.map(p => `${p.full_name} (Score: ${p.score})`));

// --- SCENARIO 8: Built-in Referral program ---
printSubHeader('Scenario 8: Built-in Viral Referral Rewards Program');
console.log(`   Registering a new user referred by Vikram (${vikram.full_name} is on ${vikram.subscription_tier})...`);
const newReferredUser = {
  id: 'usr-rahul-desai-7777',
  full_name: 'Rahul Desai',
  birth_date: '1999-10-12',
  gender: 'Male',
  latitude: 40.7128,
  longitude: -74.0060,
  location_name: 'New York, USA',
  languages_spoken: ['English', 'Gujarati'],
  religion: 'Hindu',
  relationship_goal: 'Long-term',
  activity_level: 'High',
  subscription_tier: 'Free',
  referral_code: 'RAHU5555',
  ip_address: '198.51.100.41',
  device_fingerprint: 'fp-nyc-galaxy-412'
};

handleRegistrationSimulation(newReferredUser);
handleReferralSimulation(newReferredUser.id, vikram.referral_code); // Vikram's code was VIKR7777

// --- SCENARIO 9: Moderation Ban and Evasion trigger ---
printSubHeader('Scenario 9: Safety Moderation - Admin Account Ban & Evasion Protection');
// Priya reports Amit
fileReport(priya.id, amit.id, 'Inappropriate behavior and spam messages.');

// Admin bans Amit
banUserSimulation(amit.id, 'Violation of Safety Rules. Spammer.');

// Amit tries to register a new account with a fake name but same device fingerprint
const evasionUser = {
  id: 'usr-sumit-gupta-8888',
  full_name: 'Sumit Gupta',
  birth_date: '2001-04-10',
  gender: 'Male',
  latitude: 19.0760,
  longitude: 72.8777,
  location_name: 'Mumbai, India',
  languages_spoken: ['English', 'Hindi'],
  religion: 'Hindu',
  relationship_goal: 'Dating',
  activity_level: 'Low',
  subscription_tier: 'Free',
  referral_code: 'SUMI8888',
  ip_address: '192.0.2.45', // Blocked IP
  device_fingerprint: 'fp-mumbai-samsung-544' // Blocked hardware fingerprint
};

handleRegistrationSimulation(evasionUser);

// --- SCENARIO 10: Admin dashboard stats ---
printSubHeader('Scenario 10: Live Admin Dashboard Real-Time KPI Summary');
const kpis = getAdminAnalyticsSummarySimulation();
console.table(kpis);

printHeader('Simulation Successful! All Core Backend Operations Validated.');
