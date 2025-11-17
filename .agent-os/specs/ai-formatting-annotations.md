# AI-Powered Bible Formatting Annotations

**Status:** Future Enhancement (Phase 2)
**Created:** 2025-11-16
**Dependencies:** Phase 1 (rule-based formatting) must be implemented first
**Backend Required:** Yes - AI processing pipeline needed

## Overview

Use GPT-5 to pre-analyze every Bible chapter and generate formatting metadata (annotations) that describe the optimal visual structure. The mobile app consumes these annotations to render intelligently formatted text with proper paragraph breaks, poetry indentation, dialogue styling, and more.

## Goals

1. **Intelligent Formatting**: AI-determined paragraph breaks, poetry detection, dialogue identification
2. **Cost-Effective**: One-time processing, minimal token output (metadata only, not full text)
3. **Maintainable**: JSON metadata can be reviewed, versioned, and updated
4. **Performant**: No runtime AI calls, just apply pre-computed annotations
5. **Graceful Degradation**: Fallback to rule-based formatting if annotations unavailable

## Architecture

### High-Level Flow

```
┌─────────────────────────────────────────────────┐
│ 1. Backend: AI Processing Pipeline             │
│    - One-time job per chapter                  │
│    - GPT-5 analyzes text structure              │
│    - Outputs JSON annotations                   │
│    - Stores in database                         │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│ 2. API: Fetch Chapter + Annotations            │
│    GET /bible/book/{id}/{chapter}               │
│    Response includes "formatting" field         │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│ 3. Mobile App: Apply Annotations               │
│    - Read "formatting" metadata                 │
│    - Render with breaks, indents, styles       │
│    - Fallback to rule-based if missing         │
└─────────────────────────────────────────────────┘
```

---

## Data Schema

### Database Table: `chapter_formatting`

```sql
CREATE TABLE chapter_formatting (
  id SERIAL PRIMARY KEY,
  book_id INT NOT NULL,
  chapter_number INT NOT NULL,
  formatting_version INT DEFAULT 1,  -- Allow multiple versions
  annotations JSONB NOT NULL,
  generated_at TIMESTAMP DEFAULT NOW(),
  model_version VARCHAR(50),  -- e.g., "gpt-5-2025-11"
  reviewed BOOLEAN DEFAULT FALSE,  -- Manual review flag
  UNIQUE(book_id, chapter_number, formatting_version)
);

CREATE INDEX idx_chapter_formatting_lookup
  ON chapter_formatting(book_id, chapter_number);
```

### Annotation JSON Structure

```typescript
interface ChapterFormatting {
  version: number;  // Schema version for future changes

  // Paragraph break points
  paragraphBreaks: number[];  // Verse numbers after which to break

  // Poetry sections
  poetry?: {
    verses: number[];  // Verse numbers that are poetry
    indentLevel?: number;  // 0-2, how much to indent
    style?: 'center' | 'indent' | 'italic';
  }[];

  // Dialogue segments
  dialogue?: {
    verseNumber: number;
    speaker?: string;  // Optional speaker identification
    quote: string;  // The quoted text
    style?: 'indent' | 'quotation-marks';
  }[];

  // List structures (genealogies, laws, etc.)
  lists?: {
    startVerse: number;
    endVerse: number;
    type: 'bullet' | 'numbered' | 'genealogy';
  }[];

  // Special emphasis/notes
  emphasis?: {
    verseNumber: number;
    type: 'important' | 'transition' | 'conclusion';
    note?: string;  // Human-readable explanation
  }[];

  // AI confidence and metadata
  metadata: {
    confidence: number;  // 0-1, AI confidence score
    processingTime: number;  // Milliseconds
    notes?: string;  // Any special observations from AI
  };
}
```

### Example Annotation (Genesis 1)

```json
{
  "version": 1,
  "paragraphBreaks": [2, 5, 9, 13, 19, 23, 27, 31],
  "poetry": [],
  "dialogue": [
    {
      "verseNumber": 3,
      "quote": "Let there be light",
      "speaker": "God",
      "style": "quotation-marks"
    },
    {
      "verseNumber": 6,
      "quote": "Let there be a vault between the waters to separate water from water",
      "speaker": "God",
      "style": "quotation-marks"
    }
  ],
  "lists": [],
  "emphasis": [
    {
      "verseNumber": 1,
      "type": "important",
      "note": "Opening statement of creation"
    }
  ],
  "metadata": {
    "confidence": 0.92,
    "processingTime": 1250,
    "notes": "Clear narrative structure with repetitive pattern"
  }
}
```

