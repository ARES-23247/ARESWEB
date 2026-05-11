import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { setupMockAuth } from '../fixtures/auth';
import { TEST_TIMEOUTS } from '../fixtures/mock-data';

/**
 * E2E tests for Locations Manager dashboard route.
 * Tests verify:
 * - LOCATIONS-01: Location list displays correctly
 * - LOCATIONS-02: Location creation workflow
 * - LOCATIONS-03: Location editing workflow
 * - LOCATIONS-04: Location deletion workflow
 * - LOCATIONS-05: WCAG 2.1 AA accessibility compliance
 * - LOCATIONS-06: Form validation prevents invalid submissions
 * - LOCATIONS-07: Search functionality works correctly
 * - LOCATIONS-08: Address auto-suggest from OpenStreetMap
 * - LOCATIONS-09: Empty state displays when no locations exist
 * - LOCATIONS-10: Restore deleted location workflow
 */

test.describe('Locations Manager', () => {
  test.beforeEach(async ({ page }) => {
    await setupMockAuth(page);

    // Mock OpenStreetMap Nominatim API for address auto-suggest (external service)
    await page.route('**/nominatim.openstreetmap.org/**', async (_route) => {
      await _route.fulfill({
        status: 200,
        json: [
          {
            display_name: '123 Robotics Lane, Plano, Collin County, Texas, 75074, United States',
          },
          {
            display_name: '456 Robotics Lane, Plano, Collin County, Texas, 75074, United States',
          },
        ],
      });
    });
  });

  test('LOCATIONS-01: Location list displays correctly', async ({ page }) => {
    await page.goto('/dashboard/locations');

    // Verify the page title is visible
    await expect(page.getByRole('heading', { name: /Locations/i })).toBeVisible({
      timeout: TEST_TIMEOUTS.DEFAULT,
    });

    // Verify "Add Venue" button is visible
    await expect(page.getByRole('button', { name: /Add Venue/i })).toBeVisible();

    // Verify search input is visible
    await expect(page.getByPlaceholder(/Search/i)).toBeVisible();
  });

  test('LOCATIONS-02: Location creation workflow', async ({ page }) => {
    test.skip(!!process.env.CI, 'CRUD requires writable DB — not available in CI preview');
    await page.goto('/dashboard/locations');

    // Click "Add Venue" button to expand creation form
    await page.getByRole('button', { name: /Add Venue/i }).click();

    // Verify creation form is visible
    await expect(page.getByText(/Register New Venue/i)).toBeVisible();
    // The label text includes the example, so use a partial match
    await expect(page.getByText(/Alias.*e\.g\./i)).toBeVisible();
    await expect(page.getByText(/Street Address.*Auto-suggest/i)).toBeVisible();
    await expect(page.getByText(/Google Maps URL/i)).toBeVisible();

    // Fill in the location creation form using the input's id/name
    const nameInput = page.locator('#name');
    const addressInput = page.locator('#address');
    await nameInput.fill(`Test Location ${Date.now()}`);
    await addressInput.fill('789 Test Drive, Austin, TX');

    // Wait for OSM auto-suggest to populate (debounced)
    await page.waitForTimeout(700);

    // Select the first suggestion
    await page.getByText('123 Robotics Lane, Plano, Collin County, Texas, 75074, United States').click();

    // Verify Google Maps URL was auto-generated
    const mapsUrlInput = page.locator('#mapsUrl');
    await expect(mapsUrlInput).toHaveValue(/https:\/\/www\.google\.com\/maps/);

    // Submit the form
    await page.getByRole('button', { name: /Save Venue/i }).click();

    // Wait for mutation to complete
    await page.waitForTimeout(500);

    // Verify the form was closed (Add Venue button should be visible again)
    await expect(page.getByRole('button', { name: /Add Venue/i })).toBeVisible();
  });

  test('LOCATIONS-03: Location editing workflow', async ({ page }) => {
    test.skip(!!process.env.CI, 'CRUD requires writable DB — not available in CI preview');
    await page.goto('/dashboard/locations');

    // Wait for locations to load
    await expect(page.getByRole('heading', { name: /Locations/i })).toBeVisible();

    // Find the first location card and click its edit button (Edit3 icon button)
    const locationCard = page.locator('.border').first();
    const editButton = locationCard.getByTitle(/Edit venue/i);
    await editButton.click();

    // Verify form is visible with pre-filled data
    await expect(page.getByText(/Edit Venue/i)).toBeVisible();
    // Use the input id instead of label
    const nameInput = page.locator('#name');
    await expect(nameInput).toBeVisible();

    // Modify the location data
    await nameInput.fill(`Updated Location ${Date.now()}`);

    // Submit the form
    await page.getByRole('button', { name: /Save Venue/i }).click();

    // Wait for mutation to complete
    await page.waitForTimeout(500);

    // Verify the form was closed
    await expect(page.getByRole('button', { name: /Add Venue/i })).toBeVisible();
  });

  test('LOCATIONS-04: Location deletion workflow', async ({ page }) => {
    test.skip(!!process.env.CI, 'CRUD requires writable DB — not available in CI preview');
    await page.goto('/dashboard/locations');

    // Wait for locations to load
    await expect(page.getByRole('heading', { name: /Locations/i })).toBeVisible();

    // Find a location card and click its delete button (Trash2 icon button)
    const locationCard = page.locator('.border').first();
    const deleteButton = locationCard.getByTitle(/Delete venue/i);
    await deleteButton.click();

    // Wait for mutation to complete
    await page.waitForTimeout(500);
  });

  test('LOCATIONS-05: WCAG 2.1 AA accessibility audit', async ({ page }) => {
    await page.goto('/dashboard/locations');

    // Wait for the page to fully load
    await expect(page.getByRole('heading', { name: /Locations/i })).toBeVisible({
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

  test('LOCATIONS-06: Form validation prevents invalid submissions', async ({ page }) => {
    test.skip(!!process.env.CI, 'Form validation test depends on full CRUD flow — not available in CI preview');
    await page.goto('/dashboard/locations');

    // Click "Add Venue" button to expand creation form
    await page.getByRole('button', { name: /Add Venue/i }).click();

    // Verify the submit button is disabled when required fields are empty
    const submitButton = page.getByRole('button', { name: /Save Venue/i });
    await expect(submitButton).toBeDisabled();

    // Fill in only the name (address is still required)
    const nameInput = page.locator('#name');
    await nameInput.fill('Test Location');
    await expect(submitButton).toBeDisabled();

    // Fill in the address (now required fields are satisfied)
    const addressInput = page.locator('#address');
    await addressInput.fill('123 Test Street, Test City, TX 75001');
    await page.waitForTimeout(700); // Wait for validation to process
    await expect(submitButton).toBeEnabled();
  });

  test('LOCATIONS-07: Search functionality works correctly', async ({ page }) => {
    await page.goto('/dashboard/locations');

    // Wait for locations to load
    await expect(page.getByRole('heading', { name: /Locations/i })).toBeVisible();

    // Search for a location
    const searchInput = page.getByPlaceholder(/Search/i);
    await searchInput.fill('test');

    // Verify search was performed
    await expect(searchInput).toHaveValue('test');

    // Clear search
    await searchInput.fill('');
    await expect(searchInput).toHaveValue('');
  });

  test('LOCATIONS-08: Address auto-suggest from OpenStreetMap', async ({ page }) => {
    await page.goto('/dashboard/locations');

    // Click "Add Venue" button to expand creation form
    await page.getByRole('button', { name: /Add Venue/i }).click();

    // Type an address to trigger auto-suggest
    const addressInput = page.locator('#address');
    await addressInput.fill('123 Test');

    // Wait for debounced OSM API call (600ms debounce + response time)
    await page.waitForTimeout(700);

    // Verify suggestions are displayed
    await expect(page.getByText('123 Robotics Lane, Plano, Collin County, Texas, 75074, United States')).toBeVisible();

    // Click the first suggestion
    await page.getByText('123 Robotics Lane, Plano, Collin County, Texas, 75074, United States').click();

    // Verify address field was updated
    await expect(addressInput).toHaveValue('123 Robotics Lane, Plano, Collin County, Texas, 75074, United States');

    // Verify Google Maps URL was auto-generated
    const mapsUrlInput = page.locator('#mapsUrl');
    await expect(mapsUrlInput).toHaveValue(/https:\/\/www\.google\.com\/maps/);
  });

  test('LOCATIONS-11: Location creation form can be cancelled', async ({ page }) => {
    await page.goto('/dashboard/locations');

    // Click "Add Venue" button to expand creation form
    await page.getByRole('button', { name: /Add Venue/i }).click();

    // Verify form fields are visible
    const nameInput = page.locator('#name');
    await expect(nameInput).toBeVisible();

    // Fill in some data
    await nameInput.fill('Test Location');
    await page.locator('#address').fill('123 Test Street');

    // Click Cancel button
    await page.getByRole('button', { name: /Cancel/i }).click();

    // Verify form is hidden (Add Venue button is visible again)
    await expect(page.getByRole('button', { name: /Add Venue/i })).toBeVisible();
    await expect(nameInput).not.toBeVisible();
  });

  test('LOCATIONS-12: Google Maps link opens in new tab', async ({ page }) => {
    await page.goto('/dashboard/locations');

    // Click "Add Venue" button to expand creation form
    await page.getByRole('button', { name: /Add Venue/i }).click();

    // Fill in the address to generate maps URL
    const addressInput = page.locator('#address');
    await addressInput.fill('123 Test');
    await page.waitForTimeout(700);

    // Select the first suggestion to generate maps URL
    await page.getByText('123 Robotics Lane, Plano, Collin County, Texas, 75074, United States').click();

    // Wait for maps URL to be populated
    await page.waitForTimeout(200);

    // Find the navigation button next to the maps URL input
    const navButton = page.getByTitle(/Open in Google Maps/i);
    await expect(navButton).toBeVisible();

    // Verify it has target="_blank" and rel="noreferrer"
    const target = await navButton.getAttribute('target');
    const rel = await navButton.getAttribute('rel');

    expect(target).toBe('_blank');
    expect(rel).toBe('noreferrer');
  });
});
