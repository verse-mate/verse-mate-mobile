-- Insight: Number - Median Reading Duration
-- Dashboard: User Engagement
-- Visualization: Number card (in minutes)
-- Time window: Last 7 days
-- Description: Median time spent reading chapters (uses CHAPTER_READING_DURATION event).
--              Median is preferred over average to avoid skew from outliers.
--              Good engagement: 3-10 minutes indicates meaningful reading.
--              >15 minutes may indicate distraction or app left open.

-- Median reading duration in seconds
SELECT
    quantile(0.5)(JSONExtractFloat(properties, 'duration_seconds')) AS median_duration_seconds,
    quantile(0.5)(JSONExtractFloat(properties, 'duration_seconds')) / 60.0 AS median_duration_minutes,
    quantile(0.25)(JSONExtractFloat(properties, 'duration_seconds')) AS p25_duration_seconds,
    quantile(0.75)(JSONExtractFloat(properties, 'duration_seconds')) AS p75_duration_seconds,
    count(*) AS total_reading_sessions
FROM events
WHERE
    event = 'CHAPTER_READING_DURATION'
    AND timestamp >= now() - INTERVAL 7 DAY
    AND JSONExtractFloat(properties, 'duration_seconds') > 0;

-- Daily median reading duration trend
SELECT
    toDate(timestamp) AS day,
    round(quantile(0.5)(JSONExtractFloat(properties, 'duration_seconds')) / 60.0, 1) AS median_minutes,
    count(*) AS sessions
FROM events
WHERE
    event = 'CHAPTER_READING_DURATION'
    AND timestamp >= now() - INTERVAL 7 DAY
    AND JSONExtractFloat(properties, 'duration_seconds') > 0
GROUP BY day
ORDER BY day;
