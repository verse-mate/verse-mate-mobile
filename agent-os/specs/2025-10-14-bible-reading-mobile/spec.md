# Specification: Bible Reading Mobile Interface

## Goal

Create a mobile-first Bible reading interface that provides intuitive navigation between books and chapters, multiple reading modes (Summary, By Line, Detailed), persistent reading progress tracking, and offline capability. The interface builds upon a completed API integration layer and follows iOS-style design patterns with comprehensive accessibility support.

## User Stories

### Navigation
- As a reader, I want to quickly navigate to any Bible book and chapter through an intuitive bottom sheet modal, so I can find passages efficiently
- As a reader, I want to see my recently viewed books at the top of the book list, so I can quickly return to books I'm studying
- As a reader, I want to filter books by name, so I can find specific books without scrolling
- As a reader, I want to use swipe gestures or floating buttons to navigate between chapters, so I have flexible navigation options

### Reading Modes
- As a reader, I want to switch between Summary, By Line, and Detailed explanations, so I can choose the depth of analysis that fits my needs
- As a reader, I want my active tab preference to persist across chapter navigation, so I don't have to reselect my preferred reading mode

### Progress Tracking
- As a reader, I want to see my progress through the current book as a percentage, so I understand how far I've read
- As a reader, I want the app to remember where I left off, so I can resume reading immediately on next launch

### Offline & Accessibility
- As a reader, I want to read cached chapters offline, so I can study even without internet connection
- As a reader, I want the app to respect my device's font size settings, so the text is readable for my needs
- As a screen reader user, I want all content and navigation to be accessible, so I can use the app independently

## Core Requirements

### Functional Requirements

#### 1. Navigation System
- iOS-style bottom sheet modal (~75-80% screen height)
- Two testament tabs: Old Testament and New Testament
- Scrollable book list with up to 5 recent books shown at top (clock icon indicator)
- Real-time filter/search for books (case-insensitive)
- 5-column chapter grid for selected book
- Current chapter highlighted with gold background
- Breadcrumb showing: "[Testament], [Book], [Chapter]"
- Swipe-to-dismiss gesture support

#### 2. Chapter Reading Interface
- Fixed header with book/chapter title and three action icons
- Content tabs: Summary, By Line, Detailed (pill-style)
- Chapter content with sections, subtitles, and verse numbers
- Floating prev/next chapter buttons (circular, gold background)
- Swipe gestures for chapter navigation (left=next, right=previous)
- Progress bar at bottom showing book completion percentage
- Markdown rendering for explanation content

#### 3. Hamburger Menu (Placeholder)
- Slide-in menu from right side
- Five menu items with icons: Bookmarks, Favorites, Notes, Highlights, Settings
- Each item shows "This feature is coming soon!" alert when tapped
- Close via backdrop tap or X button

#### 4. Deep Linking
- URL pattern: `/bible/[bookId]/[chapter]`
- Navigate directly to chapters from external links
- Invalid links redirect to last read or Genesis 1
- Does not encode active tab (persists from last session)

#### 5. Reading Position Persistence
- Save position immediately on chapter load (book + chapter only)
- Background API call to `POST /bible/book/chapter/save-last-read`
- Fetch last read position on app launch
- Default to Genesis 1 if no position found
- Track 5 recent books locally (AsyncStorage, 30-day expiry)

#### 6. Book Progress Tracking
- Calculate: current chapter / total chapters = percentage
- Display in bottom progress bar with percentage text
- Animate fill width on chapter change (200ms)
- No historical tracking (calculate on-the-fly)

#### 7. Offline Behavior
- Cache last viewed chapter automatically (24-hour retention)
- Cache testaments/books list (7-day retention)
- Show subtle offline indicator in header (cloud icon with slash)
- Toast message when attempting to navigate to uncached chapter
- Allow reading cached content and switching cached tabs

#### 8. Loading States
- Skeleton loaders with shimmer animation for content
- Spinner loader for navigation modal
- Progressive loading: chapter first, then active tab, then prefetch
- Smooth crossfade transitions (200ms)

### Non-Functional Requirements

#### Performance
- Initial app load: < 3 seconds
- Chapter navigation: < 1 second (cached), < 3 seconds (network)
- Tab switching: < 500ms
- Modal animations: < 400ms
- Gesture response: < 100ms
- 60fps throughout all animations
- Prefetch next/previous chapters in background

