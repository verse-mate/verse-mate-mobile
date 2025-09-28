import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Dimensions,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
// import { GestureHandlerRootView, PanGestureHandler } from 'react-native-gesture-handler';
// import Animated, {
//   runOnJS,
//   useAnimatedStyle,
//   useSharedValue,
//   withSpring,
// } from 'react-native-reanimated';
import { ChapterLoadingSkeleton } from '@/components/ChapterLoadingSkeleton';
import { NetworkErrorBoundary } from '@/components/ErrorBoundary';
import { ErrorDisplay } from '@/components/ErrorDisplay';
import { FloatingNavigation } from '@/components/FloatingNavigation';
import { ApiService } from '@/services/api';
import { ReadingPositionService } from '@/services/readingPosition';
import { BookMappingService } from '@/utils/bookMapping';

interface Verse {
  number: number;
  text: string;
}

interface ChapterData {
  bookId: number;
  bookName: string;
  chapter: number;
  verses: Verse[];
  version: string;
}

interface ReadingPosition {
  bookId: number;
  chapter: number;
  verse: number;
  scrollPosition: number;
  timestamp: number;
}

const { width: screenWidth } = Dimensions.get('window');

export default function BibleReader() {
  const { bookId, chapter } = useLocalSearchParams<{ bookId: string; chapter: string }>();
  const router = useRouter();

  // Services
  const apiService = useRef(new ApiService('https://api.verse-mate.apegro.dev')).current;
  const readingPositionService = useRef(new ReadingPositionService()).current;
  const bookMappingService = useRef(new BookMappingService()).current;

  // State
  const [chapterData, setChapterData] = useState<ChapterData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showFloatingNav, setShowFloatingNav] = useState(true);

  // Refs
  const scrollViewRef = useRef<ScrollView>(null);
  const hideNavTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastScrollPosition = useRef(0);

  // Animation values (disabled for now)
  // const translateX = useSharedValue(0);
  // const gestureActive = useSharedValue(false);

  // Parse route parameters
  const currentBookId = parseInt(bookId || '1', 10);
  const currentChapter = parseInt(chapter || '1', 10);

  // Fetch chapter data
  const fetchChapterData = useCallback(
    async (retryCount = 0) => {
      try {
        setLoading(true);
        setError(null);

        const data = await apiService.getChapter(currentBookId, currentChapter);
        setChapterData(data);

        // Restore reading position after data loads
        const savedPosition = await readingPositionService.getPosition(
          currentBookId,
          currentChapter
        );
        if (savedPosition && scrollViewRef.current) {
          setTimeout(() => {
            scrollViewRef.current?.scrollTo({
              y: savedPosition.scrollPosition,
              animated: false,
            });
          }, 100);
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load chapter';
        setError(errorMessage);

        // Retry logic with exponential backoff
        if (retryCount < 3) {
          const delay = 2 ** retryCount * 1000;
          setTimeout(() => {
            fetchChapterData(retryCount + 1);
          }, delay);
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [currentBookId, currentChapter, apiService, readingPositionService]
  );

  // Load chapter data on mount and when parameters change
  useEffect(() => {
    fetchChapterData();
  }, [fetchChapterData]);

  // Save reading position when component unmounts or parameters change
  useEffect(() => {
    return () => {
      if (chapterData && lastScrollPosition.current > 0) {
        const position: ReadingPosition = {
          bookId: currentBookId,
          chapter: currentChapter,
          verse: 1, // Calculate based on scroll position
          scrollPosition: lastScrollPosition.current,
          timestamp: Date.now(),
        };
        readingPositionService.savePosition(position);
      }
    };
  }, [currentBookId, currentChapter, chapterData, readingPositionService]);

  // Auto-hide floating navigation
  const resetHideNavTimer = useCallback(() => {
    if (hideNavTimeoutRef.current) {
      clearTimeout(hideNavTimeoutRef.current);
    }

    setShowFloatingNav(true);

    hideNavTimeoutRef.current = setTimeout(() => {
      setShowFloatingNav(false);
    }, 3000);
  }, []);

  // Handle scroll events
  const handleScroll = useCallback(
    (event: { nativeEvent: { contentOffset: { y: number } } }) => {
      const { contentOffset } = event.nativeEvent;
      lastScrollPosition.current = contentOffset.y;

      // Show floating navigation on scroll
      resetHideNavTimer();

      // Debounced position saving
      if (hideNavTimeoutRef.current) clearTimeout(hideNavTimeoutRef.current);
      hideNavTimeoutRef.current = setTimeout(() => {
        if (chapterData) {
          const position: ReadingPosition = {
            bookId: currentBookId,
            chapter: currentChapter,
            verse: 1, // TODO: Calculate actual verse based on scroll position
            scrollPosition: contentOffset.y,
            timestamp: Date.now(),
          };
          readingPositionService.savePosition(position);
        }
      }, 1000);
    },
    [currentBookId, currentChapter, chapterData, readingPositionService, resetHideNavTimer]
  );

  // Navigation functions
  const navigateToChapter = useCallback(
    (targetBookId: number, targetChapter: number) => {
      router.push(`/bible/${targetBookId}/${targetChapter}` as any);
    },
    [router]
  );

  const navigateNext = useCallback(() => {
    if (!chapterData) return;

    const lastChapter = bookMappingService.getLastChapterOfBook(currentBookId);

    if (currentChapter < lastChapter) {
      // Next chapter in same book
      navigateToChapter(currentBookId, currentChapter + 1);
    } else {
      // Next book
      const nextBook = bookMappingService.getNextBook(currentBookId);
      if (nextBook) {
        navigateToChapter(nextBook.bookId, 1);
      }
    }
  }, [chapterData, currentBookId, currentChapter, bookMappingService, navigateToChapter]);

  const navigatePrevious = useCallback(() => {
    if (!chapterData) return;

    if (currentChapter > 1) {
      // Previous chapter in same book
      navigateToChapter(currentBookId, currentChapter - 1);
    } else {
      // Previous book
      const prevBook = bookMappingService.getPreviousBook(currentBookId);
      if (prevBook) {
        const lastChapter = bookMappingService.getLastChapterOfBook(prevBook.bookId);
        navigateToChapter(prevBook.bookId, lastChapter);
      }
    }
  }, [chapterData, currentBookId, currentChapter, bookMappingService, navigateToChapter]);

  // Swipe navigation handlers (simplified for now)
  const onSwipeLeft = () => navigateNext();
  const onSwipeRight = () => navigatePrevious();

  // const animatedStyle = useAnimatedStyle(() => {
  //   return {
  //     transform: [{ translateX: translateX.value }],
  //   };
  // });

  // Pull to refresh
  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchChapterData();
  }, [fetchChapterData]);

  // Retry on error
  const handleRetry = useCallback(() => {
    fetchChapterData();
  }, [fetchChapterData]);

  // Show/hide floating navigation
  const handleScreenPress = useCallback(() => {
    resetHideNavTimer();
  }, [resetHideNavTimer]);

  if (loading && !chapterData) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="dark" />
        <ChapterLoadingSkeleton verseCount={15} />
      </SafeAreaView>
    );
  }

  if (error && !chapterData) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="dark" />
        <ErrorDisplay
          message="Unable to load chapter. Please try again."
          onRetry={handleRetry}
          style={styles.errorContainer}
        />
      </SafeAreaView>
    );
  }

  if (!chapterData) {
    return null;
  }

  return (
    <NetworkErrorBoundary>
      <SafeAreaView style={styles.container}>
        <StatusBar style="dark" />
        <View style={styles.flex}>
          <ScrollView
            ref={scrollViewRef}
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor="#b09a6d"
              />
            }
            testID="chapter-scroll-view"
            accessible={true}
            accessibilityLabel="Bible chapter content"
            onTouchStart={handleScreenPress}
          >
            {/* Chapter Header */}
            <View style={styles.header}>
              <Text style={styles.chapterTitle}>
                {chapterData.bookName} {chapterData.chapter}
              </Text>
            </View>

            {/* Verses */}
            <View style={styles.versesContainer}>
              {chapterData.verses.map((verse) => (
                <View key={verse.number} style={styles.verseContainer}>
                  <Text
                    style={styles.verse}
                    accessible={true}
                    accessibilityLabel={`Verse ${verse.number}`}
                  >
                    <Text style={styles.verseNumber}>{verse.number}</Text>
                    <Text style={styles.verseText}>{verse.text}</Text>
                  </Text>
                </View>
              ))}
            </View>

            {/* Bottom spacing for floating navigation */}
            <View style={styles.bottomSpacing} />
          </ScrollView>

          {/* Floating Navigation */}
          {showFloatingNav && (
            <FloatingNavigation
              onPrevious={navigatePrevious}
              onNext={navigateNext}
              canGoPrevious={
                currentChapter > 1 || bookMappingService.getPreviousBook(currentBookId) !== null
              }
              canGoNext={
                currentChapter < bookMappingService.getLastChapterOfBook(currentBookId) ||
                bookMappingService.getNextBook(currentBookId) !== null
              }
              currentBook={chapterData.bookName}
              currentChapter={currentChapter}
            />
          )}
        </View>
      </SafeAreaView>
    </NetworkErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f6f3ec',
  },
  flex: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 100, // Extra space for floating navigation
  },
  header: {
    marginBottom: 24,
    alignItems: 'center',
  },
  chapterTitle: {
    fontSize: 28,
    fontFamily: 'MerriweatherItalic',
    color: '#212531',
    textAlign: 'center',
  },
  versesContainer: {
    flex: 1,
  },
  verseContainer: {
    marginBottom: 16,
  },
  verse: {
    fontSize: 18,
    lineHeight: 28,
    color: '#212531',
    fontFamily: 'RobotoSerif',
  },
  verseNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: '#b09a6d',
    marginRight: 8,
    textAlignVertical: 'top',
  },
  verseText: {
    fontSize: 18,
    lineHeight: 28,
    color: '#212531',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  bottomSpacing: {
    height: 80,
  },
});
