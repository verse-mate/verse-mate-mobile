import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright Configuration for Visual Reference Tooling
 *
 * This configuration is used for capturing screenshots and metadata
 * from the VerseMate web application for mobile development reference.
 *
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  // Test directory for capture scripts
  testDir: './scripts/visual-reference',

  // Maximum time for each test
  timeout: 60000,

  // Disable parallel tests for capture scripts (sequential for consistency)
  fullyParallel: false,
  workers: 1,

  // Fail the build on CI if you accidentally left test.only
  forbidOnly: !!process.env.CI,

  // Retry failed captures once
  retries: process.env.CI ? 2 : 1,

  // Reporter configuration
  reporter: [['list'], ['html', { open: 'never' }]],

  // Shared settings for all projects
  use: {
    // Base URL for VerseMate web app
    baseURL: 'https://app.versemate.org',

    // Collect trace for debugging
    trace: 'retain-on-failure',

    // Screenshot on failure
    screenshot: 'only-on-failure',

    // Timeout for each action
    actionTimeout: 10000,

    // Navigation timeout
    navigationTimeout: 30000,
  },

  // Configure projects for different viewports
  projects: [
    {
      name: 'desktop',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 },
      },
    },
    {
      name: 'tablet',
      use: {
        ...devices['iPad Pro'],
        viewport: { width: 768, height: 1024 },
      },
    },
    {
      name: 'mobile',
      use: {
        ...devices['iPhone SE'],
        viewport: { width: 375, height: 667 },
      },
    },
  ],

  // Web server configuration (not used for web app captures)
  // webServer: undefined,
});
