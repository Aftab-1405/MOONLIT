/* global process */
import { defineConfig } from '@playwright/test';

const isHeaded = process.argv.includes('--headed');

export default defineConfig({
  testDir: './e2e',
  // Per-test timeout: generous enough for slow mocked API interactions
  timeout: 45 * 1000,
  expect: {
    // Allow more time for MUI animations to settle before assertions
    timeout: 8000,
  },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  // 'list' gives clean per-test pass/fail output; change to 'html' for a full report
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173',
    trace: 'retain-on-failure',
    // Screenshot on failure for debugging
    screenshot: 'only-on-failure',
    headless: !isHeaded,
  },
  projects: [
    {
      name: 'brave',
      use: {
        viewport: isHeaded ? null : { width: 1440, height: 900 },
        launchOptions: {
          executablePath: '/usr/bin/brave-browser',
          args: ['--no-sandbox', '--start-maximized'],
          // 900ms — visible enough to see interactions but not painfully slow in headed mode
          slowMo: isHeaded ? 900 : 0,
        },
      },
    },
  ],
});
