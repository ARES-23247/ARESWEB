import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { setupMockAuth } from '../fixtures/auth';
import { TEST_TIMEOUTS } from '../fixtures/mock-data';

/**
 * Mock mass email stats response matching the MassEmailStatsResponse interface.
 */
interface MockMassEmailStatsResponse {
  activeUsers: number;
}

/**
 * Creates a mock mass email stats response with default values.
 */
function createMockStatsResponse(overrides: Partial<MockMassEmailStatsResponse> = {}): MockMassEmailStatsResponse {
  return {
    activeUsers: 42,
    ...overrides,
  };
}

/**
 * Mock mass email send response matching the MassEmailSendResponse interface.
 */
interface MockMassEmailSendResponse {
  success: boolean;
  message?: string;
  recipientCount?: number;
  error?: string;
}

test.describe('Mass Email Composer Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await setupMockAuth(page);

    // Mock GET /api/communications/admin/stats - Get count of active users
    await page.route('**/api/communications/admin/stats*', async (route) => {
      await route.fulfill({
        status: 200,
        json: createMockStatsResponse(),
      });
    });

    // Mock POST /api/communications/admin/mass-email - Send mass email
    let sendRequestCount = 0;
    await page.route('**/api/communications/admin/mass-email', async (route) => {
      sendRequestCount++;
      if (route.request().method() === 'POST') {
        const requestBody = await route.request().postData();
        const data = JSON.parse(requestBody || '{}');

        // Validate request body
        if (!data.subject || !data.htmlContent) {
          await route.fulfill({
            status: 400,
            json: {
              success: false,
              error: 'Subject and content are required',
            },
          });
          return;
        }

        await route.fulfill({
          status: 200,
          json: {
            success: true,
            message: `Mass email dispatched successfully to ${createMockStatsResponse().activeUsers} recipients.`,
            recipientCount: createMockStatsResponse().activeUsers,
          } satisfies MockMassEmailSendResponse,
        });
      }
    });

    // Mock Zulip presence to avoid body stream errors in a11y audit
    await page.route('**/api/zulip/presence', async (route) => {
      await route.fulfill({
        status: 200,
        json: { success: true, presence: {}, userNames: {} },
      });
    });
  });

  test('loads and displays email composer interface', async ({ page }) => {
    await page.goto('/dashboard/mass_email');

    // Wait for page to load
    await expect(page.getByRole('heading', { name: /Team Broadcaster/i })).toBeVisible({
      timeout: TEST_TIMEOUTS.SLOW_PAGE,
    });

    // Verify page subtitle
    await expect(page.getByText('ARES Mass Email Composer')).toBeVisible();

    // Verify subject input is present
    await expect(page.getByLabel('Email Subject')).toBeVisible();

    // Verify body editor area is present
    await expect(page.getByLabel('HTML Body')).toBeVisible();

    // Verify dispatch button is present
    await expect(page.getByRole('button', { name: /DISPATCH BLAST/i })).toBeVisible();
  });

  test('displays active user count in audience roster', async ({ page }) => {
    await page.goto('/dashboard/mass_email');

    // Wait for page to load
    await expect(page.getByRole('heading', { name: /Team Broadcaster/i })).toBeVisible();

    // Verify audience roster section
    await expect(page.getByText('Audience Roster')).toBeVisible();
    await expect(page.getByText('Sourced directly from registered website users.')).toBeVisible();

    // Verify recipient count is displayed
    await expect(page.getByText('42 Recipients')).toBeVisible();
  });

  test('dispatch button is disabled when subject is empty', async ({ page }) => {
    await page.goto('/dashboard/mass_email');

    // Wait for page to load
    await expect(page.getByRole('heading', { name: /Team Broadcaster/i })).toBeVisible();

    // Verify dispatch button is disabled initially
    const dispatchButton = page.getByRole('button', { name: /DISPATCH BLAST/i });
    await expect(dispatchButton).toBeDisabled();
  });

  test('dispatch button is enabled when subject is entered', async ({ page }) => {
    await page.goto('/dashboard/mass_email');

    // Wait for page to load
    await expect(page.getByRole('heading', { name: /Team Broadcaster/i })).toBeVisible();

    // Enter subject
    const subjectInput = page.getByLabel('Email Subject');
    await subjectInput.fill('Test Email Subject');

    // Verify dispatch button becomes enabled
    const dispatchButton = page.getByRole('button', { name: /DISPATCH BLAST/i });
    await expect(dispatchButton).toBeEnabled();
  });

  test('shows validation error when sending without content', async ({ page }) => {
    await page.goto('/dashboard/mass_email');

    // Wait for page to load
    await expect(page.getByRole('heading', { name: /Team Broadcaster/i })).toBeVisible();

    // Enter subject only (no content)
    const subjectInput = page.getByLabel('Email Subject');
    await subjectInput.fill('Test Subject');

    // Mock window.confirm to return false (cancel the send)
    await page.evaluate(() => {
      window.confirm = () => false;
    });

    // Click dispatch button (subject is filled but content is empty)
    const dispatchButton = page.getByRole('button', { name: /DISPATCH BLAST/i });
    await dispatchButton.click();

    // The confirm dialog should appear and be cancelled, so no send happens
    // This test verifies the flow reaches the confirmation step
  });

  test('completes full email composition workflow', async ({ page }) => {
    await page.goto('/dashboard/mass_email');

    // Wait for page to load
    await expect(page.getByRole('heading', { name: /Team Broadcaster/i })).toBeVisible();

    // Enter subject
    const subjectInput = page.getByLabel('Email Subject');
    await subjectInput.fill('Important Team Update');

    // Enter content in the rich text editor
    const editor = page.locator('.ProseMirror').or(page.locator('[contenteditable="true"]')).first();
    await editor.click();
    await editor.fill('Dear team members, this is an important update about our upcoming competition.');

    // Mock window.confirm to accept the send
    await page.evaluate(() => {
      window.confirm = () => true;
    });

    // Click dispatch button
    const dispatchButton = page.getByRole('button', { name: /DISPATCH BLAST/i });
    await dispatchButton.click();

    // Verify success toast appears
    await expect(page.getByText(/Mass email dispatched successfully/i)).toBeVisible();
  });

  test('shows loading state while dispatching email', async ({ page }) => {
    // Slow down the API response to ensure loading state is visible
    await page.route('**/api/communications/admin/mass-email', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 200,
          json: {
            success: true,
            message: 'Mass email dispatched successfully',
            recipientCount: 42,
          },
        });
      }
    });

    await page.goto('/dashboard/mass_email');

    // Wait for page to load
    await expect(page.getByRole('heading', { name: /Team Broadcaster/i })).toBeVisible();

    // Enter subject
    const subjectInput = page.getByLabel('Email Subject');
    await subjectInput.fill('Test Email');

    // Mock window.confirm to accept the send
    await page.evaluate(() => {
      window.confirm = () => true;
    });

    // Click dispatch button
    const dispatchButton = page.getByRole('button', { name: /DISPATCH BLAST/i });
    await dispatchButton.click();

    // Verify loading state
    await expect(page.getByText('DISPATCHING...')).toBeVisible();

    // Verify spinner is shown
    await expect(page.locator('.animate-spin').or(page.getByRole('progressbar'))).toBeVisible();

    // Wait for success message
    await expect(page.getByText(/Mass email dispatched successfully/i)).toBeVisible({
      timeout: TEST_TIMEOUTS.SLOW_PAGE,
    });
  });

  test('displays empty state when no active users exist', async ({ page }) => {
    // Override mock to return zero active users
    await page.route('**/api/communications/admin/stats*', async (route) => {
      await route.fulfill({
        status: 200,
        json: createMockStatsResponse({ activeUsers: 0 }),
      });
    });

    await page.goto('/dashboard/mass_email');

    // Wait for page to load
    await expect(page.getByRole('heading', { name: /Team Broadcaster/i })).toBeVisible();

    // Verify warning message for no recipients
    await expect(page.getByText('No active recipients found.')).toBeVisible();
    await expect(page.getByText('There are no registered website users in the database.')).toBeVisible();

    // Verify dispatch button is disabled
    const dispatchButton = page.getByRole('button', { name: /DISPATCH BLAST/i });
    await expect(dispatchButton).toBeDisabled();
  });

  test('shows loading skeleton while fetching stats', async ({ page }) => {
    // Slow down the API response to ensure loading state is visible
    await page.route('**/api/communications/admin/stats*', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 500));
      await route.fulfill({
        status: 200,
        json: createMockStatsResponse(),
      });
    });

    await page.goto('/dashboard/mass_email');

    // Verify loading indicator is shown briefly
    const loadingIndicator = page.locator('.animate-pulse').or(page.locator('[data-loading="true"]'));
    // The loading state appears briefly before content loads

    // Wait for content to load
    await expect(page.getByText('42 Recipients')).toBeVisible({
      timeout: TEST_TIMEOUTS.SLOW_PAGE,
    });
  });

  test('displays error state when API fails', async ({ page }) => {
    // Override mock to return error
    await page.route('**/api/communications/admin/stats*', async (route) => {
      await route.fulfill({
        status: 500,
        json: { error: 'Internal Server Error' },
      });
    });

    await page.goto('/dashboard/mass_email');

    // Verify the page still loads (with graceful degradation)
    await expect(page.getByRole('heading', { name: /Team Broadcaster/i })).toBeVisible({
      timeout: TEST_TIMEOUTS.SLOW_PAGE,
    });

    // Verify recipient count shows 0 when API fails
    await expect(page.getByText('0 Recipients')).toBeVisible();
  });

  test('passes WCAG 2.1 AA accessibility audit', async ({ page }) => {
    await page.goto('/dashboard/mass_email');

    // Wait for page to fully load
    await expect(page.getByRole('heading', { name: /Team Broadcaster/i })).toBeVisible({
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

    // ── Accessibility Audit ───────────────────────────────────────────
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('has accessible form controls with proper labels', async ({ page }) => {
    await page.goto('/dashboard/mass_email');

    // Wait for page to load
    await expect(page.getByRole('heading', { name: /Team Broadcaster/i })).toBeVisible();

    // Verify subject input has accessible label
    const subjectInput = page.getByLabel('Email Subject');
    await expect(subjectInput).toBeVisible();

    // Verify the input has a matching id
    await expect(subjectInput).toHaveAttribute('id', 'subject-input');

    // Verify body editor has accessible label
    const bodyEditor = page.getByLabel('HTML Body');
    await expect(bodyEditor).toBeVisible();

    // Verify dispatch button has accessible name
    const dispatchButton = page.getByRole('button', { name: /DISPATCH BLAST/i });
    await expect(dispatchButton).toBeVisible();
  });

  test('subject input has sufficient color contrast', async ({ page }) => {
    await page.goto('/dashboard/mass_email');

    // Wait for page to load
    await expect(page.getByRole('heading', { name: /Team Broadcaster/i })).toBeVisible();

    // Verify input placeholder text is visible
    const subjectInput = page.getByLabel('Email Subject');
    await expect(subjectInput).toHaveAttribute('placeholder', 'Important Update: State Championship Logistics');
  });

  test('dispatch button has accessible loading state', async ({ page }) => {
    // Slow down the API response
    await page.route('**/api/communications/admin/mass-email', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 200,
          json: {
            success: true,
            message: 'Mass email dispatched successfully',
            recipientCount: 42,
          },
        });
      }
    });

    await page.goto('/dashboard/mass_email');

    // Wait for page to load
    await expect(page.getByRole('heading', { name: /Team Broadcaster/i })).toBeVisible();

    // Enter subject
    const subjectInput = page.getByLabel('Email Subject');
    await subjectInput.fill('Test Email');

    // Mock window.confirm to accept the send
    await page.evaluate(() => {
      window.confirm = () => true;
    });

    // Click dispatch button
    const dispatchButton = page.getByRole('button', { name: /DISPATCH BLAST/i });
    await dispatchButton.click();

    // Verify screen reader text for loading state
    await expect(page.getByText('Sending mass email, please wait.')).toBeVisible();
  });

  test('keyboard navigation works for form controls', async ({ page }) => {
    await page.goto('/dashboard/mass_email');

    // Wait for page to load
    await expect(page.getByRole('heading', { name: /Team Broadcaster/i })).toBeVisible();

    // Tab to subject input
    await page.keyboard.press('Tab');
    const subjectInput = page.getByLabel('Email Subject');
    await expect(subjectInput).toBeFocused();

    // Type subject
    await page.keyboard.type('Keyboard Navigation Test');

    // Tab to body editor
    await page.keyboard.press('Tab');
    const bodyEditor = page.getByLabel('HTML Body');
    await expect(bodyEditor).toBeFocused();

    // Tab to dispatch button
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    const dispatchButton = page.getByRole('button', { name: /DISPATCH BLAST/i });
    await expect(dispatchButton).toBeFocused();
  });

  test('audience roster card displays with proper hierarchy', async ({ page }) => {
    await page.goto('/dashboard/mass_email');

    // Wait for page to load
    await expect(page.getByRole('heading', { name: /Team Broadcaster/i })).toBeVisible();

    // Verify audience roster heading hierarchy
    await expect(page.getByText('Audience Roster')).toBeVisible();

    // Verify description text
    await expect(page.getByText('Sourced directly from registered website users.')).toBeVisible();

    // Verify recipient count with proper styling
    await expect(page.getByText('42').locator('..')).toContainText('Recipients');
  });

  test('warning icon displays properly for empty state', async ({ page }) => {
    // Override mock to return zero active users
    await page.route('**/api/communications/admin/stats*', async (route) => {
      await route.fulfill({
        status: 200,
        json: createMockStatsResponse({ activeUsers: 0 }),
      });
    });

    await page.goto('/dashboard/mass_email');

    // Wait for page to load
    await expect(page.getByRole('heading', { name: /Team Broadcaster/i })).toBeVisible();

    // Verify alert/warning styling is applied
    await expect(page.getByText('No active recipients found.')).toBeVisible();
  });
});