#### Accessibility
- WCAG AA minimum compliance (AAA for body text)
- Screen reader support (VoiceOver, TalkBack)
- Proper heading hierarchy (h1, h2, h3)
- ARIA labels for icon-only buttons
- Dynamic type support (1.0x to 2.5x scale)
- Color contrast: Black on white (21:1), Gold on white (4.52:1)
- Haptic feedback: Light on taps, medium on navigation, error on boundaries
- Keyboard navigation (web only)

#### Security
- HTTPS for all API calls
- Sanitize markdown rendering (prevent XSS)
- Validate bookId/chapter parameters
- Handle malformed API responses gracefully
- No personal data collection (reading position stored locally)

#### Error Handling
- Network errors: Show toast with retry button, 3 automatic retries with exponential backoff
- 404 errors: Redirect to Genesis 1 with toast notification
- 500 errors: Show error state with manual retry
- Invalid navigation: Cap at min/max values, redirect to valid chapter
- Graceful degradation: Hide failed tabs, show working ones

## Visual Design

### Design Assets Reference
Visual mockups located at: `planning/visuals/`

**Key Screenshots:**
- `Screenshot 2025-10-14 at 14.39.08.png` - Main reading view
- `Screenshot 2025-10-14 at 14.39.22.png` - Navigation modal (OT)
- `Screenshot 2025-10-14 at 14.39.30.png` - Content tabs (Summary)
- `Screenshot 2025-10-14 at 14.40.00.png` - Hamburger menu
- `Screenshot 2025-10-14 at 14.45.29.png` - Chapter grid view

### Color System
```typescript
const colors = {
  // Brand/Accent
  gold: '#b09a6d',           // Primary actions, active states
  goldLight: '#c4b088',      // Hover states
  goldDark: '#9d8759',       // Pressed states

  // Neutrals
  black: '#000000',          // Header background, primary text
  white: '#ffffff',          // Content background
  gray900: '#1a1a1a',        // Dark text
  gray700: '#4a4a4a',        // Inactive tabs, secondary elements
  gray500: '#666666',        // Tertiary text
  gray300: '#999999',        // Disabled text
  gray200: '#cccccc',        // Borders
  gray100: '#e0e0e0',        // Skeleton, progress track
  gray50: '#f5f5f5',         // Input backgrounds, quote blocks

  // Semantic
  success: '#4caf50',
  error: '#f44336',
  warning: '#ff9800',
  info: '#2196f3',

  // Overlay
  backdrop: 'rgba(0, 0, 0, 0.5)',
  shadow: 'rgba(0, 0, 0, 0.15)',
};
```

### Typography System
```typescript
const typography = {
  // Font Sizes (base = 16px)
  displayLarge: 36,    // Page headings
  displayMedium: 32,   // Chapter titles
  heading1: 24,        // Section headings
  heading2: 20,        // Subsection headings
  heading3: 18,        // Tertiary headings
  bodyLarge: 18,       // Main reading text
  body: 16,            // Standard UI text
  bodySmall: 14,       // Secondary UI text
  caption: 12,         // Verse numbers, labels
  overline: 10,        // Progress text

  // Font Weights
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',

  // Line Heights
  displayHeight: 1.2,
  headingHeight: 1.3,
  bodyHeight: 1.6,
  uiHeight: 1.4,

  // Letter Spacing
  displaySpacing: -0.5,
  headingSpacing: 0,
  bodySpacing: 0,
  uiSpacing: 0.25,
  captionSpacing: 0.5,
};
```

**Dynamic Type Support:**
Use React Native's default font scaling. Test at accessibility sizes: xSmall (14px), Small (15px), Medium (16px), Large (18px), xLarge (20px), xxLarge (23px), xxxLarge (26px).

### Spacing System
```typescript
const spacing = {
  xs: 4,      // Minimal spacing
  sm: 8,      // Small spacing
  md: 12,     // Medium spacing
  lg: 16,     // Standard spacing
  xl: 20,     // Large spacing
  xxl: 24,    // Extra large spacing
  xxxl: 32,   // Section spacing
  huge: 48,   // Major section spacing
};
```

