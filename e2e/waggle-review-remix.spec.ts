import { expect, test } from "./fixtures";
import { createBlankLevel } from "@ares/waggle-way/level";
import { replayRun } from "@ares/waggle-way/replay";
import type { CommunitySubmission } from "@ares/waggle-way/community";

const level = { ...createBlankLevel(), title: "Clover crossing" };
const card = {
  id: "approved-parent",
  revision: 1,
  title: level.title,
  nickname: "Clover",
  difficulty: "gentle",
  estimatedLength: "short",
  theme: "sunny",
  population: 8,
  rescueTarget: 8,
  mechanics: ["hive", "flowers"],
};
const garden = { ...card, level };
const owned = {
  id: card.id,
  version: 4,
  title: level.title,
  publishedRevision: null,
  candidateRevision: 1,
  status: "pending",
  reviewReason: null,
};

test("a member creates an independent remix with fresh proof and its approved source", async ({
  page,
  loginAs,
}) => {
  await loginAs("member");
  let detailReads = 0;
  let proof: CommunitySubmission | undefined;
  await page.route("**/api/waggle-way/gardens", (route) =>
    route.fulfill({ json: { gardens: [card], nextCursor: null } }),
  );
  await page.route(`**/api/waggle-way/gardens/${card.id}`, (route) => {
    detailReads++;
    return route.fulfill({ json: garden });
  });
  await page.route("**/api/waggle-way/mine/*", async (route) => {
    proof = route.request().postDataJSON() as CommunitySubmission;
    expect(proof.parent).toEqual({ id: card.id, revision: 1 });
    expect(proof.proof.level.id).not.toBe(level.id);
    expect(replayRun(proof.proof.level, proof.proof.replays[0]).won).toBe(true);
    const id = route.request().url().split("/").at(-1)!;
    expect(id).not.toBe(card.id);
    expect(id).not.toBe(proof.proof.level.id);
    await route.fulfill({ json: { ...owned, id, version: 1 } });
  });
  await page.goto("/waggle-way");
  await page.getByRole("button", { name: "Original gardens", exact: true }).click();
  await page
    .getByRole("button", { name: "Community gardens", exact: true })
    .click();
  let dialog = page.getByRole("dialog", {
    name: "Community gardens",
    exact: true,
  });
  await dialog.getByRole("button", { name: /Clover crossing/ }).click();
  await dialog
    .getByRole("button", { name: "Remix in workshop", exact: true })
    .click();
  dialog = page.getByRole("dialog", {
    name: "Make it your garden",
    exact: true,
  });
  await expect(
    dialog.getByRole("heading", { name: level.title, exact: true }),
  ).toBeFocused();
  expect(detailReads).toBe(2);
  await dialog
    .getByRole("button", { name: "Remix this revision", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await expect(page).toHaveURL(/\/waggle-way\/builder$/);
  const workshop = page.getByRole("region", {
    name: "Waggle Way workshop window",
    exact: true,
  });
  await expect(
    workshop.getByRole("button", { name: "Test garden", exact: true }),
  ).toBeFocused();
  await expect(
    workshop.getByRole("button", { name: "Review gardens", exact: true }),
  ).toHaveCount(0);
  await workshop
    .getByRole("button", { name: "Share garden", exact: true })
    .click();
  dialog = page.getByRole("dialog", {
    name: "Community workshop",
    exact: true,
  });
  await expect(
    dialog.getByRole("button", { name: "Submit for review", exact: true }),
  ).toBeDisabled();
  await page.keyboard.press("Escape");
  await workshop
    .getByRole("button", { name: "Test garden", exact: true })
    .click();
  const flight = page.getByRole("region", {
    name: "Waggle Way game window",
    exact: true,
  });
  await flight
    .getByRole("combobox", { name: "Speed", exact: true })
    .selectOption("3");
  await flight.getByRole("button", { name: "Open hive", exact: true }).click();
  await expect(flight.getByRole("status")).toHaveText(
    "8 bees reached the flowers.",
    { timeout: 15000 },
  );
  await flight
    .getByRole("button", { name: "Return to editor", exact: true })
    .click();
  await workshop
    .getByRole("button", { name: "Share garden", exact: true })
    .click();
  await dialog.getByLabel("Public nickname", { exact: true }).fill("Fern");
  await dialog
    .getByRole("button", { name: "Submit for review", exact: true })
    .click();
  await expect(
    dialog.getByText(/Submitted for admin or coach review/),
  ).toBeVisible();
  expect(proof).toBeDefined();
});

for (const role of ["admin", "coach"] as const) {
  test(`${role} reviews exact content, removes a reported publication and resolves its report separately`, async ({
    page,
    loginAs,
  }, testInfo) => {
    await loginAs(role);
    await page.addInitScript(() =>
      Object.defineProperty(Element.prototype, "requestFullscreen", {
        configurable: true,
        value: () => Promise.reject(new Error("Use viewport fullscreen")),
      }),
    );
    let approved = false;
    let removed = false;
    let resolved = false;
    const digest = "a".repeat(64);
    await page.route("**/api/waggle-way/review", (route) =>
      route.fulfill({
        json: { gardens: approved ? [] : [owned], nextCursor: null },
      }),
    );
    await page.route(`**/api/waggle-way/review/${card.id}`, async (route) => {
      if (route.request().method() === "GET")
        return route.fulfill({
          json: {
            garden: owned,
            candidate: garden,
            reviewDigest: digest,
            allBeesProven: true,
            bestPollen: 0,
            fewestTools: 0,
          },
        });
      expect(route.request().postDataJSON()).toEqual({
        expectedVersion: 4,
        reviewDigest: digest,
        decision: "approve",
      });
      approved = true;
      await route.fulfill({
        json: {
          ...owned,
          version: 5,
          publishedRevision: 1,
          candidateRevision: null,
          status: "published",
        },
      });
    });
    await page.route("**/api/waggle-way/reports", (route) =>
      route.fulfill({
        json: {
          reports: resolved
            ? []
            : [
                {
                  id: "report",
                  levelId: card.id,
                  revision: 1,
                  reason: "identity",
                  publication: removed ? null : { card, version: 5 },
                },
              ],
          nextCursor: null,
        },
      }),
    );
    await page.route(`**/api/waggle-way/gardens/${card.id}`, (route) =>
      route.fulfill({ json: garden }),
    );
    await page.route(
      `**/api/waggle-way/gardens/${card.id}/remove`,
      async (route) => {
        expect(route.request().postDataJSON()).toEqual({
          expectedVersion: 5,
          reason: "identity",
        });
        expect(resolved).toBe(false);
        removed = true;
        await route.fulfill({
          json: {
            ...owned,
            version: 6,
            publishedRevision: null,
            candidateRevision: null,
            status: "removed",
            reviewReason: "identity",
          },
        });
      },
    );
    await page.route(
      "**/api/waggle-way/reports/report/resolve",
      async (route) => {
        expect(removed).toBe(true);
        resolved = true;
        await route.fulfill({ status: 204 });
      },
    );
    await page.goto("/waggle-way/builder");
    const workshop = page.getByRole("region", {
      name: "Waggle Way workshop window",
      exact: true,
    });
    await workshop
      .getByRole("button", { name: "Enter full screen", exact: true })
      .click();
    const opener = workshop.getByRole("button", {
      name: "Review gardens",
      exact: true,
    });
    await opener.click();
    const dialog = page.getByRole("dialog", {
      name: "Community workshop",
      exact: true,
    });
    await dialog
      .getByRole("button", { name: "Review Clover crossing", exact: true })
      .click();
    await expect(
      dialog.getByRole("heading", { name: level.title, exact: true }),
    ).toBeFocused();
    await expect(
      dialog.getByRole("button", { name: "Approve and publish", exact: true }),
    ).toBeDisabled();
    await dialog
      .getByRole("button", { name: "Test candidate", exact: true })
      .click();
    const flight = dialog.getByRole("region", {
      name: "Waggle Way game window",
      exact: true,
    });
    await expect(
      flight.getByRole("button", { name: "Enter full screen", exact: true }),
    ).toHaveCount(0);
    await flight
      .getByRole("combobox", { name: "Speed", exact: true })
      .selectOption("3");
    await flight
      .getByRole("button", { name: "Open hive", exact: true })
      .click();
    await expect(flight.getByRole("status")).toHaveText(
      "8 bees reached the flowers.",
      { timeout: 15000 },
    );
    await flight.screenshot({
      path: testInfo.outputPath("candidate-playtest.png"),
    });
    await flight
      .getByRole("button", { name: "Return to review", exact: true })
      .click();
    await dialog
      .getByRole("checkbox", {
        name: "I checked the title, instructions, nickname and gameplay.",
        exact: true,
      })
      .check();
    await dialog
      .getByRole("button", { name: "Approve and publish", exact: true })
      .click();
    await expect(
      dialog.getByText("Garden approved and published.", { exact: true }),
    ).toBeVisible();
    await dialog
      .getByRole("button", { name: "Reported gardens", exact: true })
      .click();
    await dialog
      .getByRole("button", { name: /Inspect report for Clover crossing/ })
      .click();
    await dialog
      .getByRole("button", { name: "Remove garden", exact: true })
      .click();
    await dialog
      .getByRole("button", { name: "Confirm removal", exact: true })
      .click();
    await expect(
      dialog.getByText(
        "Garden removed. Its report remains open for resolution.",
        { exact: true },
      ),
    ).toBeVisible();
    expect(resolved).toBe(false);
    await dialog
      .getByRole("button", {
        name: /Inspect report for unavailable publication/,
      })
      .click();
    await expect(
      dialog.getByRole("button", { name: "Remove garden", exact: true }),
    ).toHaveCount(0);
    await dialog
      .getByRole("button", { name: "Resolve report", exact: true })
      .click();
    await expect(
      dialog.getByText("Report resolved. Publication was not changed.", {
        exact: true,
      }),
    ).toBeVisible();
    expect(resolved).toBe(true);
    expect(
      await dialog.evaluate(
        (element) => element.scrollWidth <= element.clientWidth,
      ),
    ).toBe(true);
    await page.keyboard.press("Escape");
    await expect(opener).toBeFocused();
    await expect(workshop).toHaveAttribute("data-game-fullscreen", "true");
  });
}
