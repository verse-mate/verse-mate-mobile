-- Insight: Table - Super Sharers
-- Dashboard: Social & Virality
-- Visualization: Table showing top sharing users (anonymized)
-- Time window: Last 30 days
-- Description: Identifies users in top 10% of sharing activity (>3 shares in 30 days).
--              These "super sharers" drive organic growth disproportionately.
--              Shows distribution of sharing activity concentration.

-- Super sharer threshold (top 10%)
WITH sharer_activity AS (
    SELECT
        distinct_id,
        count(*) AS share_count
    FROM events
    WHERE
        event IN ('CHAPTER_SHARED', 'TOPIC_SHARED')
        AND timestamp >= now() - INTERVAL 30 DAY
    GROUP BY distinct_id
),
thresholds AS (
    SELECT
        quantile(0.9)(share_count) AS top_10_threshold,
        avg(share_count) AS avg_shares,
        max(share_count) AS max_shares
    FROM sharer_activity
)
SELECT
    count(DISTINCT sa.distinct_id) AS total_sharers,
    count(DISTINCT CASE WHEN sa.share_count >= 3 THEN sa.distinct_id END) AS super_sharers_3plus,
    count(DISTINCT CASE WHEN sa.share_count >= t.top_10_threshold THEN sa.distinct_id END) AS top_10_percent,
    round(t.avg_shares, 1) AS avg_shares_per_sharer,
    t.max_shares AS max_shares_by_single_user,
    round(t.top_10_threshold, 0) AS top_10_threshold
FROM sharer_activity sa, thresholds t
GROUP BY t.avg_shares, t.max_shares, t.top_10_threshold;

-- Share distribution (how concentrated is sharing)
SELECT
    CASE
        WHEN share_count = 1 THEN '1 share'
        WHEN share_count = 2 THEN '2 shares'
        WHEN share_count BETWEEN 3 AND 5 THEN '3-5 shares'
        WHEN share_count BETWEEN 6 AND 10 THEN '6-10 shares'
        ELSE '10+ shares'
    END AS share_bucket,
    count(*) AS user_count,
    sum(share_count) AS total_shares_from_bucket,
    round(
        sum(share_count) * 100.0 / nullIf((
            SELECT count(*)
            FROM events
            WHERE event IN ('CHAPTER_SHARED', 'TOPIC_SHARED')
              AND timestamp >= now() - INTERVAL 30 DAY
        ), 0),
        1
    ) AS pct_of_all_shares
FROM (
    SELECT
        distinct_id,
        count(*) AS share_count
    FROM events
    WHERE
        event IN ('CHAPTER_SHARED', 'TOPIC_SHARED')
        AND timestamp >= now() - INTERVAL 30 DAY
    GROUP BY distinct_id
)
GROUP BY share_bucket
ORDER BY
    CASE share_bucket
        WHEN '1 share' THEN 1
        WHEN '2 shares' THEN 2
        WHEN '3-5 shares' THEN 3
        WHEN '6-10 shares' THEN 4
        WHEN '10+ shares' THEN 5
    END;

-- Super sharers engagement profile
SELECT
    round(avg(chapter_views), 1) AS avg_chapters_viewed,
    round(avg(tooltip_opens), 1) AS avg_tooltip_opens,
    round(avg(feature_events), 1) AS avg_feature_events
FROM (
    SELECT
        ss.distinct_id,
        countIf(e.event = 'CHAPTER_VIEWED') AS chapter_views,
        countIf(e.event = 'VERSEMATE_TOOLTIP_OPENED') AS tooltip_opens,
        countIf(e.event IN ('BOOKMARK_ADDED', 'HIGHLIGHT_CREATED', 'NOTE_CREATED')) AS feature_events
    FROM (
        SELECT distinct_id
        FROM events
        WHERE
            event IN ('CHAPTER_SHARED', 'TOPIC_SHARED')
            AND timestamp >= now() - INTERVAL 30 DAY
        GROUP BY distinct_id
        HAVING count(*) >= 3
    ) ss
    LEFT JOIN events e ON ss.distinct_id = e.distinct_id
        AND e.timestamp >= now() - INTERVAL 30 DAY
    GROUP BY ss.distinct_id
);
