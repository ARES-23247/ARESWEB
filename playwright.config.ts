import { defineConfig } from '@playwright/test';

const WRANGLER_COMMAND = 'cross-env CLOUDFLARE_API_TOKEN=dummy DEV_BYPASS=true ENVIRONMENT=test npx wrangler pages dev';

export default defineConfig({
  testDir: './tests/e2e',
  webServer: process.env.CI 
    ? {
        command: `${WRANGLER_COMMAND} dist`,
        url: 'http://localhost:8788',
        reuseExistingServer: false,
        timeout: 120 * 1000,
      }
    : [
        {
          command: 'npm run dev',
          url: 'http://localhost:5173',
          reuseExistingServer: true,
        },
        {
          command: WRANGLER_COMMAND,
          url: 'http://localhost:8788',
          reuseExistingServer: true,
        }
      ],
});
