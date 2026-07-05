// Jodi App - Welcome Screen
// Premium chai/saffron themed entrance with Indian-inspired design

import React, { useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  StatusBar,
  Dimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Colors, Typography, BorderRadius, Shadows } from "../theme";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

interface WelcomeScreenProps {
  onGetStarted: () => void;
  onLogin: () => void;
}

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  onGetStarted,
  onLogin,
}) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 6,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim, scaleAnim]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Background Gradient */}
      <LinearGradient
        colors={["#2D1810", "#4A2414", "#B85C2E", "#D07A42"]}
        locations={[0, 0.15, 0.6, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* Decorative Ornamental Elements */}
      <View style={styles.ornamentTop}>
        <Text style={styles.ornamentText}>⨁</Text>
      </View>
      <View style={styles.ornamentBottom}>
        <Text style={styles.ornamentText}>⨁</Text>
      </View>

      {/* Content */}
      <View style={styles.content}>
        {/* Logo / Brand */}
        <Animated.View
          style={[
            styles.logoContainer,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          {/* Decorative border */}
          <View style={styles.logoBorder}>
            <View style={styles.logoInner}>
              <Text style={styles.logoIcon}>🪷</Text>
            </View>
          </View>

          <Text style={styles.brandName}>Jodi</Text>
          <Text style={styles.tagline}>
            Where tradition meets heart
          </Text>
        </Animated.View>

        {/* Features */}
        <Animated.View
          style={[
            styles.featuresContainer,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <View style={styles.featureRow}>
            <View style={styles.featureDot} />
            <Text style={styles.featureText}>
              Culturally-attuned matches
            </Text>
          </View>
          <View style={styles.featureRow}>
            <View style={styles.featureDot} />
            <Text style={styles.featureText}>
              Smart Jodi Compatibility Score
            </Text>
          </View>
          <View style={styles.featureRow}>
            <View style={styles.featureDot} />
            <Text style={styles.featureText}>
              For the global Indian diaspora
            </Text>
          </View>
        </Animated.View>

        {/* Action Buttons */}
        <Animated.View
          style={[
            styles.buttonContainer,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={onGetStarted}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={["#FFA000", "#FFB833"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <Text style={styles.primaryButtonText}>Create Account</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={onLogin}
            activeOpacity={0.85}
          >
            <Text style={styles.secondaryButtonText}>
              I already have an account
            </Text>
          </TouchableOpacity>
        </Animated.View>

        {/* Footer */}
        <Animated.View
          style={[
            styles.footer,
            {
              opacity: fadeAnim,
            },
          ]}
        >
          <Text style={styles.footerText}>
            By joining, you agree to our Terms of Service and Privacy Policy
          </Text>
        </Animated.View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.primary,
  },
  ornamentTop: {
    position: "absolute",
    top: 60,
    left: 30,
    opacity: 0.15,
  },
  ornamentBottom: {
    position: "absolute",
    bottom: 120,
    right: 25,
    opacity: 0.1,
  },
  ornamentText: {
    fontSize: 80,
    color: Colors.gold,
  },
  content: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 32,
    paddingBottom: 50,
  },
  logoContainer: {
    alignItems: "center",
    marginBottom: 48,
  },
  logoBorder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 2.5,
    borderColor: "rgba(255, 160, 0, 0.6)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  logoInner: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(255, 160, 0, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  logoIcon: {
    fontSize: 40,
  },
  brandName: {
    color: Colors.textLight,
    fontSize: 48,
    fontWeight: "800",
    letterSpacing: -1,
    marginBottom: 8,
    fontFamily: "Georgia",
  },
  tagline: {
    color: "rgba(255, 255, 255, 0.75)",
    fontSize: 17,
    fontWeight: "400",
    fontStyle: "italic",
    letterSpacing: 0.5,
  },
  featuresContainer: {
    marginBottom: 40,
    alignSelf: "center",
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },
  featureDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.accent,
    marginRight: 14,
  },
  featureText: {
    color: "rgba(255, 255, 255, 0.8)",
    fontSize: 16,
    fontWeight: "500",
  },
  buttonContainer: {
    gap: 14,
  },
  primaryButton: {
    height: 56,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    ...Shadows.md,
  },
  primaryButtonText: {
    color: Colors.textPrimary,
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  secondaryButton: {
    height: 52,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonText: {
    color: "rgba(255, 255, 255, 0.85)",
    fontSize: 16,
    fontWeight: "600",
  },
  footer: {
    marginTop: 32,
    alignItems: "center",
  },
  footerText: {
    color: "rgba(255, 255, 255, 0.45)",
    fontSize: 12,
    textAlign: "center",
    lineHeight: 16,
  },
});

export default WelcomeScreen;