**Usage:**
- Screen padding: `lg` (16px) horizontal
- Section spacing: `xxxl` (32px) vertical
- Component spacing: `md` (12px)
- List item padding: `lg` (16px) vertical, `xl` (20px) horizontal

### Component UI Elements

#### Header
```typescript
{
  height: 56,
  backgroundColor: colors.black,
  title: { fontSize: 17, fontWeight: '500', color: colors.white },
  iconSize: 24,
  padding: spacing.lg,
}
```

#### Bottom Sheet Modal
```typescript
{
  height: '80%',
  borderTopLeftRadius: 16,
  borderTopRightRadius: 16,
  backgroundColor: colors.white,
  backdrop: colors.backdrop,
  handleWidth: 40,
  handleHeight: 4,
}
```

#### Content Tabs (Pills)
```typescript
{
  active: {
    backgroundColor: colors.gold,
    textColor: colors.gray900,
  },
  inactive: {
    backgroundColor: colors.gray700,
    textColor: colors.white,
  },
  borderRadius: 20,
  paddingVertical: spacing.sm,
  paddingHorizontal: spacing.xl,
}
```

#### Floating Action Buttons
```typescript
{
  size: 56,
  borderRadius: 28,
  backgroundColor: colors.gold,
  iconColor: colors.white,
  iconSize: 24,
  bottomOffset: 60, // Above progress bar
  shadowOpacity: 0.3,
  shadowRadius: 8,
}
```

#### Progress Bar
```typescript
{
  height: 6,
  position: 'absolute',
  bottom: 0,
  backgroundColor: colors.gray100,
  fillColor: colors.gold,
  percentageSize: 10,
  percentageColor: colors.gold,
}
```

#### Skeleton Loader
```typescript
{
  backgroundColor: colors.gray100,
  shimmerColor: colors.white,
  borderRadius: 4,
  animationDuration: 1500, // 1.5s loop
  titleHeight: 32,
  subtitleHeight: 20,
  paragraphHeight: 16,
}
```

### Animation Specifications
```typescript
const animations = {
  // Duration (ms)
  fast: 150,
  normal: 300,
  slow: 500,

  // Spring configuration
  spring: {
    damping: 15,
    stiffness: 150,
  },
};
```

**Key Animations:**
- Modal open/close: Spring animation (300-400ms)
- Tab switch: Crossfade (200ms)
- Page transition: Slide + fade (300ms)
- Skeleton shimmer: Continuous pulse (1.5s loop)
- Progress bar: Ease-in-out (200ms)

## Reusable Components

### Existing Code to Leverage

**API Integration Layer:**
Location: `/Users/augustochaves/Work/verse-mate/verse-mate-mobile/src/api/bible/`

Available React Query hooks:
- `useBibleTestaments()` - Get all 66 books with metadata (lightweight)
- `useBibleChapter(bookId, chapterNumber, versionKey)` - Get chapter with verses
- `useBibleExplanation(bookId, chapterNumber, type, versionKey)` - Get explanations
- `useBibleSummary()` - Convenience hook for Summary tab
- `useBibleByLine()` - Convenience hook for By Line tab
- `useBibleDetailed()` - Convenience hook for Detailed tab
- `useSaveLastRead()` - Mutation for saving reading position
- `useLastRead(userId)` - Query for fetching last read position
- `usePrefetchNextChapter()` - Prefetch helper for performance
- `usePrefetchPreviousChapter()` - Prefetch helper for performance

**Existing UI Components:**
- `components/haptic-tab.tsx` - Haptic feedback wrapper (can be used as pattern for buttons)
- `components/Button.tsx` - Base button component
- `components/themed-text.tsx` - Themed text component
- `components/themed-view.tsx` - Themed view component

**Existing Patterns:**
- Expo Haptics: `expo-haptics` already installed and used in `HapticTab`
- React Navigation: Bottom tabs already configured in `app/(tabs)/`
- File-based routing: Expo Router patterns in `app/` directory

### New Components Required

**Why New Components:**
The existing components are basic primitives (Button, Text, View). This spec requires specialized, domain-specific components:

