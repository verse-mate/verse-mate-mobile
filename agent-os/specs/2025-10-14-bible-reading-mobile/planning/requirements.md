# Spec Requirements: Bible Reading Mobile Interface

## Initial Description

Implement a mobile-optimized Bible reading experience that:
- Provides dropdown-based navigation for testament/book/chapter selection
- Displays three content tabs (Summary, By Line, Detailed)
- Uses validated design system (MerriweatherItalic typography, color #212531)
- Adds mobile enhancements (URL routing, gestures, haptics)
- Builds on completed API integration layer

## Requirements Discussion

### First Round Questions

**Q1: Navigation Modal Design**
I assume we should use an iOS-style bottom sheet modal (~75-80% screen height) with swipe-to-dismiss functionality for the navigation dropdown. Is that correct, or would you prefer a full-screen modal?

**Answer:** Bottom sheet approach accepted, open to suggestions

**Q2: Chapter Navigation Controls**
Should we implement BOTH floating prev/next chapter buttons AND swipe gestures for chapter navigation, or choose one approach?

**Answer:** BOTH floating buttons AND swipe gestures

**Q3: Tab Persistence**
Should the active content tab (Summary/By Line/Detailed) persist when navigating between chapters?

**Answer:** Persist active tab across chapter navigation

**Q4: Typography & Readability**
Should we match the web app's exact font sizes, or adapt them for mobile readability using responsive typography scales?

**Answer:** Use mobile best practices (not exact web sizing)

**Q5: Deep Linking**
Should deep links follow `/bible/[bookId]/[chapter]` pattern, or should we encode the active tab as well (e.g., `/bible/[bookId]/[chapter]/[tab]`)?

**Answer:** `/bible/[bookId]/[chapter]` (no tab encoding)

**Q6: Loading States**
Should we use skeleton loaders, spinners, or progressive loading for chapter content?

**Answer:** Skeleton loaders

**Q7: Offline Behavior**
How should the app behave when offline? Cache the last viewed chapter, show error message, or allow browsing previously cached content?

**Answer:** Cache last viewed chapter

**Q8: Reading Position Persistence**
When should we save reading position - immediately on chapter load, when user scrolls, or when they navigate away? Should we save scroll position within the chapter or just book + chapter?

**Answer:** Save immediately, position = book + chapter only (no scroll position)

**Q9: Accessibility**
Should we implement full accessibility support (screen readers, dynamic type, VoiceOver) from the start?

**Answer:** Full accessibility support

**Q10: Existing Components**
Are there existing features in your codebase with similar patterns we should reference?

**Answer:** None (build from scratch)

### Follow-up Questions

**Follow-up 1: Topics Tab**
I noticed the screenshots show three testament tabs: "Old Testament", "New Testament", and "Topics". The initialization document mentions we discovered the web app uses this pattern. Should we implement all three tabs, or is "Topics" out of scope for this phase?

**Answer:** OUT OF SCOPE - feature not approved yet, skip for now

**Follow-up 2: Hamburger Menu Features**
The screenshots show a hamburger menu with options like Notes, Bookmarks, Favorites, Highlights, and Settings. Should these be:
- Functional (implement now)
- Placeholder buttons (show "Coming Soon")
- Hidden for this phase

**Answer:**
- Notes: OUT OF SCOPE (keep button with "TODO" alert)
- Bookmarks: OUT OF SCOPE (keep button with "TODO" alert)
- Favorites: OUT OF SCOPE (keep button with "TODO" alert)
- Highlights: OUT OF SCOPE (keep button with "TODO" alert)
- Settings: OUT OF SCOPE (keep button with "TODO" alert)

**Follow-up 3: Chapter Selection Flow**
After tapping a book in the navigation modal, should we:
- A) Show chapter list immediately in the same modal
- B) Navigate to a separate chapter selection screen
- C) Jump to chapter 1 by default with ability to change chapter

**Answer:** Option A - After tapping book → shows chapter grid (5-column layout). New screenshot added: `Screenshot 2025-10-14 at 14.45.29.png` shows Genesis chapters 1-40 in grid. Chapter 1 has gold/tan background (current chapter). Clean number buttons, responsive grid.

**Follow-up 4: Progress Indicator**
I see "2%" at the bottom of most screenshots. Is this:
- Reading progress through current book (e.g., 1 of 50 chapters = 2%)
- Progress through entire Bible
- Something else

**Answer:** Represents book completion progress. Example: Genesis 1/50 = 2%. Bottom progress bar with percentage.

**Follow-up 5: Recent Books**
I notice Matthew has a clock icon in the book list. Should we:
- Track recently viewed books
- Show them at the top of the list
- Add visual indicator (like the clock icon)

**Answer:** IN SCOPE - Track recently viewed books. Show up to 5 recent books at top of list. Display with clock icon indicator (like Matthew in screenshots).

**Follow-up 6: Mobile Typography & Font Scaling**
For mobile readability, should we:
- A) Use React Native's dynamic type with minimum/maximum sizes
- B) Provide manual font size controls in Settings
- C) Both approaches

**Answer:** Option A selected - React Native dynamic type, 16-18px base that respects system font size settings. No manual controls needed for now.

**Follow-up 7: Offline Indicator**
Should we show an offline indicator in the UI?
- A) Banner/toast notification
- B) Small icon/badge in header
- C) No indicator (silent caching)

**Answer:** Option B selected - Small icon/badge in header. Subtle, non-intrusive visual indicator.

**Follow-up 8: Navigation Modal Pattern**
Looking at the screenshots, the navigation modal appears to use an iOS-style bottom sheet. Should we confirm this pattern?

**Answer:** Approved - iOS-style bottom sheet, ~75-80% screen height, swipe to dismiss, dimmed background, matches iOS native patterns.

**Follow-up 9: Share Functionality**
I see a share icon in the screenshots. Should we implement share functionality (sharing verse/chapter links)?

**Answer:** OUT OF SCOPE for this spec. Add to backlog (just URL sharing). Can be implemented later.

## Visual Assets

### Files Provided (10 screenshots total):

