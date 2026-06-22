import { test, expect } from '@playwright/test';

test.describe('Dashboard Field Editor E2E tests', () => {
  test('should load Field editor page and render canvas after login', async ({ page }) => {
    // Go to dashboard
    await page.goto('/dashboard');
    
    // Login using developer bypass
    const adminButton = page.locator('button', { hasText: 'David (Admin)' });
    await expect(adminButton).toBeVisible();
    await adminButton.click();
    
    // Wait for auth to complete
    await expect(page.locator('text=Sign Out')).toBeVisible({ timeout: 15000 });
    
    // Navigate to field editor page
    await page.locator('text=Field Editor').click();
    
    // Verify that the 2D field canvas exists
    const canvas = page.locator('canvas');
    await expect(canvas.first()).toBeVisible({ timeout: 15000 });
    
    // Verify that driver station or layout headers exist
    await expect(page.locator('body')).toContainText('Red Station');
  });
});
