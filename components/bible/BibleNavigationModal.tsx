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
import { type BibleReference, ReferenceParser } from '@versemate/bible-search';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { Fragment, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FlatList,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  Animated as RNAnimated,
  ScrollView,
  SectionList,
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
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { JesusNavTab } from '@/components/bible/JesusNavTab';
import { useOfflineContext } from '@/contexts/OfflineContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useRecentBooks } from '@/hooks/bible/use-recent-books';
import { useVerseSearch } from '@/hooks/bible/use-verse-search';
import { useCachedTopics } from '@/hooks/topics/use-cached-topics';
import { useBibleVersion } from '@/hooks/use-bible-version';
import { useDeviceInfo } from '@/hooks/use-device-info';
import { analytics } from '@/lib/analytics';
import { AnalyticsEvent } from '@/lib/analytics/types';
import type { VerseSearchResult } from '@/lib/bible-search/types';
import { useBibleTestaments } from '@/src/api';
import {
  fontSizes,
  fontWeights,
  type getColors,
  getModalSpecs,
  lineHeights,
  spacing,
  springConfig,
  type ThemeMode,
} from '@/theme/tokens';
import type { BookMetadata, Testament } from '@/types/bible';
import { getTestamentFromBookId, MAX_RECENT_BOOKS } from '@/types/bible';
import type { TopicCategory } from '@/types/topics';
import { splitBookScope } from '@/utils/bible/bookScope';

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
  /**
   * Callback when the user picks a verse (a search result or a typed
   * reference like "John 3:16"). The reader opens the chapter there, scrolls
   * to the verse and marks it in yellow (`mark`) instead of opening Verse
   * Insight, for references and verse results alike (web #324, mobile #399).
   * Without it the sheet pushes the reader route with `?verse=` (`&mark=1`).
   */
  onSelectVerse?: (
    bookId: number,
    chapter: number,
    verse: number,
    endVerse?: number,
    options?: { mark?: boolean }
  ) => void;
  /** Initial tab to open (defaults to testament of currentBookId) */
  initialTab?: 'OT' | 'NT' | 'JESUS' | 'TOPICS';
  /** Initial topic category to open when initialTab is TOPICS (defaults to EVENT) */
  initialTopicCategory?: TopicCategory;
  /** Whether to use the native Modal component (default: true) */
  useModalComponent?: boolean;
  /** Optional shared value for vertical translation (for external gesture control) */
  customTranslateY?: SharedValue<number>;
}

type BookListItem = BookMetadata & { _listKey: string };

/** Rows of the Bible tabs' search results, besides the book rows. */
type SearchRow =
  | { kind: 'goto'; _listKey: string; ref: BibleReference }
  | {
      kind: 'verse';
      _listKey: string;
      result: VerseSearchResult;
      index: number;
      /** "Exact phrase" / "All words" above the first row of each group. */
      groupLabel: string | null;
    }
  | { kind: 'status'; _listKey: string; text: string }
  | { kind: 'more'; _listKey: string };

type ListRow = BookListItem | SearchRow;

interface BookListSection {
  key: string;
  title: string;
  section: 'RECENTS' | 'ALL_BOOKS' | 'GOTO' | 'VERSES';
  data: ListRow[];
}

