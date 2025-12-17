-- Cohort: Lifecycle - New Users
-- Description: Users where first_seen_at is within the last 7 days
--
-- This cohort identifies recently acquired users who are in their onboarding phase.
-- New users are essential for:
-- - Tracking activation funnel performance
-- - Understanding first-week engagement patterns
-- - Optimizing onboarding experience

SELECT DISTINCT person_id
FROM persons
WHERE
  -- User has a first_seen_at value
  properties.first_seen_at IS NOT NULL
  -- And it was within the last 7 days
  AND parseDateTimeBestEffort(properties.first_seen_at) >= now() - INTERVAL 7 DAY
