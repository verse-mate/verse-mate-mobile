/**
 * BibleNavigationModal Component
 *
 * A bottom sheet modal for navigating Bible books and chapters.
 * Features testament tabs, book list with recent books, chapter grid,
 * filter/search, and swipe-to-dismiss gesture.
 *
 * Features:
 * - iOS-style bottom sheet (80% screen height, rounded top corners)
 * - Testament tabs (Old Testament / New Testament)
 * - Recent books displayed at top (max 5, clock icon)
 * - Filter/search for books (case-insensitive)
 * - Chapter grid (5-column layout)
 * - Current chapter highlighted with gold background
 * - Swipe-to-dismiss gesture (translationY > 100px)
 * - Spring animation on open, ease-in on close
 *
 * @see Spec lines 238-250, 610-698 (Modal specifications)
 */

import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Keyboard,
  Modal,
  Platform,
  Pressable,
  Animated as RNAnimated,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
  type GestureStateChangeEvent,
  type GestureUpdateEvent,
  type PanGestureHandlerEventPayload,
} from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  Layout,
  runOnJS,
  type SharedValue,
  useAnimatedReaction,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  fontSizes,
  fontWeights,
  type getColors,
  getModalSpecs,
  lineHeights,
  spacing,
  springConfig,
  type ThemeMode,
} from '@/constants/bible-design-tokens';
import { useTheme } from '@/contexts/ThemeContext';
import { useRecentBooks } from '@/hooks/bible/use-recent-books';
import { useCachedTopics } from '@/hooks/topics/use-cached-topics';
import { useDeviceInfo } from '@/hooks/use-device-info';
import { useBibleTestaments } from '@/src/api';
import type { BookMetadata, Testament } from '@/types/bible';
import { getTestamentFromBookId } from '@/types/bible';
import type { TopicCategory, TopicListItem } from '@/types/topics';

interface BibleNavigationModalProps {
  /** Whether modal is visible */
  visible: boolean;
  /** Current book ID (for highlighting) */
  currentBookId: number;
  /** Current chapter number (for highlighting) */
  currentChapter: number;
  /** Callback when modal should close */
  onClose: () => void;
  /** Callback when user selects a chapter */
  onSelectChapter: (bookId: number, chapter: number) => void;
  /** Callback when user selects a topic */
  onSelectTopic?: (topicId: string, category: TopicCategory) => void;
  /** Initial tab to open (defaults to testament of currentBookId) */
  initialTab?: 'OT' | 'NT' | 'TOPICS';
  /** Initial topic category to open when initialTab is TOPICS (defaults to EVENT) */
  initialTopicCategory?: TopicCategory;
  /** Whether to use the native Modal component (default: true) */
  useModalComponent?: boolean;
  /** Optional shared value for vertical translation (for external gesture control) */
  customTranslateY?: SharedValue<number>;
}

// ... (Interface remains same)

/**
 * BibleNavigationModal - Bottom sheet for book/chapter selection
 */
