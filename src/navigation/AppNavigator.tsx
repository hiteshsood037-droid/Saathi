// Jodi App - Navigation Setup
// Bottom tab navigator for the main app experience

import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Colors } from "../theme";

// Since we can't install @react-navigation dependencies in this sandbox,
// we provide a simple tab navigator implementation

interface TabConfig {
  key: string;
  label: string;
  icon: string;
  activeIcon: string;
}

const TABS: TabConfig[] = [
  { key: "swipe", label: "Discover", icon: "♡", activeIcon: "♥" },
  { key: "picks", label: "Picks", icon: "☆", activeIcon: "★" },
  { key: "chats", label: "Chats", icon: "✉", activeIcon: "✉" },
  { key: "profile", label: "Profile", icon: "○", activeIcon: "●" },
];

interface TabNavigatorProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  children: React.ReactNode;
}

export const TabNavigator: React.FC<TabNavigatorProps> = ({
  activeTab,
  onTabChange,
  children,
}) => {
  return (
    <View style={{ flex: 1 }}>
      {/* Screen content */}
      <View style={{ flex: 1 }}>{children}</View>

      {/* Bottom Tab Bar */}
      <View style={tabStyles.tabBar}>
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={tabStyles.tabItem}
              onPress={() => onTabChange(tab.key)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  tabStyles.tabIcon,
                  isActive && tabStyles.tabIconActive,
                ]}
              >
                {isActive ? tab.activeIcon : tab.icon}
              </Text>
              <Text
                style={[
                  tabStyles.tabLabel,
                  isActive && tabStyles.tabLabelActive,
                ]}
              >
                {tab.label}
              </Text>
              {isActive && <View style={tabStyles.activeIndicator} />}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const tabStyles = StyleSheet.create({
  tabBar: {
    flexDirection: "row",
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    paddingBottom: 24,
    paddingTop: 8,
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 4,
  },
  tabIcon: {
    fontSize: 22,
    color: Colors.textTertiary,
    marginBottom: 2,
  },
  tabIconActive: {
    color: Colors.primary,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: Colors.textTertiary,
  },
  tabLabelActive: {
    color: Colors.primary,
    fontWeight: "700",
  },
  activeIndicator: {
    position: "absolute",
    top: -1,
    width: 24,
    height: 3,
    backgroundColor: Colors.primary,
    borderRadius: 1.5,
  },
});

export default TabNavigator;