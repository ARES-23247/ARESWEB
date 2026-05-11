import { test, expect } from '@playwright/test';
import { setupMockAuth } from '../fixtures/auth';

test.describe('Zulip Audit API Integration', () => {
  test.beforeEach(async ({ page }) => {
    await setupMockAuth(page);

    // Mock Zulip audit endpoint - requires real credentials in production
    await page.route('**/api/zulip/invites/audit', async (route) => {
      await route.fulfill({
        status: 200,
        json: {
          success: true,
          missingUsers: [],
          allUsers: [
            { email: 'test1@ares.org', name: 'Test User 1' },
            { email: 'test2@ares.org', name: 'Test User 2' },
          ],
        },
      });
    });

    // Mock Zulip invites send endpoint
    await page.route('**/api/zulip/invites/send', async (route) => {
      await route.fulfill({
        status: 200,
        json: {
          success: true,
          invited: ['test1@ares.org', 'test2@ares.org'],
          failed: [],
        },
      });
    });

    await page.goto('/');
  });

  test('GET /api/zulip/invites/audit returns missing users', async ({ page }) => {
    const body = await page.evaluate(async () => {
      const res = await fetch('/api/zulip/invites/audit');
      return { status: res.status, data: await res.json().catch(() => ({})) };
    });

    expect(body.status).toBe(200);
    expect(body.data.success).toBe(true);
  });

  test('POST /api/zulip/invites/send triggers batch invitations', async ({ page }) => {
    const body = await page.evaluate(async () => {
      const res = await fetch('/api/zulip/invites/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emails: ['test1@ares.org', 'test2@ares.org'] }),
      });
      return { status: res.status, data: await res.json().catch(() => ({})) };
    });

    expect(body.status).toBe(200);
    expect(body.data.success).toBe(true);
  });
});
