# Specification: Fix Bible Reading Interface

## Goal

Separate Bible content reading from AI explanations into two distinct views with icon-based navigation. Currently, the interface incorrectly conflates these modes - tabs appear when reading pure scripture, and the navigation icon has the wrong behavior. This fix creates clear separation between "Bible reading mode" (scripture only) and "Explanations mode" (AI-powered tabs).

## User Stories

- As a reader, I want to read scripture without distractions (no tabs) so that I can focus on the Bible text alone
- As a reader, I want to click "Genesis 1" to open the chapter selector so the navigation is intuitive
- As a reader, I want to switch to Explanations view to see AI-powered insights organized by tabs (Summary/By Line/Detailed)
- As a reader, I want to see which view I'm in (Bible vs Explanations) so I know what content is being displayed
- As a reader, I want my selected explanation tab to persist when I change chapters so I don't have to re-select it each time

## Core Requirements

### View Modes

**Two Distinct Views:**
- **Bible Content View** - Shows scripture only, NO tabs visible
- **Explanations View** - Shows AI explanation content with tabs (Summary/By Line/Detailed)

**Default Behavior:**
- App opens in Bible Content View (scripture only)
- When switching to Explanations View for the first time, Summary tab is selected by default
- Selected tab persists across chapter changes and view switches

### View Switcher (Header Icons)

