# Spec Tasks

These are the tasks to be completed for the spec detailed in @.agent-os/specs/2025-10-05-bible-reading-interface/spec.md

> Created: 2025-10-06
> Status: Ready for Implementation

## Tasks

This tasks list follows a discovery-first approach. Phase 1 (Discovery) must be completed before any implementation begins.

**CRITICAL**: Do not skip the discovery phase. All implementation tasks depend on validating assumptions against the real web app.

### Phase 1: Web App Discovery (Required First)

- [ ] 1. Capture and Analyze Web App Bible Reading Experience
  - [ ] 1.1 Create journey file for Bible navigation flow (testament → book → chapter selection)
  - [ ] 1.2 Capture journey screenshots and metadata using Visual Reference Tooling
  - [ ] 1.3 Create journey file for chapter reading and navigation (next/previous chapter)
  - [ ] 1.4 Capture chapter reading journey screenshots and metadata
  - [ ] 1.5 Extract real design system (colors, typography, spacing) from captured metadata
  - [ ] 1.6 Document actual navigation patterns discovered (tabs? accordion? search-first?)
  - [ ] 1.7 Document chapter display patterns (inline verses? subtitles? pagination?)
  - [ ] 1.8 Document loading states and error handling patterns observed
  - [ ] 1.9 Update technical spec with real patterns, mark differences from assumptions
  - [ ] 1.10 Create implementation plan based on validated web app patterns

### Phase 2: Implementation (After Discovery Complete)

- [ ] 2. API Integration and Data Layer
  - [ ] 2.1 Review Swagger spec (https://api.verse-mate.apegro.dev/swagger/json) and generate React Query hooks using @7nohe/openapi-react-query-codegen
  - [ ] 2.2 Write MSW handlers for Bible API endpoints using generated types
  - [ ] 2.3 Create mock data fixtures matching Swagger response schemas exactly
  - [ ] 2.4 Configure generated React Query hooks for testament/book data fetching
  - [ ] 2.5 Configure generated React Query hooks for chapter content fetching
  - [ ] 2.6 Add AsyncStorage persistence for reading position
  - [ ] 2.7 Write tests for API integration layer using generated hooks
  - [ ] 2.8 Verify all API integration tests pass

- [ ] 3. Navigation Components (Based on Discovered Patterns)
  - [ ] 3.1 Write tests for navigation components
  - [ ] 3.2 Implement testament selection UI (based on discovered pattern)
  - [ ] 3.3 Implement book selection UI (based on discovered pattern)
  - [ ] 3.4 Implement chapter selection UI (based on discovered pattern)
  - [ ] 3.5 Add search/filter functionality (if discovered in web app)
  - [ ] 3.6 Implement Expo Router navigation structure (/bible/[bookId]/[chapter])
  - [ ] 3.7 Add deep linking support
  - [ ] 3.8 Verify all navigation tests pass

- [ ] 4. Chapter Reading Interface (Based on Discovered Patterns)
  - [ ] 4.1 Write tests for chapter reader component
  - [ ] 4.2 Implement chapter display with discovered verse formatting pattern
  - [ ] 4.3 Implement subtitle integration (if discovered in web app)
  - [ ] 4.4 Apply validated typography and color system
  - [ ] 4.5 Add loading states matching discovered patterns
  - [ ] 4.6 Add error handling matching discovered patterns
  - [ ] 4.7 Implement reading position persistence
  - [ ] 4.8 Verify all chapter reader tests pass

- [ ] 5. Mobile-Specific Enhancements
  - [ ] 5.1 Write tests for gesture navigation
  - [ ] 5.2 Implement swipe gestures for chapter navigation (if not in web app)
  - [ ] 5.3 Implement floating navigation controls (if validated or planned as enhancement)
  - [ ] 5.4 Add cross-book navigation logic (if validated or planned as enhancement)
  - [ ] 5.5 Implement haptic feedback for interactions
  - [ ] 5.6 Add reading preferences (font size, theme)
  - [ ] 5.7 Create Maestro E2E test flows
  - [ ] 5.8 Verify all mobile enhancement tests pass
