# Bible Reading Interface - Final Implementation Plan

> Date: 2025-10-06
> Status: Ready for Implementation
> Based on: Discovery findings, user feedback, and finalized decisions

## Executive Summary

This implementation plan synthesizes all discovery findings and user decisions into a concrete development roadmap. Key changes from original spec:

- **Architecture**: Modal-based navigation (not hierarchical screens)
- **Content**: Three tabs required (Summary/ByLine/Detailed)
- **Typography**: All text uses MerriweatherItalic (not Roboto Serif)
- **Routing**: Path-based `/bible/[bookId]/[chapter]` (mobile enhancement)
- **Navigation**: Floating buttons + swipe gestures

## Phase 1: Foundation Setup ✅ COMPLETE

**Status**: Already completed in previous work
- ✅ Expo Router configured
- ✅ React Query setup
- ✅ MSW v2 testing infrastructure
- ✅ TypeScript strict mode
- ✅ Git hooks (lint-staged, pre-commit, pre-push)

## Phase 2: API Integration & Data Layer

### 2.1 Validate Swagger Spec

**Endpoint**: `https://api.verse-mate.apegro.dev/swagger/json`

**Questions to validate**:
1. Are endpoints `/bible/testaments`, `/bible/books`, `/bible/book/{bookId}/{chapterNumber}` correct?
2. Do endpoints use `bookId` or `book` parameter?
3. Is there a `chapter` vs `chapterNumber` parameter difference?
4. Are there separate endpoints for Summary/ByLine/Detailed tabs?
5. How is testament determined? (Parameter or derived from bookId?)
6. What data models are returned?

**Action**: Fetch Swagger, validate assumptions, document corrections

### 2.2 Generate React Query Hooks

**Tool**: `@hey-api/openapi-ts` + `@7nohe/openapi-react-query-codegen`

**Commands**:
```bash
bun add @hey-api/openapi-ts @7nohe/openapi-react-query-codegen
npx @hey-api/openapi-ts -i https://api.verse-mate.apegro.dev/swagger/json -o src/api/generated
npx @7nohe/openapi-react-query-codegen openapi-ts.config.ts
```

**Generated files**:
- `src/api/generated/types.ts` - TypeScript types
- `src/api/generated/services.ts` - API service functions
- `src/api/generated/hooks.ts` - React Query hooks

### 2.3 Create MSW Handlers

**Files to create**:
```
__tests__/mocks/handlers/
  ├── bible-books.handlers.ts      # Book list endpoint
  ├── bible-chapters.handlers.ts   # Chapter content endpoint
  ├── bible-summary.handlers.ts    # Summary tab endpoint (if exists)
  └── bible-byline.handlers.ts     # By Line tab endpoint (if exists)

__tests__/mocks/data/
  ├── bible-books.data.ts          # Mock book data (1-66)
  ├── genesis-1.data.ts            # Genesis Chapter 1 content
  ├── genesis-50.data.ts           # Genesis Chapter 50 content
  └── matthew-5.data.ts            # Matthew Chapter 5 content
```

**Mock data structure**:
```typescript
// bible-books.data.ts
export const bibleBooks = [
  { id: 1, name: 'Genesis', testament: 'OT', chapters: 50 },
  { id: 2, name: 'Exodus', testament: 'OT', chapters: 40 },
  // ... 1-39 for OT
  { id: 40, name: 'Matthew', testament: 'NT', chapters: 28 },
  // ... 40-66 for NT
];

// genesis-1.data.ts
export const genesis1 = {
  bookId: 1,
  chapter: 1,
  title: 'Genesis 1',
  sections: [
    {
      subtitle: 'The Creation of the World',
      verses: [
        { number: 1, text: 'In the beginning, God created the heavens and the earth.' },
        { number: 2, text: 'The earth was without form and void...' },
        // ...
      ],
    },
  ],
};
```

### 2.4 Data Layer Utilities

