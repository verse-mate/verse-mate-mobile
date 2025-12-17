-- Insight: Pie Chart - Bible Version Popularity
-- Dashboard: User Engagement
-- Visualization: Pie chart or horizontal bar chart
-- Time window: Last 7 days
-- Description: Distribution of Bible versions used based on CHAPTER_VIEWED events.
--              Uses bibleVersion property (e.g., 'NASB1995', 'KJV', 'NIV').
--              Helps prioritize content and translation support.

SELECT
    JSONExtractString(properties, 'bibleVersion') AS bible_version,
    count(*) AS chapter_views,
    count(DISTINCT distinct_id) AS unique_users,
    round(
        count(*) * 100.0 / nullIf((
            SELECT count(*)
            FROM events
            WHERE event = 'CHAPTER_VIEWED'
              AND timestamp >= now() - INTERVAL 7 DAY
        ), 0),
        1
    ) AS percentage
FROM events
WHERE
    event = 'CHAPTER_VIEWED'
    AND timestamp >= now() - INTERVAL 7 DAY
    AND JSONExtractString(properties, 'bibleVersion') != ''
GROUP BY bible_version
ORDER BY chapter_views DESC
LIMIT 10;

-- Daily trend by top Bible versions
SELECT
    toDate(timestamp) AS day,
    JSONExtractString(properties, 'bibleVersion') AS bible_version,
    count(*) AS views
FROM events
WHERE
    event = 'CHAPTER_VIEWED'
    AND timestamp >= now() - INTERVAL 7 DAY
    AND JSONExtractString(properties, 'bibleVersion') IN (
        SELECT JSONExtractString(properties, 'bibleVersion')
        FROM events
        WHERE event = 'CHAPTER_VIEWED'
          AND timestamp >= now() - INTERVAL 7 DAY
        GROUP BY JSONExtractString(properties, 'bibleVersion')
        ORDER BY count(*) DESC
        LIMIT 5
    )
GROUP BY day, bible_version
ORDER BY day, views DESC;
