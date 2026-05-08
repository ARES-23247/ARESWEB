import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { setupMockAuth, MOCK_ADMIN_USER } from '../fixtures/auth';
import { TEST_TIMEOUTS } from '../fixtures/mock-data';
import { DashboardPage } from '../pages/DashboardPage';

/**
 * Mock roster data for member impact testing.
 */
const MOCK_ROSTER_DATA = {
  roster: [
    {
      user_id: 'student-1',
      nickname: 'Alex Chen',
      member_type: 'student',
      attended_events: 15,
      manual_prep_hours: 12.5,
      event_volunteer_hours: 8.0,
      avatar: 'https://api.dicebear.com/9.x/bottts/svg?seed=alex',
    },
    {
      user_id: 'student-2',
      nickname: 'Jordan Smith',
      member_type: 'student',
      attended_events: 12,
      manual_prep_hours: 15.0,
      event_volunteer_hours: 6.5,
      avatar: 'https://api.dicebear.com/9.x/bottts/svg?seed=jordan',
    },
    {
      user_id: 'student-3',
      nickname: 'Taylor Brown',
      member_type: 'student',
      attended_events: 10,
      manual_prep_hours: 8.0,
      event_volunteer_hours: 12.0,
      avatar: 'https://api.dicebear.com/9.x/bottts/svg?seed=taylor',
    },
    {
      user_id: 'mentor-1',
      nickname: 'Dr. Sarah Johnson',
      member_type: 'mentor',
      attended_events: 8,
      manual_prep_hours: 5.0,
      event_volunteer_hours: 20.0,
      avatar: 'https://api.dicebear.com/9.x/bottts/svg?seed=sarah',
    },
    {
      user_id: 'alumni-1',
      nickname: 'Marcus Williams',
      member_type: 'alumni',
      attended_events: 3,
      manual_prep_hours: 2.0,
      event_volunteer_hours: 4.0,
      avatar: 'https://api.dicebear.com/9.x/bottts/svg?seed=marcus',
    },
  ],
};

/**
 * Empty roster data for edge case testing.
 */
const EMPTY_ROSTER_DATA = {
  roster: [],
};

