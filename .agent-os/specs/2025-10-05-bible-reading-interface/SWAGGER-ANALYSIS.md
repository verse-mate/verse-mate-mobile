# Swagger API Analysis

> Date: 2025-10-06
> Spec URL: https://api.verse-mate.apegro.dev/swagger/json
> Status: Validated for Bible Reading Interface

## Executive Summary

The Swagger spec has been validated and contains all necessary endpoints for the Bible Reading Interface. Key findings:

- ✅ Core endpoints confirmed: `/bible/books`, `/bible/testaments`, `/bible/book/{bookId}/{chapterNumber}`
- ✅ Parameters use `bookId` and `chapterNumber` (not `book` or `chapter`)
- ✅ Explanation endpoint exists with `explanationType` query parameter
- ⚠️ Response schemas are not defined (all return empty `{}`)
- ⚠️ No separate endpoints for Summary/ByLine tabs - uses `explanationType` parameter instead

## Core Bible Reading Endpoints

### 1. Get All Books

**Endpoint**: `GET /bible/books`
**Operation ID**: `getBibleBooks`
**Parameters**: None
**Response**: `200 {}` (schema not defined)

**Expected Response** (based on discovery):
```typescript
interface BibleBook {
  id: number;           // 1-66
  name: string;         // "Genesis", "Exodus", etc.
  testament: 'OT' | 'NT';
  chapters: number;     // Total chapter count
  genre?: string;       // Optional genre classification
}

type BibleBooksResponse = BibleBook[];
```

### 2. Get Testaments

**Endpoint**: `GET /bible/testaments`
**Operation ID**: `getBibleTestaments`
**Parameters**: None
**Response**: `200 {}` (schema not defined)

**Expected Response**:
```typescript
interface Testament {
  id: 'OT' | 'NT';
  name: string;         // "Old Testament" | "New Testament"
  books: number[];      // Array of book IDs (1-39 for OT, 40-66 for NT)
}

type TestamentsResponse = Testament[];
```

### 3. Get Chapter Content

**Endpoint**: `GET /bible/book/{bookId}/{chapterNumber}`
**Operation ID**: `getBibleBookByBookIdByChapterNumber`
**Parameters**:
- `bookId` (path, required, string) - Book ID (1-66)
- `chapterNumber` (path, required, string) - Chapter number
- `versionKey` (query, optional, string) - Bible version (e.g., "NIV", "ESV")

**Response**: `200 {}` (schema not defined)

**Expected Response** (based on discovery):
```typescript
interface Verse {
  number: number;
  text: string;
}

interface ChapterSection {
  subtitle?: string;    // Section heading
  verses: Verse[];
}

interface ChapterContent {
  bookId: number;
  chapterNumber: number;
  title: string;        // "Genesis 1"
  sections: ChapterSection[];
  versionKey?: string;
}
```

### 4. Get Chapter Explanations

**Endpoint**: `GET /bible/book/explanation/{bookId}/{chapterNumber}`
**Operation ID**: `getBibleBookExplanationByBookIdByChapterNumber`
**Parameters**:
- `bookId` (path, required, string) - Book ID (1-66)
- `chapterNumber` (path, required, string) - Chapter number
- `versionKey` (query, optional, string) - Bible version
- `explanationType` (query, optional, string) - **Type of explanation**

**Response**: `200 {}` (schema not defined)

**Important**: This endpoint likely supports different `explanationType` values for Summary/ByLine/Detailed tabs:
- `summary` - AI-generated chapter overview
- `byline` - Verse-by-verse breakdown
- `detailed` - Full detailed explanation

**Expected Response**:
```typescript
interface Explanation {
  bookId: number;
  chapterNumber: number;
  explanationType: string;
  content: string | ExplanationSection[];
  generatedAt: string;
}

interface ExplanationSection {
  verse?: number;
  heading?: string;
  text: string;
}
```

### 5. Save Last Read Position

**Endpoint**: `POST /bible/book/chapter/save-last-read`
**Operation ID**: `postBibleBookChapterSave-last-read`
**Parameters** (body):
```typescript
{
  user_id: string;      // UUID
  book_id: number;
  chapter_number: number;
}
```

**Response**: `200 {}`

### 6. Get Last Read Position

**Endpoint**: `POST /bible/book/chapter/last-read`
**Operation ID**: `postBibleBookChapterLast-read`
**Parameters** (body):
```typescript
{
  user_id: string;      // UUID (required)
}
```

**Response**: `200 {}` (expected to return `{ book_id, chapter_number }`)

## Additional Endpoints (Out of Scope for Phase 2)

### Bookmarks
- `GET /bible/book/bookmarks/{user_id}` - Get all bookmarks
- `POST /bible/book/bookmark/add` - Add bookmark
- `DELETE /bible/book/bookmark/remove` - Remove bookmark

### Highlights
- `GET /bible/highlights/{user_id}` - Get all highlights
- `GET /bible/highlights/{user_id}/{book_id}/{chapter_number}` - Get chapter highlights
- `POST /bible/highlight/add` - Add highlight
- `PUT /bible/highlight/{highlight_id}` - Update highlight color
- `DELETE /bible/highlight/{highlight_id}` - Remove highlight

