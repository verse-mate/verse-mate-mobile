# Spec Requirements: Fix Bible Reading Interface

## Initial Description
The Bible reading interface currently has several UX issues that need to be fixed:

1. The book-outline icon in the header currently opens the chapter selector, but it should toggle between showing just the Bible text vs showing the explanation tabs
2. The chapter selector should be triggered by clicking on the "Genesis 1" text itself (with a chevron icon to indicate it's clickable)
3. The tabs (Summary, By Line, Detailed) should only be visible when in "explanation mode", not when just reading the Bible text
4. Need visual indication of which mode you're in (Bible reading vs Explanation viewing)

## Requirements Discussion

### First Round Questions

**Q1:** For the header icons, should we use a book icon for Bible-only view and a book-open/book-sparkles icon for explanations view? And should the active icon be highlighted in some way (like using the gold accent color)?
**Answer:** Yes to both - use different icons for each view, and highlight the active view icon in gold.

**Q2:** When you switch to explanation view, which tab should be shown by default - Summary, By Line, or Detailed? I'm thinking Summary makes sense as the default.
**Answer:** Summary tab should be the default.

**Q3:** Should the selected explanation tab persist when you change chapters? For example, if I'm viewing "By Line" explanations for Genesis 1, then navigate to Genesis 2, should it still show "By Line" tab or reset to Summary?
**Answer:** The selected tab should persist across chapter changes.

**Q4:** For the "Genesis 1" text with chevron - should we add the chevron next to the text, or would you prefer a dropdown-style button wrapper around the whole thing?
**Answer:** Add the chevron next to the "Genesis 1" text to indicate it's clickable.

**Q5:** Currently the explanation content comes from the API response. When in Bible-only view, do we still need to fetch explanations in the background, or should we only fetch them when the user switches to explanation view?
**Answer:** No backend changes needed - keep fetching as is, just control what's displayed in the UI.

**Q6:** Should there be any transition/animation when switching between Bible view and Explanation view, or just an instant switch?
**Answer:** Just an instant switch is fine.

**Q7:** Is there anything else that should be explicitly excluded from this work? For example, changes to the explanation content itself, the chapter selector UI design, or any backend API modifications?
**Answer:** No backend/API changes. Focus only on the UI switching logic and icon states.

### Existing Code to Reference

**Similar Features Identified:**
- Tab switching logic: TabSwitcher component and similar patterns in existing codebase
- Icon state management: Existing color scheme and theming system
- Chapter selector: Already implemented, just needs to be triggered differently

### Follow-up Questions

**Follow-up 1:** I found visual assets (bible-content.png and explanation-view.png) in the visuals folder. Looking at these, I want to confirm: the book icon and Bible/book-open icon are two DIFFERENT view mode buttons, not a single toggle that changes icon, correct? Each icon represents and activates its respective view?
**Answer:** Correct - they are TWO DIFFERENT icons, each representing a different view. NOT a toggle that changes icon.

**Follow-up 2:** Based on the visuals, when the book icon (Bible view) is active, it shows in gold and the scripture content is displayed without tabs. When the Bible/book-open icon (Explanations view) is active, it shows in gold and the tabs appear. Is this the correct interpretation?
**Answer:** Yes, exactly correct. Gold = active view, and tabs only appear in Explanations view.

**Follow-up 3:** From the visual clarification - to be crystal clear: the header will have BOTH icons visible at the same time (side by side), with one highlighted in gold to show which view is active. Users click on one icon or the other to switch views. Is this correct?
**Answer:** Yes, both icons visible side by side, gold indicates active view.

**Follow-up 4:** Final clarification on icon behavior: Book icon = Bible content view (scripture only, no tabs). Bible/book-open icon = Explanations view (shows tabs with Summary/By Line/Detailed). The active icon shows in gold, inactive shows in default/white. Default view is Bible content (scripture only). Is this all correct?
**Answer:**
- NOT a toggle button - each icon is a DIFFERENT VIEW
- Book icon = Bible content view (shows scripture only, no tabs)
- Bible/book-open icon = Explanations view (shows tabs with AI content)
- Need to show which view is currently active
- This is a view switcher with 2 separate icons, not a single toggle
- Add chevron to "Genesis 1" text to indicate it's clickable
- Use gold color when view icon is active
- Inactive icons use default/white color
- Summary tab is default when switching to Explanations view

## Visual Assets

### Files Provided:
- `bible-content.png`: Shows Bible content view with pure scripture text, no tabs visible, book icon would be active
- `explanation-view.png`: Shows Explanations view with tabs (Summary/By Line/Detailed) visible, book-open icon would be active

### Visual Insights:
- Two distinct view modes clearly shown in mockups
- Bible content view: Clean, distraction-free scripture reading
- Explanations view: Tab interface for AI-powered explanations
- Visual differentiation is clear and intentional
- Icons represent view states, not a toggle button
- Fidelity level: High-fidelity mockups showing exact intended UI

## Requirements Summary

### Functional Requirements
- **Two View Modes:**
  - Bible Content View: Shows scripture only, no tabs
  - Explanations View: Shows scripture with tabs (Summary, By Line, Detailed)

- **Header Icons (View Switcher):**
  - Two separate icons displayed side by side
  - Icon 1: Book icon for Bible content view
  - Icon 2: Book-open/Bible icon for Explanations view
  - Active view icon highlighted in gold color
  - Inactive icon in default/white color
  - Clicking an icon switches to that view

- **Chapter Selector:**
  - Remove chapter selector functionality from book-outline icon
  - Add chevron icon next to "Genesis 1" text
  - Make "Genesis 1" text clickable to open chapter selector

- **Tab Behavior:**
  - Tabs only visible in Explanations view
  - Summary tab is default when switching to Explanations view (if no tab previously selected)
  - Selected tab persists when changing chapters
  - Selected tab persists when switching between views

- **Default State:**
  - App opens in Bible Content View (scripture only)
  - No tabs visible on initial load

### Reusability Opportunities
- Existing TabSwitcher component for tab switching logic
- Current theming system for gold accent color on active icons
- Existing chapter selector component (just needs different trigger)
- Current explanation fetching logic (no changes needed)

### Scope Boundaries
**In Scope:**
- Implement two-icon view switcher in header
- Add active/inactive icon states (gold vs default/white)
- Move chapter selector trigger from icon to "Genesis 1" text
- Add chevron to "Genesis 1" text
- Conditionally show/hide tabs based on active view
- Implement view mode state management
- Persist selected tab across chapter changes
- Set default view to Bible Content
- Set default explanation tab to Summary

**Out of Scope:**
- Backend/API changes (no changes to data fetching)
- Changes to explanation content itself
- Redesign of chapter selector UI
- Changes to tab content rendering
- Animation/transition effects (instant switching is fine)
- Changes to scripture text rendering
- Mobile responsive behavior changes (maintain current responsive design)

### Technical Considerations
- Use existing theming system for gold accent color
- Leverage current state management patterns
- No API endpoint modifications needed
- Tab persistence requires local state management (context or component state)
- View mode state needs to be accessible to header and content components
- Icon components should accept active/inactive state prop
- Maintain current explanation fetching behavior (fetch on load, control display only)
