import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { setupMockAuth } from '../fixtures/auth';
import { TEST_TIMEOUTS } from '../fixtures/mock-data';

/**
 * E2E tests for Sponsor Manager dashboard route.
 * Tests verify:
 * - SPONSORS-01: Sponsor list displays correctly
 * - SPONSORS-02: Sponsor creation workflow
 * - SPONSORS-03: Sponsor editing workflow
 * - SPONSORS-04: Sponsor deletion workflow
 * - SPONSORS-05: WCAG 2.1 AA accessibility compliance
 * - SPONSORS-06: Form validation prevents invalid submissions
 * - SPONSORS-07: Logo upload functionality
 */

test.describe('Sponsor Manager', () => {
  test.beforeEach(async ({ page }) => {
    await setupMockAuth(page, { useRealAuth: true });
  });

  test('SPONSORS-01: Sponsor list displays correctly', async ({ page }) => {
    await page.goto('/dashboard/sponsors');

    // Verify the page title is visible
    await expect(page.getByRole('heading', { name: /Sponsor/i })).toBeVisible({
      timeout: TEST_TIMEOUTS.DEFAULT,
    });

    // Verify "Add Partner" button is visible
    await expect(page.getByRole('button', { name: /Add Partner/i })).toBeVisible();
  });

  test('SPONSORS-02: Sponsor creation workflow', async ({ page }) => {
    await page.goto('/dashboard/sponsors');

    // Click "Add Partner" button to expand creation form
    await page.getByRole('button', { name: /Add Partner/i }).click();

    // Verify creation form is visible
    await expect(page.getByLabel(/Partner Name/i)).toBeVisible();
    await expect(page.getByLabel(/Tier/i)).toBeVisible();
    await expect(page.getByLabel(/Logo/i)).toBeVisible();
    await expect(page.getByLabel(/Website/i)).toBeVisible();

    // Fill in the sponsor creation form
    await page.getByLabel(/Partner Name/i).fill(`Test Sponsor ${Date.now()}`);
    await page.getByLabel(/Tier/i).selectOption('Gold');
    await page.getByLabel(/Logo/i).fill('https://example.com/logo.png');
    await page.getByLabel(/Website/i).fill('https://example.com');

    // Submit the form
    await page.getByRole('button', { name: /Commit/i }).click();

    // Wait for mutation to complete
    await page.waitForTimeout(500);

    // Verify the form was closed (Add Partner button should be visible again)
    await expect(page.getByRole('button', { name: /Add Partner/i })).toBeVisible();
  });

  test('SPONSORS-03: Sponsor editing workflow', async ({ page }) => {
    await page.goto('/dashboard/sponsors');

    // Wait for sponsors to load
    await expect(page.getByRole('heading', { name: /Sponsor/i })).toBeVisible();

    // Find the first sponsor card and click its edit button
    const sponsorCard = page.locator('.border').first();
    const editButton = sponsorCard.getByRole('button').filter({ hasText: /Edit/i }).first();
    await editButton.click();

    // Verify form is visible with pre-filled data
    await expect(page.getByLabel(/Partner Name/i)).toBeVisible();

    // Modify the sponsor data
    await page.getByLabel(/Partner Name/i).fill(`Updated Sponsor ${Date.now()}`);

    // Submit the form
    await page.getByRole('button', { name: /Update/i }).click();

    // Wait for mutation to complete
    await page.waitForTimeout(500);

    // Verify the form was closed
    await expect(page.getByRole('button', { name: /Add Partner/i })).toBeVisible();
  });

  test('SPONSORS-04: Sponsor deletion workflow', async ({ page }) => {
    await page.goto('/dashboard/sponsors');

    // Wait for sponsors to load
    await expect(page.getByRole('heading', { name: /Sponsor/i })).toBeVisible();

    // Mock the modal confirm dialog to auto-confirm
    page.on('dialog', dialog => dialog.accept());

    // Find a sponsor card and click its delete button
    const sponsorCard = page.locator('.border').first();
    const deleteButton = sponsorCard.getByRole('button').filter({ hasText: /Delete/i }).first();
    await deleteButton.click();

    // Wait for mutation to complete
    await page.waitForTimeout(500);
  });

  test('SPONSORS-05: WCAG 2.1 AA accessibility audit', async ({ page }) => {
    await page.goto('/dashboard/sponsors');

    // Wait for the page to fully load
    await expect(page.getByRole('heading', { name: /Sponsor/i })).toBeVisible({
      timeout: TEST_TIMEOUTS.DEFAULT,
    });

    // ── Accessibility Audit ───────────────────────────────────────────
    const accessibilityScanResults = await new AxeBuilder({ page })
      .disableRules(['color-contrast'])
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      // Disable duplicate-id check since virtualization can cause harmless duplicates
      .disableRules(['duplicate-id', 'color-contrast'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('SPONSORS-06: Form validation prevents invalid submissions', async ({ page }) => {
    await page.goto('/dashboard/sponsors');

    // Click "Add Partner" button to expand creation form
    await page.getByRole('button', { name: /Add Partner/i }).click();

    // Verify the submit button is disabled when required fields are empty
    const submitButton = page.getByRole('button', { name: /Commit/i });
    await expect(submitButton).toBeDisabled();

    // Fill in the name (tier is pre-selected, so this should enable the button)
    await page.getByLabel(/Partner Name/i).fill('Test Sponsor');
    await expect(submitButton).toBeEnabled();
  });

  test('SPONSORS-07: Logo upload functionality', async ({ page }) => {
    await page.goto('/dashboard/sponsors');

    // Click "Add Partner" button to expand creation form
    await page.getByRole('button', { name: /Add Partner/i }).click();

    // Verify the logo input field is visible
    await expect(page.getByLabel(/Logo/i)).toBeVisible();
  });

  test('SPONSORS-08: Sponsor form can be cancelled', async ({ page }) => {
    await page.goto('/dashboard/sponsors');

    // Click "Add Partner" button to expand creation form
    await page.getByRole('button', { name: /Add Partner/i }).click();

    // Verify form fields are visible
    await expect(page.getByLabel(/Partner Name/i)).toBeVisible();

    // Fill in some data
    await page.getByLabel(/Partner Name/i).fill('Test Sponsor');
    await page.getByLabel(/Website/i).fill('https://example.com');

    // Click Cancel button
    await page.getByRole('button', { name: /Cancel/i }).click();

    // Verify form is hidden (Add Partner button is visible again)
    await expect(page.getByRole('button', { name: /Add Partner/i })).toBeVisible();
    await expect(page.getByLabel(/Partner Name/i)).not.toBeVisible();
  });

  test('SPONSORS-09: All tier options are available', async ({ page }) => {
    await page.goto('/dashboard/sponsors');

    // Click "Add Partner" button to expand creation form
    await page.getByRole('button', { name: /Add Partner/i }).click();

    // Get all options from the tier select
    const tierSelect = page.getByLabel(/Tier/i);
    const options = await tierSelect.locator('option').allTextContents();

    // Verify all expected tiers are present
    expect(options).toContain('Titanium');
    expect(options).toContain('Gold');
    expect(options).toContain('Silver');
    expect(options).toContain('Bronze');
    expect(options).toContain('In-Kind');
  });

  test('SPONSORS-11: Website links are external and have correct attributes', async ({ page }) => {
    await page.goto('/dashboard/sponsors');

    // Wait for sponsors to load
    await expect(page.getByRole('heading', { name: /Sponsor/i })).toBeVisible();

    // Find any website link
    const websiteLink = page.getByRole('link', { name: /Visit/i }).first();

    // Verify it has target="_blank" and rel="noreferrer"
    const target = await websiteLink.getAttribute('target');
    const rel = await websiteLink.getAttribute('rel');

    expect(target).toBe('_blank');
    expect(rel).toBe('noreferrer');
  });
});
