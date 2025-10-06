---
description: Interactive web app journey capture for visual reference
---

# Capture Journey Command

Interactively capture a user journey from the VerseMate web app (https://app.versemate.org) with step-by-step screenshots, metadata, and auto-generated journey definition files.

## Usage

```bash
/capture-journey <journey-name>
```

**Example:**
```bash
/capture-journey bible-reading-flow
```

## What This Command Does

1. **Launches Playwright** in headed mode (visible browser) pointing to https://app.versemate.org
2. **Prompts you step-by-step** for user actions to perform
3. **Captures screenshots** after each step (all viewports: desktop, tablet, mobile)
4. **Extracts metadata** (HTML structure, CSS styles, design tokens) at each step
5. **Generates TypeScript journey file** with all steps for replay
6. **Creates reference markdown** with embedded screenshots and documentation
7. **Saves everything** to `.agent-os/references/journeys/{journey-name}/`

## Interactive Flow

```
/capture-journey bible-reading-flow

> I'll help you create a journey capture for the VerseMate web app.
> Opening browser at https://app.versemate.org...
>
> Starting URL (path): /bible
> Description for this step: Main Bible navigation page
>
> ✓ Navigated to /bible
> ✓ Step 1 captured: step-1-landing
>
> What's next?
> 1. Click an element
> 2. Navigate to URL
> 3. Type text into input
> 4. Scroll to element
> 5. Done (finish journey)
>
> Your choice: 1
>
> Describe the element to click (e.g., "Old Testament tab", "Genesis book"):
> Old Testament tab
>
> Let me find that element...
> Found selector: [data-testament="OT"]
>
> Confirm this is correct? (y/n): y
>
> ✓ Clicked [data-testament="OT"]
> ✓ Step 2 captured: step-2-select-old-testament
>
> What's next?
> ...
>
> Choice: 5 (Done)
>
> ✓ Journey complete!
>
> Generated files:
> - .agent-os/references/journeys/bible-reading-flow/bible-reading-flow.ts
> - .agent-os/references/journeys/bible-reading-flow/reference.md
> - .agent-os/references/journeys/bible-reading-flow/screenshots/ (6 screenshots)
>
> To replay this journey later:
> npm run capture:journey -- --journey=bible-reading-flow
```

## Action Types

### 1. Click an Element
- You describe the element in natural language
- AI finds the best CSS selector
- Confirms with you before clicking
- Waits for page changes/animations to complete
- Captures screenshot of result

### 2. Navigate to URL
- Provide the path (e.g., `/bible/1/1`)
- Navigates to full URL (https://app.versemate.org + path)
- Waits for page load
- Captures screenshot

### 3. Type Text
- You describe the input field
- AI finds the selector
- You provide the text to type
- Types with realistic delay
- Captures result

### 4. Scroll to Element
- You describe what to scroll to
- AI finds the element
- Scrolls it into view
- Captures screenshot

### 5. Done
- Finishes the journey
- Generates all files
- Shows summary

## Generated Files

```
.agent-os/references/journeys/{journey-name}/
  {journey-name}.ts          # TypeScript journey definition (replayable)
  reference.md               # Markdown documentation with screenshots
  screenshots/
    step-1-landing_desktop.png
    step-1-landing_tablet.png
    step-1-landing_mobile.png
    step-2-select-testament_desktop.png
    ...
  metadata/
    step-1-landing.json      # HTML structure, styles, tokens
    step-2-select-testament.json
    ...
```

## Journey File Example

The generated `.ts` file can be replayed programmatically:

```typescript
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
    }
  ]
};
```

## Use Cases

### Capturing Bible Reading Flow
```bash
/capture-journey bible-reading-flow
# Steps: Navigate to /bible → Select OT → Expand Genesis → Click Chapter 1
```

### Capturing AI Explanation Flow
```bash
/capture-journey ai-explanation-flow
# Steps: Open chapter → Request AI summary → View explanation → Ask follow-up
```

### Capturing Navigation Patterns
```bash
/capture-journey chapter-navigation
# Steps: Read chapter → Swipe next → Cross-book navigation → Return home
```

## Tips

1. **Browser stays open** during the entire capture - you can see what's happening
2. **AI suggests selectors** - you just describe elements in plain language
3. **Multiple viewports** - every step captures desktop, tablet, and mobile views
4. **Metadata extracted** - HTML, CSS, and design tokens saved automatically
5. **Replayable** - the generated `.ts` file can replay the exact journey later

## Implementation Requirements

This command requires the Visual Reference Tooling spec to be implemented:
- Playwright installed and configured
- Capture scripts implemented (capture-journey-interactive.ts)
- Selector finder utility (selector-finder.ts)
- Metadata extraction utilities

See: @.agent-os/specs/2025-10-05-visual-reference-tooling/spec.md
