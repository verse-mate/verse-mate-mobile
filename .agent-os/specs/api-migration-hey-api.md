# API Migration to @hey-api/openapi-ts v0.85.0

**Status:** Planned
**Priority:** Medium
**Estimated Effort:** 4-6 hours
**Date Created:** 2025-11-08
**Related Issue:** Recently Viewed Books Feature Implementation

## Executive Summary

This specification outlines the migration from the current custom React Query hooks pattern to the new `@hey-api/openapi-ts` v0.85.0 generated code structure. The migration was initially triggered during the recently-viewed books feature implementation but was deferred to maintain project velocity.

**Key Change:** The new generator version **removes** the `hooks.ts` file entirely and generates only low-level query options functions in `@tanstack/react-query.gen.ts`. All custom hook wrappers must be manually maintained.

## Background

### What Triggered This

On 2025-11-08, while implementing the recently-viewed books feature, we ran `bun generate:api` to fetch new backend endpoints. This regenerated ALL API code with new patterns from @hey-api/openapi-ts v0.85.0, causing ~80 type errors across the codebase.

### Decision Made

- **Option A (Full Migration):** Migrate entire codebase to new patterns (chosen initially, then reverted)
- **Option B (Surgical Approach):** Revert generated files, manually add only recently-viewed hooks ✅ **CHOSEN**
- **Result:** Recently-viewed feature shipped using Option B, full migration deferred to this spec

## Current State Analysis

### Generated Files Structure

#### Before Regeneration (Current - Committed)
```
src/api/generated/
├── @tanstack/react-query.gen.ts  # Generated query key functions
├── client.gen.ts                  # API client config
├── sdk.gen.ts                     # Raw SDK methods
├── types.gen.ts                   # TypeScript types
├── hooks.ts                       # ✅ CUSTOM: React Query hook wrappers (manually maintained)
└── index.ts                       # ✅ CUSTOM: Exports + compatibility layer
```

#### After Regeneration (New Pattern)
```
src/api/generated/
├── @tanstack/react-query.gen.ts  # Generated query options + query key functions
├── client.gen.ts                  # API client config
├── sdk.gen.ts                     # Raw SDK methods
├── types.gen.ts                   # TypeScript types
├── hooks.ts                       # ❌ DELETED by generator
└── index.ts                       # ⚠️ OVERWRITTEN (loses custom exports)
```

### Hook Usage Across Codebase

**Total Impact:** 38 files (18 source files + 20 test files)

#### Breakdown by Hook Type

| Category | Hooks | Files Affected | Complexity |
|----------|-------|----------------|------------|
| Bible Chapter | 7 hooks | 10 files | High - Custom transformations |
| Reading Position | 2 hooks | 2 files | Medium - POST-as-query pattern |
| Bookmarks | 3 hooks | 5 files | High - Optimistic updates |
| Notes | 3 hooks | 4 files | High - Full CRUD |
| Highlights | 3 hooks | 4 files | Very High - Dual queries, complex optimistic updates |
| Topics | 5 hooks | 5 files | Medium - Data extraction |
| **TOTAL** | **23 hooks** | **38 files** | **Average: High** |

### Most Critical Hooks (by usage frequency)

1. **useBibleChapter** - 3 files (core reading functionality)
2. **useBibleTestaments** - 4 files (navigation + metadata)
3. **useTopicsSearch** - 3 files (topic browsing)
4. **usePrefetchNextChapter/Previous** - 2 files (performance optimization)
5. **Custom wrappers** (useBookmarks, useNotes, useHighlights) - 9 files total

## Migration Strategy

### Phase 1: Preparation (30 minutes)

#### 1.1 Create Migration Branch
```bash
git checkout -b feature/api-migration-hey-api-v0.85
```

#### 1.2 Backup Current Custom Files
```bash
# These files will be deleted/overwritten by regeneration
cp src/api/generated/hooks.ts src/api/generated/hooks.ts.backup
cp src/api/generated/index.ts src/api/generated/index.ts.backup
```

