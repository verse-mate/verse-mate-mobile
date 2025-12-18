/**
 * List all PostHog insights with their URLs
 *
 * Usage: bun run list-insights.ts
 */

import { createPostHogApiClient } from './api/client';
import { getConfigForExecution } from './config';
import { createLogger } from './utils/logger';

async function main() {
  const config = getConfigForExecution({ dryRun: false, verbose: false });
  const logger = createLogger({ verbose: false, dryRun: false });
  const client = createPostHogApiClient({ config, logger, dryRun: false });

  console.log('Fetching insights from PostHog...\n');

  const response = await client.get<{ results: any[] }>('/insights/?saved=true&limit=100');
  const insights = response.data.results;

  // Filter to our managed insights (following naming convention)
  const ourInsights = insights.filter((i: any) =>
    i.name.match(/^(Trend|Number|Distribution|Table|Pie|Bar|Line|Funnel) - /)
  );

  // Group by dashboard category
  const categories: Record<string, any[]> = {
    'Executive Overview': [],
    'User Engagement': [],
    'Retention & Growth': [],
    'AI Performance': [],
    'Technical Health': [],
    'Social & Virality': [],
    'Error Monitoring': [],
    Funnels: [],
  };

  for (const insight of ourInsights) {
    const url = `https://us.posthog.com/project/${config.projectId}/insights/${insight.short_id}`;
    const entry = { name: insight.name, url };

    if (insight.name.startsWith('Funnel')) {
      categories['Funnels'].push(entry);
    } else if (
      insight.name.includes('DAU') ||
      insight.name.includes('Retention Headlines') ||
      (insight.name.includes('Activation Rate') && !insight.name.includes('Trend')) ||
      (insight.name.includes('Error Rate') && !insight.name.includes('Health'))
    ) {
      categories['Executive Overview'].push(entry);
    } else if (
      insight.name.includes('Chapters') ||
      insight.name.includes('Reading') ||
      insight.name.includes('View Mode') ||
      insight.name.includes('Feature') ||
      insight.name.includes('Bible') ||
      insight.name.includes('Book') ||
      insight.name.includes('Scroll')
    ) {
      categories['User Engagement'].push(entry);
    } else if (
      insight.name.includes('Retention') ||
      insight.name.includes('Cohort') ||
      insight.name.includes('Lifecycle') ||
      insight.name.includes('Streak') ||
      insight.name.includes('Resurrection') ||
      insight.name.includes('Activation Rate Trend')
    ) {
      categories['Retention & Growth'].push(entry);
    } else if (
      insight.name.includes('Tooltip') ||
      insight.name.includes('Explanation') ||
      insight.name.includes('Auto-Highlight') ||
      insight.name.includes('Dictionary') ||
      insight.name.includes('AI')
    ) {
      categories['AI Performance'].push(entry);
    } else if (
      insight.name.includes('Auth') ||
      insight.name.includes('Platform') ||
      insight.name.includes('Session') ||
      insight.name.includes('App Version') ||
      insight.name.includes('Geographic') ||
      insight.name.includes('Logout') ||
      insight.name.includes('Login')
    ) {
      categories['Technical Health'].push(entry);
    } else if (insight.name.includes('Share') || insight.name.includes('Shar')) {
      categories['Social & Virality'].push(entry);
    } else if (
      insight.name.includes('Error') ||
      insight.name.includes('Crash') ||
      insight.name.includes('5xx') ||
      insight.name.includes('Endpoint')
    ) {
      categories['Error Monitoring'].push(entry);
    }
  }

  // Print organized list
  for (const [category, items] of Object.entries(categories)) {
    if (items.length === 0) continue;
    console.log(`\n## ${category}\n`);
    for (const item of items) {
      console.log(`- ${item.name}`);
      console.log(`  ${item.url}`);
    }
  }

  console.log(`\n---`);
  console.log(`Total: ${ourInsights.length} managed insights`);
}

main().catch(console.error);
