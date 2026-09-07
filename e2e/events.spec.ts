import { test, expect } from "./fixtures";

test.describe("Competition event-day handoff", () => {
  test("opens the complete printable match plan and restores keyboard focus", async ({
    page,
    loginAs,
  }) => {
    await page.route("**/api/tournaments/e2e-event**", async (route) => {
      const requestUrl = new URL(route.request().url());
      if (requestUrl.pathname.endsWith("/matches")) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            matches: [
              {
                id: "qm-7",
                tournamentId: "e2e-event",
                matchNumber: "QM7",
                alliance: "red",
                partner: "12345",
                opponents: ["45678", "9876"],
                scoreSelf: 156,
                scoreOpponent: 141,
                result: "won",
                completed: true,
                isDeleted: 0,
                notes: "Check intake before queueing.",
              },
            ],
          }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          tournament: {
            id: "e2e-event",
            name: "Event-Day Test Invitational",
            date: "2026-10-17",
            location: "Morgantown, WV",
            seasonName: "2026-2027",
            challengeName: "DECODE",
            status: "upcoming",
            isDeleted: 0,
          },
        }),
      });
    });

    await loginAs("member");
    await page.goto("/tournaments/e2e-event");
    await expect(
      page.getByRole("heading", { name: "Event-Day Test Invitational" }),
    ).toBeVisible({ timeout: 15000 });

    const trigger = page.getByRole("button", { name: "Print plan" });
    await trigger.click();
    const dialog = page.getByRole("dialog", { name: "Event-day match plan" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("QM7")).toBeVisible();
    await expect(dialog.getByText("156–141")).toBeVisible();
    await expect(
      dialog.getByText("Check intake before queueing."),
    ).toBeVisible();
    await expect(dialog.getByText("2026-2027 · DECODE")).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
  });
});

