# Technical Specification

This is the technical specification for the spec detailed in @.agent-os/specs/2025-10-05-bible-reading-interface/spec.md

> Created: 2025-10-05
> Updated: 2025-10-05
> Version: 1.1.0

## Technical Requirements

### Core Components Architecture
- **BibleNavigator**: Root component managing testament/book/chapter selection state
- **TestamentTabs**: Tab-based interface with Old/New Testament switching (Radix UI pattern)
- **BookAccordion**: Expandable accordion for hierarchical book organization within testaments
- **FilterInput**: Debounced search input with auto-focus (placeholder: "Filter Books...")
- **VerseGrid**: 5-column grid layout for chapter selection with active state highlighting
- **GlobalSearch**: Universal search component for finding chapters across all testaments and books
- **ChapterReader**: Main reading interface with inline verse formatting, subtitle integration, and full chapter display
- **MainText Components**:
  - MainText.Root - Container for entire chapter content
  - MainText.Content - Main content wrapper
  - MainText.Text - Individual text rendering with highlighting support
  - MainText.VerseNumber - Verse number display component
- **FloatingNavigation**: Persistent floating arrow buttons (40px circular, auto-hide after 3s) with cross-book navigation logic
- **SkeletonLoader**: Loading placeholder components for chapters and book lists
- **ErrorState**: Error message display with retry button for network/API failures
- **ProgressBar**: Reading progress indicator with value display
- **ReadingPreferences**: Settings component for font size, theme, and display customization
- **GestureNavigation**: Swipe gesture handler component working alongside floating controls

### Navigation Implementation
- **Expo Router**: File-based routing with dynamic segments for `/bible/[bookId]/[chapter]` structure
  - Testament excluded from URL path for clean structure (testament derived from bookId: 1-39=OT, 40-66=NT)
- **Cross-Book Navigation**: Logic to handle book transitions using sequential book IDs (Genesis=1 → Exodus=2, Malachi=39 → Matthew=40, etc.)
- **Book Order Mapping**: Sequential 1-66 book ID system from webapp's `testaments.ts` structure
- **Navigation Utilities**: Create `getNextBook()`, `getPreviousBook()`, `getLastChapterOfBook()` functions
- **Testament Transition**: Handle OT→NT transition (Malachi book 39 → Matthew book 40)
- **Navigation Boundaries**: Disable previous on Genesis 1:1, disable next on last chapter of Revelation
- **Enhanced Navigation**: Mobile app implements cross-book navigation (feature not present in current webapp)
- **React Navigation**: Bottom tab navigator integration for primary app navigation
- **URL State Management**: Search parameters persistence for deep linking and state restoration
- **Navigation Guards**: Validation for valid testament/book/chapter combinations

### Data Management
- **React Query**: API caching and background updates for Bible text and metadata
- **AsyncStorage**: Local persistence for reading position, recent books, reading preferences (font size, theme), and user settings
- **State Management**: Context providers for current reading state, navigation history, and global search state
- **Testament Structure**: Books organized by `t` property (OT/NT) with:
  - `b`: Book ID (1-66 sequential, Genesis=1, Revelation=66)
  - `n`: Book name (string)
  - `c`: Chapter count (number)
  - `g`: Genre ID (number)
- **Book Navigation Data**: Use exact `testaments` array structure from webapp for consistency
- **URL State**: Search parameters for `bookId`, `verseId`, `testament`, `bibleVersion`, `explanationType`
- **Recent Books**: History tracking with icons, appearing at top of both testament tabs
- **Reading Position**: Per-verse or scroll position persistence using AsyncStorage
- **Loading States**: Skeleton screen patterns for chapter content and book lists
- **Error Handling**: Network failure detection with retry mechanisms
- **Prefetching Strategy**: Adjacent chapter preloading for smooth navigation experience
- **Search Index**: Local indexing for fast global chapter search across all Bible content with debounced input

