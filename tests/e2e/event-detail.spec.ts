import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { DashboardPage } from '../pages/DashboardPage';
import { shouldIgnoreConsoleError } from '../fixtures/auth';

/**
 * Mock event data matching the eventResponseSchema from @shared/routes/events.ts
 */
const MOCK_EVENT_ID = 'test-event-123';
const MOCK_EVENT = {
  id: MOCK_EVENT_ID,
  title: 'ARES 23247 Kickoff Meeting',
  date_start: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
  date_end: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000).toISOString(), // +2 hours
  location: 'ARES Lab — Lincoln High School',
  location_address: 'Lincoln High School, 123 Main St, Springfield, IL 62701',
  description: JSON.stringify({
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: 'Join us for our season kickoff meeting! We will discuss:' }
        ]
      },
      {
        type: 'bulletList',
        content: [
          {
            type: 'listItem',
            content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Game reveal analysis' }] }]
          },
          {
            type: 'listItem',
            content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Team goals and objectives' }] }]
          },
          {
            type: 'listItem',
            content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Subteam assignments' }] }]
          }
        ]
      },
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: 'Pizza and refreshments will be provided!' }
        ]
      }
    ]
  }),
  cover_image: '/images/events/kickoff.jpg',
  status: 'published',
  category: 'internal',
  is_deleted: 0,
  season_id: 15,
  meeting_notes: null,
  recurring_group_id: null,
  rrule: null,
  zulip_stream: 'events',
  zulip_topic: 'Kickoff Meeting',
  is_potluck: 0,
  is_volunteer: 0,
};

/**
 * E2E tests for the Event Detail page (/events/:id).
 * Tests page loading, event details display, and WCAG 2.1 AA accessibility compliance.
 */
