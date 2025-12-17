-- Cohort: Behavioral - Regular Readers
-- Description: Users with 3-7 CHAPTER_VIEWED events in the last 7 days
--
-- This cohort identifies users with consistent but moderate reading habits.
-- Regular readers are a key segment for:
-- - Understanding healthy engagement patterns
-- - Targeting with feature discovery prompts
-- - Potential candidates for conversion to power users

SELECT DISTINCT person_id
FROM events
WHERE
  event = 'CHAPTER_VIEWED'
  AND timestamp >= now() - INTERVAL 7 DAY
GROUP BY person_id
HAVING count(*) >= 3 AND count(*) <= 7
