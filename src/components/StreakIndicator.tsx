// Jodi App - Streak Indicator Component
// Visual flame indicator for match communication streaks

import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Colors, BorderRadius, Shadows } from "../theme";

interface StreakIndicatorProps {
  streakCount: number;
  size?: "small" | "medium" | "large";
}

const StreakIndicator: React.FC<StreakIndicatorProps> = ({
  streakCount,
  size = "medium",
}) => {
  // Determine flame color based on streak count
  const getFlameColor = () => {
    if (streakCount >= 7) return Colors.secondary; // Hot streak - vermilion
    if (streakCount >= 3) return Colors.accent; // Warm streak - saffron
    if (streakCount > 0) return Colors.gold; // Starting - gold
    return Colors.textTertiary; // No streak - grey
  };

  // Determine flame intensity icon
  const getFlameIcon = () => {
    if (streakCount >= 7) return "🔥"; // Intense fire
    if (streakCount >= 3) return "🔥"; // Fire
    if (streakCount > 0) return "🔥"; // Small flame
    return "🔥"; // Dim flame
  };

  const sizeConfig = {
    small: { container: 24, icon: 10, text: 9, padding: 2 },
    medium: { container: 32, icon: 14, text: 11, padding: 4 },
    large: { container: 44, icon: 18, text: 14, padding: 6 },
  };

  const config = sizeConfig[size];
  const flameColor = getFlameColor();

  return (
    <View
      style={[
        styles.container,
        {
          width: config.container,
          height: config.container + 4,
          backgroundColor: streakCount > 0 ? `${flameColor}20` : Colors.borderLight,
          borderColor: streakCount > 0 ? flameColor : Colors.border,
        },
      ]}
    >
      <Text style={[styles.icon, { fontSize: config.icon }]}>
        {getFlameIcon()}
      </Text>
      {streakCount > 0 && (
        <Text
          style={[
            styles.count,
            {
              fontSize: config.text,
              color: flameColor,
              marginTop: -config.padding,
            },
          ]}
        >
          {streakCount}
        </Text>
      )}
    </View>
  );
};

// Extended streak display for the chat list row
export const StreakBadge: React.FC<{ streakCount: number }> = ({
  streakCount,
}) => {
  if (streakCount === 0) return null;

  const flameColor =
    streakCount >= 7
      ? Colors.secondary
      : streakCount >= 3
      ? Colors.accent
      : Colors.gold;

  return (
    <View style={[badgeStyles.container, { backgroundColor: `${flameColor}15`, borderColor: flameColor }]}>
      <Text style={badgeStyles.icon}>🔥</Text>
      <Text style={[badgeStyles.text, { color: flameColor }]}>
        {streakCount}-day streak
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: BorderRadius.sm,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  icon: {
    lineHeight: undefined,
  },
  count: {
    fontWeight: "800",
  },
});

const badgeStyles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    gap: 3,
    alignSelf: "flex-start",
  },
  icon: {
    fontSize: 11,
  },
  text: {
    fontSize: 11,
    fontWeight: "700",
  },
});

export default StreakIndicator;