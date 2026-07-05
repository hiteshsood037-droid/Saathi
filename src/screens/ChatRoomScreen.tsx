// Jodi App - Chat Room Screen
// Real-time messaging with AI Icebreaker Questions and Match Streaks

import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Animated,
  Image,
  Alert,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Colors, BorderRadius, Shadows } from "../theme";
import { Message, Profile } from "../types";
import {
  fetchMessages,
  sendMessage,
  generateIcebreaker,
} from "../services/api";
import StreakIndicator from "../components/StreakIndicator";

interface ChatRoomScreenProps {
  matchId: string;
  matchedProfile: Profile;
  matchStreak: number;
  matchScore: number;
  onBack: () => void;
}

const ChatRoomScreen: React.FC<ChatRoomScreenProps> = ({
  matchId,
  matchedProfile,
  matchStreak,
  matchScore,
  onBack,
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [showIcebreakers, setShowIcebreakers] = useState(false);
  const [icebreakers, setIcebreakers] = useState<string[]>([]);
  const [isLoadingIcebreakers, setIsLoadingIcebreakers] = useState(false);
  const [newMsgCount, setNewMsgCount] = useState(0);

  const flatListRef = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);
  const icebreakerSlideAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Load messages
  useEffect(() => {
    loadMessages();

    // Simulate real-time subscription: poll every 5 seconds
    const interval = setInterval(() => {
      loadMessages(true);
    }, 5000);
    return () => clearInterval(interval);
  }, [matchId]);

  // Pulse animation for streak
  useEffect(() => {
    if (matchStreak > 0) {
      const animation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
        ])
      );
      animation.start();
      return () => animation.stop();
    }
  }, [matchStreak, pulseAnim]);

  const loadMessages = async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const data = await fetchMessages(matchId);
      setMessages(data);
    } catch (error) {
      console.error("Failed to load messages:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadIcebreakers = async () => {
    setIsLoadingIcebreakers(true);
    try {
      // Generate 3 different icebreakers
      const prompts = await Promise.all([
        generateIcebreaker(matchId),
        generateIcebreaker(matchId),
        generateIcebreaker(matchId),
      ]);
      setIcebreakers(prompts);
      setShowIcebreakers(true);

      // Animate panel in
      Animated.spring(icebreakerSlideAnim, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }).start();
    } catch (error) {
      console.error("Failed to load icebreakers:", error);
    } finally {
      setIsLoadingIcebreakers(false);
    }
  };

  const handleSendMessage = async () => {
    const trimmed = inputText.trim();
    if (!trimmed || isSending) return;

    setIsSending(true);
    setInputText("");

    // Optimistic update
    const tempId = `temp-${Date.now()}`;
    const optimisticMsg: Message = {
      id: tempId,
      match_id: matchId,
      sender_id: "current-user",
      content: trimmed,
      is_read: false,
      is_flagged: false,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticMsg]);

    try {
      await sendMessage(matchId, trimmed);
      setNewMsgCount((prev) => prev + 1);
      // Reload to get the real message back
      await loadMessages(true);
    } catch (error) {
      // Remove optimistic message on error
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      Alert.alert("Error", "Could not send message. Please try again.");
    } finally {
      setIsSending(false);
    }
  };

  const handleIcebreakerSelect = (text: string) => {
    setInputText(text);
    setShowIcebreakers(false);
    inputRef.current?.focus();
  };

  const closeIcebreakers = () => {
    Animated.timing(icebreakerSlideAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => setShowIcebreakers(false));
  };

  const getAge = (birthDate: string): number => {
    const birth = new Date(birthDate);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return age;
  };

  const formatTime = (dateStr: string): string => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor(
      (now.getTime() - date.getTime()) / 86400000
    );

    if (diffDays === 0) {
      return date.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      });
    }
    if (diffDays === 1) return "Yesterday";
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isMine = item.sender_id === "current-user";
    const isFirstOfDay = true; // Simplified

    return (
      <View
        style={[
          msgStyles.messageRow,
          isMine ? msgStyles.myMessageRow : msgStyles.theirMessageRow,
        ]}
      >
        {/* Their profile photo */}
        {!isMine && (
          <Image
            source={{
              uri:
                matchedProfile.photos[0] ||
                "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100",
            }}
            style={msgStyles.avatar}
          />
        )}

        <View
          style={[
            msgStyles.bubble,
            isMine ? msgStyles.myBubble : msgStyles.theirBubble,
            item.is_flagged && msgStyles.flaggedBubble,
          ]}
        >
          <Text
            style={[
              msgStyles.messageText,
              isMine ? msgStyles.myMessageText : msgStyles.theirMessageText,
            ]}
          >
            {item.is_flagged
              ? "⚠️ This message has been flagged"
              : item.content}
          </Text>
          <Text
            style={[
              msgStyles.timeText,
              isMine ? msgStyles.myTimeText : msgStyles.theirTimeText,
            ]}
          >
            {formatTime(item.created_at)}
            {isMine && (
              <Text style={msgStyles.readStatus}>
                {" "}
                {item.is_read ? "✓✓" : "✓"}
              </Text>
            )}
          </Text>
        </View>
      </View>
    );
  };

  const renderDateSeparator = (date: string) => (
    <View style={msgStyles.dateSeparator}>
      <View style={msgStyles.dateLine} />
      <Text style={msgStyles.dateText}>{date}</Text>
      <View style={msgStyles.dateLine} />
    </View>
  );

  const renderHeader = () => (
    <View style={headerStyles.container}>
      <TouchableOpacity
        style={headerStyles.backButton}
        onPress={onBack}
        activeOpacity={0.7}
      >
        <Text style={headerStyles.backIcon}>←</Text>
      </TouchableOpacity>

      <Image
        source={{
          uri:
            matchedProfile.photos[0] ||
            "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100",
        }}
        style={headerStyles.avatar}
      />

      <View style={headerStyles.info}>
        <View style={headerStyles.nameRow}>
          <Text style={headerStyles.name} numberOfLines={1}>
            {matchedProfile.full_name.split(" ")[0]}
          </Text>
          <Text style={headerStyles.age}>
            {getAge(matchedProfile.birth_date)}
          </Text>
        </View>
        <Text style={headerStyles.subtitle} numberOfLines={1}>
          {matchedProfile.location_name} · {matchedProfile.occupation || "Professional"}
        </Text>
      </View>

      {/* Streak indicator */}
      {matchStreak > 0 && (
        <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
          <StreakIndicator streakCount={matchStreak} size="small" />
        </Animated.View>
      )}

      {/* Jodi Score */}
      <View style={headerStyles.scoreBadge}>
        <Text style={headerStyles.scoreText}>{matchScore}</Text>
      </View>
    </View>
  );

  // Group messages for rendering
  const groupedMessages = messages; // Simplified

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      {renderHeader()}

      {/* AI Icebreaker Panel */}
      {showIcebreakers && (
        <Animated.View
          style={[
            icebreakerStyles.panel,
            {
              opacity: icebreakerSlideAnim,
              transform: [
                {
                  translateY: icebreakerSlideAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-50, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <LinearGradient
            colors={["#FFF8EB", "#FFF0D6"]}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
          <View style={icebreakerStyles.header}>
            <View style={icebreakerStyles.titleRow}>
              <Text style={icebreakerStyles.botIcon}>🤖</Text>
              <Text style={icebreakerStyles.title}>AI Icebreaker</Text>
            </View>
            <TouchableOpacity
              onPress={closeIcebreakers}
              activeOpacity={0.7}
            >
              <Text style={icebreakerStyles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          <Text style={icebreakerStyles.subtitle}>
            Based on {matchedProfile.full_name.split(" ")[0]}'s profile —{" "}
            {matchedProfile.occupation}, {matchedProfile.religion},{" "}
            {matchedProfile.languages_spoken.slice(0, 2).join(" & ")}
          </Text>

          {isLoadingIcebreakers ? (
            <ActivityIndicator
              color={Colors.primary}
              style={{ marginVertical: 16 }}
            />
          ) : (
            <View style={icebreakerStyles.questionsList}>
              {icebreakers.map((question, index) => (
                <TouchableOpacity
                  key={index}
                  style={icebreakerStyles.questionItem}
                  onPress={() => handleIcebreakerSelect(question)}
                  activeOpacity={0.7}
                >
                  <Text style={icebreakerStyles.questionIcon}>
                    {["💬", "✨", "🪷"][index]}
                  </Text>
                  <Text style={icebreakerStyles.questionText} numberOfLines={2}>
                    {question}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </Animated.View>
      )}

      {/* Messages */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
      >
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={groupedMessages}
            keyExtractor={(item) => item.id}
            renderItem={renderMessage}
            contentContainerStyle={styles.messageList}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() =>
              flatListRef.current?.scrollToEnd({ animated: true })
            }
            ListEmptyComponent={
              <View style={styles.emptyChat}>
                <Text style={styles.emptyChatIcon}>💬</Text>
                <Text style={styles.emptyChatTitle}>
                  No messages yet
                </Text>
                <Text style={styles.emptyChatSubtitle}>
                  Say hello to {matchedProfile.full_name.split(" ")[0]}! Use an
                  icebreaker above to start the conversation.
                </Text>
              </View>
            }
          />
        )}

        {/* Input Bar */}
        <View style={inputStyles.container}>
          <TouchableOpacity
            style={inputStyles.icebreakerButton}
            onPress={loadIcebreakers}
            activeOpacity={0.7}
          >
            <Text style={inputStyles.icebreakerIcon}>💡</Text>
          </TouchableOpacity>

          <View style={inputStyles.inputWrapper}>
            <TextInput
              ref={inputRef}
              style={inputStyles.input}
              value={inputText}
              onChangeText={setInputText}
              placeholder={`Message ${matchedProfile.full_name.split(" ")[0]}...`}
              placeholderTextColor={Colors.textTertiary}
              multiline
              maxLength={500}
              returnKeyType="send"
              onSubmitEditing={handleSendMessage}
              blurOnSubmit
            />
          </View>

          <TouchableOpacity
            style={[
              inputStyles.sendButton,
              !inputText.trim() && inputStyles.sendButtonDisabled,
            ]}
            onPress={handleSendMessage}
            disabled={!inputText.trim() || isSending}
            activeOpacity={0.8}
          >
            {isSending ? (
              <ActivityIndicator size="small" color={Colors.textLight} />
            ) : (
              <Text style={inputStyles.sendIcon}>➤</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
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
  messageList: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexGrow: 1,
  },
  emptyChat: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
    paddingTop: 60,
  },
  emptyChatIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyChatTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  emptyChatSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
  },
});

const headerStyles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
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
    marginRight: 10,
  },
  backIcon: {
    fontSize: 20,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.borderLight,
    marginRight: 10,
  },
  info: {
    flex: 1,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  name: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.textPrimary,
    maxWidth: 140,
  },
  age: {
    fontSize: 14,
    fontWeight: "400",
    color: Colors.textSecondary,
    marginLeft: 4,
  },
  subtitle: {
    fontSize: 12,
    color: Colors.textTertiary,
    marginTop: 1,
  },
  scoreBadge: {
    backgroundColor: `${Colors.accent}20`,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
    marginLeft: 8,
  },
  scoreText: {
    fontSize: 12,
    fontWeight: "800",
    color: Colors.accent,
  },
});

const msgStyles = StyleSheet.create({
  messageRow: {
    flexDirection: "row",
    marginBottom: 6,
    alignItems: "flex-end",
    maxWidth: "80%",
  },
  myMessageRow: {
    alignSelf: "flex-end",
  },
  theirMessageRow: {
    alignSelf: "flex-start",
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginRight: 6,
    marginBottom: 4,
  },
  bubble: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: BorderRadius.lg,
    maxWidth: "100%",
  },
  myBubble: {
    backgroundColor: Colors.primary,
    borderBottomRightRadius: 4,
  },
  theirBubble: {
    backgroundColor: Colors.surface,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  flaggedBubble: {
    backgroundColor: Colors.error + "15",
    borderColor: Colors.error + "30",
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  myMessageText: {
    color: Colors.textLight,
  },
  theirMessageText: {
    color: Colors.textPrimary,
  },
  timeText: {
    fontSize: 11,
    marginTop: 4,
  },
  myTimeText: {
    color: "rgba(255,255,255,0.65)",
    textAlign: "right",
  },
  theirTimeText: {
    color: Colors.textTertiary,
  },
  readStatus: {
    fontSize: 10,
  },
  dateSeparator: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 16,
  },
  dateLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
  },
  dateText: {
    marginHorizontal: 12,
    fontSize: 12,
    color: Colors.textTertiary,
    fontWeight: "600",
  },
});

const inputStyles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  icebreakerButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: `${Colors.gold}20`,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
    marginBottom: 2,
  },
  icebreakerIcon: {
    fontSize: 18,
  },
  inputWrapper: {
    flex: 1,
    backgroundColor: Colors.backgroundDark,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === "ios" ? 8 : 6,
    maxHeight: 100,
  },
  input: {
    fontSize: 15,
    color: Colors.textPrimary,
    maxHeight: 80,
    padding: 0,
  },
  sendButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
    marginBottom: 2,
    ...Shadows.sm,
  },
  sendButtonDisabled: {
    backgroundColor: Colors.border,
  },
  sendIcon: {
    fontSize: 16,
    color: Colors.textLight,
  },
});

const icebreakerStyles = StyleSheet.create({
  panel: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingHorizontal: 16,
    paddingVertical: 12,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  botIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  title: {
    fontSize: 15,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  closeText: {
    fontSize: 16,
    color: Colors.textTertiary,
    fontWeight: "600",
    padding: 4,
  },
  subtitle: {
    fontSize: 12,
    color: Colors.textTertiary,
    marginBottom: 10,
    lineHeight: 16,
  },
  questionsList: {
    gap: 8,
  },
  questionItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  questionIcon: {
    fontSize: 16,
    marginRight: 10,
  },
  questionText: {
    flex: 1,
    fontSize: 14,
    color: Colors.textPrimary,
    fontWeight: "500",
    lineHeight: 18,
  },
});

export default ChatRoomScreen;