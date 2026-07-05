// Jodi App - Mock API Service
// Provides mock data and services for development/testing

import {
  Profile,
  SwipeCardData,
  Match,
  Message,
  DailyPick,
  OnboardingData,
  DefaultOnboardingData,
  BoostEvent,
  Report,
} from "../types";
import { IS_MOCK } from "../config";

// ============ Mock Profiles ============

const mockProfiles: Profile[] = [
  {
    id: "prof-001",
    created_at: "2025-01-15T10:30:00Z",
    updated_at: "2025-06-20T14:00:00Z",
    full_name: "Priya Sharma",
    birth_date: "1996-05-12",
    gender: "Female",
    latitude: 28.6139,
    longitude: 77.209,
    location_name: "New Delhi, India",
    occupation: "Software Engineer",
    education: "IIT Delhi",
    height_cm: 163,
    diet: "Veg",
    smoking_pref: "Non-smoker",
    drinking_pref: "Social drinker",
    languages_spoken: ["Hindi", "English", "Punjabi"],
    religion: "Hindu",
    caste: "General",
    relationship_goal: "Marriage",
    family_values: "Moderate",
    immigration_status: "Citizen",
    activity_level: "Moderate",
    bio: "A coffee enthusiast who loves classical music and weekend getaways. Looking for someone who values family traditions while embracing modern life.",
    photos: [
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400",
      "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400",
      "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400",
    ],
    is_verified: true,
    verification_status: "approved",
    is_banned: false,
    subscription_tier: "Premium",
    referral_code: "PRIYA05",
    daily_swipes_count: 8,
    last_swipe_reset_at: "2025-06-21T00:00:00Z",
  },
  {
    id: "prof-002",
    created_at: "2025-02-10T08:00:00Z",
    updated_at: "2025-06-19T16:30:00Z",
    full_name: "Arjun Patel",
    birth_date: "1994-08-23",
    gender: "Male",
    latitude: 40.7128,
    longitude: -74.006,
    location_name: "New York, USA",
    occupation: "Investment Banker",
    education: "Wharton School",
    height_cm: 180,
    diet: "Non-Veg",
    smoking_pref: "Non-smoker",
    drinking_pref: "Regular drinker",
    languages_spoken: ["English", "Hindi", "Gujarati"],
    religion: "Hindu",
    caste: "Patel",
    relationship_goal: "Dating",
    family_values: "Liberal",
    immigration_status: "Citizen",
    activity_level: "High",
    bio: "Finance by day, explorer by night. Love hitting the gym, trying new restaurants, and planning my next travel adventure.",
    photos: [
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400",
      "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400",
      "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400",
    ],
    is_verified: true,
    verification_status: "approved",
    is_banned: false,
    subscription_tier: "Gold",
    referral_code: "ARJUN23",
    daily_swipes_count: 15,
    last_swipe_reset_at: "2025-06-21T00:00:00Z",
  },
  {
    id: "prof-003",
    created_at: "2025-03-05T12:00:00Z",
    updated_at: "2025-06-20T10:00:00Z",
    full_name: "Ananya Krishnan",
    birth_date: "1997-11-30",
    gender: "Female",
    latitude: 12.9716,
    longitude: 77.5946,
    location_name: "Bangalore, India",
    occupation: "Product Designer",
    education: "NID Ahmedabad",
    height_cm: 168,
    diet: "Eggetarian",
    smoking_pref: "Non-smoker",
    drinking_pref: "Social drinker",
    languages_spoken: ["Malayalam", "English", "Hindi", "Tamil"],
    religion: "Hindu",
    caste: "Nair",
    relationship_goal: "Long-term",
    family_values: "Moderate",
    immigration_status: "Citizen",
    activity_level: "Moderate",
    bio: "Designing beautiful experiences by day, painting sunsets by weekend. Love dogs, good cinema, and deep conversations over chai.",
    photos: [
      "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=400",
      "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=400",
      "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400",
    ],
    is_verified: true,
    verification_status: "approved",
    is_banned: false,
    subscription_tier: "Free",
    referral_code: "ANANYA30",
    daily_swipes_count: 3,
    last_swipe_reset_at: "2025-06-21T00:00:00Z",
  },
  {
    id: "prof-004",
    created_at: "2025-01-20T09:00:00Z",
    updated_at: "2025-06-18T18:00:00Z",
    full_name: "Vikram Singh Rathore",
    birth_date: "1993-03-15",
    gender: "Male",
    latitude: 51.5074,
    longitude: -0.1278,
    location_name: "London, UK",
    occupation: "Management Consultant",
    education: "LSE",
    height_cm: 185,
    diet: "Non-Veg",
    smoking_pref: "Non-smoker",
    drinking_pref: "Social drinker",
    languages_spoken: ["English", "Hindi", "French"],
    religion: "Sikh",
    caste: "Jatt",
    relationship_goal: "Marriage",
    family_values: "Traditional",
    immigration_status: "Work Permit",
    activity_level: "High",
    bio: "Strategy consultant passionate about cricket, polo, and fine dining. Looking for a partner who shares my ambition and love for life.",
    photos: [
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400",
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400",
      "https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=400",
    ],
    is_verified: true,
    verification_status: "approved",
    is_banned: false,
    subscription_tier: "Premium",
    referral_code: "VIKRAM15",
    daily_swipes_count: 12,
    last_swipe_reset_at: "2025-06-21T00:00:00Z",
  },
  {
    id: "prof-005",
    created_at: "2025-04-01T14:00:00Z",
    updated_at: "2025-06-20T08:00:00Z",
    full_name: "Zara Sheikh",
    birth_date: "1998-07-19",
    gender: "Female",
    latitude: 19.076,
    longitude: 72.8777,
    location_name: "Mumbai, India",
    occupation: "Fashion Designer",
    education: "NIFT Mumbai",
    height_cm: 170,
    diet: "Vegan",
    smoking_pref: "Non-smoker",
    drinking_pref: "Non-drinker",
    languages_spoken: ["Urdu", "English", "Hindi", "Marathi"],
    religion: "Muslim",
    relationship_goal: "Dating",
    family_values: "Liberal",
    immigration_status: "Citizen",
    activity_level: "Low",
    bio: "Creating sustainable fashion that tells stories. Love poetry, indie music, and finding hidden gems in the city.",
    photos: [
      "https://images.unsplash.com/photo-1489424731084-a5d8b219a5bb?w=400",
      "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=400",
      "https://images.unsplash.com/photo-1519631128182-433895475540?w=400",
    ],
    is_verified: false,
    verification_status: "pending",
    is_banned: false,
    subscription_tier: "Free",
    referral_code: "ZARA19",
    daily_swipes_count: 20,
    last_swipe_reset_at: "2025-06-21T00:00:00Z",
  },
  {
    id: "prof-006",
    created_at: "2025-05-10T11:00:00Z",
    updated_at: "2025-06-19T20:00:00Z",
    full_name: "Rohan Mehta",
    birth_date: "1995-12-05",
    gender: "Male",
    latitude: 34.0522,
    longitude: -118.2437,
    location_name: "Los Angeles, USA",
    occupation: "Film Director",
    education: "NYU Tisch",
    height_cm: 178,
    diet: "Non-Veg",
    smoking_pref: "Light smoker",
    drinking_pref: "Regular drinker",
    languages_spoken: ["English", "Hindi", "Spanish"],
    religion: "Hindu",
    relationship_goal: "Long-term",
    family_values: "Liberal",
    immigration_status: "PR",
    activity_level: "Moderate",
    bio: "Storyteller through film. Love indie cinema, road trips, and cooking Italian food. Looking for my co-writer in life.",
    photos: [
      "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400",
      "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400",
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400",
    ],
    is_verified: true,
    verification_status: "approved",
    is_banned: false,
    subscription_tier: "Gold",
    referral_code: "ROHAN05",
    daily_swipes_count: 0,
    last_swipe_reset_at: "2025-06-21T00:00:00Z",
  },
];

