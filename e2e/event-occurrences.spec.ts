import { test, expect } from "./fixtures";
import type { Page } from "@playwright/test";

async function mockRecurringCalendar(page: Page) {
  const dates = ["2026-09-15", "2026-09-22"];
  const cancelled = new Set<string>();
  const writes: Array<{ method: string; path: string; body: unknown }> = [];
  let archived = false;
  const events = () => dates.filter(date => !cancelled.has(date)).map(date => ({
    id: `weekly-1_${date}`, recurrenceOf: "weekly-1", occurrenceDate: date,
    title: "Recurring Test Practice", dateStart: `${date}T18:00:00`,
    dateEnd: `${date}T20:00:00`, category: "internal", status: "published",
    isDeleted: archived ? 1 : 0,
    recurrence: { frequency: "weekly", interval: 1, byDay: ["TU"] },
  }));
  await page.route("**/api/profiles/team-roster", route => route.fulfill({ json: { members: [] } }));
  await page.route("**/api/profiles/me", route => route.fulfill({ json: { exists: true, profile: { nickname: "Test manager", avatar: "" } } }));
  await page.route("**/api/calendar/**", async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() !== "GET") {
      writes.push({ method: request.method(), path, body: request.postDataJSON() });
      const match = path.match(/\/occurrences\/(\d{4}-\d{2}-\d{2})(\/restore)?$/);
      if (request.method() === "PATCH" && match) {
        if (match[2]) cancelled.delete(match[1]);
        else cancelled.add(match[1]);
      } else if (request.method() === "DELETE" && path === "/api/calendar/manage/weekly-1") archived = true;
      else throw new Error(`Unexpected calendar write: ${request.method()} ${path}`);
      await route.fulfill({ json: { success: true } });
    } else if (path.endsWith("/locations")) await route.fulfill({ json: { locations: [] } });
    else if (path.endsWith("/occurrences")) await route.fulfill({ json: { occurrences: [...cancelled].map(date => ({ date, isCancelled: true, hasOverrides: false })) } });
    else if (path === "/api/calendar/manage" || path === "/api/calendar/events") await route.fulfill({ json: { events: events(), nextCursor: null } });
    else throw new Error(`Unexpected calendar read: ${path}`);
  });
  return { writes };
}

test("delete one session from the editor, retain its neighbor, and restore the date", async ({ page, loginAs }) => {
  const { writes } = await mockRecurringCalendar(page);
  await loginAs("admin");
  await page.goto("/dashboard/events");
  await page.getByRole("button", { name: "Edit event Recurring Test Practice", exact: true }).first().click();
  const editor = page.getByRole("dialog", { name: "Edit Event: Recurring Test Practice", exact: true });
  await expect(editor.getByRole("radio", { name: /This session/ })).toBeChecked();
  const remove = editor.getByRole("button", { name: "Delete this session", exact: true });
  await remove.click();
  const confirmation = page.getByRole("dialog", { name: "Delete this session?", exact: true });
  await expect(confirmation).toContainText("2026-09-15");
  await test.info().attach("session-delete-confirmation", { body: await page.screenshot(), contentType: "image/png" });
  await page.keyboard.press("Escape");
  await expect(confirmation).toBeHidden();
  await expect(remove).toBeFocused();
  expect(writes).toEqual([]);
  await remove.click();
  await confirmation.getByRole("button", { name: "Delete this session", exact: true }).click();
  await expect(editor).toBeHidden();
  await expect(page.getByRole("button", { name: "Delete session Recurring Test Practice on 2026-09-15", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Delete session Recurring Test Practice on 2026-09-22", exact: true })).toBeVisible();
  expect(writes).toEqual([{ method: "PATCH", path: "/api/calendar/manage/weekly-1/occurrences/2026-09-15", body: { cancelled: true } }]);

  await page.getByRole("button", { name: "Edit event Recurring Test Practice", exact: true }).click();
  await editor.getByRole("radio", { name: /Entire series/ }).check();
  await editor.getByRole("button", { name: "Restore", exact: true }).click();
  await expect(editor.getByText("No sessions are skipped.", { exact: true })).toBeVisible();
  await editor.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByRole("button", { name: "Delete session Recurring Test Practice on 2026-09-15", exact: true })).toBeVisible();
  expect(writes[1]).toMatchObject({ method: "PATCH", path: "/api/calendar/manage/weekly-1/occurrences/2026-09-15/restore" });
});

test("list deletion defaults to one session and requires choosing the entire series", async ({ page, loginAs }) => {
  const { writes } = await mockRecurringCalendar(page);
  await loginAs("coach");
  await page.goto("/dashboard/events");
  await page.getByRole("button", { name: "Delete session Recurring Test Practice on 2026-09-15", exact: true }).click();
  const confirmation = page.getByRole("dialog", { name: "Delete this session?", exact: true });
  await expect(confirmation.getByRole("radio", { name: "This session (2026-09-15)", exact: true })).toBeChecked();
  await confirmation.getByRole("button", { name: "Delete this session", exact: true }).click();
  await expect(confirmation).toBeHidden();
  await page.getByRole("button", { name: "Delete session Recurring Test Practice on 2026-09-22", exact: true }).click();
  await confirmation.getByRole("radio", { name: "Entire series", exact: true }).check();
  const seriesConfirmation = page.getByRole("dialog", { name: "Archive entire series?", exact: true });
  await expect(seriesConfirmation).toContainText("Every session");
  await seriesConfirmation.getByRole("button", { name: "Archive entire series", exact: true }).click();
  await expect(seriesConfirmation).toBeHidden();
  expect(writes.map(({ method, path }) => ({ method, path }))).toEqual([
    { method: "PATCH", path: "/api/calendar/manage/weekly-1/occurrences/2026-09-15" },
    { method: "DELETE", path: "/api/calendar/manage/weekly-1" },
  ]);
});
