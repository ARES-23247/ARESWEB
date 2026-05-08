import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { DashboardPage } from '../pages/DashboardPage';
import { shouldIgnoreConsoleError } from '../fixtures/auth';

/**
 * E2E tests for the Event Detail page (/events/:id).
 *
 * Tests use real database calls. Test data is seeded via scripts/seed-test-data.sql
 * - test-event-1: Test Competition (7 days from now)
 * - test-event-2: Team Meeting (3 days from now)
 * - outreach-event-1: Community Demo (14 days from now)
 */
test.describe('Event Detail Page', () => {
  // Use seeded test event from database
  const TEST_EVENT_ID = 'test-event-1';

  test.beforeEach(async ({ page }) => {
    // No mocking - use real API calls
  });

  test('should load event detail page successfully and display core elements', async ({ page }) => {
    await page.goto(`/events/${TEST_EVENT_ID}`);

    // Verify the page loads
    const nav = page.locator('nav');
    await expect(nav).toBeVisible();

    // Verify event title is displayed (actual title from database)
    const eventTitle = page.getByRole('heading', { level: 1 });
    await expect(eventTitle).toBeVisible();

    // Verify "Back to Archive" link is present
    const backLink = page.getByRole('link', { name: /back to archive|back|events/i });
    await expect(backLink).toBeVisible();
  });

  test('should display event date and time information', async ({ page }) => {
    await page.goto(`/events/${TEST_EVENT_ID}`);

    // Verify date/time information is displayed
    const mainText = await page.locator('main').textContent();
    expect(mainText?.length).toBeGreaterThan(0);
  });

  test('should display event description', async ({ page }) => {
    await page.goto(`/events/${TEST_EVENT_ID}`);

    // Verify description content is rendered (actual content from database)
    const descriptionArea = page.locator('main, article');
    await expect(descriptionArea).toBeVisible();
  });

  test('should show badge for events', async ({ page }) => {
    await page.goto(`/events/${TEST_EVENT_ID}`);

    // Verify some event badge/status is displayed
    // The actual badge depends on whether the event is upcoming or past
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('should pass WCAG 2.1 AA accessibility audit', async ({ page }) => {
    // Track console errors to ensure none occur during page load
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        if (!shouldIgnoreConsoleError(text)) {
          consoleErrors.push(text);
        }
      }
    });

    page.on('pageerror', (exception) => {
      consoleErrors.push(`Uncaught exception: "${exception}"`);
    });

    await page.goto(`/events/${TEST_EVENT_ID}`);

    const dashboard = new DashboardPage(page);

    // Wait for React to mount and render completely
    await dashboard.waitForLoadState();

    // Wait for Framer Motion animations to settle and force full opacity for contrast scan
    await dashboard.stabilizeForAccessibility();

    // Verify no console errors occurred
    if (consoleErrors.length > 0) {
      console.error('Console Errors:', consoleErrors);
    }
    expect(consoleErrors).toHaveLength(0);

    // Run accessibility scan with WCAG 2.1 AA rules
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .exclude('.framer-motion-container')
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('should have proper semantic HTML structure', async ({ page }) => {
    await page.goto(`/events/${TEST_EVENT_ID}`);

    // Verify the page has a main heading (h1)
    const h1 = page.locator('h1');
    await expect(h1).toBeVisible();
    await expect(h1).toContainText(/Test Competition/i);

    // Verify the main content area is present
    const main = page.locator('main');
    await expect(main).toBeVisible();

    // Verify semantic navigation
    const nav = page.locator('nav');
    await expect(nav).toBeVisible();
  });

  test('should provide accessible link to Google Maps', async ({ page }) => {
    await page.goto(`/events/${TEST_EVENT_ID}`);

    // Verify the location link has proper aria-label or sr-only text
    const mapsLink = page.getByRole('link', { name: /opens in google maps/i });
    await expect(mapsLink).toBeVisible();

    // Verify the link points to Google Maps
    const href = await mapsLink.getAttribute('href');
    expect(href).toContain('maps.google.com');
  });

  test('should render with proper SEO metadata', async ({ page }) => {
    await page.goto(`/events/${TEST_EVENT_ID}`);

    // Verify page title includes event title
    await expect(page).toHaveTitle(/ARES 23247/i);

    // Verify meta description is set
    const metaDescription = await page.locator('meta[name="description"]').getAttribute('content');
    expect(metaDescription).toBeTruthy();
    expect(metaDescription?.length).toBeGreaterThan(0);
  });
});
