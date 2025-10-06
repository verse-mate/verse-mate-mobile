import type { Journey } from '../../../scripts/visual-reference/types';

/**
 * Bible Reading Flow Journey
 *
 * Demonstrates the user flow from navigating to the Bible page
 * to reading Genesis chapter 1.
 *
 * This journey captures the core reading experience:
 * 1. Landing on the Bible navigation page
 * 2. Navigating to Genesis chapter 1
 */
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
