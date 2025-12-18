-- Error Volume Trend
-- Line chart showing $exception count over time with daily granularity
-- Includes 7-day comparison baseline for anomaly detection

SELECT
  toStartOfDay(timestamp) AS day,
  count() AS error_count,
  -- 7-day rolling average for baseline
  avg(count()) OVER (
    ORDER BY toStartOfDay(timestamp)
    ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
  ) AS rolling_avg_7d

FROM events
WHERE event = '$exception'
  AND timestamp >= now() - INTERVAL 30 DAY
  AND timestamp < now()
GROUP BY day
ORDER BY day ASC
