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
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import {
  Keyboard,
  Modal,
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
import { useBibleTestaments, useTopicsSearch } from '@/src/api/generated';
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
  useModalComponent = true,
  customTranslateY,
}: BibleNavigationModalProps) {
  const { colors, mode } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors, mode, insets.top), [colors, mode, insets.top]);

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
  const [mainTabWidth, setMainTabWidth] = useState(0);
  const [categoryTabWidth, setCategoryTabWidth] = useState(0);
  const mainTabSlideAnim = useRef(
    new RNAnimated.Value(selectedTab === 'OT' ? 0 : selectedTab === 'NT' ? 1 : 2)
  ).current;
  const categoryTabSlideAnim = useRef(new RNAnimated.Value(0)).current;

  // Track if modal is effectively open (visible prop OR dragging down)
  const [isOpenOrDragging, setIsOpenOrDragging] = useState(visible);

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

  // Fetch topics data - only when modal is visible and Topics tab is selected
  const shouldFetchTopics = !!shouldFetchData && selectedTab === 'TOPICS';
  const hasSearchText = topicFilterText.trim().length > 0;

  // When searching, fetch all categories; otherwise fetch only selected category
  const { data: eventTopics = [], isLoading: isEventsLoading } = useTopicsSearch('EVENT', {
    enabled: shouldFetchTopics && (hasSearchText || selectedTopicCategory === 'EVENT'),
  });
  const { data: prophecyTopics = [], isLoading: isPropheciesLoading } = useTopicsSearch(
    'PROPHECY',
    {
      enabled: shouldFetchTopics && (hasSearchText || selectedTopicCategory === 'PROPHECY'),
    }
  );
  const { data: parableTopics = [], isLoading: isParablesLoading } = useTopicsSearch('PARABLE', {
    enabled: shouldFetchTopics && (hasSearchText || selectedTopicCategory === 'PARABLE'),
  });
  const { data: themeTopics = [], isLoading: isThemesLoading } = useTopicsSearch('THEME', {
    enabled: shouldFetchTopics && (hasSearchText || selectedTopicCategory === 'THEME'),
  });

  // Combine loading states
  const isTopicsLoading =
    isEventsLoading || isPropheciesLoading || isParablesLoading || isThemesLoading;

  // Get current category topics or all topics when searching
  const currentTopics = useMemo(() => {
    if (hasSearchText) {
      // When searching, combine all categories
      return [
        ...(eventTopics as TopicListItem[]),
        ...(prophecyTopics as TopicListItem[]),
        ...(parableTopics as TopicListItem[]),
        ...(themeTopics as TopicListItem[]),
      ];
    }
    // No search - return only selected category
    if (selectedTopicCategory === 'EVENT') return eventTopics as TopicListItem[];
    if (selectedTopicCategory === 'PROPHECY') return prophecyTopics as TopicListItem[];
    if (selectedTopicCategory === 'PARABLE') return parableTopics as TopicListItem[];
    if (selectedTopicCategory === 'THEME') return themeTopics as TopicListItem[];
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
    return interpolate(translateY.value, [-1000, 0], [0, 1], Extrapolation.CLAMP);
  });
  const [internalVisible, setInternalVisible] = useState(visible);

  // Gesture for handling scroll events within the lists
  const scrollGesture = Gesture.Native();

  // Tap gesture for backdrop to close modal
  const backdropTapGesture = Gesture.Tap().onEnd(() => {
    runOnJS(handleClose)();
  });

  // Handle closing with animation
  const handleClose = useCallback(() => {
    translateY.value = withTiming(-1000, { duration: 250 }, (finished) => {
      if (finished) {
        runOnJS(onClose)();
      }
    });
  }, [onClose, translateY]);

  // Reset state when modal becomes visible and animate from top (simple slide, no spring)
  useEffect(() => {
    if (visible) {
      setInternalVisible(true);
      const testament = getTestamentFromBookId(currentBookId);
      setSelectedTab(testament);
      setSelectedTestament(testament);
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
  }, [visible, currentBookId, translateY, customTranslateY]);

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

  // Handle book selection
  const handleBookSelect = useCallback((book: BookMetadata) => {
    setSelectedBookId((prevId) => (prevId === book.id ? null : book.id));
    Keyboard.dismiss();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

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

  // Handle layout for main tabs
  const handleMainTabLayout = useCallback((event: LayoutChangeEvent) => {
    const { width } = event.nativeEvent.layout;
    const singleTabWidth = (width - 12) / 3; // 3 tabs, 8px padding, 4px gaps
    setMainTabWidth(singleTabWidth);
  }, []);

  // Calculate translateX for main tab indicator
  const mainTabTranslateX = mainTabSlideAnim.interpolate({
    inputRange: [0, 1, 2],
    outputRange: [0, mainTabWidth + 4, (mainTabWidth + 4) * 2],
  });

  // Render main tabs (OT, NT, Topics)
  const renderMainTabs = () => (
    <View style={styles.testamentTabsContainer}>
      <View style={styles.tabsRow} onLayout={handleMainTabLayout}>
        {/* Sliding indicator for main tabs */}
        <RNAnimated.View
          style={[
            styles.mainTabIndicator,
            {
              width: mainTabWidth,
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
        >
          <Text
            style={[styles.testamentTabText, selectedTab === 'OT' && styles.testamentTabTextActive]}
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
          >
            Topics
          </Text>
        </Pressable>
      </View>
    </View>
  );

  // Handle layout for category tabs
  const handleCategoryTabLayout = useCallback((event: LayoutChangeEvent) => {
    const { width } = event.nativeEvent.layout;
    const singleTabWidth = (width - 16) / 4; // 4 tabs, 8px padding, 12px gaps (3 gaps of 4px)
    setCategoryTabWidth(singleTabWidth);
  }, []);

  // Calculate translateX for category tab indicator
  const categoryTabTranslateX = categoryTabSlideAnim.interpolate({
    inputRange: [0, 1, 2, 3],
    outputRange: [0, categoryTabWidth + 4, (categoryTabWidth + 4) * 2, (categoryTabWidth + 4) * 3],
  });

  // Render topic category tabs
  const renderTopicCategoryTabs = () => (
    <View style={styles.categoryTabsContainer}>
      <View style={styles.categoryTabsRow} onLayout={handleCategoryTabLayout}>
        {/* Sliding indicator for category tabs */}
        <RNAnimated.View
          style={[
            styles.categoryTabIndicator,
            {
              width: categoryTabWidth,
              transform: [{ translateX: categoryTabTranslateX }],
            },
          ]}
        />
        <Pressable
          onPress={() => handleTopicCategoryChange('EVENT')}
          style={styles.categoryTab}
          accessibilityRole="tab"
          accessibilityState={{ selected: selectedTopicCategory === 'EVENT' }}
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
          <Ionicons name="search" size={24} color="#818990" />
          <TextInput
            style={styles.filterInput}
            placeholder={placeholder}
            placeholderTextColor="#818990"
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
          style={styles.bookList}
          contentContainerStyle={styles.bookListContent}
          keyboardShouldPersistTaps="always"
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
              <Animated.View key={book.id} layout={Layout.duration(300)}>
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

    return (
      <View style={styles.chapterGridContent}>
        <View style={styles.chapterGrid}>
          {chapters.map((chapter) => {
            const isCurrent = selectedBookId === currentBookId && chapter === currentChapter;

            return (
              <Pressable
                key={chapter}
                onPress={() => handleChapterSelect(chapter)}
                style={[styles.chapterButton, isCurrent && styles.chapterButtonCurrent]}
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
              backgroundColor: '#1e1e1e', // Match container background
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
        {/* Backdrop that handles both tap to close and swipe to dismiss */}
        <GestureDetector gesture={Gesture.Exclusive(panGesture, backdropTapGesture)}>
          <Animated.View style={styles.backdropTouchable} />
        </GestureDetector>
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
export const BibleNavigationModal = memo(BibleNavigationModalComponent);

const createStyles = (colors: ReturnType<typeof getColors>, mode: ThemeMode, topInset: number) => {
  const modalSpecs = getModalSpecs(mode);

  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: modalSpecs.backdropColor,
      justifyContent: 'flex-start',
    },
    backdropTouchable: {
      flex: 1,
    },
    container: {
      height: modalSpecs.height,
      backgroundColor: '#1e1e1e',
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
      backgroundColor: '#3a3a3a',
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
      color: '#e8e8e8',
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
      backgroundColor: '#323232',
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
      color: colors.white,
    },
    testamentTabTextActive: {
      color: colors.black,
    },
    filterContainer: {
      paddingHorizontal: spacing.lg,
    },
    filterInputWrapper: {
      backgroundColor: '#323232',
      borderRadius: 100,
      height: 36,
      paddingHorizontal: spacing.lg,
      paddingVertical: 4,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    filterInput: {
      flex: 1,
      fontSize: 14,
      color: colors.white,
      padding: 0,
    },
    searchIcon: {
      width: 24,
      height: 24,
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
      borderBottomColor: 'rgba(62,70,77,0.5)',
      minHeight: 48,
      backgroundColor: '#1e1e1e',
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
      // paddingBottom is removed to avoid double padding with bookListContent
    },
    chapterGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.md,
    },
    chapterButton: {
      width: '17.4%', // 5 columns with space-between
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
      backgroundColor: '#323232',
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
      color: colors.white,
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
