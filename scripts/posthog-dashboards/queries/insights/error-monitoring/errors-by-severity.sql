-- Errors by Severity
-- Group errors into severity buckets based on HTTP status codes
-- Buckets: 4xx (client errors), 5xx (server errors), crash (error boundary/unhandled)
-- Excludes 401 errors (auth flow - expected behavior)

SELECT
  CASE
    -- Crash: Error boundary triggers (no status code, has component stack)
    WHEN (
      JSONExtractInt(properties, 'statusCode') = 0
      OR JSONExtractInt(properties, 'statusCode') IS NULL
    ) AND (
      properties.$exception_componentStack IS NOT NULL
      OR JSONExtractString(properties, 'componentStack') != ''
    )
    THEN 'crash'

    -- 5xx: Server errors
    WHEN JSONExtractInt(properties, 'statusCode') >= 500
      AND JSONExtractInt(properties, 'statusCode') < 600
    THEN '5xx'

    -- 4xx: Client errors (excluding 401 auth flow)
    WHEN JSONExtractInt(properties, 'statusCode') >= 400
      AND JSONExtractInt(properties, 'statusCode') < 500
      AND JSONExtractInt(properties, 'statusCode') != 401
    THEN '4xx'

    -- Unclassified errors (network failures, etc)
    ELSE 'other'
  END AS severity,

  count() AS error_count,
  round(count() * 100.0 / sum(count()) OVER (), 2) AS percentage

FROM events
WHERE event = '$exception'
  AND timestamp >= now() - INTERVAL 7 DAY
  AND timestamp < now()
  -- Exclude 401 (auth flow)
  AND (
    JSONExtractInt(properties, 'statusCode') IS NULL
    OR JSONExtractInt(properties, 'statusCode') != 401
  )
GROUP BY severity
ORDER BY error_count DESC
