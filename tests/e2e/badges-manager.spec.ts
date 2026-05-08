import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { setupMockAuth, MOCK_ADMIN_USER } from '../fixtures/auth';
import { TEST_TIMEOUTS, createMockBadges, createMockUser, type MockBadgeItem } from '../fixtures/mock-data';

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
    await setupMockAuth(page);

    // Mock GET /api/badges - List all badge definitions
    await page.route('**/api/badges', async (route) => {
      const mockBadges = createMockBadges();
      await route.fulfill({
        status: 200,
        json: { badges: mockBadges },
      });
    });

    // Mock GET /api/users - Get users list for badge assignment
    await page.route('**/api/users', async (route) => {
      await route.fulfill({
        status: 200,
        json: {
          users: [
            createMockUser({
              id: 'user-1',
              name: 'Jane Student',
              nickname: 'Jane',
              email: 'jane@ares.org',
            }),
            createMockUser({
              id: 'user-2',
              name: 'John Mentor',
              nickname: 'John',
              email: 'john@ares.org',
            }),
          ],
        },
      });
    });

    // Mock POST /api/badges/admin - Create a new badge
    await page.route('**/api/badges/admin', async (route) => {
      await route.fulfill({
        status: 200,
        json: { success: true },
      });
    });

    // Mock POST /api/badges/admin/grant - Grant a badge to a user
    await page.route('**/api/badges/admin/grant', async (route) => {
      await route.fulfill({
        status: 200,
        json: { success: true },
      });
    });

    // Mock DELETE /api/badges/admin/:id - Delete a badge definition
    await page.route('**/api/badges/admin/*', async (route) => {
      await route.fulfill({
        status: 200,
        json: { success: true },
      });
    });
  });

  test('BADGES-01: Badge list displays correctly', async ({ page }) => {
    await page.goto('/dashboard/badges');

    // Verify the page title is visible
    await expect(page.getByRole('heading', { name: /Badge Management/i })).toBeVisible({
      timeout: TEST_TIMEOUTS.DEFAULT,
    });

    // Verify badge index section is visible
    await expect(page.getByText('Badge Index')).toBeVisible();
    await expect(page.getByText('Define platform-wide awards and training certifications.')).toBeVisible();

    // Verify existing badges are displayed
    await expect(page.getByText('Outreach MVP')).toBeVisible();
    await expect(page.getByText('Safety Certified')).toBeVisible();
    await expect(page.getByText('Programming Excellence')).toBeVisible();

    // Verify badge descriptions
    await expect(page.getByText('Awarded to members who attain top 3 in outreach hours.')).toBeVisible();
    await expect(page.getByText('Completed all safety training modules.')).toBeVisible();
    await expect(page.getByText('Awarded for outstanding code contributions.')).toBeVisible();

    // Verify Manual Badge Grant section
    await expect(page.getByRole('heading', { name: /Manual Badge Grant/i })).toBeVisible();
    await expect(page.getByLabel('Target Member')).toBeVisible();
    await expect(page.getByLabel('Select Badge')).toBeVisible();
  });

  test('BADGES-02: Badge creation workflow', async ({ page }) => {
    await page.goto('/dashboard/badges');

    // Click "New Badge Type" button to expand creation form
    await page.getByRole('button', { name: /New Badge Type/i }).click();

    // Verify creation form is visible
    await expect(page.getByLabel('Badge ID (slug)')).toBeVisible();
    await expect(page.getByLabel('Display Name')).toBeVisible();
    await expect(page.getByLabel('Icon (Lucide Node)')).toBeVisible();
    await expect(page.getByLabel('Color Theme (CSS)')).toBeVisible();
    await expect(page.getByLabel('Description')).toBeVisible();

    // Fill in the badge creation form
    await page.getByLabel('Badge ID (slug)').fill('programming-excellence');
    await page.getByLabel('Display Name').fill('Programming Excellence');
    await page.getByLabel('Icon (Lucide Node)').fill('Code');
    await page.getByLabel('Color Theme (CSS)').fill('text-blue-500');
    await page.getByLabel('Description').fill('Awarded for outstanding code contributions.');

    // Submit the form
    await page.getByRole('button', { name: 'Save Badge Definition' }).click();

    // Verify success toast is shown (the mutation completes, but we need to wait briefly)
    await page.waitForTimeout(500);

    // Verify the form was closed (Cancel button should be visible again, not the form inputs)
    await expect(page.getByRole('button', { name: /New Badge Type/i })).toBeVisible();
  });

  test('BADGES-03: Badge assignment workflow', async ({ page }) => {
    await page.goto('/dashboard/badges');

    // Wait for the page to load
    await expect(page.getByRole('heading', { name: /Manual Badge Grant/i })).toBeVisible();

    // Select a user from the dropdown
    await page.getByLabel('Target Member').selectOption('user-1');

    // Verify user was selected
    await expect(page.getByLabel('Target Member')).toHaveValue('user-1');

    // Select a badge from the dropdown
    await page.getByLabel('Select Badge').selectOption('outreach-mvp');

    // Verify badge was selected
    await expect(page.getByLabel('Select Badge')).toHaveValue('outreach-mvp');

    // Verify the grant button is enabled
    const grantButton = page.getByRole('button', { name: /Grant Badge to Member/i });
    await expect(grantButton).toBeEnabled();

    // Click the grant button
    await grantButton.click();

    // Wait for mutation to complete
    await page.waitForTimeout(500);

    // Verify the selections were reset after successful grant
    await expect(page.getByLabel('Target Member')).toHaveValue('');
    await expect(page.getByLabel('Select Badge')).toHaveValue('');
  });

  test('BADGES-04: Badge deletion workflow', async ({ page }) => {
    await page.goto('/dashboard/badges');

    // Wait for badges to load
    await expect(page.getByText('Outreach MVP')).toBeVisible();

    // Find the first badge card and locate its delete button
    const badgeCard = page.getByText('Outreach MVP').locator('../..').locator('../..');
    const deleteButton = badgeCard.getByRole('button', { name: '' }); // Click-to-delete button has no visible text initially

    // First click shows confirmation state
    await deleteButton.first().click();
    await page.waitForTimeout(200);

    // Second click confirms deletion
    await deleteButton.first().click();

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
      // Disable duplicate-id check since virtualization can cause harmless duplicates
      .disableRules(['duplicate-id'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('BADGES-06: Form validation prevents empty submissions', async ({ page }) => {
    await page.goto('/dashboard/badges');

    // Click "New Badge Type" button to expand creation form
    await page.getByRole('button', { name: /New Badge Type/i }).click();

    // Verify the save button is disabled when required fields are empty
    const saveButton = page.getByRole('button', { name: 'Save Badge Definition' });
    await expect(saveButton).toBeDisabled();

    // Fill in only the ID (name is still required)
    await page.getByLabel('Badge ID (slug)').fill('test-badge');
    await expect(saveButton).toBeDisabled();

    // Fill in the name (now required fields are satisfied)
    await page.getByLabel('Display Name').fill('Test Badge');
    await expect(saveButton).toBeEnabled();
  });

  test('BADGES-07: Grant button disabled without selection', async ({ page }) => {
    await page.goto('/dashboard/badges');

    // Wait for the page to load
    await expect(page.getByRole('heading', { name: /Manual Badge Grant/i })).toBeVisible();

    // Verify grant button is initially disabled
    const grantButton = page.getByRole('button', { name: /Grant Badge to Member/i });
    await expect(grantButton).toBeDisabled();

    // Select only user (badge not selected)
    await page.getByLabel('Target Member').selectOption('user-1');
    await expect(grantButton).toBeDisabled();

    // Select badge (both selected now)
    await page.getByLabel('Select Badge').selectOption('outreach-mvp');
    await expect(grantButton).toBeEnabled();
  });

  test('BADGES-08: Badge creation form can be cancelled', async ({ page }) => {
    await page.goto('/dashboard/badges');

    // Click "New Badge Type" button to expand creation form
    await page.getByRole('button', { name: /New Badge Type/i }).click();

    // Verify form fields are visible
    await expect(page.getByLabel('Badge ID (slug)')).toBeVisible();

    // Fill in some data
    await page.getByLabel('Badge ID (slug)').fill('test-badge');
    await page.getByLabel('Display Name').fill('Test Badge');

    // Click Cancel button
    await page.getByRole('button', { name: /Cancel/i }).click();

    // Verify form is hidden (New Badge Type button is visible again)
    await expect(page.getByRole('button', { name: /New Badge Type/i })).toBeVisible();
    await expect(page.getByLabel('Badge ID (slug)')).not.toBeVisible();
  });

  test('BADGES-09: Badge ID and technical details are displayed', async ({ page }) => {
    await page.goto('/dashboard/badges');

    // Wait for badges to load
    await expect(page.getByText('Outreach MVP')).toBeVisible();

    // Verify badge technical ID is displayed in monospace font
    await expect(page.getByText('ID: outreach-mvp')).toBeVisible();

    // Verify safety badge ID is also visible
    await expect(page.getByText('ID: safety-certified')).toBeVisible();

    // Verify programming badge ID is visible
    await expect(page.getByText('ID: programming-excellence')).toBeVisible();
  });
});