const isSearchRow = (row: ListRow): row is SearchRow => 'kind' in row;

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
  onSelectVerse,
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
  type TabType = Testament | 'JESUS' | 'TOPICS';
  // The indicator slides between four stops now. Deriving its index from this
  // order — rather than a chain of ternaries — is what keeps the pill under the
  // right tab when one is added; the previous chain silently parked anything
  // that was not OT or NT on the third stop.
  const TAB_ORDER: TabType[] = ['OT', 'NT', 'JESUS', 'TOPICS'];
  // Four tabs do not fit "Old Testament" / "New Testament" on a narrow phone —
  // they shrank to fit while "Jesus" and "Topics" stayed full size, so the row
  // read as uneven and the long ones were barely legible. Web abbreviates below
  // the same 420px for the same reason. The test ids stay constant either way.
  // 'Old Testament' / 'New Testament' cannot share a row with 'Jesus' and
  // 'Topics' on a phone. The previous attempt let iOS shrink them to fit, which
  // is what produced a row of four tabs at two different sizes — the long two
  // scaled down to ~0.8 while the short two stayed full size, so the testaments
  // read as subordinate and, per the tester, "turned really small". Short labels
  // at ONE size is the fix; adjustsFontSizeToFit is gone for the same reason.
  const { t } = useTranslation();
  const otLabel = t('navigation.old', 'Old');
  const ntLabel = t('navigation.new', 'New');
  const [selectedTab, setSelectedTab] = useState<TabType>(getTestamentFromBookId(currentBookId));

  // Bible navigation state
  const [selectedTestament, setSelectedTestament] = useState<Testament>(
    getTestamentFromBookId(currentBookId)
  );
  const [selectedBookId, setSelectedBookId] = useState<number | null>(null);
  const [selectedSection, setSelectedSection] = useState<'RECENTS' | 'ALL_BOOKS' | null>(null);
  const [filterText, setFilterText] = useState('');

  // Search mode: tapping the search field folds the title and the tabs away
  // so the field sits at the top, with an arrow beside it to come back. It
  // holds while the keyboard comes and goes; only that arrow (or closing the
  // sheet) leaves it. Same behavior as web on touch screens.
  const [searchMode, setSearchMode] = useState(false);
  const reduceMotion = useReducedMotion();
  const foldProgress = useSharedValue(0);
  const [chromeHeight, setChromeHeight] = useState(0);
  useEffect(() => {
    foldProgress.value = withTiming(searchMode ? 1 : 0, { duration: reduceMotion ? 0 : 220 });
  }, [searchMode, reduceMotion, foldProgress]);

  // Topics navigation state
  const [selectedTopicCategory, setSelectedTopicCategory] = useState<TopicCategory>('EVENT');
  const [topicFilterText, setTopicFilterText] = useState('');

  // Animation state for sliding indicators
  const [singleMeasuredTabWidth, setSingleMeasuredTabWidth] = useState(0);
  const [singleMeasuredCategoryTabWidth, setSingleMeasuredCategoryTabWidth] = useState(0);
  const mainTabSlideAnim = useRef(new RNAnimated.Value(TAB_ORDER.indexOf(selectedTab))).current;
  const categoryTabSlideAnim = useRef(new RNAnimated.Value(0)).current;

  // Track if modal is effectively open (visible prop OR dragging down)
  const [isOpenOrDragging, setIsOpenOrDragging] = useState(visible);

  // State to track the chapter grid container and button dimensions for dynamic calculations
  const [gridContainerWidth, setGridContainerWidth] = useState(0);
  const [buttonWidth, setButtonWidth] = useState(0);
  const [buttonHeight, setButtonHeight] = useState(0);

  // Ref for SectionList to enable programmatic scrolling
  const sectionListRef = useRef<SectionList<ListRow, BookListSection>>(null);

  // Animate main tab indicator when selectedTab changes
  useEffect(() => {
    const tabIndex = TAB_ORDER.indexOf(selectedTab);
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

  // ─── Bible search (OT / NT tabs) ───────────────────────────────────────────
  // Typing on a Bible tab searches references ("John 3:16" → a Go to row),
  // book names and verse text, the same as web.
  const { bibleVersion } = useBibleVersion();
  const { isOnline } = useOfflineContext();
  // The version's own book names ("Geneza", "1. Mose"), so a reference typed
  // in the reader's language is understood too; the list keeps its names.
  const { data: versionBooks } = useBibleTestaments(
    { query: { bible_version: bibleVersion } },
    { enabled: !!shouldFetchData }
  );
  const localizedNames = useMemo(
    () => Object.fromEntries((versionBooks ?? []).map((b) => [b.id, b.name])),
    [versionBooks]
  );
  const parser = useMemo(
    () =>
      new ReferenceParser(
        allBooks.map((b) => ({ bookId: b.id, name: b.name, chapters: b.chapterCount })),
        localizedNames
      ),
    [allBooks, localizedNames]
  );
  const isBibleTab = selectedTab === 'OT' || selectedTab === 'NT';
  const searching = isBibleTab && filterText.trim() !== '';
  const references = useMemo(
    () => (searching ? parser.parse(filterText) : []),
    [searching, parser, filterText]
  );
  // "John 3:16" is a place, not words to look for. A book on its own ("Rom",
  // "Philipians", "Job") is listed under Books instead, and may be a word too,
  // so the verse search still runs for it.
  const goToRefs = useMemo(() => references.filter((r) => r.chapter !== undefined), [references]);
  const referencedBookIds = useMemo(
    () => references.filter((r) => r.chapter === undefined).map((r) => r.bookId),
    [references]
  );
  // A book name in front of words ("Amos day of the Lord") searches the words in that book, with a
  // "Search all books" way out (web #324, same logic: utils/bible/bookScope).
  const bookScope = useMemo(
    () =>
      searching && goToRefs.length === 0 && allBooks.length > 0
        ? splitBookScope(filterText, parser, localizedNames)
        : null,
    [searching, goToRefs.length, allBooks.length, filterText, parser, localizedNames]
  );
  const [unscopedQuery, setUnscopedQuery] = useState<string | null>(null);
  const scope = bookScope && unscopedQuery !== filterText.trim() ? bookScope : null;
  /** The words the verse search looks for: the typed text, less a scoping book name. */
  const searchedText = scope ? scope.text : filterText;
  const verseSearch = useVerseSearch(
    searchedText,
    bibleVersion,
    searching && goToRefs.length === 0,
    scope?.bookId
  );

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

      // Only set testament for a testament tab. JESUS and TOPICS are not
      // testaments, and `selectedTestament` is typed as one — passing either
      // through is what the type error caught.
      if (defaultTab !== 'TOPICS' && defaultTab !== 'JESUS') {
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
      setSelectedSection(null);
      setFilterText('');
      setTopicFilterText('');
      setSearchMode(false);
      foldProgress.value = 0;
      translateY.value = withTiming(0, { duration: 300 });
    } else if (!customTranslateY) {
      // If visible prop becomes false (e.g. parent closed it), animate out
      translateY.value = withTiming(-1000, { duration: 250 }, (finished) => {
        if (finished) {
          runOnJS(setInternalVisible)(false);
        }
      });
    }
  }, [
    visible,
    currentBookId,
    initialTab,
    initialTopicCategory,
    translateY,
    customTranslateY,
    foldProgress,
  ]);

  // Filter books by testament and filter text
  const filteredBooks = useMemo(() => {
    // If there's a filter text, search across all books
    if (filterText.trim()) {
      const searchLower = filterText.toLowerCase();
      return allBooks.filter(
        (book) =>
          book.name.toLowerCase().includes(searchLower) || referencedBookIds.includes(book.id)
      );
    }
    // Otherwise, return books from the selected testament
    return allBooks.filter((book) => book.testament === selectedTestament);
  }, [allBooks, selectedTestament, filterText, referencedBookIds]);

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

  // Recent books across all testaments — current book always at position 0
  const recentBooksFiltered = useMemo(() => {
    // Build stored list, removing any entry that matches currentBookId (dedup)
    const stored = recentBooks
      .filter((rb) => rb.bookId !== currentBookId)
      .sort((a, b) => b.timestamp - a.timestamp)
      .map((rb) => allBooks.find((b) => b.id === rb.bookId))
      .filter((book): book is BookMetadata => book !== undefined)
      .slice(0, MAX_RECENT_BOOKS - 1); // leave room for current book at position 0

    // Inject current book at position 0
    const currentBook = allBooks.find((b) => b.id === currentBookId);
    return currentBook ? [currentBook, ...stored] : stored;
  }, [allBooks, recentBooks, currentBookId]);

  // The verse results as list rows: group labels, a status row while there
  // is nothing to show, and Load more.
  const verseRows = useMemo((): SearchRow[] => {
    if (!verseSearch.active) return [];
    const { results } = verseSearch;
    if (results.length === 0) {
      const text = verseSearch.isPending
        ? t('search.searching', 'Searching…')
        : verseSearch.isError
          ? isOnline
            ? t('search.unavailable', 'Search is unavailable right now. Try again in a moment.')
            : t(
                'search.offlineNoDownload',
                "You're offline. Download this translation to search it without a connection."
              )
          : scope
            ? t('search.noVersesInBook', 'No verses in {{book}} match "{{query}}".', {
                book: scope.bookName,
                query: searchedText.trim(),
              })
            : t(
                'search.noVerses',
                'No verses match "{{query}}". Try fewer words or check the spelling.',
                {
                  query: searchedText.trim(),
                }
              );
      return [{ kind: 'status', _listKey: 'verse-status', text }];
    }
    // One word has no "phrase": its exact matches need no label, and the
    // stemmer's matches ("loving" → love, loved) read as other forms of it.
    const singleWord = (searchedText.match(/[\p{L}\p{M}\p{N}]+/gu) ?? []).length === 1;
    const firstWords = results.findIndex((r) => r.match === 'words');
    const rows: SearchRow[] = results.map((result, index) => ({
      kind: 'verse',
      _listKey: `verse-${result.bookId}-${result.chapter}-${result.verse}`,
      result,
      index,
      groupLabel:
        index === 0 && result.match === 'exact'
          ? singleWord
            ? null
            : t('search.exactPhrase', 'Exact phrase')
          : index === firstWords
            ? singleWord
              ? t('search.otherForms', 'Other forms of the word')
              : t('search.allWords', 'All words')
            : null,
    }));
    if (verseSearch.hasMore) rows.push({ kind: 'more', _listKey: 'verse-more' });
    return rows;
  }, [verseSearch, searchedText, scope, isOnline, t]);

  // Build SectionList sections for book list
  const bookSections = useMemo((): BookListSection[] => {
    const sections: BookListSection[] = [];
    const isFiltering = !!filterText.trim();

    if (searching) {
      if (goToRefs.length > 0) {
        sections.push({
          key: 'go-to',
          title: '',
          section: 'GOTO',
          data: goToRefs.map((ref, i) => ({ kind: 'goto', _listKey: `go-to-${i}`, ref })),
        });
      }
      if (filteredBooks.length > 0) {
        sections.push({
          key: 'all-books',
          title: verseSearch.active ? t('search.books', 'BOOKS') : '',
          section: 'ALL_BOOKS',
          data: filteredBooks.map((book) => ({ ...book, _listKey: `book-${book.id}` })),
        });
      }
      if (verseSearch.active) {
        sections.push({
          key: 'verses',
          title: t('search.verses', 'VERSES'),
          section: 'VERSES',
          data: verseRows,
        });
      }
      return sections;
    }

    if (!isFiltering && recentBooksFiltered.length > 0) {
      sections.push({
        key: 'recents',
        title: 'RECENTS',
        section: 'RECENTS',
        data: recentBooksFiltered.map((book) => ({ ...book, _listKey: `recent-${book.id}` })),
      });
    }
    sections.push({
      key: 'all-books',
      title: isFiltering ? '' : 'ALL BOOKS',
      section: 'ALL_BOOKS',
      data: filteredBooks.map((book) => ({ ...book, _listKey: `book-${book.id}` })),
    });
    return sections;
  }, [
    recentBooksFiltered,
    filteredBooks,
    filterText,
    searching,
    goToRefs,
    verseSearch.active,
    verseRows,
    t,
  ]);

  // Get selected book's chapter count
  const selectedBook = allBooks.find((book) => book.id === selectedBookId);
  const chapterCount = selectedBook?.chapterCount ?? 0;

  // Handle tab switch (Testament or Topics)
  const handleTabChange = useCallback((tab: TabType) => {
    setSelectedTab(tab);
    if (tab === 'TOPICS') {
      setTopicFilterText('');
    } else if (tab === 'JESUS') {
      // Jesus shares the book filter box (its placeholder changes), so the text
      // is cleared like a testament switch — but it is not a testament, and
      // `selectedTestament` must keep whichever one the reader was last on.
      setFilterText('');
      setSelectedBookId(null);
      setSelectedSection(null);
    } else {
      setSelectedTestament(tab);
      setFilterText('');
      setSelectedBookId(null);
      setSelectedSection(null);
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
  const lastExpandedBookRef = useRef<{
    bookId: number;
    section: 'RECENTS' | 'ALL_BOOKS';
    previousBookId: number | null;
    previousSection: 'RECENTS' | 'ALL_BOOKS' | null;
  } | null>(null);

  // Handle book selection
  const handleBookSelect = useCallback(
    (book: BookMetadata, section: 'RECENTS' | 'ALL_BOOKS' = 'ALL_BOOKS') => {
      const isExpanding = selectedBookId !== book.id || selectedSection !== section;
      const previouslySelectedBookId = selectedBookId;

      if (selectedBookId === book.id && selectedSection === section) {
        setSelectedBookId(null);
        setSelectedSection(null);
      } else {
        setSelectedBookId(book.id);
        setSelectedSection(section);
      }
      Keyboard.dismiss();
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      // Store book info for scroll effect to process
      if (isExpanding) {
        lastExpandedBookRef.current = {
          bookId: book.id,
          section,
          previousBookId: previouslySelectedBookId,
          previousSection: selectedSection,
        };
      }
    },
    [selectedBookId, selectedSection]
  );

  // Auto-scroll effect - triggers when a book is expanded
  // biome-ignore lint/correctness/useExhaustiveDependencies: selectedBookId and selectedSection intentionally trigger scroll on expand
  useEffect(() => {
    if (!lastExpandedBookRef.current) return;

    const { bookId, section } = lastExpandedBookRef.current;
    const sectionIndex = bookSections.findIndex((s) => s.section === section);
    if (sectionIndex === -1) return;
    const itemIndex = bookSections[sectionIndex].data.findIndex(
      (b) => !isSearchRow(b) && b.id === bookId
    );
    if (itemIndex === -1) return;

    const scrollTimeout = setTimeout(() => {
      sectionListRef.current?.scrollToLocation({
        sectionIndex,
        itemIndex,
        animated: true,
        viewOffset: 0,
      });
      lastExpandedBookRef.current = null;
    }, 200);

    return () => clearTimeout(scrollTimeout);
  }, [selectedBookId, selectedSection, bookSections]);

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

  // ─── Search: picking a verse or a reference ───────────────────────────────
  const openVerse = useCallback(
    (bookId: number, chapter: number, verse: number, endVerse?: number, mark = false) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      if (onSelectVerse) {
        onSelectVerse(bookId, chapter, verse, endVerse, { mark });
      } else {
        router.push(
          `/bible/${bookId}/${chapter}?verse=${verse}${endVerse ? `&endVerse=${endVerse}` : ''}${mark ? '&mark=1' : ''}`
        );
      }
      handleClose();
    },
    [onSelectVerse, handleClose]
  );

  const handleVerseSelect = useCallback(
    (result: VerseSearchResult, index: number) => {
      analytics.track(AnalyticsEvent.BIBLE_SEARCH_RESULT_CLICK, {
        match: result.match,
        position: index,
      });
      // Every result lands on its verse and marks it yellow until the reader leaves the chapter,
      // the same as a typed reference, rather than opening Verse Insight (Andy, #399).
      openVerse(result.bookId, result.chapter, result.verse, undefined, true);
    },
    [openVerse]
  );

  const handleGoTo = useCallback(
    (ref: BibleReference) => {
      if (ref.chapter === undefined) return;
      analytics.track(AnalyticsEvent.BIBLE_SEARCH_GO_TO, {
        kind: ref.verseStart !== undefined ? 'verse' : 'chapter',
      });
      if (ref.verseStart !== undefined) {
        // A typed reference is a place to go: the verse is marked, no Verse Insight (web #324).
        // A range into the next chapter only marks its first verse.
        openVerse(
          ref.bookId,
          ref.chapter,
          ref.verseStart,
          ref.chapterEnd === undefined ? ref.verseEnd : undefined,
          true
        );
        return;
      }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      onSelectChapter(ref.bookId, ref.chapter);
      handleClose();
    },
    [openVerse, onSelectChapter, handleClose]
  );

  // The keyboard's Search key: a typed reference jumps; otherwise the
  // keyboard just goes away so the results can be read.
  const handleSubmitSearch = useCallback(() => {
    if (searching && goToRefs.length > 0) handleGoTo(goToRefs[0]);
  }, [searching, goToRefs, handleGoTo]);

  const exitSearchMode = useCallback(() => {
    setSearchMode(false);
    if (selectedTab === 'TOPICS') setTopicFilterText('');
    else setFilterText('');
    Keyboard.dismiss();
  }, [selectedTab]);

  // Counts only, never the search text (the same events as web).
  const searchTotals = verseSearch.totals;
  const searchSource = verseSearch.source;
  const { testament: filterTestament, book: filterBook } = verseSearch.filters;
  // biome-ignore lint/correctness/useExhaustiveDependencies: one event per new result set, keyed on its totals
  useEffect(() => {
    if (!searchTotals || filterTestament || filterBook) return;
    const total = searchTotals.exact + searchTotals.words;
    analytics.track(
      total === 0 ? AnalyticsEvent.BIBLE_SEARCH_NO_RESULTS : AnalyticsEvent.BIBLE_SEARCH,
      {
        version: bibleVersion,
        word_count: filterText.trim().split(/\s+/).length,
        exact_count: searchTotals.exact,
        words_count: searchTotals.words,
        source: searchSource,
      }
    );
  }, [searchTotals]);

  // New text or a new filter is a new list: start it at the top.
  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll on text / filter change only
  useEffect(() => {
    if (!searching) return;
    sectionListRef.current?.getScrollResponder()?.scrollTo({ y: 0, animated: false });
  }, [filterText, filterTestament, filterBook]);

  // The sheet hangs from the top and the keyboard rises from the bottom, so
  // the end of the list can sit behind the keyboard. Pad the list by the part
  // the keyboard covers so its last rows still scroll above it. Measured on
  // screen, so a platform that already resized the window gets no padding.
  const listAreaRef = useRef<View>(null);
  const [keyboardOverlap, setKeyboardOverlap] = useState(0);
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvent, (e) => {
      const keyboardTop = e.endCoordinates.screenY;
      listAreaRef.current?.measureInWindow((_x, y, _width, height) => {
        setKeyboardOverlap(Math.max(0, Math.round(y + height - keyboardTop)));
      });
    });
    const hide = Keyboard.addListener(hideEvent, () => setKeyboardOverlap(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

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

  // The title and tabs fold up (to their measured height × (1 − progress)),
  // taking the gap below them along, and the back arrow grows in beside the
  // search field as the room frees up.
  const chromeFoldStyle = useAnimatedStyle(() => {
    if (chromeHeight <= 0) return {};
    return {
      height: chromeHeight * (1 - foldProgress.value),
      opacity: 1 - foldProgress.value,
      marginBottom: -spacing.lg * foldProgress.value,
    };
  }, [chromeHeight]);
  const backArrowStyle = useAnimatedStyle(() => ({
    width: 36 * foldProgress.value,
    marginRight: spacing.xs * foldProgress.value,
    opacity: foldProgress.value,
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
          >
            {otLabel}
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
          >
            {ntLabel}
          </Text>
        </Pressable>

        <Pressable
          onPress={() => handleTabChange('JESUS')}
          style={styles.testamentTab}
          accessibilityRole="tab"
          accessibilityState={{ selected: selectedTab === 'JESUS' }}
          testID="tab-jesus"
        >
          <Text
            style={[
              styles.testamentTabText,
              selectedTab === 'JESUS' && styles.testamentTabTextActive,
            ]}
            numberOfLines={1}
          >
            {t('navigation.jesus', 'Jesus')}
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
          >
            {t('navigation.topics', 'Topics')}
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
    // The Jesus tab searches His words and actions, not the book list, and says
    // so — the same placeholder web uses. Leaving "Filter books..." there makes
    // the box look like it filters the rows below it, which it does not.
    const placeholder =
      selectedTab === 'JESUS'
        ? t('navigation.searchJesus', 'Search His words and actions...')
        : isTopicsMode
          ? t('navigation.filterTopics', 'Filter topics...')
          : t('navigation.searchBible', 'Search verses, or go to John 3:16');
    const onChangeText = isTopicsMode ? setTopicFilterText : setFilterText;

    return (
      <View style={[styles.filterContainer, styles.filterRow]}>
        {/* In search mode the arrow grows in here and leads back. */}
        <Animated.View
          style={[styles.searchBackContainer, backArrowStyle]}
          pointerEvents={searchMode ? 'auto' : 'none'}
        >
          <Pressable
            onPress={exitSearchMode}
            style={styles.searchBackButton}
            accessibilityRole="button"
            accessibilityLabel={t('search.back', 'Back to browsing')}
            accessibilityElementsHidden={!searchMode}
            importantForAccessibility={searchMode ? 'auto' : 'no-hide-descendants'}
            hitSlop={8}
            testID="search-mode-back"
          >
            <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
          </Pressable>
        </Animated.View>
        <View style={[styles.filterInputWrapper, styles.filterInputFlex]}>
          <Ionicons name="search" size={18} color={colors.textTertiary} />
          <TextInput
            style={styles.filterInput}
            placeholder={placeholder}
            placeholderTextColor={colors.textTertiary}
            value={currentFilterText}
            onChangeText={onChangeText}
            onFocus={() => setSearchMode(true)}
            onSubmitEditing={handleSubmitSearch}
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
            accessibilityLabel={placeholder}
            testID={isTopicsMode ? 'topics-search-input' : 'books-search-input'}
          />
        </View>
      </View>
    );
  };

  // Render book list item
  const renderBookItem = (
    book: BookMetadata,
    isRecent: boolean,
    section: 'RECENTS' | 'ALL_BOOKS'
  ) => {
    const isSelected = book.id === selectedBookId && selectedSection === section;
    const isCurrent = book.id === currentBookId;
    const isHighlighted = isSelected || isCurrent;

    return (
      <Pressable
        key={book.id}
        onPress={() => handleBookSelect(book, section)}
        style={styles.bookItem}
        accessibilityRole="button"
        accessibilityLabel={`${book.name}, ${book.chapterCount} chapters`}
        accessibilityState={{ selected: isSelected }}
        testID={`book-item-${book.name.toLowerCase().replace(/\s+/g, '-')}`}
      >
        <Text style={[styles.bookItemText, isHighlighted && styles.bookItemTextSelected]}>
          {book.name}
        </Text>
        <View style={styles.bookItemRight}>
          {isRecent ? (
            <Ionicons name="time-outline" size={20} color={colors.textTertiary} />
          ) : (
            <Ionicons
              name="chevron-forward"
              size={20}
              color={isHighlighted ? colors.gold : colors.textTertiary}
            />
          )}
        </View>
      </Pressable>
    );
  };

  /** The verse text with the matched words in bold. */
  const renderHighlighted = (text: string, ranges: [number, number][]) => {
    if (ranges.length === 0) return text;
    const parts: ReactNode[] = [];
    let at = 0;
    for (const [start, end] of ranges) {
      if (start < at || end > text.length) continue;
      if (start > at) parts.push(<Fragment key={`t${at}`}>{text.slice(at, start)}</Fragment>);
      parts.push(
        <Text key={`m${start}`} style={styles.verseMatch}>
          {text.slice(start, end)}
        </Text>
      );
      at = end;
    }
    if (at < text.length) parts.push(<Fragment key="tail">{text.slice(at)}</Fragment>);
    return parts;
  };

  const renderSearchRow = (row: SearchRow) => {
    switch (row.kind) {
      case 'goto':
        return (
          <Pressable
            onPress={() => handleGoTo(row.ref)}
            style={styles.bookItem}
            accessibilityRole="button"
            accessibilityLabel={`${t('search.goTo', 'Go to')} ${row.ref.display}`}
            testID={row._listKey}
          >
            <View style={styles.goToContent}>
              <Ionicons name="return-down-forward" size={20} color={colors.gold} />
              <Text style={styles.bookItemText}>
                {t('search.goTo', 'Go to')}{' '}
                <Text style={styles.goToReference}>{row.ref.display}</Text>
              </Text>
            </View>
          </Pressable>
        );
      case 'verse': {
        const r = row.result;
        return (
          <View>
            {row.groupLabel && <Text style={styles.verseGroupLabel}>{row.groupLabel}</Text>}
            <Pressable
              onPress={() => handleVerseSelect(r, row.index)}
              style={styles.verseRow}
              accessibilityRole="button"
              accessibilityLabel={`${r.bookName} ${r.chapter}:${r.verse}. ${r.text}`}
              testID={`verse-result-${r.bookId}-${r.chapter}-${r.verse}`}
            >
              <Text style={styles.verseReference}>{`${r.bookName} ${r.chapter}:${r.verse}`}</Text>
              <Text style={styles.verseText}>{renderHighlighted(r.text, r.highlights)}</Text>
            </Pressable>
          </View>
        );
      }
      case 'status':
        return (
          <Text
            style={styles.searchStatus}
            accessibilityLiveRegion="polite"
            testID="verse-search-status"
          >
            {row.text}
          </Text>
        );
      case 'more':
        return (
          <Pressable
            onPress={verseSearch.loadMore}
            disabled={verseSearch.isLoadingMore}
            style={styles.loadMoreButton}
            accessibilityRole="button"
            testID="verse-search-load-more"
          >
            <Text style={styles.loadMoreText}>
              {verseSearch.isLoadingMore
                ? t('search.loading', 'Loading…')
                : t('search.loadMore', 'Load more')}
            </Text>
          </Pressable>
        );
    }
  };

  /** The pinned "Verses" header: count, and testament / book filter chips. */
  const renderVersesHeader = (title: string) => {
    const { totals, books, filters, setFilters, source } = verseSearch;
    const total = totals ? totals.exact + totals.words : 0;
    const otCount = (books ?? [])
      .filter((b) => b.testament === 'OT')
      .reduce((n, b) => n + b.count, 0);
    const ntCount = (books ?? [])
      .filter((b) => b.testament === 'NT')
      .reduce((n, b) => n + b.count, 0);
    const bookChips = (books ?? []).filter(
      (b) => !filters.testament || b.testament === filters.testament
    );
    const chip = (
      label: string,
      count: number,
      selected: boolean,
      onPress: () => void,
      testID: string
    ) => (
      <Pressable
        key={testID}
        onPress={onPress}
        style={[styles.chip, selected && styles.chipSelected]}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        testID={testID}
      >
        <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
          {label} <Text style={selected ? styles.chipTextSelected : styles.chipCount}>{count}</Text>
        </Text>
      </Pressable>
    );
    return (
      <View style={styles.versesHeader} testID="verse-search-header">
        <View style={styles.versesHeaderRow}>
          <Text style={styles.sectionHeaderText}>{title}</Text>
          {total > 0 && (
            <Text style={styles.versesCount}>
              {t('search.verseCount', '{{count}} verses', { count: total })}
            </Text>
          )}
        </View>
        {scope ? (
          <Text style={styles.scopeText} testID="verse-search-scope">
            {t('search.inBook', 'Searching “{{query}}” in {{book}}', {
              query: searchedText.trim(),
              book: scope.bookName,
            })}
            {' · '}
            <Text
              style={styles.scopeLink}
              onPress={() => setUnscopedQuery(filterText.trim())}
              accessibilityRole="button"
              testID="verse-search-scope-all"
            >
              {t('search.allBooks', 'Search all books')}
            </Text>
          </Text>
        ) : null}
        {total > 0 && !scope && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="always"
            contentContainerStyle={styles.chipsRow}
          >
            {chip(
              t('search.all', 'All'),
              total,
              !filters.testament && !filters.book,
              () => setFilters({}),
              'verse-filter-all'
            )}
            {otCount > 0 &&
              chip(
                t('search.oldTestament', 'Old Testament'),
                otCount,
                filters.testament === 'OT' && !filters.book,
                () => setFilters({ testament: 'OT' }),
                'verse-filter-ot'
              )}
            {ntCount > 0 &&
              chip(
                t('search.newTestament', 'New Testament'),
                ntCount,
                filters.testament === 'NT' && !filters.book,
                () => setFilters({ testament: 'NT' }),
                'verse-filter-nt'
              )}
            {bookChips.length > 1 &&
              bookChips.map((b) =>
                chip(
                  b.name,
                  b.count,
                  filters.book === b.bookId,
                  () =>
                    setFilters(
                      filters.book === b.bookId
                        ? { testament: filters.testament }
                        : { testament: filters.testament, book: b.bookId }
                    ),
                  `verse-filter-book-${b.bookId}`
                )
              )}
          </ScrollView>
        )}
        {source === 'offline' && total > 0 && (
          <Text style={styles.offlineNote}>
            {t(
              'search.offlineNote',
              'Offline: exact words in the verses on this device, in Bible order.'
            )}
          </Text>
        )}
      </View>
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

    return (
      <GestureDetector gesture={scrollGesture}>
        <SectionList<ListRow, BookListSection>
          ref={sectionListRef}
          sections={bookSections}
          style={styles.bookList}
          contentContainerStyle={[
            styles.bookListContent,
            keyboardOverlap > 0 && { paddingBottom: keyboardOverlap + spacing.xxl },
          ]}
          keyboardShouldPersistTaps="always"
          // Dragging the results puts the keyboard away, as in native search screens.
          keyboardDismissMode="on-drag"
          keyExtractor={(item) => item._listKey}
          renderSectionHeader={({ section }) => {
            if (!section.title) return null;
            if (section.section === 'VERSES') return renderVersesHeader(section.title);
            return (
              <Animated.View layout={Layout.duration(300)} style={styles.sectionHeader}>
                <Text style={styles.sectionHeaderText}>{section.title}</Text>
              </Animated.View>
            );
          }}
          renderItem={({ item, section }) => {
            if (isSearchRow(item)) return renderSearchRow(item);
            const book = item;
            const sectionType = section.section === 'RECENTS' ? 'RECENTS' : 'ALL_BOOKS';
            const isRecent = sectionType === 'RECENTS';
            const isSelected = book.id === selectedBookId && selectedSection === sectionType;
            return (
              <Animated.View layout={Layout.duration(300)}>
                {renderBookItem(book, isRecent, sectionType)}
                {isSelected && renderChapterGrid()}
              </Animated.View>
            );
          }}
          // While searching, the Verses header (count + filters) stays pinned.
          stickySectionHeadersEnabled={searching}
          onScrollToIndexFailed={() => {}}
        />
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
        <FlatList
          data={filteredTopics}
          style={styles.bookList}
          contentContainerStyle={[
            styles.bookListContent,
            keyboardOverlap > 0 && { paddingBottom: keyboardOverlap + spacing.xxl },
          ]}
          keyboardShouldPersistTaps="always"
          keyboardDismissMode="on-drag"
          keyExtractor={(item) => item.topic_id.toString()}
          renderItem={({ item: topic }) => (
            <Pressable
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
          )}
        />
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
          <Animated.View style={styles.backdropTouchable} testID="close-modal-button" />
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

          {/* Title and tabs: fold away in search mode */}
          <Animated.View
            style={[styles.chromeFold, chromeFoldStyle]}
            pointerEvents={searchMode ? 'none' : 'auto'}
            accessibilityElementsHidden={searchMode}
            importantForAccessibility={searchMode ? 'no-hide-descendants' : 'auto'}
            testID="search-chrome"
          >
            <View
              style={styles.chromeInner}
              onLayout={(event) => {
                const height = event.nativeEvent.layout.height;
                if (height > 0 && Math.abs(height - chromeHeight) > 0.5) setChromeHeight(height);
              }}
            >
              {/* Title */}
              {renderTitle()}

              {/* Main tabs (OT, NT, Topics) */}
              {renderMainTabs()}

              {/* Topic category tabs (only when Topics tab is active) */}
              {selectedTab === 'TOPICS' && renderTopicCategoryTabs()}
            </View>
          </Animated.View>

          {/* Filter input */}
          {renderFilterInput()}

          {/* Content area */}
          <View ref={listAreaRef} style={styles.contentArea} collapsable={false}>
            {selectedTab === 'JESUS' ? (
              <JesusNavTab query={filterText} onNavigate={handleClose} />
            ) : selectedTab === 'TOPICS' ? (
              renderTopicsList()
            ) : (
              renderBookList()
            )}
          </View>

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
    filterRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    filterInputFlex: {
      flex: 1,
    },
    searchBackContainer: {
      overflow: 'hidden',
      height: 36,
      justifyContent: 'center',
    },
    searchBackButton: {
      width: 36,
      height: 36,
      alignItems: 'center',
      justifyContent: 'center',
    },
    chromeFold: {
      overflow: 'hidden',
    },
    chromeInner: {
      gap: spacing.lg,
    },
    contentArea: {
      flex: 1,
    },
    goToContent: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    goToReference: {
      fontWeight: fontWeights.semibold,
    },
    versesHeader: {
      backgroundColor: modalSpecs.backgroundColor,
      paddingTop: spacing.md,
      paddingBottom: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      gap: spacing.sm,
    },
    versesHeaderRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
    },
    versesCount: {
      fontSize: 13,
      color: colors.textTertiary,
    },
    chipsRow: {
      paddingHorizontal: spacing.lg,
      gap: spacing.sm,
    },
    chip: {
      height: 32,
      paddingHorizontal: spacing.md,
      borderRadius: 100,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    chipSelected: {
      backgroundColor: colors.gold,
      borderColor: colors.gold,
    },
    chipText: {
      fontSize: 13,
      color: colors.textPrimary,
    },
    chipTextSelected: {
      color: colors.black,
    },
    chipCount: {
      color: colors.textTertiary,
    },
    offlineNote: {
      fontSize: 12,
      color: colors.textTertiary,
      paddingHorizontal: spacing.lg,
    },
    scopeText: {
      fontSize: 13,
      color: colors.textSecondary,
      paddingHorizontal: spacing.lg,
    },
    scopeLink: {
      color: colors.gold,
      fontWeight: '600',
    },
    verseGroupLabel: {
      fontSize: 12,
      color: colors.textTertiary,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      paddingBottom: spacing.xs,
    },
    verseRow: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      gap: spacing.xs,
    },
    verseReference: {
      fontSize: 13,
      fontWeight: fontWeights.medium,
      color: colors.gold,
    },
    verseText: {
      fontSize: fontSizes.body,
      lineHeight: fontSizes.body * lineHeights.body,
      color: colors.textSecondary,
    },
    verseMatch: {
      fontWeight: fontWeights.semibold,
      color: colors.textPrimary,
    },
    searchStatus: {
      fontSize: fontSizes.body,
      color: colors.textSecondary,
      textAlign: 'center',
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.xl,
    },
    loadMoreButton: {
      paddingVertical: spacing.lg,
      alignItems: 'center',
    },
    loadMoreText: {
      fontSize: fontSizes.body,
      color: colors.gold,
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
      backgroundColor: modalSpecs.backgroundColor,
    },
    sectionHeader: {
      minHeight: 48,
      paddingLeft: spacing.lg,
      paddingRight: spacing.sm,
      paddingVertical: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: modalSpecs.backgroundColor,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sectionHeaderText: {
      fontSize: 13,
      fontWeight: fontWeights.medium,
      color: colors.textTertiary,
      textAlign: 'center',
    },
    bookItemText: {
      fontSize: fontSizes.body,
      fontWeight: fontWeights.regular,
      color: colors.textPrimary,
      lineHeight: fontSizes.body * lineHeights.ui,
    },
    bookItemTextSelected: {
      color: colors.gold,
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