---

## GPT-5 Prompt Engineering

### System Prompt

```
You are a Biblical text analysis expert. Your task is to analyze Bible chapters
and identify their literary structure for optimal reading formatting.

Focus on:
1. Natural paragraph breaks based on topic shifts, time transitions, or scene changes
2. Poetry sections (Psalms, Proverbs, prophetic poetry, songs)
3. Dialogue segments and speakers
4. Lists (genealogies, laws, numbers)
5. Emphasis points (key verses, transitions, conclusions)

Output JSON only. Be concise. Prioritize natural reading flow.
```

### User Prompt Template

```
Analyze this Bible chapter for formatting:

Book: {bookName}
Chapter: {chapterNumber}
Testament: {testament}
Genre: {genre}  // e.g., "narrative", "poetry", "epistle", "apocalyptic"

Verses:
{fullChapterText}

Task: Identify the literary structure and optimal formatting.

Return JSON with this structure:
{
  "version": 1,
  "paragraphBreaks": [verse numbers after which to insert paragraph break],
  "poetry": [{"verses": [list], "indentLevel": 0-2, "style": "..."}],
  "dialogue": [{"verseNumber": N, "speaker": "...", "quote": "...", "style": "..."}],
  "lists": [{"startVerse": N, "endVerse": M, "type": "..."}],
  "emphasis": [{"verseNumber": N, "type": "...", "note": "..."}],
  "metadata": {"confidence": 0.0-1.0, "processingTime": ms, "notes": "..."}
}

Rules:
- paragraphBreaks: Break on topic/time/scene changes, not arbitrary counts
- poetry: Identify based on Hebrew parallelism, repetition, imagery
- dialogue: Only clear quotations, include speaker if identifiable
- lists: Genealogies, law lists, numbers, catalogs
- emphasis: Major transitions, key theological points, conclusions
- confidence: How certain are you about this analysis (0.0-1.0)

Be conservative. When uncertain, prefer fewer breaks/annotations.
```

---

## Backend Implementation

### 1. AI Processing Script

```typescript
// scripts/generate-formatting-annotations.ts

import { OpenAI } from 'openai';
import { db } from './database';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface Chapter {
  bookId: number;
  bookName: string;
  chapterNumber: number;
  testament: 'OT' | 'NT';
  genre: string;
  verses: { verseNumber: number; text: string }[];
}

async function generateAnnotations(chapter: Chapter): Promise<ChapterFormatting> {
  const startTime = Date.now();

  // Build prompt
  const versesText = chapter.verses
    .map((v) => `${v.verseNumber}. ${v.text}`)
    .join('\n');

  const userPrompt = `
Analyze this Bible chapter for formatting:

Book: ${chapter.bookName}
Chapter: ${chapter.chapterNumber}
Testament: ${chapter.testament}
Genre: ${chapter.genre}

Verses:
${versesText}

[... rest of prompt template ...]
`;

  // Call GPT-5
  const response = await openai.chat.completions.create({
    model: 'gpt-5-2025-11',  // Update with actual model name
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.3,  // Lower temp for consistency
  });

  const annotations = JSON.parse(response.choices[0].message.content);
  annotations.metadata.processingTime = Date.now() - startTime;

  return annotations;
}

async function processAllChapters() {
  const chapters = await db.getAllChapters();

  for (const chapter of chapters) {
    console.log(`Processing ${chapter.bookName} ${chapter.chapterNumber}...`);

    try {
      const annotations = await generateAnnotations(chapter);

      await db.query(`
        INSERT INTO chapter_formatting (book_id, chapter_number, annotations, model_version)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (book_id, chapter_number, formatting_version)
        DO UPDATE SET annotations = $3, generated_at = NOW()
      `, [chapter.bookId, chapter.chapterNumber, JSON.stringify(annotations), 'gpt-5-2025-11']);

      console.log(`✓ Completed (confidence: ${annotations.metadata.confidence})`);
    } catch (error) {
      console.error(`✗ Failed: ${error.message}`);
    }

    // Rate limiting
    await sleep(500);
  }
}
```

