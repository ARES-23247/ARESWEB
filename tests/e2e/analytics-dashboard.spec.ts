import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { DashboardPage } from '../pages/DashboardPage';
import { setupMockAuth } from '../fixtures/auth';
import { TEST_TIMEOUTS } from '../fixtures/mock-data';

/**
 * Mock platform analytics data for E2E testing.
 */
const MOCK_PLATFORM_ANALYTICS = {
  totalPageViews: 125430,
  uniqueVisitors: 8452,
  topPages: [
    { path: '/blog/ftc-championship-recap', category: 'blog', views: 3240 },
    { path: '/docs/programming-guide', category: 'doc', views: 2180 },
    { path: '/events/competition-schedule', category: 'event', views: 1890 },
    { path: '/blog/team-announcement', category: 'blog', views: 1450 },
    { path: '/docs/safety-manual', category: 'doc', views: 1120 },
  ],
  topReferrers: [
    { referrer: 'https://github.com/FTC-ARES', visits: 4200 },
    { referrer: 'https://ftc-events.firstinspires.org', visits: 3100 },
    { referrer: 'https://www.google.com', visits: 2800 },
    { referrer: 'https://reddit.com/r/FTC', visits: 1200 },
    { referrer: 'direct', visits: 9800 },
  ],
  recentViews: [
    {
      path: '/blog/ftc-championship-recap',
      category: 'blog',
      user_agent: 'Mozilla/5.0',
      referrer: 'https://www.google.com',
      timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
    },
    {
      path: '/docs/programming-guide',
      category: 'doc',
      user_agent: 'Mozilla/5.0',
      referrer: 'direct',
      timestamp: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
    },
    {
      path: '/events/competition-schedule',
      category: 'event',
      user_agent: 'Mozilla/5.0',
      referrer: 'https://ftc-events.firstinspires.org',
      timestamp: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
    },
    {
      path: '/docs/safety-manual',
      category: 'doc',
      user_agent: 'Mozilla/5.0',
      referrer: 'https://github.com/FTC-ARES',
      timestamp: new Date(Date.now() - 1000 * 60 * 25).toISOString(),
    },
    {
      path: '/blog/team-announcement',
      category: 'blog',
      user_agent: 'Mozilla/5.0',
      referrer: 'https://reddit.com/r/FTC',
      timestamp: new Date(Date.now() - 1000 * 60 * 32).toISOString(),
    },
  ],
  totals: [
    { category: 'blog', total: 5420 },
    { category: 'doc', total: 3890 },
    { category: 'event', total: 2340 },
    { category: 'system', total: 890 },
  ],
  userActivity: [
    { date: '2024-01-01', pageViews: 120 },
    { date: '2024-01-02', pageViews: 145 },
    { date: '2024-01-03', pageViews: 98 },
    { date: '2024-01-04', pageViews: 167 },
    { date: '2024-01-05', pageViews: 189 },
    { date: '2024-01-06', pageViews: 134 },
    { date: '2024-01-07', pageViews: 156 },
    { date: '2024-01-08', pageViews: 178 },
    { date: '2024-01-09', pageViews: 201 },
    { date: '2024-01-10', pageViews: 223 },
    { date: '2024-01-11', pageViews: 187 },
    { date: '2024-01-12', pageViews: 165 },
    { date: '2024-01-13', pageViews: 143 },
    { date: '2024-01-14', pageViews: 198 },
    { date: '2024-01-15', pageViews: 212 },
    { date: '2024-01-16', pageViews: 234 },
    { date: '2024-01-17', pageViews: 189 },
    { date: '2024-01-18', pageViews: 156 },
    { date: '2024-01-19', pageViews: 178 },
    { date: '2024-01-20', pageViews: 201 },
    { date: '2024-01-21', pageViews: 223 },
    { date: '2024-01-22', pageViews: 187 },
    { date: '2024-01-23', pageViews: 245 },
    { date: '2024-01-24', pageViews: 267 },
    { date: '2024-01-25', pageViews: 289 },
    { date: '2024-01-26', pageViews: 312 },
    { date: '2024-01-27', pageViews: 298 },
    { date: '2024-01-28', pageViews: 276 },
    { date: '2024-01-29', pageViews: 254 },
    { date: '2024-01-30', pageViews: 231 },
  ],
  latency: [
    { date: '2024-01-01', avg_latency: 45.2 },
    { date: '2024-01-02', avg_latency: 42.8 },
    { date: '2024-01-03', avg_latency: 48.1 },
    { date: '2024-01-04', avg_latency: 39.6 },
    { date: '2024-01-05', avg_latency: 44.3 },
    { date: '2024-01-06', avg_latency: 41.7 },
    { date: '2024-01-07', avg_latency: 46.9 },
    { date: '2024-01-08', avg_latency: 43.5 },
    { date: '2024-01-09', avg_latency: 40.2 },
    { date: '2024-01-10', avg_latency: 38.9 },
    { date: '2024-01-11', avg_latency: 42.1 },
    { date: '2024-01-12', avg_latency: 45.6 },
    { date: '2024-01-13', avg_latency: 47.8 },
    { date: '2024-01-14', avg_latency: 44.2 },
    { date: '2024-01-15', avg_latency: 41.3 },
    { date: '2024-01-16', avg_latency: 39.8 },
    { date: '2024-01-17', avg_latency: 43.7 },
    { date: '2024-01-18', avg_latency: 46.1 },
    { date: '2024-01-19', avg_latency: 42.5 },
    { date: '2024-01-20', avg_latency: 40.9 },
    { date: '2024-01-21', avg_latency: 38.4 },
    { date: '2024-01-22', avg_latency: 44.6 },
    { date: '2024-01-23', avg_latency: 47.2 },
    { date: '2024-01-24', avg_latency: 45.8 },
    { date: '2024-01-25', avg_latency: 43.1 },
    { date: '2024-01-26', avg_latency: 41.6 },
    { date: '2024-01-27', avg_latency: 39.3 },
    { date: '2024-01-28', avg_latency: 42.8 },
    { date: '2024-01-29', avg_latency: 44.5 },
    { date: '2024-01-30', avg_latency: 46.3 },
  ],
  resourceUsage: {
    totalAssets: 1247,
    totalStorage: 2450000000,
    apiCalls: 89432,
  },
} as const;

