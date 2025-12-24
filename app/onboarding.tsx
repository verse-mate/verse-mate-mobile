import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import PagerView from 'react-native-pager-view';
import Animated, {
  Extrapolation,
  interpolate,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDeviceInfo } from '@/hooks/use-device-info';
import { AnalyticsEvent, analytics } from '@/lib/analytics';

const phoneSlides = [
  require('../assets/images/onboarding/slide1.jpg'),
  require('../assets/images/onboarding/slide2.jpg'),
  require('../assets/images/onboarding/slide3.jpg'),
  require('../assets/images/onboarding/slide4.jpg'),
  require('../assets/images/onboarding/slide5.jpg'),
  require('../assets/images/onboarding/slide6.jpg'),
];

const tabletSlides = [
  require('../assets/images/onboarding/slide1-tablet.jpg'),
  require('../assets/images/onboarding/slide2-tablet.jpg'),
  require('../assets/images/onboarding/slide3-tablet.jpg'),
  require('../assets/images/onboarding/slide4-tablet.jpg'),
  require('../assets/images/onboarding/slide5-tablet.jpg'),
  require('../assets/images/onboarding/slide6-tablet.jpg'),
];

export const ONBOARDING_KEY = 'HAS_SEEN_ONBOARDING';

const PaginationDot = ({
  index,
  scrollOffset,
}: {
  index: number;
  scrollOffset: SharedValue<number>;
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
      [0.4, 1, 0.4],
      Extrapolation.CLAMP
    );

    return {
      width,
      opacity,
    };
  });

  return <Animated.View style={[styles.dot, animatedStyle]} />;
};

export default function OnboardingScreen() {
  const router = useRouter();
  const pagerRef = useRef<PagerView>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const insets = useSafeAreaInsets();

  const { isTablet, isLandscape } = useDeviceInfo();
  const slides = isTablet ? tabletSlides : phoneSlides;

  // Shared value to track scroll position (0 to slides.length - 1)
  const scrollOffset = useSharedValue(0);

  // Track onboarding start
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
    if (currentPage < slides.length - 1) {
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
      // Track completion
      analytics.track(AnalyticsEvent.ONBOARDING_COMPLETED, {
        method,
        finalSlideIndex: currentPage,
      });

      // Still save to permanent storage
      await AsyncStorage.setItem(ONBOARDING_KEY, 'true');

      // biome-ignore lint/suspicious/noExplicitAny: router.replace accepts specific strings but we are passing a generic string
      router.replace(targetPath as any);
    } catch (error) {
      console.error('Failed to save onboarding status', error);
      // biome-ignore lint/suspicious/noExplicitAny: router.replace accepts specific strings but we are passing a generic string
      router.replace(targetPath as any);
    }
  };

  const handleLogin = async () => {
    await completeOnboarding('login', '/auth');
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <PagerView
        style={styles.pagerView}
        initialPage={0}
        ref={pagerRef}
        onPageSelected={(e) => setCurrentPage(e.nativeEvent.position)}
        onPageScroll={onPageScroll}
      >
        {slides.map((slide, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: slides array is static and never reordered
          <View key={index} style={styles.slide}>
            {/* Ambient Background for Landscape */}
            {isLandscape && (
              <Image
                source={slide}
                style={[StyleSheet.absoluteFill, { opacity: 0.6 }]}
                contentFit="cover"
                blurRadius={50}
              />
            )}
            {/* Main Image */}
            <Image
              source={slide}
              style={styles.image}
              contentFit={isLandscape ? 'contain' : 'cover'}
              transition={200}
            />
          </View>
        ))}
      </PagerView>

      {/* Overlay Controls */}
      <View style={[styles.controlsContainer, { paddingBottom: insets.bottom + 20 }]}>
        {/* Pagination Dots */}
        <View style={styles.pagination}>
          {slides.map((_, index) => (
            <PaginationDot
              // biome-ignore lint/suspicious/noArrayIndexKey: slides array is static and never reordered
              key={index}
              index={index}
              scrollOffset={scrollOffset}
            />
          ))}
        </View>

        {/* Buttons */}
        <View style={styles.buttonContainer}>
          {currentPage < slides.length - 1 ? (
            <>
              <Pressable onPress={() => completeOnboarding('skipped')} style={styles.skipButton}>
                <Text style={styles.skipText}>Skip</Text>
              </Pressable>
              <Pressable onPress={handleNext} style={styles.nextButton}>
                <Ionicons name="arrow-forward" size={24} color="#000" />
              </Pressable>
            </>
          ) : (
            <View style={styles.finalButtonsRow}>
              <Pressable
                onPress={() => completeOnboarding('completed')}
                style={styles.getStartedButton}
              >
                <Text style={styles.getStartedText}>Get Started</Text>
              </Pressable>
              <Pressable onPress={handleLogin} style={styles.loginButton}>
                <Text style={styles.loginText}>Log In</Text>
              </Pressable>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  pagerView: {
    flex: 1,
  },
  slide: {
    flex: 1,
  },
  image: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  controlsContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  pagination: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  dot: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#fff',
    marginHorizontal: 4,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    alignItems: 'center',
    height: 50,
  },
  finalButtonsRow: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
  },
  skipButton: {
    padding: 10,
  },
  skipText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  nextButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  getStartedButton: {
    backgroundColor: '#fff',
    flex: 2,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  getStartedText: {
    color: '#000',
    fontSize: 18,
    fontWeight: 'bold',
  },
  loginButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    flex: 1,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  loginText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
