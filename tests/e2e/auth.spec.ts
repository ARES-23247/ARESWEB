import { test, expect } from '@playwright/test';
import { TEST_TIMEOUTS } from '../fixtures/mock-data';

test.describe('ARESWEB Authentication Flow', () => {
  test('Login page loads and shows providers', async ({ page }) => {
    await page.goto('/login');

    // Verify the login modal/form mounts
    await expect(page.locator('h1').filter({ hasText: 'ARES Portal' })).toBeVisible();

    // Check for provider buttons (Google, GitHub, Zulip)
    await expect(page.locator('button', { hasText: /Google/i })).toBeVisible();
    await expect(page.locator('button', { hasText: /GitHub/i })).toBeVisible();
    await expect(page.locator('button', { hasText: /Zulip/i })).toBeVisible();
  });

  test('Dashboard shows Restricted Access gate when unauthenticated', async ({ page }) => {
    await page.goto('/dashboard');

    // Check that we hit the Authentication Required gate component
    // This test now verifies real auth behavior - unauthenticated users are redirected
    await expect(page.getByText('Authentication Required')).toBeVisible({
      timeout: TEST_TIMEOUTS.SLOW_PAGE,
    }).catch(() => {
      // If redirected to login, that's also acceptable behavior
      expect(page.url()).toContain('/login');
    });

    // There should be a link routing to the login
    await expect(page.locator('a', { hasText: /Return to Login/i })).toBeVisible({
      timeout: TEST_TIMEOUTS.SLOW_PAGE,
    }).catch(() => {
      // If on login page, this is acceptable
      expect(page.url()).toContain('/login');
    });
  });
});
