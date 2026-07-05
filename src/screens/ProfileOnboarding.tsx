// Jodi App - Profile Onboarding Screen
// Comprehensive multi-step onboarding with Indian-inspired design

import React, { useState, useRef, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  Animated,
  StatusBar,
  Platform,
  KeyboardAvoidingView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Colors, Typography, BorderRadius, Shadows } from "../theme";
import {
  OnboardingData,
  DefaultOnboardingData,
  GenderType,
  DietType,
  RelationshipGoal,
  FamilyValues,
  ImmigrationStatus,
  ActivityLevel,
} from "../types";
import {
  GenderOptions,
  DietOptions,
  SmokingOptions,
  DrinkingOptions,
  RelationshipGoalOptions,
  FamilyValuesOptions,
  ImmigrationStatusOptions,
  ActivityLevelOptions,
  ReligionOptions,
  LanguageOptions,
  updateProfile,
} from "../services/api";

interface ProfileOnboardingProps {
  onComplete: () => void;
  onBack: () => void;
}

// Step definitions
const TOTAL_STEPS = 10;

const StepIndicator: React.FC<{ currentStep: number; totalSteps: number }> = ({
  currentStep,
  totalSteps,
}) => (
  <View style={stepStyles.container}>
    {Array.from({ length: totalSteps }).map((_, index) => (
      <View
        key={index}
        style={[
          stepStyles.dot,
          index <= currentStep ? stepStyles.activeDot : stepStyles.inactiveDot,
          index === currentStep && stepStyles.currentDot,
        ]}
      />
    ))}
  </View>
);

const stepStyles = StyleSheet.create({
  container: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 16,
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  activeDot: {
    backgroundColor: Colors.accent,
    width: 8,
    height: 8,
  },
  inactiveDot: {
    backgroundColor: Colors.border,
    width: 8,
    height: 8,
  },
  currentDot: {
    backgroundColor: Colors.primary,
    width: 24,
    height: 8,
    borderRadius: 4,
  },
});

// Reusable components
const SectionTitle: React.FC<{ title: string; subtitle?: string }> = ({
  title,
  subtitle,
}) => (
  <View style={{ marginBottom: 20 }}>
    <Text
      style={{
        fontSize: 24,
        fontWeight: "700",
        color: Colors.textPrimary,
        marginBottom: 4,
      }}
    >
      {title}
    </Text>
    {subtitle && (
      <Text
        style={{
          fontSize: 15,
          color: Colors.textSecondary,
          lineHeight: 21,
        }}
      >
        {subtitle}
      </Text>
    )}
  </View>
);

const ChipSelector: React.FC<{
  options: { label: string; value: string }[];
  selected: string | null;
  onSelect: (value: string) => void;
  multiSelect?: boolean;
  selectedValues?: string[];
  onToggle?: (value: string) => void;
}> = ({ options, selected, onSelect, multiSelect, selectedValues, onToggle }) => (
  <View style={chipStyles.container}>
    {options.map((option) => {
      const isSelected = multiSelect
        ? selectedValues?.includes(option.value)
        : selected === option.value;

      return (
        <TouchableOpacity
          key={option.value}
          style={[
            chipStyles.chip,
            isSelected ? chipStyles.selectedChip : chipStyles.unselectedChip,
          ]}
          onPress={() =>
            multiSelect ? onToggle?.(option.value) : onSelect(option.value)
          }
          activeOpacity={0.7}
        >
          <Text
            style={[
              chipStyles.chipText,
              isSelected
                ? chipStyles.selectedChipText
                : chipStyles.unselectedChipText,
            ]}
          >
            {option.label}
          </Text>
        </TouchableOpacity>
      );
    })}
  </View>
);

const chipStyles = StyleSheet.create({
  container: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  chip: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
  },
  selectedChip: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  unselectedChip: {
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
  },
  chipText: {
    fontSize: 15,
    fontWeight: "600",
  },
  selectedChipText: {
    color: Colors.textLight,
  },
  unselectedChipText: {
    color: Colors.textSecondary,
  },
});

const StepNavigation: React.FC<{
  currentStep: number;
  totalSteps: number;
  canGoNext: boolean;
  onNext: () => void;
  onBack: () => void;
  isLoading?: boolean;
}> = ({ currentStep, totalSteps, canGoNext, onNext, onBack, isLoading }) => (
  <View style={navStyles.container}>
    {currentStep > 0 ? (
      <TouchableOpacity
        style={navStyles.backButton}
        onPress={onBack}
        activeOpacity={0.7}
      >
        <Text style={navStyles.backText}>← Back</Text>
      </TouchableOpacity>
    ) : (
      <View style={{ flex: 1 }} />
    )}

    <TouchableOpacity
      style={[
        navStyles.nextButton,
        !canGoNext && navStyles.nextButtonDisabled,
      ]}
      onPress={onNext}
      disabled={!canGoNext || isLoading}
      activeOpacity={0.8}
    >
      {isLoading ? (
        <ActivityIndicator color={Colors.textLight} size="small" />
      ) : (
        <Text style={navStyles.nextText}>
          {currentStep === totalSteps - 1 ? "Complete" : "Next →"}
        </Text>
      )}
    </TouchableOpacity>
  </View>
);