1. **BibleNavigationModal** - Complex bottom sheet with testament tabs, book list, chapter grid (no existing modal component)
2. **ChapterContentTabs** - Pill-style tabs with persistence logic (different from bottom tabs)
3. **ChapterReader** - Chapter content renderer with sections, verses, markdown (domain-specific)
4. **ProgressBar** - Book completion progress indicator (no existing progress component)
5. **SkeletonLoader** - Content loading skeletons with shimmer (no existing skeleton component)
6. **FloatingActionButtons** - Chapter navigation FABs (no existing FAB component)
7. **HamburgerMenu** - Slide-in menu drawer (no existing drawer component)
8. **OfflineIndicator** - Network status badge (no existing indicator)

## Technical Approach

### File Structure
```
app/
  bible/
    [bookId]/
      [chapterNumber].tsx    # Chapter reading screen
  _layout.tsx                # Root layout

components/
  bible/
    BibleNavigationModal.tsx # Bottom sheet with book/chapter selection
    ChapterContentTabs.tsx   # Summary/By Line/Detailed tabs
    ChapterReader.tsx        # Chapter content renderer
    FloatingActionButtons.tsx # Prev/next chapter buttons
    ProgressBar.tsx          # Book completion progress
    SkeletonLoader.tsx       # Loading skeletons
    HamburgerMenu.tsx        # Settings/features menu
    OfflineIndicator.tsx     # Network status badge

hooks/
  use-reading-position.ts    # Reading position persistence
  use-recent-books.ts        # Recent books tracking
  use-book-progress.ts       # Progress calculation
  use-offline-status.ts      # Network status detection
  use-active-tab.ts          # Tab persistence

constants/
  bible-design-tokens.ts     # Colors, typography, spacing
```

### Routing & Navigation

**Deep Linking:**
```typescript
// app/bible/[bookId]/[chapterNumber].tsx
import { useLocalSearchParams } from 'expo-router';

export default function ChapterScreen() {
  const { bookId, chapterNumber } = useLocalSearchParams();
  // Convert to numbers and validate
  const validBookId = Math.max(1, Math.min(66, Number(bookId)));
  const validChapter = Math.max(1, Number(chapterNumber));

  // Load chapter...
}
```

**Navigation Links:**
```typescript
import { router } from 'expo-router';

// Navigate to chapter
router.push(`/bible/${bookId}/${chapterNumber}`);

// Navigate with replace (no back stack)
router.replace(`/bible/${bookId}/${chapterNumber}`);
```

### State Management

**Server State (React Query):**
```typescript
// Chapter content
const { data: chapter, isLoading } = useBibleChapter(bookId, chapterNumber);

// Explanation content
const { data: summary } = useBibleSummary(bookId, chapterNumber);
const { data: byLine } = useBibleByLine(bookId, chapterNumber);
const { data: detailed } = useBibleDetailed(bookId, chapterNumber);

// Prefetch next chapter
const prefetchNext = usePrefetchNextChapter(bookId, chapterNumber, totalChapters);
useEffect(() => {
  prefetchNext();
}, [prefetchNext]);
```

**Local State (AsyncStorage):**
```typescript
// hooks/use-recent-books.ts
import AsyncStorage from '@react-native-async-storage/async-storage';

const RECENT_BOOKS_KEY = '@verse-mate/recent-books';
const MAX_RECENT = 5;
const EXPIRY_DAYS = 30;

export function useRecentBooks() {
  const [recentBooks, setRecentBooks] = useState<RecentBook[]>([]);

  const addRecentBook = useCallback(async (bookId: number) => {
    // Load current list
    const stored = await AsyncStorage.getItem(RECENT_BOOKS_KEY);
    const books = stored ? JSON.parse(stored) : [];

    // Add/update book with timestamp
    const updated = [
      { bookId, timestamp: Date.now() },
      ...books.filter(b => b.bookId !== bookId)
    ].slice(0, MAX_RECENT);

    // Filter out expired (> 30 days)
    const filtered = updated.filter(b =>
      Date.now() - b.timestamp < EXPIRY_DAYS * 24 * 60 * 60 * 1000
    );

    await AsyncStorage.setItem(RECENT_BOOKS_KEY, JSON.stringify(filtered));
    setRecentBooks(filtered);
  }, []);

  return { recentBooks, addRecentBook };
}
```

