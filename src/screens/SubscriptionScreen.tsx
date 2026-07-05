// Jodi App - Subscription Screen
// Premium pricing tiers with feature comparisons

import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  Alert,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Colors, BorderRadius, Shadows } from "../theme";
import { SubscriptionTier, SUBSCRIPTION_PLANS } from "../types";

interface SubscriptionScreenProps {
  onBack: () => void;
  onSubscribe: (tier: SubscriptionTier) => void;
}

const SubscriptionScreen: React.FC<SubscriptionScreenProps> = ({
  onBack,
  onSubscribe,
}) => {
  const [selectedTier, setSelectedTier] = useState<SubscriptionTier | null>(
    null
  );
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubscribe = async (tier: SubscriptionTier) => {
    if (tier === "Free") {
      onBack();
      return;
    }

    setSelectedTier(tier);
    setIsProcessing(true);

    // Simulate Stripe checkout delay
    try {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      onSubscribe(tier);
      Alert.alert(
        "Welcome to Premium! 🎉",
        tier === "Gold"
          ? "You're now a Gold member — enjoy priority visibility, daily boosts, and unlimited rewinds!"
          : "You're now a Premium member — enjoy unlimited swipes and advanced filters!",
        [{ text: "Great!", onPress: onBack }]
      );
    } catch (error) {
      Alert.alert("Error", "Subscription could not be processed. Please try again.");
    } finally {
      setIsProcessing(false);
      setSelectedTier(null);
    }
  };

  const getTierBorderColor = (tier: SubscriptionTier, isPopular?: boolean) => {
    if (isPopular) return Colors.accent;
    if (tier === "Gold") return Colors.gold;
    return Colors.border;
  };

  const getTierBgColor = (tier: SubscriptionTier, isPopular?: boolean) => {
    if (isPopular) return `${Colors.accent}08`;
    if (tier === "Gold") return `${Colors.gold}08`;
    return Colors.surface;
  };

  const getCardIcon = (tier: SubscriptionTier) => {
    switch (tier) {
      case "Free":
        return "○";
      case "Premium":
        return "⭐";
      case "Gold":
        return "👑";
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={onBack}
          activeOpacity={0.7}
        >
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Upgrade</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Section */}
        <View style={styles.heroSection}>
          <LinearGradient
            colors={["#FFF8EB", "#FFF0D6"]}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.heroContent}>
            <Text style={styles.heroIcon}>🪷</Text>
            <Text style={styles.heroTitle}>Find Your Perfect Jodi</Text>
            <Text style={styles.heroSubtitle}>
              Unlock premium features to find meaningful connections that respect
              your values and traditions.
            </Text>
          </View>
        </View>

        {/* Pricing Cards */}
        <View style={styles.plansContainer}>
          {SUBSCRIPTION_PLANS.map((plan) => {
            const isSelected = selectedTier === plan.tier;
            const borderColor = getTierBorderColor(plan.tier, plan.isPopular);
            const bgColor = getTierBgColor(plan.tier, plan.isPopular);

            return (
              <TouchableOpacity
                key={plan.tier}
                style={[
                  styles.planCard,
                  {
                    borderColor: isSelected ? Colors.primary : borderColor,
                    backgroundColor: bgColor,
                  },
                  plan.isPopular && styles.popularCard,
                ]}
                onPress={() => handleSubscribe(plan.tier)}
                disabled={isProcessing}
                activeOpacity={0.85}
              >
                {/* Popular Badge */}
                {plan.isPopular && (
                  <View style={styles.popularBadge}>
                    <LinearGradient
                      colors={["#FFA000", "#FFB833"]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={StyleSheet.absoluteFill}
                    />
                    <Text style={styles.popularBadgeText}>Most Popular</Text>
                  </View>
                )}

                {/* Gold Badge */}
                {plan.tier === "Gold" && !plan.isPopular && (
                  <View style={[styles.popularBadge, { backgroundColor: Colors.gold }]}>
                    <Text style={[styles.popularBadgeText, { color: Colors.textPrimary }]}>
                      Best Value
                    </Text>
                  </View>
                )}

                {/* Card Header */}
                <View style={styles.planHeader}>
                  <Text style={styles.planIcon}>{getCardIcon(plan.tier)}</Text>
                  <Text style={styles.planName}>{plan.tier}</Text>
                </View>

                {/* Price */}
                <View style={styles.priceRow}>
                  <Text style={styles.priceAmount}>
                    {plan.price === 0 ? "Free" : `$${plan.price.toFixed(2)}`}
                  </Text>
                  {plan.price > 0 && (
                    <Text style={styles.pricePeriod}>/month</Text>
                  )}
                </View>

                {/* Features */}
                <View style={styles.featuresList}>
                  {plan.features.map((feature, index) => (
                    <View key={index} style={styles.featureRow}>
                      <Text style={styles.featureCheck}>✓</Text>
                      <Text style={styles.featureText}>{feature}</Text>
                    </View>
                  ))}
                </View>

                {/* Subscribe Button */}
                <View
                  style={[
                    styles.subscribeButton,
                    plan.tier === "Free"
                      ? styles.continueFreeButton
                      : plan.isPopular
                      ? styles.popularButton
                      : styles.goldButton,
                    isSelected && { opacity: 0.6 },
                  ]}
                >
                  {isProcessing && selectedTier === plan.tier ? (
                    <ActivityIndicator
                      size="small"
                      color={
                        plan.tier === "Free"
                          ? Colors.textSecondary
                          : Colors.textLight
                      }
                    />
                  ) : (
                    <Text
                      style={[
                        styles.subscribeButtonText,
                        plan.tier === "Free" && styles.continueFreeText,
                      ]}
                    >
                      {plan.tier === "Free"
                        ? "Continue Free"
                        : `Subscribe to ${plan.tier}`}
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Subscriptions auto-renew unless canceled. Cancel anytime in your
            account settings. Your payment will be processed securely via Stripe.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.backgroundDark,
    alignItems: "center",
    justifyContent: "center",
  },
  backIcon: {
    fontSize: 20,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  heroSection: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: BorderRadius.xl,
    overflow: "hidden",
  },
  heroContent: {
    alignItems: "center",
    paddingVertical: 28,
    paddingHorizontal: 24,
  },
  heroIcon: {
    fontSize: 40,
    marginBottom: 12,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: Colors.textPrimary,
    fontFamily: "Georgia",
    textAlign: "center",
    marginBottom: 8,
  },
  heroSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
  },
  plansContainer: {
    paddingHorizontal: 16,
    paddingTop: 20,
    gap: 16,
  },
  planCard: {
    borderRadius: BorderRadius.xl,
    borderWidth: 1.5,
    padding: 20,
    position: "relative",
    overflow: "hidden",
    ...Shadows.md,
  },
  popularCard: {
    borderWidth: 2,
    ...Shadows.lg,
  },
  popularBadge: {
    position: "absolute",
    top: 14,
    right: -28,
    paddingHorizontal: 28,
    paddingVertical: 4,
    transform: [{ rotate: "45deg" }],
  },
  popularBadgeText: {
    fontSize: 11,
    fontWeight: "800",
    color: Colors.textPrimary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  planHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  planIcon: {
    fontSize: 22,
  },
  planName: {
    fontSize: 20,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "baseline",
    marginBottom: 16,
  },
  priceAmount: {
    fontSize: 32,
    fontWeight: "800",
    color: Colors.textPrimary,
  },
  pricePeriod: {
    fontSize: 16,
    color: Colors.textTertiary,
    fontWeight: "500",
    marginLeft: 4,
  },
  featuresList: {
    gap: 10,
    marginBottom: 20,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  featureCheck: {
    fontSize: 16,
    color: Colors.likeGreen,
    fontWeight: "700",
    width: 20,
  },
  featureText: {
    fontSize: 15,
    color: Colors.textSecondary,
    flex: 1,
  },
  subscribeButton: {
    paddingVertical: 14,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  continueFreeButton: {
    backgroundColor: Colors.backgroundDark,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  popularButton: {
    backgroundColor: Colors.accent,
    ...Shadows.sm,
  },
  goldButton: {
    backgroundColor: Colors.primary,
    ...Shadows.sm,
  },
  subscribeButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.textLight,
  },
  continueFreeText: {
    color: Colors.textSecondary,
  },
  footer: {
    paddingHorizontal: 32,
    paddingTop: 24,
    paddingBottom: 16,
  },
  footerText: {
    fontSize: 12,
    color: Colors.textTertiary,
    textAlign: "center",
    lineHeight: 16,
  },
});

export default SubscriptionScreen;