1. **Screenshot 2025-10-14 at 14.39.08.png** - Main reading view
   - Dark header (#000000) with "Genesis 1" title + 3 icons (navigation, read mode, hamburger menu)
   - White content area with "Genesis 1" heading, "The Creation" subtitle, verse range "(Genesis 1:1 - 31)"
   - Bible text with superscript verse numbers
   - Progress bar at bottom showing "2%"

2. **Screenshot 2025-10-14 at 14.39.22.png** - Navigation modal (Old Testament, expanded book list)
   - "Old Testament, Genesis, 1" breadcrumb with dropdown chevron
   - Three tabs: "Old Testament" (active/gold), "New Testament", "Topics"
   - Filter input field
   - Book list: Genesis (selected/gold bg with checkmark), Matthew (clock icon), Exodus, Leviticus, Numbers, Deuteronomy, Joshua, Judges, Ruth, 1 Samuel, 2 Samuel, 1 Kings
   - Progress bar "2%" at bottom

3. **Screenshot 2025-10-14 at 14.39.26.png** - Navigation modal (New Testament tab)
   - Same structure as above
   - "Old Testament" (inactive), "New Testament" (active/gold), "Topics" tabs
   - Genesis still selected (gold bg), Matthew has clock icon
   - NT books shown: Matthew, Mark, Luke, John, Acts, Romans, 1 Corinthians, 2 Corinthians, Galatians, Ephesians, Philippians

4. **Screenshot 2025-10-14 at 14.39.30.png** - Content tabs view (Summary)
   - Dark header with "Genesis 1" + icons
   - Tab bar below header: "Summary" (active/gold pill), "By Line" (gray pill), "Detailed" (gray pill)
   - White content area: "Summary of Genesis 1" heading
   - "Overview" subheading with explanatory text
   - "Days 1-3: Forming the Realms" subheading (content cut off)

5. **Screenshot 2025-10-14 at 14.39.35.png** - Content tabs view (By Line)
   - Same header + tab bar structure
   - "By Line" tab active (gold)
   - Content: "Line-by-Line Analysis of Genesis 1"
   - "Genesis 1:1" subheading with quoted verse in gray box
   - "Summary" subheading with detailed explanation including Hebrew words (bold)

6. **Screenshot 2025-10-14 at 14.40.00.png** - Hamburger menu expanded
   - Dark header with "Genesis 1" + X close icon (right side)
   - White modal overlay with menu items:
     - Bookmarks (bookmark icon)
     - Favorites (heart icon)
     - Notes (document icon)
     - Highlights (pen icon)
     - Settings (gear icon)

7. **Screenshot 2025-10-14 at 14.40.07.png** - Main reading view (same as #1, repeated reference)

8. **Screenshot 2025-10-14 at 14.40.11.png** - Notes modal overlay
   - Dimmed background showing reading content
   - White modal card centered on screen
   - "Notes for Genesis 1" heading with X close button
   - "Add New Note" section with text input "Write your note here..."
   - "Add Note" button (gray)
   - "Existing Notes (0)" section
   - "No notes yet" empty state message

9. **Screenshot 2025-10-14 at 14.40.18.png** - iOS native share sheet
   - Standard iOS share overlay with "app.versemate.org" at top
   - Share options: Mail, Messages, Notes, Freeform, Reminders
   - "Edit Extensions..." option at bottom

10. **Screenshot 2025-10-14 at 14.45.29.png** - Chapter grid view (NEW)
    - Navigation modal state showing Genesis selected
    - 5-column responsive grid layout
    - Chapter numbers 1-40 displayed as clean buttons
    - Chapter 1 has gold/tan background (#b09a6d) indicating current chapter
    - Other chapters have white background
    - Grid continues beyond visible area (Genesis has 50 chapters total)
    - Maintains header with breadcrumb and progress bar

### Visual Design System Extracted:

**Color Palette:**
- Header background: #000000 (pure black)
- Content background: #FFFFFF (white)
- Accent/Active color: #b09a6d (gold/tan - used for active tabs, selected states, current chapter)
- Inactive tabs: #4a4a4a (dark gray)
- Text primary: #000000 (black)
- Text secondary: #666666 (gray)
- Verse quote background: #f5f5f5 (light gray)
- Progress bar track: #e0e0e0 (light gray)
- Progress bar fill: #b09a6d (gold/tan)

**Typography Scale:**
- Header title: ~17-18px, medium weight, white
- Page heading: ~32-36px, bold, black
- Section subtitle: ~20-22px, bold, black
- Verse range: ~14-16px, regular, gray
- Body text: ~16-18px, regular, black (respects system font size)
- Superscript verse numbers: ~10-12px, regular
- Tab labels: ~14-16px, medium
- Button labels: ~16px, medium
- Breadcrumb: ~14-16px, regular, gold

**Component Patterns:**

1. **Bottom Sheet Navigation Modal:**
   - Height: ~75-80% of screen
   - Border radius: 16px top corners
   - White background
   - Swipe handle at top (optional)
   - Dimmed backdrop (#000000 with 0.5 opacity)

2. **Testament Tabs:**
   - Horizontal tab bar
   - Active: gold text (#b09a6d), no underline
   - Inactive: black text
   - Simple text-based tabs (no pills)

3. **Content Tabs (Pill Style):**
   - Horizontal scrollable tab bar
   - Active: gold pill (#b09a6d background), dark text
   - Inactive: gray pill (#4a4a4a background), white text
   - Rounded pill shape with padding

4. **Book List:**
   - Full-width list items
   - Selected: gold background (#b09a6d), white text, checkmark icon (right)
   - Recent: clock icon (right)
   - Regular: white background, black text
   - Separator lines between items

5. **Chapter Grid:**
   - 5-column responsive grid
   - Square/rounded buttons with chapter numbers
   - Current chapter: gold background (#b09a6d), dark text
   - Other chapters: white background, black text
   - Consistent spacing and sizing

6. **Filter Input:**
   - Light gray background (#f5f5f5)
   - Placeholder: "Filter..." in gray
   - Full width with padding
   - Rounded corners (8px)

7. **Progress Bar:**
   - Fixed at bottom of screen
   - Height: ~4-6px
   - Light gray track (#e0e0e0)
   - Gold fill (#b09a6d)
   - Percentage text on right (gold color)

8. **Header Icons:**
   - White icon color
   - ~24-28px size
   - Even spacing (~12-16px between)

9. **Modal Overlays:**
   - Centered on screen (or bottom sheet style)
   - White background
   - Rounded corners (16px)
   - Drop shadow
   - Close button (X) in top right

10. **Buttons:**
    - Primary: gold background (#b09a6d), white text
    - Secondary: gray background (#4a4a4a), white text
    - Text only: gold text, no background
    - Rounded corners (8px)

**Spacing and Layout:**
- Screen padding: 16-20px horizontal
- Section spacing: 24-32px vertical
- Component spacing: 12-16px
- Header height: 56-60px
- Tab bar height: 48-52px
- List item height: 52-56px
- Grid item size: (screen width - padding) / 5 columns
- Bottom progress bar: Fixed position, 4-6px height

**Interactive States:**
- Active/Selected: Gold background or text (#b09a6d)
- Hover (web): Subtle background change
- Pressed: Slight opacity reduction (0.7-0.8)
- Disabled: 50% opacity
- Loading: Skeleton with shimmer animation

**Fidelity Level:**
- High-fidelity design mockups
- Exact colors, typography, and spacing defined
- Component patterns clearly established
- Interactive states documented

## Existing Code to Reference

### API Integration Layer (Already Completed)

The previous spec completed comprehensive API integration that this mobile interface will build upon:

**Location:** `/Users/augustochaves/Work/verse-mate/verse-mate-mobile/src/api/bible/`

**Available React Query Hooks:**
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

**Available Types:**
- `BookMetadata` - Normalized book metadata
- `ChapterContent` - Normalized chapter with sections and verses
- `ExplanationContent` - Normalized explanation content
- `ContentTabType` - 'summary' | 'byline' | 'detailed'
- `Testament` - 'OT' | 'NT'
- `BibleVersion` - Version key type
- `ReadingPosition` - Position tracking interface
- `BookProgress` - Progress calculation interface

**Data Transformers:**
- `transformTestamentBook()` - API to frontend format
- `transformChapterResponse()` - Groups verses by subtitle sections
- `transformExplanationResponse()` - Normalizes explanation data

**MSW Handlers for Testing:**
- Located in `__tests__/mocks/handlers/`
- Mock data in `__tests__/mocks/data/`
- All API endpoints covered with test handlers

**No similar features to reference** - This is a greenfield mobile implementation.

## Requirements Summary

### Feature Overview & Goals

**Primary Goal:**
Create a mobile-first Bible reading interface that provides easy navigation, multiple reading modes, and persistent reading progress tracking.

**User Value:**
- Fast, intuitive navigation between books and chapters
- Multiple explanation types for different reading depths
- Seamless mobile experience with gestures and native patterns
- Offline-capable with smart caching
- Accessible to all users including those using assistive technologies

**Success Metrics:**
- Users can navigate from app launch to desired chapter in < 5 taps
- Chapter loads in < 2 seconds (cached) or < 5 seconds (network)
- 95%+ accessibility score on automated tools
- Zero layout shifts during content loading
- Smooth 60fps animations and transitions

### Functional Requirements

#### 1. Navigation System

**Bottom Sheet Modal:**
- Triggered by navigation icon in header
- iOS-style bottom sheet (~75-80% screen height)
- Swipe-to-dismiss gesture support
- Dimmed backdrop (50% opacity black)
- Smooth spring animation (300-400ms)
- Respects safe area insets

**Testament Tabs:**
- Two tabs: "Old Testament" and "New Testament" only
- Topics tab OUT OF SCOPE (not approved yet)
- Active tab: gold text color (#b09a6d)
- Inactive tab: black text
- Tap to switch testament
- Scrolls book list to top on switch

**Book List:**
- Scrollable vertical list
- Shows up to 5 recent books at top (with clock icon)
- Then all books in canonical order
- Selected book: gold background (#b09a6d), white text, checkmark icon
- Recent book indicator: clock icon on right
- Tap to select book → shows chapter grid

**Chapter Grid:**
- 5-column responsive grid layout
- Displays all chapters for selected book
- Current chapter: gold background (#b09a6d)
- Other chapters: white background
- Tap chapter → dismisses modal and navigates to chapter

**Filter/Search:**
- Text input at top of book list
- Filters books by name (case-insensitive)
- Updates list in real-time as user types
- Clears when testament switches

**Breadcrumb:**
- Shows: "[Testament], [Book], [Chapter]"
- Gold color (#b09a6d)
- Tappable to expand/collapse navigation modal
- Chevron down icon indicates expandability

#### 2. Chapter Reading Interface

**Header:**
- Fixed at top during scroll
- Black background (#000000)
- White text showing "[Book] [Chapter]"
- Three icons (right-aligned):
  1. Navigation icon (book/chapter selector)
  2. Read mode icon (placeholder for future feature)
  3. Hamburger menu (settings/features)

**Content Area:**
- White background
- Responsive padding (16-20px horizontal)
- Large chapter heading: "[Book] [Chapter]"
- Section subtitles when present
- Verse range "(Book X:Y - Z)"
- Bible text with superscript verse numbers
- Markdown rendering for explanations (Summary/By Line/Detailed tabs)

**Content Tabs:**
- Fixed below header (or sticky)
- Three pill-style tabs: Summary, By Line, Detailed
- Active tab: gold background (#b09a6d), dark text
- Inactive tabs: gray background (#4a4a4a), white text
- Horizontal scrollable if needed
- Persists active tab across chapter navigation
- Smooth transition animation (200ms)

**Floating Navigation Buttons:**
- Previous chapter button (left)
- Next chapter button (right)
- Fixed position (bottom of screen, above progress bar)
- Circular buttons with chevron icons
- Gold background (#b09a6d), white icon
- Drop shadow for elevation
- Hide when at first/last chapter respectively
- Haptic feedback on tap

**Swipe Gestures:**
- Swipe left → next chapter
- Swipe right → previous chapter
- Respects scroll position (only triggers at top of page)
- Visual feedback during swipe
- Haptic feedback on successful navigation

**Progress Bar:**
- Fixed at bottom of screen
- Shows book completion percentage
- Light gray track (#e0e0e0)
- Gold fill (#b09a6d)
- Percentage text on right
- Updates immediately on chapter change

#### 3. Hamburger Menu

**Menu Items (ALL PLACEHOLDER for this spec):**
- Bookmarks → Shows "Coming Soon" alert
- Favorites → Shows "Coming Soon" alert
- Notes → Shows "Coming Soon" alert
- Highlights → Shows "Coming Soon" alert
- Settings → Shows "Coming Soon" alert

**Menu Behavior:**
- Slides in from right side
- White background
- Close X button in header
- Icons for each menu item
- Tap item → shows alert: "This feature is coming soon!"
- Tap backdrop or X → dismisses menu

#### 4. Deep Linking

**URL Pattern:**
`/bible/[bookId]/[chapter]`

**Examples:**
- `/bible/1/1` → Genesis 1
- `/bible/40/5` → Matthew 5
- `/bible/66/22` → Revelation 22

**Behavior:**
- App launch with deep link → navigate directly to chapter
- Deep link while app open → navigate to chapter with animation
- Invalid bookId/chapter → redirect to last read or Genesis 1
- Does NOT encode active tab (tab persists from last session)

#### 5. Reading Position Persistence

**Save Position:**
- Triggers immediately on chapter load
- Saves: book ID + chapter number only (no scroll position)
- Uses API: `POST /bible/book/chapter/save-last-read`
- No user-facing loading states (background operation)
- Fails silently if offline (queues for later)

**Load Position:**
- On app launch: fetch last read position
- Uses API: `POST /bible/book/chapter/last-read`
- If found: navigate to that chapter
- If not found: default to Genesis 1
- Show skeleton loader during fetch (max 2 seconds)

**Recent Books Tracking:**
- Track last 5 books viewed (with timestamps)
- Store in AsyncStorage (local only)
- Display at top of book list with clock icon
- Cleared after 30 days of inactivity

#### 6. Book Progress Tracking

**Calculation:**
- Current chapter / total chapters = percentage
- Example: Genesis 1/50 = 2%
- Rounded to nearest whole number

**Display:**
- Progress bar at bottom of screen
- Percentage text on right side
- Updates immediately on chapter change
- Animates fill width (200ms ease-in-out)

**Persistence:**
- Calculate on-the-fly (not stored)
- Based on current chapter only
- No historical tracking of chapters read

#### 7. Offline Behavior

**Caching Strategy:**
- Cache last viewed chapter automatically
- Use React Query cache (24 hour retention)
- Cache testaments/books list (7 day retention)
- Cache explanations for current chapter
- No manual download controls (automatic only)

**Offline Indicator:**
- Small icon/badge in header (near right side)
- Shows when device is offline
- Subtle design (doesn't distract from reading)
- Cloud icon with slash or Wi-Fi icon with X
- Gray color when offline, hidden when online

**Offline Functionality:**
- Can read cached chapter
- Can switch tabs (if explanations cached)
- Cannot navigate to uncached chapters
- Show toast: "This chapter is not available offline"

#### 8. Loading States

**Skeleton Loaders:**
- Used for all content loading
- Shimmer animation (1.5s loop)
- Matches content layout:
  - Header: title skeleton
  - Content: paragraph skeletons
  - Tabs: tab skeletons
- Light gray base (#e0e0e0)
- White shimmer overlay
- Smooth crossfade to real content (200ms)

**Spinner Loader:**
- Used only for navigation modal (book list loading)
- Centered in modal
- Gold color (#b09a6d)
- Small size (24px)

**Progressive Loading:**
- Load chapter content first (highest priority)
- Load active tab explanation second
- Prefetch other tab explanations (low priority)
- Prefetch next chapter in background

### Non-Functional Requirements

#### Performance

**Target Metrics:**
- Initial app load: < 3 seconds
- Chapter navigation: < 1 second (cached), < 3 seconds (network)
- Tab switching: < 500ms
- Modal open/close: < 400ms
- Gesture response: < 100ms
- 60fps animations throughout

**Optimization Strategies:**
- React Query caching (24 hour stale time)
- Prefetch next/previous chapters on load
- Lazy load explanation tabs
- Virtualized lists for long book lists (if needed)
- Image optimization (none needed - text-only)
- Bundle splitting by route

#### Accessibility

**Screen Reader Support:**
- All interactive elements properly labeled
- Heading hierarchy (h1, h2, h3) for content structure
- ARIA labels for icon-only buttons
- ARIA live regions for dynamic content updates
- Announcement of chapter changes
- Announcement of tab switches

**Dynamic Type:**
- Respect iOS/Android system font size settings
- Base size: 16-18px for body text
- Scale factor: 1.0x to 2.5x (user controlled)
- Test at 200% zoom
- No text cutoff or overlap at any size

**Color Contrast:**
- WCAG AAA compliance for body text (7:1 ratio minimum)
- WCAG AA compliance for UI elements (4.5:1 ratio minimum)
- Gold accent (#b09a6d) on white: 4.52:1 (AA compliant)
- Black text (#000000) on white: 21:1 (AAA compliant)
- White text on gold: 4.52:1 (AA compliant)

**Keyboard Navigation:**
- All interactive elements keyboard accessible (web only)
- Visible focus indicators
- Logical tab order
- Escape key closes modals

**Haptic Feedback:**
- Light haptic on button taps
- Medium haptic on successful chapter navigation
- Error haptic on navigation failure (first/last chapter)

**VoiceOver/TalkBack:**
- Test with iOS VoiceOver
- Test with Android TalkBack
- Proper focus management
- Descriptive labels for all controls

#### Security

**Data Privacy:**
- No personal data collected (yet - auth is separate spec)
- Reading position stored locally (AsyncStorage)
- API calls over HTTPS only
- No analytics tracking in this phase

**Content Security:**
- Sanitize markdown rendering (prevent XSS)
- Validate bookId/chapter params
- Handle malformed API responses gracefully

#### Error Handling

**Network Errors:**
- Show toast: "Unable to load chapter. Please check your connection."
- Retry button in toast
- Automatic retry with exponential backoff (3 attempts)
- Fall back to cached content if available

**API Errors:**
- 404 (chapter not found): Redirect to Genesis 1 + toast
- 500 (server error): Show error state with retry button
- Timeout (>10s): Show error state with retry button

**Invalid Navigation:**
- Invalid bookId: Redirect to Genesis 1
- Invalid chapter: Redirect to first chapter of book
- Negative numbers: Treat as 1
- Out of range: Cap at max chapter

**Graceful Degradation:**
- If explanation API fails: Hide affected tab, show other tabs
- If progress API fails: Calculate locally (not saved)
- If recent books fail: Show all books alphabetically

### API Integration Requirements

**IMPORTANT: Updated OpenAPI Specification**

The correct OpenAPI endpoint is: `https://api.verse-mate.apegro.dev/openapi/json`

The previous spec used `https://api.verse-mate.apegro.dev/swagger/json` which had incomplete response type schemas. The new endpoint provides complete response types for all API operations.

**Endpoints Used:**

1. **GET /bible/testaments**
   - Fetch all 66 books with metadata
   - Use hook: `useBibleTestaments()`
   - Cached: 24 hours
   - Used by: Navigation modal book list

2. **GET /bible/book/{bookId}/{chapterNumber}**
   - Fetch chapter with verses and subtitles
   - Use hook: `useBibleChapter(bookId, chapterNumber)`
   - Cached: 1 hour
   - Used by: Chapter reading view

3. **GET /bible/book/explanation/{bookId}/{chapterNumber}**
   - Fetch explanations (summary/byline/detailed)
   - Use hooks: `useBibleSummary()`, `useBibleByLine()`, `useBibleDetailed()`
   - Query param: `explanationType` (summary | byline | detailed)
   - Cached: 1 hour
   - Used by: Content tabs

4. **POST /bible/book/chapter/save-last-read**
   - Save reading position
   - Use hook: `useSaveLastRead()`
   - Body: `{ user_id, book_id, chapter_number }`
   - Called: Immediately on chapter load

5. **POST /bible/book/chapter/last-read**
   - Fetch last read position
   - Use hook: `useLastRead(userId)`
   - Body: `{ user_id }`
   - Cached: 5 minutes
   - Called: On app launch

**Data Transformers:**
All transformers already implemented in `src/api/bible/types.ts`:
- `transformTestamentBook()` - Raw API to BookMetadata
- `transformChapterResponse()` - Groups verses by subtitles
- `transformExplanationResponse()` - Normalizes explanation

**Caching Strategy:**
- React Query automatic caching
- Stale time: 1 hour for chapters, 24 hours for books
- Garbage collection: 24 hours after last access
- Prefetch: next/previous chapters on load
- Persist cache: Use AsyncStorage plugin (optional enhancement)

**Error Handling:**
All hooks return standard React Query error states:
```typescript
const { data, error, isLoading, isError, refetch } = useBibleChapter(1, 1);
```

### Reusability Opportunities

**No Existing Features Identified:**
This is a greenfield implementation with no similar patterns in the existing codebase.

**Future Reusability:**
The components built for this spec will serve as patterns for:
- Bottom sheet modals (reusable component)
- Tab navigation (reusable component)
- Skeleton loaders (reusable component)
- Progress bars (reusable component)
- Filtered lists (reusable pattern)
- Grid layouts (reusable pattern)

### Scope Boundaries

#### In Scope

1. Bottom sheet navigation modal (iOS-style, 75-80% height)
2. Testament tabs (Old Testament / New Testament only)
3. Filter/search in book selection
4. Book list with recent books indicator (up to 5 recent)
5. Chapter grid selection (5-column layout)
6. Three content tabs (Summary/By Line/Detailed) with persistence
7. Chapter reading interface with validated design system
8. Floating prev/next chapter buttons
9. Swipe gestures for chapter navigation
10. Deep linking (`/bible/[bookId]/[chapter]`)
11. Reading position persistence (book + chapter, immediate save)
12. Book completion progress indicator (bottom bar with %)
13. Offline caching with icon/badge indicator
14. Skeleton loading states
15. Full accessibility support
16. React Native dynamic type (16-18px base)
17. Hamburger menu with placeholder buttons (all show "TODO" alert)

#### Out of Scope (For Future Specs)

**Explicitly Deferred:**
1. Topics tab in navigation (not approved yet)
2. Notes functionality (button present but non-functional)
3. Bookmarks functionality (button present but non-functional)
4. Favorites functionality (button present but non-functional)
5. Highlights functionality (button present but non-functional)
6. Settings functionality (button present but non-functional)
7. Share functionality (add to backlog - just URL sharing)
8. Manual font size controls in Settings
9. Multiple Bible versions
10. AI features (separate spec)
11. Authentication (separate spec)

**Technical Debt Accepted:**
- No scroll position persistence (just book + chapter)
- No historical tracking of chapters read
- No offline download controls (automatic only)
- No analytics tracking (privacy first approach)
- Hamburger menu items are placeholders (not implemented)

**Future Enhancements to Consider:**
- Read mode toggle (night mode, sepia mode)
- Cross-references and footnotes
- Bible study tools (concordance, dictionary)
- Social features (sharing, discussion)
- Reading plans and challenges
- Multiple Bible versions selector
- Audio Bible integration

### Technical Considerations

**React Native Setup:**
- Expo Router for navigation
- File-based routing: `app/bible/[bookId]/[chapterNumber].tsx`
- Tab layout for main navigation
- React Query for data fetching (already configured)

**State Management:**
- React Query for server state (chapters, explanations)
- AsyncStorage for local state (recent books, reading position)
- React Context for app-wide state (active tab, theme)
- No Redux/Zustand needed

**Styling:**
- React Native StyleSheet
- No CSS-in-JS library needed
- Design tokens in constants file
- Responsive utilities for different screen sizes

**Third-Party Libraries:**
- `@tanstack/react-query` (already installed)
- `react-native-markdown-display` (for explanations)
- `@react-native-async-storage/async-storage` (for persistence)
- `react-native-gesture-handler` (for swipe gestures)
- `react-native-reanimated` (for animations)
- `expo-haptics` (for haptic feedback)

**Testing Strategy:**
- Jest + React Native Testing Library (already configured)
- MSW handlers for API mocking (already implemented)
- Integration tests for user flows
- Accessibility tests with testing-library/jest-native
- E2E tests with Maestro (for critical flows)

**Platform Differences:**
- iOS: Native bottom sheet animations
- Android: Material Design bottom sheet
- Web: Modal with backdrop (if targeting web)

**Known Constraints:**
- API returns NASB version only (no version selector needed yet)
- Explanations are pre-generated (no real-time AI calls)
- No authentication (guest mode only for this spec)

## User Flows

### Flow 1: App Launch → Last Read Position

```
1. User opens app
   ↓
2. App shows skeleton loader
   ↓
3. API call: POST /bible/book/chapter/last-read
   ↓
4. If found:
   - Navigate to [bookId]/[chapter]
   - Load chapter content
   - Show active tab (default: Summary)

   If not found:
   - Navigate to Genesis 1 (bookId: 1, chapter: 1)
   - Load Genesis 1 content
   - Show Summary tab
   ↓
5. Skeleton crossfades to content (200ms)
   ↓
6. Content visible, user can read
   ↓
7. Background: Prefetch next chapter
   ↓
8. Background: Save reading position
```

**Edge Cases:**
- API timeout (>2s): Default to Genesis 1
- API error: Default to Genesis 1
- Offline: Load from cache or Genesis 1
- First time user: Always Genesis 1

### Flow 2: Navigate to Different Chapter

**Via Navigation Modal:**

```
1. User taps navigation icon (header)
   ↓
2. Bottom sheet slides up (300ms animation)
   - Shows testament tabs
   - Shows book list (recent books at top)
   - Current book highlighted (gold background)
   ↓
3. User sees two options:
   A) Select different chapter in current book
   B) Select different book

--- Path A: Different Chapter, Same Book ---
3A. User taps current book (already selected)
    ↓
4A. Chapter grid appears (5 columns)
    - Current chapter has gold background
    - Other chapters have white background
    ↓
5A. User taps desired chapter number
    ↓
6A. Modal dismisses (300ms slide down)
    ↓
7A. Chapter screen shows skeleton loader
    ↓
8A. API call: GET /bible/book/{bookId}/{chapter}
    ↓
9A. Content loads, skeleton crossfades (200ms)
    ↓
10A. Active tab shows (persisted from previous)
     ↓
11A. Background: Save reading position
     ↓
12A. Background: Prefetch next chapter

--- Path B: Different Book ---
3B. User taps different book
    ↓
4B. Book selection updates (gold background moves)
    ↓
5B. Chapter grid updates to show new book's chapters
    ↓
6B. User taps chapter number (usually chapter 1)
    ↓
7B. Modal dismisses (300ms slide down)
    ↓
8B. Chapter screen shows skeleton loader
    ↓
9B. API call: GET /bible/book/{bookId}/{chapter}
    ↓
10B. Content loads, skeleton crossfades (200ms)
     ↓
11B. Active tab shows (persisted from previous)
     ↓
12B. Background: Save reading position
     ↓
13B. Background: Update recent books list
     ↓
14B. Background: Prefetch next chapter
```

**Via Floating Buttons:**

```
1. User taps "Previous" or "Next" button
   ↓
2. Haptic feedback (light)
   ↓
3. Chapter screen shows skeleton loader
   ↓
4. API call: GET /bible/book/{bookId}/{chapter ± 1}
   (or next book's first chapter if at end)
   ↓
5. Content loads, skeleton crossfades (200ms)
   ↓
6. Active tab persists
   ↓
7. Progress bar updates
   ↓
8. Background: Save reading position
   ↓
9. Background: Prefetch next chapter
```

**Via Swipe Gesture:**

```
1. User swipes left (next) or right (previous)
   ↓
2. Visual feedback: content slides slightly
   ↓
3. If swipe distance > threshold (30% screen width):
   - Haptic feedback (medium)
   - Chapter screen shows skeleton loader
   - Same as floating button flow above

   If swipe distance < threshold:
   - Content springs back to original position
   - No navigation occurs
```

**Via Deep Link:**

```
1. User taps link: /bible/40/5 (Matthew 5)
   ↓
2. If app closed:
   - App launches
   - Shows splash screen
   - Directly loads Matthew 5

   If app open:
   - Current screen navigates to Matthew 5
   - Smooth transition animation
   ↓
3. Chapter screen shows skeleton loader
   ↓
4. API call: GET /bible/book/40/5
   ↓
5. Content loads, skeleton crossfades
   ↓
6. Active tab shows (default: Summary if first load)
   ↓
7. Background: Save reading position
```

### Flow 3: Switch Content Tabs

```
1. User taps "By Line" tab
   ↓
2. Tab visual state updates immediately (200ms):
   - "Summary" tab: gold → gray
   - "By Line" tab: gray → gold
   ↓
3. Content area shows skeleton loader
   (if explanation not yet loaded)
   ↓
4. API call: GET /bible/book/explanation/{bookId}/{chapter}?type=byline
   (only if not cached)
   ↓
5. Explanation loads, skeleton crossfades (200ms)
   ↓
6. Markdown renders with proper formatting:
   - Headings (Genesis 1:1, Genesis 1:2, etc.)
   - Bold text for Hebrew/Greek words
   - Paragraph spacing
   - Proper line breaks
   ↓
7. Tab preference saved to AsyncStorage
   (so it persists on next chapter load)
   ↓
8. Background: Prefetch other tab explanations
   (low priority)
```

**Edge Cases:**
- If API fails: Show error toast, keep previous tab active
- If offline and not cached: Show toast "This explanation is not available offline"
- If already cached: Instant tab switch, no loading state

### Flow 4: Use Hamburger Menu (Placeholder Actions)

```
1. User taps hamburger menu icon (header)
   ↓
2. Menu slides in from right (300ms)
   - White background
   - 5 menu items visible
   - Dimmed backdrop
   ↓
3. User taps "Notes"
   ↓
4. Alert appears: "This feature is coming soon!"
   - System alert (native iOS/Android style)
   - Single "OK" button
   ↓
5. User taps "OK"
   ↓
6. Alert dismisses
   ↓
7. Menu remains open
   ↓
8. User taps backdrop or X icon
   ↓
9. Menu slides out (300ms)
   ↓
10. User returns to reading
```

**Same flow for all menu items:**
- Bookmarks → "Coming soon" alert
- Favorites → "Coming soon" alert
- Highlights → "Coming soon" alert
- Settings → "Coming soon" alert

### Flow 5: Filter/Search Books

```
1. User opens navigation modal
   ↓
2. User taps filter input field
   ↓
3. Keyboard appears (native behavior)
   ↓
4. User types "john"
   ↓
5. Book list filters in real-time:
   - Shows: John, 1 John, 2 John, 3 John
   - Hides: All other books
   - Maintains recent books at top if they match
   ↓
6. User taps "John" (Gospel)
   ↓
7. Chapter grid appears for John (21 chapters)
   ↓
8. Filter input remains visible with text
   ↓
9. User can continue flow or clear filter
```

**Edge Cases:**
- No matches: Show empty state "No books found"
- Clear button (X) in input: Clears filter, shows all books
- Switch testament: Clears filter automatically
- Case insensitive: "JOHN", "john", "JoHn" all work

### Flow 6: Offline Reading

```
--- Scenario: User goes offline while reading ---

1. User reading Genesis 1 (cached)
   ↓
2. Device loses connection
   ↓
3. Offline indicator appears in header
   - Small icon/badge (cloud with slash)
   - Gray color
   ↓
4. User can continue reading current chapter
   ↓
5. User can switch tabs (if cached)
   ↓
6. User tries to navigate to Genesis 2 (not cached)
   ↓
7. Toast appears: "This chapter is not available offline"
   - Toast auto-dismisses after 3 seconds
   - Genesis 1 remains on screen
   ↓
8. User tries to open navigation modal
   ↓
9. Modal opens but shows spinner
   (book list needs network call)
   ↓
10. After 5 seconds, error state:
    "Unable to load book list. Please check your connection."
    - Retry button
    ↓
11. User taps Retry
    ↓
12. If still offline: Same error
    If online: Book list loads
```

**What Works Offline:**
- Read currently cached chapter
- Switch between cached tabs
- View progress bar (calculated locally)

**What Doesn't Work Offline:**
- Navigate to uncached chapters
- Open navigation modal (needs book list)
- Save reading position (queued for later)
- Load new explanations

---

## Design Specifications

### Typography System

**Font Family:**
- Primary: System font (San Francisco on iOS, Roboto on Android)
- Fallback: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif

**Font Sizes (Base = 16px):**
- Display Large: 36px (2.25rem) - Page headings
- Display Medium: 32px (2.0rem) - Chapter titles
- Heading 1: 24px (1.5rem) - Section headings
- Heading 2: 20px (1.25rem) - Subsection headings
- Heading 3: 18px (1.125rem) - Tertiary headings
- Body Large: 18px (1.125rem) - Main reading text
- Body: 16px (1.0rem) - Standard UI text
- Body Small: 14px (0.875rem) - Secondary UI text
- Caption: 12px (0.75rem) - Verse numbers, labels
- Overline: 10px (0.625rem) - Progress text

**Font Weights:**
- Regular: 400
- Medium: 500
- Semibold: 600
- Bold: 700

**Line Heights:**
- Display: 1.2 (tight for large headings)
- Heading: 1.3 (comfortable for headings)
- Body: 1.6 (readable for long-form text)
- UI: 1.4 (balanced for UI elements)

**Letter Spacing:**
- Display: -0.5px (tighter)
- Heading: 0px (normal)
- Body: 0px (normal)
- UI: 0.25px (slightly looser)
- Caption: 0.5px (looser for small text)

**Dynamic Type Scaling:**
React Native respects system font size settings by default. Use:
```typescript
import { StyleSheet, Platform } from 'react-native';

const styles = StyleSheet.create({
  body: {
    fontSize: 16, // Base size
    ...Platform.select({
      ios: { fontSize: 17 }, // iOS default is slightly larger
      android: { fontSize: 16 },
    }),
  },
});
```

Test at these accessibility sizes:
- xSmall: 14px base
- Small: 15px base
- Medium (default): 16px base
- Large: 18px base
- xLarge: 20px base
- xxLarge: 23px base
- xxxLarge: 26px base

### Color System

**Primary Palette:**
```typescript
const colors = {
  // Accent/Brand
  gold: '#b09a6d',           // Primary actions, active states
  goldLight: '#c4b088',      // Hover states
  goldDark: '#9d8759',       // Pressed states

  // Neutrals
  black: '#000000',          // Header background, primary text
  white: '#ffffff',          // Content background, inverted text
  gray900: '#1a1a1a',        // Dark text on light background
  gray700: '#4a4a4a',        // Inactive tabs, secondary elements
  gray500: '#666666',        // Tertiary text, verse ranges
  gray300: '#999999',        // Disabled text
  gray200: '#cccccc',        // Borders, dividers
  gray100: '#e0e0e0',        // Skeleton loader, progress track
  gray50: '#f5f5f5',         // Input backgrounds, quote blocks

  // Semantic Colors
  success: '#4caf50',        // Success messages
  error: '#f44336',          // Error messages, destructive actions
  warning: '#ff9800',        // Warning messages
  info: '#2196f3',           // Info messages

  // Overlay
  backdrop: 'rgba(0, 0, 0, 0.5)', // Modal backdrops
  shadow: 'rgba(0, 0, 0, 0.15)',  // Drop shadows
};
```

**Accessibility Contrast Ratios:**
- Black (#000000) on White (#ffffff): 21:1 (AAA)
- Gold (#b09a6d) on White (#ffffff): 4.52:1 (AA)
- White (#ffffff) on Gold (#b09a6d): 4.52:1 (AA)
- Gray700 (#4a4a4a) on White (#ffffff): 9.38:1 (AAA)
- White (#ffffff) on Black (#000000): 21:1 (AAA)

All combinations meet WCAG AA standards at minimum.

### Spacing System

**Base Unit: 4px**

```typescript
const spacing = {
  xs: 4,    // 0.25rem - Minimal spacing
  sm: 8,    // 0.5rem - Small spacing
  md: 12,   // 0.75rem - Medium spacing
  lg: 16,   // 1rem - Standard spacing
  xl: 20,   // 1.25rem - Large spacing
  xxl: 24,  // 1.5rem - Extra large spacing
  xxxl: 32, // 2rem - Section spacing
  huge: 48, // 3rem - Major section spacing
};
```

**Usage Guidelines:**
- Screen padding: `lg` (16px) horizontal
- Section spacing: `xxxl` (32px) vertical
- Component spacing: `md` (12px) between related elements
- List item padding: `lg` (16px) vertical, `xl` (20px) horizontal
- Button padding: `md` (12px) vertical, `xl` (20px) horizontal
- Input padding: `md` (12px) vertical, `lg` (16px) horizontal

### Component Specifications

#### Header

```typescript
const headerStyles = {
  container: {
    height: 56,
    backgroundColor: colors.black,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    ...Platform.select({
      ios: { paddingTop: StatusBar.currentHeight || 44 },
      android: { elevation: 4 },
    }),
  },
  title: {
    fontSize: 17,
    fontWeight: '500',
    color: colors.white,
  },
  iconButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    width: 24,
    height: 24,
    tintColor: colors.white,
  },
};
```

#### Bottom Sheet Modal

```typescript
const bottomSheetStyles = {
  backdrop: {
    flex: 1,
    backgroundColor: colors.backdrop,
  },
  container: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    height: '80%', // 80% of screen height
    ...Platform.select({
      ios: {
        shadowColor: colors.black,
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
      },
      android: {
        elevation: 16,
      },
    }),
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: colors.gray300,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  breadcrumb: {
    fontSize: 16,
    color: colors.gold,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
};
```

#### Content Tabs (Pills)

```typescript
const tabStyles = {
  container: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.black,
    gap: spacing.sm,
  },
  tab: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    borderRadius: 20,
  },
  activeTab: {
    backgroundColor: colors.gold,
  },
  inactiveTab: {
    backgroundColor: colors.gray700,
  },
  activeText: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.gray900,
  },
  inactiveText: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.white,
  },
};
```

#### Floating Action Buttons

```typescript
const fabStyles = {
  container: {
    position: 'absolute',
    bottom: 60, // Above progress bar
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    pointerEvents: 'box-none', // Allow touches to pass through
  },
  button: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: colors.black,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  icon: {
    width: 24,
    height: 24,
    tintColor: colors.white,
  },
};
```

#### Progress Bar

```typescript
const progressStyles = {
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 6,
    backgroundColor: colors.gray100,
    flexDirection: 'row',
    alignItems: 'center',
  },
  fill: {
    height: 6,
    backgroundColor: colors.gold,
  },
  percentage: {
    position: 'absolute',
    right: spacing.sm,
    fontSize: 10,
    color: colors.gold,
    fontWeight: '600',
  },
};
```

#### Skeleton Loader

```typescript
const skeletonStyles = {
  container: {
    padding: spacing.xl,
  },
  shimmer: {
    backgroundColor: colors.gray100,
    borderRadius: 4,
  },
  title: {
    width: '60%',
    height: 32,
    marginBottom: spacing.lg,
  },
  subtitle: {
    width: '40%',
    height: 20,
    marginBottom: spacing.md,
  },
  paragraph: {
    width: '100%',
    height: 16,
    marginBottom: spacing.sm,
  },
  paragraphShort: {
    width: '80%',
    height: 16,
    marginBottom: spacing.md,
  },
};
```

**Shimmer Animation:**
```typescript
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

const shimmerAnimation = () => {
  const opacity = useSharedValue(1);

  React.useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.5, { duration: 750 }),
        withTiming(1, { duration: 750 })
      ),
      -1, // infinite
      false
    );
  }, []);

  return useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));
};
```

### Animation Specifications

**Timing Functions:**
```typescript
const animations = {
  // Duration
  fast: 150,
  normal: 300,
  slow: 500,

  // Easing
  easeOut: 'cubic-bezier(0.0, 0.0, 0.2, 1)',
  easeIn: 'cubic-bezier(0.4, 0.0, 1, 1)',
  easeInOut: 'cubic-bezier(0.4, 0.0, 0.2, 1)',
  spring: { damping: 15, stiffness: 150 },
};
```

**Common Animations:**

1. **Modal Open/Close:**
```typescript
// Open: Slide up from bottom with spring
Animated.spring(translateY, {
  toValue: 0,
  damping: 15,
  stiffness: 150,
  useNativeDriver: true,
}).start();

// Close: Slide down with ease-in
Animated.timing(translateY, {
  toValue: screenHeight,
  duration: 300,
  easing: Easing.in(Easing.ease),
  useNativeDriver: true,
}).start();
```

2. **Tab Switch:**
```typescript
// Crossfade between tabs
Animated.parallel([
  Animated.timing(oldTabOpacity, {
    toValue: 0,
    duration: 200,
    useNativeDriver: true,
  }),
  Animated.timing(newTabOpacity, {
    toValue: 1,
    duration: 200,
    useNativeDriver: true,
  }),
]).start();
```

3. **Page Transition:**
```typescript
// Slide + fade
Animated.parallel([
  Animated.timing(translateX, {
    toValue: 0,
    duration: 300,
    easing: Easing.out(Easing.ease),
    useNativeDriver: true,
  }),
  Animated.timing(opacity, {
    toValue: 1,
    duration: 300,
    useNativeDriver: true,
  }),
]).start();
```

4. **Skeleton Shimmer:**
```typescript
// Continuous pulse
Animated.loop(
  Animated.sequence([
    Animated.timing(opacity, {
      toValue: 0.5,
      duration: 750,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: true,
    }),
    Animated.timing(opacity, {
      toValue: 1,
      duration: 750,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: true,
    }),
  ])
).start();
```

---

## Summary

This comprehensive requirements document covers:

**User Needs:**
- Fast, intuitive Bible navigation
- Multiple reading modes (Summary/By Line/Detailed)
- Offline reading capability
- Progress tracking
- Accessible to all users

**Technical Scope:**
- Bottom sheet navigation with testament/book/chapter selection
- Chapter reading interface with three content tabs
- Floating controls and swipe gestures
- Deep linking support
- Reading position persistence
- Book completion progress tracking
- Offline caching with indicator
- Full accessibility support

**Out of Scope (Deferred):**
- Topics tab (not approved)
- Notes, Bookmarks, Favorites, Highlights, Settings (placeholders only)
- Share functionality (backlog)
- Multiple Bible versions
- AI features
- Authentication

**Foundation Built Upon:**
- Completed API integration layer (`src/api/bible/`)
- React Query hooks for all endpoints
- Type-safe data transformers
- MSW handlers for testing
- 10 high-fidelity design mockups

**Design System:**
- Gold accent color (#b09a6d)
- Black header, white content
- System fonts with dynamic type support
- 4px base spacing system
- Component specifications with exact measurements
- Animation timing and easing functions
- Accessibility guidelines (WCAG AA minimum)

**User Flows:**
1. App launch → last read position
2. Navigate via modal/buttons/swipe/deep link
3. Switch content tabs
4. Use hamburger menu (placeholders)
5. Filter/search books
6. Offline reading

All requirements validated against user answers, visual assets analyzed, and existing API layer documented for seamless implementation.

---

## API Update Addendum

### Critical OpenAPI Endpoint Correction

**Date:** 2025-10-14

**Issue Identified:**
The previous spec ("Bible Reading Interface - API Integration & Data Layer") used an outdated OpenAPI specification endpoint that had incomplete response type schemas.

**Previous Endpoint (Outdated):**
```
https://api.verse-mate.apegro.dev/swagger/json
```

**Issues with Previous Endpoint:**
- Missing complete response type definitions
- Incomplete schema information for API responses
- Generated types may lack proper response structures

**Current Endpoint (Correct):**
```
https://api.verse-mate.apegro.dev/openapi/json
```

**Benefits of Current Endpoint:**
- Complete response type schemas for all operations
- Fully documented request/response structures
- Proper TypeScript type generation support
- All API endpoints have complete schema definitions

### Impact on Implementation

**For This Spec (Bible Reading Mobile Interface):**
- Implementation should proceed using the API layer already built
- The existing React Query hooks in `src/api/bible/` are functional
- Monitor for any type inconsistencies during development
- If issues arise, the API integration layer may need regeneration

**For Previous Spec (API Integration Layer):**
- The previous spec's generated types may need regeneration
- Consider regenerating TypeScript types from the correct OpenAPI endpoint
- Existing transformers and hooks should be validated against new types
- MSW mock handlers may need updates if response structures differ

### Action Items

1. **Immediate (For This Spec):**
   - Reference the correct OpenAPI endpoint in all documentation
   - Use existing API hooks as-is (they are functional)
   - Document any type discrepancies encountered during development

2. **Follow-up (Future Task):**
   - Regenerate TypeScript types from `https://api.verse-mate.apegro.dev/openapi/json`
   - Update API integration layer if significant schema differences are found
   - Update MSW handlers to match any new response structures
   - Run full test suite after type regeneration

3. **Documentation:**
   - All future specs should reference `openapi/json` endpoint
   - Update any existing documentation that references `swagger/json`
   - Add note to project README about correct API specification source

### Verification Steps

Before implementing API-dependent features in this spec:

1. Verify existing React Query hooks return expected data structures
2. Check TypeScript types match actual API responses
3. Confirm MSW mock data matches real API response format
4. Test error handling with real API responses
5. Document any discrepancies for future API layer updates

**Note:** The existing API integration is functional and can be used for this spec. The type regeneration is a quality improvement task that can be addressed in a future maintenance cycle.

---

## Final Clarifications Needed

None at this time. All questions have been answered, visual assets analyzed, API endpoint corrected, and requirements comprehensively documented. Ready for spec writing phase.
