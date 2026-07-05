// Jodi App - Core TypeScript Types
// Mirrors the Supabase database schema defined in JODI_SPEC.md

export type VerificationStatus = "none" | "pending" | "approved" | "rejected";
export type SubscriptionTier = "Free" | "Premium" | "Gold";
export type DietType = "Veg" | "Non-Veg" | "Eggetarian" | "Vegan";
export type FamilyValues = "Traditional" | "Moderate" | "Liberal";
export type SwipeType = "like" | "dislike" | "super_like";
export type RelationshipGoal = "Marriage" | "Dating" | "Long-term";
export type ActivityLevel = "High" | "Moderate" | "Low";
export type ImmigrationStatus =
  | "Citizen"
  | "PR"
  | "Student Visa"
  | "Work Permit"
  | "Other";
export type ReportStatus = "pending" | "resolved" | "ignored";
export type GenderType = "Male" | "Female" | "Non-binary" | "Other";

export interface Profile {
  id: string;
  created_at: string;
  updated_at: string;
  full_name: string;
  birth_date: string;
  gender: GenderType;
  latitude: number;
  longitude: number;
  location_name: string;
  occupation?: string;
  education?: string;
  height_cm?: number;
  diet: DietType;
  smoking_pref?: string;
  drinking_pref?: string;
  languages_spoken: string[];
  religion: string;
  caste?: string;
  relationship_goal: RelationshipGoal;
  family_values: FamilyValues;
  immigration_status: ImmigrationStatus;
  activity_level: ActivityLevel;
  bio?: string;
  photos: string[];
  is_verified: boolean;
  selfie_url?: string;
  verification_status: VerificationStatus;
  is_banned: boolean;
  subscription_tier: SubscriptionTier;
  subscription_ends_at?: string;
  referral_code: string;
  referred_by?: string;
  daily_swipes_count: number;
  last_swipe_reset_at: string;
}

export interface Swipe {
  id: string;
  swiper_id: string;
  swiped_id: string;
  type: SwipeType;
  created_at: string;
}

export interface Match {
  id: string;
  user1_id: string;
  user2_id: string;
  compatibility_score: number;
  streak_count: number;
  last_message_at: string;
  created_at: string;
}

export interface Message {
  id: string;
  match_id: string;
  sender_id: string;
  content: string;
  is_read: boolean;
  is_flagged: boolean;
  created_at: string;
}

export interface Report {
  id: string;
  reporter_id: string;
  reported_id: string;
  reason: string;
  status: ReportStatus;
  created_at: string;
}

export interface Block {
  id: string;
  blocker_id: string;
  blocked_id: string;
  created_at: string;
}

export interface DailyPick {
  id: string;
  user_id: string;
  pick_id: string;
  score: number;
  created_at: string;
}

export interface BoostEvent {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  is_active: boolean;
}

export interface SwipeCardData {
  profile: Profile;
  distance_km: number;
  compatibility_score: number;
  compatibility_breakdown?: {
    location: number;
    language: number;
    religion: number;
    age: number;
    relationship_goal: number;
    activity_level: number;
  };
}

export interface OnboardingData {
  step: number;
  full_name: string;
  birth_date: string;
  gender: GenderType | null;
  location_name: string;
  photos: string[];
  bio: string;
  occupation: string;
  education: string;
  height_cm: string;
  diet: DietType | null;
  smoking_pref: string;
  drinking_pref: string;
  languages_spoken: string[];
  religion: string;
  caste: string;
  relationship_goal: RelationshipGoal | null;
  family_values: FamilyValues | null;
  immigration_status: ImmigrationStatus | null;
  activity_level: ActivityLevel | null;
}

export const DefaultOnboardingData: OnboardingData = {
  step: 0,
  full_name: "",
  birth_date: "",
  gender: null,
  location_name: "",
  photos: [],
  bio: "",
  occupation: "",
  education: "",
  height_cm: "",
  diet: null,
  smoking_pref: "Non-smoker",
  drinking_pref: "Non-drinker",
  languages_spoken: [],
  religion: "",
  caste: "",
  relationship_goal: null,
  family_values: null,
  immigration_status: null,
  activity_level: null,
};

export interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: Profile | null;
}

export interface SubscriptionPlan {
  tier: SubscriptionTier;
  price: number;
  features: string[];
  isPopular?: boolean;
}

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    tier: "Free",
    price: 0,
    features: [
      "20 daily swipes",
      "Basic matching",
      "Standard profile visibility",
    ],
  },
  {
    tier: "Premium",
    price: 14.99,
    isPopular: true,
    features: [
      "Unlimited swipes",
      "See Who Liked You",
      "Advanced filters",
      "Read receipts",
    ],
  },
  {
    tier: "Gold",
    price: 29.99,
    features: [
      "All Premium features",
      "Daily profile boosts",
      "Priority visibility",
      "Unlimited rewinds",
      "Premium Match Picks",
    ],
  },
];