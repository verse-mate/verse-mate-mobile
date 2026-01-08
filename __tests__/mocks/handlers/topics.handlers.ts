/**
 * MSW Handlers for Topics API Endpoints
 *
 * Provides mock handlers for topic-related API calls used in tests.
 */

import { HttpResponse, http } from 'msw';

const API_BASE_URL = 'http://localhost:4000';

/**
 * Mock topic data organized by category
 * Topics within each category are sorted by sort_order
 */
export const mockTopicsByCategory = {
  EVENT: [
    {
      topic_id: 'event-001',
      name: 'Creation',
      description: 'God creates the world',
      sort_order: 1,
    },
    { topic_id: 'event-002', name: 'The Fall', description: 'Adam and Eve sin', sort_order: 2 },
    { topic_id: 'event-003', name: 'The Flood', description: "Noah's flood", sort_order: 3 },
  ],
  PROPHECY: [
    {
      topic_id: 'prophecy-001',
      name: 'Messiah Promised',
      description: 'Promise of a savior',
      sort_order: 1,
    },
    { topic_id: 'prophecy-002', name: 'Virgin Birth', description: 'Isaiah 7:14', sort_order: 2 },
  ],
  PARABLE: [
    {
      topic_id: 'parable-001',
      name: 'Good Samaritan',
      description: 'Love your neighbor',
      sort_order: 1,
    },
    {
      topic_id: 'parable-002',
      name: 'Prodigal Son',
      description: 'The lost son returns',
      sort_order: 2,
    },
    {
      topic_id: 'parable-003',
      name: 'Mustard Seed',
      description: 'Faith like a mustard seed',
      sort_order: 3,
    },
  ],
  THEME: [
    { topic_id: 'theme-001', name: 'Faith', description: 'Trusting in God', sort_order: 1 },
    { topic_id: 'theme-002', name: 'Love', description: 'God is love', sort_order: 2 },
  ],
};

/**
 * Get all topics from all categories combined in order
 * Category order: EVENT, PROPHECY, PARABLE, THEME
 */
export function getAllMockTopics() {
  const categoryOrder = ['EVENT', 'PROPHECY', 'PARABLE', 'THEME'] as const;
  return categoryOrder.flatMap((category) =>
    mockTopicsByCategory[category].map((topic) => ({
      ...topic,
      category,
    }))
  );
}

/**
 * Topics search handler - returns topics for a specific category
 */
export const topicsHandlers = [
  http.get(`${API_BASE_URL}/topics/search`, ({ request }) => {
    const url = new URL(request.url);
    const category = url.searchParams.get('category');

    if (!category) {
      return HttpResponse.json({ error: 'Category is required' }, { status: 400 });
    }

    const topics = mockTopicsByCategory[category as keyof typeof mockTopicsByCategory] || [];

    return HttpResponse.json({ topics });
  }),
];

/**
 * Override handler for empty category response
 */
export function createEmptyCategoryHandler(category: string) {
  return http.get(`${API_BASE_URL}/topics/search`, ({ request }) => {
    const url = new URL(request.url);
    const reqCategory = url.searchParams.get('category');

    if (reqCategory === category) {
      return HttpResponse.json({ topics: [] });
    }

    // Fall through to default handler for other categories
    const topics = mockTopicsByCategory[reqCategory as keyof typeof mockTopicsByCategory] || [];
    return HttpResponse.json({ topics });
  });
}

/**
 * Override handler for error response
 */
export function createErrorHandler() {
  return http.get(`${API_BASE_URL}/topics/search`, () => {
    return HttpResponse.json({ error: 'Server error' }, { status: 500 });
  });
}
