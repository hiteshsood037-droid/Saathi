// Jodi App - Animated Swipe Card Component
// Premium Tinder/Bumble-style card with Indian-inspired design

import React, { useRef, useCallback, useMemo } from "react";
import {
  View,
  Text,
  Image,
  Dimensions,
  StyleSheet,
  TouchableOpacity,
  Pressable,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Colors, Typography, BorderRadius, Shadows } from "../theme";
import { SwipeCardData } from "../types";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const CARD_WIDTH = SCREEN_WIDTH - 32;
const CARD_HEIGHT = SCREEN_HEIGHT * 0.68;

interface SwipeCardProps {
  card: SwipeCardData;
  onLike: () => void;
  onDislike: () => void;
  onSuperLike: () => void;
  onInfoPress: () => void;
  isTopCard: boolean;
}

const SwipeCard: React.FC<SwipeCardProps> = ({
  card,
  onLike,
  onDislike,
  onSuperLike,
  onInfoPress,
  isTopCard,
}) => {
  const { profile, compatibility_score, distance_km } = card;

  // Calculate age from birth_date
  const age = useMemo(() => {
    const birth = new Date(profile.birth_date);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return age;
  }, [profile.birth_date]);

  // Determine score color
  const scoreColor =
    compatibility_score >= 80
      ? Colors.likeGreen
      : compatibility_score >= 60
      ? Colors.accent
      : Colors.secondary;

  return (
    <View style={styles.cardContainer}>
      {/* Main Card */}
      <View style={styles.card}>
        {/* Photo */}
        <Image
          source={{
            uri:
              profile.photos[0] ||
              "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400",
          }}
          style={styles.cardImage}
          resizeMode="cover"
        />

        {/* Gradient overlay */}
        <LinearGradient
          colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.7)"]}
          style={styles.gradient}
          locations={[0.3, 1]}
        />

        {/* Compatibility Score Badge */}
        <View style={[styles.scoreBadge, { backgroundColor: scoreColor }]}>
          <Text style={styles.scoreText}>{compatibility_score}</Text>
          <Text style={styles.scoreLabel}>Jodi Score</Text>
        </View>

        {/* Verification Badge */}
        {profile.is_verified && (
          <View style={styles.verifiedBadge}>
            <Text style={styles.verifiedIcon}>✓</Text>
          </View>
        )}

        {/* Profile Info Overlay */}
        <View style={styles.cardInfo}>
          {/* Name & Age */}
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>
              {profile.full_name.split(" ")[0]}
            </Text>
            <Text style={styles.age}>{age}</Text>
          </View>

          {/* Quick traits row */}
          <View style={styles.traitsRow}>
            <View style={styles.trait}>
              <Text style={styles.traitIcon}>📍</Text>
              <Text style={styles.traitText}>{distance_km} km</Text>
            </View>
            <View style={styles.traitDot} />
            <View style={styles.trait}>
              <Text style={styles.traitIcon}>💼</Text>
              <Text style={styles.traitText} numberOfLines={1}>
                {profile.occupation || "Professional"}
              </Text>
            </View>
            <View style={styles.traitDot} />
            <View style={styles.trait}>
              <Text style={styles.traitIcon}>🎓</Text>
              <Text style={styles.traitText} numberOfLines={1}>
                {profile.education?.split(" ")[0] || "Educated"}
              </Text>
            </View>
          </View>

          {/* Bio preview */}
          {profile.bio && (
            <Text style={styles.bio} numberOfLines={2}>
              {profile.bio}
            </Text>
          )}

          {/* Tags */}
          <View style={styles.tagsRow}>
            <View style={styles.tag}>
              <Text style={styles.tagText}>{profile.religion}</Text>
            </View>
            <View style={styles.tag}>
              <Text style={styles.tagText}>{profile.diet}</Text>
            </View>
            <View style={styles.tag}>
              <Text style={styles.tagText}>{profile.activity_level}</Text>
            </View>
            {profile.languages_spoken.slice(0, 1).map((lang) => (
              <View key={lang} style={styles.tag}>
                <Text style={styles.tagText}>{lang}</Text>
              </View>
            ))}
          </View>

          {/* Info button */}
          <TouchableOpacity
            style={styles.infoButton}
            onPress={onInfoPress}
            activeOpacity={0.7}
          >
            <Text style={styles.infoButtonText}>See full profile →</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionsRow}>
        {/* Dislike */}
        <TouchableOpacity
          style={[styles.actionButton, styles.dislikeButton]}
          onPress={onDislike}
          activeOpacity={0.8}
        >
          <Text style={styles.actionIcon}>✕</Text>
        </TouchableOpacity>

        {/* Super Like */}
        <TouchableOpacity
          style={[styles.actionButton, styles.superLikeButton]}
          onPress={onSuperLike}
          activeOpacity={0.8}
        >
          <Text style={styles.superLikeIcon}>⭐</Text>
        </TouchableOpacity>

        {/* Like */}
        <TouchableOpacity
          style={[styles.actionButton, styles.likeButton]}
          onPress={onLike}
          activeOpacity={0.8}
        >
          <Text style={styles.actionIcon}>♥</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    width: CARD_WIDTH,
    alignSelf: "center",
    alignItems: "center",
  },
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: BorderRadius.xl,
    overflow: "hidden",
    ...Shadows.lg,
  },
  cardImage: {
    width: "100%",
    height: "100%",
    position: "absolute",
  },
  gradient: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: "70%",
  },
  scoreBadge: {
    position: "absolute",
    top: 16,
    right: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
    ...Shadows.md,
  },
  scoreText: {
    color: Colors.textLight,
    fontSize: 22,
    fontWeight: "800",
    lineHeight: 26,
  },
  scoreLabel: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 9,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  verifiedBadge: {
    position: "absolute",
    top: 16,
    left: 16,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.likeGreen,
    alignItems: "center",
    justifyContent: "center",
    ...Shadows.sm,
  },
  verifiedIcon: {
    color: Colors.textLight,
    fontSize: 16,
    fontWeight: "800",
  },
  cardInfo: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    paddingBottom: 16,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "baseline",
    marginBottom: 8,
  },
  name: {
    color: Colors.textLight,
    fontSize: 28,
    fontWeight: "700",
    marginRight: 8,
    textShadowColor: "rgba(0,0,0,0.3)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  age: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 24,
    fontWeight: "400",
    textShadowColor: "rgba(0,0,0,0.3)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  traitsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  trait: {
    flexDirection: "row",
    alignItems: "center",
  },
  traitIcon: {
    fontSize: 12,
    marginRight: 3,
  },
  traitText: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 13,
    fontWeight: "500",
    maxWidth: 80,
  },
  traitDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: "rgba(255,255,255,0.5)",
    marginHorizontal: 8,
  },
  bio: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 14,
    lineHeight: 19,
    marginBottom: 10,
  },
  tagsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 10,
  },
  tag: {
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    marginRight: 6,
    marginBottom: 4,
  },
  tagText: {
    color: Colors.textLight,
    fontSize: 11,
    fontWeight: "600",
  },
  infoButton: {
    alignSelf: "flex-start",
  },
  infoButtonText: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 13,
    fontWeight: "600",
    textDecorationLine: "underline",
  },
  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 24,
    gap: 20,
  },
  actionButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    ...Shadows.md,
  },
  dislikeButton: {
    backgroundColor: Colors.textLight,
    borderWidth: 2,
    borderColor: Colors.dislikeRed,
  },
  likeButton: {
    backgroundColor: Colors.textLight,
    borderWidth: 2,
    borderColor: Colors.likeGreen,
  },
  superLikeButton: {
    backgroundColor: Colors.textLight,
    borderWidth: 2,
    borderColor: Colors.superLikeBlue,
  },
  actionIcon: {
    fontSize: 26,
  },
  superLikeIcon: {
    fontSize: 22,
  },
});

export default SwipeCard;