#### 1.3 Document Current Hook Signatures
Create `migration-hooks-inventory.md` listing all hook signatures for reference:
```typescript
// Example format
useBibleChapter(bookId: number, chapterNumber: number, version?: string): {
  data: ChapterContent | null;
  isLoading: boolean;
  // ... rest of react-query return
}
```

### Phase 2: Regenerate API Code (5 minutes)

```bash
# Download latest OpenAPI schema
curl https://api.verse-mate.apegro.dev/openapi/json -o openapi.json

# Regenerate with new patterns
bun generate:api
```

**Expected Result:**
- `hooks.ts` will be deleted
- `index.ts` will be overwritten with minimal exports
- All other generated files updated

### Phase 3: Recreate Custom Hooks Layer (2-3 hours)

#### 3.1 Restore `hooks.ts` Structure
Create a NEW `src/api/generated/hooks.ts` (not auto-generated):

```typescript
// Custom React Query hooks wrapping the generated options
import { useEffect } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import {
  transformTestamentsToBooks,
  transformChapterResponse,
  transformExplanationResponse,
  // ... other transformations
} from '../bible/types';

// Import all Options types from generated files
import type { GetBibleTestamentsData, /* ... all types */ } from './types.gen';
import type { Options } from './sdk.gen';

// Import generated query options functions
import {
  getBibleTestamentsOptions,
  getBibleBooksOptions,
  // ... all generated options functions
} from './@tanstack/react-query.gen';

// Re-implement all custom hooks using the new generated options
```

#### 3.2 Hook Implementation Strategy

**Pattern A: Simple Query Wrapper** (e.g., `useBibleBooks`)
```typescript
// OLD (deleted by generator):
export const useBibleBooks = (options?: Options<GetBibleBooksData>) =>
  useQuery(getBibleBooksOptions(options));

// NEW (manually maintained):
export const useBibleBooks = (options?: Options<GetBibleBooksData>) => {
  return useQuery(getBibleBooksOptions(options));
};
```

**Pattern B: Query with Data Transformation** (e.g., `useBibleChapter`)
```typescript
// OLD:
export const useBibleChapter = (bookId: number, chapterNumber: number, version?: string) => {
  const query = useQuery({
    ...getBibleBookByBookIdByChapterNumberOptions({
      path: { bookId: String(bookId), chapterNumber: String(chapterNumber) },
      query: version ? { versionKey: version } : undefined,
    }),
    enabled: bookId > 0 && chapterNumber > 0,
  });

  return {
    ...query,
    data: query.data && 'book' in query.data ? transformChapterResponse(query.data as any) : null,
  };
};

// NEW (same implementation, manually maintained):
// No changes needed - just needs to be manually recreated
```

**Pattern C: Mutation with Custom Interface** (e.g., `useSaveLastRead`)
```typescript
// OLD:
export const useSaveLastRead = () => {
  const mutation = useMutation(postBibleBookChapterSaveLastReadMutation());

  return {
    ...mutation,
    mutate: (params: { user_id: string; book_id: number; chapter_number: number }) => {
      mutation.mutate({ body: params as any });
    },
  };
};

// NEW (same implementation):
// No changes needed - manually recreate
```

**Pattern D: POST-as-Query** (e.g., `useLastRead`)
```typescript
// OLD:
export const useLastRead = (userId: string) => {
  const mutation = useMutation(postBibleBookChapterLastReadMutation());

  useEffect(() => {
    if (userId) {
      mutation.mutate({ body: { user_id: userId } as any });
    }
  }, [userId]);

  return {
    data: mutation.data && 'result' in mutation.data ? mutation.data.result : {},
    isPending: mutation.isPending,
    // ... rest
  };
};

// NEW (same implementation):
// No changes needed - manually recreate
```

#### 3.3 Hook Checklist (All 23 Hooks)

