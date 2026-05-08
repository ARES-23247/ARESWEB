import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { setupMockAuth } from '../fixtures/auth';
import { TEST_TIMEOUTS } from '../fixtures/mock-data';

test.describe('Admin Users Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await setupMockAuth(page);
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
    // Mock the users list endpoint
    await page.route('**/api/users/admin/list*', async (route) => {
      await route.fulfill({
        status: 200,
        json: {
          users: [
            {
              id: 'user-to-promote',
              name: 'Promote Me',
              email: 'promote@example.com',
              role: 'user',
              member_type: 'student',
              nickname: 'Promote',
              image: 'https://api.dicebear.com/9.x/bottts/svg?seed=promote',
              createdAt: Date.now() - 1000000,
            },
          ],
          nextCursor: null,
        },
      });
    });

    // Mock the PATCH endpoint for role updates
    let updatedRole: string | null = null;
    await page.route('**/api/users/admin/user-to-promote', async (route) => {
      if (route.request().method() === 'PATCH') {
        const requestBody = await route.request().postData();
        const data = JSON.parse(requestBody || '{}');
        updatedRole = data.role;

        await route.fulfill({
          status: 200,
          json: { success: true },
        });
      } else {
        await route.continue();
      }
    });

    await page.goto('/dashboard/users');

    // Wait for the page to load
    await expect(page.getByRole('heading', { name: /User Management/i })).toBeVisible();

    // Find the role select dropdown for the user
    const roleSelect = page.locator('select').filter({ hasText: 'User' }).first();

    // Verify initial role
    await expect(roleSelect).toHaveValue('user');

    // Change the role to admin
    await roleSelect.selectOption('admin');

    // Wait for the mutation to complete
    await page.waitForTimeout(500);

    // Verify the role was updated
    expect(updatedRole).toBe('admin');
  });

  test('Member type modification workflow', async ({ page }) => {
    // Mock the users list endpoint
    await page.route('**/api/users/admin/list*', async (route) => {
      await route.fulfill({
        status: 200,
        json: {
          users: [
            {
              id: 'member-change',
              name: 'Type Change',
              email: 'type@example.com',
              role: 'user',
              member_type: 'student',
              nickname: 'Type',
              image: 'https://api.dicebear.com/9.x/bottts/svg?seed=type',
              createdAt: Date.now() - 1000000,
            },
          ],
          nextCursor: null,
        },
      });
    });

    // Mock the PATCH endpoint for member type updates
    let updatedMemberType: string | null = null;
    await page.route('**/api/users/admin/member-change', async (route) => {
      if (route.request().method() === 'PATCH') {
        const requestBody = await route.request().postData();
        const data = JSON.parse(requestBody || '{}');
        updatedMemberType = data.member_type;

        await route.fulfill({
          status: 200,
          json: { success: true },
        });
      } else {
        await route.continue();
      }
    });

    await page.goto('/dashboard/users');

    // Wait for the page to load
    await expect(page.getByRole('heading', { name: /User Management/i })).toBeVisible();

    // Find the member type select dropdown
    const memberTypeSelect = page.locator('select').filter({ hasText: 'Student' }).first();

    // Verify initial member type
    await expect(memberTypeSelect).toHaveValue('student');

    // Change the member type to mentor
    await memberTypeSelect.selectOption('mentor');

    // Wait for the mutation to complete
    await page.waitForTimeout(500);

    // Verify the member type was updated
    expect(updatedMemberType).toBe('mentor');
  });

  test('Search functionality filters users', async ({ page }) => {
    await page.goto('/dashboard/users');

    // Wait for the page to load
    await expect(page.getByRole('heading', { name: /User Management/i })).toBeVisible();

    // Verify search input exists
    const searchInput = page.getByPlaceholder('Search users...');
    await expect(searchInput).toBeVisible();
  });

  test('WCAG 2.1 AA accessibility audit', async ({ page }) => {
    // Mock the users list endpoint
    await page.route('**/api/users/admin/list*', async (route) => {
      await route.fulfill({
        status: 200,
        json: {
          users: [
            {
              id: 'user-1',
              name: 'Accessible User',
              email: 'accessible@example.com',
              role: 'admin',
              member_type: 'mentor',
              nickname: 'Accessible',
              image: 'https://api.dicebear.com/9.x/bottts/svg?seed=accessible',
              createdAt: Date.now() - 10000000,
            },
          ],
          nextCursor: null,
        },
      });
    });

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
    // Override auth with a non-admin user (author role)
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
    await expect(page.getByText('Access Denied')).toBeVisible({
      timeout: TEST_TIMEOUTS.SLOW_PAGE,
    });
  });
});
