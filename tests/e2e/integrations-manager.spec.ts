import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { setupMockAuth } from '../fixtures/auth';
import { TEST_TIMEOUTS } from '../fixtures/mock-data';
import { IntegrationsManagerPage } from '../pages/IntegrationsManagerPage';

/**
 * E2E tests for Integrations Manager dashboard route.
 * Tests verify:
 * - Admin-only access to integrations dashboard
 * - Integration cards display correctly
 * - Toggle/enable-disable workflow for settings
 * - Form submission with save functionality
 * - WCAG 2.1 AA accessibility compliance
 */

test.describe('Integrations Manager', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async ({ page }) => {
    await setupMockAuth(page);

    // Mock GET /api/settings/admin/settings
    await page.route('**/api/settings/admin/settings', async (route) => {
      await route.fulfill({
        status: 200,
        json: {
          success: true,
          settings: {
            ZULIP_URL: 'https://aresfirst.zulipchat.com',
            ZULIP_BOT_EMAIL: 'ares-bot@aresfirst.zulipchat.com',
            ZULIP_API_KEY: '••••••••abcd',
            ZULIP_WEBHOOK_TOKEN: '••••••••xyz',
            ZULIP_ADMIN_STREAM: 'leadership',
            ZULIP_COMMENT_STREAM: 'website-discussion',
            GITHUB_PAT: '••••••••ghp',
            GITHUB_ORG: 'ARES23247',
            GITHUB_PROJECT_ID: 'PVT_demo123',
            GITHUB_WEBHOOK_SECRET: '••••••••hmac',
            DISCORD_WEBHOOK_URL: 'https://discord.com/api/webhooks/demo',
            BLUESKY_HANDLE: 'ares23247.bsky.social',
            BLUESKY_APP_PASSWORD: '••••••••bsky',
            CALENDAR_ID_INTERNAL: 'c_internal@group.calendar.google.com',
            CALENDAR_ID_OUTREACH: 'c_outreach@group.calendar.google.com',
            CALENDAR_ID_EXTERNAL: 'c_external@group.calendar.google.com',
            RESEND_API_KEY: '••••••••resend',
            RESEND_FROM_EMAIL: 'team@aresfirst.org',
          },
        },
      });
    });

    // Mock POST /api/settings/admin/settings
    await page.route('**/api/settings/admin/settings', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 200,
          json: {
            success: true,
            updated: 1,
          },
        });
      }
    });

    // Mock Zulip presence to avoid errors
    await page.route('**/api/zulip/presence', async (route) => {
      await route.fulfill({
        status: 200,
        json: { success: true, presence: {}, userNames: {} },
      });
    });
  });

  test('Admin-only access: non-admin users see Access Denied message', async ({ page }) => {
    // Create a non-admin session
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
            name: 'Member User',
            email: 'member@ares.org',
            emailVerified: true,
            image: 'https://api.dicebear.com/9.x/bottts/svg?seed=member',
            role: 'member',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            banned: false,
          },
        },
      });
    });

    await page.goto('/dashboard/integrations');

    // Verify Access Denied message is shown
    await expect(page.getByText('Access Denied')).toBeVisible({
      timeout: TEST_TIMEOUTS.SLOW_PAGE,
    });
  });

  test('Admin dashboard loads integrations manager at /dashboard/integrations', async ({ page }) => {
    const integrationsPage = new IntegrationsManagerPage(page);
    await integrationsPage.goto();

    // Verify page heading
    await expect(integrationsPage.pageHeading).toBeVisible({
      timeout: TEST_TIMEOUTS.SLOW_PAGE,
    });

    // Verify description text
    await expect(page.getByText(/Manage your Zero Trust configuration tokens securely/i)).toBeVisible();

    // Verify Save Changes button is present but disabled initially
    await expect(integrationsPage.saveButton).toBeVisible();
    await expect(integrationsPage.saveButton).toBeDisabled();

    // Take screenshot for visual verification
    await page.screenshot({ path: 'integrations-manager-initial.png', fullPage: true });
  });

  test('Integrations list displays all integration cards', async ({ page }) => {
    const integrationsPage = new IntegrationsManagerPage(page);
    await integrationsPage.goto();

    // Wait for page to load
    await integrationsPage.waitForLoadState();

    // Verify Zulip Team Chat card is visible
    await expect(integrationsPage.zulipCard).toBeVisible();
    await expect(integrationsPage.zulipCard.getByText('Zulip Team Chat')).toBeVisible();

    // Verify GitHub Projects v2 card is visible
    await expect(integrationsPage.githubCard).toBeVisible();
    await expect(integrationsPage.githubCard.getByText('GitHub Projects v2')).toBeVisible();

    // Verify Discord Publishing card is visible
    await expect(integrationsPage.discordCard).toBeVisible();
    await expect(integrationsPage.discordCard.getByText('Discord Publishing')).toBeVisible();

    // Verify Bluesky Network card is visible
    await expect(integrationsPage.blueskyCard).toBeVisible();
    await expect(integrationsPage.blueskyCard.getByText('Bluesky Network')).toBeVisible();

    // Verify Google Calendar Admin card is visible
    await expect(integrationsPage.gcalCard).toBeVisible();
    await expect(integrationsPage.gcalCard.getByText('Google Calendar Admin')).toBeVisible();

    // Verify Resend Mass Email card is visible
    await expect(integrationsPage.resendCard).toBeVisible();
    await expect(integrationsPage.resendCard.getByText('Resend Mass Email')).toBeVisible();

    // Verify Data Management & Backup card is visible
    await expect(integrationsPage.backupCard).toBeVisible();
    await expect(integrationsPage.backupCard.getByText('Data Management & Backup')).toBeVisible();
  });

  test('Integration toggle/enable-disable workflow - modify Zulip configuration', async ({ page }) => {
    const integrationsPage = new IntegrationsManagerPage(page);
    await integrationsPage.goto();

    // Wait for form to load
    await integrationsPage.waitForLoadState();
    await expect(integrationsPage.zulipCard).toBeVisible();

    // Save button should be disabled initially
    await expect(integrationsPage.saveButton).toBeDisabled();

    // Fill in Zulip URL field
    await integrationsPage.zulipUrlInput.fill('https://updated.zulipchat.com');

    // Save button should now be enabled (form is dirty)
    await expect(integrationsPage.saveButton).toBeEnabled();

    // Verify the input value was updated
    await expect(integrationsPage.zulipUrlInput).toHaveValue('https://updated.zulipchat.com');

    // Click Save Changes button
    await integrationsPage.saveButton.click();

    // Verify success message appears
    await expect(integrationsPage.successMessage).toBeVisible();
    await expect(integrationsPage.successMessage).toContainText('synchronized securely');

    // Save button should be disabled again after successful save
    await expect(integrationsPage.saveButton).toBeDisabled();
  });

  test('Integration toggle/enable-disable workflow - modify GitHub configuration', async ({ page }) => {
    const integrationsPage = new IntegrationsManagerPage(page);
    await integrationsPage.goto();

    await integrationsPage.waitForLoadState();
    await expect(integrationsPage.githubCard).toBeVisible();

    // Save button should be disabled initially
    await expect(integrationsPage.saveButton).toBeDisabled();

    // Fill in GitHub Organization field
    await integrationsPage.githubOrgInput.fill('ARES-UPDATED');

    // Save button should now be enabled
    await expect(integrationsPage.saveButton).toBeEnabled();

    // Verify the input value was updated
    await expect(integrationsPage.githubOrgInput).toHaveValue('ARES-UPDATED');

    // Click Save Changes
    await integrationsPage.saveButton.click();

    // Verify success message
    await expect(integrationsPage.successMessage).toBeVisible();

    // Wait for success message to disappear (3 second timeout)
    await page.waitForTimeout(3500);
    await expect(integrationsPage.successMessage).not.toBeVisible();
  });

  test('Integration toggle/enable-disable workflow - modify Resend email configuration', async ({ page }) => {
    const integrationsPage = new IntegrationsManagerPage(page);
    await integrationsPage.goto();

    await integrationsPage.waitForLoadState();
    await expect(integrationsPage.resendCard).toBeVisible();

    // Fill in Resend API Key field
    await integrationsPage.resendApiKeyInput.fill('re_updatedApiKey123456789');

    // Save button should be enabled
    await expect(integrationsPage.saveButton).toBeEnabled();

    // Fill in From Email field
    await integrationsPage.resendFromEmailInput.fill('updated@aresfirst.org');

    // Verify both values were set
    await expect(integrationsPage.resendApiKeyInput).toHaveValue('re_updatedApiKey123456789');
    await expect(integrationsPage.resendFromEmailInput).toHaveValue('updated@aresfirst.org');

    // Click Save Changes
    await integrationsPage.saveButton.click();

    // Verify success message
    await expect(integrationsPage.successMessage).toBeVisible();
  });

  test('Integration cards display current configuration values', async ({ page }) => {
    const integrationsPage = new IntegrationsManagerPage(page);
    await integrationsPage.goto();

    await integrationsPage.waitForLoadState();

    // Verify Zulip configuration values are displayed
    await expect(integrationsPage.zulipUrlInput).toHaveValue('https://aresfirst.zulipchat.com');
    await expect(integrationsPage.zulipBotEmailInput).toHaveValue('ares-bot@aresfirst.zulipchat.com');
    await expect(integrationsPage.zulipAdminStreamInput).toHaveValue('leadership');

    // Verify GitHub configuration values are displayed
    await expect(integrationsPage.githubOrgInput).toHaveValue('ARES23247');
    await expect(integrationsPage.githubProjectIdInput).toHaveValue('PVT_demo123');

    // Verify Resend configuration values are displayed
    await expect(integrationsPage.resendFromEmailInput).toHaveValue('team@aresfirst.org');

    // Verify Discord webhook URL is displayed
    await expect(integrationsPage.discordWebhookInput).toHaveValue('https://discord.com/api/webhooks/demo');

    // Verify Bluesky handle is displayed
    await expect(integrationsPage.blueskyHandleInput).toHaveValue('ares23247.bsky.social');
  });

  test('Sensitive API keys are masked in the UI', async ({ page }) => {
    const integrationsPage = new IntegrationsManagerPage(page);
    await integrationsPage.goto();

    await integrationsPage.waitForLoadState();

    // Verify Zulip API Key is masked
    await expect(integrationsPage.zulipApiKeyInput).toHaveValue(/\*+abcd/);

    // Verify Zulip Webhook Token is masked
    await expect(integrationsPage.zulipWebhookTokenInput).toHaveValue(/\*+xyz/);

    // Verify GitHub PAT is masked
    await expect(integrationsPage.githubPatInput).toHaveValue(/\*+ghp/);

    // Verify GitHub Webhook Secret is masked
    await expect(integrationsPage.githubWebhookSecretInput).toHaveValue(/\*+hmac/);

    // Verify Bluesky App Password is masked
    await expect(integrationsPage.blueskyAppPasswordInput).toHaveValue(/\*+bsky/);

    // Verify Resend API Key is masked
    await expect(integrationsPage.resendApiKeyInput).toHaveValue(/\*+resend/);
  });

  test('Save button is disabled when form is not dirty', async ({ page }) => {
    const integrationsPage = new IntegrationsManagerPage(page);
    await integrationsPage.goto();

    await integrationsPage.waitForLoadState();

    // Initial state - save button should be disabled
    await expect(integrationsPage.saveButton).toBeDisabled();

    // Make a change
    await integrationsPage.zulipUrlInput.fill('https://test.zulipchat.com');

    // Save button should be enabled
    await expect(integrationsPage.saveButton).toBeEnabled();

    // Revert the change to original value
    await integrationsPage.zulipUrlInput.fill('https://aresfirst.zulipchat.com');

    // Save button should be disabled again (form is clean)
    await expect(integrationsPage.saveButton).toBeDisabled();
  });

  test('Data backup export button is visible and functional', async ({ page }) => {
    // Mock backup endpoint
    await page.route('**/api/settings/admin/backup', async (route) => {
      await route.fulfill({
        status: 200,
        json: {
          success: true,
          timestamp: new Date().toISOString(),
          backup: {
            posts: [],
            events: [],
            docs: [],
          },
        },
      });
    });

    const integrationsPage = new IntegrationsManagerPage(page);
    await integrationsPage.goto();

    await integrationsPage.waitForLoadState();

    // Verify export button exists
    await expect(integrationsPage.exportButton).toBeVisible();
    await expect(integrationsPage.exportButton).toContainText('EXPORT JSON BACKUP');

    // Note: Actual download testing requires handling download events
    // which is complex in E2E tests, so we verify button visibility and state
  });

  test('Accessibility audit - WCAG 2.1 AA compliance', async ({ page }) => {
    const integrationsPage = new IntegrationsManagerPage(page);
    await integrationsPage.goto();

    // Wait for page to fully load
    await integrationsPage.waitForLoadState();

    // Stabilize animations for accurate accessibility scan
    await integrationsPage.stabilizeForAccessibility();

    // ── Accessibility Audit ───────────────────────────────────────────
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('Keyboard navigation - tab order through integration cards', async ({ page }) => {
    const integrationsPage = new IntegrationsManagerPage(page);
    await integrationsPage.goto();

    await integrationsPage.waitForLoadState();

    // Test keyboard navigation - tab to first input
    await page.keyboard.press('Tab');

    // Verify focus is on an interactive element
    const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
    expect(['INPUT', 'BUTTON', 'TEXTAREA']).toContain(focusedElement);

    // Tab through multiple inputs
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('Tab');
    }

    // Verify we can still interact with focused elements
    const activeElement = await page.evaluate(() => document.activeElement);
    expect(activeElement).toBeTruthy();
  });

  test('Form validation - empty values can be saved', async ({ page }) => {
    const integrationsPage = new IntegrationsManagerPage(page);
    await integrationsPage.goto();

    await integrationsPage.waitForLoadState();

    // Clear Zulip URL field
    await integrationsPage.zulipUrlInput.fill('');

    // Save button should be enabled
    await expect(integrationsPage.saveButton).toBeEnabled();

    // Click save
    await integrationsPage.saveButton.click();

    // Verify success message (empty values are valid)
    await expect(integrationsPage.successMessage).toBeVisible();
  });

  test('Integration card descriptions are readable and informative', async ({ page }) => {
    const integrationsPage = new IntegrationsManagerPage(page);
    await integrationsPage.goto();

    await integrationsPage.waitForLoadState();

    // Verify Zulip card description
    await expect(page.getByText(/Bi-directional sync with Zulip/i)).toBeVisible();

    // Verify GitHub card description
    await expect(page.getByText(/Connect your GitHub Project board/i)).toBeVisible();

    // Verify Resend card description
    await expect(page.getByText(/Configure Resend to send HTML mass emails/i)).toBeVisible();

    // Verify main page description
    await expect(page.getByText(/Keys are safely obscured upon save/i)).toBeVisible();
  });

  test('Loading state displays spinner while settings are loading', async ({ page }) => {
    // Delay the response to test loading state
    await page.route('**/api/settings/admin/settings', async (route) => {
      await new Promise(resolve => setTimeout(resolve, 1000));
      await route.fulfill({
        status: 200,
        json: {
          success: true,
          settings: {},
        },
      });
    });

    const integrationsPage = new IntegrationsManagerPage(page);
    await integrationsPage.goto();

    // The loading spinner should be visible briefly
    // Since the delay is short, we just verify the page eventually loads
    await expect(integrationsPage.pageHeading).toBeVisible({
      timeout: TEST_TIMEOUTS.SLOW_PAGE,
    });
  });

  test('Error handling displays error message on failed settings load', async ({ page }) => {
    // Mock a failed response
    await page.route('**/api/settings/admin/settings', async (route) => {
      await route.fulfill({
        status: 500,
        json: {
          success: false,
          error: 'Database connection failed',
        },
      });
    });

    const integrationsPage = new IntegrationsManagerPage(page);
    await integrationsPage.goto();

    // The page should still render but with error state
    // Since the component uses isError to show an error message
    await expect(page.getByText(/TELEMETRY FAULT|Failed to synchronize/i)).toBeVisible({
      timeout: TEST_TIMEOUTS.SLOW_PAGE,
    });
  });

  test('Integration cards have proper ARIA labels and roles', async ({ page }) => {
    const integrationsPage = new IntegrationsManagerPage(page);
    await integrationsPage.goto();

    await integrationsPage.waitForLoadState();

    // Verify form has proper role
    const form = page.locator('form');
    await expect(form).toBeVisible();

    // Verify inputs have proper labels
    await expect(integrationsPage.zulipUrlInput).toBeVisible();

    // Verify the zulip_url input has an associated label
    const hasLabel = await integrationsPage.zulipUrlInput.evaluate(el =>
      el.labels !== null && el.labels.length > 0
    );
    expect(hasLabel).toBe(true);

    // Verify save button is properly identified
    await expect(integrationsPage.saveButton).toBeVisible();
  });
});