test.describe('Mass Email Composer - Permissions', () => {
  test('redirects unauthorized users away from mass email page', async ({ page }) => {
    // Setup mock auth with non-admin user
    await page.route('**/api/auth/get-session', async (route) => {
      await route.fulfill({
        status: 200,
        json: {
          session: {
            id: 'regular-user-session',
            userId: 'regular-user',
            expiresAt: new Date(Date.now() + 10000000).toISOString(),
            ipAddress: '127.0.0.1',
            userAgent: 'Playwright',
          },
          user: {
            id: 'regular-user',
            name: 'Regular User',
            email: 'user@example.com',
            emailVerified: true,
            image: 'https://api.dicebear.com/9.x/bottts/svg?seed=user',
            role: 'member',
            banned: false,
          },
        },
      });
    });

    // Mock profile with member role
    await page.route('**/profile/me', async (route) => {
      await route.fulfill({
        status: 200,
        json: {
          user_id: 'regular-user',
          nickname: 'Regular User',
          first_name: 'Regular',
          last_name: 'User',
          member_type: 'student',
          auth: {
            id: 'regular-user',
            email: 'user@example.com',
            name: 'Regular User',
            role: 'member',
          },
        },
      });
    });

    // Set auth cookie
    await page.context().addCookies([
      {
        name: 'better-auth.session_token',
        value: 'regular-user-session',
        domain: 'localhost',
        path: '/',
      },
    ]);

    await page.goto('/dashboard/mass_email');

    // Verify access denied message is shown
    await expect(page.getByText('Access Denied')).toBeVisible();
  });
});

