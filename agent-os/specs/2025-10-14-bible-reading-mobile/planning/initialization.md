# Initial Spec Idea

## User's Initial Description

Initialize a new spec for the Bible Reading Interface feature, incorporating learnings from the previous spec.

## Context from Previous Spec

The previous spec at `.agent-os/specs/2025-10-05-bible-reading-interface/` completed Phase 1 (Discovery) and Phase 2 (API Integration) with significant findings that changed the implementation approach.

## Key Discoveries to Incorporate

**Architecture Changes:**
- Web app uses homepage `/` as Bible reader (not `/bible`)
- Navigation is dropdown-based (NOT hierarchical screens)
- Three content tabs: Summary, By Line, Detailed
- Typography: MerriweatherItalic for all text (not Roboto Serif)
- Mobile will add URL routing as enhancement (not in web app)

**Completed Work (to build upon):**
- API Integration Layer: React Query hooks for testaments, books, chapters, explanations
- MSW handlers and mock data for testing
- Type-safe API client with Axios
- AsyncStorage hooks for reading position
- 13 integration tests (need debugging)

## Feature Description

**Bible Reading Interface - Mobile Implementation**

Implement a mobile-optimized Bible reading experience that:
- Provides dropdown-based navigation for testament/book/chapter selection
- Displays three content tabs (Summary, By Line, Detailed)
- Uses validated design system (MerriweatherItalic typography, color #212531)
- Adds mobile enhancements (URL routing, gestures, haptics)
- Builds on completed API integration layer

**Scope:**
1. Navigation UI (dropdown modal with testament tabs, book/chapter selection)
2. Chapter reading interface (three tab views with proper typography)
3. Mobile-specific features (swipe gestures, floating controls, preferences)
4. Deep linking (/bible/[bookId]/[chapter])
5. Reading position persistence

**Out of Scope:**
- AI feature integration (separate spec)
- Authentication (separate spec)
- Multiple Bible versions
- Offline downloads
- Social sharing

## Your Tasks

1. Create a new dated spec folder (format: YYYY-MM-DD-bible-reading-mobile or similar)
2. Create initial `idea.md` with the feature description above
3. Return the spec folder path so the spec-researcher can continue

**Important:** This is a restart based on validated discoveries. The new spec should reference learnings from `.agent-os/specs/2025-10-05-bible-reading-interface/DISCOVERY-FINDINGS.md` and build upon the completed API layer.

## Metadata
- Date Created: 2025-10-14
- Spec Name: bible-reading-mobile
- Spec Path: /Users/augustochaves/Work/verse-mate/verse-mate-mobile/agent-os/specs/2025-10-14-bible-reading-mobile
