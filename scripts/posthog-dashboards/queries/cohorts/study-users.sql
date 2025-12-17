-- Cohort: Feature-Based - Study Users
-- Description: Users with >3 combined bookmark/highlight/note events in the last 7 days
--
-- This cohort identifies users who actively use study features beyond just reading.
-- Study users are valuable for:
-- - Understanding deep engagement patterns
-- - Testing study-focused feature enhancements
-- - Identifying high-value user behaviors

SELECT DISTINCT person_id
FROM events
WHERE
  event IN ('BOOKMARK_ADDED', 'HIGHLIGHT_CREATED', 'NOTE_CREATED')
  AND timestamp >= now() - INTERVAL 7 DAY
GROUP BY person_id
HAVING count(*) > 3