// ============ Mock API Functions ============

// Simulate API delay
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const apiDelay = () => delay(400 + Math.random() * 600);

// Returns true when real Supabase backend is configured
// Mock API will still be used as fallback; this informs components
export function isUsingRealBackend(): boolean {
  return !IS_MOCK;
}

// In-memory data store
let currentUserProfile: Profile = {
  ...mockProfiles[2],
  id: "current-user",
  full_name: "",
};

let allProfiles: Profile[] = [...mockProfiles];

let mockSwipes: Array<{ swiper_id: string; swiped_id: string; type: string }> =
  [];

let mockMatches: Match[] = [
  {
    id: "match-001",
    user1_id: "current-user",
    user2_id: "prof-001",
    compatibility_score: 82,
    streak_count: 3,
    last_message_at: "2025-06-20T22:00:00Z",
    created_at: "2025-06-15T10:00:00Z",
  },
  {
    id: "match-002",
    user1_id: "current-user",
    user2_id: "prof-004",
    compatibility_score: 75,
    streak_count: 1,
    last_message_at: "2025-06-19T14:30:00Z",
    created_at: "2025-06-18T09:00:00Z",
  },
];

let mockMessages: Record<string, Message[]> = {
  "match-001": [
    {
      id: "msg-001",
      match_id: "match-001",
      sender_id: "current-user",
      content: "Hey Priya! I loved your bio - we seem to share a lot of interests. What's your favorite coffee spot?",
      is_read: true,
      is_flagged: false,
      created_at: "2025-06-15T10:30:00Z",
    },
    {
      id: "msg-002",
      match_id: "match-001",
      sender_id: "prof-001",
      content: "Hi! Thank you! I'm a big fan of Blue Tokai, especially their outlets in Delhi. You?",
      is_read: true,
      is_flagged: false,
      created_at: "2025-06-15T11:00:00Z",
    },
    {
      id: "msg-003",
      match_id: "match-001",
      sender_id: "current-user",
      content: "Great choice! I love their pour-overs. Have you tried their signature blend?",
      is_read: true,
      is_flagged: false,
      created_at: "2025-06-16T09:00:00Z",
    },
    {
      id: "msg-004",
      match_id: "match-001",
      sender_id: "prof-001",
      content: "Yes! That's my favorite. Also, love that you're into classical music too - who's your favorite composer?",
      is_read: true,
      is_flagged: false,
      created_at: "2025-06-16T10:15:00Z",
    },
    {
      id: "msg-005",
      match_id: "match-001",
      sender_id: "current-user",
      content: "I've been listening to a lot of Ravi Shankar lately. His sitar concerts are magical. What about you?",
      is_read: false,
      is_flagged: false,
      created_at: "2025-06-20T22:00:00Z",
    },
  ],
  "match-002": [
    {
      id: "msg-006",
      match_id: "match-002",
      sender_id: "prof-004",
      content: "Hello! I saw you're in Bangalore - lovely city! I'm planning a trip there soon.",
      is_read: true,
      is_flagged: false,
      created_at: "2025-06-18T11:00:00Z",
    },
    {
      id: "msg-007",
      match_id: "match-002",
      sender_id: "current-user",
      content: "Hey Vikram! Yes, Bangalore is amazing this time of year. Let me know if you need recommendations!",
      is_read: true,
      is_flagged: false,
      created_at: "2025-06-18T14:00:00Z",
    },
  ],
};

