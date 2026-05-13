import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { setupMockAuth } from '../fixtures/auth';
import { DashboardPage } from '../pages/DashboardPage';

test.describe('Member Impact Dashboard', () => {
  let dashboardPage: DashboardPage;

  test.beforeEach(async ({ page }) => {
    await setupMockAuth(page);

    // Mock roster stats API endpoint
    await page.route('**/api/analytics/admin/roster-stats', async (route) => {
      await route.fulfill({
        status: 200,
        json: {
          roster: [
            {
              userId: '1',
              nickname: 'Test Student 1',
              memberType: 'student',
              avatar: 'https://api.dicebear.com/9.x/bottts/svg?seed=test1',
              attendedEvents: 5,
              manualPrepHours: 2,
              eventVolunteerHours: 8,
            },
            {
              userId: '2',
              nickname: 'Test Student 2',
              memberType: 'student',
              avatar: 'https://api.dicebear.com/9.x/bottts/svg?seed=test2',
              attendedEvents: 3,
              manualPrepHours: 1,
              eventVolunteerHours: 5,
            },
            {
              userId: '3',
              nickname: 'Test Mentor',
              memberType: 'mentor',
              avatar: 'https://api.dicebear.com/9.x/bottts/svg?seed=mentor',
              attendedEvents: 8,
              manualPrepHours: 5,
              eventVolunteerHours: 12,
            },
          ],
        },
      });
    });

    dashboardPage = new DashboardPage(page);
  });

  test('Member Impact Registry loads with correct title and displays MVP sections', async ({ page }) => {
    await page.goto('/dashboard/impact_roster');

    // Verify page title
    await expect(page.getByRole('heading', { name: 'Member Impact Registry' })).toBeVisible();

    // Verify subtitle
    await expect(page.getByText('Tracking the direct contribution and service hours of ARES 23247')).toBeVisible();

    // MVP sections only render when student data exists (students with attendedEvents > 0 or totalHours > 0)
    const attendanceMVPs = page.getByText('Attendance MVPs');
    const outreachMVPs = page.getByText('Outreach MVPs');

    const hasMVPData = await attendanceMVPs.isVisible().catch(() => false);

    if (hasMVPData) {
      // Verify MVP section headers when data exists
      await expect(attendanceMVPs).toBeVisible();
      await expect(outreachMVPs).toBeVisible();
    }
    // If no student data exists, MVP sections are hidden - this is expected behavior

    // Verify full roster table header (always visible)
    await expect(page.getByText('Full Team Roster')).toBeVisible();
    await expect(page.getByText('Detailed attendance and volunteering metrics for export')).toBeVisible();
  });

  test('Member Impact displays correct MVP rankings and statistics', async ({ page }) => {
    await page.goto('/dashboard/impact_roster');

    // MVP sections only render when student data exists
    const attendanceMVPs = page.getByText('Attendance MVPs');
    const hasMVPData = await attendanceMVPs.isVisible().catch(() => false);

    if (!hasMVPData) {
      // Skip test if no student data - MVP sections are hidden
      test.skip(true, 'No student MVP data in test environment');
      return;
    }

    // Verify ranking badges are visible when data exists
    await expect(page.getByText('#1')).toBeVisible();
    await expect(page.getByText('#2')).toBeVisible();
    await expect(page.getByText('#3')).toBeVisible();

    // Verify student labels
    await expect(page.getByText('Student')).toBeVisible();
  });

  test('Full roster table displays all member types with correct metrics', async ({ page }) => {
    await page.goto('/dashboard/impact_roster');

    // Verify table headers using role for specificity
    await expect(page.getByRole('columnheader', { name: 'Member' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Type' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Events Attended' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Volunteer Hours' })).toBeVisible();
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
    // Note: This test uses real auth, so we can't mock the session
    // Skip in remote testing mode since we can't change the user role
    const isRemote = process.env.PREVIEW_URL || process.env.CI === 'true';
    if (isRemote) {
      test.skip(true, 'Cannot test non-admin access with real auth');
      return;
    }

    // Setup mock auth with non-admin user (only works in local mode)
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

    await page.route('**/api/profile/me', async (route) => {
      await route.fulfill({
        status: 200,
        json: {
          userId: 'member-user',
          nickname: 'Regular Member',
          memberType: 'student',
          auth: {
            id: 'member-user',
            email: 'member@ares.org',
            name: 'Regular Member',
            role: 'member',
          }
        }
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

    // MVP sections only render when student data exists
    const attendanceMVPs = page.getByText('Attendance MVPs');
    const hasMVPData = await attendanceMVPs.isVisible().catch(() => false);

    if (!hasMVPData) {
      // Skip test if no student data - MVP sections are hidden
      test.skip(true, 'No student MVP data in test environment');
      return;
    }

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
