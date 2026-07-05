// Jodi App - Daily Picks Screen
// Premium daily match recommendations with compatibility breakdown

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  Animated,
  Image,
  Alert,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Colors, BorderRadius, Shadows, GradientColors } from "../theme";
import { DailyPick, Profile } from "../types";
import {
  fetchDailyPicks,
  getProfileById,
  submitSwipe,
} from "../services/api";

interface DailyPicksScreenProps {
  onMatchPress?: (matchId: string) => void;
}

interface PickWithProfile extends DailyPick {
  profile: Profile;
}

// ============ Shimmer Loading Skeleton ============

const ShimmerBlock: React.FC<{ width: number; height: number; style?: any }> = ({
  width,
  height,
  style,
}) => {
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0,
          duration: 1200,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [shimmerAnim]);

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius: BorderRadius.sm,
          backgroundColor: Colors.borderLight,
          opacity: shimmerAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [0.4, 0.8],
          }),
        },
        style,
      ]}
    />
  );
};

const SkeletonCard: React.FC = () => (
  <View style={pickStyles.card}>
    <ShimmerBlock width="100%" height={200} style={{ borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }} />
    <View style={{ padding: 16, gap: 10 }}>
      <ShimmerBlock width={180} height={22} />
      <ShimmerBlock width={120} height={16} />
      <ShimmerBlock width="100%" height={14} />
      <ShimmerBlock width="80%" height={14} />
      <View style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
        <ShimmerBlock width={60} height={24} style={{ borderRadius: 12 }} />
        <ShimmerBlock width={80} height={24} style={{ borderRadius: 12 }} />
        <ShimmerBlock width={70} height={24} style={{ borderRadius: 12 }} />
      </View>
      <ShimmerBlock width="100%" height={60} style={{ borderRadius: BorderRadius.md }} />
    </View>
  </View>
);

// ============ Pick Card Component ============

interface PickCardProps {
  pick: PickWithProfile;
  index: number;
  onLike: (id: string) => void;
  onPass: (id: string) => void;
  isProcessing: boolean;
}

