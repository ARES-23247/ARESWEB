/**
 * Playwright E2E Test Configuration
 *
 * ⚡ DEBUGGING TIP: Use remote testing mode to avoid heavy local builds
 *
 *   PREVIEW_URL=https://aresweb.pages.dev npm run test:e2e:remote
 *
 * This runs tests against the deployed site without building/running locally.
 * See playwright.remote.config.ts for the remote configuration.
 */

import { defineConfig, devices } from '@playwright/test';

const WRANGLER_COMMAND = 'cross-env ENVIRONMENT=test npx wrangler pages dev dist -b SKIP_ENV_VALIDATION=true --env-file .env.test';

// Use deployed preview URL if available (from CI), otherwise use local URLs
const previewUrl = process.env.PREVIEW_URL;
const baseUrl = previewUrl || (process.env.CI ? 'http://127.0.0.1:8788' : 'http://localhost:5173');

// Define test suites for batch running
const testSuites = {
  // Core dashboard functionality
  dashboard: {
    name: '@dashboard',
    testMatch: '**/admin-*.spec.ts',
  },
  // Analytics and stats
  analytics: {
    name: '@analytics',
    testMatch: '**/analytics*.spec.ts',
  },
  // Public pages (blog, events, docs, etc.)
  public: {
    name: '@public',
    testMatch: '**/*-post.spec.ts',
  },
  // Content detail pages
  details: {
    name: '@details',
    testMatch: '**/*-detail.spec.ts',
  },
  // Editors and admin forms
  editors: {
    name: '@editors',
    testMatch: '**/*-editor.spec.ts',
  },
  // Feature-specific tests (simulations, store, etc.)
  features: {
    name: '@features',
    testMatch: '**/{sim,store,social}*.spec.ts',
  },
};

export default defineConfig({
  globalSetup: './tests/global-setup.ts',
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // Use single worker locally to avoid route pollution between tests
  // Some tests mock API routes that can interfere with parallel execution
  workers: 1,
  reporter: 'html',
  timeout: 60000,
  maxFailures: 10,
  use: {
    baseURL: baseUrl,
    trace: 'on-first-retry',
    actionTimeout: 10000,
    navigationTimeout: 30000,
    contextOptions: {
      serviceWorkers: 'block',
      permissions: [],
      storageState: undefined,
    },
  },
  projects: [
    // Default project - runs all tests (useful for CI with splitting)
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: [
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--disable-extensions',
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-web-security',
            '--disable-features=IsolateOrigins,site-per-process',
          ],
        },
      },
    },
    // Dashboard suite - admin panels and management
    {
      name: 'dashboard',
      testMatch: testSuites.dashboard.testMatch,
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: [
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--no-sandbox',
          ],
        },
      },
    },
    // Analytics suite
    {
      name: 'analytics',
      testMatch: testSuites.analytics.testMatch,
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: [
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--no-sandbox',
          ],
        },
      },
    },
    // Public pages suite
    {
      name: 'public',
      testMatch: testSuites.public.testMatch,
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: [
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--no-sandbox',
          ],
        },
      },
    },
    // Detail pages suite
    {
      name: 'details',
      testMatch: testSuites.details.testMatch,
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: [
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--no-sandbox',
          ],
        },
      },
    },
    // Editors suite
    {
      name: 'editors',
      testMatch: testSuites.editors.testMatch,
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: [
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--no-sandbox',
          ],
        },
      },
    },
    // Features suite
    {
      name: 'features',
      testMatch: testSuites.features.testMatch,
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: [
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--no-sandbox',
          ],
        },
      },
    },
  ],
  // Skip webServer when using deployed preview URL (PR testing)
  webServer: previewUrl ? undefined : process.env.CI
    ? {
        command: WRANGLER_COMMAND,
        url: 'http://127.0.0.1:8788',
        reuseExistingServer: false,
        timeout: 120 * 1000,
      }
    : {
        command: 'cross-env MODE=test npm run dev',
        url: 'http://localhost:5173',
        reuseExistingServer: true,
      },
});
