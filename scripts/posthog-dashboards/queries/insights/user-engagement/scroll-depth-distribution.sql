-- Insight: Histogram - Scroll Depth Distribution
-- Dashboard: User Engagement
-- Visualization: Bar chart with 4 buckets
-- Time window: Last 7 days
-- Description: Distribution of how far users scroll through chapters.
--              Buckets: 0-25% (bounced), 25-50% (partial), 50-75% (engaged), 75-100% (completed)
--              Uses CHAPTER_SCROLL_DEPTH event with maxScrollDepthPercent property.
--              High 75-100% indicates engaging content, high 0-25% indicates content issues.

SELECT
    CASE
        WHEN JSONExtractFloat(properties, 'maxScrollDepthPercent') < 25 THEN '0-25%'
        WHEN JSONExtractFloat(properties, 'maxScrollDepthPercent') < 50 THEN '25-50%'
        WHEN JSONExtractFloat(properties, 'maxScrollDepthPercent') < 75 THEN '50-75%'
        ELSE '75-100%'
    END AS scroll_depth_bucket,
    count(*) AS session_count,
    round(
        count(*) * 100.0 / nullIf((
            SELECT count(*)
            FROM events
            WHERE event = 'CHAPTER_SCROLL_DEPTH'
              AND timestamp >= now() - INTERVAL 7 DAY
        ), 0),
        1
    ) AS percentage
FROM events
WHERE
    event = 'CHAPTER_SCROLL_DEPTH'
    AND timestamp >= now() - INTERVAL 7 DAY
GROUP BY scroll_depth_bucket
ORDER BY
    CASE scroll_depth_bucket
        WHEN '0-25%' THEN 1
        WHEN '25-50%' THEN 2
        WHEN '50-75%' THEN 3
        WHEN '75-100%' THEN 4
    END;

-- Average scroll depth by day
SELECT
    toDate(timestamp) AS day,
    round(avg(JSONExtractFloat(properties, 'maxScrollDepthPercent')), 1) AS avg_scroll_depth,
    count(*) AS total_sessions
FROM events
WHERE
    event = 'CHAPTER_SCROLL_DEPTH'
    AND timestamp >= now() - INTERVAL 7 DAY
GROUP BY day
ORDER BY day;
