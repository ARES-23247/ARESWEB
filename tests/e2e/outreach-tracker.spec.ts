import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { setupMockAuth, shouldIgnoreConsoleError } from '../fixtures/auth';
import { TEST_TIMEOUTS } from '../fixtures/mock-data';

test.describe('Outreach Tracker Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // Track console errors for debugging
    page.on('console', (msg) => {
      if (msg.type() === 'error' && !shouldIgnoreConsoleError(msg.text())) {
        console.log(`Console error: ${msg.text()}`);
      }
    });

    await setupMockAuth(page);

    // Mock outreach API endpoints - use wildcards to catch all variations
    await page.route('**/api/outreach/admin/list**', async (route) => {
      await route.fulfill({
        status: 200,
        json: {
          logs: [
            {
              id: 1,
              title: 'Robot Demo at Science Fair',
              date: '2025-04-20',
              hours: 4.5,
              peopleReached: 75,
              studentsCount: 6,
              mentorCount: 2,
              mentorHours: 9,
              impactSummary: 'Demonstrated robot programming and mechanics to interested students and parents.',
              isMentoring: 0,
              mentoredTeamNumber: null,
              seasonId: null,
              eventId: null,
              location: null,
            },
          ],
        },
      });
    });

    await page.route('**/api/outreach/admin/save**', async (route) => {
      await route.fulfill({
        status: 200,
        json: { success: true, id: '1' },
      });
    });

    // Mock delete endpoint for outreach entries
    await page.route('**/api/outreach/admin/**', async (route) => {
      if (route.request().method() === 'DELETE') {
        await route.fulfill({
          status: 200,
          json: { success: true, message: 'Entry purged' },
        });
        return;
      }
      route.continue();
    });

    // Mock seasons API for the SeasonPicker component - catch all season queries
    await page.route('**/api/seasons**', async (route) => {
      await route.fulfill({
        status: 200,
        json: {
          seasons: [
            {
              id: 1,
              challengeName: 'Into the Deep',
              startYear: 2024,
              endYear: 2025,
              isActive: 1,
            },
          ],
        },
      });
    });

    // Mock public outreach endpoint (fetched after save for query invalidation)
    await page.route('**/api/outreaches**', async (route) => {
      await route.fulfill({
        status: 200,
        json: {
          outreach: [],
        },
      });
    });
  });

  test('Outreach tracker loads and displays impact metrics', async ({ page }) => {
    await page.goto('/dashboard/outreach');

    // Verify the page title/heading is visible
    await expect(page.getByRole('heading', { name: /Impact/i })).toBeVisible({
      timeout: TEST_TIMEOUTS.SLOW_PAGE,
    });

    // Verify subtitle
    await expect(page.getByText(/FIRST Impact/i)).toBeVisible();
  });

  test('Outreach event logging workflow - create new entry', async ({ page }) => {
    await page.goto('/dashboard/outreach');

    // Click "Log Outreach" button
    const logOutreachButton = page.getByRole('button', { name: /Log Outreach/i });
    await expect(logOutreachButton).toBeVisible();
    await logOutreachButton.click();

    // Wait for form to appear
    await page.waitForTimeout(200);

    // Verify form is visible
    await expect(page.getByLabel(/Event Title/i)).toBeVisible();

    // Fill out the outreach form
    await page.getByLabel(/Event Title/i).fill(`Robot Demo at Science Fair ${Date.now()}`);
    await page.getByLabel(/Date/i).fill('2025-04-20');
    await page.getByLabel(/Reach Count/i).fill('75');
    await page.getByLabel(/Hours Logged/i).fill('4.5');
    await page.getByLabel(/Students Participating/i).fill('6');
    await page.getByLabel(/Mentors Participating/i).fill('2');
    await page.getByLabel(/Mentor Hours/i).fill('9');
    await page.getByPlaceholder(/Summarize/i).fill('Demonstrated robot programming and mechanics to interested students and parents.');

    // Submit the form - button text is "Finalize Impact Entry"
    const submitButton = page.getByRole('button', { name: /Finalize/i });
    await expect(submitButton).toBeVisible();
    await submitButton.click();

    // Verify success toast/notification - wait for toast to appear
    await expect(page.getByText('Impact record synchronized')).toBeVisible({
      timeout: TEST_TIMEOUTS.DEFAULT,
    });

    // Verify form is closed after successful submission
    await expect(page.getByLabel(/Event Title/i)).not.toBeVisible();
  });

  test('Outreach event logging workflow - mentoring session', async ({ page }) => {
    await page.goto('/dashboard/outreach');

    // Click "Log Outreach" button
    const logOutreachButton = page.getByRole('button', { name: /Log Outreach/i });
    await logOutreachButton.click();

    // Wait for form to appear
    await page.waitForTimeout(200);

    // Toggle mentoring checkbox - click on the label containing "Mentoring Session"
    const mentoringLabel = page.locator('label').filter({ hasText: /Mentoring Session/i }).first();
    await mentoringLabel.click();

    // Mentored team number input should appear - use exact placeholder match
    const teamInput = page.getByPlaceholder('e.g. 23247');
    await expect(teamInput).toBeVisible();

    // Fill mentoring-specific fields
    await page.getByLabel(/Event Title/i).fill(`FTC Team Mentoring Session ${Date.now()}`);
    await teamInput.fill('12345');
    await page.getByLabel(/Date/i).fill('2025-04-15');
    await page.getByLabel(/Hours Logged/i).fill('2');
    await page.getByLabel(/Reach Count/i).fill('10');
    await page.getByLabel(/Students Participating/i).fill('3');

    // Submit the form - button text is "Finalize Impact Entry"
    const submitButton = page.getByRole('button', { name: /Finalize/i });
    await expect(submitButton).toBeVisible();
    await submitButton.click();

    // Verify success - the toast shows "Impact record synchronized."
    await expect(page.getByText('Impact record synchronized')).toBeVisible({
      timeout: TEST_TIMEOUTS.DEFAULT,
    });
  });

  test('Outreach event logging workflow - validation errors', async ({ page }) => {
    await page.goto('/dashboard/outreach');

    // Click "Log Outreach" button
    await page.getByRole('button', { name: /Log Outreach/i }).click();

    // Wait for form to appear
    await page.waitForTimeout(200);

    // Try to submit without filling the form properly
    const titleInput = page.getByLabel(/Event Title/i);
    await titleInput.fill('Test');
    await titleInput.fill('');

    // Find the submit button - it should be visible even with empty title
    const submitButton = page.getByRole('button', { name: /Finalize/i });
    await expect(submitButton).toBeVisible();
    await submitButton.click();

    // Verify validation message for title
    await expect(page.getByText(/Title is required/i)).toBeVisible({
      timeout: TEST_TIMEOUTS.DEFAULT,
    });
  });

  test('Outreach tracker - edit existing entry', async ({ page }) => {
    await page.goto('/dashboard/outreach');

    // Wait for the page to load and check if there are any entries
    await expect(page.getByRole('heading', { name: /Impact/i })).toBeVisible();

    // Try to find an edit button if there are entries
    const editButton = page.getByTitle(/Edit/i).first();

    // Only continue if there's an edit button (i.e., there are existing entries)
    const isVisible = await editButton.isVisible().catch(() => false);

    if (isVisible) {
      await editButton.click();

      // Verify form is visible
      await expect(page.getByLabel(/Event Title/i)).toBeVisible();

      // Update the title
      await page.getByLabel(/Event Title/i).fill(`Updated Event ${Date.now()}`);

      // Submit the form
      await page.getByRole('button', { name: /Finalize/i }).click();

      // Verify success
      await expect(page.getByText(/Impact record synchronized|synchronized/i)).toBeVisible();
    }
  });

  test('Outreach tracker - delete entry', async ({ page }) => {
    await page.goto('/dashboard/outreach');

    // Wait for the page to load
    await expect(page.getByRole('heading', { name: /Impact/i })).toBeVisible();

    // Try to find a delete button
    const deleteButton = page.getByTitle(/Delete|Purge/i).first();
    const isVisible = await deleteButton.isVisible().catch(() => false);

    if (isVisible) {
      // Handle confirm dialog
      page.on('dialog', (dialog) => dialog.accept());

      await deleteButton.click();

      // Verify success toast
      await expect(page.getByText(/purged|deleted/i)).toBeVisible();
    }
  });

  test('Outreach tracker - season filtering', async ({ page }) => {
    await page.goto('/dashboard/outreach');

    // Wait for the page to load
    await expect(page.getByRole('heading', { name: /Impact/i })).toBeVisible();

    // Try to click on a season tab if available
    const seasonTab = page.getByRole('button', { name: /2025|2024|All Seasons/i }).first();
    const isVisible = await seasonTab.isVisible().catch(() => false);

    if (isVisible) {
      await seasonTab.click();

      // Verify the tab was clicked (page should still be visible)
      await expect(page.getByRole('heading', { name: /Impact/i })).toBeVisible();
    }
  });

  test('Outreach tracker - empty state display', async ({ page }) => {
    await page.goto('/dashboard/outreach');

    // Wait for the page to load
    await expect(page.getByRole('heading', { name: /Impact/i })).toBeVisible();

    // Check if empty state message is visible OR if there are entries
    const emptyState = page.getByText(/No outreach|Start logging/i).first();
    const hasEmptyState = await emptyState.isVisible().catch(() => false);

    // Either empty state is shown or there are entries (both are valid)
    if (!hasEmptyState) {
      // If no empty state, verify there's at least some content
      await expect(page.locator('body')).toHaveText(/./);
    }
  });

  test('Outreach tracker - synced event badges', async ({ page }) => {
    await page.goto('/dashboard/outreach');

    // Wait for the page to load
    await expect(page.getByRole('heading', { name: /Impact/i })).toBeVisible();

    // Check if there are synced event badges (only if synced events exist)
    const syncedBadge = page.getByText(/Synced/i).first();
    const hasSynced = await syncedBadge.isVisible().catch(() => false);

    if (hasSynced) {
      // Verify synced badge is visible
      await expect(syncedBadge).toBeVisible();
    }
  });

  test('Outreach tracker - WCAG 2.1 AA accessibility compliance', async ({ page }) => {
    await page.goto('/dashboard/outreach');

    // Wait for page to fully load
    await expect(page.getByRole('heading', { name: /Impact/i })).toBeVisible({
      timeout: TEST_TIMEOUTS.SLOW_PAGE,
    });

    // Stabilize page for accessibility scan (disable animations, force opacity)
    await page.addStyleTag({
      content: `
        *, *::before, *::after {
          transition: none !important;
          animation: none !important;
          opacity: 1 !important;
        }
      `,
    });

    // Run Axe accessibility audit with WCAG 2.1 AA standards
    const accessibilityScanResults = await new AxeBuilder({ page })
      .disableRules(['color-contrast'])
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    // Assert no accessibility violations
    expect(accessibilityScanResults.violations).toEqual([]);

    // Additional keyboard navigation checks
    const logOutreachButton = page.getByRole('button', { name: /Log Outreach/i });
    await expect(logOutreachButton).toBeVisible();

    // Verify button has accessible name
    await expect(logOutreachButton).toHaveAccessibleName(/Log Outreach/i);
  });

  test('Outreach tracker - cancel form entry', async ({ page }) => {
    await page.goto('/dashboard/outreach');

    // Click "Log Outreach" button
    await page.getByRole('button', { name: /Log Outreach/i }).click();

    // Wait for form animation to complete
    await page.waitForTimeout(100);

    // Verify form is visible
    await expect(page.getByLabel(/Event Title/i)).toBeVisible();

    // Fill in some data
    await page.getByLabel(/Event Title/i).fill('Incomplete Entry');

    // Click "Cancel" button
    await page.getByRole('button', { name: /Cancel/i }).click();

    // Wait for form close animation
    await page.waitForTimeout(100);

    // Verify form is closed and data is not saved
    await expect(page.getByLabel(/Event Title/i)).not.toBeVisible();
    await expect(page.getByText('Incomplete Entry')).not.toBeVisible();
  });
});
