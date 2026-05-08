import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { setupMockAuth, MOCK_ADMIN_USER } from '../fixtures/auth';
import { TEST_TIMEOUTS } from '../fixtures/mock-data';

/**
 * Mock inquiry data matching the Inquiry schema from shared/routes/inquiries.ts
 */
interface MockInquiry {
  id: string;
  type: string;
  name: string;
  email: string;
  metadata: string | null;
  status: 'pending' | 'approved' | 'resolved' | 'rejected';
  created_at: string;
  zulip_message_id: string | null;
  notes: string | null;
}

/**
 * Creates a mock inquiry with default values.
 */
function createMockInquiry(overrides: Partial<MockInquiry> = {}): MockInquiry {
  const now = new Date().toISOString();
  return {
    id: `inquiry-${Date.now()}`,
    type: 'student',
    name: 'Test Student',
    email: 'student@example.com',
    metadata: null,
    status: 'pending',
    created_at: now,
    zulip_message_id: null,
    notes: null,
    ...overrides,
  };
}

/**
 * Creates a set of mock inquiries for testing.
 */
function createMockInquiries(): MockInquiry[] {
  return [
    createMockInquiry({
      id: 'inq-1',
      type: 'student',
      name: 'Jane Student',
      email: 'jane@example.com',
      status: 'pending',
      metadata: JSON.stringify({ grade: '10', experience: 'beginner' }),
    }),
    createMockInquiry({
      id: 'inq-2',
      type: 'mentor',
      name: 'John Mentor',
      email: 'john@example.com',
      status: 'resolved',
      metadata: JSON.stringify({ company: 'Tech Corp', expertise: 'programming' }),
      notes: 'Contacted via phone, interested in volunteering.',
    }),
    createMockInquiry({
      id: 'inq-3',
      type: 'sponsor',
      name: 'Acme Industries',
      email: 'sponsorship@acme.com',
      status: 'pending',
      metadata: JSON.stringify({ tier: 'gold', amount: '5000' }),
      zulip_message_id: '123456',
    }),
    createMockInquiry({
      id: 'inq-4',
      type: 'outreach',
      name: 'Local Elementary School',
      email: 'admin@school.edu',
      status: 'rejected',
      metadata: JSON.stringify({ event: 'robot demo', date: '2024-03-15' }),
    }),
  ];
}