**Files to create**:
```typescript
// utils/bible/testament.ts
export const getTestament = (bookId: number): 'OT' | 'NT' => {
  return bookId <= 39 ? 'OT' : 'NT';
};

// utils/bible/navigation.ts
export const getNextChapter = (bookId: number, chapter: number): { bookId: number; chapter: number } | null => {
  const book = bibleBooks.find(b => b.id === bookId);
  if (!book) return null;

  if (chapter < book.chapters) {
    return { bookId, chapter: chapter + 1 };
  }

  // Cross-book navigation
  const nextBook = bibleBooks.find(b => b.id === bookId + 1);
  return nextBook ? { bookId: nextBook.id, chapter: 1 } : null;
};

export const getPreviousChapter = (bookId: number, chapter: number): { bookId: number; chapter: number } | null => {
  if (chapter > 1) {
    return { bookId, chapter: chapter - 1 };
  }

  // Cross-book navigation
  const previousBook = bibleBooks.find(b => b.id === bookId - 1);
  return previousBook ? { bookId: previousBook.id, chapter: previousBook.chapters } : null;
};
```

**Tests to write**:
- `__tests__/utils/bible/testament.test.ts`
- `__tests__/utils/bible/navigation.test.ts`

## Phase 3: Routing & Screen Structure

### 3.1 Expo Router Structure

```
app/
  ├── _layout.tsx                  # Root layout (existing)
  ├── (tabs)/
  │   ├── _layout.tsx              # Tab navigation (existing)
  │   ├── index.tsx                # Home screen (existing)
  │   └── explore.tsx              # Explore screen (existing)
  └── bible/
      └── [bookId]/
          └── [chapter].tsx        # Main Bible reader screen (NEW)
```

### 3.2 Bible Reader Screen

**File**: `app/bible/[bookId]/[chapter].tsx`

**Component structure**:
```typescript
export default function BibleChapterScreen() {
  const { bookId, chapter } = useLocalSearchParams<{ bookId: string; chapter: string }>();
  const [selectedTab, setSelectedTab] = usePersistedState('preferredContentTab', 'detailed');

  return (
    <SafeAreaView>
      {/* Book/Chapter Selector Button */}
      <BookChapterSelector
        bookId={Number(bookId)}
        chapter={Number(chapter)}
        onPress={() => setModalOpen(true)}
      />

      {/* Content Tabs */}
      <ContentTabs
        selectedTab={selectedTab}
        onTabChange={setSelectedTab}
      />

      {/* Tab Content Views */}
      {selectedTab === 'summary' && <SummaryView bookId={bookId} chapter={chapter} />}
      {selectedTab === 'byline' && <ByLineView bookId={bookId} chapter={chapter} />}
      {selectedTab === 'detailed' && <DetailedView bookId={bookId} chapter={chapter} />}

      {/* Floating Navigation */}
      <FloatingNavigation
        bookId={Number(bookId)}
        chapter={Number(chapter)}
      />

      {/* Book/Chapter Selection Modal */}
      <SelectionModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        currentBookId={Number(bookId)}
        currentChapter={Number(chapter)}
      />
    </SafeAreaView>
  );
}
```

### 3.3 Deep Linking Configuration

**File**: `app.config.js` (update)

```javascript
export default {
  // ... existing config
  scheme: 'versemate',
  linking: {
    prefixes: ['versemate://'],
    config: {
      screens: {
        bible: {
          path: 'bible/:bookId/:chapter',
          parse: {
            bookId: Number,
            chapter: Number,
          },
        },
      },
    },
  },
};
```

**Deep link examples**:
- `versemate://bible/1/1` → Genesis 1
- `versemate://bible/40/5` → Matthew 5

## Phase 4: Core Components

### 4.1 Book/Chapter Selector

**File**: `components/bible/BookChapterSelector.tsx`

**Props**:
```typescript
interface BookChapterSelectorProps {
  bookId: number;
  chapter: number;
  onPress: () => void;
}
```

