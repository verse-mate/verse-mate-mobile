---
description: Create journey definition files for visual reference capture
---

# Journey Creation Guide

Create journey definition files to capture user flows from the VerseMate web app for visual reference during mobile development.

## Journey File Format

Journey files are TypeScript files that define a sequence of user actions. Create them manually in `.agent-os/references/journeys/{journey-name}/`.

### Basic Structure

```typescript
import type { Journey } from '../../scripts/visual-reference/types';

export const yourJourney: Journey = {
  name: 'your-journey-name',
  description: 'Brief description of the user journey',
  createdAt: '2025-10-05',
  baseUrl: 'https://app.versemate.org',
  steps: [
    // Array of journey steps
  ],
};
```

### Journey Step Format

Each step has the following properties:

```typescript
{
  name: string;              // Format: 'step-1-description'
  description: string;       // Human-readable description
  action?: 'navigate' | 'click' | 'type' | 'scroll';
  url?: string;             // For navigate action
  selector?: string;        // CSS selector for click/type/scroll
  value?: string;           // Text value for type action
  waitFor?: string;         // CSS selector to wait for
  screenshot: string;       // Screenshot filename
}
```

## Example: Bible Reading Journey

```typescript
import type { Journey } from '../../scripts/visual-reference/types';

export const bibleReadingFlow: Journey = {
  name: 'bible-reading-flow',
  description: 'User journey from Bible navigation to reading Genesis 1',
  createdAt: '2025-10-05',
  baseUrl: 'https://app.versemate.org',
  steps: [
    {
      name: 'step-1-navigate-bible',
      description: 'Navigate to Bible page',
      action: 'navigate',
      url: '/bible',
      waitFor: 'body',
      screenshot: 'step-1-navigate-bible.png',
    },
    {
      name: 'step-2-navigate-genesis',
      description: 'Navigate to Genesis chapter 1',
      action: 'navigate',
      url: '/bible/1/1',
      waitFor: 'body',
      screenshot: 'step-2-navigate-genesis.png',
    },
  ],
};
```

## Action Types

### Navigate
```typescript
{
  action: 'navigate',
  url: '/bible/1/1',
  waitFor: 'body',  // Wait for element after navigation
}
```

### Click
```typescript
{
  action: 'click',
  selector: '[data-testament="OT"]',  // CSS selector
  waitFor: '.book-accordion',          // Wait for result
}
```

### Type
```typescript
{
  action: 'type',
  selector: 'input[type="search"]',
  value: 'Genesis',
  waitFor: '.search-results',
}
```

### Scroll
```typescript
{
  action: 'scroll',
  selector: '.chapter-content',
  waitFor: '.chapter-content',
}
```

## Creating a Journey

1. **Create directory structure**:
   ```bash
   mkdir -p .agent-os/references/journeys/my-journey/screenshots
   ```

2. **Create TypeScript file**:
   Create `.agent-os/references/journeys/my-journey/my-journey.ts`

3. **Define your journey**:
   Use the format above to define navigation steps

4. **Run journey replay** (when implemented):
   ```bash
   npm run capture:journey -- --journey=my-journey
   ```

## File Organization

```
.agent-os/references/journeys/
  my-journey/
    my-journey.ts           # Journey definition
    screenshots/            # Step screenshots (generated on replay)
    reference.md           # Journey documentation (generated on replay)
```

## Tips

- Use descriptive step names with kebab-case
- Start step names with `step-{number}-`
- Use simple CSS selectors when possible
- Add `waitFor` to ensure page stability
- Keep journey focused on one user flow
- Test selectors in browser DevTools first

## Related Tools

- **Selector Finder**: `scripts/visual-reference/utils/selector-finder.ts`
- **Journey Generator**: `scripts/visual-reference/utils/generate-journey.ts`
- **Type Definitions**: `scripts/visual-reference/types/index.ts`
