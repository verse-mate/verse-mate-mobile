-- Cohort: Behavioral - Power Users
-- Description: Users with >7 CHAPTER_VIEWED events in the last 7 days AND at least one feature event
-- (bookmark, highlight, or note creation)
--
-- This cohort identifies highly engaged users who both read frequently and actively use
-- study features. These users are valuable for:
-- - Beta testing new features
-- - Understanding optimal engagement patterns
-- - Identifying behaviors to encourage in other user segments

SELECT DISTINCT person_id
FROM events
WHERE
  -- User has more than 7 chapter views in the last 7 days
  person_id IN (
    SELECT person_id
    FROM events
    WHERE
      event = 'CHAPTER_VIEWED'
      AND timestamp >= now() - INTERVAL 7 DAY
    GROUP BY person_id
    HAVING count(*) > 7
  )
  -- AND user has at least one feature event (bookmark/highlight/note) in the last 7 days
  AND person_id IN (
    SELECT person_id
    FROM events
    WHERE
      event IN ('BOOKMARK_ADDED', 'HIGHLIGHT_CREATED', 'NOTE_CREATED')
      AND timestamp >= now() - INTERVAL 7 DAY
    GROUP BY person_id
    HAVING count(*) >= 1
  )