Bible Chapter Hooks:
- [ ] `useBibleTestaments` - Pattern B (with transformation)
- [ ] `useBibleBooks` - Pattern A (simple wrapper)
- [ ] `useBibleChapter` - Pattern B (with transformation)
- [ ] `useBibleChapterExplanation` - Pattern B (internal, not exported)
- [ ] `useBibleSummary` - Pattern B (with transformation)
- [ ] `useBibleByLine` - Pattern B (with transformation)
- [ ] `useBibleDetailed` - Pattern B (with transformation)
- [ ] `useBibleChapterContent` - Pattern B (with transformation)
- [ ] `useBibleExplanation` - Pattern B (with transformation, internal)
- [ ] `usePrefetchNextChapter` - Pattern D (custom effect + return function)
- [ ] `usePrefetchPreviousChapter` - Pattern D (custom effect + return function)
- [ ] `useBibleChapterId` - Pattern A (simple wrapper)

Reading Position Hooks:
- [ ] `useSaveLastRead` - Pattern C (custom mutation interface)
- [ ] `useLastRead` - Pattern D (POST-as-query)

Bookmark Hooks:
- [ ] `useAddBookmark` - Pattern C (mutation wrapper)
- [ ] `useRemoveBookmark` - Pattern C (mutation wrapper)
- [ ] `useBookmarks` - Pattern A (simple query wrapper)

Note Hooks:
- [ ] `useAddNote` - Pattern C (mutation wrapper)
- [ ] `useUpdateNote` - Pattern C (mutation wrapper)
- [ ] `useRemoveNote` - Pattern C (mutation wrapper)
- [ ] `useNotes` - Pattern A (simple query wrapper)

Highlight Hooks:
- [ ] `useAddHighlight` - Pattern C (mutation wrapper)
- [ ] `useUpdateHighlight` - Pattern C (mutation wrapper)
- [ ] `useRemoveHighlight` - Pattern C (mutation wrapper)
- [ ] `useHighlights` - Pattern A (simple query wrapper)
- [ ] `useChapterHighlights` - Pattern A (simple query wrapper)

Topic Hooks:
- [ ] `useTopicsCategories` - Pattern B (data extraction)
- [ ] `useTopicsSearch` - Pattern B (data extraction + enabled condition)
- [ ] `useTopicById` - Pattern B (data extraction + enabled condition)
- [ ] `useTopicReferences` - Pattern B (data extraction)
- [ ] `useTopicExplanation` - Pattern B (data extraction)

Recently Viewed Hooks (NEW - manually added):
- [ ] `getUserRecentlyViewedBooksOptions` - Already manually implemented
- [ ] `postUserRecentlyViewedBooksSyncMutation` - Already manually implemented

### Phase 4: Restore Custom Exports Layer (30 minutes)

#### 4.1 Recreate `index.ts` Compatibility Layer

