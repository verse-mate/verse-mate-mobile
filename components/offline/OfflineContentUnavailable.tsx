import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { fontSizes, spacing } from '@/theme/tokens';

type ContentType = 'chapter' | 'explanation' | 'topic';

interface OfflineContentUnavailableProps {
  contentType: ContentType;
  onDownload?: () => void;
  downloadLabel?: string;
}

const MESSAGES: Record<ContentType, string> = {
  chapter:
    "This chapter isn't available offline. Download a Bible version to read without internet.",
  explanation:
    'Explanations are not available offline. Download commentaries to read them without internet.',
  topic: "This topic isn't available offline. Download topics to access them without internet.",
};

export function OfflineContentUnavailable({
  contentType,
  onDownload,
  downloadLabel,
}: OfflineContentUnavailableProps) {
  const { colors } = useTheme();

  const handleGoToDownloads = () => {
    router.push('/manage-downloads');
  };

  return (
    <View style={styles.container} testID="offline-content-unavailable">
      <Ionicons
        name="cloud-offline-outline"
        size={48}
        color={colors.textTertiary}
        style={styles.icon}
      />
      <Text style={[styles.title, { color: colors.textPrimary }]}>You&apos;re offline</Text>
      <Text style={[styles.message, { color: colors.textSecondary }]}>{MESSAGES[contentType]}</Text>
      {onDownload && (
        <Pressable
          style={[styles.button, { backgroundColor: colors.gold }]}
          onPress={onDownload}
          testID="offline-download-button"
        >
          <Ionicons name="download-outline" size={18} color="#FFFFFF" />
          <Text style={styles.buttonText}>{downloadLabel || 'Download'}</Text>
        </Pressable>
      )}
      <Pressable
        style={[styles.secondaryButton, { borderColor: colors.textTertiary }]}
        onPress={handleGoToDownloads}
        testID="offline-go-to-downloads"
      >
        <Text style={[styles.secondaryButtonText, { color: colors.textSecondary }]}>
          Manage Downloads
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xxl,
  },
  icon: {
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: fontSizes.heading3,
    fontWeight: '600',
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  message: {
    fontSize: fontSizes.body,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.xl,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: 8,
    marginBottom: spacing.md,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: fontSizes.body,
    fontWeight: '600',
  },
  secondaryButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: 8,
    borderWidth: 1,
  },
  secondaryButtonText: {
    fontSize: fontSizes.caption,
  },
});
