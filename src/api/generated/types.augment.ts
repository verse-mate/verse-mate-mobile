/**
 * Type Augmentations for Generated API Types
 *
 * This file extends generated API types to include fields that exist in the backend
 * but are missing from the OpenAPI schema. These should be removed once the backend
 * OpenAPI schema is updated.
 *
 * TODO: Remove this file once backend updates OpenAPI schema to include insight_type
 * in bookmark response
 */

import type { GetBibleBookBookmarksByUserIdResponse } from './types.gen';

/**
 * Augmented Bookmark type that includes insight_type field
 * The backend supports this field but it's missing from the OpenAPI schema
 */
export type AugmentedBookmark = GetBibleBookBookmarksByUserIdResponse['favorites'][number] & {
  insight_type?: string;
};

/**
 * Augmented response type for bookmarks with insight_type support
 */
export type AugmentedBookmarksResponse = {
  favorites: AugmentedBookmark[];
};