let mockDailyPicks: DailyPick[] = [
  {
    id: "pick-001",
    user_id: "current-user",
    pick_id: "prof-001",
    score: 92,
    created_at: "2025-06-21T00:00:00Z",
  },
  {
    id: "pick-002",
    user_id: "current-user",
    pick_id: "prof-003",
    score: 88,
    created_at: "2025-06-21T00:00:00Z",
  },
  {
    id: "pick-003",
    user_id: "current-user",
    pick_id: "prof-006",
    score: 85,
    created_at: "2025-06-21T00:00:00Z",
  },
  {
    id: "pick-004",
    user_id: "current-user",
    pick_id: "prof-004",
    score: 79,
    created_at: "2025-06-21T00:00:00Z",
  },
  {
    id: "pick-005",
    user_id: "current-user",
    pick_id: "prof-005",
    score: 76,
    created_at: "2025-06-21T00:00:00Z",
  },
];

let mockReports: Report[] = [
  {
    id: "rpt-001",
    reporter_id: "prof-001",
    reported_id: "prof-003",
    reason: "Inappropriate messages",
    status: "pending",
    created_at: "2025-06-20T15:00:00Z",
  },
  {
    id: "rpt-002",
    reporter_id: "prof-002",
    reported_id: "prof-005",
    reason: "Fake profile",
    status: "pending",
    created_at: "2025-06-21T08:00:00Z",
  },
];

