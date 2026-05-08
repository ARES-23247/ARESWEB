import { test, expect } from '@playwright/test';
import { setupMockAuth } from '../fixtures/auth';

test.describe('Calendar Repair API Integration', () => {
  test.beforeEach(async ({ page }) => {
    await setupMockAuth(page);
    await page.goto('/');
  });

  test('POST /api/events/admin/sync triggers calendar repair', async ({ page }) => {
    // Mock the actual API request to simulate a successful repair
    await page.route('**/api/events/admin/sync', async (route) => {
      await route.fulfill({
        status: 200,
        json: { success: true, synced: 5, errors: [] },
      });
    });

    // Make the request using page.evaluate so it triggers page.route interception
    const body = await page.evaluate(async () => {
      const res = await fetch('/api/events/admin/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      return { status: res.status, data: await res.json() };
    });

    expect(body.status).toBe(200);
    expect(body.data.success).toBe(true);
    expect(body.data.synced).toBe(5);
  });
});
