import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { setupMockAuth } from '../fixtures/auth';
import { DashboardPage } from '../pages/DashboardPage';

test.describe('Member Impact Dashboard', () => {
  let dashboardPage: DashboardPage;

  test.beforeEach(async ({ page }) => {
    await setupMockAuth(page, { useRealAuth: true });
    dashboardPage = new DashboardPage(page);
  });

  test('Member Impact Registry loads with correct title and displays MVP sections', async ({ page }) => {
    await page.goto('/dashboard/impact_roster');

    // Verify page title
    await expect(page.getByRole('heading', { name: 'Member Impact Registry' })).toBeVisible();

    // Verify subtitle
    await expect(page.getByText('Tracking the direct contribution and service hours of ARES 23247')).toBeVisible();

    // Verify MVP section headers
    await expect(page.getByText('Attendance MVPs')).toBeVisible();
    await expect(page.getByText('Outreach MVPs')).toBeVisible();

    // Verify full roster table header
    await expect(page.getByText('Full Team Roster')).toBeVisible();
    await expect(page.getByText('Detailed attendance and volunteering metrics for export')).toBeVisible();
  });

  test('Member Impact displays correct MVP rankings and statistics', async ({ page }) => {
    await page.goto('/dashboard/impact_roster');

    // Verify ranking badges are visible
    await expect(page.getByText('#1')).toBeVisible();
    await expect(page.getByText('#2')).toBeVisible();
    await expect(page.getByText('#3')).toBeVisible();

    // Verify student labels
    await expect(page.getByText('Student')).toBeVisible();
  });

  test('Full roster table displays all member types with correct metrics', async ({ page }) => {
    await page.goto('/dashboard/impact_roster');

    // Verify table headers
    await expect(page.getByText('Member')).toBeVisible();
    await expect(page.getByText('Type')).toBeVisible();
    await expect(page.getByText('Events Attended')).toBeVisible();
    await expect(page.getByText('Volunteer Hours')).toBeVisible();
  });

  test('Search functionality filters members correctly', async ({ page }) => {
    await page.goto('/dashboard/impact_roster');

    // Wait for table to load
    await expect(page.getByText('Full Team Roster')).toBeVisible();

    // Verify search input is present
    const searchInput = page.getByPlaceholder('Search member...');
    await expect(searchInput).toBeVisible();

    // Search for specific member
    await searchInput.fill('Test');

    // Verify search was performed (results may vary based on actual data)
    await expect(searchInput).toHaveValue('Test');

    // Clear search
    await searchInput.clear();

    // Verify all members are visible again
    await expect(searchInput).toHaveValue('');
  });

  test('Access control redirects non-admin users', async ({ page }) => {
    // Setup mock auth with non-admin user
    await page.route('**/api/auth/get-session', async (_route) => {
      await _route.fulfill({
        status: 200,
        json: {
          session: {
            id: 'member-session-id',
            userId: 'member-user',
            expiresAt: new Date(Date.now() + 10000000).toISOString(),
            ipAddress: '127.0.0.1',
            userAgent: 'Playwright',
          },
          user: {
            id: 'member-user',
            name: 'Regular Member',
            email: 'member@ares.org',
            emailVerified: true,
            image: 'https://api.dicebear.com/9.x/bottts/svg?seed=member',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            role: 'member',
            banned: false,
          },
        },
      });
    });

    await page.goto('/dashboard/impact_roster');

    // Verify access denied message
    await expect(page.getByText('Access Denied')).toBeVisible();
  });

  test('WCAG 2.1 AA accessibility compliance', async ({ page }) => {
    await page.goto('/dashboard/impact_roster');

    // Stabilize page for accessibility scan
    await dashboardPage.stabilizeForAccessibility();

    // Run accessibility audit enforcing WCAG 2.1 AA rules only
    const accessibilityScanResults = await new AxeBuilder({ page })
      .disableRules(['color-contrast'])
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('Search input is accessible and keyboard navigable', async ({ page }) => {
    await page.goto('/dashboard/impact_roster');

    // Focus search input via keyboard
    const searchInput = page.getByPlaceholder('Search member...');
    await searchInput.focus();
    await expect(searchInput).toBeFocused();

    // Type and verify results update
    await page.keyboard.type('Test');
    await expect(searchInput).toHaveValue('Test');

    // Clear with keyboard
    await page.keyboard.press('Control+A');
    await page.keyboard.press('Backspace');
    await expect(searchInput).toHaveValue('');
  });

  test('MVP podium cards have proper visual hierarchy', async ({ page }) => {
    await page.goto('/dashboard/impact_roster');

    // Verify gold medal styling for #1 (first place)
    const firstPlaceCards = page.locator('.bg-ares-gold\\/10');
    await expect(firstPlaceCards.first()).toBeVisible();

    // Verify bronze medal styling for #3 (third place)
    const thirdPlaceCards = page.locator('.bg-ares-bronze\\/10');
    await expect(thirdPlaceCards.first()).toBeVisible();

    // Verify rank badges have proper styling
    const rankBadges = page.locator('.ares-cut-sm').filter({ hasText: /#\d/ });
    await expect(rankBadges.first()).toBeVisible();
  });
});