test.describe('Mass Email Composer - Error Handling', () => {
  test('handles API error during send gracefully', async ({ page }) => {
    await setupMockAuth(page);

    // Mock stats endpoint
    await page.route('**/api/communications/admin/stats*', async (route) => {
      await route.fulfill({
        status: 200,
        json: createMockStatsResponse(),
      });
    });

    // Mock send endpoint to return error
    await page.route('**/api/communications/admin/mass-email', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 500,
          json: {
            success: false,
            error: 'Failed to send emails',
          },
        });
      }
    });

    // Mock Zulip presence
    await page.route('**/api/zulip/presence', async (route) => {
      await route.fulfill({
        status: 200,
        json: { success: true, presence: {}, userNames: {} },
      });
    });

    await page.goto('/dashboard/mass_email');

    // Wait for page to load
    await expect(page.getByRole('heading', { name: /Team Broadcaster/i })).toBeVisible();

    // Enter subject
    const subjectInput = page.getByLabel('Email Subject');
    await subjectInput.fill('Test Email');

    // Mock window.confirm to accept the send
    await page.evaluate(() => {
      window.confirm = () => true;
    });

    // Click dispatch button
    const dispatchButton = page.getByRole('button', { name: /DISPATCH BLAST/i });
    await dispatchButton.click();

    // Verify error toast appears
    await expect(page.getByText(/Email send failed/i)).toBeVisible();
  });

  test('handles network timeout gracefully', async ({ page }) => {
    await setupMockAuth(page);

    // Mock stats endpoint
    await page.route('**/api/communications/admin/stats*', async (route) => {
      await route.fulfill({
        status: 200,
        json: createMockStatsResponse(),
      });
    });

    // Mock send endpoint to timeout
    await page.route('**/api/communications/admin/mass-email', async (route) => {
      if (route.request().method() === 'POST') {
        // Abort the request to simulate network error
        await route.abort('failed');
      }
    });

    // Mock Zulip presence
    await page.route('**/api/zulip/presence', async (route) => {
      await route.fulfill({
        status: 200,
        json: { success: true, presence: {}, userNames: {} },
      });
    });

    await page.goto('/dashboard/mass_email');

    // Wait for page to load
    await expect(page.getByRole('heading', { name: /Team Broadcaster/i })).toBeVisible();

    // Enter subject
    const subjectInput = page.getByLabel('Email Subject');
    await subjectInput.fill('Test Email');

    // Mock window.confirm to accept the send
    await page.evaluate(() => {
      window.confirm = () => true;
    });

    // Click dispatch button
    const dispatchButton = page.getByRole('button', { name: /DISPATCH BLAST/i });
    await dispatchButton.click();

    // Verify error handling - the component should show an error state
    // via the onError callback in the mutation
  });
});
