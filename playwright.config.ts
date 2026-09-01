import { defineConfig, devices } from '@playwright/test';

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
    baseURL: 'http://127.0.0.1:3000',
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
    command: 'node node_modules/vite/bin/vite.js build --mode e2e && node scripts/prepare-pwa-upgrade-fixture.mjs && node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 3000 --strictPort',
    url: 'http://127.0.0.1:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
