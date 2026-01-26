# PostHog HogQL Queries

This directory contains HogQL query files for VerseMate Mobile analytics dashboards. Each `.sql` file contains a query that can be used directly in PostHog's insight query builder.

## Quick Start

### Environment Setup

Before running the setup script, configure your environment variables:

```bash
# Required environment variables
export POSTHOG_API_KEY=phx_your_personal_api_key    # Personal API key from PostHog settings
export POSTHOG_PROJECT_ID=12345                      # Your PostHog project ID
export POSTHOG_HOST=https://app.posthog.com          # Optional, defaults to cloud
```

To find your credentials:
1. **API Key**: PostHog -> Settings -> Personal API Keys -> Create Personal API Key
2. **Project ID**: PostHog -> Project Settings -> Project ID (number in URL works too)

### Running the Setup Script

```bash
# Preview changes (dry-run mode - recommended first step)
npx tsx scripts/posthog-dashboards/setup.ts --dry-run

# Run with verbose output to see detailed progress
npx tsx scripts/posthog-dashboards/setup.ts --dry-run --verbose

# Create/update all dashboards (requires valid credentials)
npx tsx scripts/posthog-dashboards/setup.ts

# Create only a specific dashboard
npx tsx scripts/posthog-dashboards/setup.ts --dashboard="All - Executive Overview"
```

### Example Dry-Run Output

```
Configuration:
  Project ID: 12345
  Host: https://app.posthog.com
  Mode: Dry-run

=== Validating Definitions ===
[OK] All definitions validated
Processing 6 dashboard(s): All - Executive Overview, Product - User Engagement, ...

=== Syncing Cohorts ===
[OK] [DRY-RUN] Created cohort: Behavioral - Power Users
[OK] [DRY-RUN] Created cohort: Behavioral - Regular Readers
...

=== Syncing Insights ===
[OK] [DRY-RUN] Created insight: Trend - DAU/WAU/MAU
...

=== Summary ===
Created: 67
Updated: 0
Unchanged: 0
Errors: 0
```

## Directory Structure

```
queries/
├── README.md                    # This file
├── cohorts/                     # Cohort definitions (14 queries)
│   ├── power-users.sql          # >7 chapters/week + feature usage
│   ├── regular-readers.sql      # 3-7 chapters/week
│   ├── casual-readers.sql       # 1-2 chapters/week
│   ├── dormant-users.sql        # Inactive >14 days
│   ├── new-users.sql            # First seen <7 days
│   ├── study-users.sql          # >3 study feature events
│   ├── ai-users.sql             # >5 tooltip opens
│   ├── activated-users.sql      # Completed activation funnel
│   ├── sharers.sql              # Any share in 30 days
│   ├── super-sharers.sql        # Top 10% sharers
│   ├── feature-refiners.sql     # Edit highlights/notes
│   ├── dark-mode-users.sql      # Dark theme preference
│   ├── anonymous-users.sql      # Not registered
│   └── multi-language-users.sql # Multiple Bible versions
├── insights/                    # Dashboard insight queries (41 total)
│   ├── executive-overview/      # Dashboard 1 (4 queries)
│   │   ├── dau-wau-mau.sql
│   │   ├── retention-headlines.sql
│   │   ├── activation-rate.sql
│   │   └── error-rate.sql
│   ├── user-engagement/         # Dashboard 2 (11 queries)
│   │   ├── chapters-per-user.sql
│   │   ├── median-reading-duration.sql
│   │   ├── reading-completion-rate.sql
│   │   ├── view-mode-distribution.sql
│   │   ├── view-mode-switching.sql
│   │   ├── feature-usage-rates.sql
│   │   ├── bible-version-popularity.sql
│   │   ├── book-popularity.sql
│   │   ├── scroll-depth-distribution.sql
│   │   ├── feature-churn-rates.sql
│   │   └── feature-engagement-depth.sql
│   ├── retention-growth/        # Dashboard 3 (6 queries)
│   │   ├── retention-curve.sql
│   │   ├── cohort-retention-matrix.sql
│   │   ├── lifecycle-distribution.sql
│   │   ├── streak-distribution.sql
│   │   ├── activation-rate-trend.sql
│   │   └── resurrection-rate.sql
│   ├── ai-performance/          # Dashboard 4 (7 queries)
│   │   ├── tooltip-open-rate.sql
│   │   ├── tooltip-dwell-time.sql
│   │   ├── explanation-tab-preference.sql
│   │   ├── auto-highlight-view-rate.sql
│   │   ├── auto-highlight-settings.sql
│   │   ├── dictionary-lookup-frequency.sql
│   │   └── ai-adoption-trend.sql
│   ├── technical-health/        # Dashboard 5 (7 queries)
│   │   ├── auth-success-rates.sql
│   │   ├── platform-distribution.sql
│   │   ├── session-duration.sql
│   │   ├── app-version-distribution.sql
│   │   ├── geographic-distribution.sql
│   │   ├── logout-patterns.sql
│   │   └── login-frequency.sql
│   └── social-virality/         # Dashboard 6 (6 queries)
│       ├── total-shares.sql
│       ├── share-rate.sql
│       ├── chapter-sharing-patterns.sql
│       ├── topic-sharing-patterns.sql
│       ├── sharing-trends.sql
│       └── super-sharers.sql
└── funnels/                     # Funnel definitions (6 queries)
    ├── activation-funnel.sql    # Signup -> Chapter -> Feature -> D1
    ├── core-reading-funnel.sql  # Session -> Chapter -> 90% scroll
    ├── ai-engagement-funnel.sql # Chapter -> Tooltip -> Tab change
    ├── feature-adoption-funnel.sql # Chapter -> Bookmark -> Highlight -> Note
    ├── sharing-funnel.sql       # Chapter -> 50% scroll -> Share
    └── feature-depth-funnel.sql # Highlight -> Edit
```

