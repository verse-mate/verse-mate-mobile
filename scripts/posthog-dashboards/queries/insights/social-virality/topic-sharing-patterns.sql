-- Insight: Table - Topic Sharing Patterns
-- Dashboard: Social & Virality
-- Visualization: Table showing top shared topics
-- Time window: Last 30 days
-- Description: Analyzes which topic categories and slugs are shared most.
--              Uses TOPIC_SHARED event with category and topicSlug properties.
--              Helps identify popular topical content for content strategy.

-- Most shared categories
SELECT
    JSONExtractString(properties, 'category') AS category,
    count(*) AS share_count,
    count(DISTINCT distinct_id) AS unique_sharers,
    round(
        count(*) * 100.0 / nullIf((
            SELECT count(*)
            FROM events
            WHERE event = 'TOPIC_SHARED'
              AND timestamp >= now() - INTERVAL 30 DAY
        ), 0),
        1
    ) AS percentage
FROM events
WHERE
    event = 'TOPIC_SHARED'
    AND timestamp >= now() - INTERVAL 30 DAY
    AND JSONExtractString(properties, 'category') != ''
GROUP BY category
ORDER BY share_count DESC
LIMIT 10;

-- Most shared specific topics
SELECT
    JSONExtractString(properties, 'category') AS category,
    JSONExtractString(properties, 'topicSlug') AS topic_slug,
    count(*) AS share_count,
    count(DISTINCT distinct_id) AS unique_sharers
FROM events
WHERE
    event = 'TOPIC_SHARED'
    AND timestamp >= now() - INTERVAL 30 DAY
    AND JSONExtractString(properties, 'topicSlug') != ''
GROUP BY category, topic_slug
ORDER BY share_count DESC
LIMIT 15;

-- Topic sharing trend by category
SELECT
    toStartOfWeek(timestamp) AS week,
    JSONExtractString(properties, 'category') AS category,
    count(*) AS shares
FROM events
WHERE
    event = 'TOPIC_SHARED'
    AND timestamp >= now() - INTERVAL 30 DAY
    AND JSONExtractString(properties, 'category') != ''
GROUP BY week, category
ORDER BY week, shares DESC;

-- Chapter vs Topic share comparison
SELECT
    'Chapter Shares' AS share_type,
    count(*) AS share_count,
    count(DISTINCT distinct_id) AS unique_sharers
FROM events
WHERE
    event = 'CHAPTER_SHARED'
    AND timestamp >= now() - INTERVAL 30 DAY

UNION ALL

SELECT
    'Topic Shares' AS share_type,
    count(*) AS share_count,
    count(DISTINCT distinct_id) AS unique_sharers
FROM events
WHERE
    event = 'TOPIC_SHARED'
    AND timestamp >= now() - INTERVAL 30 DAY
ORDER BY share_count DESC;
