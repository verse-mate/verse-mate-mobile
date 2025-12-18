-- Errors by Source
-- Breakdown of errors by source: error-boundary, react-query, network-error, backend
-- Uses captured properties to identify error origin

SELECT
  CASE
    -- Error boundary errors have componentStack property
    WHEN properties.$exception_componentStack IS NOT NULL
      OR JSONExtractString(properties, 'componentStack') != ''
    THEN 'error-boundary'

    -- React Query errors have source = 'react-query'
    WHEN JSONExtractString(properties, 'source') = 'react-query'
    THEN 'react-query'

    -- Network errors have context = 'network-error'
    WHEN JSONExtractString(properties, 'context') = 'network-error'
    THEN 'network-error'

    -- Backend errors (platform property or server-side)
    WHEN properties.$os IS NULL
      OR JSONExtractString(properties, 'platform') = 'backend'
    THEN 'backend'

    -- Uncategorized
    ELSE 'other'
  END AS error_source,

  count() AS error_count,
  round(count() * 100.0 / sum(count()) OVER (), 2) AS percentage

FROM events
WHERE event = '$exception'
  AND timestamp >= now() - INTERVAL 7 DAY
  AND timestamp < now()
GROUP BY error_source
ORDER BY error_count DESC