const navStyles = StyleSheet.create({
  container: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 4,
  },
  backButton: {
    paddingVertical: 12,
    paddingRight: 20,
  },
  backText: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.textSecondary,
  },
  nextButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: BorderRadius.md,
    ...Shadows.sm,
  },
  nextButtonDisabled: {
    backgroundColor: Colors.border,
  },
  nextText: {
    color: Colors.textLight,
    fontSize: 16,
    fontWeight: "700",
  },
});

const InputField: React.FC<{
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: "default" | "numeric" | "email-address";
}> = ({ label, value, onChangeText, placeholder, multiline, keyboardType }) => (
  <View style={{ marginBottom: 16 }}>
    <Text
      style={{
        fontSize: 14,
        fontWeight: "600",
        color: Colors.textSecondary,
        marginBottom: 8,
        textTransform: "uppercase",
        letterSpacing: 0.5,
      }}
    >
      {label}
    </Text>
    <TextInput
      style={[
        inputStyles.input,
        multiline && { height: 100, textAlignVertical: "top", paddingTop: 12 },
      ]}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={Colors.textTertiary}
      multiline={multiline}
      keyboardType={keyboardType}
    />
  </View>
);

const inputStyles = StyleSheet.create({
  input: {
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: Colors.textPrimary,
  },
});

