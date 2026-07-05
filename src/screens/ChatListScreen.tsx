// Jodi App - Chat List Screen
// Displays active matches with streak indicators and last message previews

import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  RefreshControl,
  Image,
} from "react-native";
import { Colors, BorderRadius, Shadows } from "../theme";
import { Match, Profile } from "../types";
import { fetchMatchedProfiles } from "../services/api";
import { StreakBadge } from "../components/StreakIndicator";

interface ChatListScreenProps {
  onChatPress: (matchId: string, matchedProfile: Profile) => void;
}

interface MatchWithProfile extends Match {
  matchedProfile: Profile;
}

const ChatListScreen: React.FC<ChatListScreenProps> = ({ onChatPress }) => {
  const [matches, setMatches] = useState<MatchWithProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadMatches = useCallback(async () => {
    try {
      const data = await fetchMatchedProfiles();
      // Sort by most recent message
      data.sort(
        (a, b) =>
          new Date(b.last_message_at).getTime() -
          new Date(a.last_message_at).getTime()
      );
      setMatches(data);
    } catch (error) {
      console.error("Failed to load matches:", error);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadMatches();

    // Simulate real-time subscription refresh
    const interval = setInterval(loadMatches, 10000);
    return () => clearInterval(interval);
  }, [loadMatches]);

  const onRefresh = () => {
    setRefreshing(true);
    loadMatches();
  };

  const getAge = (birthDate: string): number => {
    const birth = new Date(birthDate);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return age;
  };

  const getTimeAgo = (dateStr: string): string => {
    const now = new Date();
    const date = new Date(dateStr);
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffHrs = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMin < 1) return "Just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHrs < 24) return `${diffHrs}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const renderMatchItem = ({ item }: { item: MatchWithProfile }) => {
    const profile = item.matchedProfile;
    const age = getAge(profile.birth_date);

    return (
      <TouchableOpacity
        style={styles.matchItem}
        onPress={() => onChatPress(item.id, profile)}
        activeOpacity={0.7}
      >
        {/* Profile Photo */}
        <View style={styles.photoContainer}>
          <Image
            source={{
              uri:
                profile.photos[0] ||
                "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200",
            }}
            style={styles.photo}
            resizeMode="cover"
          />
          {profile.is_verified && (
            <View style={styles.verifiedBadge}>
              <Text style={styles.verifiedIcon}>✓</Text>
            </View>
          )}
        </View>

        {/* Match Info */}
        <View style={styles.matchInfo}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>
              {profile.full_name}
            </Text>
            <Text style={styles.age}>{age}</Text>
            {/* Compatibility Score */}
            <View style={styles.scoreBadge}>
              <Text style={styles.scoreText}>{item.compatibility_score}</Text>
            </View>
          </View>

          {/* Streak badge */}
          {item.streak_count > 0 && (
            <View style={{ marginBottom: 4 }}>
              <StreakBadge streakCount={item.streak_count} />
            </View>
          )}

          {/* Location & traits */}
          <View style={styles.traitsRow}>
            <Text style={styles.traitText} numberOfLines={1}>
              {profile.location_name}
            </Text>
            <View style={styles.traitDot} />
            <Text style={styles.traitText} numberOfLines={1}>
              {profile.occupation || "Professional"}
            </Text>
          </View>
        </View>

        {/* Time & Arrow */}
        <View style={styles.rightSection}>
          <Text style={styles.timeText}>
            {getTimeAgo(item.last_message_at)}
          </Text>
          <Text style={styles.arrow}>›</Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <Text style={styles.headerTitle}>Matches</Text>
      <View style={styles.headerSubtitle}>
        <Text style={styles.headerSubtitleText}>
          {matches.length} {matches.length === 1 ? "match" : "matches"}
        </Text>
      </View>
    </View>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading your matches...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (matches.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" />
        {renderHeader()}
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>💞</Text>
          <Text style={styles.emptyTitle}>No matches yet</Text>
          <Text style={styles.emptySubtitle}>
            Start swiping to find your Jodi! Your matches will appear here.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      {renderHeader()}
      <FlatList
        data={matches}
        keyExtractor={(item) => item.id}
        renderItem={renderMatchItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.primary}
            colors={[Colors.primary]}
          />
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
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
    marginTop: 2,
  },
  headerSubtitleText: {
    fontSize: 14,
    color: Colors.textTertiary,
    fontWeight: "500",
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  matchItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.surface,
    ...Shadows.sm,
  },
  photoContainer: {
    position: "relative",
    marginRight: 14,
  },
  photo: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.borderLight,
  },
  verifiedBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.likeGreen,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: Colors.surface,
  },
  verifiedIcon: {
    color: Colors.textLight,
    fontSize: 10,
    fontWeight: "800",
  },
  matchInfo: {
    flex: 1,
    justifyContent: "center",
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 2,
  },
  name: {
    fontSize: 17,
    fontWeight: "700",
    color: Colors.textPrimary,
    maxWidth: 140,
  },
  age: {
    fontSize: 15,
    fontWeight: "400",
    color: Colors.textSecondary,
    marginLeft: 6,
  },
  scoreBadge: {
    backgroundColor: `${Colors.accent}20`,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
    marginLeft: 8,
  },
  scoreText: {
    fontSize: 11,
    fontWeight: "800",
    color: Colors.accent,
  },
  traitsRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  traitText: {
    fontSize: 13,
    color: Colors.textTertiary,
    maxWidth: 120,
  },
  traitDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: Colors.textTertiary,
    marginHorizontal: 6,
  },
  rightSection: {
    alignItems: "flex-end",
    marginLeft: 8,
  },
  timeText: {
    fontSize: 12,
    color: Colors.textTertiary,
    marginBottom: 4,
    fontWeight: "500",
  },
  arrow: {
    fontSize: 22,
    color: Colors.textTertiary,
    fontWeight: "300",
  },
  separator: {
    height: 10,
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
  },
});

export default ChatListScreen;