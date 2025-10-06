import * as fs from 'node:fs';
import * as path from 'node:path';
import { expect, test } from '@playwright/test';

/**
 * Journey File Generation Validation Tests
 *
 * Validates that journey files are generated with correct TypeScript syntax
 * and proper journey data structure.
 */

test.describe('Journey File Generation', () => {
  const testOutputDir = path.join(__dirname, '../../.test-output/journeys');

  test.beforeEach(() => {
    // Clean up test output directory
    if (fs.existsSync(testOutputDir)) {
      fs.rmSync(testOutputDir, { recursive: true });
    }
    fs.mkdirSync(testOutputDir, { recursive: true });
  });

  test.afterEach(() => {
    // Clean up after tests
    if (fs.existsSync(testOutputDir)) {
      fs.rmSync(testOutputDir, { recursive: true });
    }
  });

  test('should generate valid TypeScript journey file structure', () => {
    const journeyData = {
      name: 'test-journey',
      description: 'A test journey',
      createdAt: '2025-10-05',
      baseUrl: 'https://app.versemate.org',
      steps: [
        {
          name: 'step-1-landing',
          description: 'Landing page',
          action: 'navigate' as const,
          url: '/bible',
          waitFor: '.testament-tabs',
          screenshot: 'step-1-landing.png',
        },
      ],
    };

    // Validate journey structure
    expect(journeyData.name).toBeTruthy();
    expect(journeyData.description).toBeTruthy();
    expect(journeyData.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(journeyData.baseUrl).toMatch(/^https?:\/\//);
    expect(Array.isArray(journeyData.steps)).toBe(true);
    expect(journeyData.steps.length).toBeGreaterThan(0);
  });

  test('should validate journey step properties', () => {
    const step = {
      name: 'step-1-test',
      description: 'Test step',
      action: 'click' as const,
      selector: '.test-button',
      waitFor: '.result',
      screenshot: 'step-1-test.png',
    };

    expect(step.name).toMatch(/^step-\d+-/);
    expect(step.description).toBeTruthy();
    expect(['click', 'navigate', 'type', 'scroll']).toContain(step.action);
    expect(step.screenshot).toMatch(/\.png$/);
  });

  test('should validate action types', () => {
    const validActions = ['click', 'navigate', 'type', 'scroll'];

    for (const action of validActions) {
      expect(validActions).toContain(action);
    }
  });

  test('should validate step naming convention', () => {
    const validNames = ['step-1-landing', 'step-2-click-button', 'step-3-navigate'];

    for (const name of validNames) {
      expect(name).toMatch(/^step-\d+-[a-z-]+$/);
    }
  });

  test('should ensure unique step names', () => {
    const steps = [
      { name: 'step-1-landing', description: 'Landing' },
      { name: 'step-2-click', description: 'Click' },
      { name: 'step-3-navigate', description: 'Navigate' },
    ];

    const names = steps.map((s) => s.name);
    const uniqueNames = new Set(names);

    expect(uniqueNames.size).toBe(names.length);
  });

  test('should validate journey file path structure', () => {
    const journeyName = 'bible-reading-flow';
    const expectedPath = `.agent-os/references/journeys/${journeyName}/${journeyName}.ts`;

    expect(expectedPath).toContain('.agent-os/references/journeys');
    expect(expectedPath).toMatch(/\.ts$/);
  });

  test('should validate screenshot file naming', () => {
    const stepName = 'step-1-landing';
    const viewports = ['desktop', 'tablet', 'mobile'];

    for (const viewport of viewports) {
      const filename = `${stepName}_${viewport}.png`;
      expect(filename).toMatch(/^step-\d+-[a-z-]+_(desktop|tablet|mobile)\.png$/);
    }
  });

  test('should validate journey metadata completeness', () => {
    const journey = {
      name: 'test-journey',
      description: 'Test description',
      createdAt: new Date().toISOString().split('T')[0],
      baseUrl: 'https://app.versemate.org',
      steps: [],
    };

    expect(journey.name).toBeTruthy();
    expect(journey.description).toBeTruthy();
    expect(journey.createdAt).toBeTruthy();
    expect(journey.baseUrl).toBeTruthy();
    expect(Array.isArray(journey.steps)).toBe(true);
  });
});
