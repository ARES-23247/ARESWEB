import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { setupMockAuth } from '../fixtures/auth';

test.describe('Admin Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await setupMockAuth(page, { useRealAuth: true });
  });

  test('Admin dashboard loads and displays authorized management hubs', async ({ page }) => {
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });

    // Wait for page to load
    await page.waitForTimeout(2000);

    // Ensure dashboard content is visible - check for either welcome text or dashboard heading
    const welcomeText = page.getByText(/Welcome back/i).first();
    const dashboardHeading = page.getByRole('heading', { name: /dashboard|command center/i });
    const hasContent = await welcomeText.isVisible().catch(() => false) ||
                       await dashboardHeading.isVisible().catch(() => false);
    expect(hasContent).toBe(true);

    // Verify admin hubs are accessible - these may be in different sections
    const userRoles = page.getByText(/User Roles/i);
    const systemIntegrations = page.getByText(/System Integrations/i);
    const hasUserRoles = await userRoles.isVisible().catch(() => false);
    const hasSystemIntegrations = await systemIntegrations.isVisible().catch(() => false);

    // At least one admin hub should be visible
    expect(hasUserRoles || hasSystemIntegrations).toBe(true);

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
