-- Cohort: Lifecycle - Dormant Users
-- Description: Users whose last activity was more than 14 days ago based on last_seen_at property
--
-- This cohort identifies users who have become inactive and may be at risk of churning.
-- Dormant users are critical for:
-- - Re-engagement campaigns
-- - Understanding churn patterns
-- - Measuring resurrection rate when they return

SELECT DISTINCT person_id
FROM persons
WHERE
  -- User has a last_seen_at value
  properties.last_seen_at IS NOT NULL
  -- And it was more than 14 days ago
  AND parseDateTimeBestEffort(properties.last_seen_at) < now() - INTERVAL 14 DAY
