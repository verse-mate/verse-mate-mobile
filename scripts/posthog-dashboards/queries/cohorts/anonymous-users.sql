-- Cohort: Demographic - Anonymous Users
-- Description: Users with is_registered = false
--
-- This cohort identifies users who have not created an account.
-- Anonymous users are important for:
-- - Understanding anonymous vs registered engagement differences
-- - Measuring signup conversion opportunities
-- - Testing registration prompts and incentives

SELECT DISTINCT person_id
FROM persons
WHERE
  properties.is_registered = false