test.describe('Member Impact Dashboard', () => {
  let dashboardPage: DashboardPage;

  test.beforeEach(async ({ page }) => {
    await setupMockAuth(page);
    dashboardPage = new DashboardPage(page);

    // Mock the roster stats API endpoint
    await page.route('**/api/analytics/admin/roster-stats*', async (route) => {
      await route.fulfill({
        status: 200,
        json: MOCK_ROSTER_DATA,
      });
    });
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

    // Verify top 3 students are displayed for attendance
    await expect(page.getByText('Alex Chen')).toBeVisible();
    await expect(page.getByText('Jordan Smith')).toBeVisible();
    await expect(page.getByText('Taylor Brown')).toBeVisible();

    // Verify full roster table header
    await expect(page.getByText('Full Team Roster')).toBeVisible();
    await expect(page.getByText('Detailed attendance and volunteering metrics for export')).toBeVisible();
  });

  test('Member Impact displays correct MVP rankings and statistics', async ({ page }) => {
    await page.goto('/dashboard/impact_roster');

    // Verify Attendance MVP #1 (Alex Chen with 15 events)
    const alexChenAttendance = page.locator('tr', { hasText: 'Alex Chen' }).filter({ hasText: '15' });
    await expect(alexChenAttendance).toBeVisible();

    // Verify Outreach MVP #1 (Taylor Brown with 20 total hours)
    // Total = manual_prep_hours (8.0) + event_volunteer_hours (12.0) = 20.0
    const taylorBrownOutreach = page.locator('tr', { hasText: 'Taylor Brown' }).filter({ hasText: '20.0' });
    await expect(taylorBrownOutreach).toBeVisible();

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

    // Verify student data
    await expect(page.getByText('Alex Chen')).toBeVisible();
    await expect(page.getByText('student')).toBeVisible();

    // Verify mentor data
    await expect(page.getByText('Dr. Sarah Johnson')).toBeVisible();
    await expect(page.getByText('mentor')).toBeVisible();

    // Verify alumni data
    await expect(page.getByText('Marcus Williams')).toBeVisible();
    await expect(page.getByText('alumni')).toBeVisible();

    // Verify hours calculation (manual_prep_hours + event_volunteer_hours)
    // Alex Chen: 12.5 + 8.0 = 20.5 hours
    await expect(page.getByText('20.5 hrs')).toBeVisible();
  });

  test('Search functionality filters members correctly', async ({ page }) => {
    await page.goto('/dashboard/impact_roster');

    // Wait for table to load
    await expect(page.getByText('Full Team Roster')).toBeVisible();

    // Verify initial state - all members visible
    await expect(page.getByText('Alex Chen')).toBeVisible();
    await expect(page.getByText('Jordan Smith')).toBeVisible();
    await expect(page.getByText('Dr. Sarah Johnson')).toBeVisible();

    // Search for specific member
    const searchInput = page.getByPlaceholder('Search member...');
    await expect(searchInput).toBeVisible();
    await searchInput.fill('Alex');

    // Verify only Alex Chen is visible
    await expect(page.getByText('Alex Chen')).toBeVisible();
    await expect(page.getByText('Jordan Smith')).not.toBeVisible();
    await expect(page.getByText('Dr. Sarah Johnson')).not.toBeVisible();

    // Clear search
    await searchInput.fill('');

    // Verify all members are visible again
    await expect(page.getByText('Alex Chen')).toBeVisible();
    await expect(page.getByText('Jordan Smith')).toBeVisible();
    await expect(page.getByText('Dr. Sarah Johnson')).toBeVisible();
  });

  test('Search by member type filters correctly', async ({ page }) => {
    await page.goto('/dashboard/impact_roster');

    // Wait for table to load
    await expect(page.getByText('Full Team Roster')).toBeVisible();

    // Search for mentors
    const searchInput = page.getByPlaceholder('Search member...');
    await searchInput.fill('mentor');

    // Verify only mentor is visible
    await expect(page.getByText('Dr. Sarah Johnson')).toBeVisible();
    await expect(page.getByText('Alex Chen')).not.toBeVisible();
    await expect(page.getByText('Jordan Smith')).not.toBeVisible();
  });

  test('Empty state displays when no members match search', async ({ page }) => {
    await page.goto('/dashboard/impact_roster');

    // Wait for table to load
    await expect(page.getByText('Full Team Roster')).toBeVisible();

    // Search for non-existent member
    const searchInput = page.getByPlaceholder('Search member...');
    await searchInput.fill('NonExistentMember');

    // Verify empty state message
    await expect(page.getByText('No members match your search criteria')).toBeVisible();
  });

  test('Empty roster handles gracefully with MVP sections hidden', async ({ page }) => {
    // Override mock to return empty roster
    await page.route('**/api/analytics/admin/roster-stats*', async (route) => {
      await route.fulfill({
        status: 200,
        json: EMPTY_ROSTER_DATA,
      });
    });

    await page.goto('/dashboard/impact_roster');

    // Verify page title still loads
    await expect(page.getByRole('heading', { name: 'Member Impact Registry' })).toBeVisible();

    // Verify MVP sections are not displayed when no students exist
    await expect(page.getByText('Attendance MVPs')).not.toBeVisible();
    await expect(page.getByText('Outreach MVPs')).not.toBeVisible();

    // Verify empty state in roster table
    await expect(page.getByText('No members match your search criteria')).toBeVisible();
  });

  test('Error state displays fallback UI when API fails', async ({ page }) => {
    // Override mock to return error
    await page.route('**/api/analytics/admin/roster-stats*', async (route) => {
      await route.fulfill({
        status: 500,
        json: { error: 'Internal server error' },
      });
    });

    await page.goto('/dashboard/impact_roster');

    // Verify error message is displayed
    await expect(page.getByText('TELEMETRY FAULT')).toBeVisible();
    await expect(page.getByText('Failed to synchronize roster data')).toBeVisible();
  });

  test('Member avatars display correctly in roster table', async ({ page }) => {
    await page.goto('/dashboard/impact_roster');

    // Verify avatar images are loaded
    const avatars = page.locator('img[alt="avatar"]');
    await expect(avatars.first()).toBeVisible();

    // Verify at least 5 avatars for our mock roster
    const avatarCount = await avatars.count();
    expect(avatarCount).toBeGreaterThanOrEqual(5);
  });

  test('Volunteer hours calculation is accurate', async ({ page }) => {
    await page.goto('/dashboard/impact_roster');

    // Alex Chen: 12.5 (manual) + 8.0 (volunteer) = 20.5 total
    const alexChenRow = page.locator('tr', { hasText: 'Alex Chen' });
    await expect(alexChenRow.getByText('20.5 hrs')).toBeVisible();

    // Dr. Sarah Johnson: 5.0 (manual) + 20.0 (volunteer) = 25.0 total
    const sarahRow = page.locator('tr', { hasText: 'Dr. Sarah Johnson' });
    await expect(sarahRow.getByText('25.0 hrs')).toBeVisible();
  });

  test('Access control redirects non-admin users', async ({ page }) => {
    // Setup mock auth with non-admin user
    await page.route('**/api/auth/get-session', async (route) => {
      await route.fulfill({
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
    await page.keyboard.type('Alex');
    await expect(page.getByText('Alex Chen')).toBeVisible();
    await expect(page.getByText('Jordan Smith')).not.toBeVisible();

    // Clear with keyboard
    await page.keyboard.press('Control+A');
    await page.keyboard.press('Backspace');
    await expect(page.getByText('Jordan Smith')).toBeVisible();
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