**Design**:
- Display: "Old Testament, Genesis, 18" (matches web app)
- Color: #8B7355 (tan/muted text)
- Chevron down icon
- Tan/gold background (#b09a6d)

### 4.2 Content Tabs

**File**: `components/bible/ContentTabs.tsx`

**Tabs**:
```typescript
const tabs = [
  { id: 'summary', label: 'Summary', icon: '📝' },
  { id: 'byline', label: 'By Line', icon: '📖' },
  { id: 'detailed', label: 'Detailed', icon: '📜' },
];
```

**Design**:
- Position: Sticky at top (below selector)
- Active tab: Underline or background highlight
- Typography: system-ui 16px/500

### 4.3 Detailed View (Full Chapter)

**File**: `components/bible/DetailedView.tsx`

**Structure**:
```typescript
export function DetailedView({ bookId, chapter }: Props) {
  const { data, isLoading } = useBibleChapter(bookId, chapter);

  return (
    <ScrollView>
      <ChapterHeader title={data.title} />
      {data.sections.map(section => (
        <ChapterSection key={section.subtitle}>
          <Subtitle text={section.subtitle} />
          {section.verses.map(verse => (
            <VerseText key={verse.number} verse={verse} />
          ))}
        </ChapterSection>
      ))}
    </ScrollView>
  );
}
```

**Typography (from discoveries)**:
- Chapter title (h1): MerriweatherItalic 32px/700/44px
- Section subtitle (h2): MerriweatherItalic 22px/700/28px
- Verse text (p): MerriweatherItalic 22px/400/28px
- Verse numbers: Superscript 12px with 2px margin

### 4.4 Summary View (NEW)

**File**: `components/bible/SummaryView.tsx`

**API**: Validate if `/bible/book/{bookId}/{chapter}/summary` endpoint exists

**Structure**:
- AI-generated chapter overview
- Key themes and takeaways
- Similar typography to DetailedView

### 4.5 By Line View (NEW)

**File**: `components/bible/ByLineView.tsx`

**API**: Validate if `/bible/book/{bookId}/{chapter}/byline` endpoint exists

**Structure**:
- Verse-by-verse detailed breakdown
- Expanded explanations per verse
- Similar typography to DetailedView

## Phase 5: Navigation Components

### 5.1 Floating Navigation Buttons

**File**: `components/bible/FloatingNavigation.tsx`

**Design spec (from DECISIONS.md)**:
```typescript
const FloatingNavigation = {
  position: 'edges',        // Left/right screen edges
  verticalAlign: 'center',  // Middle of screen height
  autoHide: true,
  autoHideDelay: 3000,      // 3 seconds
  iconType: 'chevron',      // < and > arrows
  size: 48,                 // 48px touch target
  offset: 16,               // 16px from screen edge
};
```

**Implementation**:
- Use `react-native-reanimated` for auto-hide animation
- Haptic feedback on press (`expo-haptics`)
- Always visible (not hover-only like web app)

### 5.2 Swipe Gesture Handler

**File**: `components/bible/GestureHandler.tsx`

**Design spec (from DECISIONS.md)**:
```typescript
const SwipeConfig = {
  leftSwipe: 'nextChapter',     // Left = forward (page turn)
  rightSwipe: 'previousChapter', // Right = back
  threshold: 50,                // 50px to trigger
  velocity: 0.3,                // Minimum velocity
  hapticFeedback: true,         // Vibrate on swipe
};
```

**Implementation**:
- Use `react-native-gesture-handler`
- Trigger haptic feedback on successful swipe
- Navigate using `router.push(/bible/${nextBookId}/${nextChapter})`

## Phase 6: Book/Chapter Selection Modal

### 6.1 Bottom Sheet Modal

**File**: `components/bible/SelectionModal.tsx`

**Library**: `@gorhom/bottom-sheet`

**Design spec (from DROPDOWN-ANALYSIS.md)**:
```typescript
const SelectionModal = {
  type: 'bottom-sheet',
  height: '85%',             // 85% of screen height
  snapPoints: ['85%', '50%'], // Can collapse to 50%
  closeOnOutsidePress: true,
};
```

### 6.2 Testament Tabs

**File**: `components/bible/TestamentTabs.tsx`

**Design**:
- Two tabs: "Old Testament" | "New Testament"
- Active tab highlighted
- Filters book list below

### 6.3 Search Input

**File**: `components/bible/SearchInput.tsx`

**Design**:
- Placeholder: "Filter Books..."
- Filters book list in real-time
- Clear button when text entered

### 6.4 Book List

**File**: `components/bible/BookList.tsx`

**Design**:
- Scrollable list of books
- Selected book: Tan/gold background (#b09a6d), checkmark icon
- On select: Updates chapter grid below

### 6.5 Chapter Grid

**File**: `components/bible/ChapterGrid.tsx`

**Design spec (from DROPDOWN-ANALYSIS.md)**:
```typescript
const ChapterGrid = {
  columns: 5,
  gap: 8,                    // 8px between items
  itemSize: 48,              // 48px minimum touch target
  borderRadius: 8,           // Rounded corners

  states: {
    selected: {
      background: '#b09a6d',  // Tan/gold
      textColor: '#FFFFFF',   // White
    },
    read: {
      background: '#d4c5a6',  // Light beige
      textColor: '#000000',   // Black
    },
    unread: {
      background: 'transparent',
      textColor: '#000000',
    },
  },
};
```

**Functionality**:
- Track reading progress via AsyncStorage
- Highlight read chapters
- On tap: Close modal, navigate to chapter

### 6.6 Progress Bar

**File**: `components/bible/ProgressBar.tsx`

**Design**:
- Shows % completion for selected book
- Color: #b09a6d (tan/gold)
- Background: #E5E5E5 (light gray)

## Phase 7: State Management

### 7.1 Reading Progress

**File**: `stores/reading-progress.ts`

**Storage**: AsyncStorage

```typescript
interface ReadingProgress {
  [bookId: number]: {
    chaptersRead: number[];
    lastChapterRead: number;
    percentage: number;
  };
}

const PROGRESS_KEY = 'reading_progress';

export const useReadingProgress = () => {
  const [progress, setProgress] = useState<ReadingProgress>({});

  // Load from AsyncStorage on mount
  // Save to AsyncStorage on change
  // Mark chapter as read
  // Get read status for chapter
  // Calculate percentage completion
};
```

### 7.2 Content Tab Preference

**File**: `hooks/use-persisted-state.ts`

**Storage**: AsyncStorage

```typescript
export const usePersistedState = <T>(key: string, defaultValue: T) => {
  const [value, setValue] = useState<T>(defaultValue);

  useEffect(() => {
    // Load from AsyncStorage on mount
    AsyncStorage.getItem(key).then(stored => {
      if (stored) setValue(JSON.parse(stored));
    });
  }, [key]);

  const updateValue = useCallback((newValue: T) => {
    setValue(newValue);
    AsyncStorage.setItem(key, JSON.stringify(newValue));
  }, [key]);

  return [value, updateValue] as const;
};
```

**Usage**:
```typescript
const [selectedTab, setSelectedTab] = usePersistedState('preferredContentTab', 'detailed');
```

## Phase 8: Testing Strategy

### 8.1 Unit Tests

**Test coverage targets**:
- `utils/bible/testament.test.ts` - 100%
- `utils/bible/navigation.test.ts` - 100%
- `hooks/use-persisted-state.test.ts` - 100%
- `stores/reading-progress.test.ts` - 100%

### 8.2 Component Tests

**Files to test**:
- `BookChapterSelector.test.tsx`
- `ContentTabs.test.tsx`
- `DetailedView.test.tsx`
- `SummaryView.test.tsx`
- `ByLineView.test.tsx`
- `FloatingNavigation.test.tsx`
- `SelectionModal.test.tsx`

**Test patterns**:
- MSW handlers for API mocking
- React Native Testing Library
- Mock AsyncStorage
- Mock navigation (Expo Router)

### 8.3 E2E Tests (Maestro)

**Files to create**:
```
.maestro/
  ├── bible-reader-navigation.yaml
  ├── book-selection.yaml
  ├── chapter-navigation.yaml
  └── swipe-gestures.yaml
```

**Test scenarios**:
1. Open Bible reader to Genesis 1
2. Navigate to next chapter via button
3. Navigate to previous chapter via swipe
4. Open book/chapter selector modal
5. Select different book (Matthew)
6. Select different chapter (Chapter 5)
7. Switch between content tabs
8. Verify tab preference persists
9. Test cross-book navigation (Genesis 50 → Exodus 1)

## Phase 9: Mobile Enhancements

### 9.1 Haptic Feedback

**File**: `utils/haptics.ts`

**Library**: `expo-haptics`

```typescript
import * as Haptics from 'expo-haptics';

export const triggerHaptic = (type: 'light' | 'medium' | 'heavy' = 'light') => {
  switch (type) {
    case 'light':
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      break;
    case 'medium':
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      break;
    case 'heavy':
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      break;
  }
};
```

**Usage locations**:
- Floating navigation buttons (light)
- Swipe gestures (medium)
- Chapter selection (light)
- Book selection (light)

### 9.2 Animations

**Library**: `react-native-reanimated`

**Animations to implement**:
1. Floating button auto-hide/show
2. Bottom sheet modal slide-up
3. Tab transition
4. Chapter transition (swipe)

### 9.3 Offline Support (Future)

**Library**: `@tanstack/react-query` with `persistQueryClient`

**Strategy**:
- Cache chapter content in AsyncStorage
- Show cached content when offline
- Sync when connection restored

## Phase 10: Design System Implementation

### 10.1 Typography

**File**: `constants/typography.ts`

```typescript
import { Platform } from 'react-native';

export const typography = {
  // Chapter content
  h1: {
    fontFamily: 'MerriweatherItalic',
    fontSize: 32,
    fontWeight: '700' as const,
    lineHeight: 44,
  },
  h2: {
    fontFamily: 'MerriweatherItalic',
    fontSize: 22,
    fontWeight: '700' as const,
    lineHeight: 28,
  },
  paragraph: {
    fontFamily: 'MerriweatherItalic',
    fontSize: 22,
    fontWeight: '400' as const,
    lineHeight: 28,
  },

  // UI elements
  button: {
    fontFamily: Platform.select({
      ios: 'System',
      android: 'Roboto',
      default: 'System',
    }),
    fontSize: 16,
    fontWeight: '400' as const,
    lineHeight: 24,
  },
  tabLabel: {
    fontFamily: Platform.select({
      ios: 'System',
      android: 'Roboto',
      default: 'System',
    }),
    fontSize: 16,
    fontWeight: '500' as const,
    lineHeight: 20,
  },
  chapterNumber: {
    fontFamily: Platform.select({
      ios: 'System',
      android: 'Roboto',
      default: 'System',
    }),
    fontSize: 16,
    fontWeight: '400' as const,
    lineHeight: 20,
  },
};
```

### 10.2 Colors

**File**: `constants/colors.ts`

```typescript
export const colors = {
  // Primary
  primary: '#b09a6d',          // Tan/gold (validated)
  primaryLight: '#d4c5a6',     // Light beige (read chapters)

  // Text
  textPrimary: '#000000',      // Black
  textSecondary: '#8B7355',    // Tan/muted
  textOnPrimary: '#FFFFFF',    // White on tan

  // Backgrounds
  background: '#FFFFFF',        // White
  backgroundSecondary: '#F5F5F5', // Light gray

  // Progress
  progressFill: '#b09a6d',     // Tan/gold
  progressBg: '#E5E5E5',       // Light gray

  // From previous discoveries
  night: '#212531',            // rgb(33, 37, 49) - main text
  muted: '#3E464D',            // rgb(62, 70, 77) - muted text
};
```

### 10.3 Font Loading

**File**: `app/_layout.tsx` (update)

```typescript
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    'MerriweatherItalic': require('../assets/fonts/Merriweather-Italic.ttf'),
    'Merriweather': require('../assets/fonts/Merriweather-Regular.ttf'),
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  // ...
}
```

## Implementation Order (Recommended)

### Week 1: API & Data Foundation
1. Validate Swagger spec
2. Generate React Query hooks
3. Create MSW handlers
4. Write utility functions (testament, navigation)
5. Test data layer

### Week 2: Core UI Components
1. Create Expo Router structure
2. Build DetailedView component
3. Implement typography system
4. Build ContentTabs component
5. Test chapter display

### Week 3: Navigation & Selection
1. Build BookChapterSelector
2. Implement SelectionModal with bottom sheet
3. Create TestamentTabs, SearchInput, BookList
4. Build ChapterGrid with progress tracking
5. Test modal interactions

### Week 4: Mobile Enhancements
1. Implement FloatingNavigation with auto-hide
2. Add swipe gesture handler
3. Integrate haptic feedback
4. Add animations (Reanimated)
5. Test navigation flows

### Week 5: Summary & ByLine Tabs
1. Validate API endpoints for Summary/ByLine
2. Build SummaryView component
3. Build ByLineView component
4. Test tab switching
5. Test tab preference persistence

### Week 6: Testing & Polish
1. Write comprehensive unit tests
2. Create Maestro E2E tests
3. Test deep linking
4. Performance optimization
5. Accessibility improvements

## Success Criteria

### Functional Requirements
- ✅ Display complete Bible chapters (no pagination)
- ✅ Three content tabs (Summary, By Line, Detailed)
- ✅ Book/chapter selection via modal
- ✅ Testament filtering (OT/NT)
- ✅ Search/filter books
- ✅ Reading progress tracking
- ✅ Prev/next chapter navigation
- ✅ Swipe gestures for navigation
- ✅ Cross-book navigation (Genesis 50 → Exodus 1)
- ✅ Deep linking support (`versemate://bible/1/1`)

### Design Requirements
- ✅ All text uses MerriweatherItalic font
- ✅ Typography matches web app (32px/22px/22px)
- ✅ Colors match web app (#b09a6d, #212531, #3E464D)
- ✅ 5-column chapter grid
- ✅ Progress bar shows % completion
- ✅ Floating navigation buttons (auto-hide 3s)

### Technical Requirements
- ✅ Path-based routing (`/bible/[bookId]/[chapter]`)
- ✅ React Query for API caching
- ✅ AsyncStorage for persistence
- ✅ MSW for API mocking
- ✅ Haptic feedback on interactions
- ✅ Reanimated for animations
- ✅ 80%+ test coverage

### Mobile Enhancements (Not in Web App)
- ✅ Always-visible navigation (not hover-only)
- ✅ Bottom sheet modal (better than dropdown)
- ✅ Haptic feedback (native feel)
- ✅ Swipe gestures (mobile pattern)
- ✅ Deep linking (shareable URLs)

## Questions Resolved

All 10 implementation questions answered by user:

1. ✅ `verseId` = chapter (bug in web app URL)
2. ✅ Chapter-level routing (no verse parameter)
3. ✅ Buttons + swipe gestures (both)
4. ✅ Left swipe = next chapter (page turn)
5. ✅ Tab bar sticky at top
6. ✅ Global tab preference (not per-chapter)
7. ✅ Dropdown structure captured (screenshot)
8. ✅ Testament tabs exist (OT/NT)
9. ✅ Skip additional dropdown capture
10. ✅ Implement all 3 tabs in Phase 1

## References

- **DISCOVERY-FINDINGS.md** - Web app analysis and validation
- **DISCOVERY-UPDATES.md** - Spec corrections and changes
- **DECISIONS.md** - All finalized implementation decisions
- **DROPDOWN-ANALYSIS.md** - Modal structure from screenshot
- **USER-FEEDBACK.md** - User responses to all questions
- **Swagger Spec**: https://api.verse-mate.apegro.dev/swagger/json

---

**Status**: ✅ Implementation plan complete, ready for Phase 2
**Next**: Validate Swagger spec and begin API integration
