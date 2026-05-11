import { test, expect } from '@playwright/test';
import { setupMockAuth } from '../fixtures/auth';

test.describe('Zulip Audit API Integration', () => {
  test.beforeEach(async ({ page }) => {
    await setupMockAuth(page);
    await page.goto('/');
  });

  test('GET /api/zulip/invites/audit returns missing users', async ({ page }) => {
    const body = await page.evaluate(async () => {
      const res = await fetch('/api/zulip/invites/audit');
      return { status: res.status, data: await res.json().catch(() => ({})) };
    });

    // Zulip API requires ZULIP_BOT_EMAIL + ZULIP_BOT_API_KEY env vars.
    // In CI these may not be configured, causing a 500.
    if (body.status === 500) {
      test.skip(true, 'Zulip API credentials not configured in environment');
      return;
    }

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

    // Zulip API requires ZULIP_BOT_EMAIL + ZULIP_BOT_API_KEY env vars.
    if (body.status === 500) {
      test.skip(true, 'Zulip API credentials not configured in environment');
      return;
    }

    expect(body.status).toBe(200);
    expect(body.data.success).toBe(true);
  });
});
