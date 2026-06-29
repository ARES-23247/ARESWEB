import { test, expect } from './fixtures';

test.describe('Navigation & Accessibility E2E tests', () => {
  test('should navigate to homepage and verify branding', async ({ page }) => {
    await page.goto('/');
    // Check that the unique hero heading is visible
    const heroHeading = page.getByRole('heading', { name: 'Engineered To Inspire' });
    await expect(heroHeading).toBeVisible();

    // Verify key button "View Schedule" is visible
    const viewScheduleButton = page.getByRole('link', { name: 'View Schedule' });
    await expect(viewScheduleButton).toBeVisible();
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
    // Ensure the unique about heading is visible
    const aboutHeading = page.getByRole('heading', { name: 'About ARES' });
    await expect(aboutHeading).toBeVisible();

    // Ensure the roster section heading is visible
    const rosterHeading = page.getByRole('heading', { name: 'Our Championship Roster' });
    await expect(rosterHeading).toBeVisible();
  });
});
