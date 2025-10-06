# Technical Specification

This is the technical specification for the spec detailed in @.agent-os/specs/2025-10-05-visual-reference-tooling/spec.md

> Created: 2025-10-05
> Updated: 2025-10-05
> Version: 1.1.0

## Related Documentation

- Claude Command: @.agent-os/commands/capture-journey.md - Interactive journey recording interface

## Technical Requirements

### Playwright Setup
- **Installation**: Add `@playwright/test` and `playwright` as dev dependencies
- **Browser Configuration**: Chromium browser for consistent rendering (matches most users)
- **TypeScript Support**: Playwright config with TypeScript for type-safe scripts
- **Headless Mode**: Run in headless mode for CI/automation, headed mode optional for debugging
- **Configuration File**: `playwright.config.ts` in project root with custom timeout and viewport settings

### Screenshot Capture System

#### Viewport Configurations
- **Desktop**: 1920x1080 (primary reference)
- **Tablet**: 768x1024 (iPad reference)
- **Mobile**: 375x667 (iPhone SE reference, matches common mobile sizes)

#### Screenshot Options
- **Full Page**: Capture entire scrollable page content
- **Specific Elements**: Selector-based capture for individual components
- **Multiple States**: Capture hover, focus, active, loading, error states
- **Format**: PNG with high quality (90+) for clarity
- **File Naming**: `{page-name}_{viewport}_{state}.png` (e.g., `bible-reader_desktop_default.png`)

### Metadata Extraction

#### HTML Structure Export
```typescript
interface HTMLStructure {
  tag: string;
  classes: string[];
  id?: string;
  attributes: Record<string, string>;
  children: HTMLStructure[];
  textContent?: string;
}
```
- Capture semantic HTML structure (main, section, article, nav, etc.)
- Include data attributes relevant to component state
- Export as JSON for programmatic analysis
- Generate markdown tree view for human readability

#### CSS Style Extraction
```typescript
interface ComputedStyles {
  selector: string;
  styles: {
    typography: {
      fontFamily: string;
      fontSize: string;
      fontWeight: string;
      lineHeight: string;
      letterSpacing: string;
    };
    colors: {
      color: string;
      backgroundColor: string;
      borderColor?: string;
    };
    spacing: {
      margin: string;
      padding: string;
    };
    layout: {
      display: string;
      position: string;
      width: string;
      height: string;
    };
  };
}
```
- Use `window.getComputedStyle()` for accurate rendered styles
- Extract design tokens (CSS custom properties/variables)
- Capture responsive breakpoint values
- Export as JSON and formatted markdown

#### Design Token Extraction
- **Colors**: Extract all CSS color variables (--dust, --fantasy, --night, etc.)
- **Typography**: Font families, sizes, weights from computed styles
- **Spacing**: Margin, padding, gap values with semantic meaning
- **Borders**: Border radius, width, color patterns
- **Shadows**: Box shadow and text shadow values
- **Output Format**: Design tokens JSON and markdown table

### CLI Command System

#### Claude Code Slash Commands

**`/capture-journey <journey-name>`** - Interactive journey recording
- Launches Playwright in headed mode for visual feedback
- Prompts step-by-step for actions (click, navigate, type, scroll)
- AI helps identify CSS selectors based on element descriptions
- Captures screenshots after each step
- Auto-generates journey TypeScript file
- Creates consolidated reference markdown
- Saves to `.agent-os/references/journeys/{journey-name}/`

**Interactive Flow Example:**
```
/capture-journey bible-reading-flow

> I'll help you create a journey capture for the VerseMate web app.
>
> Starting URL: /bible
> Step 1 captured ✓
>
> What's next?
> 1. Click an element
> 2. Navigate to URL
> 3. Type text
> 4. Scroll to element
> 5. Done (finish journey)
>
> Your choice: 1
> Describe the element to click: Old Testament tab
>
> I found: [data-testament="OT"]
> Confirm? (y/n): y
>
> Step 2 captured ✓
> ...
>
> Journey complete! Saved to:
> .agent-os/references/journeys/bible-reading-flow.ts
```

#### NPM Scripts (for automation/replay)

```bash
# Capture single page
npm run capture:page -- --url=/bible/1/1 --name=bible-reader

# Replay saved journey (non-interactive)
npm run capture:journey -- --journey=bible-reading-flow

# Capture specific component
npm run capture:component -- --url=/bible/1/1 --selector=".chapter-content" --name=chapter-content

# Capture all viewports
npm run capture:responsive -- --url=/bible/1/1 --name=bible-reader
```

#### Script Implementation
- **capture-page.ts**: Single page capture with all metadata
- **capture-journey-interactive.ts**: Interactive journey recording with AI prompting
- **capture-journey-replay.ts**: Replay pre-defined journey files
- **capture-component.ts**: Selector-based component extraction
- **extract-metadata.ts**: Shared metadata extraction utilities
- **generate-reference.ts**: Create markdown documentation from captures
- **selector-finder.ts**: AI-assisted CSS selector identification

### Storage Organization

#### Directory Structure
```
.agent-os/
  references/
    examples/           # Example captures (version controlled)
      bible-reader/
        screenshots/
        metadata/
        reference.md

    journeys/           # Journey definition files (version controlled)
      bible-reading-flow/
        bible-reading-flow.ts    # Journey definition
        screenshots/             # Step-by-step screenshots
          step-1-landing.png
          step-2-select-testament.png
          step-3-expand-book.png
        reference.md             # Journey documentation

.gitignore additions:
  .agent-os/references/*
  !.agent-os/references/examples/
  !.agent-os/references/journeys/

Feature-specific references (when needed):
.agent-os/specs/{spec-name}/references/
  screenshots/
  metadata/
  reference.md
```

