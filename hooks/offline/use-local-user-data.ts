/**
 * Local User Data Hooks
 *
 * Hooks for reading user notes, highlights, and bookmarks from local SQLite storage
 */

import { useQuery } from '@tanstack/react-query';
import {
  getLocalAllHighlights,
  getLocalAllNotes,
  getLocalBookmarks,
  getLocalHighlights,
  getLocalNotes,
  isUserDataDownloaded,
} from '@/services/offline';

export function useIsUserDataLocal() {
  return useQuery({
    queryKey: ['local-user-data-available'],
    queryFn: () => isUserDataDownloaded(),
    staleTime: 1000 * 60 * 5,
  });
}

export function useLocalNotes(bookId?: number, chapterNumber?: number, enabled = true) {
  return useQuery({
    queryKey: ['local-notes', bookId, chapterNumber],
    queryFn: () => getLocalNotes(bookId, chapterNumber),
    enabled,
    staleTime: Number.POSITIVE_INFINITY,
  });
}

export function useLocalAllNotes(enabled = true) {
  return useQuery({
    queryKey: ['local-all-notes'],
    queryFn: () => getLocalAllNotes(),
    enabled,
    staleTime: Number.POSITIVE_INFINITY,
  });
}

export function useLocalHighlights(bookId?: number, chapterNumber?: number, enabled = true) {
  return useQuery({
    queryKey: ['local-highlights', bookId, chapterNumber],
    queryFn: () => getLocalHighlights(bookId, chapterNumber),
    enabled,
    staleTime: Number.POSITIVE_INFINITY,
  });
}

export function useLocalAllHighlights(enabled = true) {
  return useQuery({
    queryKey: ['local-all-highlights'],
    queryFn: () => getLocalAllHighlights(),
    enabled,
    staleTime: Number.POSITIVE_INFINITY,
  });
}

export function useLocalBookmarks(enabled = true) {
  return useQuery({
    queryKey: ['local-bookmarks'],
    queryFn: () => getLocalBookmarks(),
    enabled,
    staleTime: Number.POSITIVE_INFINITY,
  });
}