let mockBoostEvents: BoostEvent[] = [
  {
    id: "boost-001",
    title: "Sunday Evening Boost",
    starts_at: "2025-06-21T18:00:00Z",
    ends_at: "2025-06-21T22:00:00Z",
    is_active: true,
  },
  {
    id: "boost-002",
    title: "Weekend Peak Hours",
    starts_at: "2025-06-22T10:00:00Z",
    ends_at: "2025-06-22T14:00:00Z",
    is_active: false,
  },
];

// ============ Calculate Compatibility Score ============

function calculateCompatibility(a: Profile, b: Profile): number {
  let score = 0;

  // 1. Location Proximity (25 pts) - Simplified
  const latDiff = Math.abs(a.latitude - b.latitude);
  const lonDiff = Math.abs(a.longitude - b.longitude);
  const roughKm = (latDiff + lonDiff) * 111;
  if (roughKm < 20) score += 25;
  else if (roughKm < 50) score += 20;
  else if (roughKm < 150) score += 15;
  else score += 5;

  // 2. Language (20 pts)
  const langOverlap = a.languages_spoken.filter((l) =>
    b.languages_spoken.includes(l)
  ).length;
  const totalUnique = new Set([...a.languages_spoken, ...b.languages_spoken])
    .size;
  const langRatio = langOverlap / totalUnique;
  if (langRatio >= 1) score += 20;
  else if (langRatio > 0.3) score += 12;
  else score += 0;

  // 3. Religion (15 pts)
  if (a.religion === b.religion) score += 15;

  // 4. Age (15 pts)
  const ageA = new Date().getFullYear() - new Date(a.birth_date).getFullYear();
  const ageB = new Date().getFullYear() - new Date(b.birth_date).getFullYear();
  const ageDiff = Math.abs(ageA - ageB);
  if (ageDiff <= 2) score += 15;
  else if (ageDiff <= 5) score += 10;
  else if (ageDiff <= 8) score += 5;
  else score += 0;

  // 5. Relationship Goals (15 pts)
  if (a.relationship_goal === b.relationship_goal) score += 15;
  else if (
    (a.relationship_goal === "Marriage" && b.relationship_goal === "Long-term") ||
    (a.relationship_goal === "Long-term" && b.relationship_goal === "Marriage")
  )
    score += 8;

  // 6. Activity Level (10 pts)
  if (a.activity_level === b.activity_level) score += 10;
  else if (
    (a.activity_level === "High" && b.activity_level === "Moderate") ||
    (a.activity_level === "Moderate" && b.activity_level === "High")
  )
    score += 5;
  else score += 0;

  return score;
}

// ============ Public API Functions ============

export async function fetchSwipeCards(): Promise<SwipeCardData[]> {
  await apiDelay();

  // Filter out already swiped and current user
  const swipedIds = new Set(
    mockSwipes
      .filter((s) => s.swiper_id === "current-user")
      .map((s) => s.swiped_id)
  );
  swipedIds.add("current-user");

  const available = allProfiles.filter((p) => !swipedIds.has(p.id));

  return available.map((profile) => ({
    profile,
    distance_km: Math.round(
      (Math.abs(profile.latitude - 12.9716) +
        Math.abs(profile.longitude - 77.5946)) *
        111 *
        0.6
    ),
    compatibility_score: calculateCompatibility(currentUserProfile, profile),
    compatibility_breakdown: {
      location:
        Math.abs(currentUserProfile.latitude - profile.latitude) < 0.18
          ? 25
          : 15,
      language:
        currentUserProfile.languages_spoken.filter((l) =>
          profile.languages_spoken.includes(l)
        ).length > 0
          ? 20
          : 0,
      religion:
        currentUserProfile.religion === profile.religion ? 15 : 0,
      age:
        Math.abs(
          new Date().getFullYear() -
            new Date(currentUserProfile.birth_date).getFullYear() -
            (new Date().getFullYear() -
              new Date(profile.birth_date).getFullYear())
        ) <= 2
          ? 15
          : 10,
      relationship_goal:
        currentUserProfile.relationship_goal === profile.relationship_goal
          ? 15
          : 8,
      activity_level:
        currentUserProfile.activity_level === profile.activity_level ? 10 : 5,
    },
  }));
}

