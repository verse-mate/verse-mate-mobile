-- Cohort: Social - Super Sharers
-- Description: Users in the top 10% of sharing activity (>3 shares in the last 30 days)
--
-- This cohort identifies highly social users who frequently share content.
-- Super sharers are valuable for:
-- - Understanding viral growth patterns
-- - Testing referral and social features
-- - Identifying potential brand ambassadors

SELECT DISTINCT person_id
FROM events
WHERE
  event IN ('CHAPTER_SHARED', 'TOPIC_SHARED')
  AND timestamp >= now() - INTERVAL 30 DAY
GROUP BY person_id
HAVING count(*) > 3