```typescript
// This file is auto-generated by @hey-api/openapi-ts
// BUT we manually maintain additional exports for backward compatibility

// Import query key functions at the top
import {
  getBibleTestamentsQueryKey,
  getBibleBooksQueryKey,
  getBibleBookByBookIdByChapterNumberQueryKey,
  getBibleBookExplanationByBookIdByChapterNumberQueryKey,
  getBibleChapterIdByBookIdByChapterNumberQueryKey,
  getBibleBookBookmarksByUserIdQueryKey,
  getBibleBookNotesByUserIdQueryKey,
  getBibleHighlightsByUserIdQueryKey,
  getBibleHighlightsByUserIdByBookIdByChapterNumberQueryKey,
} from './@tanstack/react-query.gen';

// Export generated types and SDK
export type * from './types.gen';
export * from './sdk.gen';

// Export our custom hooks
export * from './hooks';

// Re-export types and transformations from bible/types
export type {
  Testament,
  BookMetadata,
  ReadingPosition,
  ChapterSection,
  Verse,
  ExplanationContent,
  BibleBook,
  ChapterContent,
  Subtitle,
} from '../bible/types';

// Type aliases for test compatibility
export type { BookMetadata as TestamentBook } from '../bible/types';
export type { GetBibleBookByBookIdByChapterNumberResponse as GetBibleChapterResponse } from './types.gen';
export type { GetBibleBookExplanationByBookIdByChapterNumberResponse as GetBibleExplanationResponse } from './types.gen';

// Request body types for tests
export type SaveLastReadRequest = {
  user_id: string;
  book_id: number;
  chapter_number: number;
};

export type GetLastReadRequest = {
  user_id: string;
};

// Response types for last read
export type { PostBibleBookChapterLastReadResponse as GetLastReadResponse } from './types.gen';

// Create a bibleKeys object for test compatibility
export const bibleKeys = {
  testaments: getBibleTestamentsQueryKey,
  books: getBibleBooksQueryKey,
  chapter: getBibleBookByBookIdByChapterNumberQueryKey,
  explanation: getBibleBookExplanationByBookIdByChapterNumberQueryKey,
  chapterId: getBibleChapterIdByBookIdByChapterNumberQueryKey,
  bookmarks: getBibleBookBookmarksByUserIdQueryKey,
  notes: getBibleBookNotesByUserIdQueryKey,
  highlights: getBibleHighlightsByUserIdQueryKey,
  chapterHighlights: getBibleHighlightsByUserIdByBookIdByChapterNumberQueryKey,
};
```

### Phase 5: Testing & Validation (1-2 hours)

#### 5.1 Type Check
```bash
bun tsc --noEmit
```

**Expected:** 0 errors

#### 5.2 Linting
```bash
bun run lint:fix
```

#### 5.3 Run All Tests
```bash
# Run all tests to verify nothing broke
npm test

# Specifically test affected areas
npm test -- bible
npm test -- bookmarks
npm test -- notes
npm test -- highlights
npm test -- topics
npm test -- use-recent-books
```

**Expected:** All tests pass

#### 5.4 Test Coverage Areas

**Critical Test Files (Must Pass):**
1. `__tests__/components/bible/ChapterReader.test.tsx` - Core reading functionality
2. `__tests__/components/bible/ChapterReader.highlights.test.tsx` - Highlights integration
3. `__tests__/components/bible/ChapterReader.notes-integration.test.tsx` - Notes integration
4. `__tests__/components/bible/ChapterReader.bookmark-integration.test.tsx` - Bookmarks integration
5. `__tests__/integration/bookmark-end-to-end.test.tsx` - Bookmark workflows
6. `__tests__/integration/highlight-workflows.test.tsx` - Highlight workflows
7. `__tests__/app/highlights.test.tsx` - Highlights screen
8. `__tests__/app/notes.tsx` - Notes screen
9. `__tests__/app/bookmarks.tsx` - Bookmarks screen
10. `__tests__/app/topics/[topicId].test.tsx` - Topics screen
11. `__tests__/hooks/bible/use-recent-books.test.tsx` - Recently viewed books

#### 5.5 Manual Testing Checklist

**Bible Reading:**
- [ ] Navigate to chapter (e.g., Genesis 1)
- [ ] Verify chapter loads correctly
- [ ] Verify verses display properly
- [ ] Swipe to next chapter (verify prefetch works)
- [ ] Swipe to previous chapter
- [ ] Verify last read position saves

**Explanations:**
- [ ] Switch to Summary view
- [ ] Switch to By Line view
- [ ] Switch to Detailed view
- [ ] Verify all explanations load

**Bookmarks:**
- [ ] Add bookmark to current chapter
- [ ] Remove bookmark
- [ ] View bookmarks list
- [ ] Navigate to bookmarked chapter

**Notes:**
- [ ] Add note to verse
- [ ] Edit existing note
- [ ] Delete note
- [ ] View notes list
- [ ] Filter notes by chapter

