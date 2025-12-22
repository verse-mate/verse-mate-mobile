import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fontSizes, spacing } from '@/constants/bible-design-tokens';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'support';
  timestamp: Date;
}

export default function HelpScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { user, isAuthenticated } = useAuth();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [inputText, setInputText] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: 'Hi! How can we help you today? Feel free to send us feedback or ask any questions about VerseMate.',
      sender: 'support',
      timestamp: new Date(),
    },
  ]);

  const flatListRef = useRef<FlatList>(null);

  const handleSend = async () => {
    if (!inputText.trim()) return;

    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const newMessage: Message = {
      id: Date.now().toString(),
      text: inputText.trim(),
      sender: 'user',
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, newMessage]);
    setInputText('');

    // TODO: Hook up to backend API which forwards to Slack
    console.log('Sending to support:', newMessage.text);

    // Auto-scroll to bottom
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  const handleBackPress = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  };

  const renderMessage = ({ item }: { item: Message }) => {
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
          <Text style={styles.timestamp}>
            {item.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Pressable onPress={handleBackPress} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Help & Support</Text>
        <View style={styles.headerSpacer} />
      </View>

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
  );
}

const createStyles = (colors: any) =>
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
      color: colors.background, // Contrast text on gold
    },
    supportText: {
      color: colors.textPrimary,
    },
    timestamp: {
      fontSize: 10,
      marginTop: 4,
      opacity: 0.5,
      alignSelf: 'flex-end',
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
