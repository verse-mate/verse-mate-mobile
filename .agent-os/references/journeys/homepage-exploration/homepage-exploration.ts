import type { Journey } from '../../../scripts/visual-reference/types';

/**
 * Homepage Exploration Journey
 *
 * Demonstrates the basic user flow of landing on the VerseMate homepage.
 *
 * This journey captures the initial user experience when visiting the site.
 */
export const homepageExploration: Journey = {
  name: 'homepage-exploration',
  description: 'User journey exploring the VerseMate homepage',
  createdAt: '2025-10-05',
  baseUrl: 'https://app.versemate.org',
  steps: [
    {
      name: 'step-1-landing',
      description: 'Landing on homepage',
      action: 'navigate',
      url: '/',
      waitFor: 'body',
      screenshot: 'step-1-landing.png',
    },
  ],
};
