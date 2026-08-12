import { test, expect } from "./fixtures";

test("an administrator can prepare and copy a private BCC roster", async ({ page, loginAs }) => {
  await loginAs("admin", "Roster Administrator");
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (value: string) => window.sessionStorage.setItem("ares_e2e_clipboard", value),
      },
    });
  });

  await page.route("**/api/profiles/admin/users", async route => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, provisionedCount: 0 }),
    });
  });
  await page.route("**/api/profiles/admin/users/list?**", async route => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        users: [],
        nextCursor: null,
        integrations: { zulip: { available: true, diagnostic: null } },
      }),
    });
  });

  let exportBody: unknown;
  await page.route("**/api/profiles/admin/users/email-roster", async route => {
    exportBody = route.request().postDataJSON();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        recipients: [
          { name: "CircuitFox", email: "student@example.org", role: "member", memberType: "student", subteams: ["Programming"] },
          { name: "GearGuide", email: "mentor@example.org", role: "mentor", memberType: "mentor", subteams: ["Programming"] },
        ],
        recipientCount: 2,
        generatedAt: "2026-08-12T00:00:00.000Z",
      }),
    });
  });

  await page.goto("/dashboard/users");
  await expect(page.getByRole("heading", { name: "User Management" })).toBeVisible();
  await page.getByLabel("Audience").selectOption("students");
  await page.getByLabel("Subteam").selectOption("Programming");
  await page.getByRole("checkbox", { name: /I will use the team account/ }).check();
  await Promise.all([
    page.waitForResponse(response => response.url().includes("/api/profiles/admin/users/email-roster") && response.status() === 200),
    page.getByRole("button", { name: "Prepare email list" }).click(),
  ]);

  await expect(page.getByRole("status").filter({ hasText: "Prepared 2 active roster email addresses" }))
    .toContainText("Prepared 2 active roster email addresses", { timeout: 10_000 });
  await expect(page.locator("body")).not.toContainText("student@example.org");
  expect(exportBody).toEqual({ audience: "students", subteam: "Programming" });

  await page.getByRole("button", { name: "Copy BCC list" }).click();
  await expect.poll(() => page.evaluate(() => window.sessionStorage.getItem("ares_e2e_clipboard")))
    .toBe("student@example.org, mentor@example.org");
});