**Two Separate Icons (not a toggle button):**
- Icon 1: Book icon represents Bible Content View
- Icon 2: Book-open/Bible icon represents Explanations View
- Both icons displayed side by side in header
- Active view icon highlighted in gold color (#b09a6d)
- Inactive view icon in default/white color
- Clicking an icon switches to that view immediately

**Icon Positioning:**
- Located in header between "Genesis 1" text and hamburger menu
- Replaces current single book-outline icon

### Chapter Selector Trigger

**Current Behavior (INCORRECT):**
- Book-outline icon opens chapter selector

**New Behavior (CORRECT):**
- Clicking "Genesis 1" text opens chapter selector
- Add chevron icon (down arrow) next to "Genesis 1" text to indicate it's clickable
- Remove chapter selector behavior from book-outline icon (this icon will be replaced by view switcher icons)

### Tab Behavior

**Visibility:**
- Tabs ONLY visible in Explanations View
- Tabs hidden in Bible Content View
- ChapterContentTabs component conditionally rendered based on active view

**Persistence:**
- Selected tab persists when switching between views
- Selected tab persists when changing chapters
- Tab preference saved to AsyncStorage via existing useActiveTab hook

**Default Tab:**
- Summary tab selected by default when first switching to Explanations View
- If user has previously selected a different tab, that preference persists

### Content Display

**Bible Content View:**
- Shows ChapterReader component with chapter content only
- No explanation prop passed to ChapterReader
- Clean, distraction-free scripture reading

**Explanations View:**
- Shows ChapterContentTabs component
- Shows ChapterReader component with explanation content
- Active tab determines which explanation is passed to ChapterReader

## Visual Design

### Mockup References

- **Bible Content View**: `planning/visuals/bible-content.png`
  - Pure scripture text visible
  - No tabs below header
  - Book icon would be highlighted in gold
  - Clean reading experience

- **Explanations View**: `planning/visuals/explanation-view.png`
  - Tabs visible below header (Summary/By Line/Detailed)
  - Bible-open icon would be highlighted in gold
  - AI explanation content displayed

### Header Layout

```
┌─────────────────────────────────────────────┐
│  Genesis 1 ▼   [📖] [📖+] [☰]                │
│  ↑             ↑    ↑     ↑                  │
│  Chapter       Bible Explain Menu            │
│  Selector      View  View                    │
└─────────────────────────────────────────────┘
```

### Icon States

**Active Icon:**
- Background: none (icon itself colored)
- Icon color: Gold (#b09a6d - same as tabSpecs.active.backgroundColor)
- Size: 24px (same as current headerSpecs.iconSize)

**Inactive Icon:**
- Background: none
- Icon color: White (#ffffff)
- Size: 24px

### Chapter Selector Button

**Text + Chevron:**
- Text: "{bookName} {chapterNumber}" (e.g., "Genesis 1")
- Font size: 17px (headerSpecs.titleFontSize)
- Font weight: 500 (headerSpecs.titleFontWeight)
- Color: White
- Chevron: Ionicons "chevron-down" icon
- Chevron size: 16px
- Gap between text and chevron: 4px (spacing.xs)

### Colors

**From Design Tokens:**
- Active view icon: `colors.gold` (#b09a6d)
- Inactive view icon: `colors.white` (#ffffff)
- Header background: `colors.black` (#000000)
- Tab active background: `colors.gold` (#b09a6d)
- Tab inactive background: `colors.gray700` (#4a4a4a)

## Reusable Components

### Existing Code to Leverage

**Components:**
- `ChapterContentTabs` - Existing tab switcher component, already handles Summary/By Line/Detailed tabs
- `ChapterReader` - Existing chapter display component, already accepts optional explanation prop
- `BibleNavigationModal` - Existing chapter selector modal, just needs different trigger
- Header component in `app/bible/[bookId]/[chapterNumber].tsx` - Will be modified to add view switcher

**Hooks:**
- `useActiveTab` - Already persists selected tab to AsyncStorage, will continue to work as-is
- `useBibleChapter`, `useBibleSummary`, `useBibleByLine`, `useBibleDetailed` - API hooks remain unchanged

**Design Tokens:**
- `colors.gold` - For active icon state
- `colors.white` - For inactive icon state
- `headerSpecs` - For header sizing and padding
- `spacing` - For icon gaps and padding

**Patterns:**
- Icon button pattern from existing header (Pressable with Ionicons)
- Conditional rendering pattern from existing code
- State management via useState/AsyncStorage pattern

### New Components Required

**ViewModeSwitch Component** (optional, could be inline):
- New component to encapsulate the two-icon view switcher logic
- NOT required if logic is simple enough to inline in ChapterHeader
- Reason: Existing code shows header icons are simple Pressable + Ionicons, so inline approach is cleaner

**New State Required:**
- `activeView` state - tracks whether user is in 'bible' or 'explanations' view
- Should be local component state (useState) in ChapterScreen
- Does NOT need AsyncStorage persistence (defaults to 'bible' on each load)

## Technical Approach

### State Management

**New State Variable:**
```typescript
const [activeView, setActiveView] = useState<'bible' | 'explanations'>('bible');
```

**Why Local State:**
- View mode is session-based, not persistent across app restarts
- Default to Bible view on each chapter load
- Simpler than AsyncStorage for this use case

**Existing State (unchanged):**
- `activeTab` - Managed by useActiveTab hook, persists to AsyncStorage
- `isNavigationModalOpen` - Controls chapter selector visibility

### Component Modifications

**ChapterHeader Component:**
1. Add new "Genesis 1" clickable button with chevron
   - Wrap existing headerTitle Text in Pressable
   - Add Ionicons chevron-down next to text
   - onPress triggers onNavigationPress callback

2. Replace single book-outline icon with two-icon view switcher
   - Icon 1: Ionicons "book-outline" for Bible view
   - Icon 2: Ionicons "book-open-outline" for Explanations view
   - Each icon is a separate Pressable
   - Pass activeView prop to determine which icon is gold

3. Add new props to ChapterHeaderProps:
   - `activeView: 'bible' | 'explanations'`
   - `onViewChange: (view: 'bible' | 'explanations') => void`

**ChapterScreen Component:**
1. Add activeView state
2. Conditionally render ChapterContentTabs based on activeView
3. Conditionally pass explanation prop to ChapterReader based on activeView
4. Pass activeView and setActiveView to ChapterHeader

### Icon Selection

**Ionicons Names:**
- Bible view: `"book-outline"` - Simple book icon
- Explanations view: `"book-open-outline"` - Open book icon (suggests additional content)

**Alternative Options:**
- Could use `"book"` and `"book-open"` (filled versions) for stronger visual difference
- Could use `"library-outline"` for explanations (suggests knowledge/learning)
- Recommendation: Start with "book-outline" and "book-open-outline" for consistency

### Conditional Rendering Logic

**ChapterContentTabs:**
```typescript
{activeView === 'explanations' && (
  <ChapterContentTabs activeTab={activeTab} onTabChange={setActiveTab} />
)}
```

**ChapterReader explanation prop:**
```typescript
<ChapterReader
  chapter={chapter}
  activeTab={activeTab}
  explanation={
    activeView === 'explanations' && activeContent.data && 'content' in activeContent.data
      ? activeContent.data
      : undefined
  }
/>
```

### API Fetching Strategy

**No Changes to Data Fetching:**
- Continue fetching explanations on chapter load (same as current behavior)
- Control only what's displayed, not what's fetched
- This allows instant switching between views without loading delay

**Why:**
- Per requirements: "No backend changes needed - keep fetching as is, just control what's displayed in the UI"
- Better UX: switching views is instant, no loading spinner
- Data is already cached by React Query, so no performance penalty

## User Interaction Flows

### Flow 1: Reading Bible (Default)

1. User navigates to Genesis 1
2. Bible Content View is active (default)
3. Book icon is gold, book-open icon is white
4. No tabs visible
5. Only scripture content displayed
6. User reads distraction-free

### Flow 2: Switching to Explanations

1. User is in Bible Content View
2. User taps book-open icon (Explanations View)
3. Haptic feedback triggers
4. activeView changes to 'explanations'
5. Book-open icon turns gold, book icon turns white
6. Tabs appear below header
7. Summary tab is selected (default)
8. Summary explanation content displays below scripture

### Flow 3: Changing Tabs in Explanations View

1. User is in Explanations View with Summary tab active
2. User taps "By Line" tab
3. Tab haptic feedback triggers
4. Tab selection persists to AsyncStorage
5. By Line explanation content crossfades in
6. By Line tab shown with gold background
7. Summary and Detailed tabs shown with gray background

### Flow 4: Switching Back to Bible View

1. User is in Explanations View with Detailed tab active
2. User taps book icon (Bible View)
3. Haptic feedback triggers
4. activeView changes to 'bible'
5. Book icon turns gold, book-open icon turns white
6. Tabs disappear
7. Only scripture content displayed
8. Detailed tab selection is preserved (not lost)

### Flow 5: Changing Chapters with Tab Persistence

1. User is in Explanations View with By Line tab active
2. User taps "Genesis 1 ▼" to open chapter selector
3. Navigation modal opens
4. User selects Genesis 2
5. Modal closes, navigation to Genesis 2
6. By Line tab is still active (persisted via AsyncStorage)
7. By Line explanation for Genesis 2 loads and displays
8. User didn't have to re-select By Line tab

### Flow 6: Opening Chapter Selector

1. User taps "Genesis 1 ▼" text
2. Haptic feedback triggers
3. BibleNavigationModal opens
4. User browses books/chapters
5. User selects chapter
6. Modal closes, navigation occurs
7. View mode and tab selection persist

## Edge Cases and Error Handling

### Edge Case 1: First Time Loading Explanations View

**Scenario:** User has never used Explanations View, no tab preference saved
**Handling:**
- useActiveTab hook returns 'summary' as default
- Summary tab is selected
- Summary explanation loads
- Normal behavior, no error

### Edge Case 2: Explanation API Fails

**Scenario:** User switches to Explanations View but API call fails
**Handling:**
- Tabs still visible (user can see they're in Explanations View)
- ChapterReader shows error state (already implemented)
- View switcher still works, user can switch back to Bible View
- Error message displays: "Failed to load {activeTab} explanation"

### Edge Case 3: Rapid View Switching

**Scenario:** User rapidly taps back and forth between view icons
**Handling:**
- State updates immediately (useState is synchronous for view changes)
- No loading spinner needed (data already fetched)
- Haptic feedback on each tap
- Smooth, responsive experience

### Edge Case 4: Switching Views During Explanation Load

**Scenario:** User switches to Explanations View, then immediately back to Bible View while explanation is loading
**Handling:**
- Tabs appear briefly then disappear (expected behavior)
- Explanation fetch continues in background (React Query)
- Next time user switches to Explanations, data may be cached
- No error, graceful degradation

### Edge Case 5: Invalid Tab Preference in AsyncStorage

**Scenario:** AsyncStorage has corrupted or invalid tab value
**Handling:**
- useActiveTab hook validates with isContentTabType guard
- Falls back to 'summary' if invalid
- User sees Summary tab, no error
- Already handled by existing code

### Edge Case 6: Chapter Navigation Edge Cases

**Scenario:** User is on last chapter of book (e.g., Revelation 22)
**Handling:**
- Next button already shows error haptic (existing behavior)
- View mode and tab selection unchanged
- No new edge cases introduced

### Edge Case 7: Modal Open While Switching Views

**Scenario:** BibleNavigationModal is open, user switches view mode in background (unlikely but possible)
**Handling:**
- Modal state is independent from view mode state
- When modal closes and chapter navigates, view mode persists
- Normal behavior, no conflict

## Testing Requirements

### Unit Tests (Jest + React Native Testing Library)

**Test File:** `app/bible/__tests__/[chapterNumber].test.tsx`

1. **View Mode State Tests:**
   - Default view is 'bible'
   - Switching to 'explanations' updates state
   - Switching back to 'bible' updates state

2. **Conditional Rendering Tests:**
   - ChapterContentTabs NOT rendered in Bible view
   - ChapterContentTabs rendered in Explanations view
   - ChapterReader receives no explanation in Bible view
   - ChapterReader receives explanation in Explanations view

3. **Icon State Tests:**
   - Book icon has gold color when Bible view active
   - Book-open icon has white color when Bible view active
   - Book icon has white color when Explanations view active
   - Book-open icon has gold color when Explanations view active

4. **Chapter Selector Trigger Tests:**
   - Clicking "Genesis 1" text opens navigation modal
   - Chevron icon is present next to chapter text
   - onNavigationPress callback triggered

5. **Tab Persistence Tests:**
   - Tab selection persists when switching views
   - Tab selection persists when changing chapters
   - useActiveTab hook called correctly

**Test File:** `components/bible/__tests__/ChapterHeader.test.tsx` (new tests)

1. **View Switcher Icon Tests:**
   - Both view icons rendered
   - Clicking Bible icon calls onViewChange with 'bible'
   - Clicking Explanations icon calls onViewChange with 'explanations'
   - Active icon receives correct color prop
   - Inactive icon receives correct color prop

2. **Chapter Selector Button Tests:**
   - Text displays correct book name and chapter
   - Chevron icon rendered
   - Button triggers onNavigationPress
   - Accessibility labels correct

### E2E Tests (Maestro)

**Test File:** `.maestro/bible-view-switcher.yaml` (new flow)

1. **Basic View Switching:**
   - Launch app, navigate to Genesis 1
   - Verify tabs NOT visible (Bible view)
   - Tap Explanations icon
   - Verify tabs visible
   - Verify Summary tab selected
   - Tap Bible icon
   - Verify tabs NOT visible

2. **Tab Persistence Across Views:**
   - Switch to Explanations view
   - Tap "Detailed" tab
   - Switch to Bible view
   - Switch back to Explanations view
   - Verify "Detailed" tab still selected

3. **Tab Persistence Across Chapters:**
   - Switch to Explanations view
   - Tap "By Line" tab
   - Tap "Genesis 1" to open chapter selector
   - Select Genesis 2
   - Verify "By Line" tab still selected
   - Verify By Line content displayed

4. **Chapter Selector Trigger:**
   - Tap "Genesis 1" text
   - Verify navigation modal opens
   - Close modal
   - Verify view mode unchanged

### Manual Testing Checklist

- [ ] Default view is Bible (no tabs)
- [ ] Book icon is gold by default
- [ ] Tapping Explanations icon shows tabs
- [ ] Book-open icon turns gold in Explanations view
- [ ] Tapping Bible icon hides tabs
- [ ] Book icon turns gold in Bible view
- [ ] Summary tab is default when first switching to Explanations
- [ ] Selected tab persists when switching views
- [ ] Selected tab persists when changing chapters
- [ ] Clicking "Genesis 1" opens chapter selector
- [ ] Chevron appears next to chapter text
- [ ] All haptic feedback works correctly
- [ ] Icon states visually clear (gold vs white)
- [ ] No visual glitches during view switching
- [ ] Performance is smooth (no lag)

## Implementation Notes

### Files to Modify

1. **`app/bible/[bookId]/[chapterNumber].tsx`**
   - Add activeView state
   - Modify ChapterHeader component and props
   - Add view switcher icons
   - Make "Genesis 1" clickable with chevron
   - Conditionally render ChapterContentTabs
   - Conditionally pass explanation to ChapterReader

### Code References

**Existing Patterns to Follow:**

1. **Icon Buttons** (lines 434-465 in ChapterScreen):
   - Use Pressable wrapper
   - Ionicons with size from headerSpecs.iconSize
   - accessibility props (accessibilityLabel, accessibilityRole)
   - testID for testing

2. **Haptic Feedback:**
   - Import from `expo-haptics`
   - Use `Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)` for icon taps
   - Already used in ChapterContentTabs (line 65)

3. **Conditional Rendering:**
   - Use `{condition && <Component />}` pattern
   - Already used for FloatingActionButtons (lines 369-374)

4. **Color from Design Tokens:**
   - Import from `@/constants/bible-design-tokens`
   - Use `colors.gold` and `colors.white`
   - TypeScript ensures color keys are valid

### Implementation Order

1. **Phase 1: Add View State**
   - Add activeView state to ChapterScreen
   - Add console.log to verify state changes
   - Test state toggling with temporary button

2. **Phase 2: Modify ChapterHeader**
   - Add activeView and onViewChange props
   - Replace book-outline icon with two-icon switcher
   - Add click handlers with haptic feedback
   - Apply conditional gold coloring

3. **Phase 3: Make Chapter Text Clickable**
   - Wrap headerTitle in Pressable
   - Add chevron icon
   - Wire up to existing onNavigationPress

4. **Phase 4: Conditional Rendering**
   - Conditionally render ChapterContentTabs
   - Conditionally pass explanation to ChapterReader
   - Test both views display correctly

5. **Phase 5: Testing**
   - Write unit tests
   - Write E2E test flow
   - Manual testing on iOS and Android
   - Fix any visual or functional issues

### Accessibility Considerations

**WCAG Compliance:**
- Gold color (#b09a6d) has 4.52:1 contrast on white (WCAG AA compliant)
- Icon size 24px meets minimum touch target (44x44 with padding)

**Screen Readers:**
- Book icon: `accessibilityLabel="Bible reading view"`
- Book-open icon: `accessibilityLabel="Explanations view"`
- Chapter text button: `accessibilityLabel="Select chapter, currently {bookName} {chapterNumber}"`
- Use `accessibilityState={{ selected: true }}` for active view icon

**Haptic Feedback:**
- Light impact for view switching (non-disruptive)
- Consistent with existing tab switching feedback
- Helps users with visual impairments confirm actions

## Out of Scope

**Explicitly Excluded:**
- Backend/API changes - data fetching logic remains unchanged
- Animation/transition effects between views - instant switching is fine per requirements
- Changes to explanation content rendering - ChapterReader component unchanged
- Changes to tab content itself - Summary/By Line/Detailed content unchanged
- Redesign of chapter selector modal - BibleNavigationModal unchanged except for trigger
- Changes to ChapterReader component structure - only prop usage changes
- Mobile responsive behavior changes - maintain current responsive design
- Dark mode or theme changes - use existing design tokens
- Offline mode handling - existing OfflineIndicator unchanged
- Navigation gesture changes - swipe navigation unchanged
- Progress bar behavior - existing ProgressBar unchanged

## Success Criteria

**Functional:**
- [ ] Two view modes work correctly (Bible and Explanations)
- [ ] Tabs only appear in Explanations view
- [ ] Tabs hidden in Bible view
- [ ] View switcher icons work (Bible and Explanations icons)
- [ ] Active icon shows in gold, inactive in white
- [ ] Clicking "Genesis 1" opens chapter selector
- [ ] Chevron icon appears next to chapter text
- [ ] Selected tab persists across view switches
- [ ] Selected tab persists across chapter navigation
- [ ] Default view is Bible (scripture only)
- [ ] Default Explanations tab is Summary

**User Experience:**
- [ ] Clear visual distinction between views
- [ ] Smooth, instant view switching (no lag)
- [ ] Intuitive icon semantics (book vs book-open)
- [ ] Haptic feedback on all interactions
- [ ] No confusion about which view is active
- [ ] Chapter selector trigger is discoverable (chevron helps)

**Technical:**
- [ ] No console errors or warnings
- [ ] TypeScript types correct
- [ ] All unit tests pass
- [ ] All E2E tests pass
- [ ] Code follows existing patterns
- [ ] Accessibility labels present and correct
- [ ] Performance unchanged from current
