-- Cohort: Demographic - Multi-Language Users
-- Description: Users who have viewed chapters in multiple Bible versions
--
-- This cohort identifies users who use multiple Bible translations.
-- Multi-language users are valuable for:
-- - Understanding comparative study patterns
-- - Testing version comparison features
-- - Identifying power users who value translation diversity

SELECT DISTINCT person_id
FROM events
WHERE
  event = 'CHAPTER_VIEWED'
GROUP BY person_id
HAVING count(DISTINCT properties.bibleVersion) > 1