**Highlights:**
- [ ] Add highlight (yellow)
- [ ] Change highlight color
- [ ] Delete highlight
- [ ] View highlights list
- [ ] Verify overlapping highlight detection

**Topics:**
- [ ] Browse topics by category (EVENT, PROPHECY, PARABLE)
- [ ] View topic details
- [ ] View topic references
- [ ] Verify verse placeholders replaced

**Recently Viewed:**
- [ ] Navigate to different books
- [ ] Verify recently viewed updates
- [ ] Check max 4 books limit
- [ ] Verify backend sync (if authenticated)

### Phase 6: Update MSW Handlers (30 minutes)

After regeneration, some MSW mock handler paths or types may need updates:

#### 6.1 Check Handler Compatibility
```bash
npm test 2>&1 | grep "no matching request handler"
```

#### 6.2 Update Handlers If Needed

Files to check:
- `__tests__/mocks/handlers/bible.handlers.ts`
- `__tests__/mocks/handlers/bookmarks.handlers.ts`
- `__tests__/mocks/handlers/notes.handlers.ts`
- `__tests__/mocks/handlers/highlights.handlers.ts`
- `__tests__/mocks/handlers/auth.ts`
- `__tests__/mocks/handlers/recently-viewed-books.handlers.ts`

**Common Issues:**
1. URL path changes (e.g., parameter format)
2. Request/response type changes
3. Base URL mismatches

### Phase 7: Documentation Updates (15 minutes)

#### 7.1 Update CLAUDE.md
Add note about manually maintaining hooks.ts:

```markdown
### API Code Generation

**IMPORTANT:** After running `bun generate:api`, you MUST manually restore:
1. `src/api/generated/hooks.ts` - Custom React Query hook wrappers
2. `src/api/generated/index.ts` - Backward compatibility exports

The @hey-api/openapi-ts generator does NOT create these files - they are manually maintained.
```

#### 7.2 Add Migration Notes
Create `src/api/generated/README.md`:

```markdown
# Generated API Files

This directory contains API client code generated from OpenAPI schema.

## Auto-Generated Files (DO NOT EDIT)
- `@tanstack/react-query.gen.ts` - React Query options functions
- `client.gen.ts` - API client configuration
- `sdk.gen.ts` - Raw SDK methods
- `types.gen.ts` - TypeScript type definitions
- `client/`, `core/` - Supporting utilities

## Manually Maintained Files
- `hooks.ts` - Custom React Query hook wrappers (NOT auto-generated)
- `index.ts` - Exports and backward compatibility layer (NOT auto-generated)

## Regeneration Process
1. Run: `bun generate:api`
2. Auto-generated files will update
3. Manually restore `hooks.ts` and `index.ts` from git if needed
4. Run tests to verify everything works

See `.agent-os/specs/api-migration-hey-api.md` for full migration details.
```

### Phase 8: Commit & PR (15 minutes)

```bash
# Stage changes
git add .

# Commit
git commit -m "feat: migrate to @hey-api/openapi-ts v0.85.0

- Regenerate API code with latest @hey-api patterns
- Manually recreate hooks.ts with all 23 custom hook wrappers
- Restore index.ts compatibility layer
- Update MSW handlers for new generated types
- Add documentation for manual maintenance process

BREAKING: hooks.ts is no longer auto-generated and must be manually maintained

Refs: Recently Viewed Books feature implementation"

# Push
git push origin feature/api-migration-hey-api-v0.85

# Create PR
gh pr create --title "Migrate to @hey-api/openapi-ts v0.85.0" --body "$(cat <<'EOF'
## Summary
Migrates API code generation to @hey-api/openapi-ts v0.85.0, which changes the generated file structure.

## Key Changes
- Regenerated all API files with new generator version
- Manually recreated `hooks.ts` (no longer auto-generated)
- Restored `index.ts` compatibility layer
- Updated MSW handlers for type compatibility
- Added documentation for manual maintenance

## Testing
- [x] Type check passes
- [x] All tests pass (38 files verified)
- [x] Manual testing completed (Bible, Bookmarks, Notes, Highlights, Topics)

## Migration Notes
See `.agent-os/specs/api-migration-hey-api.md` for full details.

## Breaking Changes
**For Future Development:**
- `hooks.ts` is now manually maintained - do NOT delete after regeneration
- `index.ts` must be restored after regeneration for backward compatibility
EOF
)"
```