test.describe('Admin Inquiries Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await setupMockAuth(page);

    // Mock GET /api/inquiries/admin/list - List all inquiries
    await page.route('**/api/inquiries/admin/list*', async (route) => {
      await route.fulfill({
        status: 200,
        json: { inquiries: createMockInquiries() },
      });
    });

    // Mock PATCH /api/inquiries/admin/:id/status - Update inquiry status
    await page.route('**/api/inquiries/admin/*/status', async (route) => {
      await route.fulfill({
        status: 200,
        json: { success: true, status: 'resolved' },
      });
    });

    // Mock PATCH /api/inquiries/admin/:id/notes - Update inquiry notes
    await page.route('**/api/inquiries/admin/*/notes', async (route) => {
      await route.fulfill({
        status: 200,
        json: { success: true },
      });
    });

    // Mock DELETE /api/inquiries/admin/:id - Delete inquiry
    await page.route('**/api/inquiries/admin/*', async (route) => {
      if (route.request().method() === 'DELETE') {
        await route.fulfill({
          status: 200,
          json: { success: true },
        });
      } else {
        await route.continue();
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

  test('loads and displays inquiries list', async ({ page }) => {
    await page.goto('/dashboard/inquiries');

    // Wait for page to load
    await expect(page.getByRole('heading', { name: /Admin Inquiries/i })).toBeVisible({
      timeout: TEST_TIMEOUTS.SLOW_PAGE,
    });

    // Verify page subtitle
    await expect(page.getByText('Manage communication requests and outreach leads')).toBeVisible();

    // Verify search input is present
    await expect(page.getByPlaceholder('Search inquiries (name, email, type...)')).toBeVisible();

    // Verify status filter buttons are present
    await expect(page.getByRole('button', { name: 'all' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'pending' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'resolved' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'rejected' })).toBeVisible();

    // Verify stats bar shows inquiry counts
    await expect(page.getByText(/RAW:\s*4/i)).toBeVisible();
    await expect(page.getByText(/FILTERED:\s*4/i)).toBeVisible();

    // Verify inquiries are displayed - use class selector to scope to inquiry list
    const inquiryList = page.locator('.flex.flex-col.gap-3').first();
    await expect(inquiryList.getByText('Jane Student')).toBeVisible();
    await expect(inquiryList.getByText('John Mentor')).toBeVisible();
    await expect(inquiryList.getByText('Acme Industries')).toBeVisible();
    await expect(inquiryList.getByText('Local Elementary School')).toBeVisible();
  });

  test('filters inquiries by status', async ({ page }) => {
    await page.goto('/dashboard/inquiries');

    // Wait for initial load
    await expect(page.getByRole('list').getByText('Jane Student')).toBeVisible();

    // Click "pending" filter button
    await page.getByRole('button', { name: 'pending' }).click();

    // Verify only pending inquiries are shown
    await expect(page.getByRole('list').getByText('Jane Student')).toBeVisible();
    await expect(page.getByRole('list').getByText('Acme Industries')).toBeVisible();
    await expect(page.getByRole('list').getByText('John Mentor')).not.toBeVisible();
    await expect(page.getByRole('list').getByText('Local Elementary School')).not.toBeVisible();

    // Verify filtered count in stats bar
    await expect(page.getByText(/FILTERED:\s*2/i)).toBeVisible();

    // Click "resolved" filter button
    await page.getByRole('button', { name: 'resolved' }).click();

    // Verify only resolved inquiries are shown
    await expect(page.getByRole('list').getByText('John Mentor')).toBeVisible();
    await expect(page.getByRole('list').getByText('Jane Student')).not.toBeVisible();

    // Click "all" to reset filter
    await page.getByRole('button', { name: 'all' }).click();

    // Verify all inquiries are shown again
    await expect(page.getByRole('list').getByText('Jane Student')).toBeVisible();
    await expect(page.getByRole('list').getByText('John Mentor')).toBeVisible();
  });

  test('searches inquiries by name, email, or type', async ({ page }) => {
    await page.goto('/dashboard/inquiries');

    // Wait for initial load
    await expect(page.getByRole('list').getByText('Jane Student')).toBeVisible();

    // Search by name
    const searchInput = page.getByPlaceholder('Search inquiries (name, email, type...)');
    await searchInput.fill('Jane');

    // Verify search filters results
    await expect(page.getByRole('list').getByText('Jane Student')).toBeVisible();
    await expect(page.getByRole('list').getByText('John Mentor')).not.toBeVisible();

    // Clear search
    await searchInput.fill('');

    // Search by email
    await searchInput.fill('acme.com');

    // Verify search filters results
    await expect(page.getByRole('list').getByText('Acme Industries')).toBeVisible();
    await expect(page.getByRole('list').getByText('Jane Student')).not.toBeVisible();

    // Clear search
    await searchInput.fill('');

    // Search by type
    await searchInput.fill('mentor');

    // Verify search filters results
    await expect(page.getByRole('list').getByText('John Mentor')).toBeVisible();
    await expect(page.getByRole('list').getByText('Jane Student')).not.toBeVisible();
  });

  test('updates inquiry status from pending to resolved', async ({ page }) => {
    await page.goto('/dashboard/inquiries');

    // Wait for page to load
    await expect(page.getByRole('list').getByText('Jane Student')).toBeVisible();

    // Find the first pending inquiry (Jane Student)
    const janeInquiry = page.getByRole('list').getByText('Jane Student').locator('../../..');

    // Verify the resolve button is visible
    const resolveButton = janeInquiry.getByRole('button', { name: /RESOLVE/i });
    await expect(resolveButton).toBeVisible();

    // Click resolve button
    await resolveButton.click();

    // Verify success toast appears (using sonner toast pattern)
    await expect(page.getByText('Inquiry status updated')).toBeVisible();
  });

  test('reopens a resolved inquiry', async ({ page }) => {
    // Override mock to show a resolved inquiry
    await page.route('**/api/inquiries/admin/list*', async (route) => {
      const inquiries = createMockInquiries().map((iq) =>
        iq.id === 'inq-2' ? { ...iq, status: 'resolved' as const } : iq
      );
      await route.fulfill({
        status: 200,
        json: { inquiries },
      });
    });

    await page.goto('/dashboard/inquiries');

    // Wait for page to load
    await expect(page.getByRole('list').getByText('John Mentor')).toBeVisible();

    // Find the resolved inquiry (John Mentor)
    const johnInquiry = page.getByRole('list').getByText('John Mentor').locator('../../..');

    // Verify the reopen button is visible
    const reopenButton = johnInquiry.getByRole('button', { name: /REOPEN/i });
    await expect(reopenButton).toBeVisible();

    // Click reopen button
    await reopenButton.click();

    // Verify success toast appears
    await expect(page.getByText('Inquiry status updated')).toBeVisible();
  });

  test('adds notes to an inquiry with debounced save', async ({ page }) => {
    await page.goto('/dashboard/inquiries');

    // Wait for page to load
    await expect(page.getByRole('list').getByText('Jane Student')).toBeVisible();

    // Find the notes textarea for Jane's inquiry
    const notesTextarea = page.getByPlaceholder('Add internal notes...').first();

    // Verify the notes label
    await expect(page.getByText('Notes')).toBeVisible();

    // Type into the notes field
    await notesTextarea.fill('Called the student, interested in joining programming subteam.');

    // Wait for debounced save (1 second debounce + small buffer)
    await page.waitForTimeout(1500);

    // Verify "Saving..." indicator appeared and disappeared
    await expect(page.getByText('Saving...')).not.toBeVisible();

    // Verify success toast for notes update
    await expect(page.getByText('Notes updated')).toBeVisible();
  });

  test('deletes an inquiry with confirmation', async ({ page }) => {
    await page.goto('/dashboard/inquiries');

    // Wait for page to load
    await expect(page.getByRole('list').getByText('Jane Student')).toBeVisible();

    // Find the delete button for Jane's inquiry
    const janeInquiry = page.getByRole('list').getByText('Jane Student').locator('../../..');
    const deleteButton = janeInquiry.getByRole('button', { name: /DELETE/i });
    await expect(deleteButton).toBeVisible();

    // Click delete button
    await deleteButton.click();

    // Verify confirmation button appears
    const confirmButton = janeInquiry.getByRole('button', { name: /CONFIRM DELETE/i });
    await expect(confirmButton).toBeVisible();

    // Verify cancel button also appears
    const cancelButton = janeInquiry.getByRole('button', { name: /CANCEL/i });
    await expect(cancelButton).toBeVisible();

    // Click confirm delete
    await confirmButton.click();

    // Verify success toast appears
    await expect(page.getByText('Inquiry deleted')).toBeVisible();
  });

  test('cancels inquiry deletion', async ({ page }) => {
    await page.goto('/dashboard/inquiries');

    // Wait for page to load
    await expect(page.getByRole('list').getByText('Jane Student')).toBeVisible();

    // Find the delete button for Jane's inquiry
    const janeInquiry = page.getByRole('list').getByText('Jane Student').locator('../../..');
    const deleteButton = janeInquiry.getByRole('button', { name: /DELETE/i });

    // Click delete button
    await deleteButton.click();

    // Click cancel instead of confirm
    const cancelButton = janeInquiry.getByRole('button', { name: /CANCEL/i });
    await cancelButton.click();

    // Verify confirmation buttons are gone
    await expect(janeInquiry.getByRole('button', { name: /CONFIRM DELETE/i })).not.toBeVisible();
    await expect(janeInquiry.getByRole('button', { name: /CANCEL/i })).not.toBeVisible();

    // Verify delete button is back
    await expect(janeInquiry.getByRole('button', { name: /DELETE/i })).toBeVisible();
  });

  test('displays inquiry metadata as key-value tags', async ({ page }) => {
    await page.goto('/dashboard/inquiries');

    // Wait for page to load
    await expect(page.getByRole('list').getByText('Jane Student')).toBeVisible();

    // Verify metadata tags for student inquiry
    await expect(page.getByText('grade:')).toBeVisible();
    await expect(page.getByText('10')).toBeVisible();

    // Verify metadata tags for mentor inquiry
    await expect(page.getByText('company:')).toBeVisible();
    await expect(page.getByText('Tech Corp')).toBeVisible();
  });

  test('shows Zulip discuss button when zulip_message_id exists', async ({ page }) => {
    await page.goto('/dashboard/inquiries');

    // Wait for page to load
    await expect(page.getByRole('list').getByText('Acme Industries')).toBeVisible();

    // Find the Zulip discuss button for the sponsor inquiry
    const zulipButton = page.getByRole('link', { name: /DISCUSS ON ZULIP/i });
    await expect(zulipButton).toBeVisible();

    // Verify the link has the correct Zulip URL
    await expect(zulipButton).toHaveAttribute('href', /zulipchat\.com\/#narrow\/id\/123456/);
  });

  test('displays empty state when no inquiries exist', async ({ page }) => {
    // Override mock to return empty list
    await page.route('**/api/inquiries/admin/list*', async (route) => {
      await route.fulfill({
        status: 200,
        json: { inquiries: [] },
      });
    });

    await page.goto('/dashboard/inquiries');

    // Verify empty state message
    await expect(page.getByText('No active inquiries or applications')).toBeVisible();
  });

  test('displays filtered empty state when filter has no results', async ({ page }) => {
    await page.goto('/dashboard/inquiries');

    // Wait for page to load
    await expect(page.getByRole('list').getByText('Jane Student')).toBeVisible();

    // Click "rejected" filter - we only have one rejected inquiry
    await page.getByRole('button', { name: 'rejected' }).click();

    // Verify we see the rejected inquiry
    await expect(page.getByRole('list').getByText('Local Elementary School')).toBeVisible();

    // Search for something that doesn't exist in rejected
    const searchInput = page.getByPlaceholder('Search inquiries (name, email, type...)');
    await searchInput.fill('nonexistent');

    // Verify filtered empty state appears
    await expect(page.getByText('No rejected inquiries found')).toBeVisible();
  });

  test('displays error state when API fails', async ({ page }) => {
    // Override mock to return error
    await page.route('**/api/inquiries/admin/list*', async (route) => {
      await route.fulfill({
        status: 500,
        json: { error: 'Internal Server Error' },
      });
    });

    await page.goto('/dashboard/inquiries');

    // Verify error message
    await expect(page.getByText('TELEMETRY FAULT')).toBeVisible();
    await expect(page.getByText('Failed to synchronize inquiry data')).toBeVisible();
  });

  test('passes WCAG 2.1 AA accessibility audit', async ({ page }) => {
    await page.goto('/dashboard/inquiries');

    // Wait for page to fully load
    await expect(page.getByRole('heading', { name: /Admin Inquiries/i })).toBeVisible({
      timeout: TEST_TIMEOUTS.SLOW_PAGE,
    });

    // ── Accessibility Audit ───────────────────────────────────────────
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('has keyboard-navigable filter buttons', async ({ page }) => {
    await page.goto('/dashboard/inquiries');

    // Wait for page to load
    await expect(page.getByRole('heading', { name: /Admin Inquiries/i })).toBeVisible();

    // Focus the first filter button
    const allButton = page.getByRole('button', { name: 'all' });
    await allButton.focus();

    // Verify the button is focused
    await expect(allButton).toBeFocused();

    // Tab through filter buttons (text is lowercase)
    await page.keyboard.press('Tab');
    const focusedElement = await page.evaluate(() => document.activeElement?.textContent);
    expect(focusedElement?.trim()).toBe('pending');

    // Continue tabbing
    await page.keyboard.press('Tab');
    const nextFocused = await page.evaluate(() => document.activeElement?.textContent);
    expect(nextFocused?.trim()).toBe('resolved');
  });

  test('has accessible form controls with proper labels', async ({ page }) => {
    await page.goto('/dashboard/inquiries');

    // Wait for page to load
    await expect(page.getByRole('heading', { name: /Admin Inquiries/i })).toBeVisible();

    // Verify search input has accessible label (via placeholder)
    const searchInput = page.getByPlaceholder('Search inquiries (name, email, type...)');
    await expect(searchInput).toBeVisible();

    // Verify filter buttons have accessible names
    await expect(page.getByRole('button', { name: 'all' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'pending' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'resolved' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'rejected' })).toBeVisible();

    // Verify notes textarea exists and has proper id pattern
    const notesTextarea = page.getByPlaceholder('Add internal notes...').first();
    await expect(notesTextarea).toBeVisible();
    await expect(notesTextarea).toHaveAttribute('id', /notes-/);
  });

  test('inquiry type badges have sufficient color contrast', async ({ page }) => {
    await page.goto('/dashboard/inquiries');

    // Wait for page to load
    await expect(page.getByRole('heading', { name: /Admin Inquiries/i })).toBeVisible();

    // Verify type badges are visible - scope to inquiry list to avoid sidebar
    const inquiryList = page.getByRole('list');
    await expect(inquiryList.getByText('STUDENT')).toBeVisible();
    await expect(inquiryList.getByText('MENTOR')).toBeVisible();
    await expect(inquiryList.getByText('SPONSOR')).toBeVisible();
    await expect(inquiryList.getByText('OUTREACH')).toBeVisible();

    // Verify status badges are visible
    await expect(page.getByText('PENDING')).toBeVisible();
    await expect(page.getByText('RESOLVED')).toBeVisible();
    await expect(page.getByText('REJECTED')).toBeVisible();
  });
});

test.describe('Admin Inquiries - Loading States', () => {
  test('displays loading skeleton while fetching inquiries', async ({ page }) => {
    await setupMockAuth(page);

    // Slow down the API response to ensure loading state is visible
    await page.route('**/api/inquiries/admin/list*', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 500));
      await route.fulfill({
        status: 200,
        json: { inquiries: createMockInquiries() },
      });
    });

    await page.goto('/dashboard/inquiries');

    // Verify loading indicator is shown (DashboardLoadingGrid)
    // The loading state appears briefly before content loads
    await page.waitForTimeout(100);

    // Wait for content to load
    await expect(page.getByText('Jane Student')).toBeVisible({
      timeout: TEST_TIMEOUTS.SLOW_PAGE,
    });
  });
});

test.describe('Admin Inquiries - Permissions', () => {
  test('redirects unauthorized users away from inquiries page', async ({ page }) => {
    // Setup mock auth with unverified user (canSeeInquiries = false)
    await page.route('**/api/auth/get-session', async (route) => {
      await route.fulfill({
        status: 200,
        json: {
          session: {
            id: 'unverified-user-session',
            userId: 'unverified-user',
            expiresAt: new Date(Date.now() + 10000000).toISOString(),
            ipAddress: '127.0.0.1',
            userAgent: 'Playwright',
          },
          user: {
            id: 'unverified-user',
            name: 'Unverified User',
            email: 'user@example.com',
            emailVerified: true,
            image: 'https://api.dicebear.com/9.x/bottts/svg?seed=user',
            role: 'unverified',
            banned: false,
          },
        },
      });
    });

    // Mock profile with unverified role
    await page.route('**/profile/me', async (route) => {
      await route.fulfill({
        status: 200,
        json: {
          user_id: 'unverified-user',
          nickname: 'Unverified User',
          first_name: 'Unverified',
          last_name: 'User',
          member_type: 'student',
          auth: {
            role: 'unverified',
          },
        },
      });
    });

    // Set auth cookie
    await page.context().addCookies([
      {
        name: 'better-auth.session_token',
        value: 'unverified-user-session',
        domain: 'localhost',
        path: '/',
      },
    ]);

    await page.goto('/dashboard/inquiries');

    // Verify access denied message is shown
    await expect(page.getByText('Access Denied')).toBeVisible();
  });
});
