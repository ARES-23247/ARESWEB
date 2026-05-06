import { defineConfig, devices } from '@playwright/test';

const WRANGLER_COMMAND = 'cross-env DEV_BYPASS=true ENVIRONMENT=test npx wrangler pages dev dist -b SKIP_ENV_VALIDATION=true --env-file .env.test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // Use single worker locally to avoid route pollution between tests
  // Some tests mock API routes that can interfere with parallel execution
  workers: 1,
  reporter: 'html',
  timeout: 60000,
  use: {
    baseURL: process.env.CI ? 'http://127.0.0.1:8788' : 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: process.env.CI 
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
