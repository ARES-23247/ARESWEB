import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Admin Dashboard', () => {
  // Mock the authentication session for the entire suite
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/auth/get-session', async route => {
      await route.fulfill({
        status: 200,
        json: {
          session: {
            id: "mockup-session-id",
            userId: "admin-user",
            expiresAt: new Date(Date.now() + 10000000).toISOString(),
            ipAddress: "127.0.0.1",
            userAgent: "Playwright"
          },
          user: {
            id: "admin-user",
            name: "Admin User",
            email: "admin@ares.org",
            emailVerified: true,
            image: "https://api.dicebear.com/9.x/bottts/svg?seed=admin",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            role: "admin",
            banned: false
          }
        }
      });
    });

    await page.route('**/profile/me', async route => {
      await route.fulfill({
        status: 200,
        json: {
          user_id: "admin-user",
          nickname: "Admin User",
          first_name: "Admin",
          last_name: "User",
          member_type: "mentor",
          auth: {
            id: "admin-user",
            email: "admin@ares.org",
            name: "Admin User",
            image: "https://api.dicebear.com/9.x/bottts/svg?seed=admin",
            role: "admin"
          }
        }
      });
    });

    // Add a fake cookie to ensure better-auth doesn't short circuit
    await page.context().addCookies([{
      name: 'better-auth.session_token',
      value: 'mockup-session-id',
      domain: 'localhost',
      path: '/'
    }]);
  });

  test('Admin dashboard loads and displays authorized management hubs', async ({ page }) => {

    await page.goto('/dashboard');
    
    // Ensure dashboard title is visible
    await expect(page.getByRole('heading', { name: /ARES/i }).first()).toBeVisible();
    
    // Verify user profile section rendered the mocked user
    await page.screenshot({ path: 'admin-dashboard.png', fullPage: true });
    await expect(page.getByText('Admin User', { exact: true }).first()).toBeVisible();
    // Verify admin hubs are accessible
    await expect(page.getByText(/User Roles/i)).toBeVisible();
    await expect(page.getByText(/System Integrations/i)).toBeVisible();

    // ── Accessibility Audit ───────────────────────────────────────────
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('Command Center displays security telemetry', async ({ page }) => {
    await page.route('**/api/analytics/admin/stats*', async route => {
      await route.fulfill({
        status: 200,
        json: {
          posts: 10,
          events: 5,
          docs: 2,
          securityBlocks: 42,
          integrations: {
            zulip: false,
            github: false,
            discord: false,
            bluesky: false,
            slack: false,
            gcal: false
          }
        }
      });
    });

    await page.goto('/dashboard');
    
    // Verify Security Blocks widget is visible
    await expect(page.getByText('Sec Blocks')).toBeVisible();
    await expect(page.getByText('42')).toBeVisible();
  });

  test('Logistics tab supports email export', async ({ page }) => {
    await page.route('**/api/logistics/admin/summary*', async route => {
      await route.fulfill({
        status: 200,
        json: {
          totalCount: 2,
          memberCounts: { Student: 1, Mentor: 1 },
          dietary: { Peanuts: 1, Vegetarian: 1 },
          tshirts: { M: 1, L: 1 }
        }
      });
    });

    await page.route('**/api/logistics/admin/export-emails*', async route => {
      await route.fulfill({
        status: 200,
        json: {
          users: [
            { name: "Test User 1", email: "test1@ares.org", role: "admin" },
            { name: "Test User 2", email: "test2@ares.org", role: "member" }
          ]
        }
      });
    });

    await page.goto('/dashboard/logistics');
    
    // Wait for the DietarySummary component to load
    await expect(page.getByText('Team Logistics Summary')).toBeVisible({ timeout: 15000 });
    
    // Click export emails
    await page.getByRole('button', { name: /Export Roster Emails/i }).click();
    
    // Verify modal appeared with the mock data
    await expect(page.getByText('Active Roster Emails')).toBeVisible();
    await expect(page.getByRole('textbox', { name: /Exported Emails List/i })).toHaveValue("test1@ares.org, test2@ares.org");
    
    const copyBtn = page.getByRole('button', { name: /Copy/i });
    await expect(copyBtn).toBeVisible();
  });
});