**Context for Active Tab:**
```typescript
// hooks/use-active-tab.ts
import AsyncStorage from '@react-native-async-storage/async-storage';

const ACTIVE_TAB_KEY = '@verse-mate/active-tab';

export function useActiveTab() {
  const [activeTab, setActiveTabState] = useState<ContentTabType>('summary');

  // Load persisted tab on mount
  useEffect(() => {
    AsyncStorage.getItem(ACTIVE_TAB_KEY).then(tab => {
      if (tab) setActiveTabState(tab as ContentTabType);
    });
  }, []);

  const setActiveTab = useCallback(async (tab: ContentTabType) => {
    setActiveTabState(tab);
    await AsyncStorage.setItem(ACTIVE_TAB_KEY, tab);
  }, []);

  return { activeTab, setActiveTab };
}
```

### Component Implementation Examples

#### ChapterScreen (Main Screen)
```typescript
// app/bible/[bookId]/[chapterNumber].tsx
import { StyleSheet, ScrollView, View } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useBibleChapter, useSaveLastRead } from '@/src/api/bible';
import { ChapterReader } from '@/components/bible/ChapterReader';
import { ChapterContentTabs } from '@/components/bible/ChapterContentTabs';
import { FloatingActionButtons } from '@/components/bible/FloatingActionButtons';
import { ProgressBar } from '@/components/bible/ProgressBar';
import { SkeletonLoader } from '@/components/bible/SkeletonLoader';
import { useActiveTab } from '@/hooks/use-active-tab';
import { useBookProgress } from '@/hooks/use-book-progress';

export default function ChapterScreen() {
  const params = useLocalSearchParams<{ bookId: string; chapterNumber: string }>();
  const bookId = Number(params.bookId);
  const chapterNumber = Number(params.chapterNumber);

  const { activeTab, setActiveTab } = useActiveTab();
  const { data: chapter, isLoading } = useBibleChapter(bookId, chapterNumber);
  const { mutate: saveLastRead } = useSaveLastRead();
  const progress = useBookProgress(bookId, chapterNumber, chapter?.totalChapters || 50);

  // Save reading position on mount
  useEffect(() => {
    saveLastRead({
      user_id: 'guest', // TODO: Replace with actual user ID when auth is added
      book_id: bookId,
      chapter_number: chapterNumber
    });
  }, [bookId, chapterNumber]);

  const handlePrevious = () => {
    if (chapterNumber > 1) {
      router.push(`/bible/${bookId}/${chapterNumber - 1}`);
    }
    // TODO: Handle previous book navigation
  };

  const handleNext = () => {
    if (chapterNumber < (chapter?.totalChapters || 50)) {
      router.push(`/bible/${bookId}/${chapterNumber + 1}`);
    }
    // TODO: Handle next book navigation
  };

  if (isLoading) {
    return <SkeletonLoader />;
  }

  return (
    <View style={styles.container}>
      <ChapterContentTabs
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      <ScrollView style={styles.content}>
        <ChapterReader
          chapter={chapter}
          activeTab={activeTab}
        />
      </ScrollView>

      <FloatingActionButtons
        onPrevious={handlePrevious}
        onNext={handleNext}
        showPrevious={chapterNumber > 1}
        showNext={chapterNumber < (chapter?.totalChapters || 50)}
      />

      <ProgressBar
        percentage={progress.percentage}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
});
```

#### Bottom Sheet Modal Pattern
```typescript
// components/bible/BibleNavigationModal.tsx
import { Modal, View, StyleSheet, Pressable } from 'react-native';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS
} from 'react-native-reanimated';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSelectChapter: (bookId: number, chapter: number) => void;
}

export function BibleNavigationModal({ visible, onClose, onSelectChapter }: Props) {
  const translateY = useSharedValue(0);

  const gesture = Gesture.Pan()
    .onUpdate((e) => {
      if (e.translationY > 0) {
        translateY.value = e.translationY;
      }
    })
    .onEnd((e) => {
      if (e.translationY > 100) {
        runOnJS(onClose)();
      } else {
        translateY.value = withSpring(0);
      }
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <Pressable style={styles.backdropTouchable} onPress={onClose} />

        <GestureDetector gesture={gesture}>
          <Animated.View style={[styles.container, animatedStyle]}>
            <View style={styles.handle} />

            {/* Testament tabs */}
            {/* Book list */}
            {/* Chapter grid */}

          </Animated.View>
        </GestureDetector>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  backdropTouchable: {
    flex: 1,
  },
  container: {
    height: '80%',
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: '#999999',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 16,
  },
});
```