## Risk Assessment

### High Risk Areas

1. **Data Transformations** (Bible hooks)
   - Risk: Incorrect transformation breaking chapter display
   - Mitigation: Comprehensive test coverage of transformation logic
   - Validation: Manual testing of chapter reading

2. **Optimistic Updates** (Bookmarks, Notes, Highlights)
   - Risk: Cache updates failing, causing stale UI
   - Mitigation: Test rollback scenarios thoroughly
   - Validation: Integration tests verify optimistic update patterns

3. **Type Safety** (All hooks)
   - Risk: Type mismatches causing runtime errors
   - Mitigation: Strict TypeScript checking, no `any` escapes
   - Validation: Type check must pass with 0 errors

### Medium Risk Areas

4. **MSW Handler Compatibility**
   - Risk: Tests failing due to URL/type mismatches
   - Mitigation: Run full test suite, fix handlers incrementally
   - Validation: All 38 test files must pass

5. **Import Path Changes**
   - Risk: Components importing from wrong locations
   - Mitigation: Search for all import statements
   - Validation: Build succeeds, no missing imports

### Low Risk Areas

6. **Documentation**
   - Risk: Outdated docs confusing future developers
   - Mitigation: Clear inline comments and README
   - Validation: Peer review of documentation

## Rollback Plan

If migration fails or causes issues:

```bash
# Revert the migration
git revert <migration-commit-sha>

# Or reset to previous state
git reset --hard origin/main

# Restore the old hooks.ts from backup
git checkout origin/main -- src/api/generated/hooks.ts
git checkout origin/main -- src/api/generated/index.ts
```

**When to Rollback:**
- More than 5 test failures after migration
- Type errors that can't be resolved in 1 hour
- Critical bugs in production features
- Performance degradation

## Success Criteria

- [ ] `bun tsc --noEmit` passes with 0 errors
- [ ] `bun run lint` passes with 0 errors
- [ ] `npm test` passes 100% of tests (currently ~105 tests)
- [ ] All 23 hooks implemented and working
- [ ] Manual testing checklist completed
- [ ] Documentation updated
- [ ] PR approved and merged

## Future Maintenance

### When Regenerating API Code

**Every time you run `bun generate:api`:**

1. **Before regeneration:**
   ```bash
   # Backup custom files
   cp src/api/generated/hooks.ts src/api/generated/hooks.ts.backup
   cp src/api/generated/index.ts src/api/generated/index.ts.backup
   ```

2. **After regeneration:**
   ```bash
   # Restore custom files
   git restore src/api/generated/hooks.ts
   git restore src/api/generated/index.ts

   # Or use backups
   mv src/api/generated/hooks.ts.backup src/api/generated/hooks.ts
   mv src/api/generated/index.ts.backup src/api/generated/index.ts
   ```

3. **If new endpoints were added:**
   - Manually add new hook wrappers to `hooks.ts`
   - Import new generated options functions
   - Export new hooks from `index.ts`
   - Update tests

4. **If endpoint signatures changed:**
   - Update affected hook wrappers in `hooks.ts`
   - Update type imports
   - Update tests
   - Check MSW handlers

### Adding New Endpoints

When backend adds new endpoints:

1. Download latest schema: `curl https://api.verse-mate.apegro.dev/openapi/json -o openapi.json`
2. Regenerate: `bun generate:api`
3. Restore `hooks.ts` and `index.ts`
4. Add new hooks following existing patterns (Pattern A, B, C, or D)
5. Add MSW handlers in `__tests__/mocks/handlers/`
6. Write tests
7. Update this spec if new patterns emerge

