/**
 * Help & Support Screen
 *
 * Chat-based support system with conversation list and messaging.
 * Integrates with Slack for real-time support communication.
 *
 * Features:
 * - Conversation list view with past chats
 * - Real-time messaging with support team
 * - Topic selection for new conversations
 * - Message polling for live updates
 * - Authentication required
 */

import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { router, Stack, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SuccessModal } from '@/components/bible/SuccessModal';
import { IconHelp } from '@/components/ui/icons';
import { fontSizes, fontWeights, type getColors, spacing } from '@/constants/bible-design-tokens';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import {
  getSupportConversations,
  getSupportMessages,
  postSupportConversation,
  postSupportMessage,
  type SupportConversation,
  type SupportMessage,
} from '@/lib/api/support';

type ViewState = 'list' | 'chat' | 'newChat';

const SUPPORT_TOPICS = [
  'Report an App problem',
  'Login/Password',
  'Suggestions and ideas',
  'Other',
] as const;

export default function HelpScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { isAuthenticated } = useAuth();
  const styles = useMemo(() => createStyles(colors), [colors]);

  // -- State --
  const [view, setView] = useState<ViewState>('list');
  const [conversations, setConversations] = useState<SupportConversation[]>([]);
  const [currentConvId, setCurrentConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [selectedTopic, setSelectedTopic] = useState<string>('');
  const [showTopicPicker, setShowTopicPicker] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [successModalVisible, setSuccessModalVisible] = useState(false);
  const [lastVisited, setLastVisited] = useState<string | null>(null);

  const flatListRef = useRef<FlatList>(null);

  // -- Data Loading --

  const loadConversations = useCallback(async () => {
    if (!isAuthenticated) return;
    setIsLoading(true);
    try {
      const { data } = await getSupportConversations();
      if (data) {
        setConversations(data.conversations);
      }
    } catch (error) {
      console.error('Failed to load conversations:', error);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  const loadMessages = useCallback(async (id: string) => {
    try {
      const { data } = await getSupportMessages(id);
      if (data) {
        setMessages(data.messages);
      }
    } catch (error) {
      console.error('Failed to load messages:', error);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      const updateVisitTime = async () => {
        try {
          const previousVisit = await AsyncStorage.getItem('last_visited_help_at');
          setLastVisited(previousVisit);
          await AsyncStorage.setItem('last_visited_help_at', new Date().toISOString());
        } catch (error) {
          console.error('Failed to update visit time:', error);
        }
      };

      loadConversations();
      updateVisitTime();
    }, [loadConversations])
  );

  const handleBackPress = useCallback(async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (view === 'chat' || view === 'newChat') {
      setView('list');
      setCurrentConvId(null);
      setSelectedTopic('');
      setInputText('');
      loadConversations();
      setLastVisited(new Date().toISOString());
    } else {
      router.back();
    }
  }, [view, loadConversations]);

  useEffect(() => {
    const backAction = () => {
      if (view !== 'list') {
        handleBackPress();
        return true;
      }
      return false;
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);

    return () => backHandler.remove();
  }, [view, handleBackPress]);

  // Poll for new messages if in chat view
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (view === 'chat' && currentConvId) {
      interval = setInterval(() => {
        loadMessages(currentConvId);
      }, 5000); // Every 5 seconds
    }
    return () => clearInterval(interval);
  }, [view, currentConvId, loadMessages]);

  // -- Handlers --

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadConversations();
    setRefreshing(false);
  };

  const handleSelectConversation = async (id: string) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCurrentConvId(id);
    setView('chat');
    setIsLoading(true);
    await loadMessages(id);
    setIsLoading(false);
  };

  const handleStartNewConversation = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCurrentConvId(null);
    setMessages([]);
    setSelectedTopic('');
    setInputText('');
    setView('newChat');
  };

  const handleTopicSelect = (topic: string) => {
    setSelectedTopic(topic);
    setShowTopicPicker(false);
  };

  const handleSend = async () => {
    if (!inputText.trim()) return;

    // For new conversations, require topic selection
    if (!currentConvId && !selectedTopic) {
      return;
    }

    const text = inputText.trim();
    setInputText('');
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      if (currentConvId) {
        // Reply to existing conversation
        await postSupportMessage(currentConvId, text);
        await loadMessages(currentConvId);
      } else {
        // Start new conversation with selected topic
        const subject = selectedTopic || 'New Support Request';
        const response = await postSupportConversation(text, subject);
        const data = response.data;
        if (data && 'success' in data && data.success) {
          // Show success modal instead of going to chat immediately
          setSuccessModalVisible(true);
          loadConversations(); // Update list in background
        }
      }
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  const handleSuccessModalClose = () => {
    setSuccessModalVisible(false);
    setView('list');
    setCurrentConvId(null);
    setSelectedTopic('');
    setInputText('');
    setLastVisited(new Date().toISOString());
  };

  // -- Render Helpers --

  const renderConversationItem = ({ item }: { item: SupportConversation }) => {
    const isUnread = (() => {
      if (!item.last_message_at) return false;
      if (!lastVisited) return true; // Assume unread if no history
      return new Date(item.last_message_at).getTime() > new Date(lastVisited).getTime();
    })();

    return (
      <Pressable
        onPress={() => handleSelectConversation(item.id)}
        style={({ pressed }) => [styles.convCard, pressed && styles.convCardPressed]}
      >
        <View style={styles.convInfo}>
          <View style={styles.convHeaderRow}>
            <Text style={[styles.convSubject, isUnread && styles.convSubjectUnread]}>
              {item.subject || 'Support Chat'}
            </Text>
            {isUnread && <View style={styles.unreadDot} />}
          </View>
          <Text style={[styles.convDate, isUnread && styles.convDateUnread]}>
            {item.last_message_at ? new Date(item.last_message_at).toLocaleDateString() : 'New'}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
      </Pressable>
    );
  };

  const renderMessage = ({ item }: { item: SupportMessage }) => {
    const isUser = item.sender === 'user';
    return (
      <View style={[styles.messageRow, isUser ? styles.userRow : styles.supportRow]}>
        {!isUser && (
          <View style={styles.supportAvatar}>
            <Ionicons name="help-buoy" size={16} color={colors.gold} />
          </View>
        )}
        <View style={[styles.messageBubble, isUser ? styles.userBubble : styles.supportBubble]}>
          <Text style={[styles.messageText, isUser ? styles.userText : styles.supportText]}>
            {item.text}
          </Text>
          {item.created_at && (
            <Text style={[styles.timestamp, isUser && { color: 'rgba(255,255,255,0.7)' }]}>
              {new Date(item.created_at).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>
          )}
        </View>
      </View>
    );
  };

  if (!isAuthenticated) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.container}>
          <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
            <Pressable onPress={() => router.back()} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
            </Pressable>
            <Text style={styles.headerTitle}>Help & Feedback</Text>
            <View style={styles.headerSpacer} />
          </View>
          <View style={styles.centerContent}>
            <IconHelp width={64} height={64} color={colors.textTertiary} />
            <Text style={styles.emptyStateTitle}>Please sign in to contact support</Text>
            <Text style={styles.emptyStateSubtitle}>
              Get personalized assistance and track your conversation history
            </Text>
            <Pressable style={styles.loginButton} onPress={() => router.push('/auth/login')}>
              <Text style={styles.loginButtonText}>Login</Text>
            </Pressable>
          </View>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
          <Pressable onPress={handleBackPress} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>
            {view === 'chat'
              ? 'Conversation'
              : view === 'newChat'
                ? 'Send Feedback'
                : 'Help & Feedback'}
          </Text>
          <View style={styles.headerSpacer} />
        </View>

        {view === 'list' ? (
          <View style={{ flex: 1 }}>
            <FlatList
              data={conversations}
              renderItem={renderConversationItem}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={handleRefresh}
                  tintColor={colors.gold}
                />
              }
              ListHeaderComponent={
                <View style={styles.listHeader}>
                  <Pressable
                    onPress={handleStartNewConversation}
                    style={({ pressed }) => [styles.newChatButton, pressed && { opacity: 0.9 }]}
                  >
                    <View style={styles.newChatIconContainer}>
                      <Ionicons
                        name="chatbox-ellipses-outline"
                        size={28}
                        color={colors.background}
                      />
                    </View>
                    <View style={styles.newChatTextContainer}>
                      <Text style={styles.newChatTitleText}>Send Feedback</Text>
                      <Text style={styles.newChatSubtitleText}>
                        Ask a question or share your thoughts
                      </Text>
                    </View>
                    <Ionicons name="arrow-forward" size={20} color={colors.background} />
                  </Pressable>

                  {conversations.length > 0 && (
                    <View style={styles.historySection}>
                      <View style={styles.historyDivider} />
                      <Text style={styles.sectionHeader}>History</Text>
                      <Text style={styles.sectionSubtitle}>
                        View your past feedback or add more details to ongoing conversations.
                      </Text>
                    </View>
                  )}
                </View>
              }
              ListEmptyComponent={
                null // Empty state handled by "History" header logic
              }
            />
            {isLoading && conversations.length === 0 && (
              <ActivityIndicator style={StyleSheet.absoluteFill} size="large" color={colors.gold} />
            )}
          </View>
        ) : view === 'newChat' ? (
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            <ScrollView
              style={styles.newChatContainer}
              contentContainerStyle={styles.newChatContent}
            >
              <Text style={styles.newChatTitle}>How can we help?</Text>
              <Text style={styles.newChatSubtitle}>
                Select a topic and tell us what happened. We appreciate your feedback!
              </Text>

              {/* Topic Selector */}
              <View style={styles.topicContainer}>
                <Text style={styles.topicLabel}>
                  Topic<Text style={styles.requiredStar}>*</Text>
                </Text>
                <Pressable
                  style={styles.topicSelector}
                  onPress={() => setShowTopicPicker(!showTopicPicker)}
                >
                  <Text
                    style={[styles.topicSelectorText, !selectedTopic && styles.topicPlaceholder]}
                  >
                    {selectedTopic || 'Select a topic'}
                  </Text>
                  <Ionicons
                    name={showTopicPicker ? 'chevron-up' : 'chevron-down'}
                    size={20}
                    color={colors.textSecondary}
                  />
                </Pressable>

                {showTopicPicker && (
                  <View style={styles.topicPicker}>
                    {SUPPORT_TOPICS.map((topic) => (
                      <Pressable
                        key={topic}
                        style={[
                          styles.topicOption,
                          selectedTopic === topic && styles.topicOptionSelected,
                        ]}
                        onPress={() => handleTopicSelect(topic)}
                      >
                        <Text
                          style={[
                            styles.topicOptionText,
                            selectedTopic === topic && styles.topicOptionTextSelected,
                          ]}
                        >
                          {topic}
                        </Text>
                        {selectedTopic === topic && (
                          <Ionicons name="checkmark" size={20} color={colors.gold} />
                        )}
                      </Pressable>
                    ))}
                  </View>
                )}
              </View>

              {/* Message Input */}
              <View style={styles.messageInputContainer}>
                <Text style={styles.messageLabel}>Your message</Text>
                <TextInput
                  style={styles.messageInput}
                  value={inputText}
                  onChangeText={setInputText}
                  placeholder="Tell us what happened..."
                  placeholderTextColor={colors.textTertiary}
                  multiline
                  numberOfLines={6}
                  textAlignVertical="top"
                  maxLength={1000}
                />
              </View>
            </ScrollView>

            {/* Submit Button */}
            <View style={[styles.submitContainer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
              <Pressable
                style={[
                  styles.submitButton,
                  (!selectedTopic || !inputText.trim()) && styles.submitButtonDisabled,
                ]}
                onPress={handleSend}
                disabled={!selectedTopic || !inputText.trim()}
              >
                <Text style={styles.submitButtonText}>Send Feedback</Text>
              </Pressable>
            </View>
          </KeyboardAvoidingView>
        ) : (
          <View style={{ flex: 1 }}>
            <FlatList
              ref={flatListRef}
              data={messages}
              renderItem={renderMessage}
              keyExtractor={(item) => item.id}
              contentContainerStyle={[styles.scrollContent, { paddingBottom: 20 }]}
              onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
            />

            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
            >
              <View style={[styles.inputArea, { paddingBottom: Math.max(insets.bottom, 16) }]}>
                <View style={styles.inputWrapper}>
                  <TextInput
                    style={styles.input}
                    value={inputText}
                    onChangeText={setInputText}
                    placeholder="Type a message..."
                    placeholderTextColor={colors.textTertiary}
                    multiline
                    maxLength={500}
                  />
                  <Pressable
                    onPress={handleSend}
                    style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]}
                    disabled={!inputText.trim()}
                  >
                    <Ionicons
                      name="send"
                      size={20}
                      color={inputText.trim() ? colors.gold : colors.textTertiary}
                    />
                  </Pressable>
                </View>
              </View>
            </KeyboardAvoidingView>
          </View>
        )}

        <SuccessModal
          visible={successModalVisible}
          onClose={handleSuccessModalClose}
          title="Feedback Sent"
          message="Thanks for your feedback! We'll get back to you if we have any questions. You can check the status in the History section."
        />
      </View>
    </>
  );
}

