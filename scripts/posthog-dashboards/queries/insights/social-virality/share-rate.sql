-- Insight: Number - Share Rate Per Active User
-- Dashboard: Social & Virality
-- Visualization: Number card with trend
-- Time window: Last 30 days
-- Description: Average shares per active user.
--              Formula: Total shares / unique active users
--              Higher rates indicate users find content worth sharing.
--              Target: >0.1 shares per user (10% of users share at least once).

WITH active_users AS (
    SELECT count(DISTINCT distinct_id) AS total_active
    FROM events
    WHERE
        timestamp >= now() - INTERVAL 30 DAY
        AND event IN ('CHAPTER_VIEWED', 'BOOKMARK_ADDED', 'HIGHLIGHT_CREATED', 'NOTE_CREATED')
),
shares AS (
    SELECT
        count(*) AS total_shares,
        count(DISTINCT distinct_id) AS sharers
    FROM events
    WHERE
        event IN ('CHAPTER_SHARED', 'TOPIC_SHARED')
        AND timestamp >= now() - INTERVAL 30 DAY
)
SELECT
    shares.total_shares,
    active_users.total_active AS active_users,
    shares.sharers AS unique_sharers,
    round(shares.total_shares * 1.0 / nullIf(active_users.total_active, 0), 3) AS shares_per_active_user,
    round(shares.sharers * 100.0 / nullIf(active_users.total_active, 0), 1) AS sharer_rate_pct
FROM shares, active_users;

-- Weekly share rate trend
SELECT
    toStartOfWeek(timestamp) AS week,
    count(DISTINCT CASE WHEN event IN ('CHAPTER_SHARED', 'TOPIC_SHARED') THEN distinct_id END) AS sharers,
    count(DISTINCT CASE WHEN event = 'CHAPTER_VIEWED' THEN distinct_id END) AS active_users,
    round(
        count(DISTINCT CASE WHEN event IN ('CHAPTER_SHARED', 'TOPIC_SHARED') THEN distinct_id END) * 100.0
        / nullIf(count(DISTINCT CASE WHEN event = 'CHAPTER_VIEWED' THEN distinct_id END), 0),
        1
    ) AS sharer_rate_pct,
    countIf(event IN ('CHAPTER_SHARED', 'TOPIC_SHARED')) AS total_shares
FROM events
WHERE
    event IN ('CHAPTER_SHARED', 'TOPIC_SHARED', 'CHAPTER_VIEWED')
    AND timestamp >= now() - INTERVAL 30 DAY
GROUP BY week
ORDER BY week;