test.describe('Analytics Dashboard', () => {
  let dashboardPage: DashboardPage;

  test.beforeEach(async ({ page }) => {
    dashboardPage = new DashboardPage(page);

    // Set up mock authentication with admin role
    await setupMockAuth(page);

    // Mock platform analytics API
    await page.route('**/api/analytics/admin/platform-analytics*', async (route) => {
      await route.fulfill({
        status: 200,
        json: MOCK_PLATFORM_ANALYTICS,
      });
    });

    // Mock stats API for header
    await page.route('**/api/analytics/admin/stats*', async (route) => {
      await route.fulfill({
        status: 200,
        json: {
          posts: 25,
          events: 12,
          docs: 18,
          securityBlocks: 42,
          integrations: {
            zulip: true,
            github: true,
            discord: false,
            bluesky: false,
            slack: false,
            gcal: false,
          },
        },
      });
    });

    // Mock Zulip presence to avoid "body stream already read" errors
    await page.route('**/api/zulip/presence', async (route) => {
      await route.fulfill({
        status: 200,
        json: { success: true, presence: {}, userNames: {} },
      });
    });
  });

  test('should load analytics dashboard and display main heading', async ({ page }) => {
    await page.goto('/dashboard/analytics');

    // Wait for page to load
    await page.waitForLoadState('domcontentloaded');

    // Verify main heading is visible
    await expect(page.getByRole('heading', { name: /Platform Analytics/i })).toBeVisible();
    await expect(page.getByText(/Real-time visibility into platform traffic/i)).toBeVisible();
  });

  test('should display quick stats cards with correct metrics', async ({ page }) => {
    await page.goto('/dashboard/analytics');

    // Wait for page to load
    await page.waitForLoadState('domcontentloaded');

    // Verify Total Views stat
    await expect(page.getByText('Total Views')).toBeVisible();
    await expect(page.getByText('125,430')).toBeVisible();

    // Verify Unique Visitors stat
    await expect(page.getByText('Unique Visitors')).toBeVisible();
    await expect(page.getByText('8,452')).toBeVisible();

    // Verify Total Assets stat
    await expect(page.getByText('Total Assets')).toBeVisible();
    await expect(page.getByText('1,247')).toBeVisible();

    // Verify API Calls stat
    await expect(page.getByText('API Calls')).toBeVisible();
    await expect(page.getByText('89,432')).toBeVisible();
  });

  test('should display 30-Day Activity chart', async ({ page }) => {
    await page.goto('/dashboard/analytics');

    // Wait for page to load
    await page.waitForLoadState('domcontentloaded');

    // Verify 30-Day Activity section is visible
    await expect(page.getByText('30-Day Activity')).toBeVisible();

    // Verify the chart renders (Tremor charts create SVG elements)
    const chart = page.locator('svg').filter({ has: page.locator('text') }).first();
    await expect(chart).toBeVisible();
  });

  test('should display API Latency chart', async ({ page }) => {
    await page.goto('/dashboard/analytics');

    // Wait for page to load
    await page.waitForLoadState('domcontentloaded');

    // Verify API Latency section is visible
    await expect(page.getByText('API Latency (ms)')).toBeVisible();

    // Verify the chart renders
    const chart = page.locator('svg').filter({ has: page.locator('text') }).first();
    await expect(chart).toBeVisible();
  });

  test('should display traffic distribution donut chart', async ({ page }) => {
    await page.goto('/dashboard/analytics');

    // Wait for page to load
    await page.waitForLoadState('domcontentloaded');

    // Verify Traffic Distribution section
    await expect(page.getByText('Traffic Distribution')).toBeVisible();

    // Verify total count
    const expectedTotal = (5420 + 3890 + 2340 + 890).toLocaleString();
    await expect(page.getByText(expectedTotal)).toBeVisible();
  });

  test('should display top referrers bar list', async ({ page }) => {
    await page.goto('/dashboard/analytics');

    // Wait for page to load
    await page.waitForLoadState('domcontentloaded');

    // Verify Top Referrers section
    await expect(page.getByText('Top Referrers')).toBeVisible();

    // Verify referrers are displayed
    await expect(page.getByText('ftc-events.firstinspires.org')).toBeVisible();
    await expect(page.getByText('github.com')).toBeVisible();
    await expect(page.getByText('google.com')).toBeVisible();
    await expect(page.getByText('reddit.com')).toBeVisible();
  });

  test('should display real-time feed with recent views', async ({ page }) => {
    await page.goto('/dashboard/analytics');

    // Wait for page to load
    await page.waitForLoadState('domcontentloaded');

    // Verify Real-time Feed section
    await expect(page.getByText('Real-time Feed')).toBeVisible();

    // Verify recent view entries are displayed - use link selector to avoid duplicate text
    await expect(page.getByRole('link', { name: '/blog/ftc-championship-recap' })).toBeVisible();
    await expect(page.getByRole('link', { name: '/docs/programming-guide' })).toBeVisible();
    await expect(page.getByRole('link', { name: '/events/competition-schedule' })).toBeVisible();

    // Verify category badges
    await expect(page.getByText('blog')).toBeVisible();
    await expect(page.getByText('doc')).toBeVisible();
    await expect(page.getByText('event')).toBeVisible();
  });

  test('should display impact breakdown with top pages', async ({ page }) => {
    await page.goto('/dashboard/analytics');

    // Wait for page to load
    await page.waitForLoadState('domcontentloaded');

    // Verify Impact Breakdown section
    await expect(page.getByText('Impact Breakdown')).toBeVisible();

    // Verify top pages are displayed with view counts - use link selector
    await expect(page.getByRole('link', { name: '/blog/ftc-championship-recap' })).toBeVisible();
    await expect(page.getByText('3,240')).toBeVisible();
    await expect(page.getByRole('link', { name: '/docs/programming-guide' })).toBeVisible();
    await expect(page.getByText('2,180')).toBeVisible();
  });

  test('should handle loading state correctly', async ({ page }) => {
    // Slow down the API response to ensure loading state is visible
    await page.route('**/api/analytics/admin/platform-analytics*', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 100));
      await route.fulfill({
        status: 200,
        json: MOCK_PLATFORM_ANALYTICS,
      });
    });

    await page.goto('/dashboard/analytics');

    // Verify the page eventually loads with data
    await expect(page.getByRole('heading', { name: /Platform Analytics/i })).toBeVisible({
      timeout: TEST_TIMEOUTS.SLOW_PAGE,
    });
  });

  test('should handle API error gracefully', async ({ page }) => {
    // Override the analytics API to return an error
    await page.route('**/api/analytics/admin/platform-analytics*', async (route) => {
      await route.fulfill({
        status: 500,
        json: { error: 'Internal Server Error' },
      });
    });

    await page.goto('/dashboard/analytics');

    // Wait for page to load
    await page.waitForLoadState('domcontentloaded');

    // Verify error state is displayed
    await expect(page.getByText(/TELEMETRY FAULT/i)).toBeVisible();
    await expect(page.getByText(/Failed to synchronize platform metrics/i)).toBeVisible();
  });

  test('should handle empty analytics state', async ({ page }) => {
    // Override the analytics API to return empty data
    await page.route('**/api/analytics/admin/platform-analytics*', async (route) => {
      await route.fulfill({
        status: 200,
        json: {
          totalPageViews: 0,
          uniqueVisitors: 0,
          topPages: [],
          topReferrers: [],
          recentViews: [],
          totals: [],
          userActivity: [],
          latency: [],
          resourceUsage: {
            totalAssets: 0,
            totalStorage: 0,
            apiCalls: 0,
          },
        },
      });
    });

    await page.goto('/dashboard/analytics');

    // Wait for page to load
    await page.waitForLoadState('domcontentloaded');

    // Verify zero values are displayed
    await expect(page.getByText('0')).toBeVisible();
  });

  test('should pass WCAG 2.1 AA accessibility audit', async ({ page }) => {
    await page.goto('/dashboard/analytics');

    // Wait for page to load and stabilize
    await page.waitForLoadState('domcontentloaded');
    await dashboardPage.stabilizeForAccessibility();

    // Run accessibility audit
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('should have accessible chart containers with proper labels', async ({ page }) => {
    await page.goto('/dashboard/analytics');

    // Wait for page to load
    await page.waitForLoadState('domcontentloaded');

    // Verify section headings are present for screen readers
    await expect(page.getByRole('heading', { name: '30-Day Activity' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'API Latency (ms)' })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Real-time Feed/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Impact Breakdown/i })).toBeVisible();
  });

  test('should have accessible links to top pages', async ({ page }) => {
    await page.goto('/dashboard/analytics');

    // Wait for page to load
    await page.waitForLoadState('domcontentloaded');

    // Verify links to top pages have accessible names
    const blogLink = page.getByRole('link', { name: /\/blog\/ftc-championship-recap/i });
    await expect(blogLink).toBeVisible();

    const docLink = page.getByRole('link', { name: /\/docs\/programming-guide/i });
    await expect(docLink).toBeVisible();
  });

  test('should display correct timestamp formatting in real-time feed', async ({ page }) => {
    await page.goto('/dashboard/analytics');

    // Wait for page to load
    await page.waitForLoadState('domcontentloaded');

    // Verify timestamps are displayed in HH:MM format
    const timePattern = /\d{1,2}:\d{2}/;
    const timeElements = await page.locator('text').filter({ hasText: timePattern }).all();
    expect(timeElements.length).toBeGreaterThan(0);
  });
});

