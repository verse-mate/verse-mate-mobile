# Spec Tasks

These are the tasks to be completed for the spec detailed in @.agent-os/specs/2025-10-05-visual-reference-tooling/spec.md

> Created: 2025-10-05
> Status: Ready for Implementation

## Tasks

### 1. Playwright Setup and Configuration ✅

**Goal**: Install and configure Playwright with TypeScript support for web app automation

**Completion Criteria**: Playwright installed, config file created, Chromium browser ready, basic test script runs successfully

- [x] 1.1. Install Playwright dependencies (`@playwright/test`, `playwright`) and install Chromium browser
- [x] 1.2. Create `playwright.config.ts` with TypeScript configuration, custom timeouts, and viewport settings for desktop/tablet/mobile
- [x] 1.3. Set up TypeScript types for Playwright and configure tsconfig paths if needed
- [x] 1.4. Create basic smoke test script to verify Playwright can navigate to https://app.versemate.org/bible
- [x] 1.5. Add NPM scripts for running Playwright in headless and headed modes
- [x] 1.6. Configure gitignore entries for Playwright artifacts (test-results, playwright-report)
- [x] 1.7. Document Playwright setup in project README or tooling documentation
- [x] 1.8. Verify Playwright successfully captures screenshot of VerseMate homepage

### 2. Core Capture Utilities and Metadata Extraction ✅

**Goal**: Build foundational screenshot capture system with metadata extraction capabilities

**Completion Criteria**: Can capture multi-viewport screenshots and extract HTML/CSS metadata from any URL

- [x] 2.1. Write manual validation tests for metadata extraction accuracy (verify extracted styles match browser DevTools)
- [x] 2.2. Create `scripts/capture/utils/screenshot-capture.ts` with viewport configuration (desktop 1920x1080, tablet 768x1024, mobile 375x667)
- [x] 2.3. Implement full-page screenshot capture function with PNG quality settings and file naming convention
- [x] 2.4. Create `scripts/capture/utils/extract-metadata.ts` with HTML structure extraction using recursive tree traversal
- [x] 2.5. Implement CSS style extraction using `window.getComputedStyle()` for typography, colors, spacing, and layout
- [x] 2.6. Build design token extraction for CSS custom properties (colors, fonts, spacing, borders, shadows)
- [x] 2.7. Create `scripts/capture/utils/generate-reference.ts` to output metadata as JSON and formatted markdown
- [x] 2.8. Verify screenshot quality, metadata accuracy, and markdown formatting with manual spot-checks

### 3. Single Page Capture System and NPM Scripts ✅

**Goal**: Enable automated capture of individual pages with complete metadata and multi-viewport screenshots

**Completion Criteria**: `npm run capture:page` successfully captures any web app page with screenshots and metadata

- [x] 3.1. Write error handling tests for network failures, timeouts, and missing elements
- [x] 3.2. Create `scripts/capture/capture-page.ts` that accepts URL and name parameters
- [x] 3.3. Implement parallel viewport screenshot capture for performance optimization
- [x] 3.4. Integrate metadata extraction and reference markdown generation into page capture workflow
- [x] 3.5. Set up storage organization with `screenshots/`, `metadata/`, and `reference.md` structure
- [x] 3.6. Add NPM script `capture:page` with CLI argument parsing (--url, --name)
- [x] 3.7. Create `capture:responsive` script for multi-viewport automation of single pages
- [x] 3.8. Verify page capture works on Bible reader page (https://app.versemate.org/bible/1/1) and generates complete artifacts

### 4. Journey Recording System and Interactive Command ✅

**Goal**: Implement journey file generation system with validation and documentation

**Completion Criteria**: Journey files can be manually created with proper TypeScript structure and validation

- [x] 4.1. Write validation tests for journey file generation (verify TypeScript syntax and journey data structure)
- [x] 4.2. Define TypeScript interfaces for `JourneyStep` and `Journey` (already in types/index.ts)
- [x] 4.3. Create `scripts/visual-reference/utils/selector-finder.ts` for AI-assisted CSS selector identification
- [x] 4.4. Create `scripts/visual-reference/utils/generate-journey.ts` for TypeScript journey file generation
- [x] 4.5. Implement journey reference markdown generation with step documentation
- [x] 4.6. Create journey directory structure utilities
- [x] 4.7. Update `@.agent-os/commands/capture-journey.md` with manual journey creation guide
- [x] 4.8. Verify journey generation tests pass (8/8 passing)

### 5. Journey Replay, Example Captures, and Documentation ✅

**Goal**: Complete automation system with journey replay, example captures, and storage organization

**Completion Criteria**: Journey replay works, Bible reader example exists, documentation complete, storage properly configured

- [x] 5.1. Write replay validation tests to ensure saved journeys execute correctly (8 tests, 24 total across 3 viewports)
- [x] 5.2. Create `scripts/visual-reference/capture-journey-replay.ts` that imports and executes journey definition files
- [x] 5.3. Add NPM script `capture:journey` for replaying journeys (--journey parameter)
- [x] 5.4. Set up `.agent-os/references/` directory structure with `examples/` and `journeys/` subdirectories
- [x] 5.5. Configure gitignore to exclude all references except curated examples and journey definitions (already configured)
- [x] 5.6. Capture Bible reader page example at https://app.versemate.org/bible/1/1 and save to `.agent-os/references/examples/bible-reader/`
- [x] 5.7. Create basic user journey example (Bible navigation to Genesis 1) and save to `.agent-os/references/journeys/bible-reading-flow/`
- [x] 5.8. Verify all NPM scripts work, examples are complete, journey replay functions, and all tests pass (105/105 passing)
