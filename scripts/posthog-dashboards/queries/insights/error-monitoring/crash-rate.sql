-- Crash Rate
-- Error boundary trigger rate as percentage of unique sessions
-- Traffic-light status: green (<0.1%), yellow (0.1-0.5%), red (>0.5%)
-- Identifies error boundary crashes by componentStack property

SELECT
  -- Crash rate calculation
  round(
    countDistinctIf(
      properties.$session_id,
      properties.$exception_componentStack IS NOT NULL
      OR JSONExtractString(properties, 'componentStack') != ''
    ) * 100.0 / nullIf(countDistinct(properties.$session_id), 0),
    3
  ) AS crash_rate_percent,

  -- Absolute counts for context
  countDistinctIf(
    properties.$session_id,
    properties.$exception_componentStack IS NOT NULL
    OR JSONExtractString(properties, 'componentStack') != ''
  ) AS sessions_with_crashes,

  countDistinct(properties.$session_id) AS total_sessions

FROM events
WHERE timestamp >= now() - INTERVAL 7 DAY
  AND timestamp < now()
  AND properties.$session_id IS NOT NULL