const ProfileOnboarding: React.FC<ProfileOnboardingProps> = ({
  onComplete,
  onBack,
}) => {
  const [data, setData] = useState<OnboardingData>(DefaultOnboardingData);
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const updateField = useCallback(
    <K extends keyof OnboardingData>(field: K, value: OnboardingData[K]) => {
      setData((prev) => ({ ...prev, [field]: value }));
    },
    []
  );

  const toggleLanguage = useCallback(
    (lang: string) => {
      setData((prev) => ({
        ...prev,
        languages_spoken: prev.languages_spoken.includes(lang)
          ? prev.languages_spoken.filter((l) => l !== lang)
          : [...prev.languages_spoken, lang],
      }));
    },
    []
  );

  const photoPlaceholders = [
    "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400",
    "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400",
    "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400",
  ];

  const canGoNext = (): boolean => {
    switch (data.step) {
      case 0:
        return data.full_name.length >= 2 && data.birth_date.length >= 8;
      case 1:
        return data.gender !== null;
      case 2:
        return data.photos.length > 0;
      case 3:
        return data.location_name.length > 0;
      case 4:
        return (
          data.occupation.length > 0 &&
          data.education.length > 0
        );
      case 5:
        return data.religion.length > 0;
      case 6:
        return data.relationship_goal !== null;
      case 7:
        return (
          data.immigration_status !== null &&
          data.family_values !== null &&
          data.activity_level !== null
        );
      case 8:
        return data.languages_spoken.length > 0;
      case 9:
        return true; // Bio is optional
      default:
        return false;
    }
  };

  const handleNext = async () => {
    if (data.step === TOTAL_STEPS - 1) {
      // Final step - submit
      setIsLoading(true);
      try {
        await updateProfile(data);
        onComplete();
      } catch (error) {
        Alert.alert("Error", "Could not save your profile. Please try again.");
      } finally {
        setIsLoading(false);
      }
    } else {
      setData((prev) => ({ ...prev, step: prev.step + 1 }));
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    }
  };

  const handleBack = () => {
    if (data.step === 0) {
      onBack();
    } else {
      setData((prev) => ({ ...prev, step: prev.step - 1 }));
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    }
  };

  const renderStep = () => {
    switch (data.step) {
      case 0:
        return (
          <View>
            <SectionTitle
              title="Welcome! What's your name?"
              subtitle="We'll use this to create your profile."
            />
            <InputField
              label="Full Name"
              value={data.full_name}
              onChangeText={(v) => updateField("full_name", v)}
              placeholder="e.g., Priya Sharma"
            />
            <InputField
              label="Date of Birth"
              value={data.birth_date}
              onChangeText={(v) => updateField("birth_date", v)}
              placeholder="YYYY-MM-DD"
              keyboardType="numeric"
            />
          </View>
        );

      case 1:
        return (
          <View>
            <SectionTitle
              title="How do you identify?"
              subtitle="Your gender will be shown on your profile."
            />
            <ChipSelector
              options={GenderOptions}
              selected={data.gender}
              onSelect={(v) => updateField("gender", v as GenderType)}
            />
          </View>
        );

      case 2:
        return (
          <View>
            <SectionTitle
              title="Add your photos"
              subtitle="Upload at least one photo to get started. Profiles with photos get 10x more matches."
            />
            <View style={{ flexDirection: "row", gap: 12, marginTop: 8 }}>
              {[0, 1, 2].map((index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    {
                      width: 100,
                      height: 130,
                      borderRadius: BorderRadius.lg,
                      backgroundColor: Colors.surface,
                      borderWidth: 1.5,
                      borderColor: Colors.border,
                      borderStyle: "dashed",
                      alignItems: "center",
                      justifyContent: "center",
                      overflow: "hidden",
                    },
                    data.photos[index] && {
                      borderStyle: "solid",
                      borderColor: Colors.primary,
                    },
                  ]}
                  onPress={() => {
                    // In production, launch image picker
                    const newPhotos = [...data.photos];
                    newPhotos[index] =
                      photoPlaceholders[index] ||
                      "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400";
                    updateField("photos", newPhotos);
                  }}
                  activeOpacity={0.7}
                >
                  {data.photos[index] ? (
                    <View style={{ flex: 1, width: "100%" }}>
                      <View
                        style={{
                          flex: 1,
                          backgroundColor: Colors.primaryLight,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Text style={{ fontSize: 30, color: Colors.textLight }}>
                          📷
                        </Text>
                      </View>
                    </View>
                  ) : (
                    <View style={{ alignItems: "center" }}>
                      <Text style={{ fontSize: 28, marginBottom: 4 }}>+</Text>
                      <Text
                        style={{
                          fontSize: 11,
                          color: Colors.textTertiary,
                          fontWeight: "500",
                        }}
                      >
                        {index === 0 ? "Required" : "Optional"}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>
            <Text
              style={{
                marginTop: 12,
                fontSize: 13,
                color: Colors.textTertiary,
              }}
            >
              Tap to add photos (mock: auto-fills placeholder)
            </Text>
          </View>
        );

      case 3:
        return (
          <View>
            <SectionTitle
              title="Where are you located?"
              subtitle="Your location helps us find matches near you."
            />
            <InputField
              label="City, Country"
              value={data.location_name}
              onChangeText={(v) => updateField("location_name", v)}
              placeholder="e.g., Bangalore, India"
            />
            <InputField
              label="Height (cm)"
              value={data.height_cm}
              onChangeText={(v) => updateField("height_cm", v)}
              placeholder="e.g., 165"
              keyboardType="numeric"
            />
          </View>
        );

      case 4:
        return (
          <View>
            <SectionTitle
              title="Tell us about your background"
              subtitle="Your career and education info helps us find compatible matches."
            />
            <InputField
              label="Occupation"
              value={data.occupation}
              onChangeText={(v) => updateField("occupation", v)}
              placeholder="e.g., Software Engineer"
            />
            <InputField
              label="Education"
              value={data.education}
              onChangeText={(v) => updateField("education", v)}
              placeholder="e.g., IIT Delhi, MBA"
            />
          </View>
        );

      case 5:
        return (
          <View>
            <SectionTitle
              title="Faith & Community"
              subtitle="Your religion helps us find culturally aligned matches."
            />
            <View style={chipStyles.container}>
              {ReligionOptions.map((religion) => (
                <TouchableOpacity
                  key={religion}
                  style={[
                    chipStyles.chip,
                    data.religion === religion
                      ? chipStyles.selectedChip
                      : chipStyles.unselectedChip,
                  ]}
                  onPress={() => updateField("religion", religion)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      chipStyles.chipText,
                      data.religion === religion
                        ? chipStyles.selectedChipText
                        : chipStyles.unselectedChipText,
                    ]}
                  >
                    {religion}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={{ marginTop: 20 }}>
              <InputField
                label="Caste (optional)"
                value={data.caste}
                onChangeText={(v) => updateField("caste", v)}
                placeholder="e.g., Iyer, Patel, Sharma"
              />
            </View>
          </View>
        );

      case 6:
        return (
          <View>
            <SectionTitle
              title="What are you looking for?"
              subtitle="Being clear about your intentions helps find the right match."
            />
            <ChipSelector
              options={RelationshipGoalOptions}
              selected={data.relationship_goal}
              onSelect={(v) =>
                updateField("relationship_goal", v as RelationshipGoal)
              }
            />
          </View>
        );

      case 7:
        return (
          <View>
            <SectionTitle
              title="Tell us more about you"
              subtitle="These preferences help us find compatible matches."
            />
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={{ marginBottom: 20 }}>
                <Text style={{
                  fontSize: 14,
                  fontWeight: "600",
                  color: Colors.textSecondary,
                  marginBottom: 10,
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                }}>
                  Immigration Status
                </Text>
                <ChipSelector
                  options={ImmigrationStatusOptions}
                  selected={data.immigration_status}
                  onSelect={(v) =>
                    updateField("immigration_status", v as ImmigrationStatus)
                  }
                />
              </View>

              <View style={{ marginBottom: 20 }}>
                <Text style={{
                  fontSize: 14,
                  fontWeight: "600",
                  color: Colors.textSecondary,
                  marginBottom: 10,
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                }}>
                  Family Values
                </Text>
                <ChipSelector
                  options={FamilyValuesOptions}
                  selected={data.family_values}
                  onSelect={(v) =>
                    updateField("family_values", v as FamilyValues)
                  }
                />
              </View>

              <View style={{ marginBottom: 20 }}>
                <Text style={{
                  fontSize: 14,
                  fontWeight: "600",
                  color: Colors.textSecondary,
                  marginBottom: 10,
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                }}>
                  Activity Level
                </Text>
                <ChipSelector
                  options={ActivityLevelOptions}
                  selected={data.activity_level}
                  onSelect={(v) =>
                    updateField("activity_level", v as ActivityLevel)
                  }
                />
              </View>

              <View style={{ marginBottom: 16 }}>
                <Text style={{
                  fontSize: 14,
                  fontWeight: "600",
                  color: Colors.textSecondary,
                  marginBottom: 10,
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                }}>
                  Diet
                </Text>
                <ChipSelector
                  options={DietOptions}
                  selected={data.diet}
                  onSelect={(v) => updateField("diet", v as DietType)}
                />
              </View>

              <View style={{ marginBottom: 16 }}>
                <Text style={{
                  fontSize: 14,
                  fontWeight: "600",
                  color: Colors.textSecondary,
                  marginBottom: 10,
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                }}>
                  Smoking
                </Text>
                <ChipSelector
                  options={SmokingOptions}
                  selected={data.smoking_pref}
                  onSelect={(v) => updateField("smoking_pref", v)}
                />
              </View>

              <View style={{ marginBottom: 16 }}>
                <Text style={{
                  fontSize: 14,
                  fontWeight: "600",
                  color: Colors.textSecondary,
                  marginBottom: 10,
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                }}>
                  Drinking
                </Text>
                <ChipSelector
                  options={DrinkingOptions}
                  selected={data.drinking_pref}
                  onSelect={(v) => updateField("drinking_pref", v)}
                />
              </View>
            </ScrollView>
          </View>
        );

      case 8:
        return (
          <View>
            <SectionTitle
              title="Which languages do you speak?"
              subtitle="Select all that apply."
            />
            <View style={chipStyles.container}>
              {LanguageOptions.map((lang) => (
                <TouchableOpacity
                  key={lang}
                  style={[
                    chipStyles.chip,
                    data.languages_spoken.includes(lang)
                      ? chipStyles.selectedChip
                      : chipStyles.unselectedChip,
                  ]}
                  onPress={() => toggleLanguage(lang)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      chipStyles.chipText,
                      data.languages_spoken.includes(lang)
                        ? chipStyles.selectedChipText
                        : chipStyles.unselectedChipText,
                    ]}
                  >
                    {lang}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        );

      case 9:
        return (
          <View>
            <SectionTitle
              title="Write a short bio"
              subtitle="Tell potential matches what makes you unique. This is your chance to shine!"
            />
            <InputField
              label="About Me"
              value={data.bio}
              onChangeText={(v) => updateField("bio", v)}
              placeholder="I'm a passionate software engineer who loves chai, long walks, and weekend cooking experiments..."
              multiline
            />
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.background }}>
      <StatusBar barStyle="dark-content" />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {/* Header */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: 20,
            paddingTop: 8,
          }}
        >
          <Text
            style={{
              fontSize: 24,
              fontWeight: "800",
              color: Colors.primary,
              fontFamily: "Georgia",
            }}
          >
            Jodi
          </Text>
          <Text
            style={{
              fontSize: 14,
              color: Colors.textTertiary,
              fontWeight: "500",
            }}
          >
            Step {data.step + 1} of {TOTAL_STEPS}
          </Text>
        </View>

        {/* Step Indicator */}
        <StepIndicator
          currentStep={data.step}
          totalSteps={TOTAL_STEPS}
        />

        {/* Step Content */}
        <ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingHorizontal: 24,
            paddingBottom: 20,
          }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {renderStep()}
        </ScrollView>

        {/* Navigation */}
        <View
          style={{
            paddingHorizontal: 20,
            borderTopWidth: 1,
            borderTopColor: Colors.borderLight,
            backgroundColor: Colors.surface,
          }}
        >
          <StepNavigation
            currentStep={data.step}
            totalSteps={TOTAL_STEPS}
            canGoNext={canGoNext()}
            onNext={handleNext}
            onBack={handleBack}
            isLoading={isLoading}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default ProfileOnboarding;