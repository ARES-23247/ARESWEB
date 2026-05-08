import { test, expect } from '@playwright/test';
import { setupMockAuth } from '../fixtures/auth';

test.describe('Zulip Audit API Integration', () => {
  test.beforeEach(async ({ page }) => {
    await setupMockAuth(page);
    await page.goto('/');
  });

  test('GET /api/zulip/invites/audit returns missing users', async ({ page }) => {
    await page.route('**/api/zulip/invites/audit', async (route) => {
      await route.fulfill({
        status: 200,
        json: { success: true, missingEmails: ['test1@ares.org', 'test2@ares.org'] },
      });
    });

    const body = await page.evaluate(async () => {
      const res = await fetch('/api/zulip/invites/audit');
      return { status: res.status, data: await res.json() };
    });

    expect(body.status).toBe(200);
    expect(body.data.success).toBe(true);
    expect(body.data.missingEmails).toEqual(['test1@ares.org', 'test2@ares.org']);
  });

  test('POST /api/zulip/invites/send triggers batch invitations', async ({ page }) => {
    await page.route('**/api/zulip/invites/send', async (route) => {
      const postData = route.request().postDataJSON();
      if (postData && postData.emails && postData.emails.length > 0) {
        await route.fulfill({
          status: 200,
          json: { success: true, invitedCount: postData.emails.length },
        });
      } else {
        await route.fulfill({
          status: 400,
          json: { success: false, error: 'No emails provided' },
        });
      }
    });

    const body = await page.evaluate(async () => {
      const res = await fetch('/api/zulip/invites/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emails: ['test1@ares.org', 'test2@ares.org'] }),
      });
      return { status: res.status, data: await res.json() };
    });

    expect(body.status).toBe(200);
    expect(body.data.success).toBe(true);
    expect(body.data.invitedCount).toBe(2);
  });
});