test.describe('Event Detail Page', () => {
  test.beforeEach(async ({ page }) => {
    // Mock the event API response
    await page.route(`**/api/events/${MOCK_EVENT_ID}`, async (route) => {
      await route.fulfill({
        status: 200,
        json: { event: MOCK_EVENT },
      });
    });

    // Mock the event signups API response
    await page.route(`**/api/events/${MOCK_EVENT_ID}/signups`, async (route) => {
      await route.fulfill({
        status: 200,
        json: {
          signups: [],
          dietary_summary: null,
          team_dietary_summary: null,
          authenticated: false,
          role: null,
          member_type: null,
          can_manage: false,
        },
      });
    });
  });

  test('should load event detail page successfully and display core elements', async ({ page }) => {
    await page.goto(`/events/${MOCK_EVENT_ID}`);

    // Verify the page loads with a successful response
    const response = page.response();
    expect(response?.status()).toBeLessThan(400);

    // Verify navigation is present (global layout)
    const nav = page.locator('nav');
    await expect(nav).toBeVisible();

    // Verify event title is displayed
    const eventTitle = page.getByRole('heading', { name: MOCK_EVENT.title, level: 1 });
    await expect(eventTitle).toBeVisible();

    // Verify location is displayed
    const location = page.getByText(new RegExp(MOCK_EVENT.location.split('—')[0].trim()));
    await expect(location).toBeVisible();

    // Verify "Back to Archive" link is present
    const backLink = page.getByRole('link', { name: /back to archive/i });
    await expect(backLink).toBeVisible();
  });

  test('should display event date and time information', async ({ page }) => {
    await page.goto(`/events/${MOCK_EVENT_ID}`);

    // Verify start date is displayed (format: "EEEE, MMMM do, yyyy 'at' h:mm a")
    const startDateText = await page.locator('main').textContent();
    expect(startDateText).toContain('Start:');

    // Verify end date is displayed
    expect(startDateText).toContain('End:');

    // Verify "Location:" label is present
    expect(startDateText).toContain('Location:');
  });

  test('should display event description with rich text content', async ({ page }) => {
    await page.goto(`/events/${MOCK_EVENT_ID}`);

    // Verify the description content is rendered
    await expect(page.getByText('Join us for our season kickoff meeting!')).toBeVisible();
    await expect(page.getByText('Game reveal analysis')).toBeVisible();
    await expect(page.getByText('Team goals and objectives')).toBeVisible();
    await expect(page.getByText('Subteam assignments')).toBeVisible();
    await expect(page.getByText('Pizza and refreshments will be provided!')).toBeVisible();
  });

  test('should show "Upcoming Event" badge for future events', async ({ page }) => {
    await page.goto(`/events/${MOCK_EVENT_ID}`);

    // Verify the "Upcoming Event" badge is displayed for future events
    const upcomingBadge = page.getByText('UPCOMING EVENT');
    await expect(upcomingBadge).toBeVisible();

    // Verify "Add to Calendar" button is present for upcoming events
    const addToCalendarBtn = page.getByRole('button', { name: /add to calendar/i });
    await expect(addToCalendarBtn).toBeVisible();
  });

  test('should display cover image', async ({ page }) => {
    await page.goto(`/events/${MOCK_EVENT_ID}`);

    // Mock the image response to avoid 404
    await page.route(`**/images/events/kickoff.jpg`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'image/jpeg',
        body: Buffer.from('fake-image'),
      });
    });

    // Verify cover image is present
    const coverImage = page.locator('img[alt*="ARES 23247 Kickoff Meeting"]');
    await expect(coverImage).toBeVisible();
  });

  test('should handle past events correctly', async ({ page }) => {
    // Create a past event
    const pastEvent = {
      ...MOCK_EVENT,
      id: 'past-event-456',
      title: 'Past Team Meeting',
      date_start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days ago
      date_end: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000).toISOString(),
    };

    await page.route(`**/api/events/past-event-456`, async (route) => {
      await route.fulfill({
        status: 200,
        json: { event: pastEvent },
      });
    });

    await page.route(`**/api/events/past-event-456/signups`, async (route) => {
      await route.fulfill({
        status: 200,
        json: {
          signups: [],
          dietary_summary: null,
          team_dietary_summary: null,
          authenticated: false,
          role: null,
          member_type: null,
          can_manage: false,
        },
      });
    });

    await page.goto('/events/past-event-456');

    // Verify "Historical Record" badge for past events
    const historicalBadge = page.getByText('HISTORICAL RECORD');
    await expect(historicalBadge).toBeVisible();

    // Verify "Add to Calendar" button is NOT present for past events
    const addToCalendarBtn = page.getByRole('button', { name: /add to calendar/i });
    await expect(addToCalendarBtn).not.toBeVisible();
  });

  test('should handle invalid event ID gracefully', async ({ page }) => {
    await page.route('**/api/events/invalid-id', async (route) => {
      await route.fulfill({
        status: 404,
        json: { error: 'Event not found' },
      });
    });

    await page.goto('/events/invalid-id');

    // Verify error message is displayed
    await expect(page.getByText(/Event Record Erased or Unfound/i)).toBeVisible();
  });

  test('should handle plain text description (non-Tiptap format)', async ({ page }) => {
    const plainTextEvent = {
      ...MOCK_EVENT,
      id: 'plain-text-event',
      description: 'This is a plain text description without Tiptap formatting.',
    };

    await page.route(`**/api/events/plain-text-event`, async (route) => {
      await route.fulfill({
        status: 200,
        json: { event: plainTextEvent },
      });
    });

    await page.route(`**/api/events/plain-text-event/signups`, async (route) => {
      await route.fulfill({
        status: 200,
        json: {
          signups: [],
          dietary_summary: null,
          team_dietary_summary: null,
          authenticated: false,
          role: null,
          member_type: null,
          can_manage: false,
        },
      });
    });

    await page.goto('/events/plain-text-event');

    // Verify plain text description is displayed
    await expect(page.getByText('This is a plain text description without Tiptap formatting.')).toBeVisible();
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

    // Mock the image response to avoid 404 errors
    await page.route(`**/images/events/kickoff.jpg`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'image/jpeg',
        body: Buffer.from('fake-image'),
      });
    });

    await page.goto(`/events/${MOCK_EVENT_ID}`);

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
    await page.goto(`/events/${MOCK_EVENT_ID}`);

    // Verify the page has a main heading (h1)
    const h1 = page.locator('h1');
    await expect(h1).toBeVisible();
    await expect(h1).toContainText(MOCK_EVENT.title);

    // Verify the main content area is present
    const main = page.locator('main');
    await expect(main).toBeVisible();

    // Verify semantic navigation
    const nav = page.locator('nav');
    await expect(nav).toBeVisible();
  });

  test('should provide accessible link to Google Maps', async ({ page }) => {
    await page.goto(`/events/${MOCK_EVENT_ID}`);

    // Verify the location link has proper aria-label or sr-only text
    const mapsLink = page.getByRole('link', { name: /opens in google maps/i });
    await expect(mapsLink).toBeVisible();

    // Verify the link points to Google Maps
    const href = await mapsLink.getAttribute('href');
    expect(href).toContain('maps.google.com');
  });

  test('should render with proper SEO metadata', async ({ page }) => {
    await page.goto(`/events/${MOCK_EVENT_ID}`);

    // Verify page title includes event title
    await expect(page).toHaveTitle(/ARES 23247/i);

    // Verify meta description is set
    const metaDescription = await page.locator('meta[name="description"]').getAttribute('content');
    expect(metaDescription).toBeTruthy();
    expect(metaDescription?.length).toBeGreaterThan(0);
  });
});
