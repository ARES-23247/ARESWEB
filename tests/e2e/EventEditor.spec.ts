import { test, expect } from "@playwright/test";

test.describe("Event Editor E2E", () => {
  test.beforeEach(async ({ page }) => {
    // Mock the authentication session
    await page.route('**/api/auth/get-session', async route => {
      await route.fulfill({
        status: 200,
        json: {
          session: {
            id: "mockup-session-id",
            userId: "admin-user",
            expiresAt: new Date(Date.now() + 10000000).toISOString(),
          },
          user: {
            id: "admin-user",
            name: "Admin User",
            email: "admin@ares.org",
            role: "admin"
          }
        }
      });
    });

    await page.route('**/api/profile/me', async route => {
      await route.fulfill({
        status: 200,
        json: {
          user_id: "admin-user",
          nickname: "Admin User",
          member_type: "mentor",
          auth: { id: "admin-user", role: "admin" }
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

    // Mock API for locations
    await page.route("**/api/locations", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          locations: [
            { id: "1", name: "ARES HQ", address: "123 Robot Lane" }
          ]
        })
      });
    });

    // Navigate to create event page
    // Note: In a real scenario, we'd need to bypass auth or login
    await page.goto("/dashboard/events/new");
  });

  test("should show validation errors when submitting empty form", async ({ page }) => {
    await page.click("button:has-text('PUBLISH EVENT')");
    
    const errorMsg = page.locator("text=Title and Start Date are required.");
    await expect(errorMsg).toBeVisible();
  });

  test("should allow selecting a location from the registry", async ({ page }) => {
    const locationSelect = page.locator("#event-location");
    await locationSelect.selectOption({ label: "ARES HQ (123 Robot Lane)" });
    
    await expect(locationSelect).toHaveValue("123 Robot Lane");
  });

  test("should toggle potluck and volunteer flags", async ({ page }) => {
    const potluckToggle = page.locator("button:has-text('Potluck')");
    const volunteerToggle = page.locator("button:has-text('Volunteer')");
    
    await potluckToggle.click();
    await volunteerToggle.click();
    
    // Check if classes indicate active state (assuming standard ARES patterns)
    await expect(potluckToggle).toHaveClass(/bg-ares-red/);
    await expect(volunteerToggle).toHaveClass(/bg-ares-red/);
  });
});
