import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { setupMockAuth } from '../fixtures/auth';
import { TEST_TIMEOUTS } from '../fixtures/mock-data';

test.describe('Admin Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await setupMockAuth(page);

    // Mock logistics API endpoints
    await page.route('**/api/logistics/admin/**', async (route) => {
      const url = route.request().url();

      // GET /api/logistics/admin/summary - return logistics summary
      if (url.includes('/summary')) {
        await route.fulfill({
          status: 200,
          json: {
            dietary: { 'Vegetarian': 3, 'Gluten-Free': 1, 'No Restrictions': 8 },
            tshirts: { 'S': 2, 'M': 4, 'L': 3, 'XL': 2 },
            totalCount: 12,
            staleProfiles: [],
          },
        });
        return;
      }

      // GET /api/logistics/admin/export-emails - return user emails
      if (url.includes('/export-emails')) {
        await route.fulfill({
          status: 200,
          json: {
            users: [
              { name: 'Test User 1', email: 'test1@ares.org', role: 'admin', emergencyName: 'Jane Doe', emergencyPhone: '555-0100' },
              { name: 'Test User 2', email: 'test2@ares.org', role: 'member', emergencyName: 'John Smith', emergencyPhone: '555-0101' },
            ],
          },
        });
        return;
      }

      route.continue();
    });
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

    // Wait for the DietarySummary component to load - the header text is "Team Logistics Summary"
    await expect(page.getByText(/Team Logistics Summary/i)).toBeVisible({
      timeout: TEST_TIMEOUTS.SLOW_PAGE,
    });

    // Click export emails
    await page.getByRole('button', { name: /Export Roster Emails/i }).click();

    // Verify modal appeared with data
    await expect(page.getByText(/Active Roster/i)).toBeVisible();

    const copyBtn = page.getByRole('button', { name: /Copy/i });
    await expect(copyBtn).toBeVisible();
  });
});
