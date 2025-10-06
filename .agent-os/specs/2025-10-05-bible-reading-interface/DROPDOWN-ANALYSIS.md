# Dropdown Structure Analysis

> Date: 2025-10-06
> Source: User-provided screenshot of opened book/chapter selector

## Screenshot Analysis

### Structure Discovered

```
┌─────────────────────────────────────────────────┐
│ Old Testament, Genesis, 18          [v]         │ ← Currently selected (tan/gold)
├─────────────────────────────────────────────────┤
│ Old Testament          │  New Testament         │ ← Testament Tabs
├─────────────────────────────────────────────────┤
│ Filter Books...                                 │ ← Search Input
├─────────────────────────────────────────────────┤
│ Genesis                              [✓]        │ ← Selected book (tan/gold bg)
├─────────────────────────────────────────────────┤
│  1    2    3    4    5                         │
│  6    7    8    9   10                         │ ← Chapter Grid
│ 11   12   13   14   15                         │   (5 columns)
│ 16   17  [18]  19   20                         │   Chapter 18 selected
│ 21   22   23   24   25                         │
│ 26   27   28   29   30                         │
├─────────────────────────────────────────────────┤
│ ████████████████████░░░░░░░░░░░░░░░░░   36%    │ ← Progress Bar
└─────────────────────────────────────────────────┘
```

### Component Breakdown

