// Jodi App - Profile Screen
// User profile dashboard with edit, preferences, subscription, and settings

import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  Alert,
  Image,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Colors, BorderRadius, Shadows } from "../theme";
import { Profile, SubscriptionTier } from "../types";
import { fetchCurrentProfile, updateProfile } from "../services/api";
import { supabase } from "../services/supabase";

interface ProfileScreenProps {
  onUpgradePress: () => void;
  onLogout: () => void;
  onAdminPress?: () => void;
}

// Editable field component
const EditableField: React.FC<{
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  isEditing: boolean;
  placeholder?: string;
  multiline?: boolean;
}> = ({ label, value, onChangeText, isEditing, placeholder, multiline }) => (
  <View style={fieldStyles.container}>
    <Text style={fieldStyles.label}>{label}</Text>
    {isEditing ? (
      <TextInput
        style={[
          fieldStyles.input,
          multiline && { height: 80, textAlignVertical: "top", paddingTop: 10 },
        ]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={Colors.textTertiary}
        multiline={multiline}
      />
    ) : (
      <Text style={fieldStyles.value} numberOfLines={multiline ? 4 : 2}>
        {value || placeholder || "Not set"}
      </Text>
    )}
  </View>
);

const fieldStyles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.textTertiary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  value: {
    fontSize: 16,
    color: Colors.textPrimary,
    lineHeight: 22,
  },
  input: {
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.accent,
    borderRadius: BorderRadius.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 16,
    color: Colors.textPrimary,
  },
});

// Chip display (non-editable)
const InfoChip: React.FC<{ label: string }> = ({ label }) => (
  <View style={chipStyles.chip}>
    <Text style={chipStyles.text}>{label}</Text>
  </View>
);

const chipStyles = StyleSheet.create({
  chip: {
    backgroundColor: `${Colors.sandalwood}12`,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  text: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.textSecondary,
  },
});

