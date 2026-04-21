import { test, expect } from '@playwright/test';

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
    
    // Check that we hit the Restricted Access gate component
    await expect(page.locator('h1').filter({ hasText: 'Restricted Access' })).toBeVisible();
    
    // There should be a button routing to the login
    await expect(page.locator('button', { hasText: /Sign In with ARES ID/i })).toBeVisible();
  });
});
