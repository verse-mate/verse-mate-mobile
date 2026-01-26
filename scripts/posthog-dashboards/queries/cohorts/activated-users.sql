-- Cohort: Feature-Based - Activated Users
-- Description: Users who completed the activation funnel within their first 7 days
-- Activation funnel: SIGNUP_COMPLETED -> CHAPTER_VIEWED (within 24h) -> any feature event (within 7d)
--
-- This cohort identifies users who successfully onboarded and engaged with core features.
-- Activated users are critical for:
-- - Measuring onboarding effectiveness
-- - Understanding what drives successful user activation
-- - Comparing activated vs non-activated user retention

SELECT DISTINCT e1.person_id
FROM events e1
WHERE
  -- Step 1: User completed signup
  e1.event = 'SIGNUP_COMPLETED'
  -- Within user's first 7 days (based on first_seen_at)
  AND e1.person_id IN (
    SELECT person_id
    FROM persons
    WHERE
      properties.first_seen_at IS NOT NULL
      AND e1.timestamp >= parseDateTimeBestEffort(properties.first_seen_at)
      AND e1.timestamp <= parseDateTimeBestEffort(properties.first_seen_at) + INTERVAL 7 DAY
  )
  -- Step 2: Viewed a chapter within 24 hours of signup
  AND e1.person_id IN (
    SELECT e2.person_id
    FROM events e2
    INNER JOIN events signup ON signup.person_id = e2.person_id AND signup.event = 'SIGNUP_COMPLETED'
    WHERE
      e2.event = 'CHAPTER_VIEWED'
      AND e2.timestamp >= signup.timestamp
      AND e2.timestamp <= signup.timestamp + INTERVAL 24 HOUR
  )
  -- Step 3: Had any feature event within 7 days of signup
  AND e1.person_id IN (
    SELECT e3.person_id
    FROM events e3
    INNER JOIN events signup ON signup.person_id = e3.person_id AND signup.event = 'SIGNUP_COMPLETED'
    WHERE
      e3.event IN ('BOOKMARK_ADDED', 'HIGHLIGHT_CREATED', 'NOTE_CREATED')
      AND e3.timestamp >= signup.timestamp
      AND e3.timestamp <= signup.timestamp + INTERVAL 7 DAY
  )