#### Skeleton Loader with Shimmer
```typescript
// components/bible/SkeletonLoader.tsx
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useEffect } from 'react';

export function SkeletonLoader() {
  const opacity = useSharedValue(1);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.5, { duration: 750 }),
        withTiming(1, { duration: 750 })
      ),
      -1, // infinite
      false
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.title, animatedStyle]} />
      <Animated.View style={[styles.subtitle, animatedStyle]} />
      <Animated.View style={[styles.paragraph, animatedStyle]} />
      <Animated.View style={[styles.paragraph, animatedStyle]} />
      <Animated.View style={[styles.paragraphShort, animatedStyle]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
  },
  title: {
    width: '60%',
    height: 32,
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
    marginBottom: 16,
  },
  subtitle: {
    width: '40%',
    height: 20,
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
    marginBottom: 12,
  },
  paragraph: {
    width: '100%',
    height: 16,
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
    marginBottom: 8,
  },
  paragraphShort: {
    width: '80%',
    height: 16,
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
    marginBottom: 12,
  },
});
```

### Markdown Rendering

**Library:**
```bash
npm install react-native-markdown-display
```

**Implementation:**
```typescript
import Markdown from 'react-native-markdown-display';

const markdownStyles = {
  body: {
    fontSize: 16,
    lineHeight: 24,
    color: '#000000',
  },
  heading1: {
    fontSize: 24,
    fontWeight: '700',
    marginTop: 24,
    marginBottom: 12,
  },
  heading2: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 20,
    marginBottom: 10,
  },
  paragraph: {
    marginBottom: 16,
  },
  strong: {
    fontWeight: '700',
  },
  em: {
    fontStyle: 'italic',
  },
};

<Markdown style={markdownStyles}>
  {explanationContent}
</Markdown>
```

### Gesture Handling

**Swipe for Chapter Navigation:**
```typescript
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';

const swipeGesture = Gesture.Pan()
  .activeOffsetX([-30, 30]) // Threshold
  .onEnd((e) => {
    if (e.translationX < -100) {
      // Swipe left = next chapter
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      onNextChapter();
    } else if (e.translationX > 100) {
      // Swipe right = previous chapter
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      onPreviousChapter();
    }
  });

<GestureDetector gesture={swipeGesture}>
  <View>{/* Chapter content */}</View>
</GestureDetector>
```

### Offline Detection

```typescript
// hooks/use-offline-status.ts
import { useEffect, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';

export function useOfflineStatus() {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsOffline(!state.isConnected);
    });

    return () => unsubscribe();
  }, []);

  return { isOffline };
}
```

**Installation:**
```bash
npm install @react-native-community/netinfo
```

### Testing Strategy

**Unit Tests (Jest + React Native Testing Library):**
```typescript
// __tests__/components/ChapterReader.test.tsx
import { render, screen } from '@testing-library/react-native';
import { ChapterReader } from '@/components/bible/ChapterReader';

describe('ChapterReader', () => {
  it('renders chapter title', () => {
    const chapter = {
      title: 'Genesis 1',
      sections: [/* ... */],
    };

    render(<ChapterReader chapter={chapter} activeTab="summary" />);
    expect(screen.getByText('Genesis 1')).toBeTruthy();
  });

  it('renders verse numbers as superscript', () => {
    // Test verse number styling
  });
});
```

**Integration Tests:**
```typescript
// __tests__/flows/navigation.test.tsx
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { ChapterScreen } from '@/app/bible/[bookId]/[chapterNumber]';

describe('Chapter Navigation', () => {
  it('navigates to next chapter on button press', async () => {
    const { getByLabelText } = render(<ChapterScreen />);
    const nextButton = getByLabelText('Next chapter');

    fireEvent.press(nextButton);

    await waitFor(() => {
      expect(screen.getByText('Genesis 2')).toBeTruthy();
    });
  });
});
```

**E2E Tests (Maestro):**
```yaml
# .maestro/bible-reading-flow.yaml
appId: com.versemate.mobile
---
- launchApp
- assertVisible: "Genesis 1"
- tapOn: "Next chapter"
- assertVisible: "Genesis 2"
- tapOn: "Navigation"
- assertVisible: "Old Testament"
- tapOn: "Matthew"
- tapOn: "1"
- assertVisible: "Matthew 1"
```

