-- Insight: Table - Chapter Sharing Patterns
-- Dashboard: Social & Virality
-- Visualization: Table showing top shared chapters
-- Time window: Last 30 days
-- Description: Analyzes which books and chapters are shared most.
--              Uses CHAPTER_SHARED event with bookId and chapterNumber properties.
--              Helps identify content that resonates enough to share.

-- Most shared books
SELECT
    JSONExtractInt(properties, 'bookId') AS book_id,
    CASE JSONExtractInt(properties, 'bookId')
        WHEN 1 THEN 'Genesis'
        WHEN 19 THEN 'Psalms'
        WHEN 20 THEN 'Proverbs'
        WHEN 23 THEN 'Isaiah'
        WHEN 40 THEN 'Matthew'
        WHEN 41 THEN 'Mark'
        WHEN 42 THEN 'Luke'
        WHEN 43 THEN 'John'
        WHEN 44 THEN 'Acts'
        WHEN 45 THEN 'Romans'
        WHEN 46 THEN '1 Corinthians'
        WHEN 49 THEN 'Ephesians'
        WHEN 50 THEN 'Philippians'
        WHEN 58 THEN 'Hebrews'
        WHEN 59 THEN 'James'
        WHEN 62 THEN '1 John'
        WHEN 66 THEN 'Revelation'
        ELSE concat('Book ', toString(JSONExtractInt(properties, 'bookId')))
    END AS book_name,
    count(*) AS share_count,
    count(DISTINCT distinct_id) AS unique_sharers
FROM events
WHERE
    event = 'CHAPTER_SHARED'
    AND timestamp >= now() - INTERVAL 30 DAY
GROUP BY book_id
ORDER BY share_count DESC
LIMIT 10;

-- Most shared specific chapters
SELECT
    JSONExtractInt(properties, 'bookId') AS book_id,
    JSONExtractInt(properties, 'chapterNumber') AS chapter_number,
    CASE JSONExtractInt(properties, 'bookId')
        WHEN 1 THEN 'Genesis'
        WHEN 19 THEN 'Psalms'
        WHEN 20 THEN 'Proverbs'
        WHEN 43 THEN 'John'
        WHEN 45 THEN 'Romans'
        WHEN 46 THEN '1 Corinthians'
        ELSE concat('Book ', toString(JSONExtractInt(properties, 'bookId')))
    END AS book_name,
    count(*) AS share_count,
    count(DISTINCT distinct_id) AS unique_sharers
FROM events
WHERE
    event = 'CHAPTER_SHARED'
    AND timestamp >= now() - INTERVAL 30 DAY
GROUP BY book_id, chapter_number
ORDER BY share_count DESC
LIMIT 15;

-- Share rate by book (shares / views for that book)
SELECT
    COALESCE(s.book_id, v.book_id) AS book_id,
    COALESCE(s.share_count, 0) AS shares,
    COALESCE(v.view_count, 0) AS views,
    round(
        COALESCE(s.share_count, 0) * 100.0 / nullIf(COALESCE(v.view_count, 0), 0),
        2
    ) AS share_rate_pct
FROM (
    SELECT
        JSONExtractInt(properties, 'bookId') AS book_id,
        count(*) AS share_count
    FROM events
    WHERE
        event = 'CHAPTER_SHARED'
        AND timestamp >= now() - INTERVAL 30 DAY
    GROUP BY book_id
) s
FULL OUTER JOIN (
    SELECT
        JSONExtractInt(properties, 'bookId') AS book_id,
        count(*) AS view_count
    FROM events
    WHERE
        event = 'CHAPTER_VIEWED'
        AND timestamp >= now() - INTERVAL 30 DAY
    GROUP BY book_id
) v ON s.book_id = v.book_id
WHERE COALESCE(v.view_count, 0) >= 10
ORDER BY share_rate_pct DESC
LIMIT 10;