function BibleNavigationModalComponent({
  visible,
  currentBookId,
  currentChapter,
  onClose,
  onSelectChapter,
  onSelectTopic,
  initialTab,
  initialTopicCategory,
  useModalComponent = true,
  customTranslateY,
}: BibleNavigationModalProps) {
  const { colors, mode } = useTheme();
  const insets = useSafeAreaInsets();
  const { useSplitView, isTablet } = useDeviceInfo();
  const modalSpecs = useMemo(() => getModalSpecs(mode), [mode]); // Define modalSpecs here
  const styles = useMemo(
    () => createStyles(colors, mode, insets.top, modalSpecs, useSplitView, isTablet),
    [colors, mode, insets.top, modalSpecs, useSplitView, isTablet]
  );

  // State for tab type: 'OT', 'NT', or 'TOPICS'
  type TabType = Testament | 'TOPICS';
  const [selectedTab, setSelectedTab] = useState<TabType>(getTestamentFromBookId(currentBookId));

  // Bible navigation state
  const [selectedTestament, setSelectedTestament] = useState<Testament>(
    getTestamentFromBookId(currentBookId)
  );
  const [selectedBookId, setSelectedBookId] = useState<number | null>(null);
  const [filterText, setFilterText] = useState('');

  // Topics navigation state
  const [selectedTopicCategory, setSelectedTopicCategory] = useState<TopicCategory>('EVENT');
  const [topicFilterText, setTopicFilterText] = useState('');

  // Animation state for sliding indicators
  const [singleMeasuredTabWidth, setSingleMeasuredTabWidth] = useState(0);
  const [singleMeasuredCategoryTabWidth, setSingleMeasuredCategoryTabWidth] = useState(0);
  const mainTabSlideAnim = useRef(
    new RNAnimated.Value(selectedTab === 'OT' ? 0 : selectedTab === 'NT' ? 1 : 2)
  ).current;
  const categoryTabSlideAnim = useRef(new RNAnimated.Value(0)).current;

  // Track if modal is effectively open (visible prop OR dragging down)
  const [isOpenOrDragging, setIsOpenOrDragging] = useState(visible);

  // State to track the chapter grid container and button dimensions for dynamic calculations
  const [gridContainerWidth, setGridContainerWidth] = useState(0);
  const [buttonWidth, setButtonWidth] = useState(0);
  const [buttonHeight, setButtonHeight] = useState(0);

  // Ref for ScrollView to enable programmatic scrolling
  const scrollViewRef = useRef<ScrollView>(null);

  // State to track book item positions and viewport height for smart scrolling
  const [bookItemPositions, setBookItemPositions] = useState<Map<number, number>>(new Map());
  const [scrollViewHeight, setScrollViewHeight] = useState(0);
  const [currentScrollY, setCurrentScrollY] = useState(0);

  // Animate main tab indicator when selectedTab changes
  useEffect(() => {
    const tabIndex = selectedTab === 'OT' ? 0 : selectedTab === 'NT' ? 1 : 2;
    RNAnimated.spring(mainTabSlideAnim, {
      toValue: tabIndex,
      useNativeDriver: true,
      friction: 8,
      tension: 50,
    }).start();
  }, [selectedTab, mainTabSlideAnim]);

  // Animate category tab indicator when selectedTopicCategory changes
  useEffect(() => {
    const categoryIndex =
      selectedTopicCategory === 'EVENT'
        ? 0
        : selectedTopicCategory === 'PROPHECY'
          ? 1
          : selectedTopicCategory === 'PARABLE'
            ? 2
            : 3;
    RNAnimated.spring(categoryTabSlideAnim, {
      toValue: categoryIndex,
      useNativeDriver: true,
      friction: 8,
      tension: 50,
    }).start();
  }, [selectedTopicCategory, categoryTabSlideAnim]);

  // Animation values for swipe-to-dismiss
  const localTranslateY = useSharedValue(-1000);
  const translateY = customTranslateY || localTranslateY;

  // React to shared value changes to update state for data fetching
  useAnimatedReaction(
    () => translateY.value > -900,
    (isDragging, prevIsDragging) => {
      if (isDragging !== prevIsDragging) {
        runOnJS(setIsOpenOrDragging)(isDragging || visible);
      }
    },
    [visible]
  );

  // Fetch books and recent books - when modal is visible or being dragged
  const shouldFetchData = visible || isOpenOrDragging;
  const { data: allBooks = [], isLoading: isBooksLoading } = useBibleTestaments(undefined, {
    enabled: !!shouldFetchData,
  });
  const { recentBooks } = useRecentBooks();

  // Fetch topics data - always enabled for instant cache access
  const hasSearchText = topicFilterText.trim().length > 0;

  // Always fetch all categories using cached hook for instant access
  // Cache is loaded immediately, API updates happen in background
  const { topics: eventTopics, isInitialLoad: isEventsInitialLoad } = useCachedTopics('EVENT');
  const { topics: prophecyTopics, isInitialLoad: isPropheciesInitialLoad } =
    useCachedTopics('PROPHECY');
  const { topics: parableTopics, isInitialLoad: isParablesInitialLoad } =
    useCachedTopics('PARABLE');
  const { topics: themeTopics, isInitialLoad: isThemesInitialLoad } = useCachedTopics('THEME');

  // Only show loading state if ALL categories are doing initial load (empty cache)
  const isTopicsLoading =
    isEventsInitialLoad && isPropheciesInitialLoad && isParablesInitialLoad && isThemesInitialLoad;

  // Get current category topics or all topics when searching
  const currentTopics = useMemo(() => {
    if (hasSearchText) {
      // When searching, combine all categories
      return [...eventTopics, ...prophecyTopics, ...parableTopics, ...themeTopics];
    }
    // No search - return only selected category
    if (selectedTopicCategory === 'EVENT') return eventTopics;
    if (selectedTopicCategory === 'PROPHECY') return prophecyTopics;
    if (selectedTopicCategory === 'PARABLE') return parableTopics;
    if (selectedTopicCategory === 'THEME') return themeTopics;
    return [];
  }, [
    eventTopics,
    prophecyTopics,
    parableTopics,
    themeTopics,
    selectedTopicCategory,
    hasSearchText,
  ]);

  const backdropOpacity = useDerivedValue(() => {
    'worklet';
    return interpolate(translateY.value, [-1000, 0], [0, 1], Extrapolation.CLAMP);
  });
  const [internalVisible, setInternalVisible] = useState(visible);

  // Handle closing with animation
  const handleClose = useCallback(() => {
    translateY.value = withTiming(-1000, { duration: 250 }, (finished) => {
      if (finished) {
        runOnJS(onClose)();
      }
    });
  }, [onClose, translateY]);

  // Gesture for handling scroll events within the lists
  const scrollGesture = Gesture.Native();

  // Tap gesture for backdrop to close modal
  const backdropTapGesture = Gesture.Tap().onEnd(() => {
    runOnJS(handleClose)();
  });

  // Reset state when modal becomes visible and animate from top (simple slide, no spring)
  useEffect(() => {
    if (visible) {
      setInternalVisible(true);
      // Use initialTab if provided, otherwise default to testament from currentBookId
      const defaultTab = initialTab || getTestamentFromBookId(currentBookId);
      setSelectedTab(defaultTab);

      // Only set testament if not opening to TOPICS tab
      if (defaultTab !== 'TOPICS') {
        setSelectedTestament(defaultTab);
      } else {
        // When opening TOPICS tab, set testament based on currentBookId for potential switching
        setSelectedTestament(getTestamentFromBookId(currentBookId));
        // Set the initial topic category if provided
        if (initialTopicCategory) {
          setSelectedTopicCategory(initialTopicCategory);
        }
      }

      setSelectedBookId(null); // Start with book list, not chapter grid
      setFilterText('');
      setTopicFilterText('');
      translateY.value = withTiming(0, { duration: 300 });
    } else if (!customTranslateY) {
      // If visible prop becomes false (e.g. parent closed it), animate out
      translateY.value = withTiming(-1000, { duration: 250 }, (finished) => {
        if (finished) {
          runOnJS(setInternalVisible)(false);
        }
      });
    }
  }, [visible, currentBookId, initialTab, initialTopicCategory, translateY, customTranslateY]);

  // Filter books by testament and filter text
  const filteredBooks = useMemo(() => {
    // If there's a filter text, search across all books
    if (filterText.trim()) {
      const searchLower = filterText.toLowerCase();
      return allBooks.filter((book) => book.name.toLowerCase().includes(searchLower));
    }
    // Otherwise, return books from the selected testament
    return allBooks.filter((book) => book.testament === selectedTestament);
  }, [allBooks, selectedTestament, filterText]);

  // Filter topics by search text with smart sorting
  const filteredTopics = useMemo(() => {
    const searchLower = topicFilterText.trim().toLowerCase();

    // If no search text, return all topics from current category
    if (!searchLower) {
      return currentTopics;
    }

    // Filter topics that match search term
    const matches = currentTopics.filter(
      (topic) =>
        topic.name.toLowerCase().includes(searchLower) ||
        (typeof topic.description === 'string' &&
          topic.description.toLowerCase().includes(searchLower))
    );

    // Sort matches by relevance:
    // 1. Exact match on name (highest priority)
    // 2. Starts with search term in name (prefix match)
    // 3. Contains search term in name
    // 4. Contains search term in description (lowest priority)
    return matches.sort((a, b) => {
      const aNameLower = a.name.toLowerCase();
      const bNameLower = b.name.toLowerCase();

      // Exact match on name
      const aExact = aNameLower === searchLower ? 1 : 0;
      const bExact = bNameLower === searchLower ? 1 : 0;
      if (aExact !== bExact) return bExact - aExact;

      // Starts with search term (prefix match)
      const aStartsWith = aNameLower.startsWith(searchLower) ? 1 : 0;
      const bStartsWith = bNameLower.startsWith(searchLower) ? 1 : 0;
      if (aStartsWith !== bStartsWith) return bStartsWith - aStartsWith;

      // Contains in name
      const aInName = aNameLower.includes(searchLower) ? 1 : 0;
      const bInName = bNameLower.includes(searchLower) ? 1 : 0;
      if (aInName !== bInName) return bInName - aInName;

      // Both match in description or alphabetical fallback
      return aNameLower.localeCompare(bNameLower);
    });
  }, [currentTopics, topicFilterText]);

  // Recent books across all testaments (excluding current book, sorted by timestamp)
  const recentBooksFiltered = useMemo(() => {
    // Filter out current book and sort by timestamp (most recent first)
    return recentBooks
      .filter((rb) => rb.bookId !== currentBookId)
      .sort((a, b) => b.timestamp - a.timestamp)
      .map((rb) => allBooks.find((b) => b.id === rb.bookId))
      .filter((book): book is BookMetadata => book !== undefined);
  }, [allBooks, recentBooks, currentBookId]);

  // Get selected book's chapter count
  const selectedBook = allBooks.find((book) => book.id === selectedBookId);
  const chapterCount = selectedBook?.chapterCount ?? 0;

  // Handle tab switch (Testament or Topics)
  const handleTabChange = useCallback((tab: TabType) => {
    setSelectedTab(tab);
    if (tab === 'TOPICS') {
      setTopicFilterText('');
    } else {
      setSelectedTestament(tab);
      setFilterText('');
      setSelectedBookId(null);
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  // Handle topic category change
  const handleTopicCategoryChange = useCallback((category: TopicCategory) => {
    setSelectedTopicCategory(category);
    setTopicFilterText('');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  // Track the last book that was expanded for scroll logic
  const lastExpandedBookRef = useRef<{ bookId: number; previousBookId: number | null } | null>(
    null
  );

  // Handle book selection
  const handleBookSelect = useCallback(
    (book: BookMetadata) => {
      const isExpanding = selectedBookId !== book.id;
      const previouslySelectedBookId = selectedBookId;
      setSelectedBookId((prevId) => (prevId === book.id ? null : book.id));
      Keyboard.dismiss();
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      // Store book info for scroll effect to process
      if (isExpanding) {
        lastExpandedBookRef.current = {
          bookId: book.id,
          previousBookId: previouslySelectedBookId,
        };
      }
    },
    [selectedBookId]
  );

  // Auto-scroll effect - triggers when measurements are ready
  useEffect(() => {
    if (
      !lastExpandedBookRef.current ||
      gridContainerWidth === 0 ||
      buttonWidth === 0 ||
      buttonHeight === 0
    ) {
      return;
    }

    const { bookId, previousBookId } = lastExpandedBookRef.current;
    const book = allBooks.find((b) => b.id === bookId);
    if (!book) return;

    // Calculate new chapter grid height
    const gap = spacing.md;
    const columnsPerRow = Math.floor((gridContainerWidth + gap) / (buttonWidth + gap));
    const numRows = Math.ceil(book.chapterCount / columnsPerRow);
    const gridHeight = numRows * buttonHeight + (numRows - 1) * gap;
    const bookItemHeight = 56;
    const totalContentHeight = bookItemHeight + gridHeight + spacing.xl * 2;

    // Get book position
    let bookPosition = bookItemPositions.get(bookId) || 0;

    // Calculate height of previously opened book's grid (if any) to account for layout shift
    if (previousBookId !== null) {
      const previousBook = allBooks.find((b) => b.id === previousBookId);
      if (previousBook) {
        const prevNumRows = Math.ceil(previousBook.chapterCount / columnsPerRow);
        const previousGridHeight =
          prevNumRows * buttonHeight + (prevNumRows - 1) * gap + spacing.xl * 2;

        // If previous book was above the clicked book, adjust position for layout shift
        const prevPosition = bookItemPositions.get(previousBookId) || 0;
        if (prevPosition < bookPosition) {
          bookPosition -= previousGridHeight;
        }
      }
    }

    // Smart scroll logic
    const scrollTimeout = setTimeout(() => {
      if (scrollViewRef.current && scrollViewHeight > 0) {
        // Calculate visible bottom edge
        const visibleBottom = currentScrollY + scrollViewHeight;
        const contentBottom = bookPosition + totalContentHeight;

        // Only scroll if content doesn't fit in current viewport
        if (contentBottom > visibleBottom) {
          if (totalContentHeight <= scrollViewHeight) {
            // Content fits in viewport, scroll just enough to show it all
            const scrollTo = Math.max(0, bookPosition + totalContentHeight - scrollViewHeight);
            scrollViewRef.current.scrollTo({ y: scrollTo, animated: true });
          } else {
            // Content larger than viewport, scroll to put book title at top
            scrollViewRef.current.scrollTo({ y: bookPosition, animated: true });
          }
        }
      }
      // Clear the ref after processing
      lastExpandedBookRef.current = null;
    }, 150); // Slightly longer delay to ensure measurements are ready

    return () => clearTimeout(scrollTimeout);
  }, [
    gridContainerWidth,
    buttonWidth,
    buttonHeight,
    bookItemPositions,
    scrollViewHeight,
    currentScrollY,
    allBooks,
  ]);

  // Handle chapter selection
  const handleChapterSelect = useCallback(
    (chapter: number) => {
      if (selectedBookId) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onSelectChapter(selectedBookId, chapter);
        handleClose();
      }
    },
    [selectedBookId, onSelectChapter, handleClose]
  );

  // Handle topic selection
  const handleTopicSelect = useCallback(
    (topicId: string) => {
      if (onSelectTopic) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onSelectTopic(topicId, selectedTopicCategory);
        handleClose();
      }
    },
    [onSelectTopic, selectedTopicCategory, handleClose]
  );

  // Swipe-to-dismiss gesture
  const panGesture = Gesture.Pan()
    .onUpdate((e: GestureUpdateEvent<PanGestureHandlerEventPayload>) => {
      // Apply resistance when dragging down (positive Y)
      // For a top sheet, we want to resist moving it further down into the screen
      translateY.value = e.translationY > 0 ? e.translationY * 0.5 : e.translationY;
    })
    .onEnd((e: GestureStateChangeEvent<PanGestureHandlerEventPayload>) => {
      // Close if dragged up significantly or flicked up
      if (e.translationY < -100 || e.velocityY < -500) {
        runOnJS(handleClose)();
      } else {
        // Snap back
        translateY.value = withSpring(0, springConfig);
      }
    });

  // Backdrop pan gesture - handles swipe
  const backdropPanGesture = Gesture.Pan()
    .onUpdate((e: GestureUpdateEvent<PanGestureHandlerEventPayload>) => {
      // Same as panGesture - move the modal
      translateY.value = e.translationY > 0 ? e.translationY * 0.5 : e.translationY;
    })
    .onEnd((e: GestureStateChangeEvent<PanGestureHandlerEventPayload>) => {
      // Close if dragged up significantly or flicked up
      if (e.translationY < -100 || e.velocityY < -500) {
        runOnJS(handleClose)();
      } else {
        // Snap back
        translateY.value = withSpring(0, springConfig);
      }
    });
  const animatedModalStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const animatedBackdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  // Render title
  const renderTitle = () => {
    return (
      <GestureDetector gesture={panGesture}>
        <View style={styles.titleContainer}>
          <Text style={styles.titleText}>Search</Text>
        </View>
      </GestureDetector>
    );
  };

  // Calculate translateX for main tab indicator
  const mainTabTranslateX = mainTabSlideAnim.interpolate({
    inputRange: [0, 1, 2],
    outputRange: [
      0,
      singleMeasuredTabWidth + spacing.xs,
      (singleMeasuredTabWidth + spacing.xs) * 2,
    ],
  });

  // Render main tabs (OT, NT, Topics)
  const renderMainTabs = () => (
    <View style={styles.testamentTabsContainer}>
      <View style={styles.tabsRow}>
        {/* Sliding indicator for main tabs */}
        <RNAnimated.View
          style={[
            styles.mainTabIndicator,
            {
              width: singleMeasuredTabWidth, // Use measured width
              transform: [{ translateX: mainTabTranslateX }],
            },
          ]}
        />
        <Pressable
          onPress={() => handleTabChange('OT')}
          style={styles.testamentTab}
          accessibilityRole="tab"
          accessibilityState={{ selected: selectedTab === 'OT' }}
          testID="tab-old-testament"
          onLayout={(event) => {
            // Update measured width whenever layout changes (e.g. orientation change)
            const width = event.nativeEvent.layout.width;
            if (Math.abs(singleMeasuredTabWidth - width) > 0.5) {
              setSingleMeasuredTabWidth(width);
            }
          }}
        >
          <Text
            style={[styles.testamentTabText, selectedTab === 'OT' && styles.testamentTabTextActive]}
            numberOfLines={1}
            adjustsFontSizeToFit={Platform.OS === 'ios'}
            minimumFontScale={0.8}
          >
            Old Testament
          </Text>
        </Pressable>

        <Pressable
          onPress={() => handleTabChange('NT')}
          style={styles.testamentTab}
          accessibilityRole="tab"
          accessibilityState={{ selected: selectedTab === 'NT' }}
          testID="tab-new-testament"
        >
          <Text
            style={[styles.testamentTabText, selectedTab === 'NT' && styles.testamentTabTextActive]}
            numberOfLines={1}
            adjustsFontSizeToFit={Platform.OS === 'ios'}
            minimumFontScale={0.8}
          >
            New Testament
          </Text>
        </Pressable>

        <Pressable
          onPress={() => handleTabChange('TOPICS')}
          style={styles.testamentTab}
          accessibilityRole="tab"
          accessibilityState={{ selected: selectedTab === 'TOPICS' }}
          testID="tab-topics"
        >
          <Text
            style={[
              styles.testamentTabText,
              selectedTab === 'TOPICS' && styles.testamentTabTextActive,
            ]}
            numberOfLines={1}
            adjustsFontSizeToFit={Platform.OS === 'ios'}
            minimumFontScale={0.8}
          >
            Topics
          </Text>
        </Pressable>
      </View>
    </View>
  );

  // Calculate translateX for category tab indicator
  const categoryTabTranslateX = categoryTabSlideAnim.interpolate({
    inputRange: [0, 1, 2, 3],
    outputRange: [
      0,
      singleMeasuredCategoryTabWidth + spacing.xs,
      (singleMeasuredCategoryTabWidth + spacing.xs) * 2,
      (singleMeasuredCategoryTabWidth + spacing.xs) * 3,
    ],
  });

  // Render topic category tabs
  const renderTopicCategoryTabs = () => (
    <View style={styles.categoryTabsContainer}>
      <View style={styles.categoryTabsRow}>
        {/* Sliding indicator for category tabs */}
        <RNAnimated.View
          style={[
            styles.categoryTabIndicator,
            {
              width: singleMeasuredCategoryTabWidth, // Use measured width
              transform: [{ translateX: categoryTabTranslateX }],
            },
          ]}
        />
        <Pressable
          onPress={() => handleTopicCategoryChange('EVENT')}
          style={styles.categoryTab}
          accessibilityRole="tab"
          accessibilityState={{ selected: selectedTopicCategory === 'EVENT' }}
          onLayout={(event) => {
            const width = event.nativeEvent.layout.width;
            if (Math.abs(singleMeasuredCategoryTabWidth - width) > 0.5) {
              setSingleMeasuredCategoryTabWidth(width);
            }
          }}
        >
          <Text
            style={[
              styles.categoryTabText,
              selectedTopicCategory === 'EVENT' && styles.categoryTabTextActive,
            ]}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            Events
          </Text>
        </Pressable>

        <Pressable
          onPress={() => handleTopicCategoryChange('PROPHECY')}
          style={styles.categoryTab}
          accessibilityRole="tab"
          accessibilityState={{ selected: selectedTopicCategory === 'PROPHECY' }}
        >
          <Text
            style={[
              styles.categoryTabText,
              selectedTopicCategory === 'PROPHECY' && styles.categoryTabTextActive,
            ]}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            Prophecies
          </Text>
        </Pressable>

        <Pressable
          onPress={() => handleTopicCategoryChange('PARABLE')}
          style={styles.categoryTab}
          accessibilityRole="tab"
          accessibilityState={{ selected: selectedTopicCategory === 'PARABLE' }}
        >
          <Text
            style={[
              styles.categoryTabText,
              selectedTopicCategory === 'PARABLE' && styles.categoryTabTextActive,
            ]}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            Parables
          </Text>
        </Pressable>

        <Pressable
          onPress={() => handleTopicCategoryChange('THEME')}
          style={styles.categoryTab}
          accessibilityRole="tab"
          accessibilityState={{ selected: selectedTopicCategory === 'THEME' }}
        >
          <Text
            style={[
              styles.categoryTabText,
              selectedTopicCategory === 'THEME' && styles.categoryTabTextActive,
            ]}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            Themes
          </Text>
        </Pressable>
      </View>
    </View>
  );

  // Render filter input
  const renderFilterInput = () => {
    const isTopicsMode = selectedTab === 'TOPICS';
    const currentFilterText = isTopicsMode ? topicFilterText : filterText;
    const placeholder = isTopicsMode ? 'Filter topics...' : 'Filter books...';
    const onChangeText = isTopicsMode ? setTopicFilterText : setFilterText;

    return (
      <View style={styles.filterContainer}>
        <View style={styles.filterInputWrapper}>
          <Ionicons name="search" size={18} color={colors.textTertiary} />
          <TextInput
            style={styles.filterInput}
            placeholder={placeholder}
            placeholderTextColor={colors.textTertiary}
            value={currentFilterText}
            onChangeText={onChangeText}
            returnKeyType="search"
            accessibilityLabel={placeholder}
          />
        </View>
      </View>
    );
  };

  // Render book list item
  const renderBookItem = (book: BookMetadata, isRecent: boolean) => {
    const isSelected = book.id === selectedBookId;

    return (
      <Pressable
        key={book.id}
        onPress={() => handleBookSelect(book)}
        style={[styles.bookItem, isSelected && styles.bookItemSelected]}
        accessibilityRole="button"
        accessibilityLabel={`${book.name}, ${book.chapterCount} chapters`}
        accessibilityState={{ selected: isSelected }}
        testID={`book-item-${book.name.toLowerCase().replace(/\s+/g, '-')}`}
      >
        <Text style={[styles.bookItemText, isSelected && styles.bookItemTextSelected]}>
          {book.name}
        </Text>
        <View style={styles.bookItemRight}>
          {isRecent && !isSelected && (
            <Ionicons
              name="time-outline"
              size={18}
              color={colors.textTertiary}
              style={styles.clockIcon}
            />
          )}
          {isSelected && <Ionicons name="checkmark" size={20} color={colors.background} />}
        </View>
      </Pressable>
    );
  };

  // Render book list
  const renderBookList = () => {
    if (isBooksLoading) {
      return (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading books...</Text>
        </View>
      );
    }

    // Recent books are shown across all testaments (not filtered by current tab)
    const hasRecentBooks = recentBooksFiltered.length > 0 && !filterText.trim();
    const booksToShow = (
      hasRecentBooks
        ? [
            ...recentBooksFiltered,
            ...filteredBooks.filter((book) => !recentBooksFiltered.some((r) => r.id === book.id)),
          ]
        : filteredBooks
    ).filter((book) => book.id !== currentBookId); // Filter out current book to avoid duplication

    return (
      <GestureDetector gesture={scrollGesture}>
        <ScrollView
          ref={scrollViewRef}
          style={styles.bookList}
          contentContainerStyle={styles.bookListContent}
          keyboardShouldPersistTaps="always"
          onLayout={(event) => {
            const { height } = event.nativeEvent.layout;
            setScrollViewHeight(height);
          }}
          onScroll={(event) => {
            setCurrentScrollY(event.nativeEvent.contentOffset.y);
          }}
          scrollEventThrottle={16}
        >
          {/* Current book/chapter display - Clickable to expand */}
          {!filterText.trim() && allBooks.find((b) => b.id === currentBookId) && (
            <Animated.View layout={Layout.duration(300)}>
              <Pressable
                onPress={() => {
                  const book = allBooks.find((b) => b.id === currentBookId);
                  if (book) handleBookSelect(book);
                }}
                style={styles.currentChapterDisplay}
                accessibilityRole="button"
                accessibilityLabel={`Current book: ${
                  allBooks.find((b) => b.id === currentBookId)?.name
                }`}
              >
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <Text style={styles.currentChapterText}>
                    {allBooks.find((b) => b.id === currentBookId)?.name}
                  </Text>
                  {selectedBookId === currentBookId ? (
                    <Ionicons name="chevron-down" size={20} color={colors.gold} />
                  ) : (
                    <Ionicons name="chevron-forward" size={20} color={colors.gold} />
                  )}
                </View>
              </Pressable>
              {/* Show chapter grid if this book is selected */}
              {selectedBookId === currentBookId && renderChapterGrid()}
            </Animated.View>
          )}

          {booksToShow.map((book, index) => {
            const isRecent = index < recentBooksFiltered.length && hasRecentBooks;
            const isSelected = book.id === selectedBookId;

            return (
              // Use React.Fragment to render book item and conditionally the chapter grid
              <Animated.View
                key={book.id}
                layout={Layout.duration(300)}
                onLayout={(event) => {
                  const { y } = event.nativeEvent.layout;
                  setBookItemPositions((prev) => new Map(prev).set(book.id, y));
                }}
              >
                {renderBookItem(book, isRecent)}
                {isSelected && renderChapterGrid()}
              </Animated.View>
            );
          })}
        </ScrollView>
      </GestureDetector>
    );
  };

  // Render topics list
  const renderTopicsList = () => {
    if (isTopicsLoading) {
      return (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading topics...</Text>
        </View>
      );
    }

    if (filteredTopics.length === 0) {
      return (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>No topics found</Text>
        </View>
      );
    }

    return (
      <GestureDetector gesture={scrollGesture}>
        <ScrollView
          style={styles.bookList}
          contentContainerStyle={styles.bookListContent}
          keyboardShouldPersistTaps="always"
        >
          {filteredTopics.map((topic: TopicListItem) => (
            <Pressable
              key={topic.topic_id}
              onPress={() => handleTopicSelect(topic.topic_id)}
              style={styles.bookItem}
              accessibilityRole="button"
              accessibilityLabel={topic.name}
              testID={`topic-item-${topic.name.toLowerCase().replace(/\s+/g, '-')}`}
            >
              <View style={styles.topicItemContent}>
                <Text style={styles.bookItemText}>{topic.name}</Text>
                {typeof topic.description === 'string' && topic.description && (
                  <Text style={styles.topicDescription} numberOfLines={2}>
                    {topic.description}
                  </Text>
                )}
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
            </Pressable>
          ))}
        </ScrollView>
      </GestureDetector>
    );
  };

  // Render chapter grid
  const renderChapterGrid = () => {
    if (!selectedBookId || chapterCount === 0) {
      return null;
    }

    const chapters = Array.from({ length: chapterCount }, (_, i) => i + 1);

    // Calculate exact height needed for the grid based on actual measured dimensions
    let calculatedGridHeight = 0;
    if (gridContainerWidth > 0 && buttonWidth > 0 && buttonHeight > 0) {
      const gap = spacing.md;
      // Calculate how many columns fit: floor((containerWidth + gap) / (buttonWidth + gap))
      const columnsPerRow = Math.floor((gridContainerWidth + gap) / (buttonWidth + gap));
      const numRows = Math.ceil(chapterCount / columnsPerRow);
      // Use actual button HEIGHT for calculation
      calculatedGridHeight = numRows * buttonHeight + (numRows - 1) * gap;
    }

    return (
      <View style={styles.chapterGridContent}>
        <View
          style={[
            styles.chapterGrid,
            gridContainerWidth > 0 && buttonHeight > 0 && { height: calculatedGridHeight },
          ]}
          onLayout={(event) => {
            const { width } = event.nativeEvent.layout;
            setGridContainerWidth(width);
          }}
        >
          {chapters.map((chapter, index) => {
            const isCurrent = selectedBookId === currentBookId && chapter === currentChapter;

            return (
              <Pressable
                key={chapter}
                onPress={() => handleChapterSelect(chapter)}
                style={[styles.chapterButton, isCurrent && styles.chapterButtonCurrent]}
                onLayout={(event) => {
                  // Measure the first button to get actual dimensions
                  if (index === 0) {
                    const { width, height } = event.nativeEvent.layout;
                    setButtonWidth(width);
                    setButtonHeight(height);
                  }
                }}
                accessibilityRole="button"
                accessibilityLabel={`Chapter ${chapter}`}
                accessibilityState={{ selected: isCurrent }}
                testID={`chapter-${chapter}`}
              >
                <View style={{ position: 'absolute' }}>
                  <Text
                    style={[styles.chapterButtonText, isCurrent && styles.chapterButtonTextCurrent]}
                  >
                    {chapter}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>
    );
  };

  const ModalContent = (
    <GestureHandlerRootView style={{ flex: 1, zIndex: 9999 }}>
      <Animated.View
        style={[
          styles.backdrop,
          animatedBackdropStyle,
          // Ensure touches pass through when hidden/closed if using custom gesture
          customTranslateY ? { pointerEvents: internalVisible ? 'auto' : 'none' } : undefined,
        ]}
      >
        {/* Backdrop that handles both tap to close and swipe to dismiss - positioned first to be behind modal */}
        <GestureDetector gesture={Gesture.Simultaneous(backdropPanGesture, backdropTapGesture)}>
          <Animated.View style={styles.backdropTouchable} />
        </GestureDetector>
        <Animated.View
          style={[styles.container, animatedModalStyle]}
          testID="bible-navigation-modal"
        >
          {/* Visual extension to cover gap when dragging down */}
          <View
            style={{
              position: 'absolute',
              top: -1000,
              left: 0,
              right: 0,
              height: 1000,
              backgroundColor: modalSpecs.backgroundColor, // Match container background
            }}
          />

          {/* Title */}
          {renderTitle()}

          {/* Main tabs (OT, NT, Topics) */}
          {renderMainTabs()}

          {/* Topic category tabs (only when Topics tab is active) */}
          {selectedTab === 'TOPICS' && renderTopicCategoryTabs()}

          {/* Filter input */}
          {renderFilterInput()}

          {/* Content area */}
          {selectedTab === 'TOPICS' ? renderTopicsList() : renderBookList()}

          {/* Swipe handle at bottom */}
          <GestureDetector gesture={panGesture}>
            <View style={styles.handleContainer}>
              <View style={styles.handle} />
            </View>
          </GestureDetector>
        </Animated.View>
      </Animated.View>
    </GestureHandlerRootView>
  );

  if (!useModalComponent) {
    // If not using Modal, we return the view directly (absolute positioned by parent or styles)
    // We wrap it in a View with absolute positioning to simulate the Modal overlay behavior
    return (
      <View
        style={[StyleSheet.absoluteFill, { zIndex: 9999, elevation: 9999 }]}
        pointerEvents="box-none"
      >
        {ModalContent}
      </View>
    );
  }

  return (
    <Modal visible={internalVisible} transparent animationType="none" onRequestClose={handleClose}>
      {ModalContent}
    </Modal>
  );
}

/**
 * Memoized BibleNavigationModal to prevent unnecessary re-renders
 * when parent component updates but modal is not visible
 */
export const BibleNavigationModal = BibleNavigationModalComponent;

const createStyles = (
  colors: ReturnType<typeof getColors>,
  mode: ThemeMode,
  topInset: number,
  modalSpecs: ReturnType<typeof getModalSpecs>,
  useSplitView: boolean,
  isTablet: boolean
) => {
  // Tablet portrait mode check (Tablet but not in Split View landscape)
  const isTabletPortrait = isTablet && !useSplitView;

  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: modalSpecs.backdropColor,
      justifyContent: 'flex-start',
      alignItems: useSplitView || isTabletPortrait ? 'center' : 'stretch',
    },
    backdropTouchable: {
      ...StyleSheet.absoluteFillObject,
    },
    container: {
      height: modalSpecs.height,
      width: useSplitView ? '60%' : isTabletPortrait ? '70%' : '100%',
      backgroundColor: modalSpecs.backgroundColor,
      borderBottomLeftRadius: 30,
      borderBottomRightRadius: 30,
      paddingTop: spacing.lg + topInset,
      gap: spacing.lg,
    },
    handleContainer: {
      width: '100%',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing.lg,
    },
    handle: {
      width: 72,
      height: 4,
      backgroundColor: modalSpecs.handleColor,
      borderRadius: 100,
    },
    titleContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.lg,
    },
    titleText: {
      fontSize: 24,
      fontWeight: fontWeights.medium,
      color: colors.textPrimary,
      lineHeight: 32,
    },
    breadcrumbContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    breadcrumbText: {
      fontSize: fontSizes.body,
      fontWeight: fontWeights.medium,
      color: colors.gold,
      lineHeight: fontSizes.body * lineHeights.ui,
    },
    testamentTabsContainer: {
      paddingHorizontal: spacing.lg,
    },
    tabsRow: {
      backgroundColor: mode === 'dark' ? colors.gray200 : colors.gray50,
      borderRadius: 100,
      padding: 4,
      flexDirection: 'row',
      justifyContent: 'space-between',
      position: 'relative',
      gap: 4,
      minHeight: 36,
    },
    mainTabIndicator: {
      position: 'absolute',
      height: 28,
      backgroundColor: colors.gold,
      borderRadius: 100,
      top: 4,
      left: 4,
    },
    testamentTab: {
      flex: 1,
      paddingHorizontal: spacing.lg,
      paddingVertical: 2,
      borderRadius: 100,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 28,
      backgroundColor: 'transparent',
      zIndex: 1,
    },
    testamentTabActive: {
      backgroundColor: 'transparent',
    },
    testamentTabText: {
      fontSize: 14,
      fontWeight: '400',
      color: colors.textPrimary,
      ...(Platform.OS === 'ios' && { includeFontPadding: false }),
    },
    testamentTabTextActive: {
      color: colors.black,
    },
    filterContainer: {
      paddingHorizontal: spacing.lg,
    },
    filterInputWrapper: {
      backgroundColor: mode === 'dark' ? colors.gray200 : colors.gray50,
      borderRadius: 100,
      height: 36,
      paddingHorizontal: spacing.lg,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    filterInput: {
      flex: 1,
      fontSize: 14,
      color: colors.textPrimary,
      padding: 0,
      includeFontPadding: false,
    },
    filterClearButton: {
      position: 'absolute',
      right: spacing.xl + spacing.md,
      padding: spacing.xs,
    },
    bookList: {
      flex: 1,
    },
    bookListContent: {
      paddingBottom: spacing.xxl,
    },
    bookItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingLeft: spacing.lg,
      paddingRight: spacing.sm,
      paddingVertical: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      minHeight: 48,
      backgroundColor: modalSpecs.backgroundColor,
      gap: spacing.lg,
    },
    bookItemSelected: {
      backgroundColor: colors.gold,
    },
    bookItemText: {
      fontSize: fontSizes.body,
      fontWeight: fontWeights.regular,
      color: colors.textPrimary,
      lineHeight: fontSizes.body * lineHeights.ui,
    },
    bookItemTextSelected: {
      color: colors.background,
      fontWeight: fontWeights.medium,
    },
    bookItemRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    clockIcon: {
      marginRight: spacing.xs,
    },
    loadingContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.xxl,
    },
    loadingText: {
      fontSize: fontSizes.body,
      color: colors.textSecondary,
    },
    chapterGridContainer: {
      flex: 1,
    },
    chapterGridContent: {
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.xl,
      paddingBottom: spacing.lg,
    },
    chapterGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.md,
    },
    chapterButton: {
      width: isTablet ? 75 : '17.4%', // Smaller fixed width on tablets (both portrait & landscape), 5 columns on phones
      aspectRatio: 1,
      backgroundColor: modalSpecs.backgroundColor,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing.sm,
    },
    chapterButtonCurrent: {
      backgroundColor: colors.gold,
      borderColor: colors.gold,
    },
    chapterButtonText: {
      fontSize: fontSizes.body,
      fontWeight: fontWeights.medium,
      color: colors.textPrimary,
      textAlign: 'center',
    },
    chapterButtonTextCurrent: {
      color: colors.gray900,
      fontWeight: fontWeights.semibold,
    },
    // Topics styles
    categoryTabsContainer: {
      paddingHorizontal: spacing.lg,
    },
    categoryTabsRow: {
      backgroundColor: mode === 'dark' ? colors.gray200 : colors.gray50,
      borderRadius: 100,
      padding: 4,
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 4,
      position: 'relative',
      minHeight: 36,
    },
    categoryTabIndicator: {
      position: 'absolute',
      height: 28,
      backgroundColor: colors.gold,
      borderRadius: 100,
      top: 4,
      left: 4,
    },
    categoryTab: {
      flex: 1,
      paddingHorizontal: 4,
      paddingVertical: 2,
      borderRadius: 100,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 28,
      backgroundColor: 'transparent',
      zIndex: 1,
    },
    categoryTabActive: {
      backgroundColor: 'transparent',
    },
    categoryTabText: {
      fontSize: 13, // Slightly smaller to fit "Prophecies"
      fontWeight: '400',
      color: colors.textPrimary,
    },
    categoryTabTextActive: {
      color: colors.black,
      fontWeight: fontWeights.medium,
    },
    topicItemContent: {
      flex: 1,
      gap: spacing.xs,
    },
    topicDescription: {
      fontSize: fontSizes.bodySmall,
      color: colors.textSecondary,
      lineHeight: fontSizes.bodySmall * lineHeights.body,
    },
    currentChapterDisplay: {
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      minHeight: 56,
      backgroundColor: modalSpecs.backgroundColor,
    },
    currentChapterText: {
      fontSize: fontSizes.body,
      fontWeight: fontWeights.semibold,
      color: colors.gold,
    },
  });
};
