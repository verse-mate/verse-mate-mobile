-- Insight: Number - Chapters Per User
-- Dashboard: User Engagement
-- Visualization: Number card with trend comparison
-- Time window: Last 7 days
-- Description: Average number of chapters viewed per unique active user per week.
--              Formula: CHAPTER_VIEWED count / unique users
--              Healthy engagement: 5+ chapters/user/week indicates regular reading habit.

SELECT
    round(
        count(*) * 1.0 / nullIf(count(DISTINCT distinct_id), 0),
        1
    ) AS chapters_per_user,
    count(*) AS total_chapters_viewed,
    count(DISTINCT distinct_id) AS unique_users
FROM events
WHERE
    event = 'CHAPTER_VIEWED'
    AND timestamp >= now() - INTERVAL 7 DAY;

-- Daily trend for chapters per user
SELECT
    toDate(timestamp) AS day,
    round(
        count(*) * 1.0 / nullIf(count(DISTINCT distinct_id), 0),
        1
    ) AS chapters_per_user,
    count(*) AS total_chapters,
    count(DISTINCT distinct_id) AS unique_users
FROM events
WHERE
    event = 'CHAPTER_VIEWED'
    AND timestamp >= now() - INTERVAL 7 DAY
GROUP BY day
ORDER BY day;