**Total: 65 query files** (14 cohorts + 41 insights + 6 funnels)

## Query Catalog

### Executive Overview Dashboard

| Query | Type | Description |
|-------|------|-------------|
| `dau-wau-mau.sql` | Line | Daily/Weekly/Monthly active users with trends |
| `retention-headlines.sql` | Number | D1, D7, D30 retention percentages |
| `activation-rate.sql` | Number | Signup to first chapter conversion rate |
| `error-rate.sql` | Number | Error rate health indicator |

### User Engagement Dashboard

| Query | Type | Description |
|-------|------|-------------|
| `chapters-per-user.sql` | Number | Average chapters viewed per user per week |
| `median-reading-duration.sql` | Number | Median time spent reading chapters |
| `reading-completion-rate.sql` | Number | % of chapters scrolled to 90%+ |
| `view-mode-distribution.sql` | Pie | Time split between Bible/Explanations |
| `view-mode-switching.sql` | Number | How often users switch view modes |
| `feature-usage-rates.sql` | Bar | Bookmark/highlight/note rates |
| `bible-version-popularity.sql` | Bar | Most used Bible versions |
| `book-popularity.sql` | Table | Top 10 most read books |
| `scroll-depth-distribution.sql` | Bar | 0-25%, 25-50%, 50-75%, 75-100% buckets |
| `feature-churn-rates.sql` | Table | Removed/deleted vs created ratios |
| `feature-engagement-depth.sql` | Number | Highlight/note edits per user |

### Retention & Growth Dashboard

| Query | Type | Description |
|-------|------|-------------|
| `retention-curve.sql` | Line | D1, D7, D14, D30, D60, D90 rates |
| `cohort-retention-matrix.sql` | Table | Weekly cohorts over 8 weeks |
| `lifecycle-distribution.sql` | Pie | User lifecycle stages |
| `streak-distribution.sql` | Bar | Reading streak length buckets |
| `activation-rate-trend.sql` | Line | 7-day rolling activation rate |
| `resurrection-rate.sql` | Number | Dormant users who returned |

### AI Performance Dashboard

| Query | Type | Description |
|-------|------|-------------|
| `tooltip-open-rate.sql` | Number | Tooltips opened / chapters viewed |
| `tooltip-dwell-time.sql` | Bar | Time buckets: 3-10s, 10-30s, 30-60s, 60s+ |
| `explanation-tab-preference.sql` | Pie | Summary vs Byline vs Detailed |
| `auto-highlight-view-rate.sql` | Number | Auto-highlight tooltip views |
| `auto-highlight-settings.sql` | Table | Enable/disable rates by setting |
| `dictionary-lookup-frequency.sql` | Bar | Greek vs Hebrew lookups |
| `ai-adoption-trend.sql` | Line | Weekly tooltip open rate |

### Technical Health Dashboard

| Query | Type | Description |
|-------|------|-------------|
| `auth-success-rates.sql` | Bar | Login/signup by method |
| `platform-distribution.sql` | Pie | iOS vs Android |
| `session-duration.sql` | Bar | Session length distribution |
| `app-version-distribution.sql` | Bar | App version adoption |
| `geographic-distribution.sql` | Table | Users by country |
| `logout-patterns.sql` | Line | Logout frequency and timing |
| `login-frequency.sql` | Number | Multiple logins per day |

