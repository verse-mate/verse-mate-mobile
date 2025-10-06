# Spec Requirements Document

> Spec: Visual Reference Tooling for Web App Analysis
> Created: 2025-10-05

## Overview

Implement a Playwright-based visual reference system that captures screenshots, component structures, styles, and interaction patterns from the existing VerseMate web application (https://app.versemate.org). This tooling will enable AI to analyze and reference the web app during mobile development, ensuring 1:1 design consistency and accurate reverse-engineering of UI components.

## User Stories

### AI-Assisted Feature Development

As a developer working on a new mobile feature, I want AI to automatically reference visual snapshots and metadata from the corresponding web app page, so that I can maintain design consistency without manually describing the web interface.

When implementing a new feature (e.g., Bible reading interface), the developer can run a Playwright script to capture screenshots, HTML structure, computed styles, and interaction flows from the web app. These artifacts are stored in the feature's spec folder and automatically included in AI context during development.

### On-Demand Visual Analysis

As a developer, I want to capture specific pages or components from the web app on-demand, so that I can analyze design patterns and implementation details when needed.

The system provides CLI commands to capture individual pages, full user journeys, or specific component states. Screenshots are organized by feature/page with accompanying metadata files containing CSS styles, design tokens, component hierarchy, and responsive breakpoints.

### Design Consistency Validation

As a developer, I want to compare mobile implementations against web app references, so that I can ensure visual and functional parity across platforms.

The reference system captures multiple viewport sizes, interaction states (hover, focus, active), and loading/error states. This enables side-by-side comparison during mobile development and testing.

## Spec Scope

1. **Playwright Integration** - Add Playwright as development dependency with TypeScript configuration for web app scraping
2. **Screenshot Capture System** - Automated screenshot capture for full pages, specific components, and multiple viewport sizes (desktop, tablet, mobile)
3. **Metadata Extraction** - Extract HTML structure, computed CSS styles, design tokens (colors, fonts, spacing), and component hierarchy
4. **Interactive Journey Recording** - `/capture-journey` Claude command for step-by-step user flow capture with AI-assisted selector finding
5. **Journey File Generation** - Auto-generate TypeScript journey definition files that are replayable and version controlled
6. **CLI Scripts** - NPM scripts for automation: `npm run capture:page`, `npm run capture:journey --journey=<name>`, `npm run capture:component`
7. **Storage Organization** - Organized file structure with journeys and examples version controlled, other captures gitignored
8. **AI Context Integration** - Markdown templates and reference system for automatic context inclusion during feature development
9. **Example Implementation** - Capture main Bible reading page and basic user journey as proof-of-concept with full metadata

## Out of Scope

- Automated visual regression testing (focus is on reference/analysis, not testing)
- Continuous monitoring or automated updates when web app changes
- Interactive component exploration (static captures only)
- Performance analysis or accessibility auditing
- Authentication/login flow automation (captures will use public/guest views initially)

## Expected Deliverable

1. Developer can run `/capture-journey <name>` to interactively record user flows with AI-assisted element finding
2. Generated journey files are replayable via `npm run capture:journey --journey=<name>` for automated re-capture
3. All captures include screenshots (desktop/tablet/mobile), HTML structure, CSS styles, and design tokens in markdown format
4. Example capture of Bible reading page and basic user journey exist in `.agent-os/references/` with complete metadata for AI reference

## Spec Documentation

- Technical Specification: @.agent-os/specs/2025-10-05-visual-reference-tooling/sub-specs/technical-spec.md
- Claude Command: @.agent-os/commands/capture-journey.md
