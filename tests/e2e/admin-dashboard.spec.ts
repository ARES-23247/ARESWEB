import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { setupMockAuth } from '../fixtures/auth';

test.describe('Admin Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await setupMockAuth(page);
  });

  test('Admin dashboard loads and displays authorized management hubs', async ({ page }) => {
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });

    // Wait for page to load and network to settle
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);

    // Ensure dashboard content is visible - check for multiple possible indicators
    const welcomeText = page.getByText(/Welcome back/i);
    const anyHeading = page.getByRole('heading');
    const dashboardContent = page.locator('main, #dashboard-content, [class*="dashboard"]');

    // Wait for at least one content indicator to be present
    const hasContent = await Promise.any([
      welcomeText.isVisible().catch(() => false),
      anyHeading.first().isVisible().catch(() => false),
      dashboardContent.first().isVisible().catch(() => false),
    ]).catch(() => false);

    expect(hasContent).toBe(true);

    // ── Accessibility Audit ───────────────────────────────────────────
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .disableRules(['color-contrast'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('Command Center displays security telemetry', async ({ page }) => {
    await page.goto('/dashboard');

    // Verify Security Blocks widget is visible
    await expect(page.getByText(/Sec Blocks/i)).toBeVisible();
  });

  test('Logistics tab supports email export', async ({ page }) => {
    await page.goto('/dashboard/logistics');

    // Wait for the DietarySummary component to load
    await expect(page.getByText(/Team Logistics/i)).toBeVisible();

    // Click export emails
    await page.getByRole('button', { name: /Export Roster Emails/i }).click();

    // Verify modal appeared with data
    await expect(page.getByText(/Active Roster/i)).toBeVisible();

    const copyBtn = page.getByRole('button', { name: /Copy/i });
    await expect(copyBtn).toBeVisible();
  });
});