### Social & Virality Dashboard

| Query | Type | Description |
|-------|------|-------------|
| `total-shares.sql` | Number | Combined chapter + topic shares |
| `share-rate.sql` | Number | Shares per active user |
| `chapter-sharing-patterns.sql` | Table | Most shared books/chapters |
| `topic-sharing-patterns.sql` | Table | Most shared categories/topics |
| `sharing-trends.sql` | Line | Weekly share volume |
| `super-sharers.sql` | Number | Top 10% sharer count |

## How to Use These Queries

### Method 1: Copy/Paste into PostHog UI

1. Open your PostHog project
2. Navigate to "Insights" and click "New insight"
3. Select "HogQL" as the query type
4. Copy the contents of the relevant `.sql` file
5. Paste into the query editor
6. Click "Run" to execute the query
7. Save the insight with an appropriate name

### Method 2: Use the Setup Script (Automated)

See the Quick Start section above.

## Query File Format

Each query file follows this format:

```sql
-- Insight: [Type] - [Metric Name]
-- Dashboard: [Dashboard Name]
-- Visualization: [Chart type description]
-- Time window: [Default time window]
-- Description: [What this metric measures and why it matters]

SELECT
    -- Query logic here
FROM events
WHERE ...
```

### Header Comments

- **Insight**: Used for naming the insight in PostHog (follows naming convention)
- **Dashboard**: Which dashboard this insight belongs to
- **Visualization**: Chart type (line, bar, pie, number, table)
- **Time window**: Recommended default time filter
- **Description**: Explanation of the metric for team context

## Naming Conventions

### Dashboard Names
Format: `[Team] - Dashboard Name`
- All - Executive Overview
- Product - User Engagement
- Product - Retention & Growth
- Product - AI Feature Performance
- Engineering - Technical Health
- Marketing - Social & Virality

### Insight Names
Format: `[Type] - Metric Name`
- Trend - DAU/WAU/MAU
- Funnel - Activation
- Distribution - Scroll Depth
- Number - Active Users
- Table - Book Popularity
- Pie - View Mode Distribution
- Bar - Feature Usage Rates
- Line - AI Adoption Trend

### Cohort Names
Format: `[Category] - Segment Name`
- Behavioral - Power Users
- Behavioral - Regular Readers
- Behavioral - Casual Readers
- Lifecycle - Dormant Users
- Lifecycle - New Users
- Lifecycle - Activated Users
- Engagement - Study Users
- Engagement - AI Users
- Engagement - Feature Refiners
- Demographic - Dark Mode Users
- Demographic - Anonymous Users
- Demographic - Multi-Language Users
- Social - Sharers
- Social - Super Sharers

## Event Reference

All 23 tracked events from `lib/analytics/types.ts`:

### Bible Reading Events (3)
| Event | Description | Key Properties |
|-------|-------------|----------------|
| `CHAPTER_VIEWED` | User views a chapter | `bookId`, `chapterNumber`, `bibleVersion` |
| `VIEW_MODE_SWITCHED` | Switch bible/explanations | `mode` |
| `EXPLANATION_TAB_CHANGED` | Change explanation tab | `tab` (summary/byline/detailed) |

### Feature Usage Events (11)
| Event | Description | Key Properties |
|-------|-------------|----------------|
| `BOOKMARK_ADDED` | Bookmark created | `bookId`, `chapterNumber` |
| `BOOKMARK_REMOVED` | Bookmark deleted | `bookId`, `chapterNumber` |
| `HIGHLIGHT_CREATED` | Highlight created | `bookId`, `chapterNumber`, `color` |
| `HIGHLIGHT_EDITED` | Highlight modified | `highlightId`, `color` |
| `HIGHLIGHT_DELETED` | Highlight removed | `highlightId` |
| `NOTE_CREATED` | Note created | `bookId`, `chapterNumber` |
| `NOTE_EDITED` | Note modified | `noteId` |
| `NOTE_DELETED` | Note removed | `noteId` |
| `DICTIONARY_LOOKUP` | Word lookup | `strongsNumber`, `language` |
| `AUTO_HIGHLIGHT_SETTING_CHANGED` | Toggle auto-highlight | `settingId`, `enabled` |
| `CHAPTER_SHARED` | Chapter shared | `bookId`, `chapterNumber` |
| `TOPIC_SHARED` | Topic shared | `category`, `topicSlug` |

