// Jodi App - Root Application Component
// Handles auth flow: Welcome → Onboarding → Main App

import React, { useState, useCallback } from "react";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { View, StyleSheet, TouchableOpacity, Text } from "react-native";
import { Colors } from "./src/theme";
import { Profile, SubscriptionTier } from "./src/types";

// Screens
import WelcomeScreen from "./src/screens/WelcomeScreen";
import ProfileOnboarding from "./src/screens/ProfileOnboarding";
import HomeSwipeScreen from "./src/screens/HomeSwipeScreen";
import DailyPicksScreen from "./src/screens/DailyPicksScreen";
import ChatListScreen from "./src/screens/ChatListScreen";
import ChatRoomScreen from "./src/screens/ChatRoomScreen";
import ProfileScreen from "./src/screens/ProfileScreen";
import SubscriptionScreen from "./src/screens/SubscriptionScreen";
import AdminDashboardScreen from "./src/screens/AdminDashboardScreen";
import { TabNavigator } from "./src/navigation/AppNavigator";

type AppPhase = "welcome" | "onboarding" | "main";

interface ChatState {
  isOpen: boolean;
  matchId: string;
  matchedProfile: Profile;
  streak: number;
  score: number;
}

export default function App() {
  const [phase, setPhase] = useState<AppPhase>("welcome");
  const [activeTab, setActiveTab] = useState("swipe");
  const [isPremium, setIsPremium] = useState(false);
  const [showSubscription, setShowSubscription] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [chatState, setChatState] = useState<ChatState | null>(null);

  const handleGetStarted = useCallback(() => {
    setPhase("onboarding");
  }, []);

  const handleLogin = useCallback(() => {
    setPhase("main");
  }, []);

  const handleOnboardingComplete = useCallback(() => {
    setPhase("main");
  }, []);

  const handleUpgrade = useCallback(() => {
    setShowSubscription(true);
  }, []);

  const handleSubscriptionBack = useCallback(() => {
    setShowSubscription(false);
  }, []);

  const handleAdminBack = useCallback(() => {
    setShowAdmin(false);
  }, []);

  const handleSubscribe = useCallback((tier: SubscriptionTier) => {
    setIsPremium(tier === "Premium" || tier === "Gold");
    setShowSubscription(false);
  }, []);

  const handleLogout = useCallback(() => {
    setPhase("welcome");
  }, []);

  const handleChatPress = useCallback(
    (matchId: string, matchedProfile: Profile) => {
      setChatState({
        isOpen: true,
        matchId,
        matchedProfile,
        streak: matchedProfile.id === "prof-001" ? 3 : 1,
        score: matchedProfile.id === "prof-001" ? 82 : 75,
      });
    },
    []
  );

  const handleChatBack = useCallback(() => {
    setChatState(null);
  }, []);

  const handleMatchPress = useCallback((matchId: string) => {
    setActiveTab("chats");
  }, []);

  // If admin screen is open (overlays tabs)
  if (phase === "main" && showAdmin) {
    return (
      <SafeAreaProvider>
        <AdminDashboardScreen />
        <TouchableOpacity 
          style={styles.adminCloseBtn}
          onPress={handleAdminBack}
        >
          <Text style={styles.adminCloseText}>Exit Admin</Text>
        </TouchableOpacity>
      </SafeAreaProvider>
    );
  }

  // If subscription screen is open (overlays tabs)
  if (phase === "main" && showSubscription) {
    return (
      <SafeAreaProvider>
        <SubscriptionScreen
          onBack={handleSubscriptionBack}
          onSubscribe={handleSubscribe}
        />
      </SafeAreaProvider>
    );
  }

  const renderScreen = () => {
    switch (phase) {
      case "welcome":
        return (
          <WelcomeScreen
            onGetStarted={handleGetStarted}
            onLogin={handleLogin}
          />
        );

      case "onboarding":
        return (
          <ProfileOnboarding
            onComplete={handleOnboardingComplete}
            onBack={() => setPhase("welcome")}
          />
        );

      case "main":
        // If a chat room is open, show it full-screen (no tabs)
        if (chatState?.isOpen) {
          return (
            <ChatRoomScreen
              matchId={chatState.matchId}
              matchedProfile={chatState.matchedProfile}
              matchStreak={chatState.streak}
              matchScore={chatState.score}
              onBack={handleChatBack}
            />
          );
        }

        return (
          <TabNavigator
            activeTab={activeTab}
            onTabChange={setActiveTab}
          >
            {activeTab === "swipe" && (
              <HomeSwipeScreen
                dailySwipesRemaining={isPremium ? 999 : 20}
                maxDailySwipes={isPremium ? 999 : 20}
                onUpgradePress={handleUpgrade}
                onProfilePress={() => setActiveTab("profile")}
              />
            )}
            {activeTab === "picks" && (
              <DailyPicksScreen onMatchPress={handleMatchPress} />
            )}
            {activeTab === "chats" && (
              <ChatListScreen onChatPress={handleChatPress} />
            )}
            {activeTab === "profile" && (
              <ProfileScreen
                onUpgradePress={handleUpgrade}
                onLogout={handleLogout}
                onAdminPress={() => setShowAdmin(true)}
              />
            )}
          </TabNavigator>
        );

      default:
        return <WelcomeScreen onGetStarted={handleGetStarted} onLogin={handleLogin} />;
    }
  };

  return (
    <SafeAreaProvider>
      <View style={styles.root}>
        <StatusBar style={phase === "welcome" ? "light" : "dark"} />
        {renderScreen()}
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  adminCloseBtn: {
    position: "absolute",
    top: 50,
    right: 20,
    backgroundColor: Colors.textPrimary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    zIndex: 1000,
  },
  adminCloseText: {
    color: "#FFF",
    fontSize: 12,
    fontWeight: "700",
  },
});
