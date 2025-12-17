-- Insight: Histogram - Streak Distribution
-- Dashboard: Retention & Growth
-- Visualization: Bar chart with streak buckets
-- Time window: Current snapshot
-- Description: Distribution of user streak lengths using current_streak person property.
--              Buckets: 1 day, 2-3 days, 4-7 days, 8-14 days, 15-30 days, 30+ days
--              High streaks indicate strong habit formation and engagement.

-- Using person properties for current_streak
SELECT
    CASE
        WHEN toInt32OrNull(person.properties.current_streak) = 1 THEN '1 day'
        WHEN toInt32OrNull(person.properties.current_streak) BETWEEN 2 AND 3 THEN '2-3 days'
        WHEN toInt32OrNull(person.properties.current_streak) BETWEEN 4 AND 7 THEN '4-7 days'
        WHEN toInt32OrNull(person.properties.current_streak) BETWEEN 8 AND 14 THEN '8-14 days'
        WHEN toInt32OrNull(person.properties.current_streak) BETWEEN 15 AND 30 THEN '15-30 days'
        WHEN toInt32OrNull(person.properties.current_streak) > 30 THEN '30+ days'
        ELSE 'No streak'
    END AS streak_bucket,
    count(*) AS user_count,
    round(
        count(*) * 100.0 / nullIf((SELECT count(*) FROM persons), 0),
        1
    ) AS percentage
FROM persons AS person
WHERE person.properties.current_streak IS NOT NULL
GROUP BY streak_bucket
ORDER BY
    CASE streak_bucket
        WHEN '1 day' THEN 1
        WHEN '2-3 days' THEN 2
        WHEN '4-7 days' THEN 3
        WHEN '8-14 days' THEN 4
        WHEN '15-30 days' THEN 5
        WHEN '30+ days' THEN 6
        WHEN 'No streak' THEN 7
    END;

-- Streak statistics
SELECT
    avg(toInt32OrNull(person.properties.current_streak)) AS avg_streak,
    max(toInt32OrNull(person.properties.current_streak)) AS max_streak,
    quantile(0.5)(toInt32OrNull(person.properties.current_streak)) AS median_streak,
    count(*) AS users_with_streak
FROM persons AS person
WHERE person.properties.current_streak IS NOT NULL
  AND toInt32OrNull(person.properties.current_streak) > 0;
