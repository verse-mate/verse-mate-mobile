-- Cohort: Social - Sharers
-- Description: Users with any CHAPTER_SHARED or TOPIC_SHARED event in the last 30 days
--
-- This cohort identifies users who share content from the app.
-- Sharers are important for:
-- - Understanding organic growth potential
-- - Measuring social feature adoption
-- - Targeting with sharing-focused features

SELECT DISTINCT person_id
FROM events
WHERE
  event IN ('CHAPTER_SHARED', 'TOPIC_SHARED')
  AND timestamp >= now() - INTERVAL 30 DAY