const ProfileScreen: React.FC<ProfileScreenProps> = ({
  onUpgradePress,
  onLogout,
}) => {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Editable fields
  const [editName, setEditName] = useState("");
  const [editBio, setEditBio] = useState("");
  const [editOccupation, setEditOccupation] = useState("");
  const [editEducation, setEditEducation] = useState("");
  const [editLocation, setEditLocation] = useState("");

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    setIsLoading(true);
    try {
      const data = await fetchCurrentProfile();
      setProfile(data);
      setEditName(data.full_name);
      setEditBio(data.bio || "");
      setEditOccupation(data.occupation || "");
      setEditEducation(data.education || "");
      setEditLocation(data.location_name);
    } catch (error) {
      console.error("Failed to load profile:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateProfile({
        full_name: editName,
        bio: editBio,
        occupation: editOccupation,
        education: editEducation,
        location_name: editLocation,
      });
      setIsEditing(false);
      // Reload profile
      await loadProfile();
      Alert.alert("Saved!", "Your profile has been updated.");
    } catch (error) {
      Alert.alert("Error", "Could not save changes.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = () => {
    Alert.alert("Logout", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          await supabase.auth.signOut();
          onLogout();
        },
      },
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      "Delete Account",
      "This action is permanent. Your profile, matches, and messages will be deleted forever.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            Alert.alert(
              "Account Deleted",
              "We're sorry to see you go. Your account has been scheduled for deletion."
            );
          },
        },
      ]
    );
  };

  const getAge = (birthDate: string): number => {
    const birth = new Date(birthDate);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return age;
  };

  const getTierColor = (tier: SubscriptionTier): string => {
    switch (tier) {
      case "Premium":
        return Colors.accent;
      case "Gold":
        return Colors.gold;
      default:
        return Colors.textTertiary;
    }
  };

  const getTierIcon = (tier: SubscriptionTier): string => {
    switch (tier) {
      case "Premium":
        return "⭐";
      case "Gold":
        return "👑";
      default:
        return "○";
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!profile) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.loadingContainer}>
          <Text style={{ fontSize: 16, color: Colors.textSecondary }}>
            Could not load profile
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const age = getAge(profile.birth_date);
  const isFree = profile.subscription_tier === "Free";
  const isAdmin = true; // Mock admin status for this task

  return (
    <SafeAreaView style={styles.container}>


      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ===== Profile Header ===== */}
        <View style={styles.header}>
          {/* Photo */}
          <View style={styles.photoContainer}>
            <Image
              source={{
                uri:
                  profile.photos[0] ||
                  "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400",
              }}
              style={styles.photo}
              resizeMode="cover"
            />
            <TouchableOpacity style={styles.editPhotoButton} activeOpacity={0.7}>
              <Text style={styles.editPhotoIcon}>📷</Text>
            </TouchableOpacity>
          </View>

          {/* Name + Age */}
          <View style={styles.nameRow}>
            {isEditing ? (
              <TextInput
                style={styles.nameInput}
                value={editName}
                onChangeText={setEditName}
                placeholder="Your name"
              />
            ) : (
              <Text style={styles.name}>
                {profile.full_name}, {age}
              </Text>
            )}
          </View>

          {/* Location */}
          {isEditing ? (
            <TextInput
              style={styles.locationInput}
              value={editLocation}
              onChangeText={setEditLocation}
              placeholder="City, Country"
            />
          ) : (
            <Text style={styles.location}>📍 {profile.location_name}</Text>
          )}

          {/* Subscription Badge */}
          <View
            style={[
              styles.tierBadge,
              { backgroundColor: `${getTierColor(profile.subscription_tier)}18`, borderColor: getTierColor(profile.subscription_tier) },
            ]}
          >
            <Text style={styles.tierIcon}>{getTierIcon(profile.subscription_tier)}</Text>
            <Text style={[styles.tierText, { color: getTierColor(profile.subscription_tier) }]}>
              {profile.subscription_tier}
            </Text>
          </View>

          {/* Verified badge */}
          {profile.is_verified && (
            <View style={styles.verifiedBadge}>
              <Text style={styles.verifiedText}>✓ Verified</Text>
            </View>
          )}
        </View>

        {/* ===== Upgrade CTA (for free users) ===== */}
        {isFree && (
          <TouchableOpacity
            style={styles.upgradeCard}
            onPress={onUpgradePress}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={["#FFA000", "#FFB833", "#FFC966"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.upgradeContent}>
              <View style={styles.upgradeTextSection}>
                <Text style={styles.upgradeTitle}>Upgrade to Premium</Text>
                <Text style={styles.upgradeSubtitle}>
                  Unlimited swipes, see who likes you & more
                </Text>
              </View>
              <Text style={styles.upgradeArrow}>→</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* ===== Edit/Save Button ===== */}
        <View style={styles.editRow}>
          <TouchableOpacity
            style={[
              styles.editButton,
              isEditing && styles.saveButton,
            ]}
            onPress={() => {
              if (isEditing) {
                handleSave();
              } else {
                setIsEditing(true);
              }
            }}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.editButtonText,
                isEditing && styles.saveButtonText,
              ]}
            >
              {isSaving
                ? "Saving..."
                : isEditing
                ? "Save Changes"
                : "Edit Profile"}
            </Text>
          </TouchableOpacity>
          {isEditing && (
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => {
                setIsEditing(false);
                // Reset edits
                if (profile) {
                  setEditName(profile.full_name);
                  setEditBio(profile.bio || "");
                  setEditOccupation(profile.occupation || "");
                  setEditEducation(profile.education || "");
                  setEditLocation(profile.location_name);
                }
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ===== Profile Details ===== */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About Me</Text>
          <EditableField
            label="Bio"
            value={editBio}
            onChangeText={setEditBio}
            isEditing={isEditing}
            placeholder="Tell potential matches about yourself..."
            multiline
          />
          <View style={{ flexDirection: "row", gap: 16 }}>
            <View style={{ flex: 1 }}>
              <EditableField
                label="Occupation"
                value={editOccupation}
                onChangeText={setEditOccupation}
                isEditing={isEditing}
                placeholder="e.g. Software Engineer"
              />
            </View>
            <View style={{ flex: 1 }}>
              <EditableField
                label="Education"
                value={editEducation}
                onChangeText={setEditEducation}
                isEditing={isEditing}
                placeholder="e.g. IIT Delhi"
              />
            </View>
          </View>
        </View>

        {/* ===== My Preferences ===== */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>My Preferences</Text>

          <View style={styles.prefRow}>
            <Text style={styles.prefLabel}>Relationship Goal</Text>
            <InfoChip label={profile.relationship_goal} />
          </View>
          <View style={styles.prefRow}>
            <Text style={styles.prefLabel}>Religion</Text>
            <InfoChip label={profile.religion} />
          </View>
          <View style={styles.prefRow}>
            <Text style={styles.prefLabel}>Languages</Text>
            <View style={styles.chipRow}>
              {profile.languages_spoken.map((lang) => (
                <InfoChip key={lang} label={lang} />
              ))}
            </View>
          </View>
          <View style={styles.prefRow}>
            <Text style={styles.prefLabel}>Diet</Text>
            <InfoChip label={profile.diet} />
          </View>
          <View style={styles.prefRow}>
            <Text style={styles.prefLabel}>Family Values</Text>
            <InfoChip label={profile.family_values} />
          </View>
          <View style={styles.prefRow}>
            <Text style={styles.prefLabel}>Activity Level</Text>
            <InfoChip label={profile.activity_level} />
          </View>
          <View style={styles.prefRow}>
            <Text style={styles.prefLabel}>Immigration Status</Text>
            <InfoChip label={profile.immigration_status} />
          </View>
        </View>

        {/* ===== Settings ===== */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Settings</Text>

          {isAdmin && onAdminPress && (
            <TouchableOpacity
              style={styles.settingsButton}
              onPress={onAdminPress}
              activeOpacity={0.7}
            >
              <Text style={styles.settingsIcon}>🛠️</Text>
              <Text style={styles.settingsText}>Admin Dashboard</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.settingsButton}
            onPress={handleLogout}

          >
            <Text style={styles.settingsIcon}>🚪</Text>
            <Text style={styles.settingsText}>Logout</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.settingsButton, styles.deleteButton]}
            onPress={handleDeleteAccount}
            activeOpacity={0.7}
          >
            <Text style={styles.settingsIcon}>🗑️</Text>
            <Text style={[styles.settingsText, { color: Colors.error }]}>
              Delete Account
            </Text>
          </TouchableOpacity>
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
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  scrollContent: {
    paddingBottom: 40,
  },
  header: {
    alignItems: "center",
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  photoContainer: {
    position: "relative",
    marginBottom: 16,
  },
  photo: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: Colors.borderLight,
    borderWidth: 3,
    borderColor: Colors.surface,
    ...Shadows.md,
  },
  editPhotoButton: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2.5,
    borderColor: Colors.surface,
    ...Shadows.sm,
  },
  editPhotoIcon: {
    fontSize: 14,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  name: {
    fontSize: 24,
    fontWeight: "700",
    color: Colors.textPrimary,
    fontFamily: "Georgia",
  },
  nameInput: {
    fontSize: 24,
    fontWeight: "700",
    color: Colors.textPrimary,
    textAlign: "center",
    borderBottomWidth: 1.5,
    borderBottomColor: Colors.accent,
    paddingBottom: 2,
    minWidth: 150,
    fontFamily: "Georgia",
  },
  location: {
    fontSize: 15,
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  locationInput: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: "center",
    borderBottomWidth: 1.5,
    borderBottomColor: Colors.accent,
    paddingBottom: 2,
    minWidth: 120,
    marginBottom: 8,
  },
  tierBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    borderWidth: 1.5,
    gap: 6,
  },
  tierIcon: {
    fontSize: 14,
  },
  tierText: {
    fontSize: 13,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  verifiedBadge: {
    marginTop: 8,
    backgroundColor: `${Colors.likeGreen}15`,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.likeGreen,
  },
  verifiedText: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.likeGreen,
  },
  upgradeCard: {
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
    ...Shadows.md,
  },
  upgradeContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  upgradeTextSection: {
    flex: 1,
  },
  upgradeTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  upgradeSubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: "500",
  },
  upgradeArrow: {
    fontSize: 22,
    color: Colors.textPrimary,
    fontWeight: "700",
    marginLeft: 12,
  },
  editRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 12,
    marginBottom: 8,
    paddingHorizontal: 20,
  },
  editButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: BorderRadius.md,
    ...Shadows.sm,
  },
  saveButton: {
    backgroundColor: Colors.likeGreen,
  },
  editButtonText: {
    fontSize: 15,
    fontWeight: "700",
    color: Colors.textLight,
  },
  saveButtonText: {
    color: Colors.textLight,
  },
  cancelButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: Colors.textSecondary,
  },
  section: {
    marginTop: 4,
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: Colors.surface,
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: BorderRadius.lg,
    ...Shadows.sm,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.textPrimary,
    marginBottom: 14,
    fontFamily: "Georgia",
  },
  prefRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  prefLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: "500",
    flex: 1,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    flex: 1,
    justifyContent: "flex-end",
  },
  settingsButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 4,
    gap: 12,
  },
  settingsIcon: {
    fontSize: 18,
  },
  settingsText: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.textPrimary,
  },
  deleteButton: {
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    marginTop: 4,
    paddingTop: 16,
  },
});

export default ProfileScreen;