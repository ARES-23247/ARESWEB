import { test, expect } from '@playwright/test';
import { setupMockAuth } from '../fixtures/auth';

test.describe('Event Editor E2E', () => {
  test.beforeEach(async ({ page }) => {
    await setupMockAuth(page);

    // Mock API for locations
    await page.route('**/api/locations', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          locations: [{ id: '1', name: 'ARES HQ', address: '123 Robot Lane' }],
        }),
      });
    });

    // Navigate to create event page
    await page.goto('/dashboard/event');
  });

  test('should show validation errors when submitting empty form', async ({ page }) => {
    await page.click("button:has-text('PUBLISH EVENT')");

    const titleError = page
      .locator('.text-ares-red')
      .filter({
        hasText: /String must contain at least 1 character\(s\)|required/i,
      })
      .first();
    await expect(titleError).toBeVisible({ timeout: 10000 });
  });

  test('should allow selecting a location from the registry', async ({ page }) => {
    const locationCombobox = page.locator('#event-location');
    await locationCombobox.click();
    await locationCombobox.fill('ARES');

    // Click the matching option in the listbox dropdown
    const option = page.getByRole('option', { name: /ARES HQ/i });
    await expect(option).toBeVisible({ timeout: 5000 });
    await option.click();

    await expect(locationCombobox).toHaveValue('ARES HQ');
  });

  test('should toggle potluck and volunteer flags', async ({ page }) => {
    const potluckCheckbox = page.getByLabel(/Enable Potluck Coordination/i);
    const volunteerCheckbox = page.getByLabel(/Enable Volunteer Roles/i);

    await potluckCheckbox.check();
    await volunteerCheckbox.check();

    await expect(potluckCheckbox).toBeChecked();
    await expect(volunteerCheckbox).toBeChecked();
  });

  test('should allow entering a TBA event key', async ({ page }) => {
    const tbaKeyInput = page.locator('#event-tba-key');
    await tbaKeyInput.fill('2024wvcmp');
    await expect(tbaKeyInput).toHaveValue('2024wvcmp');
  });
});
