# User Feedback on Discovery Findings

> Date: 2025-10-06
> Status: User Review Complete

## User Responses to Discovery Questions

### 1. Do discoveries align with product vision?
**Answer**: ✅ Yes

### 2. Should we implement mobile enhancements (URL routing, gestures)?
**Answer**: ✅ Yes, implement good URL routing and gestures

**CRITICAL NEW DISCOVERY from User**:
```
Web app DOES have routing, but via query parameters!
URL: https://app.versemate.org/?bookId=1&verseId=1&testament=OT
```

**This changes everything!** The web app has:
- Query parameter routing (not path-based)
- `bookId` parameter
- `verseId` parameter
- `testament` parameter (OT/NT)

**Mobile Decision**: Use path-based routing `/bible/[bookId]/[chapter]` instead of query params (cleaner mobile URLs)

### 3. Are you okay with three-tab requirement?
**Answer**: ✅ Yes, but with clarification:

> "The main content should be the bible content itself, but those other three tabs looks good ideas!"

**Interpretation**:
- **Primary focus**: Detailed tab (full Bible chapter text)
- **Secondary features**: Summary and By Line tabs (nice to have)
- **Default tab**: Should open to Detailed (Bible content)

### 4. Next/Previous Chapter Buttons Discovery

**User found the button!**
```html
<button type="button" class="content_nextChapterBtn__gc6_j content_hidden__IFv89">
  <svg width="24" height="24" viewBox="-1 0 24 24" fill="none">
    <path d="M8.01544 21.6537L6.59619 20.2344L14.8307 11.9999..."/>
  </svg>
</button>
```

**Key findings**:
- Button exists with class `content_nextChapterBtn__gc6_j`
- Has `content_hidden__IFv89` class (hidden by default)
- Appears **only on hover** (that's why it wasn't captured!)
- SVG chevron forward icon (right arrow)

**Mobile Implementation**:
- Keep prev/next buttons **always visible** on mobile (no hover)
- Use similar SVG icons
- Position as floating buttons or inline controls

## Updated Requirements

### Routing System

**Web App Pattern**:
```
https://app.versemate.org/?bookId=1&verseId=1&testament=OT
```

**Mobile Enhancement**:
```
/bible/[bookId]/[chapter]
/bible/1/1 (Genesis Chapter 1)
/bible/2/10 (Exodus Chapter 10)
/bible/40/5 (Matthew Chapter 5)
```

**Benefits of path-based routing**:
- Cleaner URLs for mobile
- Better for sharing (looks more professional)
- Easier deep linking
- SEO-friendly (if web view exists)
- Standard mobile app pattern

**Implementation**:
- Expo Router: `app/bible/[bookId]/[chapter].tsx`
- Parse bookId to determine testament (1-39=OT, 40-66=NT)
- Fetch verseId from AsyncStorage for last read position

### Navigation Controls

**Requirement**: Implement prev/next chapter buttons

**Web App**:
- Hidden by default (`.content_hidden__IFv89`)
- Appears on hover
- Chevron icons (SVG)
- Class: `content_nextChapterBtn__gc6_j`

**Mobile**:
- Always visible (no hover on mobile)
- Floating buttons or inline controls
- Use same chevron SVG icons
- Implement cross-book navigation
- Add haptic feedback on tap

### Content Tabs Priority

**Primary**: Detailed tab (Bible chapter text)
**Secondary**: Summary and By Line tabs

**Default behavior**:
- App opens to Detailed tab by default
- Tab state persisted per user preference
- Full Bible text is the main content

## Questions for Implementation

### Architecture Questions

1. **Testament Parameter**:
   - Web app uses `?testament=OT` in URL
   - Mobile: Derive from bookId (1-39=OT, 40-66=NT) or keep parameter?
   - **Recommendation**: Derive from bookId (simpler, one source of truth)

2. **Verse ID Parameter**:
   - Web app uses `?verseId=1`
   - Purpose: Scroll to specific verse? Highlight verse?
   - **Need to validate**: What does verseId do in the web app?

3. **Chapter Selection**:
   - How does dropdown show chapters? Grid? List? Inline?
   - **Action**: Need to capture dropdown opened state with manual screenshot

4. **Testament Tabs in Dropdown**:
   - Does dropdown have OT/NT tabs?
   - **Action**: Need to capture dropdown structure

5. **Cross-Book Navigation**:
   - Does next button on Genesis 50 go to Exodus 1?
   - **Action**: Test manually or capture journey with hover

### API Questions (Need Swagger Validation)

1. Do API endpoints use `bookId` or `book` parameter?
2. Do endpoints use `chapter` or `chapterNumber`?
3. Is there a `verseId` parameter for scrolling?
4. Are there separate endpoints for Summary/ByLine tabs?
5. How is testament determined? (Parameter or derived from bookId?)

### UI/UX Questions

1. **Floating Buttons Position**:
   - Bottom left/right corners?
   - Middle of screen sides?
   - Inside content area?

2. **Swipe Gestures**:
   - Left swipe = next chapter, right swipe = previous?
   - Or opposite direction?
   - Should swipe work on entire screen or just content area?

3. **Tab Bar Position**:
   - Top of screen (below header)?
   - Inside content area?
   - Sticky or scrolls with content?

## Next Steps (Prioritized)

### Immediate Actions

1. ✅ Document user feedback (this file)
2. ⏳ Capture dropdown opened state (manual screenshot or updated journey)
3. ⏳ Validate API endpoints in Swagger spec
4. ⏳ Update technical spec with corrections
5. ⏳ Update tasks.md with new requirements

### Implementation Plan Updates

**Phase 2 Changes**:
- Task 2.1: Generate React Query hooks from Swagger (validate endpoints first)
- Task 2.2: Confirm `bookId`, `verseId`, `testament` parameters in API
- Task 2.3: Add MSW handlers for all three tabs (Summary/ByLine/Detailed)

**Phase 3 Changes**:
- Add modal/bottom sheet for book/chapter selection
- Implement query parameter parsing (`?bookId=1&verseId=1&testament=OT`)
- Convert to path-based routing internally (`/bible/1/1`)

**Phase 5 Changes**:
- Implement prev/next buttons (always visible, not hover-only)
- Add swipe gestures for chapter navigation
- Add haptic feedback
- Implement cross-book navigation logic

## Decisions Made

✅ **Use path-based routing** (`/bible/[bookId]/[chapter]`) instead of query params
✅ **Implement gestures** for mobile UX enhancement
✅ **Keep three tabs** with Detailed as default
✅ **Always show prev/next buttons** (no hover required)
✅ **Derive testament from bookId** (1-39=OT, 40-66=NT)

## Decisions Needed

⏳ Floating button position (corners vs sides vs inline)
⏳ Swipe direction (left=next or left=previous)
⏳ Tab bar position (top vs content area)
⏳ Dropdown structure (needs capture)

---

**Status**: User feedback incorporated, ready to proceed with updates
**Next**: Capture dropdown state, validate Swagger, update spec
