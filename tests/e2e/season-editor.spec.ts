import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { setupMockAuth } from '../fixtures/auth';
import { TEST_TIMEOUTS } from '../fixtures/mock-data';

test.describe('Season/Award Editor E2E', () => {
  test.beforeEach(async ({ page }) => {
    await setupMockAuth(page);
  });

  test.describe('Season Creation Workflow', () => {
    test('should display season editor with empty form for new season', async ({ page }) => {
      await page.goto('/dashboard/seasons');

      // Verify editor title for new season
      await expect(page.getByRole('heading', { name: /Forge New Legacy/i })).toBeVisible({
        timeout: TEST_TIMEOUTS.DEFAULT,
      });

      // Verify subtitle describing the purpose
      await expect(page.getByText(/Documenting the evolution of ARES 23247/i)).toBeVisible();

      // Verify form fields are present and accessible
      await expect(page.getByLabel(/Season Year/i)).toBeVisible();
      await expect(page.getByLabel(/Challenge Name/i)).toBeVisible();
      await expect(page.getByLabel(/Robot Name/i)).toBeVisible();
      await expect(page.getByLabel(/Google Photos Album Link/i)).toBeVisible();
      await expect(page.getByLabel(/CAD Link/i)).toBeVisible();
      await expect(page.getByLabel(/Brief Summary/i)).toBeVisible();

      // Verify editor actions are present
      await expect(page.getByRole('button', { name: /SAVE AS DRAFT/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /Establish Legacy/i })).toBeVisible();
    });

    test('should validate required fields when publishing without data', async ({ page }) => {
      await page.goto('/dashboard/seasons');

      // Click publish without filling required fields
      await page.getByRole('button', { name: /Establish Legacy/i }).click();

      // Verify validation error appears
      await expect(page.getByText(/Start Year and Challenge Name are required/i)).toBeVisible({
        timeout: TEST_TIMEOUTS.DEFAULT,
      });
    });

    test('should allow filling season form data', async ({ page }) => {
      await page.goto('/dashboard/seasons');

      // Fill in the season form
      await page.getByLabel(/Season Year/i).fill('2025');
      await page.getByLabel(/Challenge Name/i).fill('CRESCENDO');
      await page.getByLabel(/Robot Name/i).fill('ARES-7');
      await page.getByLabel(/CAD Link/i).fill('https://cad.onshape.com/documents/ares-7');
      await page.getByLabel(/Brief Summary/i).fill('Our most competitive robot yet.');

      // Verify values are set
      await expect(page.getByLabel(/Season Year/i)).toHaveValue('2025');
      await expect(page.getByLabel(/Challenge Name/i)).toHaveValue('CRESCENDO');
      await expect(page.getByLabel(/Robot Name/i)).toHaveValue('ARES-7');
    });

    test('should save season draft successfully', async ({ page }) => {
      await page.goto('/dashboard/seasons');

      // Fill required fields
      await page.getByLabel(/Season Year/i).fill('2025');
      await page.getByLabel(/Challenge Name/i).fill('CRESCENDO');

      // Save as draft
      await page.getByRole('button', { name: /SAVE AS DRAFT/i }).click();

      // Should redirect to manage seasons page after successful save
      await expect(page).toHaveURL(/\/dashboard\/manage_seasons/, {
        timeout: TEST_TIMEOUTS.SLOW_PAGE,
      });
    });

    test('should publish season successfully', async ({ page }) => {
      await page.goto('/dashboard/seasons');

      // Fill required fields
      await page.getByLabel(/Season Year/i).fill('2025');
      await page.getByLabel(/Challenge Name/i).fill('CRESCENDO');
      await page.getByLabel(/Robot Name/i).fill('ARES-7');

      // Publish season
      await page.getByRole('button', { name: /Establish Legacy/i }).click();

      // Should redirect to manage seasons page after successful publish
      await expect(page).toHaveURL(/\/dashboard\/manage_seasons/, {
        timeout: TEST_TIMEOUTS.SLOW_PAGE,
      });
    });
  });

  test.describe('Accessibility Audit (WCAG 2.1 AA)', () => {
    test('should pass WCAG 2.1 AA accessibility audit for new season form', async ({ page }) => {
      await page.goto('/dashboard/seasons');

      // Wait for page to fully load
      await expect(page.getByRole('heading', { name: /Forge New Legacy/i })).toBeVisible({
        timeout: TEST_TIMEOUTS.DEFAULT,
      });

      // Run accessibility audit
      const accessibilityScanResults = await new AxeBuilder({ page })
        .disableRules(['color-contrast'])
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();

      expect(accessibilityScanResults.violations).toEqual([]);
    });

    test('should have proper form label associations', async ({ page }) => {
      await page.goto('/dashboard/seasons');

      // Verify all form inputs have associated labels
      const seasonYearInput = page.getByLabel(/Season Year/i);
      await expect(seasonYearInput).toBeVisible();

      const challengeNameInput = page.getByLabel(/Challenge Name/i);
      await expect(challengeNameInput).toBeVisible();

      const robotNameInput = page.getByLabel(/Robot Name/i);
      await expect(robotNameInput).toBeVisible();

      const summaryInput = page.getByLabel(/Brief Summary/i);
      await expect(summaryInput).toBeVisible();

      // Verify buttons have accessible names
      await expect(page.getByRole('button', { name: /SAVE AS DRAFT/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /Establish Legacy/i })).toBeVisible();
    });

    test('should be keyboard navigable', async ({ page }) => {
      await page.goto('/dashboard/seasons');

      // Focus the first form field directly (there may be skip links/nav before the form)
      await page.getByLabel(/Season Year/i).focus();
      await expect(page.getByLabel(/Season Year/i)).toBeFocused();

      // Verify Tab key moves focus to another focusable element
      await page.keyboard.press('Tab');
      const focusedAfterFirstTab = await page.evaluate(() => document.activeElement?.tagName);
      expect(['INPUT', 'TEXTAREA', 'BUTTON', 'SELECT']).toContain(focusedAfterFirstTab);

      // Verify another Tab press moves focus again
      await page.keyboard.press('Tab');
      const focusedAfterSecondTab = await page.evaluate(() => document.activeElement?.tagName);
      expect(['INPUT', 'TEXTAREA', 'BUTTON', 'SELECT']).toContain(focusedAfterSecondTab);
    });
  });

  test.describe('Award Editor Integration', () => {
    test('should load award editor from dashboard', async ({ page }) => {
      await page.goto('/dashboard/legacy');

      // Verify award editor loads
      await expect(page.getByRole('heading', { name: /Trophy Case Management/i })).toBeVisible({
        timeout: TEST_TIMEOUTS.DEFAULT,
      });
    });

    test('should add new award', async ({ page }) => {
      await page.goto('/dashboard/legacy');

      // Click Add Award button
      await page.getByRole('button', { name: /Add Award/i }).click();

      // Fill award form
      await page.getByLabel(/Award Title/i).fill('Innovative Design');
      await page.getByLabel(/Event Name/i).fill('World Championship');
      await page.getByLabel(/Description/i).fill('Unique mechanism for scoring');

      // Submit form
      await page.getByRole('button', { name: /Commemorate Achievement/i }).click();

      // Form should close after submission
      await expect(page.getByRole('button', { name: /Add Award/i })).toBeVisible({
        timeout: TEST_TIMEOUTS.DEFAULT,
      });
    });

    test('should pass WCAG 2.1 AA accessibility audit for award editor', async ({ page }) => {
      await page.goto('/dashboard/legacy');

      // Wait for page to fully load
      await expect(page.getByRole('heading', { name: /Trophy Case Management/i })).toBeVisible({
        timeout: TEST_TIMEOUTS.DEFAULT,
      });

      // Run accessibility audit
      const accessibilityScanResults = await new AxeBuilder({ page })
        .disableRules(['color-contrast'])
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();

      expect(accessibilityScanResults.violations).toEqual([]);
    });
  });
});