**Accessibility Tests:**
```typescript
// __tests__/accessibility/chapter-screen.test.tsx
import { render } from '@testing-library/react-native';
import { axe, toHaveNoViolations } from 'jest-axe';

expect.extend(toHaveNoViolations);

describe('Chapter Screen Accessibility', () => {
  it('has no accessibility violations', async () => {
    const { container } = render(<ChapterScreen />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
```

## Out of Scope

### Explicitly Deferred Features
1. **Topics Tab** - Not approved yet, omit from testament tabs
2. **Notes Functionality** - Show placeholder button with "Coming Soon" alert
3. **Bookmarks Functionality** - Show placeholder button with "Coming Soon" alert
4. **Favorites Functionality** - Show placeholder button with "Coming Soon" alert
5. **Highlights Functionality** - Show placeholder button with "Coming Soon" alert
6. **Settings Functionality** - Show placeholder button with "Coming Soon" alert
7. **Share Functionality** - Add to backlog (URL sharing only)
8. **Manual Font Size Controls** - Use system font scaling only
9. **Multiple Bible Versions** - Single version (NASB) only
10. **AI Features** - Separate spec
11. **Authentication** - Separate spec, use guest mode with "guest" user ID

### Technical Debt Accepted
- No scroll position persistence (only book + chapter)
- No historical chapter tracking
- No manual offline download controls (automatic caching only)
- No analytics tracking
- Hamburger menu items are placeholders only

### Future Enhancements to Consider
- Read mode toggle (night mode, sepia mode)
- Cross-references and footnotes
- Bible study tools (concordance, dictionary)
- Social features (sharing, discussion)
- Reading plans and challenges
- Multiple Bible versions selector
- Audio Bible integration

## Success Criteria

### User Experience
- Users can navigate from app launch to desired chapter in < 5 taps
- Recent books feature reduces navigation time for frequently accessed books
- Tab persistence eliminates repetitive selections
- Offline reading works without user intervention
- All interactive elements respond within 100ms

### Performance
- Chapter loads in < 2 seconds (cached) or < 5 seconds (network)
- 60fps maintained throughout all animations and gestures
- No layout shifts during content loading
- Background prefetch improves perceived performance

### Accessibility
- 95%+ score on automated accessibility testing tools
- VoiceOver/TalkBack can access all features
- Dynamic type works at all scales (1.0x to 2.5x)
- Color contrast meets WCAG AA minimum

### Technical Quality
- 80%+ test coverage for components and hooks
- All E2E flows pass in Maestro
- Zero TypeScript errors
- Passes Biome.js and ESLint linting
- All API integration uses existing hooks (no duplicate API code)

## Implementation Notes

### Dependencies to Install
```bash
# Markdown rendering
npm install react-native-markdown-display

# Offline detection
npm install @react-native-community/netinfo

# Already installed (verify):
# - @tanstack/react-query
# - @react-native-async-storage/async-storage
# - react-native-gesture-handler
# - react-native-reanimated
# - expo-haptics
```

### Standards Compliance

**Tech Stack Alignment:**
- React Native with Expo (Expo SDK 54, React 19.1.0)
- TypeScript strict mode
- Bun for package management (use npm for tests only)
- Biome.js + ESLint for linting
- Jest + React Native Testing Library for unit tests
- Maestro for E2E tests

**Component Best Practices:**
- Single responsibility per component
- Reusable with configurable props
- Composable design (small components combined)
- Clear prop interfaces with TypeScript
- Minimal prop count
- Document usage with JSDoc comments

**Accessibility Standards:**
- Semantic component structure
- Keyboard navigation (web only)
- WCAG AA color contrast minimum
- Descriptive labels for all interactive elements
- Screen reader testing required
- ARIA attributes where needed
- Logical heading hierarchy
- Focus management in modals

**Code Quality:**
- All code properly typed (no `any`)
- Clear, descriptive naming
- Environment variables for configuration
- No secrets in code
- Feature flags for incomplete features
- Maintain changelog for significant changes

### API Integration Reference

