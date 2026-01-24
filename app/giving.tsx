/**
 * Giving Screen
 *
 * Displays information about supporting VerseMate with donations.
 * Includes a contact form that opens the email app with pre-filled information.
 *
 * Features:
 * - Header with back navigation
 * - Hero section with mission statement
 * - Contact form for donation inquiries
 * - Email submission via Linking API
 * - Theme-aware styling
 */

import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router, Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ImageBackground,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ErrorModal } from '@/components/bible/ErrorModal';
import { type getColors, spacing } from '@/constants/bible-design-tokens';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';

export default function GivingScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { user, isAuthenticated } = useAuth();
  const styles = createStyles(colors);

  // Form state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');

  // Modal state
  const [errorModalVisible, setErrorModalVisible] = useState(false);
  const [errorModalContent, setErrorModalContent] = useState({ title: '', message: '' });

  // Prefill form fields if user is logged in
  useEffect(() => {
    if (isAuthenticated && user) {
      if (user.firstName) setFirstName(user.firstName);
      if (user.lastName) setLastName(user.lastName);
      if (user.email) setEmail(user.email);
    }
  }, [isAuthenticated, user]);

  const handleBackPress = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  };

  const handleSubmit = async () => {
    // Validate required fields
    if (!firstName.trim() || !lastName.trim() || !email.trim()) {
      setErrorModalContent({
        title: 'Required Fields',
        message: 'Please fill in your first name, last name, and email.',
      });
      setErrorModalVisible(true);
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setErrorModalContent({
        title: 'Invalid Email',
        message: 'Please enter a valid email address.',
      });
      setErrorModalVisible(true);
      return;
    }

    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Construct email
    const subject = encodeURIComponent('Donation Inquiry from VerseMate App');
    const bodyText = `First Name: ${firstName.trim()}\nLast Name: ${lastName.trim()}\nEmail: ${email.trim()}\n\n${
      message.trim() ? `Message:\n${message.trim()}` : ''
    }`;
    const body = encodeURIComponent(bodyText);
    const mailtoUrl = `mailto:info@versemate.org?subject=${subject}&body=${body}`;

    try {
      const canOpen = await Linking.canOpenURL(mailtoUrl);
      if (canOpen) {
        await Linking.openURL(mailtoUrl);
        // Clear form after successful email opening
        setFirstName('');
        setLastName('');
        setEmail('');
        setMessage('');
      } else {
        setErrorModalContent({
          title: 'Email Not Available',
          message: 'Unable to open email app. Please email us directly at info@versemate.org',
        });
        setErrorModalVisible(true);
      }
    } catch (error) {
      console.error('Error opening email:', error);
      setErrorModalContent({
        title: 'Error',
        message: 'Unable to open email app. Please email us directly at info@versemate.org',
      });
      setErrorModalVisible(true);
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
          <Pressable
            onPress={handleBackPress}
            style={styles.backButton}
            accessibilityLabel="Go back"
            accessibilityRole="button"
            testID="giving-back-button"
          >
            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>Giving</Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* Content */}
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[
            styles.contentContainer,
            { paddingBottom: insets.bottom + spacing.xl },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* Hero Section */}
          <View style={styles.heroSection}>
            <ImageBackground
              source={require('@/assets/images/giving-hero.jpg')}
              style={styles.heroBackground}
              resizeMode="cover"
            >
              <View style={styles.heroOverlay}>
                <View style={styles.heroContent}>
                  <View style={styles.titleBorder}>
                    <Text style={styles.supportTitle}>SUPPORT VERSEMATE</Text>
                  </View>

                  <View style={styles.textContainer}>
                    <Text style={styles.heroHeading}>
                      Help People Everywhere Engage with God&apos;s Word
                    </Text>
                    <Text style={styles.heroBody}>
                      Your generosity helps us create resources and tools that make Scripture clear
                      and accessible to people worldwide. Every gift you give makes a direct
                      impact—whether it&apos;s supporting the translation of content, improving our
                      technology, or helping us reach new communities with the truth of God&apos;s
                      Word.{'\n\n'}Through your partnership, VerseMate can continue developing
                      simple, powerful tools that guide people not only to read the Bible, but to
                      truly understand and apply it in their daily lives. We believe that when
                      people engage Scripture with clarity, transformation follows—families are
                      encouraged, faith grows stronger, and entire communities can be renewed.
                      {'\n\n'}Thank you for prayerfully considering a gift to VerseMate. Together,
                      we can equip more people across languages and cultures to connect with
                      God&apos;s Word in a deeper way.
                    </Text>
                  </View>
                </View>
              </View>
            </ImageBackground>
          </View>

          {/* Form Section */}
          <View style={styles.formSection}>
            <View style={styles.formContent}>
              <View style={styles.formTextContainer}>
                <Text style={styles.formHeading}>Connect With Us About Donations</Text>
                <Text style={styles.formDescription}>
                  We&apos;d love to hear from you! If you&apos;re interested in supporting VerseMate
                  with a donation, please fill out the form below. One of our team members will
                  connect with you soon to guide you through the next steps.
                </Text>
              </View>

              <View style={styles.formInputs}>
                {/* First Name */}
                <View style={styles.inputContainer}>
                  <View style={styles.inputLabelContainer}>
                    <Text style={styles.inputLabel}>First Name</Text>
                    <Text style={styles.requiredStar}>*</Text>
                  </View>
                  <TextInput
                    style={styles.input}
                    value={firstName}
                    onChangeText={setFirstName}
                    placeholder=""
                    placeholderTextColor={colors.textTertiary}
                    autoCorrect={false}
                    spellCheck={false}
                    testID="giving-first-name-input"
                  />
                </View>

                {/* Last Name */}
                <View style={styles.inputContainer}>
                  <View style={styles.inputLabelContainer}>
                    <Text style={styles.inputLabel}>Last Name</Text>
                    <Text style={styles.requiredStar}>*</Text>
                  </View>
                  <TextInput
                    style={styles.input}
                    value={lastName}
                    onChangeText={setLastName}
                    placeholder=""
                    placeholderTextColor={colors.textTertiary}
                    autoCorrect={false}
                    spellCheck={false}
                    testID="giving-last-name-input"
                  />
                </View>

                {/* Email */}
                <View style={styles.inputContainer}>
                  <View style={styles.inputLabelContainer}>
                    <Text style={styles.inputLabel}>Email</Text>
                    <Text style={styles.requiredStar}>*</Text>
                  </View>
                  <TextInput
                    style={styles.input}
                    value={email}
                    onChangeText={setEmail}
                    placeholder=""
                    placeholderTextColor={colors.textTertiary}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    spellCheck={false}
                    testID="giving-email-input"
                  />
                </View>

                {/* Message */}
                <View style={[styles.inputContainer, styles.textAreaContainer]}>
                  <View style={styles.inputLabelContainer}>
                    <Text style={styles.inputLabel}>Anything You&apos;d Like Us to Know</Text>
                  </View>
                  <TextInput
                    style={[styles.input, styles.textArea]}
                    value={message}
                    onChangeText={setMessage}
                    placeholder=""
                    placeholderTextColor={colors.textTertiary}
                    multiline
                    numberOfLines={4}
                    textAlignVertical="top"
                    testID="giving-message-input"
                  />
                </View>
              </View>

              {/* Submit Button */}
              <Pressable
                style={({ pressed }) => [
                  styles.submitButton,
                  pressed && styles.submitButtonPressed,
                ]}
                onPress={handleSubmit}
                accessibilityLabel="Submit donation inquiry"
                accessibilityRole="button"
                testID="giving-submit-button"
              >
                <Text style={styles.submitButtonText}>Submit</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>

        {/* Error Modal */}
        <ErrorModal
          visible={errorModalVisible}
          title={errorModalContent.title}
          message={errorModalContent.message}
          onClose={() => setErrorModalVisible(false)}
        />
      </KeyboardAvoidingView>
    </>
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
    scrollView: {
      flex: 1,
      backgroundColor: colors.background,
    },
    contentContainer: {
      flexGrow: 1,
    },

    // Hero Section
    heroSection: {
      width: '100%',
    },
    heroBackground: {
      width: '100%',
      minHeight: 600,
    },
    heroOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    heroContent: {
      paddingHorizontal: 24,
      paddingVertical: 48,
      gap: 48,
    },
    titleBorder: {
      borderBottomWidth: 6,
      borderBottomColor: '#c2b291',
      paddingVertical: 8,
      alignSelf: 'flex-start',
    },
    supportTitle: {
      fontSize: 16,
      fontWeight: 'bold',
      color: '#ffffff',
      letterSpacing: 1.6,
      textTransform: 'uppercase',
    },
    textContainer: {
      gap: 16,
    },
    heroHeading: {
      fontSize: 32,
      fontWeight: 'bold',
      color: '#ffffff',
      lineHeight: 40,
    },
    heroBody: {
      fontSize: 16,
      fontWeight: '300',
      color: '#ffffff',
      lineHeight: 24,
    },

    // Form Section
    formSection: {
      backgroundColor: '#1b1b1b',
      paddingHorizontal: 24,
      paddingVertical: 48,
    },
    formContent: {
      gap: 40,
    },
    formTextContainer: {
      gap: 16,
    },
    formHeading: {
      fontSize: 20,
      fontWeight: 'bold',
      color: '#ffffff',
      lineHeight: 24,
    },
    formDescription: {
      fontSize: 16,
      fontWeight: '300',
      color: '#dce0e3',
      lineHeight: 24,
    },
    formInputs: {
      gap: 24,
    },
    inputContainer: {
      gap: 4,
    },
    textAreaContainer: {
      height: 140,
    },
    inputLabelContainer: {
      flexDirection: 'row',
    },
    inputLabel: {
      fontSize: 13,
      fontWeight: '500',
      color: '#818990',
      lineHeight: 16,
    },
    requiredStar: {
      fontSize: 13,
      fontWeight: '500',
      color: '#b03a42',
      lineHeight: 16,
    },
    input: {
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
      borderWidth: 1,
      borderColor: 'rgba(220, 224, 227, 0.1)',
      borderRadius: 5,
      height: 56,
      paddingHorizontal: 16,
      fontSize: 16,
      color: '#ffffff',
    },
    textArea: {
      height: 100,
      paddingTop: 16,
      paddingBottom: 16,
    },
    submitButton: {
      backgroundColor: '#b09a6d',
      height: 48,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 16,
    },
    submitButtonPressed: {
      opacity: 0.8,
    },
    submitButtonText: {
      fontSize: 14,
      fontWeight: '400',
      color: '#000000',
      lineHeight: 24,
    },
  });
