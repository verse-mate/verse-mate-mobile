-- Insight: World Map - Geographic Distribution
-- Dashboard: Technical Health
-- Visualization: World map or bar chart by country
-- Time window: Last 7 days
-- Description: Distribution of users by country using person property.
--              Uses country user property set during identification.
--              Helps understand geographic reach and prioritize localization.

-- User distribution by country (from person properties)
SELECT
    person.properties.country AS country,
    count(DISTINCT e.distinct_id) AS unique_users,
    count(*) AS event_count,
    round(
        count(DISTINCT e.distinct_id) * 100.0 / nullIf((
            SELECT count(DISTINCT distinct_id)
            FROM events
            WHERE timestamp >= now() - INTERVAL 7 DAY
        ), 0),
        1
    ) AS user_percentage
FROM events e
LEFT JOIN persons person ON e.distinct_id = person.distinct_id
WHERE
    e.timestamp >= now() - INTERVAL 7 DAY
    AND person.properties.country IS NOT NULL
GROUP BY country
ORDER BY unique_users DESC
LIMIT 20;

-- Geographic distribution using PostHog's geoip data
SELECT
    properties.$geoip_country_code AS country_code,
    properties.$geoip_country_name AS country_name,
    count(DISTINCT distinct_id) AS unique_users,
    round(
        count(DISTINCT distinct_id) * 100.0 / nullIf((
            SELECT count(DISTINCT distinct_id)
            FROM events
            WHERE timestamp >= now() - INTERVAL 7 DAY
        ), 0),
        1
    ) AS user_percentage
FROM events
WHERE
    timestamp >= now() - INTERVAL 7 DAY
    AND properties.$geoip_country_code IS NOT NULL
GROUP BY country_code, country_name
ORDER BY unique_users DESC
LIMIT 20;

-- Engagement by country (chapters per user)
SELECT
    properties.$geoip_country_code AS country_code,
    count(DISTINCT distinct_id) AS unique_users,
    countIf(event = 'CHAPTER_VIEWED') AS chapters_viewed,
    round(
        countIf(event = 'CHAPTER_VIEWED') * 1.0
        / nullIf(count(DISTINCT distinct_id), 0),
        1
    ) AS chapters_per_user
FROM events
WHERE
    timestamp >= now() - INTERVAL 7 DAY
    AND properties.$geoip_country_code IS NOT NULL
GROUP BY country_code
HAVING unique_users >= 10
ORDER BY chapters_per_user DESC
LIMIT 10;
