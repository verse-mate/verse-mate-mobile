-- Cohort: Feature-Based - Feature Refiners
-- Description: Users with any HIGHLIGHT_EDITED or NOTE_EDITED events (all time)
--
-- This cohort identifies users who return to and refine their annotations,
-- indicating deep engagement with study features.
-- Feature refiners are valuable for:
-- - Understanding deep engagement behaviors
-- - Identifying users who get long-term value from features
-- - Testing advanced editing/organization features

SELECT DISTINCT person_id
FROM events
WHERE
  event IN ('HIGHLIGHT_EDITED', 'NOTE_EDITED')