### AI Conversations
- `POST /bible/book/new-conversation` - Start new AI conversation
- `POST /bible/book/conversations-history` - Get conversation history
- `POST /bible/book/messages-history` - Get message history
- `POST /bible/book/conversation-exists` - Check if conversation exists
- `DELETE /bible/book/delete-chat/{conversation_id}` - Delete conversation

### Explanation Ratings
- `POST /bible/book/explanation/save-rating` - Rate explanation
- `PUT /bible/book/explanation/update-rating` - Update rating
- `POST /bible/book/explanation/ratings` - Get ratings

## Answers to Discovery Questions

### Q1: Are endpoints correct?
✅ **YES** - All assumed endpoints exist:
- `/bible/testaments` ✓
- `/bible/books` ✓
- `/bible/book/{bookId}/{chapterNumber}` ✓

### Q2: Do endpoints use `bookId` or `book` parameter?
✅ **`bookId`** - Confirmed in path parameters

### Q3: Is there a `chapter` vs `chapterNumber` parameter difference?
✅ **`chapterNumber`** - Confirmed in path parameters

### Q4: Are there separate endpoints for Summary/ByLine/Detailed tabs?
⚠️ **NO** - Single endpoint with `explanationType` query parameter:
- `/bible/book/explanation/{bookId}/{chapterNumber}?explanationType=summary`
- `/bible/book/explanation/{bookId}/{chapterNumber}?explanationType=byline`
- `/bible/book/explanation/{bookId}/{chapterNumber}?explanationType=detailed`

**Action Required**: Test actual API to confirm `explanationType` values

### Q5: How is testament determined?
✅ **Derived from bookId** - No testament parameter in endpoints
- Books 1-39 = Old Testament
- Books 40-66 = New Testament

### Q6: Missing Response Schemas?
⚠️ **ISSUE**: All `responses.200` are empty `{}`
- No TypeScript types can be auto-generated from Swagger
- Must create types manually based on actual API responses
- **Action Required**: Make test API calls to document response schemas

## Implementation Impact

### ✅ What We Can Do Now

1. **Install code generation tools**:
```bash
bun add @hey-api/openapi-ts @7nohe/openapi-react-query-codegen
```

2. **Generate basic structure**:
```bash
npx @hey-api/openapi-ts -i swagger.json -o src/api/generated
```

3. **Create React Query hooks manually** (schemas missing):
- `useBibleBooks()` - GET /bible/books
- `useBibleTestaments()` - GET /bible/testaments
- `useBibleChapter(bookId, chapterNumber)` - GET /bible/book/{bookId}/{chapterNumber}
- `useBibleExplanation(bookId, chapterNumber, type)` - GET /bible/book/explanation/{bookId}/{chapterNumber}
- `useSaveLastRead()` - POST /bible/book/chapter/save-last-read
- `useLastRead(userId)` - POST /bible/book/chapter/last-read

### ⚠️ What We Must Do Manually

1. **Define TypeScript Types** - Create `src/api/types.ts`:
```typescript
// Bible domain types
export interface BibleBook { /* ... */ }
export interface Testament { /* ... */ }
export interface ChapterContent { /* ... */ }
export interface Explanation { /* ... */ }
```

2. **Test API Endpoints** - Make actual calls to document responses:
```bash
curl https://api.verse-mate.apegro.dev/bible/books
curl https://api.verse-mate.apegro.dev/bible/book/1/1
curl "https://api.verse-mate.apegro.dev/bible/book/explanation/1/1?explanationType=summary"
```

3. **Create MSW Handlers** - Mock responses based on real API data

4. **Write React Query Hooks** - Manual implementation with proper types

## Next Steps for Task 2.1

1. ✅ Download and analyze Swagger spec (COMPLETE)
2. ⏳ Install code generation tools
3. ⏳ Test actual API endpoints to get response schemas
4. ⏳ Create TypeScript types manually
5. ⏳ Write React Query hooks with proper typing
6. ⏳ Document `explanationType` values

## Updated Implementation Plan

**Original Plan**: Auto-generate everything from Swagger
**Revised Plan**: Hybrid approach due to missing schemas

```
Phase 2.1: API Setup
├── Install: @hey-api/openapi-ts, @7nohe/openapi-react-query-codegen
├── Generate: Basic structure from Swagger (partial)
├── Test: Make real API calls to document responses
├── Create: Manual TypeScript types in src/api/types.ts
├── Write: React Query hooks with proper typing
└── Document: All request/response schemas

Phase 2.2-2.3: MSW Setup
├── Create mock data based on real API responses
├── Write MSW handlers for all endpoints
└── Test handlers with actual response shapes

Phase 2.4-2.5: Hook Configuration
├── Configure testament/book data hooks
├── Configure chapter content hooks
└── Add error handling and loading states

Phase 2.6: Persistence
├── AsyncStorage for reading position
└── Last read chapter tracking

Phase 2.7-2.8: Testing
├── Write integration tests
└── Verify all tests pass
```

## Open Questions

1. What are the valid `explanationType` values? (`summary`, `byline`, `detailed`?)
2. What does `/bible/chapter-id/{bookId}/{chapterNumber}` return? (Chapter ID lookup?)
3. Do we need authentication for basic Bible reading endpoints?
4. What Bible versions are supported via `versionKey`?

---

**Status**: Swagger spec validated, response schemas need manual documentation
**Next**: Test API endpoints and create TypeScript types
