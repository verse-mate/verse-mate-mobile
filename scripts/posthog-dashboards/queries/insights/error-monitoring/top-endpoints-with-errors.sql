-- Top Endpoints with Errors
-- Table showing top 10 API endpoints by error count
-- Uses endpoint property from react-query and network-error contexts

SELECT
  JSONExtractString(properties, 'endpoint') AS endpoint,
  JSONExtractString(properties, 'method') AS method,
  count() AS error_count,
  round(count() * 100.0 / sum(count()) OVER (), 2) AS percentage_of_errors,

  -- Most common status code for this endpoint
  topK(1)(JSONExtractInt(properties, 'statusCode'))[1] AS most_common_status

FROM events
WHERE event = '$exception'
  AND timestamp >= now() - INTERVAL 7 DAY
  AND timestamp < now()
  -- Only include errors with endpoint property
  AND JSONExtractString(properties, 'endpoint') != ''
  -- Exclude 401 (auth flow)
  AND (
    JSONExtractInt(properties, 'statusCode') IS NULL
    OR JSONExtractInt(properties, 'statusCode') != 401
  )
GROUP BY endpoint, method
ORDER BY error_count DESC
LIMIT 10
