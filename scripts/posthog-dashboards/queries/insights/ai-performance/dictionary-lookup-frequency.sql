-- Insight: Bar Chart - Dictionary Lookup Frequency
-- Dashboard: AI Feature Performance
-- Visualization: Bar chart by language
-- Time window: Last 7 days
-- Description: Tracks DICTIONARY_LOOKUP events segmented by language (greek/hebrew).
--              Uses language property to show distribution.
--              Helps understand which language resources are most valuable to users.

-- Lookup by language
SELECT
    JSONExtractString(properties, 'language') AS language,
    count(*) AS lookup_count,
    count(DISTINCT distinct_id) AS unique_users,
    round(
        count(*) * 100.0 / nullIf((
            SELECT count(*)
            FROM events
            WHERE event = 'DICTIONARY_LOOKUP'
              AND timestamp >= now() - INTERVAL 7 DAY
        ), 0),
        1
    ) AS percentage
FROM events
WHERE
    event = 'DICTIONARY_LOOKUP'
    AND timestamp >= now() - INTERVAL 7 DAY
GROUP BY language
ORDER BY lookup_count DESC;

-- Daily lookup trend by language
SELECT
    toDate(timestamp) AS day,
    JSONExtractString(properties, 'language') AS language,
    count(*) AS lookups
FROM events
WHERE
    event = 'DICTIONARY_LOOKUP'
    AND timestamp >= now() - INTERVAL 7 DAY
GROUP BY day, language
ORDER BY day, language;

-- Per-user lookup engagement
SELECT
    round(avg(lookup_count), 1) AS avg_lookups_per_user,
    quantile(0.5)(lookup_count) AS median_lookups_per_user,
    max(lookup_count) AS max_lookups_per_user,
    count(*) AS users_who_looked_up
FROM (
    SELECT
        distinct_id,
        count(*) AS lookup_count
    FROM events
    WHERE
        event = 'DICTIONARY_LOOKUP'
        AND timestamp >= now() - INTERVAL 7 DAY
    GROUP BY distinct_id
);

-- User adoption rate for dictionary feature
SELECT
    count(DISTINCT CASE WHEN event = 'DICTIONARY_LOOKUP' THEN distinct_id END) AS users_using_dictionary,
    count(DISTINCT CASE WHEN event = 'CHAPTER_VIEWED' THEN distinct_id END) AS active_readers,
    round(
        count(DISTINCT CASE WHEN event = 'DICTIONARY_LOOKUP' THEN distinct_id END) * 100.0
        / nullIf(count(DISTINCT CASE WHEN event = 'CHAPTER_VIEWED' THEN distinct_id END), 0),
        1
    ) AS adoption_rate_pct
FROM events
WHERE
    event IN ('DICTIONARY_LOOKUP', 'CHAPTER_VIEWED')
    AND timestamp >= now() - INTERVAL 7 DAY;