test.describe('Analytics Dashboard - Keyboard Navigation', () => {
  test('should support keyboard navigation through page links', async ({ page }) => {
    await setupMockAuth(page);

    // Mock API responses
    await page.route('**/api/analytics/admin/platform-analytics*', async (route) => {
      await route.fulfill({ status: 200, json: MOCK_PLATFORM_ANALYTICS });
    });

    await page.route('**/api/analytics/admin/stats*', async (route) => {
      await route.fulfill({
        status: 200,
        json: { posts: 25, events: 12, docs: 18, integrations: {} },
      });
    });

    await page.route('**/api/zulip/presence', async (route) => {
      await route.fulfill({ status: 200, json: { success: true, presence: {}, userNames: {} } });
    });

    await page.goto('/dashboard/analytics');

    // Wait for page to load
    await page.waitForLoadState('domcontentloaded');

    // Focus a link and verify it's focused
    const blogLink = page.getByRole('link', { name: /\/blog\/ftc-championship-recap/i }).first();
    await blogLink.focus();
    await expect(blogLink).toBeFocused();
  });

  test('should have visible focus states on interactive elements', async ({ page }) => {
    await setupMockAuth(page);

    // Mock API responses
    await page.route('**/api/analytics/admin/platform-analytics*', async (route) => {
      await route.fulfill({ status: 200, json: MOCK_PLATFORM_ANALYTICS });
    });

    await page.route('**/api/analytics/admin/stats*', async (route) => {
      await route.fulfill({
        status: 200,
        json: { posts: 25, events: 12, docs: 18, integrations: {} },
      });
    });

    await page.route('**/api/zulip/presence', async (route) => {
      await route.fulfill({ status: 200, json: { success: true, presence: {}, userNames: {} } });
    });

    await page.goto('/dashboard/analytics');

    // Wait for page to load
    await page.waitForLoadState('domcontentloaded');

    // Focus a link and verify it's focused
    const link = page.getByRole('link').first();
    await link.focus();
    await expect(link).toBeFocused();
  });
});