const createStyles = (colors: ReturnType<typeof getColors>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.md,
      backgroundColor: colors.backgroundSecondary,
    },
    backButton: {
      width: 40,
      alignItems: 'flex-start',
    },
    headerTitle: {
      flex: 1,
      fontSize: 18,
      fontWeight: '300',
      color: colors.textPrimary,
      textAlign: 'center',
    },
    headerSpacer: {
      width: 40,
    },
    listContent: {
      padding: 16,
      gap: 12,
    },
    convCard: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      backgroundColor: colors.backgroundElevated,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.borderSecondary,
    },
    convCardPressed: {
      opacity: 0.7,
    },
    convInfo: {
      flex: 1,
    },
    convHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 4,
    },
    convSubject: {
      fontSize: 16,
      fontWeight: '500',
      color: colors.textPrimary,
    },
    convSubjectUnread: {
      fontWeight: '700',
      color: colors.textPrimary,
    },
    unreadDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.gold,
    },
    convDate: {
      fontSize: 12,
      color: colors.textSecondary,
    },
    convDateUnread: {
      color: colors.gold,
      fontWeight: '500',
    },
    listHeader: {
      marginBottom: 24,
    },
    newChatButton: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 20,
      backgroundColor: colors.backgroundElevated,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.borderSecondary,
      gap: 16,
    },
    newChatIconContainer: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.gold,
      alignItems: 'center',
      justifyContent: 'center',
    },
    newChatTextContainer: {
      flex: 1,
      gap: 4,
    },
    newChatTitleText: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    newChatSubtitleText: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    sectionHeader: {
      fontSize: 20,
      fontWeight: '600',
      color: colors.textPrimary,
      marginBottom: 8,
      textAlign: 'center',
    },
    sectionSubtitle: {
      fontSize: 14,
      color: colors.textSecondary,
      marginBottom: 24,
      lineHeight: 20,
      textAlign: 'center',
      paddingHorizontal: 24,
    },
    historySection: {
      marginTop: 32,
      alignItems: 'center',
    },
    historyDivider: {
      height: 1,
      backgroundColor: colors.borderSecondary,
      width: '100%',
      marginBottom: 32,
    },
    centerContent: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingTop: 100,
      paddingHorizontal: 32,
    },
    emptyText: {
      color: colors.textSecondary,
      fontSize: 14,
    },
    emptyStateTitle: {
      fontSize: fontSizes.heading2,
      fontWeight: fontWeights.semibold,
      color: colors.textPrimary,
      marginTop: spacing.lg,
      textAlign: 'center',
    },
    emptyStateSubtitle: {
      fontSize: fontSizes.body,
      color: colors.textSecondary,
      marginTop: spacing.sm,
      textAlign: 'center',
      lineHeight: 24,
      maxWidth: '80%',
    },
    loginButton: {
      marginTop: spacing.xl,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.xl,
      backgroundColor: colors.gold,
      borderRadius: 8,
    },
    loginButtonText: {
      fontSize: fontSizes.body,
      fontWeight: fontWeights.semibold,
      color: colors.background,
    },
    scrollContent: {
      paddingHorizontal: 16,
      paddingTop: 16,
    },
    messageRow: {
      flexDirection: 'row',
      marginBottom: 16,
      maxWidth: '85%',
    },
    userRow: {
      alignSelf: 'flex-end',
      flexDirection: 'row-reverse',
    },
    supportRow: {
      alignSelf: 'flex-start',
    },
    supportAvatar: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: colors.backgroundElevated,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 8,
      borderWidth: 1,
      borderColor: colors.borderSecondary,
    },
    messageBubble: {
      padding: 12,
      borderRadius: 16,
      borderWidth: 1,
    },
    userBubble: {
      backgroundColor: colors.gold,
      borderColor: colors.gold,
      borderBottomRightRadius: 4,
    },
    supportBubble: {
      backgroundColor: colors.backgroundElevated,
      borderColor: colors.borderSecondary,
      borderBottomLeftRadius: 4,
    },
    messageText: {
      fontSize: 15,
      lineHeight: 20,
    },
    userText: {
      color: colors.background,
    },
    supportText: {
      color: colors.textPrimary,
    },
    timestamp: {
      fontSize: 10,
      marginTop: 4,
      opacity: 0.5,
      alignSelf: 'flex-end',
      color: colors.textSecondary,
    },
    inputArea: {
      paddingHorizontal: 16,
      paddingTop: 8,
      backgroundColor: colors.background,
    },
    inputWrapper: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      backgroundColor: colors.backgroundElevated,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: colors.borderSecondary,
      paddingHorizontal: 16,
      paddingVertical: 8,
    },
    input: {
      flex: 1,
      maxHeight: 100,
      paddingTop: Platform.OS === 'ios' ? 8 : 4,
      paddingBottom: Platform.OS === 'ios' ? 8 : 4,
      fontSize: 16,
      color: colors.textPrimary,
    },
    sendButton: {
      marginLeft: 8,
      paddingBottom: 4,
    },
    sendButtonDisabled: {
      opacity: 0.5,
    },

    // New Chat View Styles
    newChatContainer: {
      flex: 1,
      backgroundColor: colors.background,
    },
    newChatContent: {
      padding: 24,
      gap: 24,
    },
    newChatTitle: {
      fontSize: 24,
      fontWeight: 'bold',
      color: colors.textPrimary,
    },
    newChatSubtitle: {
      fontSize: 16,
      color: colors.textSecondary,
      lineHeight: 24,
    },
    topicContainer: {
      gap: 8,
    },
    topicLabel: {
      fontSize: 13,
      fontWeight: '500',
      color: colors.textSecondary,
    },
    requiredStar: {
      color: colors.error,
    },
    topicSelector: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.backgroundElevated,
      borderWidth: 1,
      borderColor: colors.borderSecondary,
      borderRadius: 8,
      paddingHorizontal: 16,
      paddingVertical: 14,
      minHeight: 48,
    },
    topicSelectorText: {
      fontSize: 16,
      color: colors.textPrimary,
    },
    topicPlaceholder: {
      color: colors.textTertiary,
    },
    topicPicker: {
      backgroundColor: colors.backgroundElevated,
      borderWidth: 1,
      borderColor: colors.borderSecondary,
      borderRadius: 8,
      overflow: 'hidden',
      marginTop: 4,
    },
    topicOption: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderSecondary,
    },
    topicOptionSelected: {
      backgroundColor: 'rgba(255, 255, 255, 0.05)',
    },
    topicOptionText: {
      fontSize: 16,
      color: colors.textPrimary,
    },
    topicOptionTextSelected: {
      color: colors.gold,
      fontWeight: '500',
    },
    messageInputContainer: {
      gap: 8,
    },
    messageLabel: {
      fontSize: 13,
      fontWeight: '500',
      color: colors.textSecondary,
    },
    messageInput: {
      backgroundColor: colors.backgroundElevated,
      borderWidth: 1,
      borderColor: colors.borderSecondary,
      borderRadius: 8,
      paddingHorizontal: 16,
      paddingVertical: 14,
      fontSize: 16,
      color: colors.textPrimary,
      minHeight: 120,
      textAlignVertical: 'top',
    },
    submitContainer: {
      paddingHorizontal: 24,
      paddingTop: 16,
      backgroundColor: colors.background,
    },
    submitButton: {
      backgroundColor: colors.gold,
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    submitButtonDisabled: {
      opacity: 0.5,
    },
    submitButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.background,
    },
  });
