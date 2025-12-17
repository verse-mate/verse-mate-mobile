-- Insight: Number - Error Rate Health Indicator
-- Dashboard: Executive Overview
-- Visualization: Number card with RAG status (Red/Amber/Green)
-- Time window: Last 24 hours
-- Description: Health indicator showing error rate as percentage of all events.
--              Green: <1%, Yellow: 1-5%, Red: >5%
--              Note: Requires future error tracking implementation. Currently tracks
--              failed auth events and any $exception events if configured.

-- Error rate calculation (placeholder until error tracking is implemented)
-- Uses $exception events if captured by PostHog autocapture
SELECT
    round(
        countIf(event = '$exception' OR event LIKE '%error%' OR event LIKE '%Error%')
        * 100.0
        / nullIf(count(*), 0),
        2
    ) AS error_rate_pct,
    countIf(event = '$exception' OR event LIKE '%error%' OR event LIKE '%Error%') AS error_count,
    count(*) AS total_events,
    CASE
        WHEN countIf(event = '$exception' OR event LIKE '%error%' OR event LIKE '%Error%')
             * 100.0 / nullIf(count(*), 0) < 1 THEN 'green'
        WHEN countIf(event = '$exception' OR event LIKE '%error%' OR event LIKE '%Error%')
             * 100.0 / nullIf(count(*), 0) < 5 THEN 'yellow'
        ELSE 'red'
    END AS health_status
FROM events
WHERE timestamp >= now() - INTERVAL 24 HOUR;

-- Authentication failure rate (useful proxy until full error tracking)
-- This tracks auth attempts that may have issues
SELECT
    round(
        (countIf(event = 'LOGIN_COMPLETED') + countIf(event = 'SIGNUP_COMPLETED'))
        * 1.0 / nullIf(count(DISTINCT distinct_id), 0),
        2
    ) AS auth_events_per_user,
    count(DISTINCT distinct_id) AS unique_users_24h
FROM events
WHERE
    timestamp >= now() - INTERVAL 24 HOUR
    AND event IN ('LOGIN_COMPLETED', 'SIGNUP_COMPLETED', 'CHAPTER_VIEWED');