## Appendix

### Pattern Reference

**Pattern A: Simple Query Wrapper**
```typescript
export const useHookName = (options?: Options<DataType>) => {
  return useQuery(getOptionsFunction(options));
};
```

**Pattern B: Query with Transformation**
```typescript
export const useHookName = (param1: Type1, param2: Type2) => {
  const query = useQuery({
    ...getOptionsFunction({ path: { param1, param2 } }),
    enabled: Boolean(param1),
  });

  return {
    ...query,
    data: query.data ? transformData(query.data) : null,
  };
};
```

**Pattern C: Mutation with Custom Interface**
```typescript
export const useHookName = () => {
  const mutation = useMutation(getMutationFunction());

  return {
    ...mutation,
    mutate: (params: CustomParams) => {
      mutation.mutate({ body: params });
    },
  };
};
```

**Pattern D: Custom Effect Pattern**
```typescript
export const useHookName = (param: string) => {
  const mutation = useMutation(getMutationFunction());

  useEffect(() => {
    if (param) {
      mutation.mutate({ body: { param } });
    }
  }, [param]);

  return {
    data: mutation.data?.result || {},
    isLoading: mutation.isPending,
    // ... custom return shape
  };
};
```

### Generated Options Function Naming

Old pattern → New pattern:
- `getBibleChapterOptions` → `getBibleBookByBookIdByChapterNumberOptions`
- `getBibleExplanationOptions` → `getBibleBookExplanationByBookIdByChapterNumberOptions`
- Pattern: Full REST path in camelCase

### Type Import Reference

```typescript
// Query data types (for useQuery hooks)
import type {
  GetBibleTestamentsData,
  GetBibleBooksData,
  // ... all GetXxxData types
} from './types.gen';

// Mutation data types (for useMutation hooks)
import type {
  PostBibleBookBookmarkAddData,
  DeleteBibleBookBookmarkRemoveData,
  // ... all PostXxxData, PutXxxData, DeleteXxxData types
} from './types.gen';

// Response types (for return type hints)
import type {
  GetBibleBookByBookIdByChapterNumberResponse,
  // ... all response types
} from './types.gen';

// SDK types
import type { Options } from './sdk.gen';
```

## Questions & Answers

**Q: Why not just use the generated options directly in components?**
A: Our custom hooks provide valuable abstractions:
- Data transformations (API response → domain types)
- Simplified interfaces (fewer parameters, sensible defaults)
- Consistent patterns (enabled conditions, stale time)
- Type safety improvements
- Optimistic update logic (for mutations)

**Q: Can we automate the hooks.ts maintenance?**
A: Potentially, with a code generation script, but:
- Transformations are complex and domain-specific
- Custom logic (POST-as-query, optimistic updates) is hard to generate
- Manual maintenance ensures quality and intentionality
- 23 hooks is manageable to maintain manually

**Q: What if we want to switch generators later?**
A: The hooks.ts abstraction layer protects us:
- Components only import from `@/src/api/generated` (our exports)
- Generated code is isolated to `@tanstack/react-query.gen.ts`
- Switching generators only requires updating hooks.ts implementation
- No component changes needed

**Q: How often will we need to regenerate?**
A: Estimated frequency:
- Weekly during active backend development
- Monthly during stable periods
- Always after: new features, schema changes, bug fixes

## Related Documents

- Recently Viewed Books Implementation: `hooks/bible/use-recent-books.ts`
- Original Migration Discussion: Git commit messages from 2025-11-08
- OpenAPI Schema: `openapi.json`
- Test Infrastructure: `__tests__/mocks/handlers/`
- Generator Config: `package.json` (scripts section)

---

**Document Version:** 1.0
**Last Updated:** 2025-11-08
**Author:** Claude Code (via conversation summary + analysis)
