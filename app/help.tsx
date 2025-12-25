import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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

type ViewState = 'list' | 'chat';

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
  const [isLoading, setIsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

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

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

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
    setView('chat');
  };

  const handleSend = async () => {
    if (!inputText.trim()) return;

    const text = inputText.trim();
    setInputText('');
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      if (currentConvId) {
        // Reply to existing
        await postSupportMessage(currentConvId, text);
        await loadMessages(currentConvId);
      } else {
        // Start new
        const response = await postSupportConversation(text, 'New Support Request');
        const data = response.data;
        if (data && 'success' in data && data.success) {
          setCurrentConvId(data.conversationId);
          await loadMessages(data.conversationId);
          loadConversations(); // Update list in background
        }
      }
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  const handleBackPress = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (view === 'chat') {
      setView('list');
      setCurrentConvId(null);
      loadConversations();
    } else {
      router.back();
    }
  };

  // -- Render Helpers --

  const renderConversationItem = ({ item }: { item: SupportConversation }) => (
    <Pressable
      onPress={() => handleSelectConversation(item.id)}
      style={({ pressed }) => [styles.convCard, pressed && styles.convCardPressed]}
    >
      <View style={styles.convInfo}>
        <Text style={styles.convSubject}>{item.subject || 'Support Chat'}</Text>
        <Text style={styles.convDate}>
          {item.last_message_at ? new Date(item.last_message_at).toLocaleDateString() : 'New'}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
    </Pressable>
  );

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
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>Help & Support</Text>
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
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Pressable onPress={handleBackPress} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>
          {view === 'chat' ? 'Conversation' : 'Help & Support'}
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
              <Pressable
                onPress={handleStartNewConversation}
                style={({ pressed }) => [styles.newChatButton, pressed && { opacity: 0.8 }]}
              >
                <Ionicons name="add-circle-outline" size={24} color={colors.gold} />
                <Text style={styles.newChatText}>Start New Conversation</Text>
              </Pressable>
            }
            ListEmptyComponent={
              !isLoading ? (
                <View style={styles.centerContent}>
                  <Text style={styles.emptyText}>No past conversations found.</Text>
                </View>
              ) : null
            }
          />
          {isLoading && (
            <ActivityIndicator style={StyleSheet.absoluteFill} size="large" color={colors.gold} />
          )}
        </View>
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
    </View>
  );
}

const createStyles = (colors: ReturnType<typeof getColors>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.backgroundSecondary,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.md,
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
    convSubject: {
      fontSize: 16,
      fontWeight: '500',
      color: colors.textPrimary,
      marginBottom: 4,
    },
    convDate: {
      fontSize: 12,
      color: colors.textSecondary,
    },
    newChatButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 16,
      backgroundColor: colors.backgroundElevated,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.borderSecondary,
      marginBottom: 8,
      gap: 8,
    },
    newChatText: {
      fontSize: 16,
      fontWeight: '500',
      color: colors.gold,
    },
    centerContent: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingTop: 100,
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
      backgroundColor: colors.backgroundSecondary,
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
  });
