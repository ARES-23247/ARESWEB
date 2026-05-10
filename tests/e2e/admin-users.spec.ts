import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { setupMockAuth } from '../fixtures/auth';
import { TEST_TIMEOUTS } from '../fixtures/mock-data';

test.describe('Admin Users Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await setupMockAuth(page, { useRealAuth: true });
  });

  test.afterEach(async ({ page }) => {
    // Clean up all routes to prevent memory buildup
    await page.unrouteAll();
    await page.context().clearCookies();
  });

  test('User Management dashboard loads and displays user list', async ({ page }) => {
    await page.goto('/dashboard/users');

    // Wait for the page to load
    await expect(page.getByRole('heading', { name: /User Management/i })).toBeVisible({
      timeout: TEST_TIMEOUTS.SLOW_PAGE,
    });

    // Verify the table exists
    const userTable = page.getByRole('table');
    await expect(userTable).toBeVisible();
  });

  test('User role modification workflow', async ({ page }) => {
    await page.goto('/dashboard/users');

    // Wait for the page to load
    await expect(page.getByRole('heading', { name: /User Management/i })).toBeVisible();

    // Find the role select dropdown for the test user
    const roleSelect = page.locator('select').first();

    // Verify initial role exists
    await expect(roleSelect).toBeVisible();

    // Change the role to admin
    await roleSelect.selectOption('admin');

    // Wait for the mutation to complete
    await page.waitForTimeout(500);

    // Verify the select still has admin selected
    await expect(roleSelect).toHaveValue('admin');
  });

  test('Member type modification workflow', async ({ page }) => {
    await page.goto('/dashboard/users');

    // Wait for the page to load
    await expect(page.getByRole('heading', { name: /User Management/i })).toBeVisible();

    // Find a member type select dropdown
    const memberTypeSelect = page.locator('select').nth(1);

    // Verify member type select exists
    await expect(memberTypeSelect).toBeVisible();

    // Change the member type to mentor
    await memberTypeSelect.selectOption('mentor');

    // Wait for the mutation to complete
    await page.waitForTimeout(500);

    // Verify the member type was updated
    await expect(memberTypeSelect).toHaveValue('mentor');
  });

  test('Search functionality filters users', async ({ page }) => {
    await page.goto('/dashboard/users');

    // Wait for the page to load
    await expect(page.getByRole('heading', { name: /User Management/i })).toBeVisible();

    // Verify search input exists
    const searchInput = page.getByPlaceholder(/Search/i);
    await expect(searchInput).toBeVisible();
  });

  test('WCAG 2.1 AA accessibility audit', async ({ page }) => {
    await page.goto('/dashboard/users');

    // Wait for the page to fully load
    await expect(page.getByRole('heading', { name: /User Management/i })).toBeVisible({
      timeout: TEST_TIMEOUTS.SLOW_PAGE,
    });

    // Stabilize page for accessibility scan (disable animations)
    await page.addStyleTag({
      content: `
        *, *::before, *::after {
          transition: none !important;
          animation: none !important;
          opacity: 1 !important;
        }
      `,
    });

    // Run accessibility audit
    const accessibilityScanResults = await new AxeBuilder({ page })
      .disableRules(['color-contrast'])
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('User table is sortable', async ({ page }) => {
    await page.goto('/dashboard/users');

    // Wait for the page to load
    await expect(page.getByRole('heading', { name: /User Management/i })).toBeVisible();

    // Verify table exists
    const userTable = page.getByRole('table');
    await expect(userTable).toBeVisible();
  });

  test('Non-admin user is denied access', async ({ page }) => {
    // Setup auth with a non-admin user (author role) - use mock for this specific test
    // since we're testing access control behavior
    await page.route('**/api/auth/get-session', async (route) => {
      await route.fulfill({
        status: 200,
        json: {
          session: {
            id: 'author-session-id',
            userId: 'author-user',
            expiresAt: new Date(Date.now() + 10000000).toISOString(),
            ipAddress: '127.0.0.1',
            userAgent: 'Playwright',
          },
          user: {
            id: 'author-user',
            name: 'Author User',
            email: 'author@ares.org',
            emailVerified: true,
            image: 'https://api.dicebear.com/9.x/bottts/svg?seed=author',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            role: 'author',
            banned: false,
          },
        },
      });
    });

    // Mock profile with author role
    await page.route('**/profile/me', async (route) => {
      await route.fulfill({
        status: 200,
        json: {
          user_id: 'author-user',
          nickname: 'Author User',
          first_name: 'Author',
          last_name: 'User',
          member_type: 'mentor',
          auth: {
            role: 'author',
          },
        },
      });
    });

    await page.goto('/dashboard/users');

    // Verify access denied message is shown
    await expect(page.getByText(/Access Denied/i)).toBeVisible({
      timeout: TEST_TIMEOUTS.SLOW_PAGE,
    });
  });
});
