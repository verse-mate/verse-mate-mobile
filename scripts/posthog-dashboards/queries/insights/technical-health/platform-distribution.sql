-- Insight: Pie Chart - Platform Distribution
-- Dashboard: Technical Health
-- Visualization: Pie chart (iOS vs Android)
-- Time window: Last 7 days
-- Description: Distribution of users by platform using PostHog's built-in $os property.
--              Helps prioritize platform-specific development and QA.

-- Platform distribution by events
SELECT
    properties.$os AS platform,
    count(*) AS event_count,
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
WHERE timestamp >= now() - INTERVAL 7 DAY
GROUP BY platform
ORDER BY unique_users DESC;

-- Platform trend over time
SELECT
    toDate(timestamp) AS day,
    properties.$os AS platform,
    count(DISTINCT distinct_id) AS unique_users
FROM events
WHERE timestamp >= now() - INTERVAL 7 DAY
GROUP BY day, platform
ORDER BY day, platform;

-- Active chapters per platform (engagement comparison)
SELECT
    properties.$os AS platform,
    countIf(event = 'CHAPTER_VIEWED') AS chapters_viewed,
    count(DISTINCT distinct_id) AS unique_users,
    round(
        countIf(event = 'CHAPTER_VIEWED') * 1.0
        / nullIf(count(DISTINCT distinct_id), 0),
        1
    ) AS chapters_per_user
FROM events
WHERE
    timestamp >= now() - INTERVAL 7 DAY
    AND properties.$os IS NOT NULL
GROUP BY platform
ORDER BY chapters_viewed DESC;
