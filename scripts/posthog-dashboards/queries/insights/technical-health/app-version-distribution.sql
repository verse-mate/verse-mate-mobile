-- Insight: Pie Chart - App Version Distribution
-- Dashboard: Technical Health
-- Visualization: Pie chart or table
-- Time window: Last 7 days
-- Description: Distribution of app versions to monitor rollout adoption.
--              Uses PostHog's $app_version property.
--              Helps track update adoption and identify users on old versions.

-- App version distribution
SELECT
    properties.$app_version AS app_version,
    count(*) AS event_count,
    count(DISTINCT distinct_id) AS unique_users,
    round(
        count(DISTINCT distinct_id) * 100.0 / nullIf((
            SELECT count(DISTINCT distinct_id)
            FROM events
            WHERE timestamp >= now() - INTERVAL 7 DAY
              AND properties.$app_version IS NOT NULL
        ), 0),
        1
    ) AS user_percentage
FROM events
WHERE
    timestamp >= now() - INTERVAL 7 DAY
    AND properties.$app_version IS NOT NULL
GROUP BY app_version
ORDER BY unique_users DESC
LIMIT 10;

-- App version adoption over time
SELECT
    toDate(timestamp) AS day,
    properties.$app_version AS app_version,
    count(DISTINCT distinct_id) AS unique_users
FROM events
WHERE
    timestamp >= now() - INTERVAL 7 DAY
    AND properties.$app_version IS NOT NULL
    AND properties.$app_version IN (
        SELECT properties.$app_version
        FROM events
        WHERE timestamp >= now() - INTERVAL 7 DAY
          AND properties.$app_version IS NOT NULL
        GROUP BY properties.$app_version
        ORDER BY count(DISTINCT distinct_id) DESC
        LIMIT 5
    )
GROUP BY day, app_version
ORDER BY day, unique_users DESC;

-- Latest version adoption rate
SELECT
    max(properties.$app_version) AS latest_version,
    count(DISTINCT CASE
        WHEN properties.$app_version = (
            SELECT max(properties.$app_version)
            FROM events
            WHERE timestamp >= now() - INTERVAL 7 DAY
              AND properties.$app_version IS NOT NULL
        )
        THEN distinct_id
    END) AS users_on_latest,
    count(DISTINCT distinct_id) AS total_users,
    round(
        count(DISTINCT CASE
            WHEN properties.$app_version = (
                SELECT max(properties.$app_version)
                FROM events
                WHERE timestamp >= now() - INTERVAL 7 DAY
                  AND properties.$app_version IS NOT NULL
            )
            THEN distinct_id
        END) * 100.0 / nullIf(count(DISTINCT distinct_id), 0),
        1
    ) AS adoption_rate_pct
FROM events
WHERE
    timestamp >= now() - INTERVAL 7 DAY
    AND properties.$app_version IS NOT NULL;
