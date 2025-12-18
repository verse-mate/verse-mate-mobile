-- Server Error Rate Trend (5xx)
-- Trend line showing 5xx error rate over time with daily granularity
-- Helps identify backend stability trends and incident correlation

SELECT
  toStartOfDay(timestamp) AS day,

  -- 5xx error count
  countIf(
    event = '$exception'
    AND JSONExtractInt(properties, 'statusCode') >= 500
    AND JSONExtractInt(properties, 'statusCode') < 600
  ) AS server_error_count,

  -- Total API errors (for rate calculation)
  countIf(
    event = '$exception'
    AND JSONExtractInt(properties, 'statusCode') > 0
  ) AS total_api_errors,

  -- 5xx rate as percentage of all API errors
  round(
    countIf(
      event = '$exception'
      AND JSONExtractInt(properties, 'statusCode') >= 500
      AND JSONExtractInt(properties, 'statusCode') < 600
    ) * 100.0 / nullIf(
      countIf(
        event = '$exception'
        AND JSONExtractInt(properties, 'statusCode') > 0
      ),
      0
    ),
    2
  ) AS server_error_rate_percent

FROM events
WHERE timestamp >= now() - INTERVAL 30 DAY
  AND timestamp < now()
GROUP BY day
ORDER BY day ASC