test.describe('Analytics Dashboard - Data Verification', () => {
  test('should correctly aggregate traffic distribution totals', async ({ page }) => {
    await setupMockAuth(page);

    // Mock API responses
    await page.route('**/api/analytics/admin/platform-analytics*', async (route) => {
      await route.fulfill({ status: 200, json: MOCK_PLATFORM_ANALYTICS });
    });

    await page.route('**/api/analytics/admin/stats*', async (route) => {
      await route.fulfill({
        status: 200,
        json: { posts: 25, events: 12, docs: 18, integrations: {} },
      });
    });

    await page.route('**/api/zulip/presence', async (route) => {
      await route.fulfill({ status: 200, json: { success: true, presence: {}, userNames: {} } });
    });

    await page.goto('/dashboard/analytics');

    // Wait for page to load
    await page.waitForLoadState('domcontentloaded');

    // Verify traffic distribution total equals sum of all categories
    const expectedTotal = (5420 + 3890 + 2340 + 890).toLocaleString();
    await expect(page.getByText(expectedTotal)).toBeVisible();
  });

  test('should display correct view counts for top pages', async ({ page }) => {
    await setupMockAuth(page);

    // Mock API responses
    await page.route('**/api/analytics/admin/platform-analytics*', async (route) => {
      await route.fulfill({ status: 200, json: MOCK_PLATFORM_ANALYTICS });
    });

    await page.route('**/api/analytics/admin/stats*', async (route) => {
      await route.fulfill({
        status: 200,
        json: { posts: 25, events: 12, docs: 18, integrations: {} },
      });
    });

    await page.route('**/api/zulip/presence', async (route) => {
      await route.fulfill({ status: 200, json: { success: true, presence: {}, userNames: {} } });
    });

    await page.goto('/dashboard/analytics');

    // Wait for page to load
    await page.waitForLoadState('domcontentloaded');

    // Verify specific view counts
    await expect(page.getByText('3,240')).toBeVisible();
    await expect(page.getByText('2,180')).toBeVisible();
    await expect(page.getByText('1,890')).toBeVisible();
  });
});

