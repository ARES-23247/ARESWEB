import { expect, test } from "./fixtures";
import { createBlankLevel, serializeLevel } from "@ares/waggle-way/level";
import { replayRun } from "@ares/waggle-way/replay";
import type { CommunitySubmission } from "@ares/waggle-way/community";

// The review API currently accepts format 5; keep its authorization contract
// fixture explicit and independent of the format-7 game/editor defaults.
const level = { ...createBlankLevel(5), title: "Community clover crossing" };
const card = {
  id: "ab8903dc-7888-4e22-a528-493e2a150a21",
  revision: 1,
  title: level.title,
  nickname: "Clover",
  difficulty: "gentle",
  estimatedLength: "short",
  theme: "sunny",
  mechanics: ["fan"],
  population: level.population,
  rescueTarget: level.rescueTarget,
};

test("workshop fullscreen survives a test flight and reviewed submission flow", async ({
  page,
  loginAs,
}, testInfo) => {
  await loginAs("member");
  await page.addInitScript(() => {
    Object.defineProperty(Element.prototype, "requestFullscreen", {
      configurable: true,
      value: () => Promise.reject(new Error("Use viewport fullscreen")),
    });
  });
  let submitted: CommunitySubmission | undefined;
  let submittedId: string | undefined;
  await page.route("**/api/waggle-way/mine/*", async (route) => {
    expect(route.request().method()).toBe("PUT");
    submitted = route.request().postDataJSON() as CommunitySubmission;
    submittedId = route.request().url().split("/").at(-1);
    expect(submitted.expectedVersion).toBe(0);
    expect(submittedId).not.toBe(submitted.proof.level.id);
    expect(submitted.proof.replays.length).toBeGreaterThan(0);
    for (const replay of submitted.proof.replays)
      expect(replayRun(submitted.proof.level, replay).won).toBe(true);
    await route.fulfill({
      json: {
        id: submittedId,
        version: 1,
        title: submitted.proof.level.title,
        status: "pending",
        publishedRevision: null,
        candidateRevision: 1,
        reviewReason: null,
      },
    });
  });
  await page.goto("/waggle-way/builder");
  await page
    .locator("summary")
    .filter({ hasText: "Files and saved gardens" })
    .click();
  await page.getByLabel("Import a garden file", { exact: true }).setInputFiles({
    name: "review-contract.json",
    mimeType: "application/json",
    buffer: Buffer.from(serializeLevel(level)),
  });
  await page.keyboard.press("Escape");
  const workshop = page.getByRole("region", {
    name: "Waggle Way workshop window",
    exact: true,
  });
  expect(
    await workshop
      .locator(":scope > .ww-notice")
      .evaluate((element) => element.scrollHeight <= element.clientHeight),
  ).toBe(true);
  await workshop
    .getByRole("button", { name: "Enter full screen", exact: true })
    .click();
  await expect(workshop).toHaveAttribute("data-game-fullscreen", "true");
  await workshop
    .getByRole("button", { name: "Test garden", exact: true })
    .click();
  const flight = page.getByRole("region", {
    name: "Waggle Way game window",
    exact: true,
  });
  await expect(flight).toHaveAttribute("data-game-fullscreen", "true");
  await flight
    .getByRole("combobox", { name: "Speed", exact: true })
    .selectOption("3");
  await flight.getByRole("button", { name: "Open hive", exact: true }).click();
  await expect(flight.getByRole("status")).toHaveText(
    "8 bees reached the flowers.",
    {
      timeout: 15000,
    },
  );
  await flight
    .getByRole("button", { name: "Return to editor", exact: true })
    .click();
  await expect(workshop).toHaveAttribute("data-game-fullscreen", "true");
  await expect(
    workshop.getByRole("button", { name: "Test garden", exact: true }),
  ).toBeFocused();
  await expect(
    workshop.getByText("Successful test flights recorded for sharing."),
  ).toBeVisible();
  await workshop
    .getByRole("button", { name: "Share garden", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Community workshop",
    exact: true,
  });
  await dialog.getByLabel("Public nickname", { exact: true }).fill("Clover");
  await dialog
    .getByRole("button", { name: "Submit for review", exact: true })
    .click();
  await expect(
    dialog.getByText(/Submitted for admin or coach review/),
  ).toBeVisible();
  expect(submitted).toBeDefined();
  await dialog.screenshot({
    path: testInfo.outputPath("workshop-submission.png"),
  });
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(
    workshop.getByRole("button", { name: "Share garden", exact: true }),
  ).toBeFocused();
  await expect(workshop).toHaveAttribute("data-game-fullscreen", "true");
  await workshop
    .getByText("Level title and puzzle rules", { exact: true })
    .click();
  await workshop.getByLabel("Title", { exact: true }).fill("Edited garden");
  await workshop
    .getByRole("button", { name: "Apply level rules", exact: true })
    .click();
  await workshop
    .getByRole("button", { name: "Share garden", exact: true })
    .click();
  await expect(
    dialog.getByRole("button", { name: "Submit for review", exact: true }),
  ).toBeDisabled();
  await page.keyboard.press("Escape");
  await workshop
    .getByRole("button", { name: "Exit full screen", exact: true })
    .click();
  await expect(workshop).not.toHaveAttribute("data-game-fullscreen", "true");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("community selection stays in the game window and preserves fullscreen and keyboard focus", async ({
  page,
}, testInfo) => {
  await page.addInitScript(() => {
    Object.defineProperty(Element.prototype, "requestFullscreen", {
      configurable: true,
      value: () => Promise.reject(new Error("Use viewport fullscreen")),
    });
  });
  await page.route("**/api/waggle-way/gardens", (route) =>
    route.fulfill({ json: { gardens: [card], nextCursor: null } }),
  );
  await page.route(`**/api/waggle-way/gardens/${card.id}`, (route) =>
    route.fulfill({ json: { ...card, level } }),
  );
  await page.route(
    `**/api/waggle-way/gardens/${card.id}/report`,
    async (route) => {
      expect(route.request().method()).toBe("POST");
      expect(route.request().postDataJSON()).toEqual({ reason: "identity" });
      await route.fulfill({ status: 204 });
    },
  );
  await page.goto("/waggle-way");
  await page.getByRole("button", { name: "Play gardens", exact: true }).click();
  const frame = page.getByRole("region", {
    name: "Waggle Way game window",
    exact: true,
  });
  await page
    .getByRole("button", { name: "Enter full screen", exact: true })
    .click();
  await expect(frame).toHaveAttribute("data-game-fullscreen", "true");
  const community = page.getByRole("button", {
    name: "Community gardens",
    exact: true,
  });
  await community.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", {
    name: "Community gardens",
    exact: true,
  });
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(community).toBeFocused();
  await community.click();
  await dialog
    .getByRole("button", { name: /Community clover crossing/ })
    .click();
  await expect(
    dialog.getByRole("heading", { name: level.title, exact: true }),
  ).toBeFocused();
  await dialog.getByText("Report a concern", { exact: true }).click();
  await dialog
    .getByRole("combobox", { name: "Concern", exact: true })
    .selectOption("identity");
  await dialog
    .getByRole("button", { name: "Send report", exact: true })
    .click();
  await expect(dialog.getByRole("status")).toContainText("Report received");
  await dialog.screenshot({
    path: testInfo.outputPath("community-preview.png"),
  });
  await dialog
    .getByRole("button", { name: "Play this garden", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await expect(
    frame.getByRole("heading", { name: level.title, exact: true }),
  ).toBeFocused();
  await expect(frame).toHaveAttribute("data-game-fullscreen", "true");
  await expect(page.locator(".ww-game-window")).toHaveCount(1);
  await frame.getByRole("button", { name: "Open hive", exact: true }).click();
  await frame
    .getByRole("button", { name: "Community gardens", exact: true })
    .click();
  // The modal correctly removes the paused background from the accessibility tree.
  await expect(page.locator(".ww-game-window")).toHaveAttribute(
    "data-paused",
    "true",
  );
  await page.keyboard.press("Escape");
  await expect(
    frame.getByRole("button", { name: "Resume", exact: true }),
  ).toBeVisible();
  await frame
    .getByRole("button", { name: "Back to gardens", exact: true })
    .click();
  await expect(
    frame.getByRole("heading", { name: "First Waggle", exact: true }),
  ).toBeFocused();
  await expect(
    frame.getByRole("button", { name: "Choose adventure garden", exact: true }),
  ).toBeVisible();
  await expect(frame).toHaveAttribute("data-game-fullscreen", "true");
  await expect(
    frame.getByRole("heading", { name: level.title, exact: true }),
  ).toHaveCount(0);
});

test("community filters clear old cursors and replace pages without expanding the game layout", async ({
  page,
}) => {
  await page.route("**/api/waggle-way/gardens{,?*}", async (route) => {
    const query = new URL(route.request().url()).searchParams;
    const next = query.get("cursor");
    if (query.get("difficulty") === "challenging") {
      expect(next).toBeNull();
      await route.fulfill({ json: { gardens: [], nextCursor: null } });
    } else
      await route.fulfill({
        json: {
          gardens: [{ ...card, title: next ? "Second garden" : card.title }],
          nextCursor: next ? null : "next",
        },
      });
  });
  await page.goto("/waggle-way");
  await page.getByRole("button", { name: "Play gardens", exact: true }).click();
  await page
    .getByRole("button", { name: "Community gardens", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Community gardens",
    exact: true,
  });
  await expect(
    dialog.getByRole("button", { name: /Community clover crossing/ }),
  ).toBeVisible();
  await dialog
    .getByRole("button", { name: "More gardens", exact: true })
    .click();
  await expect(
    dialog.getByRole("button", { name: /Second garden/ }),
  ).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: /Community clover crossing/ }),
  ).toHaveCount(0);
  await dialog
    .getByRole("combobox", { name: "Difficulty", exact: true })
    .selectOption("challenging");
  await expect(dialog.getByRole("status")).toContainText(
    "No approved gardens match yet",
  );
  await expect(
    dialog.getByRole("button", { name: "First page", exact: true }),
  ).toHaveCount(0);
  const bounds = await dialog.boundingBox();
  expect(bounds!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
});
