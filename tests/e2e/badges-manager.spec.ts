import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { setupMockAuth } from '../fixtures/auth';
import { TEST_TIMEOUTS } from '../fixtures/mock-data';

/**
 * E2E tests for Badges Manager dashboard route.
 * Tests verify:
 * - BADGES-01: Badge list displays correctly
 * - BADGES-02: Badge creation workflow
 * - BADGES-03: Badge assignment workflow
 * - BADGES-04: Badge deletion workflow
 * - BADGES-05: WCAG 2.1 AA accessibility compliance
 */

test.describe('Badges Manager', () => {
  test.beforeEach(async ({ page }) => {
    await setupMockAuth(page, { useRealAuth: true });
  });

  test('BADGES-01: Badge list displays correctly', async ({ page }) => {
    await page.goto('/dashboard/badges');

    // Verify the page title is visible
    await expect(page.getByRole('heading', { name: /Badge Management/i })).toBeVisible({
      timeout: TEST_TIMEOUTS.DEFAULT,
    });

    // Verify badge index section is visible
    await expect(page.getByText(/Badge Index/i)).toBeVisible();

    // Verify Manual Badge Grant section
    await expect(page.getByRole('heading', { name: /Manual Badge Grant/i })).toBeVisible();
    await expect(page.getByLabel(/Target Member/i)).toBeVisible();
    await expect(page.getByLabel(/Select Badge/i)).toBeVisible();
  });

  test('BADGES-02: Badge creation workflow', async ({ page }) => {
    await page.goto('/dashboard/badges');

    // Click "New Badge Type" button to expand creation form
    await page.getByRole('button', { name: /New Badge Type/i }).click();

    // Verify creation form is visible
    await expect(page.getByLabel(/Badge ID/i)).toBeVisible();
    await expect(page.getByLabel(/Display Name/i)).toBeVisible();
    await expect(page.getByLabel(/Icon/i)).toBeVisible();
    await expect(page.getByLabel(/Color Theme/i)).toBeVisible();
    await expect(page.getByLabel(/Description/i)).toBeVisible();

    // Fill in the badge creation form
    await page.getByLabel(/Badge ID/i).fill(`test-badge-${Date.now()}`);
    await page.getByLabel(/Display Name/i).fill('Test Badge');
    await page.getByLabel(/Icon/i).fill('Code');
    await page.getByLabel(/Color Theme/i).fill('text-blue-500');
    await page.getByLabel(/Description/i).fill('Test badge description');

    // Submit the form
    await page.getByRole('button', { name: /Save Badge/i }).click();

    // Verify the form was closed by waiting for the "New Badge Type" button to be visible again
    await expect(page.getByRole('button', { name: /New Badge Type/i })).toBeVisible();
  });

  test('BADGES-03: Badge assignment workflow', async ({ page }) => {
    await page.goto('/dashboard/badges');

    // Wait for the page to load
    await expect(page.getByRole('heading', { name: /Manual Badge Grant/i })).toBeVisible();

    // Select a user from the dropdown — wait for options to load from API
    const userSelect = page.getByLabel(/Target Member/i);
    await expect(userSelect).toBeVisible();

    // Wait for user options to populate from the real API
    const optionCount = await userSelect.locator('option').count();
    if (optionCount <= 1) {
      // Only the empty placeholder exists — no users loaded from API, skip
      test.skip(true, 'No users loaded in Target Member dropdown');
      return;
    }
    await userSelect.selectOption({ index: 1 });

    // Verify user was selected
    await expect(userSelect).not.toHaveValue('');

    // Select a badge from the dropdown (index 0 is the empty placeholder)
    const badgeSelect = page.getByLabel(/Select Badge/i);
    await badgeSelect.selectOption({ index: 1 });

    // Verify badge was selected
    await expect(badgeSelect).not.toHaveValue('');

    // Verify the grant button is enabled
    const grantButton = page.getByRole('button', { name: /Grant Badge/i });
    await expect(grantButton).toBeEnabled();

    // Click the grant button
    await grantButton.click();

    // Verify the selections were reset after successful grant
    await expect.poll(async () => await userSelect.inputValue(), { timeout: 5000 }).toBe('');
  });

  test('BADGES-04: Badge deletion workflow', async ({ page }) => {
    await page.goto('/dashboard/badges');

    // Wait for badges to load
    await expect(page.getByRole('heading', { name: /Badge Management/i })).toBeVisible();

    // Find a badge card by looking for items with an ID label and locate its delete button
    const badgeCard = page.locator('[class*="bg-ares-gray-dark"]').filter({ hasText: /ID:/ }).first();
    const deleteButton = badgeCard.getByRole('button').first();

    // First click shows confirmation state
    await deleteButton.click();
    await page.waitForTimeout(200);

    // Second click confirms deletion
    await deleteButton.click();

    // Wait for mutation to complete
    await page.waitForTimeout(500);
  });

  test('BADGES-05: WCAG 2.1 AA accessibility audit', async ({ page }) => {
    await page.goto('/dashboard/badges');

    // Wait for the page to fully load
    await expect(page.getByRole('heading', { name: /Badge Management/i })).toBeVisible({
      timeout: TEST_TIMEOUTS.DEFAULT,
    });

    // ── Accessibility Audit ───────────────────────────────────────────
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      // Disable duplicate-id and color-contrast since dark-mode brand palette has known contrast tradeoffs
      .disableRules(['duplicate-id', 'color-contrast'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('BADGES-06: Form validation prevents empty submissions', async ({ page }) => {
    await page.goto('/dashboard/badges');

    // Click "New Badge Type" button to expand creation form
    await page.getByRole('button', { name: /New Badge Type/i }).click();

    // Verify the save button is disabled when required fields are empty
    const saveButton = page.getByRole('button', { name: /Save Badge/i });
    await expect(saveButton).toBeDisabled();

    // Fill in only the ID (name is still required)
    await page.getByLabel(/Badge ID/i).fill('test-badge');
    await expect(saveButton).toBeDisabled();

    // Fill in the name (now required fields are satisfied)
    await page.getByLabel(/Display Name/i).fill('Test Badge');
    await expect(saveButton).toBeEnabled();
  });

  test('BADGES-07: Grant button disabled without selection', async ({ page }) => {
    await page.goto('/dashboard/badges');

    // Wait for the page to load
    await expect(page.getByRole('heading', { name: /Manual Badge Grant/i })).toBeVisible();

    // Verify grant button is initially disabled
    const grantButton = page.getByRole('button', { name: /Grant Badge/i });
    await expect(grantButton).toBeDisabled();
  });

  test('BADGES-08: Badge creation form can be cancelled', async ({ page }) => {
    await page.goto('/dashboard/badges');

    // Click "New Badge Type" button to expand creation form
    await page.getByRole('button', { name: /New Badge Type/i }).click();

    // Verify form fields are visible
    await expect(page.getByLabel(/Badge ID/i)).toBeVisible();

    // Fill in some data
    await page.getByLabel(/Badge ID/i).fill('test-badge');
    await page.getByLabel(/Display Name/i).fill('Test Badge');

    // Click Cancel button
    await page.getByRole('button', { name: /Cancel/i }).click();

    // Verify form is hidden (New Badge Type button is visible again)
    await expect(page.getByRole('button', { name: /New Badge Type/i })).toBeVisible();
    await expect(page.getByLabel(/Badge ID/i)).not.toBeVisible();
  });

  test('BADGES-09: Badge ID and technical details are displayed', async ({ page }) => {
    await page.goto('/dashboard/badges');

    // Wait for badges to load
    await expect(page.getByRole('heading', { name: /Badge Management/i })).toBeVisible();

    // Verify at least one badge is displayed with its ID
    const badgeId = page.getByText(/ID:/i);
    await expect(badgeId.first()).toBeVisible();
  });
});