const PickCard: React.FC<PickCardProps> = ({
  pick,
  index,
  onLike,
  onPass,
  isProcessing,
}) => {
  const { profile, score } = pick;
  const [expanded, setExpanded] = useState(false);
  const slideAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Entrance animation
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        delay: index * 100,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 1,
        friction: 8,
        tension: 50,
        delay: index * 100,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim, index]);

  // Score color
  const scoreColor = score >= 80 ? Colors.likeGreen : score >= 60 ? Colors.accent : Colors.secondary;

  // Age calculation
  const getAge = (birthDate: string): number => {
    const birth = new Date(birthDate);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return age;
  };

  // Build "Why matched" reasons
  const getMatchReasons = (): string[] => {
    const reasons: string[] = [];

    // Location proximity (simplified)
    const latDiff = Math.abs(profile.latitude - 12.9716);
    const lonDiff = Math.abs(profile.longitude - 77.5946);
    const roughKm = (latDiff + lonDiff) * 111;
    if (roughKm < 50) {
      reasons.push(`📍 Near you — ${Math.round(roughKm)} km away`);
    } else {
      reasons.push(`📍 Located in ${profile.location_name}`);
    }

    // Languages
    if (profile.languages_spoken.length > 0) {
      reasons.push(`🗣️ Speaks ${profile.languages_spoken.slice(0, 2).join(" & ")}`);
    }

    // Religion
    if (profile.religion) {
      reasons.push(`🕉️ ${profile.religion}`);
    }

    // Relationship goal
    if (profile.relationship_goal) {
      const goalEmoji = profile.relationship_goal === "Marriage" ? "💍" : profile.relationship_goal === "Long-term" ? "💞" : "💫";
      reasons.push(`${goalEmoji} Seeking ${profile.relationship_goal}`);
    }

    // Occupation
    if (profile.occupation) {
      reasons.push(`💼 ${profile.occupation}`);
    }

    // Education
    if (profile.education) {
      reasons.push(`🎓 ${profile.education}`);
    }

    // Activity level
    if (profile.activity_level) {
      reasons.push(`⚡ ${profile.activity_level} activity`);
    }

    return reasons;
  };

  const matchReasons = getMatchReasons();
  const age = getAge(profile.birth_date);

  // Handle Accept/Reject animation
  const handleAction = (action: "like" | "dislike") => {
    if (isProcessing) return;

    if (action === "like") {
      onLike(pick.pick_id);
    } else {
      onPass(pick.pick_id);
    }
  };

  return (
    <Animated.View
      style={[
        pickStyles.card,
        {
          opacity: fadeAnim,
          transform: [
            {
              translateY: slideAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [40, 0],
              }),
            },
          ],
        },
      ]}
    >
      {/* Photo + Score */}
      <View style={pickStyles.photoSection}>
        <Image
          source={{
            uri:
              profile.photos[0] ||
              "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400",
          }}
          style={pickStyles.photo}
          resizeMode="cover"
        />

        {/* Gradient overlay */}
        <LinearGradient
          colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.5)"]}
          style={pickStyles.photoGradient}
          locations={[0.4, 1]}
        />

        {/* Compatibility Score Badge - top right */}
        <View style={[pickStyles.scoreBadge, { backgroundColor: scoreColor }]}>
          <Text style={pickStyles.scoreNumber}>{score}</Text>
          <Text style={pickStyles.scoreLabel}>Score</Text>
        </View>

        {/* Bottom info overlay */}
        <View style={pickStyles.photoInfo}>
          <View style={pickStyles.nameRow}>
            <Text style={pickStyles.name}>{profile.full_name.split(" ")[0]}</Text>
            <Text style={pickStyles.age}>{age}</Text>
          </View>
          <Text style={pickStyles.location}>
            {profile.location_name}
            {profile.occupation ? ` · ${profile.occupation}` : ""}
          </Text>
        </View>
      </View>

      {/* Tags row */}
      <View style={pickStyles.tagsRow}>
        <View style={pickStyles.tag}>
          <Text style={pickStyles.tagText}>{profile.religion}</Text>
        </View>
        <View style={pickStyles.tag}>
          <Text style={pickStyles.tagText}>
            {profile.languages_spoken.slice(0, 1)}
          </Text>
        </View>
        <View style={pickStyles.tag}>
          <Text style={pickStyles.tagText}>{profile.relationship_goal}</Text>
        </View>
        {profile.is_verified && (
          <View style={[pickStyles.tag, { backgroundColor: `${Colors.likeGreen}15`, borderColor: Colors.likeGreen }]}>
            <Text style={[pickStyles.tagText, { color: Colors.likeGreen }]}>✓ Verified</Text>
          </View>
        )}
      </View>

      {/* Bio */}
      {profile.bio && (
        <Text style={pickStyles.bio} numberOfLines={expanded ? undefined : 2}>
          {profile.bio}
        </Text>
      )}

      {/* "Why matched?" Section */}
      <TouchableOpacity
        style={pickStyles.matchReasonsToggle}
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.7}
      >
        <LinearGradient
          colors={["#FFF8EB", "#FFF0D6"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={pickStyles.matchReasonsHeader}>
          <Text style={pickStyles.matchReasonsTitle}>
            {expanded ? "▼ Why we matched you?" : "▶ Why we matched you?"}
          </Text>
          <Text style={pickStyles.matchReasonsSubtitle}>
            {matchReasons.slice(0, 2).join(" · ")}
          </Text>
        </View>
      </TouchableOpacity>

      {/* Expanded match reasons */}
      {expanded && (
        <View style={pickStyles.matchReasonsList}>
          {matchReasons.map((reason, i) => (
            <View key={i} style={pickStyles.matchReasonItem}>
              <View style={pickStyles.matchReasonBullet} />
              <Text style={pickStyles.matchReasonText}>{reason}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Action Buttons */}
      <View style={pickStyles.actionRow}>
        <TouchableOpacity
          style={[pickStyles.actionButton, pickStyles.passButton]}
          onPress={() => handleAction("dislike")}
          disabled={isProcessing}
          activeOpacity={0.8}
        >
          <Text style={pickStyles.passIcon}>✕</Text>
          <Text style={pickStyles.passText}>Pass</Text>
        </TouchableOpacity>

        <View style={pickStyles.matchStrength}>
          <Text style={pickStyles.matchStrengthLabel}>Match</Text>
          <Text style={pickStyles.matchStrengthValue}>
            {score >= 80 ? "Strong" : score >= 60 ? "Good" : "Fair"}
          </Text>
        </View>

        <TouchableOpacity
          style={[pickStyles.actionButton, pickStyles.likeButton]}
          onPress={() => handleAction("like")}
          disabled={isProcessing}
          activeOpacity={0.8}
        >
          <Text style={pickStyles.likeIcon}>♥</Text>
          <Text style={pickStyles.likeText}>Like</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
};

// ============ Main Screen ============

const DailyPicksScreen: React.FC<DailyPicksScreenProps> = ({
  onMatchPress,
}) => {
  const [picks, setPicks] = useState<PickWithProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processedIds, setProcessedIds] = useState<Set<string>>(new Set());
  const [isProcessing, setIsProcessing] = useState(false);
  const [matchFlash, setMatchFlash] = useState<string | null>(null);

  const loadPicks = useCallback(async () => {
    setIsLoading(true);
    try {
      const dailyPicks = await fetchDailyPicks();
      // Sort by score descending
      dailyPicks.sort((a, b) => b.score - a.score);

      // Enrich with profile data
      const enriched: PickWithProfile[] = dailyPicks
        .map((pick) => {
          const profile = getProfileById(pick.pick_id);
          return profile ? { ...pick, profile } : null;
        })
        .filter((p): p is PickWithProfile => p !== null);

      setPicks(enriched);
    } catch (error) {
      console.error("Failed to load daily picks:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPicks();
  }, [loadPicks]);

  const handleLike = async (profileId: string) => {
    if (isProcessing) return;
    setIsProcessing(true);

    try {
      const result = await submitSwipe(profileId, "like");
      setProcessedIds((prev) => new Set(prev).add(profileId));

      if (result.is_match) {
        setMatchFlash(profileId);
        setTimeout(() => {
          setMatchFlash(null);
          Alert.alert(
            "It's a Match! 🎉",
            "You matched! Check your Chats tab.",
            [
              {
                text: "Keep Browsing",
                style: "default",
              },
            ]
          );
        }, 600);
      }
    } catch (error) {
      console.error("Failed to like:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePass = async (profileId: string) => {
    if (isProcessing) return;
    setIsProcessing(true);

    try {
      await submitSwipe(profileId, "dislike");
      setProcessedIds((prev) => new Set(prev).add(profileId));
    } catch (error) {
      console.error("Failed to pass:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  // Filter to only show unprocessed picks
  const visiblePicks = picks.filter((p) => !processedIds.has(p.pick_id));

  // ===== RENDER =====
  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Daily Picks</Text>
          <Text style={styles.headerSubtitle}>
            Curated just for you
          </Text>
        </View>
        <ScrollView
          contentContainerStyle={styles.skeletonList}
          showsVerticalScrollIndicator={false}
        >
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Daily Picks</Text>
        <Text style={styles.headerSubtitle}>
          {visiblePicks.length > 0
            ? `${visiblePicks.length} picks remaining today`
            : "All caught up!"}
        </Text>
      </View>

      {visiblePicks.length === 0 ? (
        /* Empty State */
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>🌟</Text>
          <Text style={styles.emptyTitle}>You're all caught up!</Text>
          <Text style={styles.emptySubtitle}>
            You've reviewed all of today's picks. Come back tomorrow for a fresh
            set of curated matches designed just for you.
          </Text>
          <TouchableOpacity
            style={styles.refreshButton}
            onPress={loadPicks}
            activeOpacity={0.8}
          >
            <Text style={styles.refreshButtonText}>Refresh Picks</Text>
          </TouchableOpacity>
        </View>
      ) : (
        /* Picks List */
        <ScrollView
          contentContainerStyle={styles.pickList}
          showsVerticalScrollIndicator={false}
        >
          {visiblePicks.map((pick, index) => (
            <PickCard
              key={pick.id}
              pick={pick}
              index={index}
              onLike={handleLike}
              onPass={handlePass}
              isProcessing={isProcessing}
            />
          ))}
        </ScrollView>
      )}

      {/* Match flash overlay */}
      {matchFlash && (
        <View style={styles.matchOverlay}>
          <Text style={styles.matchEmoji}>💞</Text>
          <Text style={styles.matchText}>It's a Match!</Text>
        </View>
      )}
    </SafeAreaView>
  );
};

// ============ Styles ============

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: Colors.textPrimary,
    fontFamily: "Georgia",
  },
  headerSubtitle: {
    fontSize: 14,
    color: Colors.textTertiary,
    fontWeight: "500",
    marginTop: 2,
  },
  skeletonList: {
    paddingHorizontal: 16,
    paddingBottom: 30,
    gap: 16,
  },
  pickList: {
    paddingHorizontal: 16,
    paddingBottom: 30,
    gap: 16,
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 24,
  },
  refreshButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: BorderRadius.md,
    ...Shadows.sm,
  },
  refreshButtonText: {
    color: Colors.textLight,
    fontSize: 16,
    fontWeight: "700",
  },
  matchOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(184, 92, 46, 0.9)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 100,
  },
  matchEmoji: {
    fontSize: 72,
    marginBottom: 12,
  },
  matchText: {
    fontSize: 32,
    fontWeight: "800",
    color: Colors.textLight,
    fontFamily: "Georgia",
  },
});

const pickStyles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    overflow: "hidden",
    ...Shadows.md,
  },
  photoSection: {
    height: 220,
    position: "relative",
  },
  photo: {
    width: "100%",
    height: "100%",
    position: "absolute",
  },
  photoGradient: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: "60%",
  },
  scoreBadge: {
    position: "absolute",
    top: 14,
    right: 14,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    ...Shadows.sm,
  },
  scoreNumber: {
    color: Colors.textLight,
    fontSize: 20,
    fontWeight: "800",
    lineHeight: 22,
  },
  scoreLabel: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 9,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  photoInfo: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  name: {
    color: Colors.textLight,
    fontSize: 24,
    fontWeight: "700",
    marginRight: 8,
    textShadowColor: "rgba(0,0,0,0.3)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  age: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 20,
    fontWeight: "400",
  },
  location: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 13,
    fontWeight: "500",
    marginTop: 2,
  },
  tagsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 6,
  },
  tag: {
    backgroundColor: `${Colors.sandalwood}12`,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tagText: {
    fontSize: 11,
    fontWeight: "600",
    color: Colors.textSecondary,
  },
  bio: {
    paddingHorizontal: 16,
    paddingTop: 8,
    fontSize: 14,
    lineHeight: 20,
    color: Colors.textSecondary,
  },
  matchReasonsToggle: {
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: BorderRadius.md,
    overflow: "hidden",
  },
  matchReasonsHeader: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  matchReasonsTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.sandalwood,
    marginBottom: 2,
  },
  matchReasonsSubtitle: {
    fontSize: 12,
    color: Colors.textTertiary,
    lineHeight: 16,
  },
  matchReasonsList: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    gap: 8,
  },
  matchReasonItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  matchReasonBullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.accent,
    marginRight: 10,
  },
  matchReasonText: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
    flex: 1,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    marginTop: 8,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: BorderRadius.full,
    gap: 6,
  },
  passButton: {
    backgroundColor: `${Colors.dislikeRed}10`,
    borderWidth: 1.5,
    borderColor: Colors.dislikeRed,
  },
  passIcon: {
    fontSize: 14,
    color: Colors.dislikeRed,
    fontWeight: "800",
  },
  passText: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.dislikeRed,
  },
  likeButton: {
    backgroundColor: `${Colors.likeGreen}10`,
    borderWidth: 1.5,
    borderColor: Colors.likeGreen,
  },
  likeIcon: {
    fontSize: 14,
    color: Colors.likeGreen,
  },
  likeText: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.likeGreen,
  },
  matchStrength: {
    alignItems: "center",
  },
  matchStrengthLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: Colors.textTertiary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  matchStrengthValue: {
    fontSize: 14,
    fontWeight: "800",
    color: Colors.primary,
  },
});

export default DailyPicksScreen;