#### File Organization Per Capture
```
{capture-name}/
  screenshots/
    desktop_default.png
    tablet_default.png
    mobile_default.png
    desktop_hover.png      # (optional, for interactive states)
    desktop_loading.png    # (optional, for loading states)
  metadata/
    html-structure.json
    html-structure.md
    computed-styles.json
    design-tokens.json
    design-tokens.md
  reference.md            # Consolidated markdown with all info + images
```

#### Journey File Format
```typescript
// Auto-generated by /capture-journey command
export interface JourneyStep {
  name: string;                    // step-1-landing
  description: string;             // "Main Bible navigation page"
  action?: 'click' | 'navigate' | 'type' | 'scroll';
  url?: string;                    // For navigate action
  selector?: string;               // For click/type/scroll actions
  value?: string;                  // For type action
  waitFor?: string;                // Selector to wait for after action
  screenshot: string;              // Relative path to screenshot
}

export interface Journey {
  name: string;                    // bible-reading-flow
  description: string;
  createdAt: string;               // ISO date
  baseUrl: string;                 // https://app.versemate.org
  steps: JourneyStep[];
}

// Example: bible-reading-flow.ts
export const bibleReadingFlow: Journey = {
  name: 'bible-reading-flow',
  description: 'User journey from Bible navigation to reading Genesis 1',
  createdAt: '2025-10-05',
  baseUrl: 'https://app.versemate.org',
  steps: [
    {
      name: 'step-1-landing',
      description: 'Main Bible navigation page',
      action: 'navigate',
      url: '/bible',
      waitFor: '.testament-tabs',
      screenshot: 'step-1-landing.png'
    },
    {
      name: 'step-2-select-testament',
      description: 'Click Old Testament tab',
      action: 'click',
      selector: '[data-testament="OT"]',
      waitFor: '.book-accordion',
      screenshot: 'step-2-select-testament.png'
    },
    // ... more steps
  ]
};
```

### AI Context Integration

#### Reference Markdown Template
```markdown
# Visual Reference: {Page Name}

> Captured: {date}
> Source: https://app.versemate.org{path}

## Screenshots

### Desktop (1920x1080)
![Desktop view](./screenshots/desktop_default.png)

### Tablet (768x1024)
![Tablet view](./screenshots/tablet_default.png)

### Mobile (375x667)
![Mobile view](./screenshots/mobile_default.png)

## Design Tokens

| Token | Value | Usage |
|-------|-------|-------|
| --dust | #b09a6d | Primary accent color |
| ... | ... | ... |

## Typography System

- **Headings**: {font-family}, {size}, {weight}
- **Body**: {font-family}, {size}, {weight}
- **Captions**: {font-family}, {size}, {weight}

## Component Structure

{tree view of HTML structure}

## Key Styles

{extracted computed styles for main elements}

## Interaction Patterns

{description of interactive elements, gestures, animations}

## Mobile Considerations

{responsive behavior, breakpoints, mobile-specific patterns}
```

#### Automated Context Inclusion
- Add reference to spec's technical-spec.md when captures exist
- Include markdown references in feature implementation prompts
- Store path references in spec metadata for AI lookup

### Example Implementation

#### Scope: Bible Reader Main Page
Capture the main Bible reading interface at https://app.versemate.org/bible/1/1 (Genesis 1, chapter 1) with:

1. **Full page screenshots** (desktop, tablet, mobile)
2. **HTML structure** of main reading container
3. **Typography system** (MerriweatherItalic titles, Roboto Serif body)
4. **Color palette** (--dust, --fantasy, --night, --oslo-gray, --border)
5. **Layout structure** (navigation, chapter content, verse formatting)
6. **Component hierarchy** (testament tabs, book accordion, chapter display)

Output location: `.agent-os/references/examples/bible-reader/`

### Testing Integration

Since this is development tooling (not production code), testing focuses on:

- **Manual Validation**: Verify screenshot quality and completeness
- **Metadata Accuracy**: Spot-check extracted styles against browser DevTools
- **Script Reliability**: Test capture scripts on multiple pages/states
- **Documentation Quality**: Ensure generated markdown is readable and useful

No unit tests required for capture scripts, but should include:
- Error handling for network failures
- Timeout handling for slow-loading pages
- Validation that expected elements exist before capture

### Performance Considerations

- **Parallel Captures**: Run multiple viewport captures in parallel
- **Caching Strategy**: Browser context reuse for journey captures
- **File Size**: Optimize PNG compression for storage efficiency
- **Gitignore**: Exclude all captures except curated examples to avoid repo bloat

## External Dependencies

### Needs Installation

**@playwright/test** - End-to-end testing framework with browser automation
- Justification: Industry-standard tool for browser automation with excellent TypeScript support and built-in screenshot capabilities
- Installation: `bun add -d @playwright/test`

**playwright** - Browser binaries and automation library
- Justification: Required for Playwright test runner to function
- Installation: `npx playwright install chromium` (after @playwright/test installation)

### Additional Tooling

**sharp** (optional) - High-performance image processing
- Justification: For optimizing PNG compression and generating thumbnails if needed
- Installation: `bun add -d sharp`
- Status: Optional, add only if image optimization becomes necessary
