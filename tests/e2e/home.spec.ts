import { test, expect } from '@playwright/test';

test.describe('ARESWEB Core Functionality', () => {
  test('Dashboard loads successfully', async ({ page }) => {
    await page.goto('/');
    
    // We expect the main ARES portal to load with its title
    await expect(page).toHaveTitle(/ARES/i);
    
    // The main navigation should be visible
    const nav = page.locator('nav');
    await expect(nav).toBeVisible();
  });
});