export async function submitSwipe(
  swiped_id: string,
  type: "like" | "dislike" | "super_like"
): Promise<{ is_match: boolean; match_id?: string }> {
  await apiDelay();

  mockSwipes.push({
    swiper_id: "current-user",
    swiped_id,
    type,
  });

  // Simulate match logic (reciprocal "like" check)
  const hasReciprocalLike = mockSwipes.some(
    (s) => s.swiper_id === swiped_id && s.swiped_id === "current-user"
  );

  if (type === "like" && hasReciprocalLike) {
    const matchId = `match-${Date.now()}`;
    mockMatches.push({
      id: matchId,
      user1_id: "current-user",
      user2_id: swiped_id,
      compatibility_score: Math.floor(Math.random() * 30) + 60,
      streak_count: 0,
      last_message_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    });
    return { is_match: true, match_id: matchId };
  }

  return { is_match: false };
}

export async function fetchMatches(): Promise<Match[]> {
  await apiDelay();
  return mockMatches.filter(
    (m) => m.user1_id === "current-user" || m.user2_id === "current-user"
  );
}

export async function fetchMessages(
  matchId: string
): Promise<Message[]> {
  await apiDelay();
  return mockMessages[matchId] || [];
}

export async function sendMessage(
  matchId: string,
  content: string
): Promise<Message> {
  await apiDelay();
  const newMsg: Message = {
    id: `msg-${Date.now()}`,
    match_id: matchId,
    sender_id: "current-user",
    content,
    is_read: false,
    is_flagged: false,
    created_at: new Date().toISOString(),
  };

  if (!mockMessages[matchId]) {
    mockMessages[matchId] = [];
  }
  mockMessages[matchId].push(newMsg);

  // Update match streak and last_message_at
  const match = mockMatches.find((m) => m.id === matchId);
  if (match) {
    match.last_message_at = newMsg.created_at;
  }

  return newMsg;
}

export async function fetchDailyPicks(): Promise<DailyPick[]> {
  await apiDelay();
  return mockDailyPicks;
}

export async function updateProfile(
  data: Partial<OnboardingData>
): Promise<Profile> {
  await apiDelay();
  currentUserProfile = {
    ...currentUserProfile,
    full_name: data.full_name || currentUserProfile.full_name,
    birth_date: data.birth_date || currentUserProfile.birth_date,
    gender: data.gender || currentUserProfile.gender,
    location_name:
      data.location_name || currentUserProfile.location_name,
    occupation: data.occupation || currentUserProfile.occupation,
    education: data.education || currentUserProfile.education,
    height_cm: data.height_cm
      ? parseFloat(data.height_cm)
      : currentUserProfile.height_cm,
    diet: data.diet || currentUserProfile.diet,
    smoking_pref: data.smoking_pref || currentUserProfile.smoking_pref,
    drinking_pref: data.drinking_pref || currentUserProfile.drinking_pref,
    languages_spoken:
      data.languages_spoken.length > 0
        ? data.languages_spoken
        : currentUserProfile.languages_spoken,
    religion: data.religion || currentUserProfile.religion,
    caste: data.caste || currentUserProfile.caste,
    relationship_goal:
      data.relationship_goal || currentUserProfile.relationship_goal,
    family_values: data.family_values || currentUserProfile.family_values,
    immigration_status:
      data.immigration_status || currentUserProfile.immigration_status,
    activity_level:
      data.activity_level || currentUserProfile.activity_level,
    bio: data.bio || currentUserProfile.bio,
    photos: data.photos.length > 0 ? data.photos : currentUserProfile.photos,
  };
  return currentUserProfile;
}