### 2. API Endpoint Update

```typescript
// api/bible/[bookId]/[chapterNumber].ts

app.get('/bible/book/:bookId/:chapterNumber', async (req, res) => {
  const { bookId, chapterNumber } = req.params;

  // Fetch chapter content
  const chapter = await db.getChapter(bookId, chapterNumber);

  // Fetch formatting annotations (if available)
  const formatting = await db.query(`
    SELECT annotations FROM chapter_formatting
    WHERE book_id = $1 AND chapter_number = $2
    ORDER BY formatting_version DESC
    LIMIT 1
  `, [bookId, chapterNumber]);

  return res.json({
    ...chapter,
    formatting: formatting.rows[0]?.annotations || null,
  });
});
```

---

## Mobile App Integration

### 1. Type Definitions

```typescript
// types/bible.ts

export interface ChapterFormatting {
  version: number;
  paragraphBreaks: number[];
  poetry?: {
    verses: number[];
    indentLevel?: number;
    style?: 'center' | 'indent' | 'italic';
  }[];
  dialogue?: {
    verseNumber: number;
    speaker?: string;
    quote: string;
    style?: 'indent' | 'quotation-marks';
  }[];
  lists?: {
    startVerse: number;
    endVerse: number;
    type: 'bullet' | 'numbered' | 'genealogy';
  }[];
  emphasis?: {
    verseNumber: number;
    type: 'important' | 'transition' | 'conclusion';
    note?: string;
  }[];
  metadata: {
    confidence: number;
    processingTime: number;
    notes?: string;
  };
}

export interface ChapterContent {
  bookId: number;
  bookName: string;
  chapterNumber: number;
  title: string;
  testament: 'OT' | 'NT';
  sections: Section[];
  formatting?: ChapterFormatting;  // Optional AI annotations
}
```

### 2. Rendering Logic

```typescript
// components/bible/ChapterReader.tsx

function ChapterReader({ chapter, activeTab, explanation }: ChapterReaderProps) {
  // Determine break points
  const breakPoints = chapter.formatting?.paragraphBreaks
    ? new Set(chapter.formatting.paragraphBreaks)
    : calculateRuleBasedBreaks(section.verses);  // Fallback

  return (
    <View>
      {chapter.sections.map((section) => (
        <View key={section.startVerse}>
          {/* Section subtitle and verse range */}

          {/* Render verses with AI-determined breaks */}
          {renderVersesWithBreaks(section.verses, breakPoints, chapter.formatting)}
        </View>
      ))}
    </View>
  );
}

function renderVersesWithBreaks(
  verses: Verse[],
  breakPoints: Set<number>,
  formatting?: ChapterFormatting
) {
  const groups: Verse[][] = [];
  let currentGroup: Verse[] = [];

  verses.forEach((verse, index) => {
    currentGroup.push(verse);

    // Check if we should break after this verse
    if (breakPoints.has(verse.verseNumber) || index === verses.length - 1) {
      groups.push([...currentGroup]);
      currentGroup = [];
    }
  });

  return groups.map((group, groupIndex) => (
    <View key={groupIndex}>
      <Text style={styles.verseTextParagraph}>
        {group.map((verse) => renderVerse(verse, formatting))}
      </Text>
      {/* Add spacing between groups */}
      {groupIndex < groups.length - 1 && <View style={{ height: spacing.md }} />}
    </View>
  ));
}

function renderVerse(verse: Verse, formatting?: ChapterFormatting) {
  // Apply special styling based on annotations
  const isPoetry = formatting?.poetry?.some((p) => p.verses.includes(verse.verseNumber));
  const dialogueInfo = formatting?.dialogue?.find((d) => d.verseNumber === verse.verseNumber);

  return (
    <Text key={verse.verseNumber} style={isPoetry ? styles.poetryVerse : undefined}>
      <Text style={styles.verseNumberSuperscript}>{toSuperscript(verse.verseNumber)}</Text>
      {dialogueInfo ? (
        <Text style={styles.dialogue}>{verse.text}</Text>
      ) : (
        <Text>{verse.text}</Text>
      )}
    </Text>
  );
}
```