**DO NOT duplicate API code.** Use existing hooks from `/Users/augustochaves/Work/verse-mate/verse-mate-mobile/src/api/bible/`:

```typescript
// Correct usage
import { useBibleChapter, useBibleSummary } from '@/src/api/bible';

// INCORRECT - Don't create new API calls
// const fetchChapter = async () => { ... }
```

**Important API Endpoint:**
The correct OpenAPI specification is at: `https://api.verse-mate.apegro.dev/openapi/json`

If type regeneration is needed in the future, use the above endpoint (not `/swagger/json`).

### Migration Path for Future Features

**When adding authentication:**
1. Replace "guest" user ID with actual user ID from auth context
2. Update `useSaveLastRead()` calls to use authenticated user
3. Add user-specific caching strategies

**When adding Settings:**
1. Implement settings storage with AsyncStorage
2. Add theme selection (dark mode, sepia mode)
3. Add Bible version selector
4. Add font size manual override (optional)

**When adding Notes/Bookmarks/Highlights:**
1. Remove "Coming Soon" alerts from hamburger menu
2. Implement feature-specific modals
3. Add API endpoints for data persistence
4. Update chapter reader to show indicators

### Known Limitations

**Platform Differences:**
- iOS: Native bottom sheet animations, SF Symbols
- Android: Material Design animations, Material icons
- Web: Limited gesture support, keyboard navigation required

**API Constraints:**
- NASB version only (no version selector needed)
- Explanations are pre-generated (not real-time)
- No authentication yet (guest mode only)

**Performance Considerations:**
- React Query cache limited to device memory
- Large books (Psalms) may have slower initial load
- Prefetching uses device data (consider data usage)

### Development Workflow

1. **Setup:**
   - Install dependencies
   - Verify existing API hooks work
   - Run test suite to ensure no regressions

2. **Implementation Order:**
   - Component 1: Design tokens (colors, typography, spacing)
   - Component 2: Skeleton loaders (needed for all screens)
   - Component 3: Chapter reading screen (main functionality)
   - Component 4: Chapter content tabs (reading modes)
   - Component 5: Navigation modal (complex but isolated)
   - Component 6: Floating action buttons (simple)
   - Component 7: Progress bar (simple)
   - Component 8: Hamburger menu (simple placeholders)
   - Component 9: Offline indicator (simple)
   - Hooks: Reading position, recent books, active tab persistence
   - Testing: Unit tests, integration tests, E2E flows

3. **Testing Throughout:**
   - Write tests alongside components
   - Test on both iOS and Android
   - Test with VoiceOver and TalkBack
   - Test at different accessibility font sizes
   - Test offline scenarios

4. **Code Review Checklist:**
   - TypeScript errors resolved
   - Linting passes (Biome + ESLint)
   - Tests pass (unit + integration + E2E)
   - Accessibility tested manually
   - Performance profiled (60fps maintained)
   - API integration uses existing hooks
   - No duplicate code
   - Design system followed consistently

## References

**Requirements Document:**
`/Users/augustochaves/Work/verse-mate/verse-mate-mobile/agent-os/specs/2025-10-14-bible-reading-mobile/planning/requirements.md`

**Visual Assets:**
`/Users/augustochaves/Work/verse-mate/verse-mate-mobile/agent-os/specs/2025-10-14-bible-reading-mobile/planning/visuals/`

**API Integration Layer:**
`/Users/augustochaves/Work/verse-mate/verse-mate-mobile/src/api/bible/`

**Previous Spec (API Layer):**
`/Users/augustochaves/Work/verse-mate/verse-mate-mobile/.agent-os/specs/2025-10-05-bible-reading-interface/`

**Project Documentation:**
`/Users/augustochaves/Work/verse-mate/verse-mate-mobile/CLAUDE.md`

**Standards:**
- `/Users/augustochaves/Work/verse-mate/verse-mate-mobile/agent-os/standards/global/tech-stack.md`
- `/Users/augustochaves/Work/verse-mate/verse-mate-mobile/agent-os/standards/global/conventions.md`
- `/Users/augustochaves/Work/verse-mate/verse-mate-mobile/agent-os/standards/frontend/components.md`
- `/Users/augustochaves/Work/verse-mate/verse-mate-mobile/agent-os/standards/frontend/accessibility.md`
