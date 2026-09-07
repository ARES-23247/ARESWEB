import { defineConfig, devices } from '@playwright/test';

// Concurrent local tasks can serve different checkouts. An explicit port owns a
// fresh server instead of silently reusing an unrelated preview on port 3000.
const testPort = Number(process.env.ARES_E2E_PORT ?? '3000');
if (!Number.isInteger(testPort) || testPort < 1024 || testPort > 65535) {
  throw new Error('ARES_E2E_PORT must be an integer from 1024 to 65535.');
}
const testOrigin = `http://127.0.0.1:${testPort}`;

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  timeout: 45000,
  expect: {
    timeout: 10000,
  },
  use: {
    baseURL: testOrigin,
    // The preview smoke suite validates the freshly built app. A previously
    // installed PWA worker can bypass Playwright routing and serve stale assets.
    serviceWorkers: 'block',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      testIgnore: '**/pwa.spec.ts',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile-chromium',
      testIgnore: '**/pwa.spec.ts',
      use: { ...devices['Pixel 7'] },
    },
    {
      name: 'mobile-webkit',
      testIgnore: '**/pwa.spec.ts',
      use: { ...devices['iPhone 15'] },
    },
    {
      name: 'firefox',
      testIgnore: '**/pwa.spec.ts',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      testIgnore: '**/pwa.spec.ts',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'pwa-chromium',
      testMatch: '**/pwa.spec.ts',
      use: {
        ...devices['Desktop Chrome'],
        serviceWorkers: 'allow',
      },
    },
  ],
  webServer: {
    command: `node node_modules/vite/bin/vite.js build --mode e2e && node scripts/prepare-pwa-upgrade-fixture.mjs && node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port ${testPort} --strictPort`,
    url: testOrigin,
    reuseExistingServer: !process.env.CI && !process.env.ARES_E2E_PORT,
    timeout: 120000,
  },
});
