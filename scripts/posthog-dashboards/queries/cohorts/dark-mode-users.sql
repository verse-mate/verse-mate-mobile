-- Cohort: Demographic - Dark Mode Users
-- Description: Users with theme_preference = 'dark'
--
-- This cohort identifies users who prefer dark mode.
-- Dark mode users are useful for:
-- - Segmenting engagement by visual preference
-- - Testing dark mode specific UI improvements
-- - Understanding correlation between theme preference and usage patterns

SELECT DISTINCT person_id
FROM persons
WHERE
  properties.theme_preference = 'dark'