export async function fetchCurrentProfile(): Promise<Profile> {
  await apiDelay();
  return currentUserProfile;
}

// Get a profile by ID (for displaying matched user info)
export function getProfileById(id: string): Profile | undefined {
  return allProfiles.find((p) => p.id === id);
}

export async function fetchMatchedProfiles(): Promise<(Match & { matchedProfile: Profile })[]> {
  await apiDelay();
  const userMatches = mockMatches.filter(
    (m) => m.user1_id === "current-user" || m.user2_id === "current-user"
  );
  return userMatches.map((match) => {
    const matchedUserId =
      match.user1_id === "current-user" ? match.user2_id : match.user1_id;
    const profile = getProfileById(matchedUserId);
    return {
      ...match,
      matchedProfile: profile || allProfiles[0],
    };
  });
}

export async function fetchBoostEvents(): Promise<BoostEvent[]> {
  await apiDelay();
  return mockBoostEvents;
}

export async function fetchReports(): Promise<Report[]> {
  await apiDelay();
  return mockReports;
}

export async function generateIcebreaker(
  matchId: string
): Promise<string> {
  await apiDelay();
  const icebreakers = [
    "What's the one dish that instantly reminds you of home?",
    "If you could travel anywhere in India tomorrow, where would you go?",
    "What's your favorite festival celebration memory?",
    "Do you prefer a quiet chai date or an adventurous trek?",
    "What's the best book or movie you've experienced recently?",
    "If you could learn any new skill this year, what would it be?",
    "What's your go-to karaoke song?",
    "Describe your perfect Sunday in three words.",
    "What's something on your bucket list that surprises people?",
    "If you had to describe your family in one word, what would it be?",
  ];
  await delay(500);
  return icebreakers[Math.floor(Math.random() * icebreakers.length)];
}

export async function verifySelfie(
  uri: string
): Promise<{ success: boolean }> {
  await apiDelay();
  return { success: true };
}

export async function uploadPhoto(
  uri: string
): Promise<string> {
  await apiDelay();
  return `https://mock.storage/photo-${Date.now()}.jpg`;
}

export async function blockUser(userId: string): Promise<void> {
  await apiDelay();
  console.log(`[API] Blocked user: ${userId}`);
}

export async function reportUser(
  userId: string,
  reason: string
): Promise<void> {
  await apiDelay();
  console.log(`[API] Reported user: ${userId}, reason: ${reason}`);
}

export async function getAdminMetrics(): Promise<{
  totalUsers: number;
  dailyActiveUsers: number;
  subscriptionRevenue: number;
  pendingVerifications: number;
  pendingReports: number;
  premiumUsers: number;
  goldUsers: number;
  revenueHistory: Array<{ date: string; amount: number }>;
}> {
  await apiDelay();
  return {
    totalUsers: 12847,
    dailyActiveUsers: 4521,
    subscriptionRevenue: 78450,
    pendingVerifications: 23,
    pendingReports: 12,
    premiumUsers: 3421,
    goldUsers: 1289,
    revenueHistory: [
      { date: "Mon", amount: 2200 },
      { date: "Tue", amount: 2800 },
      { date: "Wed", amount: 3100 },
      { date: "Thu", amount: 2600 },
      { date: "Fri", amount: 3500 },
      { date: "Sat", amount: 4200 },
      { date: "Sun", amount: 3800 },
    ],
  };
}

export async function getVerificationQueue(): Promise<Profile[]> {
  await apiDelay();
  return allProfiles.filter((p) => p.verification_status === "pending");
}

export async function getReportedUsers(): Promise<Array<Report & { reportedProfile: Profile; reporterProfile: Profile }>> {
  await apiDelay();
  return mockReports.map((report) => ({
    ...report,
    reportedProfile: allProfiles.find((p) => p.id === report.reported_id) || allProfiles[0],
    reporterProfile: allProfiles.find((p) => p.id === report.reporter_id) || allProfiles[1],
  }));
}

