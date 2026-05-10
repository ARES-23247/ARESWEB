import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { setupMockAuth } from '../fixtures/auth';

test.describe('Admin Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await setupMockAuth(page, { useRealAuth: true });
  });

  test('Admin dashboard loads and displays authorized management hubs', async ({ page }) => {
    // Intercept the profile/me API call to see what happens
    const profilePromise = page.waitForResponse(
      (resp) => resp.url().includes('/profile/me') || resp.url().includes('/api/profile/me'),
      { timeout: 15000 }
    ).catch(() => null);

    await page.goto('/dashboard', { waitUntil: 'networkidle' });

    // Check what profile/me returned
    const profileResponse = await profilePromise;
    if (profileResponse) {
      const profileStatus = profileResponse.status();
      const profileBody = await profileResponse.text().catch(() => 'FAILED_TO_READ');
      console.log(`[Diag] /api/profile/me status: ${profileStatus}`);
      console.log(`[Diag] /api/profile/me body (first 500): ${profileBody.slice(0, 500)}`);
    } else {
      console.log('[Diag] /api/profile/me was NEVER called or timed out');
    }

    // Also check get-session from browser context
    const diagnostics = await page.evaluate(async () => {
      const sessionRes = await fetch('/api/auth/get-session');
      const sessionData = await sessionRes.json();
      const profileRes = await fetch('/api/profile/me');
      const profileData = await profileRes.text();
      // Capture what's actually on the page
      const bodyText = document.body?.innerText?.slice(0, 1000) || 'NO_BODY';
      return {
        sessionStatus: sessionRes.status,
        sessionOk: !!sessionData?.session,
        profileStatus: profileRes.status,
        profileBody: profileData.slice(0, 500),
        pageContent: bodyText,
      };
    });
    console.log('[Diag] Browser diagnostics:', JSON.stringify(diagnostics, null, 2));

    // Ensure dashboard title is visible
    await expect(page.getByText(/Welcome back/i).first()).toBeVisible({ timeout: 10000 });

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
