import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { setupMockAuth } from '../fixtures/auth';

test.describe('Admin Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await setupMockAuth(page, { useRealAuth: true });
  });

  test('Admin dashboard loads and displays authorized management hubs', async ({ page }) => {
    await page.goto('/dashboard');

    // Debug session state from browser context
    const sessionData = await page.evaluate(async () => {
      console.log('Cookies available:', document.cookie);
      const res = await fetch('/api/auth/get-session');
      return { cookies: document.cookie, data: await res.json() };
    });
    console.log('Browser Session response:', sessionData);
    
    // Ensure dashboard title is visible
    await expect(page.getByRole('heading', { name: /ARES/i }).first()).toBeVisible();

    // Verify user profile section rendered the mocked user
    await page.screenshot({ path: 'admin-dashboard.png', fullPage: true });
    await expect(page.getByText(/Admin User/i).first()).toBeVisible();
    // Verify admin hubs are accessible
    await expect(page.getByText(/User Roles/i)).toBeVisible();
    await expect(page.getByText(/System Integrations/i)).toBeVisible();

    // ── Accessibility Audit ───────────────────────────────────────────
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
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