export async function getUserManagementList(searchQuery?: string): Promise<Profile[]> {
  await apiDelay();
  if (!searchQuery) return allProfiles;
  const query = searchQuery.toLowerCase();
  return allProfiles.filter(
    (p) =>
      p.full_name.toLowerCase().includes(query) ||
      p.occupation?.toLowerCase().includes(query) ||
      p.location_name.toLowerCase().includes(query)
  );
}

export async function unbanUser(userId: string): Promise<void> {
  await apiDelay();
  const profile = allProfiles.find((p) => p.id === userId);
  if (profile) {
    profile.is_banned = false;
  }
  console.log(`[API] Unbanned user: ${userId}`);
}

export async function approveVerification(
  userId: string
): Promise<void> {
  await apiDelay();
  const profile = allProfiles.find((p) => p.id === userId);
  if (profile) {
    profile.is_verified = true;
    profile.verification_status = "approved";
  }
  console.log(`[API] Approved verification for: ${userId}`);
}

export async function rejectVerification(
  userId: string
): Promise<void> {
  await apiDelay();
  const profile = allProfiles.find((p) => p.id === userId);
  if (profile) {
    profile.is_verified = false;
    profile.verification_status = "rejected";
  }
  console.log(`[API] Rejected verification for: ${userId}`);
}

export async function banUser(userId: string): Promise<void> {
  await apiDelay();
  const profile = allProfiles.find((p) => p.id === userId);
  if (profile) {
    profile.is_banned = true;
  }
  console.log(`[API] Banned user: ${userId}`);
}

export async function resolveReport(reportId: string): Promise<void> {
  await apiDelay();
  console.log(`[API] Resolved report: ${reportId}`);
}

export const GenderOptions = [
  { label: "Male", value: "Male" },
  { label: "Female", value: "Female" },
  { label: "Non-binary", value: "Non-binary" },
  { label: "Other", value: "Other" },
];

export const DietOptions = [
  { label: "Vegetarian", value: "Veg" },
  { label: "Non-Vegetarian", value: "Non-Veg" },
  { label: "Eggetarian", value: "Eggetarian" },
  { label: "Vegan", value: "Vegan" },
];

export const SmokingOptions = [
  { label: "Non-smoker", value: "Non-smoker" },
  { label: "Light smoker", value: "Light smoker" },
  { label: "Regular smoker", value: "Regular smoker" },
];

export const DrinkingOptions = [
  { label: "Non-drinker", value: "Non-drinker" },
  { label: "Social drinker", value: "Social drinker" },
  { label: "Regular drinker", value: "Regular drinker" },
];

export const RelationshipGoalOptions = [
  { label: "Marriage", value: "Marriage" },
  { label: "Dating", value: "Dating" },
  { label: "Long-term", value: "Long-term" },
];

export const FamilyValuesOptions = [
  { label: "Traditional", value: "Traditional" },
  { label: "Moderate", value: "Moderate" },
  { label: "Liberal", value: "Liberal" },
];

export const ImmigrationStatusOptions = [
  { label: "Citizen", value: "Citizen" },
  { label: "Permanent Resident", value: "PR" },
  { label: "Student Visa", value: "Student Visa" },
  { label: "Work Permit", value: "Work Permit" },
  { label: "Other", value: "Other" },
];

export const ActivityLevelOptions = [
  { label: "High (very active)", value: "High" },
  { label: "Moderate (some activity)", value: "Moderate" },
  { label: "Low (prefer relaxing)", value: "Low" },
];

export const ReligionOptions = [
  "Hindu",
  "Muslim",
  "Sikh",
  "Christian",
  "Jain",
  "Buddhist",
  "Jewish",
  "Parsi",
  "Spiritual",
  "Other",
];

export const LanguageOptions = [
  "Hindi",
  "English",
  "Bengali",
  "Telugu",
  "Marathi",
  "Tamil",
  "Urdu",
  "Gujarati",
  "Kannada",
  "Malayalam",
  "Odia",
  "Punjabi",
  "Assamese",
  "Maithili",
  "Santali",
  "Sanskrit",
  "Kashmiri",
  "Nepali",
  "Sindhi",
  "Konkani",
  "Dogri",
  "Manipuri",
  "Bodo",
  "French",
  "Spanish",
  "Arabic",
];