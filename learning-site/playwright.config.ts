import { defineConfig, devices } from '@playwright/test';

const BASE_PATH = (process.env.BASE_PATH ?? '/LearnYourself/').replace(/\/?$/, '/');
/** LY_PORT lets several checkouts run their own preview server side by side. */
const PORT = Number(process.env.LY_PORT ?? 4321);
const ORIGIN = `http://localhost:${PORT}`;

/** Smoke tests run against `astro preview`, i.e. the real production build under the base path. */
export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  workers: process.env.CI ? 2 : 4,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'line' : 'list',
  timeout: 45_000,
  use: { baseURL: ORIGIN + BASE_PATH, trace: 'retain-on-failure' },
  webServer: {
    command: `npx astro preview --port ${PORT}`,
    url: ORIGIN + BASE_PATH,
    reuseExistingServer: !process.env.CI,
    timeout: 90_000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