---

## Cost Estimation

### Token Usage per Chapter

**Input tokens** (average chapter):
- System prompt: ~200 tokens
- User prompt template: ~100 tokens
- Chapter text (average 25 verses × 25 words): ~625 tokens
- **Total input: ~925 tokens**

**Output tokens** (JSON metadata):
- Average annotation JSON: ~150-300 tokens

**Cost per chapter** (GPT-5 pricing TBD, estimate based on GPT-4):
- Input: 925 tokens × $0.01/1K = ~$0.009
- Output: 200 tokens × $0.03/1K = ~$0.006
- **Total: ~$0.015 per chapter**

**Total Bible** (1,189 chapters):
- 1,189 × $0.015 = **~$17.84**

**One-time cost, very affordable!**

### Rate Limiting

- GPT-5 API limits: TBD (check OpenAI docs)
- Recommended: 2 requests/second = ~10 minutes for full Bible
- Include retry logic with exponential backoff

---

## Quality Assurance

### 1. Manual Review Process

- Flag low-confidence annotations (< 0.7) for human review
- Spot-check random samples across book types
- Create review dashboard showing annotations side-by-side with text

### 2. Versioning Strategy

- `formatting_version` field allows multiple annotation sets
- Can A/B test different GPT-5 prompts
- Can gradually improve and re-process chapters

### 3. Monitoring

- Track annotation quality metrics:
  - Average confidence scores
  - User engagement (are breaks actually used?)
  - Error rates (malformed JSON, missing data)

---

## Implementation Phases

### Phase 2A: Foundation (Week 1-2)
- [ ] Design database schema
- [ ] Create `chapter_formatting` table
- [ ] Write AI processing script
- [ ] Test on 5-10 sample chapters
- [ ] Validate JSON structure

### Phase 2B: Full Processing (Week 3)
- [ ] Process all 1,189 chapters
- [ ] Manual review of low-confidence results
- [ ] Store annotations in database

### Phase 2C: API Integration (Week 3-4)
- [ ] Update API endpoint to include `formatting` field
- [ ] Add fallback logic for missing annotations
- [ ] API documentation

### Phase 2D: Mobile Integration (Week 4-5)
- [ ] Update TypeScript types
- [ ] Implement annotation-based rendering
- [ ] Add fallback to rule-based breaking
- [ ] Visual testing across book types

### Phase 2E: Testing & Refinement (Week 5-6)
- [ ] QA testing on various chapters
- [ ] Performance testing (ensure no slowdowns)
- [ ] User feedback collection
- [ ] Iterate on GPT-5 prompt if needed

---

## Future Enhancements (Phase 3+)

1. **User Preferences**: Let users choose formatting style
2. **Advanced Poetry**: Multi-level indentation, stanza breaks
3. **Cross-References**: AI-identified parallel passages
4. **Study Notes**: AI-generated contextual notes
5. **Pronunciation Guide**: Proper name pronunciation
6. **Cultural Context**: Historical/cultural annotations

---

## Success Criteria

- ✅ All 1,189 chapters have formatting annotations
- ✅ Average AI confidence ≥ 0.75
- ✅ Mobile app successfully applies annotations
- ✅ Fallback works when annotations missing
- ✅ No performance degradation
- ✅ User feedback: text feels more readable
- ✅ Total cost within budget (~$20)

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| GPT-5 pricing changes | Cost overrun | Set budget cap, halt if exceeded |
| Low-quality annotations | Poor UX | Manual review, confidence thresholds |
| API rate limits | Slow processing | Implement retry logic, batch processing |
| Schema changes | Breaking changes | Version field, backward compatibility |
| JSON parsing errors | App crashes | Validation, try-catch, fallback |

---

## Notes for Future Implementation

- **GPT-5 Model**: Confirm actual model name and pricing when available
- **Prompt Tuning**: Expect to iterate on prompts 3-5 times for quality
- **Human Review**: Budget 5-10 hours for manual review of results
- **Versioning**: Keep old annotations, allow rollback if new version worse
- **Documentation**: Document annotation schema thoroughly for maintenance