### Gesture and Animation System
- **React Native Gesture Handler**: PanGestureHandler for left/right swipe chapter navigation (30px delta, 500ms duration)
- **React Native Reanimated**: Smooth page transitions with slide animations (0.3s duration)
- **Chapter Transitions**: slide-out-left, slide-in-right, slide-out-right, slide-in-left animations
- **Haptic Feedback**: iOS/Android haptic responses for gesture interactions and floating button taps
- **Floating Button Animation**:
  - Auto-hide after 3 seconds of inactivity
  - Show on scroll activity or proximity (150px radius)
  - 40px circular buttons with 0.3s ease transitions
  - Position: 16px from screen edges, 50% vertical center
- **Dual Navigation**: Coordinate between swipe gestures and floating button navigation for seamless experience
- **Cross-Book Navigation Logic**:
  ```typescript
  // Key navigation functions to implement:
  getNextBook(currentBookId: number): number | null
  getPreviousBook(currentBookId: number): number | null
  getLastChapterOfBook(bookId: number): number
  handleNextChapter(bookId: number, chapter: number, totalChapters: number)
  handlePreviousChapter(bookId: number, chapter: number)
  ```

### Typography and Layout
- **Font System**:
  - Titles: MerriweatherItalic, 32px, 700 weight, 44px line height
  - Subtitles: MerriweatherItalic, 22px, 700 weight, 28px line height
  - Body Text: Roboto Serif, 18px, 300 weight, 32px line height
  - Verse Numbers: 12px superscript with 2px margin
- **Color System**:
  - Primary Accent: #b09a6d (--dust)
  - Background: #f6f3ec (--fantasy)
  - Text: #212531 (--night)
  - Muted Text: #818990 (--oslo-gray)
  - Borders: #d5d8e1 (--border)
- **Responsive Layout**: SafeAreaView integration with proper insets for all device sizes and floating control positioning
- **Inline Verse Formatting**: Text parsing for verse numbers with inline superscript styling (no separate elements)
- **Subtitle Integration**: Dynamic content sectioning based on API subtitle data with verse ranges
- **Theme System**: Light/dark theme support with user preference persistence matching webapp patterns
- **Complete Chapter Layout**: Full chapter content display without pagination or infinite scroll
- **Mobile Layout**: Bottom tab navigation with 56px height, content height calc(100vh - 104px)

### API Integration
- **Base URL**: https://api.verse-mate.apegro.dev
- **Core Endpoints**:
  - `/bible/testaments` - Get testament and book structure
  - `/bible/books` - Get all Bible books with metadata
  - `/bible/book/{bookId}/{chapterNumber}` - Get chapter content with verses and subtitles
  - `/bible/book/chapter/save-last-read` - Save user's reading position
- **Authentication**: User ID (UUID) required for personalized features (authentication flow out of scope - will be handled separately)
- **Version Support**: NASB1995 Bible version with `versionKey` parameter
- **Data Models**: Chapter object contains `chapterNumber`, `subtitles[]`, and `verses[]` arrays
- **Verse Structure**: Each verse has `verseNumber` and `text` properties
- **Subtitle Structure**: Contains `subtitle`, `start_verse`, and `end_verse` for section organization
- **Error Handling**: Network retry logic and offline graceful degradation
- **Background Sync**: Automatic content updates when connectivity restored

### Performance Optimization
- **FlatList Implementation**: Virtualized rendering for large book lists (not needed for chapter content as it displays complete chapters)
- **Search Optimization**: Debounced search with local indexing for fast global chapter lookup
- **Memory Management**: Proper cleanup of gesture handlers, animation listeners, and search indices
- **App Performance**: Efficient component rendering and state management for smooth Bible reading experience
- **Floating Control Optimization**: Efficient rendering of persistent floating navigation elements

### Testing Strategy

#### Unit & Integration Testing (Jest + React Native Testing Library)
- **Test Runner**: Jest with `jest-expo` preset (use `npm test`, NOT `bun test`)
  - Command: `npm run test` for single run
  - Watch mode: `npm run test:watch`
  - Coverage: `npm run test:coverage`
  - CI mode: `npm run test:ci`
