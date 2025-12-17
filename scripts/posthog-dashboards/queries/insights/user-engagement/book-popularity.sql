-- Insight: Table - Book Popularity (Top 10)
-- Dashboard: User Engagement
-- Visualization: Table or horizontal bar chart
-- Time window: Last 7 days
-- Description: Top 10 most-read Bible books based on CHAPTER_VIEWED events.
--              Uses bookId property (1-66, corresponding to Genesis-Revelation).
--              Helps understand reading patterns and popular content.

-- Book name mapping for reference:
-- 1=Genesis, 2=Exodus, 19=Psalms, 20=Proverbs, 23=Isaiah,
-- 40=Matthew, 41=Mark, 42=Luke, 43=John, 44=Acts,
-- 45=Romans, 66=Revelation

SELECT
    JSONExtractInt(properties, 'bookId') AS book_id,
    CASE JSONExtractInt(properties, 'bookId')
        WHEN 1 THEN 'Genesis'
        WHEN 2 THEN 'Exodus'
        WHEN 3 THEN 'Leviticus'
        WHEN 4 THEN 'Numbers'
        WHEN 5 THEN 'Deuteronomy'
        WHEN 6 THEN 'Joshua'
        WHEN 7 THEN 'Judges'
        WHEN 8 THEN 'Ruth'
        WHEN 9 THEN '1 Samuel'
        WHEN 10 THEN '2 Samuel'
        WHEN 11 THEN '1 Kings'
        WHEN 12 THEN '2 Kings'
        WHEN 13 THEN '1 Chronicles'
        WHEN 14 THEN '2 Chronicles'
        WHEN 15 THEN 'Ezra'
        WHEN 16 THEN 'Nehemiah'
        WHEN 17 THEN 'Esther'
        WHEN 18 THEN 'Job'
        WHEN 19 THEN 'Psalms'
        WHEN 20 THEN 'Proverbs'
        WHEN 21 THEN 'Ecclesiastes'
        WHEN 22 THEN 'Song of Solomon'
        WHEN 23 THEN 'Isaiah'
        WHEN 24 THEN 'Jeremiah'
        WHEN 25 THEN 'Lamentations'
        WHEN 26 THEN 'Ezekiel'
        WHEN 27 THEN 'Daniel'
        WHEN 28 THEN 'Hosea'
        WHEN 29 THEN 'Joel'
        WHEN 30 THEN 'Amos'
        WHEN 31 THEN 'Obadiah'
        WHEN 32 THEN 'Jonah'
        WHEN 33 THEN 'Micah'
        WHEN 34 THEN 'Nahum'
        WHEN 35 THEN 'Habakkuk'
        WHEN 36 THEN 'Zephaniah'
        WHEN 37 THEN 'Haggai'
        WHEN 38 THEN 'Zechariah'
        WHEN 39 THEN 'Malachi'
        WHEN 40 THEN 'Matthew'
        WHEN 41 THEN 'Mark'
        WHEN 42 THEN 'Luke'
        WHEN 43 THEN 'John'
        WHEN 44 THEN 'Acts'
        WHEN 45 THEN 'Romans'
        WHEN 46 THEN '1 Corinthians'
        WHEN 47 THEN '2 Corinthians'
        WHEN 48 THEN 'Galatians'
        WHEN 49 THEN 'Ephesians'
        WHEN 50 THEN 'Philippians'
        WHEN 51 THEN 'Colossians'
        WHEN 52 THEN '1 Thessalonians'
        WHEN 53 THEN '2 Thessalonians'
        WHEN 54 THEN '1 Timothy'
        WHEN 55 THEN '2 Timothy'
        WHEN 56 THEN 'Titus'
        WHEN 57 THEN 'Philemon'
        WHEN 58 THEN 'Hebrews'
        WHEN 59 THEN 'James'
        WHEN 60 THEN '1 Peter'
        WHEN 61 THEN '2 Peter'
        WHEN 62 THEN '1 John'
        WHEN 63 THEN '2 John'
        WHEN 64 THEN '3 John'
        WHEN 65 THEN 'Jude'
        WHEN 66 THEN 'Revelation'
        ELSE 'Unknown'
    END AS book_name,
    count(*) AS chapter_views,
    count(DISTINCT distinct_id) AS unique_readers,
    count(DISTINCT JSONExtractInt(properties, 'chapterNumber')) AS chapters_read
FROM events
WHERE
    event = 'CHAPTER_VIEWED'
    AND timestamp >= now() - INTERVAL 7 DAY
    AND JSONExtractInt(properties, 'bookId') > 0
GROUP BY book_id
ORDER BY chapter_views DESC
LIMIT 10;
