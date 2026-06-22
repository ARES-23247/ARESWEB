import { test, expect } from '@playwright/test';

test.describe('Dashboard Authentication E2E tests', () => {
  test('should log in using developer bypass and access dashboard', async ({ page }) => {
    // Go to dashboard (which triggers login overlay)
    await page.goto('/dashboard');
    
    // Check that we see the developer bypass active text
    await expect(page.locator('body')).toContainText('Developer Bypass Active');
    
    // Click the mock admin login button
    const adminButton = page.locator('button', { hasText: 'David (Admin)' });
    await expect(adminButton).toBeVisible();
    await adminButton.click();
    
    // Verify that we are logged in and see the dashboard profile name
    await expect(page.locator('body')).toContainText('Coach David', { timeout: 15000 });
  });
});
