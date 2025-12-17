-- Cohort: Feature-Based - AI Users
-- Description: Users with >5 VERSEMATE_TOOLTIP_OPENED events in the last 7 days
--
-- This cohort identifies users who actively engage with AI-powered explanations.
-- AI users are important for:
-- - Understanding AI feature adoption
-- - Testing AI feature improvements
-- - Measuring the value of AI explanations to user engagement

SELECT DISTINCT person_id
FROM events
WHERE
  event = 'VERSEMATE_TOOLTIP_OPENED'
  AND timestamp >= now() - INTERVAL 7 DAY
GROUP BY person_id
HAVING count(*) > 5
