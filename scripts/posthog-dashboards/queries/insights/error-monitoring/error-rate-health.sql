-- Error Rate Health
-- Primary health indicator showing overall error rate as a percentage
-- Traffic-light status: green (<1%), yellow (1-5%), red (>5%)
-- Uses 7-day time window for stable rate calculation

SELECT
  -- Current period error rate
  round(
    countIf(event = '$exception') * 100.0 / nullIf(count(), 0),
    2
  ) AS error_rate_percent,

  -- Absolute counts for context
  countIf(event = '$exception') AS total_exceptions,
  count() AS total_events,

  -- Previous period error rate for comparison
  round(
    countIf(
      event = '$exception' AND
      timestamp < now() - INTERVAL 7 DAY AND
      timestamp >= now() - INTERVAL 14 DAY
    ) * 100.0 / nullIf(
      countIf(
        timestamp < now() - INTERVAL 7 DAY AND
        timestamp >= now() - INTERVAL 14 DAY
      ),
      0
    ),
    2
  ) AS previous_period_error_rate

FROM events
WHERE timestamp >= now() - INTERVAL 14 DAY
  AND timestamp < now()
