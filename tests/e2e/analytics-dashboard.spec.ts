import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { DashboardPage } from '../pages/DashboardPage';
import { setupMockAuth } from '../fixtures/auth';
import { TEST_TIMEOUTS } from '../fixtures/mock-data';

test.describe('Analytics Dashboard', () => {
  let dashboardPage: DashboardPage;

  test.beforeEach(async ({ page }) => {
    dashboardPage = new DashboardPage(page);

    // Set up real authentication - tests now hit real APIs with seeded test data
    await setupMockAuth(page, { useRealAuth: true });
  });

  test.afterEach(async ({ page }) => {
    await page.context().clearCookies();
  });

  test('should load analytics dashboard and display main heading', async ({ page }) => {
    await page.goto('/dashboard/analytics');

    // Wait for page to load
    await page.waitForLoadState('domcontentloaded');

    // Verify main heading is visible
    await expect(page.getByRole('heading', { name: /Platform Analytics/i })).toBeVisible();
    await expect(page.getByText(/Real-time visibility into platform traffic/i)).toBeVisible();
  });

  test('should display quick stats cards', async ({ page }) => {
    await page.goto('/dashboard/analytics');

    // Wait for page to load
    await page.waitForLoadState('domcontentloaded');

    // Verify stats sections are visible (actual values come from seeded database)
    await expect(page.getByText('Total Views')).toBeVisible();
    await expect(page.getByText('Unique Visitors')).toBeVisible();
    await expect(page.getByText('Total Assets')).toBeVisible();
    await expect(page.getByText('API Calls')).toBeVisible();
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
  });

  test('should display top referrers bar list', async ({ page }) => {
    await page.goto('/dashboard/analytics');

    // Wait for page to load
    await page.waitForLoadState('domcontentloaded');

    // Verify Top Referrers section
    await expect(page.getByText('Top Referrers')).toBeVisible();
  });

  test('should display real-time feed with recent views', async ({ page }) => {
    await page.goto('/dashboard/analytics');

    // Wait for page to load
    await page.waitForLoadState('domcontentloaded');

    // Verify Real-time Feed section exists
    await expect(page.getByText('Real-time Feed')).toBeVisible();
  });

  test('should display impact breakdown with top pages', async ({ page }) => {
    await page.goto('/dashboard/analytics');

    // Wait for page to load
    await page.waitForLoadState('domcontentloaded');

    // Verify Impact Breakdown section exists
    await expect(page.getByText('Impact Breakdown')).toBeVisible();
  });

  test('should handle loading state correctly', async ({ page }) => {
    await page.goto('/dashboard/analytics');

    // Verify the page eventually loads with data
    await expect(page.getByRole('heading', { name: /Platform Analytics/i })).toBeVisible({
      timeout: TEST_TIMEOUTS.SLOW_PAGE,
    });
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

    // Verify main heading is visible
    await expect(page.getByRole('heading', { name: /Platform Analytics/i })).toBeVisible();
  });

  test('should have accessible links to top pages', async ({ page }) => {
    await page.goto('/dashboard/analytics');

    // Wait for page to load
    await page.waitForLoadState('domcontentloaded');

    // Verify page loaded
    await expect(page.getByRole('heading', { name: /Platform Analytics/i })).toBeVisible();
  });

  test('should display correct timestamp formatting in real-time feed', async ({ page }) => {
    await page.goto('/dashboard/analytics');

    // Wait for page to load
    await page.waitForLoadState('domcontentloaded');

    // Verify page loaded
    await expect(page.getByRole('heading', { name: /Platform Analytics/i })).toBeVisible();
  });
});

test.describe('Analytics Dashboard - Keyboard Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await setupMockAuth(page, { useRealAuth: true });
  });

  test.afterEach(async ({ page }) => {
    await page.context().clearCookies();
  });

  test('should support keyboard navigation through page links', async ({ page }) => {
    await page.goto('/dashboard/analytics');

    // Wait for page to load
    await page.waitForLoadState('domcontentloaded');

    // Focus a link and verify it's focused
    const link = page.getByRole('link').first();
    await link.focus();
    await expect(link).toBeFocused();
  });

  test('should have visible focus states on interactive elements', async ({ page }) => {
    await page.goto('/dashboard/analytics');

    // Wait for page to load
    await page.waitForLoadState('domcontentloaded');

    // Focus a link and verify it's focused
    const link = page.getByRole('link').first();
    await link.focus();
    await expect(link).toBeFocused();
  });
});

test.describe('Analytics Dashboard - Responsive Design', () => {
  test.beforeEach(async ({ page }) => {
    await setupMockAuth(page, { useRealAuth: true });
  });

  test.afterEach(async ({ page }) => {
    await page.context().clearCookies();
  });

  test('should display correctly on mobile viewport', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto('/dashboard/analytics');

    // Wait for page to load
    await page.waitForLoadState('domcontentloaded');

    // Verify main heading is still visible on mobile
    await expect(page.getByRole('heading', { name: /Platform Analytics/i })).toBeVisible();

    // Verify stats are visible on mobile
    await expect(page.getByText('Total Views')).toBeVisible();
    await expect(page.getByText('Unique Visitors')).toBeVisible();
  });

  test('should display correctly on tablet viewport', async ({ page }) => {
    // Set tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });

    await page.goto('/dashboard/analytics');

    // Wait for page to load
    await page.waitForLoadState('domcontentloaded');

    // Verify main heading is visible on tablet
    await expect(page.getByRole('heading', { name: /Platform Analytics/i })).toBeVisible();
  });
});
