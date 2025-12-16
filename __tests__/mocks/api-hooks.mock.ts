/**
 * Default mock configuration for @/src/api hooks
 *
 * Usage in test files:
 * ```typescript
 * jest.mock('@/src/api', () => require('../../mocks/api-hooks.mock').apiHooksMock);
 * ```
 *
 * Then customize in beforeEach:
 * ```typescript
 * import { useBibleChapter } from '@/src/api';
 * beforeEach(() => {
 *   (useBibleChapter as jest.Mock).mockReturnValue({ data: mockData, isLoading: false });
 * });
 * ```
 */

export const apiHooksMock = {
  // Bible content hooks
  useBibleChapter: jest.fn(() => ({
    data: undefined,
    isLoading: false,
    error: null,
  })),
  useBibleTestaments: jest.fn(() => ({
    data: [],
    isLoading: false,
    error: null,
  })),
  useBibleBooks: jest.fn(() => ({
    data: [],
    isLoading: false,
    error: null,
  })),

  // Explanation hooks
  useBibleSummary: jest.fn(() => ({
    data: undefined,
    isLoading: false,
    error: null,
  })),
  useBibleByLine: jest.fn(() => ({
    data: undefined,
    isLoading: false,
    error: null,
  })),
  useBibleDetailed: jest.fn(() => ({
    data: undefined,
    isLoading: false,
    error: null,
  })),
  useBibleExplanation: jest.fn(() => ({
    data: undefined,
    isLoading: false,
    error: null,
  })),

  // Prefetch hooks
  usePrefetchNextChapter: jest.fn(() => jest.fn()),
  usePrefetchPreviousChapter: jest.fn(() => jest.fn()),

  // Last read hooks
  useSaveLastRead: jest.fn(() => ({
    mutate: jest.fn(),
    mutateAsync: jest.fn(),
  })),
  useLastRead: jest.fn(() => ({
    data: null,
    isLoading: false,
    error: null,
  })),

  // Bookmarks hooks
  useBookmarks: jest.fn(() => ({
    data: [],
    isLoading: false,
    error: null,
  })),
  useAddBookmark: jest.fn(() => ({
    mutate: jest.fn(),
    mutateAsync: jest.fn(),
  })),
  useRemoveBookmark: jest.fn(() => ({
    mutate: jest.fn(),
    mutateAsync: jest.fn(),
  })),

  // Notes hooks
  useNotes: jest.fn(() => ({
    data: [],
    isLoading: false,
    error: null,
  })),
  useAddNote: jest.fn(() => ({
    mutate: jest.fn(),
    mutateAsync: jest.fn(),
  })),
  useUpdateNote: jest.fn(() => ({
    mutate: jest.fn(),
    mutateAsync: jest.fn(),
  })),
  useRemoveNote: jest.fn(() => ({
    mutate: jest.fn(),
    mutateAsync: jest.fn(),
  })),

  // Highlights hooks
  useHighlights: jest.fn(() => ({
    data: [],
    isLoading: false,
    error: null,
  })),
  useChapterHighlights: jest.fn(() => ({
    data: [],
    isLoading: false,
    error: null,
  })),
  useAddHighlight: jest.fn(() => ({
    mutate: jest.fn(),
    mutateAsync: jest.fn(),
  })),
  useUpdateHighlight: jest.fn(() => ({
    mutate: jest.fn(),
    mutateAsync: jest.fn(),
  })),
  useRemoveHighlight: jest.fn(() => ({
    mutate: jest.fn(),
    mutateAsync: jest.fn(),
  })),

  // Topics hooks
  useTopicsCategories: jest.fn(() => ({
    data: [],
    isLoading: false,
    error: null,
  })),
  useTopicsSearch: jest.fn(() => ({
    data: [],
    isLoading: false,
    error: null,
  })),
  useTopicById: jest.fn(() => ({
    data: undefined,
    isLoading: false,
    error: null,
  })),
  useTopicReferences: jest.fn(() => ({
    data: undefined,
    isLoading: false,
    error: null,
  })),
  useTopicExplanation: jest.fn(() => ({
    data: undefined,
    isLoading: false,
    error: null,
  })),
};

// Default export for use in jest.mock factory
export default apiHooksMock;
