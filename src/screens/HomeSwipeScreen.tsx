// Jodi App - Home Swipe Screen
// Interactive Tinder/Bumble-style card swiping interface

import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  PanResponder,
  TouchableOpacity,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Colors, Typography, BorderRadius, Shadows } from "../theme";
import { SwipeCardData } from "../types";
import { fetchSwipeCards, submitSwipe } from "../services/api";
import SwipeCard from "../components/SwipeCard";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.35;

interface HomeSwipeScreenProps {
  dailySwipesRemaining?: number;
  maxDailySwipes?: number;
  onUpgradePress?: () => void;
  onMatchPress?: (matchId: string) => void;
  onProfilePress?: () => void;
}

const HomeSwipeScreen: React.FC<HomeSwipeScreenProps> = ({
  dailySwipesRemaining = 20,
  maxDailySwipes = 20,
  onUpgradePress,
  onMatchPress,
  onProfilePress,
}) => {
  const [cards, setCards] = useState<SwipeCardData[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showMatch, setShowMatch] = useState(false);
  const [matchedName, setMatchedName] = useState("");

  // Animation values
  const position = useRef(new Animated.ValueXY()).current;
  const rotate = useRef(new Animated.Value(0)).current;
  const likeOpacity = useRef(new Animated.Value(0)).current;
  const nopeOpacity = useRef(new Animated.Value(0)).current;
  const superLikeOpacity = useRef(new Animated.Value(0)).current;

  const swipeCount = useRef(0);

  useEffect(() => {
    loadCards();
  }, []);

  const loadCards = async () => {
    setIsLoading(true);
    try {
      const data = await fetchSwipeCards();
      setCards(data);
      setCurrentIndex(0);
    } catch (error) {
      console.error("Failed to load cards:", error);
      Alert.alert("Error", "Could not load profiles. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: (_, gesture) => {
        position.setValue({ x: gesture.dx, y: gesture.dy });
        // Rotate based on horizontal swipe
        rotate.setValue(gesture.dx / 200);

        // Opacity for like/nope labels
        if (gesture.dx > 20) {
          likeOpacity.setValue(Math.min(gesture.dx / 100, 1));
          nopeOpacity.setValue(0);
          superLikeOpacity.setValue(0);
        } else if (gesture.dx < -20) {
          nopeOpacity.setValue(Math.min(-gesture.dx / 100, 1));
          likeOpacity.setValue(0);
          superLikeOpacity.setValue(0);
        }
      },
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dx > SWIPE_THRESHOLD) {
          // Like swipe
          handleSwipe("like");
        } else if (gesture.dx < -SWIPE_THRESHOLD) {
          // Dislike swipe
          handleSwipe("dislike");
        } else {
          // Return to center
          resetPosition();
        }
      },
    })
  ).current;

  const resetPosition = () => {
    Animated.parallel([
      Animated.spring(position, {
        toValue: { x: 0, y: 0 },
        friction: 5,
        useNativeDriver: true,
      }),
      Animated.spring(rotate, {
        toValue: 0,
        friction: 5,
        useNativeDriver: true,
      }),
      Animated.timing(likeOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(nopeOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handleSwipe = async (type: "like" | "dislike" | "super_like") => {
    if (isSubmitting || currentIndex >= cards.length) return;
    setIsSubmitting(true);

    const currentCard = cards[currentIndex];

    // Animate card off screen
    const targetX = type === "like" ? SCREEN_WIDTH + 100 : -(SCREEN_WIDTH + 100);
    Animated.parallel([
      Animated.timing(position, {
        toValue: { x: targetX, y: 0 },
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(rotate, {
        toValue: type === "like" ? 0.1 : -0.1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(async () => {
      try {
        const result = await submitSwipe(currentCard.profile.id, type);
        
        if (result.is_match) {
          setMatchedName(currentCard.profile.full_name.split(" ")[0]);
          setShowMatch(true);
        }

        // Move to next card
        setCurrentIndex((prev) => prev + 1);
        swipeCount.current += 1;

        // Reset position for next card
        position.setValue({ x: 0, y: 0 });
        rotate.setValue(0);
        likeOpacity.setValue(0);
        nopeOpacity.setValue(0);
        superLikeOpacity.setValue(0);
      } catch (error) {
        console.error("Swipe failed:", error);
        resetPosition();
      } finally {
        setIsSubmitting(false);
      }
    });
  };

  const handleLike = useCallback(() => handleSwipe("like"), [currentIndex, cards, isSubmitting]);
  const handleDislike = useCallback(() => handleSwipe("dislike"), [currentIndex, cards, isSubmitting]);
  const handleSuperLike = useCallback(() => handleSwipe("super_like"), [currentIndex, cards, isSubmitting]);

  const renderCard = () => {
    if (currentIndex >= cards.length) {
      return (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>🪷</Text>
          <Text style={styles.emptyTitle}>No more profiles</Text>
          <Text style={styles.emptySubtitle}>
            Check back later or explore our Daily Picks for premium matches!
          </Text>
          <TouchableOpacity
            style={styles.refreshButton}
            onPress={loadCards}
            activeOpacity={0.8}
          >
            <Text style={styles.refreshButtonText}>Refresh</Text>
          </TouchableOpacity>
        </View>
      );
    }

    const card = cards[currentIndex];

    // Render top card with pan gesture, stack others behind
    return (
      <View style={styles.cardStack}>
        {/* Stack cards behind */}
        {cards.slice(currentIndex + 1, currentIndex + 3).map((stackCard, index) => (
          <View
            key={stackCard.profile.id}
            style={[
              styles.stackedCard,
              {
                transform: [
                  { scale: 1 - (index + 1) * 0.03 },
                  { translateY: (index + 1) * 8 },
                ],
                zIndex: -(index + 1),
              },
            ]}
          >
            <View
              style={[styles.stackedCardInner, { opacity: 1 - (index + 1) * 0.15 }]}
            />
          </View>
        ))}

        {/* Top swipeable card */}
        <Animated.View
          style={[
            styles.cardWrapper,
            {
              transform: [
                { translateX: position.x },
                { translateY: position.y },
                { rotate: rotate.interpolate({
                  inputRange: [-1, 1],
                  outputRange: ["-10deg", "10deg"],
                })},
              ],
              zIndex: 10,
            },
          ]}
          {...panResponder.panHandlers}
        >
          {/* NOPE overlay */}
          <Animated.View
            style={[
              styles.overlayLabel,
              styles.nopeOverlay,
              { opacity: nopeOpacity },
            ]}
          >
            <Text style={[styles.overlayText, { color: Colors.dislikeRed }]}>
              NOPE
            </Text>
          </Animated.View>

          {/* LIKE overlay */}
          <Animated.View
            style={[
              styles.overlayLabel,
              styles.likeOverlay,
              { opacity: likeOpacity },
            ]}
          >
            <Text style={[styles.overlayText, { color: Colors.likeGreen }]}>
              LIKE
            </Text>
          </Animated.View>

          <SwipeCard
            card={card}
            onLike={handleLike}
            onDislike={handleDislike}
            onSuperLike={handleSuperLike}
            onInfoPress={() => {}}
            isTopCard
          />
        </Animated.View>
      </View>
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Finding matches near you...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.logoText}>Jodi</Text>

        <View style={styles.headerRight}>
          {/* Swipe count */}
          <View style={styles.swipeCount}>
            <Text style={styles.swipeCountText}>
              {Math.max(0, maxDailySwipes - swipeCount.current)}
            </Text>
          </View>

          {/* Premium button */}
          <TouchableOpacity
            style={styles.premiumButton}
            onPress={onUpgradePress}
            activeOpacity={0.7}
          >
            <LinearGradient
              colors={["#FFA000", "#FFB833"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
              borderRadius={BorderRadius.md}
            />
            <Text style={styles.premiumButtonText}>Upgrade</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Card Deck */}
      <View style={styles.deckContainer}>{renderCard()}</View>

      {/* Match Modal */}
      {showMatch && (
        <View style={styles.matchOverlay}>
          <LinearGradient
            colors={["#B85C2E", "#D07A42", "#FFA000"]}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.matchContent}>
            <Text style={styles.matchEmoji}>💞</Text>
            <Text style={styles.matchTitle}>It's a Match!</Text>
            <Text style={styles.matchName}>
              You and {matchedName} liked each other
            </Text>
            <TouchableOpacity
              style={styles.matchButton}
              onPress={() => {
                setShowMatch(false);
                onMatchPress?.("new-match");
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.matchButtonText}>Send a message</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.matchKeepBrowsing}
              onPress={() => setShowMatch(false)}
              activeOpacity={0.7}
            >
              <Text style={styles.matchKeepBrowsingText}>
                Keep swiping
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: Colors.textSecondary,
    fontWeight: "500",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  logoText: {
    fontSize: 28,
    fontWeight: "800",
    color: Colors.primary,
    fontFamily: "Georgia",
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  swipeCount: {
    backgroundColor: Colors.surfaceElevated,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  swipeCountText: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.primary,
  },
  premiumButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: BorderRadius.md,
    overflow: "hidden",
  },
  premiumButtonText: {
    color: Colors.textPrimary,
    fontSize: 13,
    fontWeight: "700",
  },
  deckContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  cardStack: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  stackedCard: {
    position: "absolute",
    width: "100%",
    height: SCREEN_HEIGHT * 0.68,
    borderRadius: BorderRadius.xl,
  },
  stackedCardInner: {
    flex: 1,
    backgroundColor: Colors.borderLight,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardWrapper: {
    width: "100%",
    height: SCREEN_HEIGHT * 0.68,
    borderRadius: BorderRadius.xl,
  },
  overlayLabel: {
    position: "absolute",
    top: 40,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: BorderRadius.sm,
    borderWidth: 3,
    backgroundColor: "rgba(255,255,255,0.85)",
    zIndex: 20,
    transform: [{ rotate: "-15deg" }],
  },
  nopeOverlay: {
    right: 20,
    borderColor: Colors.dislikeRed,
  },
  likeOverlay: {
    left: 20,
    borderColor: Colors.likeGreen,
    transform: [{ rotate: "15deg" }],
  },
  overlayText: {
    fontSize: 32,
    fontWeight: "900",
    letterSpacing: 2,
  },
  emptyState: {
    alignItems: "center",
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
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
    justifyContent: "center",
    alignItems: "center",
  },
  matchContent: {
    alignItems: "center",
    paddingHorizontal: 40,
  },
  matchEmoji: {
    fontSize: 80,
    marginBottom: 16,
  },
  matchTitle: {
    fontSize: 36,
    fontWeight: "800",
    color: Colors.textLight,
    marginBottom: 8,
    fontFamily: "Georgia",
  },
  matchName: {
    fontSize: 18,
    color: "rgba(255,255,255,0.85)",
    textAlign: "center",
    marginBottom: 32,
    lineHeight: 24,
  },
  matchButton: {
    backgroundColor: Colors.textLight,
    paddingHorizontal: 40,
    paddingVertical: 16,
    borderRadius: BorderRadius.md,
    width: "100%",
    alignItems: "center",
    ...Shadows.md,
  },
  matchButtonText: {
    color: Colors.primary,
    fontSize: 18,
    fontWeight: "700",
  },
  matchKeepBrowsing: {
    marginTop: 16,
    paddingVertical: 12,
  },
  matchKeepBrowsingText: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 16,
    fontWeight: "600",
  },
});

export default HomeSwipeScreen;