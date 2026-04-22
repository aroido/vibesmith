/**
 * Playwright Configuration
 * v1.13.0 - E2E 테스트 설정
 */

import { defineConfig, devices } from '@playwright/test';

const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_PORT = 4173;
const resolvedHost = process.env.PLAYWRIGHT_WEB_HOST ?? DEFAULT_HOST;
const requestedPort = Number(process.env.PLAYWRIGHT_WEB_PORT ?? DEFAULT_PORT);
const resolvedPort =
  Number.isFinite(requestedPort) && requestedPort > 0
    ? requestedPort
    : DEFAULT_PORT;
const baseURL =
  process.env.PLAYWRIGHT_BASE_URL ?? `http://${resolvedHost}:${resolvedPort}`;

export default defineConfig({
  testDir: './__tests__/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    command: `npm run dev:e2e -- --host ${resolvedHost} --port ${resolvedPort} --strictPort`,
    url: baseURL,
    reuseExistingServer: false, // Always start fresh with mock data
    timeout: 120_000,
  },
});
