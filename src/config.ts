// Jodi App - Environment Configuration
// Provides Supabase credentials and mock detection

// Supabase configuration from environment variables
// In Expo, env vars must be prefixed with EXPO_PUBLIC_ to be exposed to client code
export const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";

export const SUPABASE_ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "placeholder-key";

// Flag to determine if we're using real Supabase or mock data
// IS_MOCK is true when EXPO_PUBLIC_SUPABASE_URL is not set (or still the placeholder)
export const IS_MOCK =
  !process.env.EXPO_PUBLIC_SUPABASE_URL ||
  process.env.EXPO_PUBLIC_SUPABASE_URL === "https://placeholder.supabase.co";

// Helper to log the current mode
export const BACKEND_MODE: "real" | "mock" = IS_MOCK ? "mock" : "real";

// Export for use in API layer and components
export default {
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  IS_MOCK,
  BACKEND_MODE,
};