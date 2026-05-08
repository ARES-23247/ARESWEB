import { test, expect } from '@playwright/test';
import { setupMockAuth } from '../fixtures/auth';

/**
 * Calendar Repair API Integration Tests
 *
 * Tests use real database calls. The /api/events/admin/sync endpoint
 * will interact with actual seeded test data.
 */

test.describe('Calendar Repair API Integration', () => {
  test.beforeEach(async ({ page }) => {
    await setupMockAuth(page, { useRealAuth: true });
    await page.goto('/');
  });

  test('POST /api/events/admin/sync triggers calendar repair', async ({ page }) => {
    // Real API call - no mocking
    const body = await page.evaluate(async () => {
      const res = await fetch('/api/events/admin/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      return { status: res.status, data: await res.json() };
    });

    // Verify the response is successful
    expect(body.status).toBe(200);
    expect(body.data.success).toBe(true);

    // The actual count will vary based on database state
    expect(typeof body.data.synced).toBe('number');
  });
});