### AI Events (2)
| Event | Description | Key Properties |
|-------|-------------|----------------|
| `VERSEMATE_TOOLTIP_OPENED` | AI tooltip opened | `bookId`, `chapterNumber`, `verseNumber` |
| `AUTO_HIGHLIGHT_TOOLTIP_VIEWED` | Auto-highlight tooltip | `bookId`, `chapterNumber` |

### Auth Events (3)
| Event | Description | Key Properties |
|-------|-------------|----------------|
| `SIGNUP_COMPLETED` | User signed up | `method` (email/google/apple) |
| `LOGIN_COMPLETED` | User logged in | `method` (email/google/apple) |
| `LOGOUT` | User logged out | (none) |

### Time-Based Events (4)
| Event | Description | Key Properties |
|-------|-------------|----------------|
| `CHAPTER_READING_DURATION` | Time reading chapter | `duration_seconds`, `bookId`, `chapterNumber` |
| `VIEW_MODE_DURATION` | Time in view mode | `viewMode`, `duration_seconds` |
| `TOOLTIP_READING_DURATION` | Time viewing tooltip | `duration_seconds`, `verseNumber` |
| `CHAPTER_SCROLL_DEPTH` | Scroll depth reached | `maxScrollDepthPercent` |

## User Properties

All user properties available for segmentation:

| Property | Type | Description |
|----------|------|-------------|
| `preferred_bible_version` | string | User's default Bible version |
| `theme_preference` | string | light/dark/system |
| `language_setting` | string | Device language |
| `country` | string | User's country code |
| `account_type` | string | email/google/apple |
| `is_registered` | boolean | Registered vs anonymous |
| `current_streak` | number | Consecutive days active |
| `last_active_date` | string | YYYY-MM-DD format |
| `first_seen_at` | string | ISO 8601 timestamp |
| `last_seen_at` | string | ISO 8601 timestamp |
| `last_login_at` | string | ISO 8601 timestamp |

## Time Windows

Default time windows by dashboard type:
- Executive Overview: Last 7 days (refreshed hourly)
- User Engagement: Last 7 days
- Retention & Growth: Last 30 days
- AI Performance: Last 7 days
- Technical Health: Last 7 days
- Social & Virality: Last 30 days

## Troubleshooting

### Query Returns No Data

1. **Verify event names** - Event names are case-sensitive and must match exactly
2. **Check time range** - Ensure the time filter includes data
3. **Confirm tracking** - Verify events are being sent to PostHog
4. **Test with broader filter** - Remove filters to confirm data exists

### Syntax Errors

Common HogQL patterns:
```sql
-- Date conversion
toDate(timestamp)

-- Event properties
JSONExtractString(properties, 'bookId')
JSONExtractFloat(properties, 'duration_seconds')

-- Person properties (for cohorts)
person.properties.current_streak
toInt32OrNull(person.properties.current_streak)

-- Null handling
nullIf(count(*), 0)
coalesce(value, 0)
```

### Performance Issues

1. **Add time filters** - Always include `timestamp >= now() - INTERVAL 7 DAY`
2. **Limit results** - Use `LIMIT 100` for exploratory queries
3. **Use aggregations** - Aggregate in query, not in UI
4. **Avoid nested subqueries** - Use CTEs when possible

### Setup Script Errors

| Error | Solution |
|-------|----------|
| `POSTHOG_API_KEY not set` | Export environment variable |
| `POSTHOG_PROJECT_ID not set` | Export environment variable |
| `Request failed with status 401` | Invalid API key |
| `Request failed with status 404` | Invalid project ID |
| `Request failed with status 429` | Rate limited - script will retry |

## Testing

Run the test suite to validate the setup script:

```bash
# Run all PostHog dashboard tests
npm test -- --testPathPattern="scripts/posthog-dashboards"

# Run specific test files
npm test -- --testPathPattern="scripts/posthog-dashboards/__tests__/integration"
npm test -- --testPathPattern="scripts/posthog-dashboards/__tests__/setup"
npm test -- --testPathPattern="scripts/posthog-dashboards/api/__tests__"
```

## Related Documentation

- [PostHog HogQL Reference](https://posthog.com/docs/hogql)
- [PostHog Insights Documentation](https://posthog.com/docs/product-analytics/insights)
- [PostHog API Reference](https://posthog.com/docs/api)
- [VerseMate Analytics Types](../../../lib/analytics/types.ts)
