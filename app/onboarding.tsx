import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { type ComponentType, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import PagerView from '@/components/common/PagerView';
import {
  InductivePreview,
  LanguagesPreview,
  LevelsPreview,
  LexiconPreview,
  TopicsPreview,
  VerseInsightPreview,
  VisualsPreview,
} from '@/components/onboarding/OnboardingPreviews';
import { OnboardingSlide } from '@/components/onboarding/OnboardingSlide';
import { useTheme } from '@/contexts/ThemeContext';
import { useDeviceInfo } from '@/hooks/use-device-info';
import { AnalyticsEvent, analytics } from '@/lib/analytics';
import { colors as palette } from '@/theme/tokens';

/** Gates the first-run redirect in app/_layout.tsx. */
export const ONBOARDING_KEY = 'HAS_SEEN_ONBOARDING';
/** Web-parity flag (mirrors verse-mate-web's `versemate-onboarding-seen`). */
export const FEATURE_ONBOARDING_KEY = 'versemate-onboarding-seen';
/** Tracks the latest "What's New" feature set an existing user has seen. */
export const WHATS_NEW_KEY = 'versemate-whatsnew-seen';
/** Bump this id whenever new feature cards are added, so existing users see them once. */
export const WHATS_NEW_VERSION = 'greek-hebrew-inductive-visuals';

/** Slide keys surfaced in "What's New" mode (the new features for existing users). */
const WHATS_NEW_KEYS = ['lexicon', 'inductive', 'visuals'];

type Slide = {
  key: string;
  eyebrow: string;
  title: string;
  body: string;
  Preview: ComponentType;
};

// Order per product: the five original welcome screens, then the three new
// feature-tour screens, with the original "Multiple Languages" screen moved to
// the very end.
const slides: Slide[] = [
  {
    key: 'verse-insight',
    eyebrow: 'ANY BOOK, ANY VERSE',
    title: 'Tap any verse for deeper insight',
    body: 'Open any verse to reveal analysis, context, and meaning — the whole Bible, a tap away.',
    Preview: VerseInsightPreview,
  },
  {
    key: 'levels',
    eyebrow: 'EXPLANATION LEVELS',
    title: 'Understand Scripture at every level',
    body: 'Choose how deep you want to go — a quick summary, line-by-line, or in-depth analysis.',
    Preview: LevelsPreview,
  },
  {
    key: 'topics',
    eyebrow: 'TOPICS & THEMES',
    title: 'Explore the bigger story',
    body: 'Follow themes, prophecies, and events across the whole of Scripture by topic.',
    Preview: TopicsPreview,
  },
  {
    key: 'lexicon',
    eyebrow: 'ORIGINAL LANGUAGES',
    title: 'Greek & Hebrew, one tap away',
    body: "Tap any highlighted word to reveal its original-language definition — Strong's number, pronunciation, semantic range, and related words. Read Scripture in the language it was written.",
    Preview: LexiconPreview,
  },
  {
    key: 'inductive',
    eyebrow: 'GUIDED STUDY',
    title: 'The inductive method, step by step',
    body: 'Work through the proven 9-step Precept method: observe what the text says, interpret what it means, then apply it. Each chapter unfolds as guided, collapsible steps.',
    Preview: InductivePreview,
  },
  {
    key: 'visuals',
    eyebrow: 'VISUAL LEARNING',
    title: 'See the whole book at a glance',
    body: 'Watch animated overviews and explore hand-drawn visual summaries for every book — from BibleProject, Insight for Living, and VerseMate originals. Tap any image to zoom in.',
    Preview: VisualsPreview,
  },
  {
    key: 'languages',
    eyebrow: 'FOR EVERYONE',
    title: 'Multiple languages. Always free.',
    body: 'VerseMate is free worldwide and available in multiple languages — so anyone, anywhere can understand the Word.',
    Preview: LanguagesPreview,
  },
];

const PaginationDot = ({
  index,
  scrollOffset,
  color,
}: {
  index: number;
  scrollOffset: SharedValue<number>;
  color: string;
}) => {
  const animatedStyle = useAnimatedStyle(() => {
    const width = interpolate(
      scrollOffset.value,
      [index - 1, index, index + 1],
      [8, 20, 8],
      Extrapolation.CLAMP
    );
    const opacity = interpolate(
      scrollOffset.value,
      [index - 1, index, index + 1],
      [0.3, 1, 0.3],
      Extrapolation.CLAMP
    );
    return { width, opacity };
  });

  return <Animated.View style={[styles.dot, { backgroundColor: color }, animatedStyle]} />;
};

export default function OnboardingScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors, mode } = useTheme();
  const pagerRef = useRef<PagerView>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const insets = useSafeAreaInsets();
  const { isTablet } = useDeviceInfo();

  // `?mode=whatsnew` (existing users after an app update) shows only the new
  // feature cards; the default flow shows everything (new users / first run).
  const params = useLocalSearchParams<{ mode?: string }>();
  const isWhatsNew = params.mode === 'whatsnew';
  const activeSlides = isWhatsNew ? slides.filter((s) => WHATS_NEW_KEYS.includes(s.key)) : slides;

  const scrollOffset = useSharedValue(0);
  const isLastPage = currentPage === activeSlides.length - 1;
  const backgroundColor = mode === 'dark' ? colors.background : palette.light.bookBackground;

  useEffect(() => {
    analytics.track(AnalyticsEvent.ONBOARDING_STARTED, {
      deviceType: isTablet ? 'tablet' : 'phone',
    });
  }, [isTablet]);

  // biome-ignore lint/suspicious/noExplicitAny: PagerView event type is not strictly typed
  const onPageScroll = (e: any) => {
    'worklet';
    scrollOffset.value = e.nativeEvent.position + e.nativeEvent.offset;
  };

  const handleNext = async () => {
    if (currentPage < activeSlides.length - 1) {
      pagerRef.current?.setPage(currentPage + 1);
    } else {
      await completeOnboarding('completed');
    }
  };

  const completeOnboarding = async (
    method: 'skipped' | 'completed' | 'login' = 'completed',
    targetPath = '/bible/1/1'
  ) => {
    try {
      analytics.track(AnalyticsEvent.ONBOARDING_COMPLETED, {
        method,
        finalSlideIndex: currentPage,
      });

      await AsyncStorage.multiSet([
        [ONBOARDING_KEY, 'true'],
        [FEATURE_ONBOARDING_KEY, 'true'],
        [WHATS_NEW_KEY, WHATS_NEW_VERSION],
      ]);

      // biome-ignore lint/suspicious/noExplicitAny: router.replace accepts specific strings but we pass a generic string
      router.replace(targetPath as any);
    } catch (error) {
      console.error('Failed to save onboarding status', error);
      // biome-ignore lint/suspicious/noExplicitAny: router.replace accepts specific strings but we pass a generic string
      router.replace(targetPath as any);
    }
  };

  const handleLogin = async () => {
    await completeOnboarding('login', '/auth/login?fromOnboarding=true');
  };

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
      {isWhatsNew && (
        <View style={[styles.whatsNewHeader, { paddingTop: insets.top + 10 }]} pointerEvents="none">
          <Text style={[styles.whatsNewText, { color: colors.gold }]}>
            {t('onboarding.whats_new')}
          </Text>
        </View>
      )}
      <PagerView
        style={styles.pagerView}
        initialPage={0}
        ref={pagerRef}
        onPageSelected={(e) => setCurrentPage(e.nativeEvent.position)}
        onPageScroll={onPageScroll}
      >
        {activeSlides.map((slide) => (
          <View
            key={slide.key}
            style={[styles.page, { paddingTop: insets.top + 16, paddingBottom: 188 }]}
          >
            <OnboardingSlide
              eyebrow={slide.eyebrow}
              title={slide.title}
              body={slide.body}
              testID={`onboarding-slide-${slide.key}`}
            >
              <slide.Preview />
            </OnboardingSlide>
          </View>
        ))}
      </PagerView>

      <View style={[styles.controls, { paddingBottom: insets.bottom + 24 }]}>
        <View style={styles.pagination}>
          {activeSlides.map((slide, index) => (
            <PaginationDot
              key={slide.key}
              index={index}
              scrollOffset={scrollOffset}
              color={colors.gold}
            />
          ))}
        </View>

        {isLastPage ? (
          <View style={styles.finalButtons}>
            <Pressable
              onPress={() => completeOnboarding('completed')}
              style={[styles.primaryButton, { backgroundColor: colors.gold }]}
              testID="onboarding-start"
            >
              <Text style={styles.primaryButtonText}>{t('onboarding.start_reading')}</Text>
            </Pressable>
            {!isWhatsNew && (
              <Pressable onPress={handleLogin} style={styles.loginButton} testID="onboarding-login">
                <Text style={[styles.loginText, { color: colors.textSecondary }]}>
                  {t('onboarding.login')}
                </Text>
              </Pressable>
            )}
          </View>
        ) : (
          <View style={styles.navRow}>
            <Pressable
              onPress={() => completeOnboarding('skipped')}
              style={styles.skipButton}
              testID="onboarding-skip"
            >
              <Text style={[styles.skipText, { color: colors.textSecondary }]}>
                {t('onboarding.skip')}
              </Text>
            </Pressable>
            <Pressable
              onPress={handleNext}
              style={[styles.nextButton, { backgroundColor: colors.gold }]}
              testID="onboarding-next"
            >
              <Text style={styles.nextText}>{t('onboarding.next')}</Text>
              <Ionicons name="arrow-forward" size={18} color="#1a1a1a" />
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  whatsNewHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 2,
  },
  whatsNewText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  pagerView: {
    flex: 1,
  },
  page: {
    flex: 1,
    paddingHorizontal: 8,
  },
  controls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  pagination: {
    flexDirection: 'row',
    marginBottom: 24,
  },
  dot: {
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
  },
  navRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    maxWidth: 460,
  },
  skipButton: {
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  skipText: {
    fontSize: 16,
    fontWeight: '600',
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 999,
    minHeight: 48,
  },
  nextText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  finalButtons: {
    width: '100%',
    maxWidth: 460,
    alignItems: 'center',
    gap: 8,
  },
  primaryButton: {
    width: '100%',
    minHeight: 52,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  loginButton: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  loginText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