- **Testing Library**: `@testing-library/react-native` v13.3.3 with `@testing-library/jest-native` matchers
- **Test Location**: `__tests__/**/*.test.{ts,tsx}` or co-located `*.test.{ts,tsx}`
- **Environment**: Node environment with Expo static rendering (`EXPO_USE_STATIC_RENDERING=1`)

#### API Mocking (MSW v2)
- **Mock Service Worker**: MSW v2 with Node.js adapter for API testing
- **Setup**: Global MSW server in `test-setup.ts` (started in `beforeAll`, reset in `afterEach`, closed in `afterAll`)
- **Handlers**: Organized in `__tests__/mocks/handlers/` (by domain: verses, explanations, etc.)
- **Mock Data**: Centralized in `__tests__/mocks/data/` for reusable test fixtures
- **Fetch Polyfill**: Uses `undici` for Node.js fetch API compatibility

#### E2E Testing (Maestro)
- **Test Flows**: YAML-based test flows in `.maestro/` directory
- **Commands**:
  - `bun run maestro:test` - Run all E2E tests
  - `bun run maestro:test:ios` - iOS-specific tests (iPhone 15)
  - `bun run maestro:test:android` - Android-specific tests
  - `bun run maestro:studio` - Interactive test development
- **Use Cases**: User journey testing, gesture interactions, navigation flows

#### Component Documentation (Storybook)
- **Storybook**: React Native Storybook v9.1.4 with on-device addons
- **Stories**: Co-located with components (e.g., `Button.stories.tsx`)
- **Commands**:
  - `bun run storybook:generate` - Generate stories
  - `bun run chromatic:deploy` - Deploy to Chromatic for visual regression
- **Addons**: Actions, Backgrounds, Controls, Notes (all on-device)

#### Code Quality & Type Safety
- **Linting**: Biome.js + ESLint (dual setup) with pre-commit hooks via `lint-staged`
- **Type Checking**: TypeScript strict mode with pre-push hook (`bun tsc --noEmit`)
- **Pre-commit**: Runs Biome format/check + ESLint fix on staged files
- **Pre-push**: Runs full TypeScript type check before push

#### Testing Best Practices for This Spec
1. **Component Tests**: Test all navigation components (TestamentTabs, BookAccordion, ChapterReader) with RNTL
2. **Gesture Tests**: Mock gesture handlers and test swipe navigation logic
3. **API Integration Tests**: Use MSW handlers for Bible API endpoints (`/bible/testaments`, `/bible/book/{bookId}/{chapterNumber}`)
4. **Navigation Tests**: Test Expo Router navigation between screens
5. **State Management Tests**: Test AsyncStorage persistence and React Query caching
6. **E2E Flows**: Create Maestro flows for:
   - Complete user journey: Testament selection → Book selection → Chapter reading
   - Swipe navigation between chapters
   - Cross-book navigation (last chapter → next book's first chapter)
   - Global search functionality
7. **Accessibility Tests**: Use `@testing-library/jest-native` a11y matchers for screen reader support

## External Dependencies

### Already Installed
**React Native Gesture Handler 2.28.0** - Advanced gesture recognition for swipe navigation
- Justification: Provides precise gesture detection required for chapter navigation with momentum and velocity calculation
- Status: ✅ Already installed in package.json

**React Native Reanimated 4.1.0** - High-performance animations for page transitions
- Justification: Essential for smooth chapter transitions and auto-hide control animations without bridge communication
- Status: ✅ Already installed in package.json

### Needs Installation
**@react-native-async-storage/async-storage** - Local storage for reading position and preferences
- Justification: Required for offline reading position persistence and user preference storage
- Installation: `bun add @react-native-async-storage/async-storage`

**@tanstack/react-query** - Server state management and caching
- Justification: Optimizes API calls with intelligent caching and background updates for Bible content
- Installation: `bun add @tanstack/react-query`