1. **Selector Button** (collapsed state)
   - Text: "Old Testament, Genesis, 18"
   - Color: Tan/gold (#b09a6d)
   - Icon: Chevron down (▼)

2. **Testament Tabs** (top of dropdown)
   - Two tabs: "Old Testament" | "New Testament"
   - Active tab: "Old Testament" (selected)
   - Inactive tab: "New Testament" (clickable)

3. **Search Input**
   - Placeholder: "Filter Books..."
   - Position: Below testament tabs
   - Allows filtering book list

4. **Book List** (scrollable)
   - Currently showing: Genesis (selected, checkmark)
   - Background: Tan/gold for selected book
   - Checkmark icon on right
   - Other books would scroll below

5. **Chapter Grid** (5-column layout)
   - Chapters 1-30 for Genesis (50 total, scrollable)
   - Active chapter: 18 (tan/gold background, rounded)
   - Inactive chapter: 6 (beige/light background)
   - Regular chapters: No background, just numbers
   - Layout: 5 columns, rows auto-flow

6. **Progress Bar** (bottom)
   - Shows: 36% (reading progress in Genesis?)
   - Color: Tan/gold for progress
   - Background: Light gray

## Design System Values

### Colors Observed

```typescript
const colors = {
  primary: '#b09a6d',           // Tan/gold (selector, selected items)
  selectedLight: '#d4c5a6',     // Light beige (chapter 6 bg)
  text: '#000000',              // Black text
  textMuted: '#8B7355',         // Tan text for "Old Testament, Genesis, 18"
  background: '#FFFFFF',        // White background
  progressBg: '#E5E5E5',        // Light gray progress bar background
};
```

### Typography

```typescript
const typography = {
  selectorText: {
    // "Old Testament, Genesis, 18"
    color: '#8B7355',  // Tan/muted
    fontSize: '16px',  // Estimated
  },
  tabText: {
    // "Old Testament" / "New Testament"
    fontSize: '16px',
    fontWeight: '400', // Regular
  },
  bookName: {
    // "Genesis"
    fontSize: '18px',
    fontWeight: '400',
    color: '#FFFFFF',  // White on tan background
  },
  chapterNumber: {
    // "1", "2", "18", etc.
    fontSize: '16px',
    fontWeight: '400',
    color: '#000000',  // Black
  },
};
```

### Layout Measurements

```typescript
const layout = {
  chapterGrid: {
    columns: 5,
    gap: '8px',              // Estimated
    itemSize: '48px',        // Estimated square buttons
    itemBorderRadius: '8px', // Rounded corners on selected
  },
  progressBar: {
    height: '4px',
    borderRadius: '2px',
  },
};
```

## Mobile Implementation Strategy

### Modal Structure

```typescript
<BottomSheet>
  <TestamentTabs>
    <Tab>Old Testament</Tab>
    <Tab>New Testament</Tab>
  </TestamentTabs>

  <SearchInput placeholder="Filter Books..." />

  <BookList>
    {books.map(book => (
      <BookItem
        selected={book.id === selectedBookId}
        onPress={() => setSelectedBook(book)}
      >
        {book.name}
        {selected && <CheckIcon />}
      </BookItem>
    ))}
  </BookList>

  <ChapterGrid columns={5}>
    {chapters.map(chapter => (
      <ChapterButton
        selected={chapter === selectedChapter}
        read={chapter <= readProgress}
        onPress={() => selectChapter(chapter)}
      >
        {chapter}
      </ChapterButton>
    ))}
  </ChapterGrid>

  <ProgressBar value={readProgress / totalChapters} />
</BottomSheet>
```

### Key Features to Implement

1. ✅ **Testament Tabs** - Two tabs (OT/NT) at top
2. ✅ **Search/Filter** - "Filter Books..." input
3. ✅ **Scrollable Book List** - With checkmark on selected
4. ✅ **5-Column Chapter Grid** - Matches web app exactly
5. ✅ **Progress Bar** - Shows % completion at bottom
6. ✅ **Chapter States**:
   - Selected (tan/gold background, rounded)
   - Read/in-progress (beige background)
   - Unread (no background)

### Interaction Flow

```
1. User taps "Genesis 18" button (selector)
2. Bottom sheet slides up from bottom
3. Shows current testament tab (OT)
4. Shows search input
5. Shows book list (Genesis selected with checkmark)
6. Shows chapter grid (chapter 18 highlighted)
7. User can:
   - Switch testament tabs
   - Search/filter books
   - Tap different book (updates chapter grid)
   - Tap chapter number (closes modal, navigates)
8. Modal closes, chapter loads
```

## Spec Validation

### ✅ Validated Assumptions

- Testament tabs exist (OT/NT)
- Search/filter functionality exists
- Chapter grid is 5 columns (not accordion)
- Progress tracking exists
- Tan/gold color (#b09a6d) is primary

### ❌ Invalid Assumptions

- Not a simple dropdown (it's a full modal/panel)
- Not hierarchical pages (all in one modal)
- Chapter selection is grid, not list

### ➕ New Discoveries

- Read progress indicator (beige chapters)
- Progress bar at bottom (36% completion)
- Checkmark on selected book
- Testament tabs are simple (not complex)

## Mobile-Specific Enhancements

### Keep from Web App
- 5-column chapter grid
- Testament tabs
- Search/filter input
- Progress bar
- Selected state highlighting

### Enhance for Mobile
- Use bottom sheet (better than dropdown on mobile)
- Larger touch targets (48px minimum)
- Haptic feedback on selections
- Swipe down to dismiss
- Scroll momentum for book list
- Search with keyboard shortcut support

## Updated Component Requirements

```typescript
// Core components needed
- <BookChapterSelector /> - Button that opens modal
- <SelectionModal /> - Bottom sheet container
  - <TestamentTabs /> - OT/NT switcher
  - <SearchInput /> - Filter books
  - <BookList /> - Scrollable book selection
    - <BookItem /> - Individual book with checkmark
  - <ChapterGrid /> - 5-column grid
    - <ChapterButton /> - Individual chapter
  - <ProgressBar /> - Reading progress indicator
```

## Questions Resolved

✅ Q7: Dropdown structure captured via screenshot
✅ Q8: Testament tabs confirmed (OT/NT)
✅ Chapter grid: 5 columns confirmed
✅ Search: "Filter Books..." confirmed
✅ Progress: Bar shows reading completion %

---

**Status**: Dropdown structure fully documented from screenshot
**Next**: Apply findings to updated spec and implementation plan
