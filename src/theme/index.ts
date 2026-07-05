// Jodi Design System - Indian-Inspired Premium Theme
// Colors, typography, spacing, and common styles

export const Colors = {
  // Primary brand colors
  primary: "#B85C2E", // Chai Brown
  primaryDark: "#9A4724",
  primaryLight: "#D07A42",

  // Accent colors
  accent: "#FFA000", // Saffron Gold
  accentLight: "#FFC966",
  accentDark: "#E68A00",

  // Secondary accent
  secondary: "#E85D3A", // Vermilion
  secondaryLight: "#FF7A5C",

  // Gold / Marigold
  gold: "#F5C518",
  goldLight: "#FFE666",

  // Sandalwood neutrals
  sandalwood: "#A88D3D",
  sandalwoodLight: "#CFBA84",

  // Backgrounds
  background: "#FFFCF5", // Cream white
  backgroundDark: "#F9F6F0",
  surface: "#FFFFFF",
  surfaceElevated: "#FFF8EB",

  // Text
  textPrimary: "#2D1810", // Deep brown-black
  textSecondary: "#6B5D4E",
  textTertiary: "#9E8D7A",
  textLight: "#FFFFFF",
  textOnPrimary: "#FFFFFF",

  // Feedback
  success: "#2D8A4E",
  error: "#CC4628",
  warning: "#E68A00",
  info: "#4A90D9",

  // Match colors
  likeGreen: "#2D8A4E",
  dislikeRed: "#CC4628",
  superLikeBlue: "#4A90D9",

  // Streak
  streak: "#FF6B35",
  streakActive: "#FF8C5A",

  // Borders
  border: "#F0E6D6",
  borderLight: "#F8F0E6",
  borderDark: "#E0D0BC",

  // Shadows
  shadow: "rgba(90, 60, 30, 0.12)",
  shadowLight: "rgba(90, 60, 30, 0.06)",
};

export const Typography = {
  // Heading styles
  h1: {
    fontSize: 34,
    fontWeight: "700" as const,
    lineHeight: 41,
    letterSpacing: -0.5,
  },
  h2: {
    fontSize: 28,
    fontWeight: "700" as const,
    lineHeight: 34,
    letterSpacing: -0.3,
  },
  h3: {
    fontSize: 24,
    fontWeight: "600" as const,
    lineHeight: 30,
  },
  h4: {
    fontSize: 20,
    fontWeight: "600" as const,
    lineHeight: 26,
  },

  // Body styles
  body: {
    fontSize: 16,
    fontWeight: "400" as const,
    lineHeight: 24,
  },
  bodyBold: {
    fontSize: 16,
    fontWeight: "600" as const,
    lineHeight: 24,
  },
  bodySmall: {
    fontSize: 14,
    fontWeight: "400" as const,
    lineHeight: 20,
  },
  caption: {
    fontSize: 12,
    fontWeight: "400" as const,
    lineHeight: 16,
  },

  // Special
  score: {
    fontSize: 18,
    fontWeight: "700" as const,
    lineHeight: 22,
  },
  label: {
    fontSize: 13,
    fontWeight: "600" as const,
    lineHeight: 18,
    letterSpacing: 0.5,
    textTransform: "uppercase" as const,
  },
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  xxxxl: 40,
};

export const BorderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
};

export const Shadows = {
  sm: {
    shadowColor: Colors.shadowLight,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 1,
    shadowRadius: 3,
    elevation: 2,
  },
  md: {
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 4,
  },
  lg: {
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 16,
    elevation: 8,
  },
  xl: {
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 24,
    elevation: 12,
  },
};

export const GradientColors = {
  primary: ["#B85C2E", "#D07A42"] as [string, string],
  accent: ["#FFA000", "#FFC966"] as [string, string],
  sunset: ["#B85C2E", "#E85D3A", "#FFA000"] as [string, string, string],
  card: ["rgba(0,0,0,0)", "rgba(0,0,0,0.6)"] as [string, string],
  gold: ["#F5C518", "#FFE666"] as [string, string],
};