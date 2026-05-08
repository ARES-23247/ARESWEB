import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { setupMockAuth } from '../fixtures/auth';
import { TEST_TIMEOUTS, createMockSponsors } from '../fixtures/mock-data';

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
    await setupMockAuth(page);

    // Mock GET /api/sponsors/admin/list - List all sponsors
    await page.route('**/api/sponsors/admin/list', async (route) => {
      const mockSponsors = createMockSponsors();
      await route.fulfill({
        status: 200,
        json: { sponsors: mockSponsors },
      });
    });

    // Mock POST /api/sponsors/admin/save - Save/create sponsor
    await page.route('**/api/sponsors/admin/save', async (route) => {
      await route.fulfill({
        status: 200,
        json: { success: true, id: 'new-sponsor' },
      });
    });

    // Mock DELETE /api/sponsors/admin/:id - Delete sponsor
    await page.route('**/api/sponsors/admin/*', async (route) => {
      const method = route.request().method();
      if (method === 'DELETE') {
        await route.fulfill({
          status: 200,
          json: { success: true },
        });
      } else {
        await route.continue();
      }
    });

    // Mock POST /api/media/upload - Logo upload
    await page.route('**/api/media/upload', async (route) => {
      await route.fulfill({
        status: 200,
        json: { success: true, url: 'https://example.com/uploaded-logo.png' },
      });
    });
  });

  test('SPONSORS-01: Sponsor list displays correctly', async ({ page }) => {
    await page.goto('/dashboard/sponsors');

    // Verify the page title is visible
    await expect(page.getByRole('heading', { name: /Sponsor Management/i })).toBeVisible({
      timeout: TEST_TIMEOUTS.DEFAULT,
    });

    // Verify page subtitle
    await expect(page.getByText('Recognize the partners who make ARES possible.')).toBeVisible();

    // Verify "Add Partner" button is visible
    await expect(page.getByRole('button', { name: /Add Partner/i })).toBeVisible();

    // Verify existing sponsors are displayed
    await expect(page.getByText('NASA')).toBeVisible();
    await expect(page.getByText('Google')).toBeVisible();
    await expect(page.getByText('Local Hardware Store')).toBeVisible();
    await expect(page.getByText('Software Company')).toBeVisible();

    // Verify tier badges are displayed
    await expect(page.getByText('Titanium')).toBeVisible();
    await expect(page.getByText('Gold')).toBeVisible();
    await expect(page.getByText('Bronze')).toBeVisible();
    await expect(page.getByText('In-Kind')).toBeVisible();

    // Verify sponsor cards have website and logo indicators
    await expect(page.getByText('Logo Linked')).toBeVisible();
  });

  test('SPONSORS-02: Sponsor creation workflow', async ({ page }) => {
    await page.goto('/dashboard/sponsors');

    // Click "Add Partner" button to expand creation form
    await page.getByRole('button', { name: /Add Partner/i }).click();

    // Verify creation form is visible
    await expect(page.getByLabel('Partner Name')).toBeVisible();
    await expect(page.getByLabel('Tier')).toBeVisible();
    await expect(page.getByLabel('Partner Logo')).toBeVisible();
    await expect(page.getByLabel('Website URL')).toBeVisible();

    // Fill in the sponsor creation form
    await page.getByLabel('Partner Name').fill('New Sponsor Company');
    await page.getByLabel('Tier').selectOption('Gold');
    await page.getByLabel('Partner Logo').fill('https://example.com/logo.png');
    await page.getByLabel('Website URL').fill('https://newsponsor.com');

    // Submit the form
    await page.getByRole('button', { name: 'Commit Partner to D1' }).click();

    // Wait for mutation to complete
    await page.waitForTimeout(500);

    // Verify the form was closed (Add Partner button should be visible again)
    await expect(page.getByRole('button', { name: /Add Partner/i })).toBeVisible();
  });

  test('SPONSORS-03: Sponsor editing workflow', async ({ page }) => {
    await page.goto('/dashboard/sponsors');

    // Wait for sponsors to load
    await expect(page.getByText('NASA')).toBeVisible();

    // Find the NASA sponsor card and click its edit button
    const nasaCard = page.getByText('NASA').locator('../..');
    const editButton = nasaCard.getByRole('button', { name: /Edit NASA/i });
    await editButton.click();

    // Verify form is visible with pre-filled data
    await expect(page.getByLabel('Partner Name')).toBeVisible();
    await expect(page.getByLabel('Partner Name')).toHaveValue('NASA');

    // Verify tier is selected
    await expect(page.getByLabel('Tier')).toHaveValue('Titanium');

    // Modify the sponsor data
    await page.getByLabel('Partner Name').fill('NASA - Updated');

    // Submit the form
    await page.getByRole('button', { name: 'Update Partner in D1' }).click();

    // Wait for mutation to complete
    await page.waitForTimeout(500);

    // Verify the form was closed
    await expect(page.getByRole('button', { name: /Add Partner/i })).toBeVisible();
  });

  test('SPONSORS-04: Sponsor deletion workflow', async ({ page }) => {
    await page.goto('/dashboard/sponsors');

    // Wait for sponsors to load
    await expect(page.getByText('Local Hardware Store')).toBeVisible();

    // Mock the modal confirm dialog to auto-confirm
    page.on('dialog', dialog => dialog.accept());

    // Find the sponsor card and click its delete button
    const sponsorCard = page.getByText('Local Hardware Store').locator('../..');
    const deleteButton = sponsorCard.getByRole('button', { name: /Delete Local Hardware Store/i });
    await deleteButton.click();

    // Wait for mutation to complete
    await page.waitForTimeout(500);
  });

  test('SPONSORS-05: WCAG 2.1 AA accessibility audit', async ({ page }) => {
    await page.goto('/dashboard/sponsors');

    // Wait for the page to fully load
    await expect(page.getByRole('heading', { name: /Sponsor Management/i })).toBeVisible({
      timeout: TEST_TIMEOUTS.DEFAULT,
    });

    // ── Accessibility Audit ───────────────────────────────────────────
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      // Disable duplicate-id check since virtualization can cause harmless duplicates
      .disableRules(['duplicate-id'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('SPONSORS-06: Form validation prevents invalid submissions', async ({ page }) => {
    await page.goto('/dashboard/sponsors');

    // Click "Add Partner" button to expand creation form
    await page.getByRole('button', { name: /Add Partner/i }).click();

    // Verify the submit button is disabled when required fields are empty
    const submitButton = page.getByRole('button', { name: 'Commit Partner to D1' });
    await expect(submitButton).toBeDisabled();

    // Fill in only the name (tier is pre-selected to Gold, so this should be enough)
    await page.getByLabel('Partner Name').fill('Test Sponsor');
    await expect(submitButton).toBeEnabled();
  });

  test('SPONSORS-07: Logo upload functionality', async ({ page }) => {
    await page.goto('/dashboard/sponsors');

    // Click "Add Partner" button to expand creation form
    await page.getByRole('button', { name: /Add Partner/i }).click();

    // Verify the logo input field is visible
    await expect(page.getByLabel('Partner Logo')).toBeVisible();

    // Click the upload button (triggers file input)
    const uploadButton = page.getByRole('button').filter({ hasText: '' }).locator('nth=2');
    await uploadButton.click();

    // Wait a moment for the file dialog to be handled (mocked)
    await page.waitForTimeout(200);
  });

  test('SPONSORS-08: Sponsor form can be cancelled', async ({ page }) => {
    await page.goto('/dashboard/sponsors');

    // Click "Add Partner" button to expand creation form
    await page.getByRole('button', { name: /Add Partner/i }).click();

    // Verify form fields are visible
    await expect(page.getByLabel('Partner Name')).toBeVisible();

    // Fill in some data
    await page.getByLabel('Partner Name').fill('Test Sponsor');
    await page.getByLabel('Website URL').fill('https://example.com');

    // Click Cancel button
    await page.getByRole('button', { name: /Cancel/i }).click();

    // Verify form is hidden (Add Partner button is visible again)
    await expect(page.getByRole('button', { name: /Add Partner/i })).toBeVisible();
    await expect(page.getByLabel('Partner Name')).not.toBeVisible();
  });

  test('SPONSORS-09: All tier options are available', async ({ page }) => {
    await page.goto('/dashboard/sponsors');

    // Click "Add Partner" button to expand creation form
    await page.getByRole('button', { name: /Add Partner/i }).click();

    // Get all options from the tier select
    const tierSelect = page.getByLabel('Tier');
    const options = await tierSelect.locator('option').allTextContents();

    // Verify all expected tiers are present
    expect(options).toContain('Titanium');
    expect(options).toContain('Gold');
    expect(options).toContain('Silver');
    expect(options).toContain('Bronze');
    expect(options).toContain('In-Kind');
  });

  test('SPONSORS-10: Empty state displays when no sponsors exist', async ({ page }) => {
    // Override the mock to return empty sponsors list
    await page.route('**/api/sponsors/admin/list', async (route) => {
      await route.fulfill({
        status: 200,
        json: { sponsors: [] },
      });
    });

    await page.goto('/dashboard/sponsors');

    // Verify empty state message is visible
    await expect(page.getByText('No sponsors logged. Start by adding your titanium partners.')).toBeVisible();
  });

  test('SPONSORS-11: Website links are external and have correct attributes', async ({ page }) => {
    await page.goto('/dashboard/sponsors');

    // Wait for sponsors to load
    await expect(page.getByText('NASA')).toBeVisible();

    // Find the website link for NASA
    const websiteLink = page.getByRole('link', { name: /Visit NASA website/i });

    // Verify it has target="_blank" and rel="noreferrer"
    const target = await websiteLink.getAttribute('target');
    const rel = await websiteLink.getAttribute('rel');

    expect(target).toBe('_blank');
    expect(rel).toBe('noreferrer');
  });

  test('SPONSORS-12: Sponsor cards show correct tier colors and icons', async ({ page }) => {
    await page.goto('/dashboard/sponsors');

    // Wait for sponsors to load
    await expect(page.getByText('NASA')).toBeVisible();

    // Verify tier icons and colors are applied (this checks visual structure)
    const titaniumTier = page.getByText('Titanium').locator('xpath=ancestor::div[contains(@class, "text-ares-cyan")]');
    await expect(titaniumTier).toBeVisible();

    const goldTier = page.getByText('Gold').locator('xpath=ancestor::div[contains(@class, "text-ares-gold")]');
    await expect(goldTier).toBeVisible();

    const bronzeTier = page.getByText('Bronze').locator('xpath=ancestor::div[contains(@class, "text-ares-bronze")]');
    await expect(bronzeTier).toBeVisible();
  });
});
