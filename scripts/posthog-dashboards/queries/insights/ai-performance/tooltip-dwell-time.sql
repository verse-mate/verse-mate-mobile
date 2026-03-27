-- Insight: Histogram - Tooltip Dwell Time Distribution
-- Dashboard: AI Feature Performance
-- Visualization: Bar chart with time buckets
-- Time window: Last 7 days
-- Description: Distribution of how long users spend reading tooltips.
--              Uses TOOLTIP_READING_DURATION event with duration_seconds property.
--              Buckets: 3-10s (quick glance), 10-30s (reading), 30-60s (studying), 60s+ (deep study)
--              Note: 3s minimum threshold is already applied by the tracking logic.

SELECT
    CASE
        WHEN JSONExtractFloat(properties, 'duration_seconds') < 10 THEN '3-10s (Quick)'
        WHEN JSONExtractFloat(properties, 'duration_seconds') < 30 THEN '10-30s (Reading)'
        WHEN JSONExtractFloat(properties, 'duration_seconds') < 60 THEN '30-60s (Studying)'
        ELSE '60s+ (Deep Study)'
    END AS dwell_time_bucket,
    count(*) AS tooltip_count,
    round(
        count(*) * 100.0 / nullIf((
            SELECT count(*)
            FROM events
            WHERE event = 'TOOLTIP_READING_DURATION'
              AND timestamp >= now() - INTERVAL 7 DAY
        ), 0),
        1
    ) AS percentage
FROM events
WHERE
    event = 'TOOLTIP_READING_DURATION'
    AND timestamp >= now() - INTERVAL 7 DAY
    AND JSONExtractFloat(properties, 'duration_seconds') >= 3
GROUP BY dwell_time_bucket
ORDER BY
    CASE dwell_time_bucket
        WHEN '3-10s (Quick)' THEN 1
        WHEN '10-30s (Reading)' THEN 2
        WHEN '30-60s (Studying)' THEN 3
        WHEN '60s+ (Deep Study)' THEN 4
    END;

-- Tooltip dwell time statistics
SELECT
    round(avg(JSONExtractFloat(properties, 'duration_seconds')), 1) AS avg_dwell_seconds,
    round(quantile(0.5)(JSONExtractFloat(properties, 'duration_seconds')), 1) AS median_dwell_seconds,
    round(quantile(0.9)(JSONExtractFloat(properties, 'duration_seconds')), 1) AS p90_dwell_seconds,
    count(*) AS total_tooltips
FROM events
WHERE
    event = 'TOOLTIP_READING_DURATION'
    AND timestamp >= now() - INTERVAL 7 DAY
    AND JSONExtractFloat(properties, 'duration_seconds') >= 3;
