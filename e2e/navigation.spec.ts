import { test, expect } from '@playwright/test';

test.describe('Navigation & Accessibility E2E tests', () => {
  test('should navigate to homepage and verify branding', async ({ page }) => {
    await page.goto('/');
    // Check that ARES exists somewhere in the body
    await expect(page.locator('body')).toContainText('ARES');
  });

  test('should have a working skip link for accessibility', async ({ page }) => {
    await page.goto('/');
    
    // Press tab to focus the skip link
    await page.keyboard.press('Tab');
    
    // Check that the active element is indeed the skip link
    const skipLink = page.getByRole('link', { name: 'Skip to main content' });
    await expect(skipLink).toBeFocused();
    
    // Click it
    await skipLink.click();
    
    // The focus or element target should scroll/move to main content
    const mainContent = page.locator('#main-content');
    await expect(mainContent).toBeVisible();
  });
  
  test('should navigate to public page about roster', async ({ page }) => {
    await page.goto('/about');
    // Ensure headings or titles exist
    const heading = page.locator('h1, h2').first();
    await expect(heading).toBeVisible();
  });
});
