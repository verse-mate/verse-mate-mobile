-- Cohort: Behavioral - Casual Readers
-- Description: Users with 1-2 CHAPTER_VIEWED events in the last 7 days
--
-- This cohort identifies users with light engagement who occasionally use the app.
-- Casual readers are important for:
-- - Understanding barriers to increased engagement
-- - Testing re-engagement campaigns
-- - Identifying features that could drive more frequent usage

SELECT DISTINCT person_id
FROM events
WHERE
  event = 'CHAPTER_VIEWED'
  AND timestamp >= now() - INTERVAL 7 DAY
GROUP BY person_id
HAVING count(*) >= 1 AND count(*) <= 2
