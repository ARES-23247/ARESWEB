import { test, expect } from "@playwright/test";

test.describe("Event Editor E2E", () => {
  test.beforeEach(async ({ page }) => {
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
