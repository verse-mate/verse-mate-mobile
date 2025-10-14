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
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import {
  colors,
  fontSizes,
  fontWeights,
  lineHeights,
  modalSpecs,
  spacing,
  springConfig,
} from '@/constants/bible-design-tokens';
import { useRecentBooks } from '@/hooks/bible/use-recent-books';
import { useBibleTestaments } from '@/src/api/bible/hooks';
import type { BookMetadata, Testament } from '@/types/bible';
import { getTestamentFromBookId } from '@/types/bible';

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
}

/**
 * BibleNavigationModal - Bottom sheet for book/chapter selection
 */
export function BibleNavigationModal({
  visible,
  currentBookId,
  currentChapter,
  onClose,
  onSelectChapter,
}: BibleNavigationModalProps) {
  // State for testament selection and book/chapter navigation
  const [selectedTestament, setSelectedTestament] = useState<Testament>(
    getTestamentFromBookId(currentBookId)
  );
  const [selectedBookId, setSelectedBookId] = useState<number | null>(currentBookId);
  const [filterText, setFilterText] = useState('');

  // Fetch books and recent books
  const { data: allBooks = [], isLoading: isBooksLoading } = useBibleTestaments();
  const { recentBooks } = useRecentBooks();

  // Animation values for swipe-to-dismiss
  const translateY = useSharedValue(0);
  const backdropOpacity = useSharedValue(0);

  // Reset state when modal becomes visible
  useEffect(() => {
    if (visible) {
      setSelectedTestament(getTestamentFromBookId(currentBookId));
      setSelectedBookId(currentBookId);
      setFilterText('');
      translateY.value = 0;
      backdropOpacity.value = withTiming(1, { duration: 300 });
    } else {
      backdropOpacity.value = withTiming(0, { duration: 200 });
    }
  }, [visible, currentBookId, translateY, backdropOpacity]);

  // Filter books by testament and filter text
  const filteredBooks = useMemo(() => {
    const testamentBooks = allBooks.filter((book) => book.testament === selectedTestament);

    if (!filterText.trim()) {
      return testamentBooks;
    }

    const searchLower = filterText.toLowerCase();
    return testamentBooks.filter((book) => book.name.toLowerCase().includes(searchLower));
  }, [allBooks, selectedTestament, filterText]);

  // Recent books for current testament
  const recentBooksForTestament = useMemo(() => {
    const recentBookIds = recentBooks.map((r) => r.bookId);
    return allBooks.filter(
      (book) => recentBookIds.includes(book.id) && book.testament === selectedTestament
    );
  }, [allBooks, recentBooks, selectedTestament]);

  // Get selected book's chapter count
  const selectedBook = allBooks.find((book) => book.id === selectedBookId);
  const chapterCount = selectedBook?.chapterCount ?? 0;

  // Handle testament tab switch
  const handleTestamentChange = useCallback((testament: Testament) => {
    setSelectedTestament(testament);
    setFilterText(''); // Clear filter on testament switch
    setSelectedBookId(null); // Clear selected book
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  // Handle book selection
  const handleBookSelect = useCallback((book: BookMetadata) => {
    setSelectedBookId(book.id);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  // Handle chapter selection
  const handleChapterSelect = useCallback(
    (chapter: number) => {
      if (selectedBookId) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onSelectChapter(selectedBookId, chapter);
        onClose();
      }
    },
    [selectedBookId, onSelectChapter, onClose]
  );

  // Swipe-to-dismiss gesture
  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      // Only allow downward swipe
      if (e.translationY > 0) {
        translateY.value = e.translationY;
        // Fade backdrop as user swipes down
        backdropOpacity.value = Math.max(0, 1 - e.translationY / 300);
      }
    })
    .onEnd((e) => {
      if (e.translationY > 100) {
        // Swipe distance threshold met - close modal
        runOnJS(onClose)();
      } else {
        // Snap back to original position
        translateY.value = withSpring(0, springConfig);
        backdropOpacity.value = withTiming(1, { duration: 200 });
      }
    });

  const animatedModalStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const animatedBackdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  // Render breadcrumb
  const renderBreadcrumb = () => {
    const testamentName = selectedTestament === 'OT' ? 'Old Testament' : 'New Testament';
    const bookName = selectedBook?.name ?? '';
    const breadcrumb = bookName
      ? `${testamentName}, ${bookName}, ${currentChapter}`
      : testamentName;

    return (
      <View style={styles.breadcrumbContainer}>
        <Text style={styles.breadcrumbText}>{breadcrumb}</Text>
        <Ionicons name="chevron-down" size={20} color={colors.gold} />
      </View>
    );
  };

  // Render testament tabs
  const renderTestamentTabs = () => (
    <View style={styles.testamentTabsContainer}>
      <Pressable
        onPress={() => handleTestamentChange('OT')}
        style={styles.testamentTab}
        accessibilityRole="tab"
        accessibilityState={{ selected: selectedTestament === 'OT' }}
      >
        <Text
          style={[
            styles.testamentTabText,
            selectedTestament === 'OT' && styles.testamentTabTextActive,
          ]}
        >
          Old Testament
        </Text>
      </Pressable>

      <Pressable
        onPress={() => handleTestamentChange('NT')}
        style={styles.testamentTab}
        accessibilityRole="tab"
        accessibilityState={{ selected: selectedTestament === 'NT' }}
      >
        <Text
          style={[
            styles.testamentTabText,
            selectedTestament === 'NT' && styles.testamentTabTextActive,
          ]}
        >
          New Testament
        </Text>
      </Pressable>
    </View>
  );

  // Render filter input
  const renderFilterInput = () => (
    <View style={styles.filterContainer}>
      <TextInput
        style={styles.filterInput}
        placeholder="Filter books..."
        placeholderTextColor={colors.gray300}
        value={filterText}
        onChangeText={setFilterText}
        returnKeyType="search"
        accessibilityLabel="Filter books"
      />
      {filterText.length > 0 && (
        <Pressable
          onPress={() => setFilterText('')}
          style={styles.filterClearButton}
          accessibilityRole="button"
          accessibilityLabel="Clear filter"
        >
          <Ionicons name="close-circle" size={20} color={colors.gray300} />
        </Pressable>
      )}
    </View>
  );

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
      >
        <Text style={[styles.bookItemText, isSelected && styles.bookItemTextSelected]}>
          {book.name}
        </Text>
        <View style={styles.bookItemRight}>
          {isRecent && !isSelected && (
            <Ionicons
              name="time-outline"
              size={18}
              color={colors.gray500}
              style={styles.clockIcon}
            />
          )}
          {isSelected && <Ionicons name="checkmark" size={20} color={colors.white} />}
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

    const hasRecentBooks = recentBooksForTestament.length > 0 && !filterText.trim();
    const booksToShow = hasRecentBooks
      ? [
          ...recentBooksForTestament,
          ...filteredBooks.filter((book) => !recentBooksForTestament.some((r) => r.id === book.id)),
        ]
      : filteredBooks;

    return (
      <ScrollView style={styles.bookList} contentContainerStyle={styles.bookListContent}>
        {booksToShow.map((book, index) => {
          const isRecent = index < recentBooksForTestament.length && hasRecentBooks;
          return renderBookItem(book, isRecent);
        })}
      </ScrollView>
    );
  };

  // Render chapter grid
  const renderChapterGrid = () => {
    if (!selectedBookId || chapterCount === 0) {
      return null;
    }

    const chapters = Array.from({ length: chapterCount }, (_, i) => i + 1);

    return (
      <View style={styles.chapterGridContainer}>
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
              >
                <Text
                  style={[styles.chapterButtonText, isCurrent && styles.chapterButtonTextCurrent]}
                >
                  {chapter}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Animated.View style={[styles.backdrop, animatedBackdropStyle]}>
        <Pressable style={styles.backdropTouchable} onPress={onClose} />

        <GestureDetector gesture={panGesture}>
          <Animated.View style={[styles.container, animatedModalStyle]}>
            {/* Swipe handle */}
            <View style={styles.handle} />

            {/* Breadcrumb */}
            {renderBreadcrumb()}

            {/* Testament tabs */}
            {renderTestamentTabs()}

            {/* Filter input */}
            {renderFilterInput()}

            {/* Book list or chapter grid */}
            {selectedBookId && !filterText.trim() ? renderChapterGrid() : renderBookList()}
          </Animated.View>
        </GestureDetector>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: modalSpecs.backdropColor,
    justifyContent: 'flex-end',
  },
  backdropTouchable: {
    flex: 1,
  },
  container: {
    height: modalSpecs.height,
    backgroundColor: modalSpecs.backgroundColor,
    borderTopLeftRadius: modalSpecs.borderTopLeftRadius,
    borderTopRightRadius: modalSpecs.borderTopRightRadius,
  },
  handle: {
    width: modalSpecs.handleWidth,
    height: modalSpecs.handleHeight,
    backgroundColor: modalSpecs.handleColor,
    borderRadius: modalSpecs.handleHeight / 2,
    alignSelf: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  breadcrumbContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray200,
  },
  breadcrumbText: {
    fontSize: fontSizes.body,
    fontWeight: fontWeights.medium,
    color: colors.gold,
    lineHeight: fontSizes.body * lineHeights.ui,
  },
  testamentTabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray200,
    gap: spacing.xxl,
  },
  testamentTab: {
    paddingVertical: spacing.sm,
  },
  testamentTabText: {
    fontSize: fontSizes.body,
    fontWeight: fontWeights.regular,
    color: colors.black,
    lineHeight: fontSizes.body * lineHeights.ui,
  },
  testamentTabTextActive: {
    color: colors.gold,
    fontWeight: fontWeights.medium,
  },
  filterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray200,
  },
  filterInput: {
    flex: 1,
    height: 40,
    backgroundColor: colors.gray50,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    fontSize: fontSizes.body,
    color: colors.black,
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
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray200,
    minHeight: 56,
    backgroundColor: colors.white,
  },
  bookItemSelected: {
    backgroundColor: colors.gold,
  },
  bookItemText: {
    fontSize: fontSizes.body,
    fontWeight: fontWeights.regular,
    color: colors.black,
    lineHeight: fontSizes.body * lineHeights.ui,
  },
  bookItemTextSelected: {
    color: colors.white,
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
    color: colors.gray500,
  },
  chapterGridContainer: {
    flex: 1,
    padding: spacing.xl,
  },
  chapterGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  chapterButton: {
    width: '17.6%', // 5 columns with gaps
    aspectRatio: 1,
    backgroundColor: colors.white,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.gray200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chapterButtonCurrent: {
    backgroundColor: colors.gold,
    borderColor: colors.gold,
  },
  chapterButtonText: {
    fontSize: fontSizes.body,
    fontWeight: fontWeights.medium,
    color: colors.black,
  },
  chapterButtonTextCurrent: {
    color: colors.gray900,
    fontWeight: fontWeights.semibold,
  },
});