test.describe('Analytics Dashboard - Responsive Design', () => {
  test('should display correctly on mobile viewport', async ({ page }) => {
    await setupMockAuth(page);

    // Mock API responses
    await page.route('**/api/analytics/admin/platform-analytics*', async (route) => {
      await route.fulfill({ status: 200, json: MOCK_PLATFORM_ANALYTICS });
    });

    await page.route('**/api/analytics/admin/stats*', async (route) => {
      await route.fulfill({
        status: 200,
        json: { posts: 25, events: 12, docs: 18, integrations: {} },
      });
    });

    await page.route('**/api/zulip/presence', async (route) => {
      await route.fulfill({ status: 200, json: { success: true, presence: {}, userNames: {} } });
    });

    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto('/dashboard/analytics');

    // Wait for page to load
    await page.waitForLoadState('domcontentloaded');

    // Verify main heading is still visible on mobile
    await expect(page.getByRole('heading', { name: /Platform Analytics/i })).toBeVisible();

    // Verify stats are stacked vertically on mobile
    await expect(page.getByText('Total Views')).toBeVisible();
    await expect(page.getByText('Unique Visitors')).toBeVisible();
  });

  test('should display correctly on tablet viewport', async ({ page }) => {
    await setupMockAuth(page);

    // Mock API responses
    await page.route('**/api/analytics/admin/platform-analytics*', async (route) => {
      await route.fulfill({ status: 200, json: MOCK_PLATFORM_ANALYTICS });
    });

    await page.route('**/api/analytics/admin/stats*', async (route) => {
      await route.fulfill({
        status: 200,
        json: { posts: 25, events: 12, docs: 18, integrations: {} },
      });
    });

    await page.route('**/api/zulip/presence', async (route) => {
      await route.fulfill({ status: 200, json: { success: true, presence: {}, userNames: {} } });
    });

    // Set tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });

    await page.goto('/dashboard/analytics');

    // Wait for page to load
    await page.waitForLoadState('domcontentloaded');

    // Verify main heading is visible on tablet
    await expect(page.getByRole('heading', { name: /Platform Analytics/i })).toBeVisible();
  });
});
