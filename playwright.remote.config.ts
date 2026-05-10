/**
 * Playwright config for running tests against deployed environments
 *
 * Usage:
 *   PREVIEW_URL=https://your-branch-abc123.pages.dev npm run test:e2e:remote
 *
 * No local build or server required - tests run against the deployed site.
 */

import { defineConfig, devices } from '@playwright/test';

if (!process.env.PREVIEW_URL) {
  console.warn("⚠️ WARNING: No PREVIEW_URL provided. You MUST provide a branch preview URL to run remote tests.");
  console.warn("Example: PREVIEW_URL=https://<your-branch-hash>.aresweb.pages.dev npm run test:e2e:remote");
  console.warn("🚨 NEVER test against https://aresweb.pages.dev (production)");
}

const previewUrl = process.env.PREVIEW_URL || 'http://127.0.0.1:8788'; // Fall back to local if unspecified, never production

export default defineConfig({
  globalSetup: './tests/global-setup.ts',
  testDir: './tests/e2e',
  fullyParallel: false, // Slower on remote, reduce parallelism
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1, // Single worker to avoid overwhelming the remote server
  reporter: 'html',
  timeout: 60000,
  maxFailures: 10,
  use: {
    baseURL: previewUrl,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15000,
    navigationTimeout: 45000,
    contextOptions: {
      serviceWorkers: 'block',
      permissions: [],
      storageState: undefined,
    },
  },
  projects: [
    {
      name: 'chromium-remote',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: [
            '--disable-dev-shm-usage',
            '--disable-gpu',
          ],
        },
      },
    },
  ],
  // No webServer - we're testing against a deployed URL
  webServer: undefined,
});
