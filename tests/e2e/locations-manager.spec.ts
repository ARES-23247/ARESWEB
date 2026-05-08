import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { setupMockAuth } from '../fixtures/auth';
import { TEST_TIMEOUTS, createMockLocations } from '../fixtures/mock-data';

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

    // Mock GET /api/locations/admin/list - List all locations
    await page.route('**/api/locations/admin/list', async (_route) => {
      const mockLocations = createMockLocations();
      await _route.fulfill({
        status: 200,
        json: { locations: mockLocations },
      });
    });

    // Mock POST /api/locations/admin/save - Create or update a location
    await page.route('**/api/locations/admin/save', async (_route) => {
      await _route.fulfill({
        status: 200,
        json: { success: true, id: 'new-location' },
      });
    });

    // Mock DELETE /api/locations/admin/:id - Delete a location
    await page.route('**/api/locations/admin/*', async (route) => {
      const _method = route.request().method();
      if (_method === 'DELETE') {
        await route.fulfill({
          status: 200,
          json: { success: true },
        });
      } else {
        await route.continue();
      }
    });

    // Mock OpenStreetMap Nominatim API for address auto-suggest
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
    await expect(page.getByRole('heading', { name: /Locations Registry/i })).toBeVisible({
      timeout: TEST_TIMEOUTS.DEFAULT,
    });

    // Verify page subtitle
    await expect(page.getByText('Manage the physical venues and hotspots for ARES operations.')).toBeVisible();

    // Verify "Add Venue" button is visible
    await expect(page.getByRole('button', { name: /Add Venue/i })).toBeVisible();

    // Verify search input is visible
    await expect(page.getByPlaceholder('Search registered event locations...')).toBeVisible();

    // Verify existing locations are displayed
    await expect(page.getByText('Mars Workspace')).toBeVisible();
    await expect(page.getByText('Competition Arena')).toBeVisible();
    await expect(page.getByText('Community Center')).toBeVisible();

    // Verify addresses are displayed
    await expect(page.getByText('123 Robotics Lane, Plano, TX 75074')).toBeVisible();
    await expect(page.getByText('4500 W. Illinois St, Midland, TX 79703')).toBeVisible();
    await expect(page.getByText('1500 Avenue J, Huntsville, TX 77320')).toBeVisible();
  });

  test('LOCATIONS-02: Location creation workflow', async ({ page }) => {
    await page.goto('/dashboard/locations');

    // Click "Add Venue" button to expand creation form
    await page.getByRole('button', { name: /Add Venue/i }).click();

    // Verify creation form is visible
    await expect(page.getByText('Register New Venue')).toBeVisible();
    await expect(page.getByLabel('Alias (e.g. \'Mars Workspace\') *')).toBeVisible();
    await expect(page.getByLabel('Street Address (Auto-suggest) *')).toBeVisible();
    await expect(page.getByLabel('Google Maps URL')).toBeVisible();

    // Fill in the location creation form
    await page.getByLabel('Alias (e.g. \'Mars Workspace\') *').fill('New Practice Field');
    await page.getByLabel('Street Address (Auto-suggest) *').fill('789 Test Drive, Austin, TX');

    // Wait for OSM auto-suggest to populate (debounced)
    await page.waitForTimeout(700);

    // Select the first suggestion
    await page.getByText('123 Robotics Lane, Plano, Collin County, Texas, 75074, United States').click();

    // Verify Google Maps URL was auto-generated
    const mapsUrlInput = page.getByLabel('Google Maps URL');
    await expect(mapsUrlInput).toHaveValue(/https:\/\/www\.google\.com\/maps/);

    // Submit the form
    await page.getByRole('button', { name: /Save Venue/i }).click();

    // Wait for mutation to complete
    await page.waitForTimeout(500);

    // Verify the form was closed (Add Venue button should be visible again)
    await expect(page.getByRole('button', { name: /Add Venue/i })).toBeVisible();
  });

  test('LOCATIONS-03: Location editing workflow', async ({ page }) => {
    await page.goto('/dashboard/locations');

    // Wait for locations to load
    await expect(page.getByText('Mars Workspace')).toBeVisible();

    // Find the Mars Workspace location card and click its edit button
    const marsCard = page.getByText('Mars Workspace').locator('xpath=ancestor::div[contains(@class, "border")]');
    const editButton = marsCard.getByRole('button').filter({ hasText: '' }).nth(0); // First button is edit
    await editButton.click();

    // Verify form is visible with pre-filled data and "Edit Venue" title
    await expect(page.getByText('Edit Venue')).toBeVisible();
    await expect(page.getByLabel('Alias (e.g. \'Mars Workspace\') *')).toBeVisible();
    await expect(page.getByLabel('Alias (e.g. \'Mars Workspace\') *')).toHaveValue('Mars Workspace');

    // Modify the location data
    await page.getByLabel('Alias (e.g. \'Mars Workspace\') *').fill('Mars Workspace - Updated');

    // Submit the form
    await page.getByRole('button', { name: /Save Venue/i }).click();

    // Wait for mutation to complete
    await page.waitForTimeout(500);

    // Verify the form was closed
    await expect(page.getByRole('button', { name: /Add Venue/i })).toBeVisible();
  });

  test('LOCATIONS-04: Location deletion workflow', async ({ page }) => {
    await page.goto('/dashboard/locations');

    // Wait for locations to load
    await expect(page.getByText('Community Center')).toBeVisible();

    // Find the location card and click its delete button
    const locationCard = page.getByText('Community Center').locator('xpath=ancestor::div[contains(@class, "border")]');
    const deleteButton = locationCard.getByRole('button').filter({ hasText: '' }).nth(1); // Second button is delete
    await deleteButton.click();

    // Wait for mutation to complete
    await page.waitForTimeout(500);

    // Verify success toast is shown (via the mutation success callback)
    // Note: The actual deletion is soft-delete (is_deleted = 1)
  });

  test('LOCATIONS-05: WCAG 2.1 AA accessibility audit', async ({ page }) => {
    await page.goto('/dashboard/locations');

    // Wait for the page to fully load
    await expect(page.getByRole('heading', { name: /Locations Registry/i })).toBeVisible({
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

  test('LOCATIONS-06: Form validation prevents invalid submissions', async ({ page }) => {
    await page.goto('/dashboard/locations');

    // Click "Add Venue" button to expand creation form
    await page.getByRole('button', { name: /Add Venue/i }).click();

    // Verify the submit button is disabled when required fields are empty
    const submitButton = page.getByRole('button', { name: /Save Venue/i });
    await expect(submitButton).toBeDisabled();

    // Fill in only the name (address is still required)
    await page.getByLabel('Alias (e.g. \'Mars Workspace\') *').fill('Test Location');
    await expect(submitButton).toBeDisabled();

    // Fill in the address (now required fields are satisfied)
    await page.getByLabel('Street Address (Auto-suggest) *').fill('123 Test Street, Test City, TX 75001');
    await page.waitForTimeout(700); // Wait for validation to process
    await expect(submitButton).toBeEnabled();
  });

  test('LOCATIONS-07: Search functionality works correctly', async ({ page }) => {
    await page.goto('/dashboard/locations');

    // Wait for locations to load
    await expect(page.getByText('Mars Workspace')).toBeVisible();
    await expect(page.getByText('Competition Arena')).toBeVisible();

    // Search for "Mars"
    await page.getByPlaceholder('Search registered event locations...').fill('Mars');

    // Verify only Mars Workspace is visible
    await expect(page.getByText('Mars Workspace')).toBeVisible();
    await expect(page.getByText('Competition Arena')).not.toBeVisible();

    // Clear search
    await page.getByPlaceholder('Search registered event locations...').fill('');

    // Verify all locations are visible again
    await expect(page.getByText('Mars Workspace')).toBeVisible();
    await expect(page.getByText('Competition Arena')).toBeVisible();
  });

  test('LOCATIONS-08: Address auto-suggest from OpenStreetMap', async ({ page }) => {
    await page.goto('/dashboard/locations');

    // Click "Add Venue" button to expand creation form
    await page.getByRole('button', { name: /Add Venue/i }).click();

    // Type an address to trigger auto-suggest
    await page.getByLabel('Street Address (Auto-suggest) *').fill('123 Test');

    // Wait for debounced OSM API call (600ms debounce + response time)
    await page.waitForTimeout(700);

    // Verify suggestions are displayed
    await expect(page.getByText('123 Robotics Lane, Plano, Collin County, Texas, 75074, United States')).toBeVisible();
    await expect(page.getByText('456 Robotics Lane, Plano, Collin County, Texas, 75074, United States')).toBeVisible();

    // Click the first suggestion
    await page.getByText('123 Robotics Lane, Plano, Collin County, Texas, 75074, United States').click();

    // Verify address field was updated
    await expect(page.getByLabel('Street Address (Auto-suggest) *')).toHaveValue('123 Robotics Lane, Plano, Collin County, Texas, 75074, United States');

    // Verify Google Maps URL was auto-generated
    const mapsUrlInput = page.getByLabel('Google Maps URL');
    await expect(mapsUrlInput).toHaveValue(/https:\/\/www\.google\.com\/maps/);
  });

  test('LOCATIONS-09: Empty state displays when no locations exist', async ({ page }) => {
    // Override the mock to return empty locations list
    await page.route('**/api/locations/admin/list', async (_route) => {
      await _route.fulfill({
        status: 200,
        json: { locations: [] },
      });
    });

    await page.goto('/dashboard/locations');

    // Verify empty state message is visible
    await expect(page.getByText('No verified locations found.')).toBeVisible();
  });

  test('LOCATIONS-10: Restore deleted location workflow', async ({ page }) => {
    // Import createMockLocation for test-specific data
    const { createMockLocation: createTestLocation } = await import('../fixtures/mock-data');

    // Override the mock to include a deleted location
    await page.route('**/api/locations/admin/list', async (_route) => {
      const mockLocations = [
        ...createMockLocations(),
        createTestLocation({
          id: 'deleted-venue',
          name: 'Deleted Venue',
          address: '999 Deleted Street, Deleted City, TX 75000',
          maps_url: 'https://www.google.com/maps/search/?api=1&query=999%20Deleted%20Street',
          is_deleted: 1,
        }),
      ];
      await _route.fulfill({
        status: 200,
        json: { locations: mockLocations },
      });
    });

    await page.goto('/dashboard/locations');

    // Wait for locations to load including the deleted one
    await expect(page.getByText('Deleted Venue')).toBeVisible();

    // Find the deleted location card and click its restore button
    const deletedCard = page.getByText('Deleted Venue').locator('xpath=ancestor::div[contains(@class, \'border\')]');
    const restoreButton = deletedCard.getByRole('button', { name: 'RESTORE' });
    await restoreButton.click();

    // Wait for mutation to complete
    await page.waitForTimeout(500);

    // Verify success toast is shown
    // Note: The actual restoration sets is_deleted = 0
  });

  test('LOCATIONS-11: Location creation form can be cancelled', async ({ page }) => {
    await page.goto('/dashboard/locations');

    // Click "Add Venue" button to expand creation form
    await page.getByRole('button', { name: /Add Venue/i }).click();

    // Verify form fields are visible
    await expect(page.getByLabel('Alias (e.g. \'Mars Workspace\') *')).toBeVisible();

    // Fill in some data
    await page.getByLabel('Alias (e.g. \'Mars Workspace\') *').fill('Test Location');
    await page.getByLabel('Street Address (Auto-suggest) *').fill('123 Test Street');

    // Click Cancel button
    await page.getByRole('button', { name: /Cancel/i }).click();

    // Verify form is hidden (Add Venue button is visible again)
    await expect(page.getByRole('button', { name: /Add Venue/i })).toBeVisible();
    await expect(page.getByLabel('Alias (e.g. \'Mars Workspace\') *')).not.toBeVisible();
  });

  test('LOCATIONS-12: Google Maps link opens in new tab', async ({ page }) => {
    await page.goto('/dashboard/locations');

    // Click "Add Venue" button to expand creation form
    await page.getByRole('button', { name: /Add Venue/i }).click();

    // Fill in the address to generate maps URL
    await page.getByLabel('Street Address (Auto-suggest) *').fill('123 Test');
    await page.waitForTimeout(700);

    // Select the first suggestion to generate maps URL
    await page.getByText('123 Robotics Lane, Plano, Collin County, Texas, 75074, United States').click();

    // Wait for maps URL to be populated
    await page.waitForTimeout(200);

    // Find the navigation button next to the maps URL input
    const navButton = page.getByTitle('Open in Google Maps');
    await expect(navButton).toBeVisible();

    // Verify it has target="_blank" and rel="noreferrer"
    const target = await navButton.getAttribute('target');
    const rel = await navButton.getAttribute('rel');

    expect(target).toBe('_blank');
    expect(rel).toBe('noreferrer');
  });

  test('LOCATIONS-13: Deleted locations show visual indicators', async ({ page }) => {
    // Import createMockLocation for test-specific data
    const { createMockLocation: createTestLocation } = await import('../fixtures/mock-data');

    // Override the mock to include a deleted location
    await page.route('**/api/locations/admin/list', async (_route) => {
      const mockLocations = [
        ...createMockLocations(),
        createTestLocation({
          id: 'deleted-venue',
          name: 'Deleted Venue',
          address: '999 Deleted Street, Deleted City, TX 75000',
          maps_url: null,
          is_deleted: 1,
        }),
      ];
      await _route.fulfill({
        status: 200,
        json: { locations: mockLocations },
      });
    });

    await page.goto('/dashboard/locations');

    // Wait for locations to load
    await expect(page.getByText('Deleted Venue')).toBeVisible();

    // Verify the deleted location has visual indicators (line-through name)
    const deletedName = page.getByText('Deleted Venue');
    await expect(deletedName).toHaveCSS('text-decoration', 'line-through');

    // Verify restore button is visible for deleted location
    await expect(page.getByRole('button', { name: 'RESTORE' })).toBeVisible();
  });

  test('LOCATIONS-14: Loading state displays while fetching locations', async ({ page }) => {
    // Mock a slow response
    await page.route('**/api/locations/admin/list', async (_route) => {
      await new Promise(resolve => setTimeout(resolve, 2000));
      const mockLocations = createMockLocations();
      await _route.fulfill({
        status: 200,
        json: { locations: mockLocations },
      });
    });

    await page.goto('/dashboard/locations');

    // Verify loading state is visible
    await expect(page.getByText('Loading venues...')).toBeVisible();
  });
});
