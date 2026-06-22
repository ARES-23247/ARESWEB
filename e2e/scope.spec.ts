import { test, expect } from '@playwright/test';

test.describe('Dashboard Telemetry Scope E2E tests', () => {
  test('should load Scope dashboard page and render controls after login', async ({ page }) => {
    // Go to dashboard
    await page.goto('/dashboard');
    
    // Login using developer bypass
    const adminButton = page.locator('button', { hasText: 'David (Admin)' });
    await expect(adminButton).toBeVisible();
    await adminButton.click();
    
    // Wait for auth to complete and dashboard profile to be visible
    await expect(page.locator('text=Sign Out')).toBeVisible({ timeout: 15000 });
    
    // Navigate to scope page
    await page.locator('text=ARES-Scope').click();
    
    // Verify that the scope visualizer/replay canvas exists
    const canvas = page.locator('canvas');
    await expect(canvas.first()).toBeVisible({ timeout: 15000 });
    
    // Verify that the local simulator panels are on the screen
    await expect(page.locator('body')).toContainText('Local Sim');
  });
});
