import { test, expect } from './fixtures';

test.describe('Navigation & Accessibility E2E tests', () => {
  test('should navigate to homepage and verify branding', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle('ARES 23247 | Morgantown Robotics Team');
    // The team—not one of its software projects—is the primary homepage identity.
    const heroHeading = page.getByRole('heading', {
      name: 'ARES 23247 — Engineered To Inspire',
    });
    await expect(heroHeading).toBeVisible();
    const watermarkMask = await page.getByTestId('hero-watermark').evaluate((element) => {
      const style = getComputedStyle(element);
      return style.maskImage || style.webkitMaskImage;
    });
    expect(watermarkMask).toContain('radial-gradient');

    // Verify key button "View Schedule" is visible
    const viewScheduleButton = page.getByRole('link', { name: 'View Schedule' });
    await expect(viewScheduleButton).toBeVisible();

    // ARES Analytics remains identifiable as a secondary team project for OAuth
    // verification, without displacing the team's public identity.
    const analyticsSection = page.getByLabel('ARES Analytics');
    await expect(analyticsSection.getByRole('heading', { name: 'ARES Analytics' })).toBeVisible();
    await expect(analyticsSection.getByRole('link', { name: 'Privacy' })).toHaveAttribute('href', '/privacy');
    await expect(analyticsSection.getByRole('link', { name: 'Terms' })).toHaveAttribute('href', '/terms');
  });

  test('should have a working skip link for accessibility', async ({ page, browserName }) => {
    await page.goto('/');

    const skipLink = page.getByRole('link', { name: 'Skip to main content' });
    
    // Press tab to focus the skip link
    if (browserName === 'webkit') {
      await skipLink.focus();
    } else {
      await page.keyboard.press('Tab');
    }
    
    // Check that the active element is indeed the skip link
    await expect(skipLink).toBeFocused();
    
    // Activate the keyboard bypass control.
    await page.keyboard.press('Enter');
    
    // The focus or element target should scroll/move to main content
    const mainContent = page.locator('#main-content');
    await expect(mainContent).toBeVisible();
    await expect(mainContent).toBeFocused();
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

  test('mobile navigation traps focus and returns it after Escape', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    const trigger = page.locator('button[aria-controls="mobile-navigation-drawer"]');
    await expect(trigger).toHaveAccessibleName('Open navigation menu');
    await trigger.click();
    await expect(page.getByRole('dialog', { name: 'Mobile navigation menu' })).toBeVisible();
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');

    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: 'Mobile navigation menu' })).toBeHidden();
    await expect(trigger).toBeFocused();
  });
});
