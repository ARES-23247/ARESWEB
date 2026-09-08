import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { CAMPAIGN } from "@ares/waggle-way/campaign";
import { parseLevelFile, serializeLevel } from "@ares/waggle-way/level";
import { readFile } from "node:fs/promises";
import { FIRST_FLIGHT } from "../packages/waggle-way/src/content/redesign";

test("first-flight dancer drags onto open ground and rescues its hive above safe water", async ({
  page,
}, testInfo) => {
  await page.goto("/waggle-way");
  await page.getByRole("button", { name: "Play gardens", exact: true }).click();
  expect(
    await page.evaluate(
      async () => (await document.fonts.load('16px "Waggle Pixel"')).length,
    ),
  ).toBeGreaterThan(0);
  const stock = page.getByRole("button", { name: /^Dancing bee · Point ·/ });
  await stock.scrollIntoViewIfNeeded();
  const source = (await stock.boundingBox())!;
  const target = await page.locator(".ww-scene").evaluate((element) => {
    const matrix = (element as SVGSVGElement).getScreenCTM()!;
    const point = new DOMPoint(10.5, 7.5).matrixTransform(matrix);
    return { x: point.x, y: point.y };
  });
  await page.mouse.move(
    source.x + source.width / 2,
    source.y + source.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(target.x, target.y, { steps: 12 });
  await page.mouse.up();
  await expect(page.locator(".ww-stats")).toContainText("1 Helpers");
  await expect(stock).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Release guide", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Release guide", exact: true }),
  ).toBeInViewport({ ratio: 1 });
  const sceneBefore = await page.locator(".ww-scene").boundingBox();
  const options = page.locator("summary").filter({ hasText: /^Tool options$/ });
  await options.click();
  const heading = page.getByRole("combobox", {
    name: "Heading direction",
    exact: true,
  });
  await expect(heading).toBeVisible();
  expect(await page.locator(".ww-scene").boundingBox()).toEqual(sceneBefore);
  await heading.focus();
  await page.keyboard.press("Escape");
  await expect(heading).not.toBeVisible();
  await expect(options).toBeFocused();
  await expect(options).toHaveCSS("outline-color", "rgb(255, 244, 210)");
  await page
    .locator(".ww-game-window")
    .screenshot({ path: testInfo.outputPath("free-grid-dancer.png") });
  await page
    .getByRole("combobox", { name: "Speed", exact: true })
    .selectOption("3");
  await page.getByRole("button", { name: "Open hive", exact: true }).click();
  const precise = page
    .locator("summary")
    .filter({ hasText: /^Place precisely$/ });
  await precise.click();
  await expect(page.locator(".ww-game-window")).toHaveAttribute(
    "data-paused",
    "true",
  );
  await expect(
    page.getByRole("spinbutton", {
      name: "Tool placement column",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Close place precisely", exact: true })
    .click();
  await expect(precise).toBeFocused();
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  await expect(page.locator(".ww-stats")).toContainText("5/5", {
    timeout: 15000,
  });
  await page
    .getByRole("button", { name: "Release guide", exact: true })
    .click();
  await expect(
    page.getByText("6 bees reached the flowers.", { exact: true }),
  ).toBeVisible({ timeout: 10000 });
  await expect(stock).toBeDisabled();
  await page.getByRole("button", { name: "Next garden", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Two Little Turns", exact: true }),
  ).toBeFocused();
  await page.goto("/waggle-way/builder");
  await showDetails(page, "Files and saved gardens");
  const definition = serializeLevel(FIRST_FLIGHT);
  await page.getByLabel("Import a garden file", { exact: true }).setInputFiles({
    name: "first-flight.json",
    mimeType: "application/json",
    buffer: Buffer.from(definition),
  });
  await expect(page.getByText(/Garden imported\./)).toBeVisible();
  const downloaded = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export garden", exact: true })
    .click();
  expect(await readFile((await (await downloaded).path())!, "utf8")).toBe(
    definition,
  );
  await page.getByRole("button", { name: "Test garden", exact: true }).click();
  await expect(
    page.getByRole("button", { name: /^Dancing bee · Point ·/ }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Return to editor", exact: true })
    .click();
  await expect(page.locator(".ww-workshop-window")).toBeVisible();
});

for (const practice of [
  {
    title: "Two Little Turns",
    stocks: [
      { id: "left-dancer", x: 7, y: 7 },
      { id: "right-dancer", x: 6, y: 3 },
    ],
    helpers: [
      { x: 7, y: 7 },
      { x: 6, y: 3 },
    ],
  },
  {
    title: "Watch the Spray",
    stocks: [
      { id: "pointing-dancer", x: 10, y: 7 },
      { id: "leaf-cover", x: 6, y: 5 },
    ],
    helpers: [{ x: 10, y: 7 }],
  },
]) {
  test(`practice garden ${practice.title} rescues its helpers and saves its result`, async ({
    page,
  }, testInfo) => {
    await page.goto("/waggle-way");
    await page
      .getByRole("button", { name: "Play gardens", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Choose adventure garden", exact: true })
      .click();
    const menu = page.getByRole("dialog", { name: "Adventure gardens" });
    await expect(menu.locator(".ww-practice-list button")).toHaveCount(30);
    await menu
      .getByRole("button", { name: new RegExp(practice.title) })
      .click();
    await expect(
      page.getByRole("heading", { name: practice.title, exact: true }),
    ).toBeFocused();
    if (practice.title === "Two Little Turns") {
      await showDetails(page, /^Place precisely$/);
      await page
        .getByRole("spinbutton", { name: "Tool placement column", exact: true })
        .fill("12");
      await page
        .getByRole("spinbutton", { name: "Tool placement row", exact: true })
        .fill("7");
      await page
        .getByRole("button", { name: "Place supplied tool", exact: true })
        .click();
      await expect(
        page
          .getByRole("status")
          .filter({ hasText: "Dancing guides need dry ground" }),
      ).toBeVisible();
      await expect(page.locator(".ww-stats")).toContainText(/0\s*Helpers/);
      await expect(
        page.getByRole("button", {
          name: /Dancing bee · Left 90° · 1 remaining/,
        }),
      ).toBeEnabled();
      await page
        .getByRole("button", { name: "Close place precisely", exact: true })
        .click();
    }
    for (const stock of practice.stocks) {
      await showDetails(page, /^Place precisely$/);
      await page
        .getByRole("combobox", { name: "Supplied tool", exact: true })
        .selectOption(stock.id);
      await page
        .getByRole("spinbutton", { name: "Tool placement column", exact: true })
        .fill(String(stock.x));
      await page
        .getByRole("spinbutton", { name: "Tool placement row", exact: true })
        .fill(String(stock.y));
      await page
        .getByRole("button", { name: "Place supplied tool", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Close place precisely", exact: true })
        .click();
    }
    if (practice.title === "Two Little Turns") {
      await expect(page.locator('[data-turn-handle="placed-2"]')).toHaveCount(
        0,
      );
      await expect(page.locator('[data-dance-badge="right"]')).toHaveCount(1);
      await showDetails(page, /^Tool options$/);
      await expect(
        page.getByRole("combobox", { name: "Heading direction", exact: true }),
      ).toHaveCount(0);
      await page
        .getByRole("button", { name: "Close tool options", exact: true })
        .click();
    }
    await page
      .locator(".ww-game-window")
      .screenshot({ path: testInfo.outputPath("practice-setup.png") });
    await page
      .getByRole("combobox", { name: "Speed", exact: true })
      .selectOption("3");
    await page.getByRole("button", { name: "Open hive", exact: true }).click();
    for (const [index, helper] of practice.helpers.entries()) {
      const target = 6 - practice.helpers.length + index;
      await expect(page.locator(".ww-stats")).toContainText(`${target}/5`, {
        timeout: 15000,
      });
      await page.getByRole("button", { name: "Pause", exact: true }).click();
      const scene = page.locator(".ww-scene");
      await scene.scrollIntoViewIfNeeded();
      const point = await scene.evaluate((element, cell) => {
        const position = new DOMPoint(
          cell.x + 0.5,
          cell.y + 0.5,
        ).matrixTransform((element as SVGSVGElement).getScreenCTM()!);
        return { x: position.x, y: position.y };
      }, helper);
      await page.mouse.click(point.x, point.y);
      await page
        .getByRole("button", { name: "Release guide", exact: true })
        .click();
      await page.getByRole("button", { name: "Resume", exact: true }).click();
    }
    await expect(
      page.getByText("6 bees reached the flowers.", { exact: true }),
    ).toBeVisible({ timeout: 10000 });
    await page.reload();
    await page
      .getByRole("button", { name: "Play gardens", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Choose adventure garden", exact: true })
      .click();
    await expect(
      page
        .getByRole("dialog", { name: "Adventure gardens" })
        .getByRole("button", { name: new RegExp(practice.title) }),
    ).toContainText("6/6 bees rescued");
  });
}

test("dancer workshop authors mixed dances and preserves them through a winning test and reload", async ({
  page,
}, testInfo) => {
  await page.goto("/waggle-way/builder");
  await showDetails(page, "Files and saved gardens");
  await page.getByRole("button", { name: "New garden", exact: true }).click();
  await expect(page.locator(".ww-grid-workshop")).toBeVisible();
  await page
    .getByRole("button", { name: "Close files and saved gardens", exact: true })
    .click();
  const viewport = page.locator(".ww-scroll-scene");
  const fitOverflow = () =>
    viewport.evaluate((element) => ({
      vertical: element.scrollHeight - element.clientHeight,
      horizontal: element.scrollWidth - element.clientWidth,
    }));
  expect(await fitOverflow()).toEqual({ vertical: 0, horizontal: 0 });
  await page
    .getByRole("combobox", { name: "Zoom", exact: true })
    .selectOption("2");
  expect((await fitOverflow()).horizontal).toBeGreaterThan(0);
  await page
    .getByRole("combobox", { name: "Zoom", exact: true })
    .selectOption("1");
  expect(await fitOverflow()).toEqual({ vertical: 0, horizontal: 0 });
  await showDetails(page, /^Community$/);
  await expect(
    page.getByText(/Community publishing does not support them yet/),
  ).toBeVisible();
  const share = page.getByRole("button", { name: "Share garden", exact: true });
  await share.click();
  await expect(
    page.getByRole("dialog", { name: "Community workshop" }),
  ).toBeVisible();
  await closePanel(page);
  await expect(share).toBeFocused();
  await page
    .getByRole("button", { name: "Close community", exact: true })
    .click();
  const dancer = page.getByRole("button", { name: "Dancing bee", exact: true });
  await dancer.scrollIntoViewIfNeeded();
  // Changing zoom may scroll the controls into view and leave the target above
  // the screen. Bring both ends of this real pointer gesture into view first.
  await viewport.scrollIntoViewIfNeeded();
  await expect(dancer).toBeInViewport({ ratio: 1 });
  const source = (await dancer.boundingBox())!;
  const target = await page.locator(".ww-scene").evaluate((element) => {
    const point = new DOMPoint(6.5, 4.5).matrixTransform(
      (element as SVGSVGElement).getScreenCTM()!,
    );
    return { x: point.x, y: point.y };
  });
  expect(target.y).toBeGreaterThanOrEqual(0);
  expect(target.y).toBeLessThan(page.viewportSize()!.height);
  await page.mouse.move(
    source.x + source.width / 2,
    source.y + source.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(target.x, target.y, { steps: 12 });
  await page.mouse.up();
  await expect(
    page.getByRole("combobox", { name: "Selected object", exact: true }),
  ).toHaveValue("dancer-1");
  await editPiece(page);
  const properties = page.getByRole("dialog", { name: "Object properties" });
  await properties
    .getByRole("combobox", { name: "Dance type", exact: true })
    .selectOption("reverse");
  await properties
    .getByRole("combobox", { name: "Heading", exact: true })
    .selectOption("6");
  await properties
    .getByRole("spinbutton", { name: "Influence range", exact: true })
    .fill("1");
  await properties
    .getByRole("button", { name: "Apply properties", exact: true })
    .click();
  await expect(
    properties.getByRole("combobox", { name: "Dance type", exact: true }),
  ).toHaveValue("reverse");
  await closePanel(page);

  await showDetails(page, "Player tool supply");
  const pointing = page.getByRole("form", {
    name: "Edit pointing-dancer",
    exact: true,
  });
  await expect(
    pointing.getByLabel("Starting fan strength", { exact: true }),
  ).toHaveCount(0);
  await expect(pointing.getByLabel("Tool width", { exact: true })).toHaveCount(
    0,
  );
  await pointing
    .getByRole("spinbutton", { name: "Supply count", exact: true })
    .fill("1");
  await pointing
    .getByRole("button", { name: "Apply supply", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Supply dancing bee", exact: true })
    .click();
  const left = page.getByRole("form", { name: "Edit supply-1", exact: true });
  await left
    .getByRole("combobox", {
      name: "Dance type",
      exact: true,
    })
    .selectOption("left");
  await expect(
    left.getByLabel("Starting direction", { exact: true }),
  ).toHaveCount(0);
  await left
    .getByRole("spinbutton", { name: "Supply count", exact: true })
    .fill("2");
  await left.getByRole("button", { name: "Apply supply", exact: true }).click();
  await page.screenshot({ path: testInfo.outputPath("contextual-supply.png") });
  await page
    .getByRole("button", { name: "Close player tool supply", exact: true })
    .click();
  await showDetails(page, "Level title and puzzle rules");
  await page
    .getByRole("textbox", { name: "Garden ID", exact: true })
    .fill("dancer-workshop-check");
  await page
    .getByRole("textbox", { name: "Title", exact: true })
    .fill("Dance workshop check");
  await page
    .getByRole("button", { name: "Apply level rules", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: "Close level title and puzzle rules",
      exact: true,
    })
    .click();
  await page.getByRole("button", { name: "Save garden", exact: true }).click();
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "Garden saved in this browser" }),
  ).toBeVisible();
  const exportDraft = async () => {
    await showDetails(page, "Files and saved gardens");
    const download = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "Export garden", exact: true })
      .click();
    return readFile((await (await download).path())!, "utf8");
  };
  const before = await exportDraft();
  const authored = parseLevelFile(before);
  expect(authored.rulesVersion).toBe(7);
  expect(
    authored.objects.find((object) => object.kind === "dancer"),
  ).toMatchObject({ x: 6, y: 4, dance: "reverse", direction: 6, range: 1 });
  expect(authored.inventory).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ dance: "point", count: 1 }),
      expect.objectContaining({ dance: "left", count: 2 }),
    ]),
  );
  await page
    .getByRole("button", { name: "Close files and saved gardens", exact: true })
    .click();
  await page
    .locator(".ww-workshop-window")
    .screenshot({ path: testInfo.outputPath("dancer-workshop.png") });
  await page.getByRole("button", { name: "Test garden", exact: true }).click();
  await showDetails(page, /^Place precisely$/);
  await page
    .getByRole("spinbutton", { name: "Tool placement column", exact: true })
    .fill("6");
  await page
    .getByRole("spinbutton", { name: "Tool placement row", exact: true })
    .fill("7");
  await page
    .getByRole("button", { name: "Place supplied tool", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Close place precisely", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: /^Dancing bee · Point ·/ }),
  ).toBeDisabled();
  await page
    .getByRole("combobox", { name: "Speed", exact: true })
    .selectOption("3");
  await page.getByRole("button", { name: "Open hive", exact: true }).click();
  await expect(page.locator(".ww-stats")).toContainText("7/8", {
    timeout: 15000,
  });
  await page
    .getByRole("button", { name: "Release guide", exact: true })
    .click();
  await expect(
    page.getByText("8 bees reached the flowers.", { exact: true }),
  ).toBeVisible({ timeout: 10000 });
  await page
    .getByRole("button", { name: "Return to editor", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Test garden", exact: true }),
  ).toBeFocused();
  expect(await exportDraft()).toBe(before);

  await page.reload();
  await showDetails(page, "Files and saved gardens");
  await page.getByRole("button", { name: "Load library", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Saved gardens", exact: true })
    .selectOption("dancer-workshop-check");
  await expect(page.locator(".ww-grid-workshop")).toBeVisible();
  expect(await exportDraft()).toBe(before);
});

test("pixel title starts a garden by keyboard and carries fullscreen into play", async ({
  page,
}, testInfo) => {
  await page.addInitScript(() =>
    Object.defineProperty(Element.prototype, "requestFullscreen", {
      configurable: true,
      value: () => Promise.reject(new Error("Exercise fullscreen fallback")),
    }),
  );
  await page.goto("/waggle-way");
  const title = page.getByRole("region", { name: "Waggle Way title screen" });
  await expect(title).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Waggle Way", level: 1 }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Open hive", exact: true }),
  ).toHaveCount(0);
  await title.screenshot({ path: testInfo.outputPath("pixel-title.png") });
  await page
    .getByRole("button", { name: "Enter full screen", exact: true })
    .click();
  await expect(title).toHaveAttribute("data-game-fullscreen", "true");
  const start = page.getByRole("button", { name: "Play gardens", exact: true });
  await start.focus();
  await page.keyboard.press("Enter");
  await expect(title).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "First Waggle", level: 2 }),
  ).toBeFocused();
  const frame = page.getByRole("region", {
    name: "Waggle Way game window",
    exact: true,
  });
  await expect(frame).toHaveAttribute("data-game-fullscreen", "true");
  await expect(frame.locator(".ww-scene image")).toHaveCount(0);
  const originalViewport = page.viewportSize()!;
  await page.setViewportSize({ ...originalViewport, height: 360 });
  await expect
    .poll(async () => Math.round((await frame.boundingBox())!.height))
    .toBe(360);
  await expect(
    page.getByRole("button", { name: "Exit full screen", exact: true }),
  ).toBeInViewport({ ratio: 1 });
  await expect(
    page.getByRole("button", { name: "Open hive", exact: true }),
  ).toBeInViewport({ ratio: 1 });
  await page.setViewportSize(originalViewport);
  await page
    .getByRole("button", { name: "Exit full screen", exact: true })
    .click();
  await expect(frame).not.toHaveAttribute("data-game-fullscreen", "true");
});

test("one game window keeps panels contained and fullscreen survives changing gardens", async ({
  page,
}, testInfo) => {
  await page.addInitScript(() => {
    Object.defineProperty(Element.prototype, "requestFullscreen", {
      configurable: true,
      value: () => Promise.reject(new Error("Native fullscreen unavailable")),
    });
  });
  await page.goto("/waggle-way");
  await page.getByRole("button", { name: "Play gardens", exact: true }).click();
  const frame = page.getByRole("region", {
    name: "Waggle Way game window",
    exact: true,
  });
  await expect(frame).toBeVisible();
  const initial = await frame.boundingBox();
  const mission = page.locator("summary").filter({ hasText: /^Mission$/ });
  await mission.click();
  await expect(page.locator(".ww-mission .ww-panel-content")).toBeVisible();
  expect((await frame.boundingBox())!.height).toBe(initial!.height);
  await mission.focus();
  await page.keyboard.press("Escape");
  await expect(page.locator(".ww-mission")).not.toHaveAttribute("open", "");
  await expect(mission).toBeFocused();
  await page
    .getByRole("button", { name: "Enter full screen", exact: true })
    .click();
  await expect(frame).toHaveAttribute("data-game-fullscreen", "true");
  const bounds = await frame.boundingBox();
  expect(bounds!.x).toBe(0);
  expect(bounds!.y).toBe(0);
  expect(bounds!.width).toBe(page.viewportSize()!.width);
  expect(bounds!.height).toBe(page.viewportSize()!.height);
  await mission.click();
  await page.keyboard.press("Escape");
  await expect(frame).toHaveAttribute("data-game-fullscreen", "true");
  await openMap(page);
  await expect(
    page.getByRole("dialog", { name: "Adventure gardens" }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Two Little Turns/ }).click();
  await expect(
    page.getByRole("heading", { name: "Two Little Turns", exact: true }),
  ).toBeFocused();
  await expect(frame).toHaveAttribute("data-game-fullscreen", "true");
  await frame.screenshot({ path: testInfo.outputPath("game-fullscreen.png") });
  await page
    .getByRole("button", { name: "Exit full screen", exact: true })
    .click();
  await expect(frame).not.toHaveAttribute("data-game-fullscreen", "true");
  await frame.screenshot({ path: testInfo.outputPath("game-window.png") });
});

test("ghost comparison reviews a failed attempt without changing the new hive", async ({
  page,
}, testInfo) => {
  await page.goto("/waggle-way");
  await page.getByRole("button", { name: "Play gardens", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Speed", exact: true })
    .selectOption("3");
  await page.getByRole("button", { name: "Open hive", exact: true }).click();
  await expect(
    page.getByText("This attempt is over. Restart to try another route.", {
      exact: true,
    }),
  ).toBeVisible({ timeout: 15000 });
  await page.getByRole("button", { name: "Restart", exact: true }).click();
  const compare = page.getByRole("button", {
    name: "Compare previous attempt",
    exact: true,
  });
  await expect(compare).toHaveAttribute("aria-pressed", "false");
  await compare.focus();
  await page.keyboard.press("Enter");
  const summary = page.locator(".ww-ghost-summary");
  await expect(summary).toContainText("tick 0:");
  const timeline = page.getByRole("slider", {
    name: "Previous attempt time",
    exact: true,
  });
  await timeline.focus();
  await page.keyboard.press("End");
  await expect(summary).toContainText("6 lost");
  await expect(summary).toContainText("Recording ends here");
  await expect(page.locator(".ww-stats")).toContainText("6 In hive");
  await page
    .getByRole("button", { name: "Match current run", exact: true })
    .click();
  await expect(summary).toContainText("tick 0:");
  await placeFirstDancer(page);
  await showDetails(page, /^Tool options$/);
  await page
    .getByRole("button", { name: "Step one tick", exact: true })
    .click();
  await expect(summary).toContainText("tick 1:");
  await expect(page.locator("[data-ghost-bee]")).toHaveCount(1);
  await page
    .locator(".ww-session")
    .screenshot({ path: testInfo.outputPath("ghost-outlines.png") });
  await page
    .getByRole("button", { name: "Close tool options", exact: true })
    .click();
  await showDetails(page, /^Bees$/);
  await expect(page.getByText(/^Ghost G1: flying;/)).toBeVisible();
  await expect(page.getByText(/^Bee 1: assigned;/)).toBeVisible();
  await page.waitForTimeout(250); // More than seven engine ticks; a paused comparison must stay at tick 1.
  await expect(summary).toContainText("tick 1:");
  await page
    .locator("summary")
    .filter({ hasText: /^Bees$/ })
    .click();
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  await expect(timeline).toBeDisabled();
  await expect(page.locator(".ww-stats")).toContainText("5/5", {
    timeout: 15000,
  });
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await expect(summary).toContainText("0 rescued");
  await page
    .locator(".ww-session")
    .screenshot({ path: testInfo.outputPath("ghost-comparison.png") });
  await compare.click();
  await expect(page.locator("[data-ghost-bee]")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Release guide", exact: true })
    .click();
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  await expect(
    page.getByText("6 bees reached the flowers.", { exact: true }),
  ).toBeVisible({ timeout: 10000 });
  await page.getByRole("button", { name: "Next garden", exact: true }).click();
  await expect(compare).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Two Little Turns", exact: true }),
  ).toBeVisible();
});

async function closePanel(page: Page) {
  const dialog = page.getByRole("dialog");
  if (await dialog.isVisible())
    await dialog
      .getByRole("button", { name: "Close dialog", exact: true })
      .click();
  else {
    const close = page.getByRole("button", { name: /^Close / }).first();
    if (await close.isVisible()) await close.click();
  }
}
async function openMap(page: Page) {
  if (
    !(await page.getByRole("dialog", { name: "Adventure gardens" }).isVisible())
  )
    await page
      .getByRole("button", { name: "Choose adventure garden", exact: true })
      .click();
}
async function showDetails(page: Page, title: string | RegExp) {
  const summary = page.locator("summary").filter({ hasText: title });
  const ancestors = summary.locator("xpath=ancestor::details");
  for (let i = 0; i < (await ancestors.count()) - 1; i++) {
    const ancestor = ancestors.nth(i);
    if ((await ancestor.getAttribute("open")) === null)
      await ancestor.locator(":scope > summary").click();
  }
  if ((await summary.locator("..").getAttribute("open")) === null)
    await summary.click();
}
async function editPiece(page: Page) {
  if (
    !(await page.getByRole("dialog", { name: "Object properties" }).isVisible())
  )
    await page.getByRole("button", { name: "Edit piece", exact: true }).click();
}

test("builder edits, tests, saves, exports, imports, and preserves a rejected draft", async ({
  page,
}, testInfo) => {
  await page.goto("/waggle-way/builder");
  await closePanel(page);
  await page.getByRole("button", { name: "Dancing bee", exact: true }).click();
  await showDetails(page, "Place by coordinates");
  await page.getByLabel("Placement column", { exact: true }).fill("6");
  await showDetails(page, "Place by coordinates");
  await page.getByLabel("Placement row", { exact: true }).fill("7");
  const place = page.getByRole("button", {
    name: "Place selected piece",
    exact: true,
  });
  await place.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("combobox", { name: "Selected object", exact: true }),
  ).toHaveValue("dancer-1");
  await closePanel(page);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(
    page
      .getByRole("combobox", { name: "Selected object", exact: true })
      .locator("option"),
  ).toHaveCount(3);
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Selected object", exact: true })
    .selectOption("dancer-1");
  await page.getByRole("button", { name: "Save garden", exact: true }).click();
  const downloadWait = page.waitForEvent("download");
  await showDetails(page, "Files and saved gardens");
  await page
    .getByRole("button", { name: "Export garden", exact: true })
    .click();
  const file = await downloadWait;
  const path = await file.path();
  expect(path).toBeTruthy();
  await closePanel(page);
  await page.getByRole("button", { name: "Test garden", exact: true }).click();
  await closePanel(page);
  await page.getByRole("button", { name: "Assign guide", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Speed", exact: true })
    .selectOption("3");
  await closePanel(page);
  await page.getByRole("button", { name: "Open hive", exact: true }).click();
  await expect(page.locator(".ww-stats")).toContainText("7/8", {
    timeout: 15000,
  });
  await page
    .getByRole("button", { name: "Release guide", exact: true })
    .click();
  await expect(
    page.getByText("8 bees reached the flowers.", { exact: true }),
  ).toBeVisible({ timeout: 10000 });
  await page
    .getByRole("button", { name: "Return to editor", exact: true })
    .click();
  await expect(
    page.getByRole("combobox", { name: "Selected object", exact: true }),
  ).toHaveValue("dancer-1");
  await page.reload();
  await showDetails(page, "Files and saved gardens");
  await page.getByRole("button", { name: "Load library", exact: true }).click();
  await showDetails(page, "Files and saved gardens");
  await page
    .getByRole("combobox", { name: "Saved gardens", exact: true })
    .selectOption("my-garden");
  await expect(
    page
      .getByRole("combobox", { name: "Selected object", exact: true })
      .locator("option"),
  ).toHaveCount(4);
  await page.getByLabel("Import a garden file", { exact: true }).setInputFiles({
    name: "invalid.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"schemaVersion":999}'),
  });
  await expect(page.getByRole("alert")).toContainText("unsupported");
  await expect(
    page
      .getByRole("combobox", { name: "Selected object", exact: true })
      .locator("option"),
  ).toHaveCount(4);
  await page
    .getByLabel("Import a garden file", { exact: true })
    .setInputFiles(path!);
  await expect(page.getByText(/Garden imported\./)).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page
    .locator(".ww-page")
    .screenshot({ path: testInfo.outputPath("garden-workshop.png") });
});

test("a dance turns the swarm upward and the last guide follows it home", async ({
  page,
}) => {
  await page.goto("/waggle-way/builder");
  const selection = page.getByRole("combobox", {
    name: "Selected object",
    exact: true,
  });
  await closePanel(page);
  await selection.selectOption("flowers");
  await editPiece(page);
  await page.getByRole("spinbutton", { name: "Column", exact: true }).fill("4");
  await editPiece(page);
  await page.getByRole("spinbutton", { name: "Row", exact: true }).fill("2");
  await editPiece(page);
  await page.getByRole("spinbutton", { name: "Width", exact: true }).fill("3");
  await page
    .getByRole("button", { name: "Apply properties", exact: true })
    .click();
  await closePanel(page);
  await page.getByRole("button", { name: "Dancing bee", exact: true }).click();
  await showDetails(page, "Place by coordinates");
  await page.getByLabel("Placement column", { exact: true }).fill("6");
  await showDetails(page, "Place by coordinates");
  await page.getByLabel("Placement row", { exact: true }).fill("7");
  await page
    .getByRole("button", { name: "Place selected piece", exact: true })
    .click();
  await editPiece(page);
  await page
    .getByRole("combobox", { name: "Heading", exact: true })
    .selectOption("6");
  await page
    .getByRole("button", { name: "Apply properties", exact: true })
    .click();
  await closePanel(page);
  await page.getByRole("button", { name: "Test garden", exact: true }).click();
  await closePanel(page);
  await page.getByRole("button", { name: "Assign guide", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Speed", exact: true })
    .selectOption("3");
  await closePanel(page);
  await page.getByRole("button", { name: "Open hive", exact: true }).click();
  await expect(page.locator(".ww-stats")).toContainText("7/8", {
    timeout: 15000,
  });
  await page
    .getByRole("button", { name: "Release guide", exact: true })
    .click();
  await expect(
    page.getByText("8 bees reached the flowers.", { exact: true }),
  ).toBeVisible();
});

test("preferences, keyboard preview, fullscreen and unreadable progress stay usable", async ({
  page,
}) => {
  await page.goto("/waggle-way");
  await page.getByRole("button", { name: "Play gardens", exact: true }).click();
  await showDetails(page, /^Sound$/);
  await page.getByLabel("Reduce extra animation", { exact: true }).check();
  await page
    .locator("summary")
    .filter({ hasText: /^Sound$/ })
    .click();
  await closePanel(page);
  await placeFirstDancer(page, 7);
  await showDetails(page, /^Tool options$/);
  const direction = page.getByRole("combobox", {
    name: "Heading direction",
    exact: true,
  });
  await direction.focus();
  await page.keyboard.press("End");
  await page.keyboard.press("ArrowUp");
  await expect(direction).toHaveValue("6");
  await page
    .getByRole("button", { name: "Close tool options", exact: true })
    .click();
  await showDetails(page, /^View$/);
  await page
    .getByLabel("Preview next three seconds while paused", { exact: true })
    .check();
  await expect(
    page.getByText("Preview ready for the current setup.", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".ww-preview")).toBeVisible();
  await page
    .getByRole("button", { name: "Enter full screen", exact: true })
    .click();
  await expect(page.locator(".ww-session")).toHaveAttribute(
    "data-game-fullscreen",
    "true",
  );
  await page
    .getByRole("button", { name: "Exit full screen", exact: true })
    .click();
  await page.reload();
  await page.getByRole("button", { name: "Play gardens", exact: true }).click();
  await showDetails(page, /^Sound$/);
  await expect(
    page.getByLabel("Reduce extra animation", { exact: true }),
  ).toBeChecked();
  await page.evaluate(() =>
    localStorage.setItem("ares.waggle-way.progress.v1", '{"version":999}'),
  );
  await page.reload();
  await page.getByRole("button", { name: "Play gardens", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("preserved");
  await openMap(page);
  await page.getByRole("button", { name: /5 Watch the Spray/ }).click();
  await closePanel(page);
  await expect(
    page.getByRole("heading", { name: "Watch the Spray", exact: true }),
  ).toBeFocused();
  expect(
    await page.evaluate(() =>
      localStorage.getItem("ares.waggle-way.progress.v1"),
    ),
  ).toBe('{"version":999}');
});

// Bound each browser case while retaining import/export/play coverage for all 30 maps.
for (let offset = 0; offset < CAMPAIGN.length; offset += 6) {
  test(`campaign puzzles ${offset + 1}–${offset + 6} round-trip through the player workshop`, async ({
    page,
  }, testInfo) => {
    await page.goto("/waggle-way/builder");
    await showDetails(page, "Files and saved gardens");
    for (const puzzle of CAMPAIGN.slice(offset, offset + 6)) {
      await showDetails(page, "Files and saved gardens");
      const definition = serializeLevel(puzzle.level);
      await page
        .getByLabel("Import a garden file", { exact: true })
        .setInputFiles({
          name: `${puzzle.level.id}.json`,
          mimeType: "application/json",
          buffer: Buffer.from(definition),
        });
      await expect(page.getByText(/Garden imported\./)).toBeVisible();
      await showDetails(page, "Files and saved gardens");
      const downloaded = page.waitForEvent("download");
      await page
        .getByRole("button", { name: "Export garden", exact: true })
        .click();
      const path = await (await downloaded).path();
      expect(await readFile(path!, "utf8")).toBe(definition);
      await page
        .getByRole("button", { name: "Test garden", exact: true })
        .click();
      await expect(
        page.getByRole("heading", { name: puzzle.level.title, exact: true }),
      ).toBeVisible();
      if (puzzle.number === 30)
        await page
          .locator(".ww-session")
          .screenshot({ path: testInfo.outputPath("wildflower-finale.png") });
      await page
        .getByRole("button", { name: "Return to editor", exact: true })
        .click();
    }
  });
}

test("a supplied shelter can be placed and returned before a spray crossing", async ({
  page,
}) => {
  await page.goto("/waggle-way");
  await page.getByRole("button", { name: "Play gardens", exact: true }).click();
  await openMap(page);
  await page.getByRole("button", { name: /5 Watch the Spray/ }).click();
  await showDetails(page, /^Place precisely$/);
  const supply = page.getByRole("combobox", {
    name: "Supplied tool",
    exact: true,
  });
  await supply.selectOption("leaf-cover");
  await page.getByLabel("Tool placement column", { exact: true }).fill("6");
  await page.getByLabel("Tool placement row", { exact: true }).fill("5");
  await page
    .getByRole("button", { name: "Place supplied tool", exact: true })
    .click();
  await expect(supply.locator("option:checked")).toContainText("0 remaining");
  await page
    .getByRole("button", { name: "Close place precisely", exact: true })
    .click();
  await showDetails(page, /^Tool options$/);
  await page
    .getByRole("button", { name: "Return tool to supply", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Close tool options", exact: true })
    .click();
  await showDetails(page, /^Place precisely$/);
  await expect(supply.locator("option:checked")).toContainText("1 remaining");
});

test("current garden authored supplies survive testing and export", async ({
  page,
}) => {
  await page.goto("/waggle-way/builder");
  await showDetails(page, "Player tool supply");
  await page
    .getByRole("button", { name: "Supply shelter leaf", exact: true })
    .click();
  await page
    .getByRole("form", { name: "Edit supply-1", exact: true })
    .getByLabel("Supply count", { exact: true })
    .fill("2");
  await page
    .getByRole("form", { name: "Edit supply-1", exact: true })
    .getByRole("button", { name: "Apply supply", exact: true })
    .click();
  await closePanel(page);
  await closePanel(page);
  await page.getByRole("button", { name: "Landscape", exact: true }).click();
  await page.getByRole("button", { name: "Shelter leaf", exact: true }).click();
  await showDetails(page, "Place by coordinates");
  await page.getByLabel("Placement column", { exact: true }).fill("1");
  await showDetails(page, "Place by coordinates");
  await page.getByLabel("Placement row", { exact: true }).fill("2");
  await page
    .getByRole("button", { name: "Place selected piece", exact: true })
    .click();
  await editPiece(page);
  await page
    .getByRole("button", { name: "Rotate shape 90°", exact: true })
    .click();
  await editPiece(page);
  await expect(
    page.getByRole("spinbutton", { name: "Width", exact: true }),
  ).toHaveValue("1");
  await editPiece(page);
  await expect(
    page.getByRole("spinbutton", { name: "Height", exact: true }),
  ).toHaveValue("3");
  await closePanel(page);
  await page.getByRole("button", { name: "Test garden", exact: true }).click();
  await closePanel(page);
  await showDetails(page, /^Place precisely$/);
  await page
    .getByRole("combobox", { name: "Supplied tool", exact: true })
    .selectOption("supply-1");
  await expect(
    page
      .getByRole("combobox", { name: "Supplied tool", exact: true })
      .locator("option:checked"),
  ).toContainText("2 remaining");
  await page
    .getByRole("button", { name: "Return to editor", exact: true })
    .click();
  const downloaded = page.waitForEvent("download");
  await showDetails(page, "Files and saved gardens");
  await page
    .getByRole("button", { name: "Export garden", exact: true })
    .click();
  const raw = await readFile((await (await downloaded).path())!, "utf8");
  const exported = JSON.parse(raw);
  expect(exported.schemaVersion).toBe(7);
  expect(
    exported.inventory.find((tool: { id: string }) => tool.id === "supply-1")
      .count,
  ).toBe(2);
  expect(
    exported.objects.find(
      (object: { kind: string }) => object.kind === "shelter",
    ),
  ).toMatchObject({ width: 1, height: 3 });
});

test("workshop builds linked gates and a rally, rescues the operator, and protects links", async ({
  page,
}, testInfo) => {
  await page.goto("/waggle-way/builder");
  const selected = page.getByRole("combobox", {
    name: "Selected object",
    exact: true,
  });
  await showDetails(page, "Place by coordinates");
  for (const [name, column, row] of [
    ["Switch flower", "18", "7"],
    ["Linked gate", "10", "7"],
    ["Rally flower", "6", "7"],
  ]) {
    await closePanel(page);
    await page
      .getByRole("button", {
        name: name === "Rally flower" ? "Guidance" : "Machines",
        exact: true,
      })
      .click();
    await page.getByRole("button", { name, exact: true }).click();
    await showDetails(page, "Place by coordinates");
    await page.getByLabel("Placement column", { exact: true }).fill(column);
    await page.getByLabel("Placement row", { exact: true }).fill(row);
    await page
      .getByRole("button", { name: "Place selected piece", exact: true })
      .click();
  }
  await closePanel(page);
  await closePanel(page);
  await selected.selectOption("gate-1");
  await editPiece(page);
  await expect(
    page.getByRole("combobox", { name: "Operated by switch", exact: true }),
  ).toHaveValue("switch-1");
  await closePanel(page);
  await closePanel(page);
  await selected.selectOption("switch-1");
  await editPiece(page);
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("operates gates gate-1");
  await closePanel(page);
  await page.getByRole("button", { name: "Test garden", exact: true }).click();
  await page
    .getByRole("button", { name: "Assign operator", exact: true })
    .click();
  await showDetails(page, /choose another/);
  await page
    .getByRole("combobox", { name: "Inspect object", exact: true })
    .selectOption("gate-1");
  await expect(page.getByText(/Gate open\./)).toBeVisible();
  await page
    .getByRole("combobox", { name: "Speed", exact: true })
    .selectOption("3");
  await showDetails(page, /choose another/);
  await page
    .getByRole("combobox", { name: "Inspect object", exact: true })
    .selectOption("rally-1");
  await page
    .getByRole("button", { name: "Close tool options", exact: true })
    .click();
  await page.getByRole("button", { name: "Open hive", exact: true }).click();
  await expect(page.locator(".ww-stats")).toContainText("7 Waiting", {
    timeout: 15000,
  });
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await showDetails(page, /^Tool options$/);
  await expect(page.getByText(/7 bees waiting/)).toBeVisible();
  const release = page.getByRole("button", {
    name: "Release rally",
    exact: true,
  });
  await release.focus();
  await page.keyboard.press("Enter");
  await page
    .getByRole("button", { name: "Close tool options", exact: true })
    .click();
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  await expect(page.locator(".ww-stats")).toContainText("7/8", {
    timeout: 15000,
  });
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await showDetails(page, /choose another/);
  await page
    .getByRole("combobox", { name: "Inspect object", exact: true })
    .selectOption("switch-1");
  await page
    .getByRole("button", { name: "Close tool options", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Release operator", exact: true })
    .click();
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  await expect(
    page.getByText("8 bees reached the flowers.", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Enter full screen", exact: true })
    .click();
  await page
    .locator(".ww-session")
    .screenshot({ path: testInfo.outputPath("glasshouse-rescue.png") });
  await page
    .getByRole("button", { name: "Exit full screen", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Return to editor", exact: true })
    .click();
  await closePanel(page);
  await closePanel(page);
  await selected.selectOption("gate-1");
  await editPiece(page);
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await closePanel(page);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await editPiece(page);
  await expect(
    page.getByRole("combobox", { name: "Operated by switch", exact: true }),
  ).toHaveValue("switch-1");
});

test("workshop authors predictable rain and a canopy, freezes time and preserves the cycle", async ({
  page,
}, testInfo) => {
  await page.goto("/waggle-way/builder");
  await closePanel(page);
  await page.getByRole("button", { name: "Machines", exact: true }).click();
  await page
    .getByRole("button", { name: "Timed sprinkler", exact: true })
    .click();
  await showDetails(page, "Place by coordinates");
  await page.getByLabel("Placement column", { exact: true }).fill("10");
  await showDetails(page, "Place by coordinates");
  await page.getByLabel("Placement row", { exact: true }).fill("1");
  await page
    .getByRole("button", { name: "Place selected piece", exact: true })
    .click();
  const properties = page.getByRole("dialog", {
    name: "Object properties",
  });
  await editPiece(page);
  await properties.getByLabel("Width", { exact: true }).fill("3");
  await editPiece(page);
  await properties.getByLabel("Rain range", { exact: true }).fill("16");
  await editPiece(page);
  await properties.getByLabel("Dry ticks", { exact: true }).fill("30");
  await editPiece(page);
  await properties.getByLabel("Warning ticks", { exact: true }).fill("30");
  await editPiece(page);
  await properties.getByLabel("Rain ticks", { exact: true }).fill("900");
  await editPiece(page);
  await properties.getByLabel("Cycle offset", { exact: true }).fill("60");
  await page
    .getByRole("button", { name: "Apply properties", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("Rain".toLowerCase());
  await editPiece(page);
  await properties.getByLabel("Rain range", { exact: true }).fill("10");
  await page
    .getByRole("button", { name: "Apply properties", exact: true })
    .click();
  await closePanel(page);
  await closePanel(page);
  await page.getByRole("button", { name: "Landscape", exact: true }).click();
  await page.getByRole("button", { name: "Shelter leaf", exact: true }).click();
  await showDetails(page, "Place by coordinates");
  await page.getByLabel("Placement column", { exact: true }).fill("10");
  await showDetails(page, "Place by coordinates");
  await page.getByLabel("Placement row", { exact: true }).fill("5");
  await page
    .getByRole("button", { name: "Place selected piece", exact: true })
    .click();
  await closePanel(page);
  await page.getByRole("button", { name: "Test garden", exact: true }).click();
  const forecast = page
    .locator("details")
    .filter({ has: page.getByText("Spray", { exact: true }) });
  await expect(forecast).toContainText("rain, 900 ticks until dry");
  await showDetails(page, /^Tool options$/);
  await page
    .getByRole("button", { name: "Step one tick", exact: true })
    .click();
  await expect(forecast).toContainText("rain, 899 ticks until dry");
  await page.waitForTimeout(150);
  await expect(forecast).toContainText("rain, 899 ticks until dry");
  await page
    .getByRole("button", { name: "Step one tick", exact: true })
    .focus();
  await page.keyboard.press("Enter");
  await expect(forecast).toContainText("rain, 898 ticks until dry");
  await page
    .getByRole("button", { name: "Close tool options", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Enter full screen", exact: true })
    .click();
  await page
    .locator(".ww-session")
    .screenshot({ path: testInfo.outputPath("rainy-canopy.png") });
  await page
    .getByRole("button", { name: "Exit full screen", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Speed", exact: true })
    .selectOption("3");
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  await expect(
    page.getByText("8 bees reached the flowers.", { exact: true }),
  ).toBeVisible({ timeout: 15000 });
  await page
    .getByRole("button", { name: "Return to editor", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Selected object", exact: true })
    .selectOption("sprinkler-1");
  await editPiece(page);
  await expect(
    properties.getByLabel("Cycle offset", { exact: true }),
  ).toHaveValue("60");
  await editPiece(page);
  await expect(
    properties.getByLabel("Rain range", { exact: true }),
  ).toHaveValue("10");
});

test("dragging tools and turning arrows works alongside tap and keyboard controls", async ({
  page,
}, testInfo) => {
  await page.goto("/waggle-way/builder");
  const scene = page.locator(".ww-scene");
  await scene.scrollIntoViewIfNeeded();
  const target = await scene.evaluate((svg: SVGSVGElement) => {
    const p = svg.createSVGPoint();
    p.x = 6.5;
    p.y = 7.5;
    const screen = p.matrixTransform(svg.getScreenCTM()!);
    return { x: screen.x, y: screen.y };
  });
  const tool = page.getByRole("button", { name: "Dancing bee", exact: true });
  // Exercise real pointer movement from the tray into SVG.
  await tool.dragTo(scene, {
    targetPosition: {
      x: target.x - (await scene.boundingBox())!.x,
      y: target.y - (await scene.boundingBox())!.y,
    },
  });
  await expect(
    page.getByRole("combobox", { name: "Selected object", exact: true }),
  ).toHaveValue("dancer-1");
  const handle = page.locator('[data-turn-handle="dancer-1"]');
  await handle.scrollIntoViewIfNeeded();
  const turnTarget = await scene.evaluate((svg: SVGSVGElement) => {
    const p = svg.createSVGPoint();
    p.x = 6.5;
    p.y = 5.8;
    const v = p.matrixTransform(svg.getScreenCTM()!);
    return { x: v.x, y: v.y };
  });
  const knob = (await handle.boundingBox())!;
  await page.mouse.move(knob.x + knob.width / 2, knob.y + knob.height / 2);
  await page.mouse.down();
  await page.mouse.move(turnTarget.x, turnTarget.y, { steps: 8 });
  await page.mouse.up();
  await editPiece(page);
  await expect(
    page.getByRole("combobox", { name: "Heading", exact: true }),
  ).toHaveValue("6");
  await page.getByRole("combobox", { name: "Heading", exact: true }).focus();
  await page.keyboard.press("Home");
  await expect(
    page.getByRole("combobox", { name: "Heading", exact: true }),
  ).toHaveValue("0");
  await page
    .getByRole("button", { name: "Apply properties", exact: true })
    .click();
  await closePanel(page);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await editPiece(page);
  await expect(
    page.getByRole("combobox", { name: "Heading", exact: true }),
  ).toHaveValue("6");
  await closePanel(page);
  await scene.scrollIntoViewIfNeeded();
  const movePoints = await scene.evaluate((svg: SVGSVGElement) => {
    const p = svg.createSVGPoint();
    p.x = 6.5;
    p.y = 7.5;
    const start = p.matrixTransform(svg.getScreenCTM()!);
    p.x = 7.5;
    const end = p.matrixTransform(svg.getScreenCTM()!);
    return { start: { x: start.x, y: start.y }, end: { x: end.x, y: end.y } };
  });
  await page.mouse.move(movePoints.start.x, movePoints.start.y);
  await page.mouse.down();
  await page.mouse.move(movePoints.end.x, movePoints.end.y, { steps: 8 });
  await expect(scene.locator(".ww-selected")).toHaveAttribute(
    "transform",
    "translate(7 7)",
  );
  await page.mouse.up();
  await expect(scene.locator(".ww-selected")).toHaveAttribute(
    "transform",
    "translate(7 7)",
  );
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(scene.locator(".ww-selected")).toHaveAttribute(
    "transform",
    "translate(6 7)",
  );
  await page.getByRole("button", { name: "Fan", exact: true }).click();
  await scene.click({
    position: await scene.evaluate((svg: SVGSVGElement) => {
      const p = svg.createSVGPoint();
      p.x = 10.5;
      p.y = 4.5;
      const v = p.matrixTransform(svg.getScreenCTM()!);
      const b = svg.getBoundingClientRect();
      return { x: v.x - b.x, y: v.y - b.y };
    }),
  });
  await expect(
    page.getByRole("combobox", { name: "Selected object", exact: true }),
  ).toHaveValue("fan-1");
  await page.getByRole("button", { name: "Test garden", exact: true }).click();
  await page
    .locator(".ww-session")
    .screenshot({ path: testInfo.outputPath("overhead-direct-controls.png") });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("pollen and a garden theme survive authoring, delivery and reopening", async ({
  page,
}, testInfo) => {
  await page.goto("/waggle-way/builder");
  const scene = page.locator(".ww-scene");
  await scene.scrollIntoViewIfNeeded();
  const target = await scene.evaluate((svg: SVGSVGElement) => {
    const point = svg.createSVGPoint();
    point.x = 4.5;
    point.y = 7.5;
    const screen = point.matrixTransform(svg.getScreenCTM()!);
    return { x: screen.x, y: screen.y };
  });
  const bounds = (await scene.boundingBox())!;
  await page.getByRole("button", { name: "Landscape", exact: true }).click();
  await page
    .getByRole("button", { name: "Pollen", exact: true })
    .dragTo(scene, {
      targetPosition: { x: target.x - bounds.x, y: target.y - bounds.y },
    });
  await expect(
    page.getByRole("combobox", { name: "Selected object", exact: true }),
  ).toHaveValue("pollen-1");
  await showDetails(page, "Level title and puzzle rules");
  await page
    .getByRole("combobox", { name: "Garden theme", exact: true })
    .selectOption("wildflower");
  await page.getByLabel("Pollen delivery target", { exact: true }).fill("1");
  await page
    .getByRole("button", { name: "Apply level rules", exact: true })
    .click();
  await expect(scene.locator('pattern[id^="ground-"] > rect')).toHaveAttribute(
    "fill",
    "#537947",
  );
  await expect(scene.locator(".ww-ground-flowers path")).toHaveCount(1);
  await page.getByRole("button", { name: "Save garden", exact: true }).click();
  await showDetails(page, "Files and saved gardens");
  const downloadWait = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export garden", exact: true })
    .click();
  const file = await downloadWait;
  const exported = JSON.parse(await readFile((await file.path())!, "utf8"));
  expect(exported).toMatchObject({
    schemaVersion: 7,
    theme: "wildflower",
    objectives: { pollen: 1 },
  });
  await page.getByRole("button", { name: "Test garden", exact: true }).click();
  const goals = page.locator(".ww-optional-goals");
  await expect(goals).toContainText("1 available");
  await page
    .getByRole("combobox", { name: "Speed", exact: true })
    .selectOption("3");
  await page.getByRole("button", { name: "Open hive", exact: true }).click();
  await expect(goals).toContainText("1 carried");
  await expect(goals).toContainText("1 delivered", { timeout: 15000 });
  await expect(goals).toContainText("Goal achieved", { timeout: 15000 });
  await page
    .locator(".ww-session")
    .screenshot({ path: testInfo.outputPath("wildflower-pollen.png") });
  await page
    .getByRole("button", { name: "Return to editor", exact: true })
    .click();
  await page.reload();
  await showDetails(page, "Files and saved gardens");
  await page.getByRole("button", { name: "Load library", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Saved gardens", exact: true })
    .selectOption(exported.id);
  await showDetails(page, "Level title and puzzle rules");
  await expect(
    page.getByRole("combobox", { name: "Garden theme", exact: true }),
  ).toHaveValue("wildflower");
  await expect(
    page.getByLabel("Pollen delivery target", { exact: true }),
  ).toHaveValue("1");
  await expect(scene.locator('pattern[id^="ground-"] > rect')).toHaveAttribute(
    "fill",
    "#537947",
  );
  await expect(scene.locator(".ww-ground-flowers path")).toHaveCount(1);
});

test("large adventure board pans without placing tools and finds offscreen helpers", async ({
  page,
}, testInfo) => {
  await page.goto("/waggle-way");
  await page.getByRole("button", { name: "Play gardens", exact: true }).click();
  await page.getByRole("button", { name: "Choose adventure garden" }).click();
  await page
    .getByRole("dialog", { name: "Adventure gardens" })
    .getByRole("button", { name: /Two Doors/ })
    .click();
  const camera = page.getByRole("group", { name: "Board camera" });
  const viewport = page.getByRole("region", { name: /^Garden viewport/ });
  await camera.getByRole("button", { name: "Zoom in on board" }).click();
  await camera.getByRole("button", { name: "Flowers", exact: true }).click();
  await expect
    .poll(() => viewport.evaluate((element) => element.scrollLeft))
    .toBeGreaterThan(0);
  const before = await viewport.evaluate((element) => element.scrollLeft);
  await camera.getByRole("button", { name: "Pan board", exact: true }).click();
  await viewport.scrollIntoViewIfNeeded();
  const bounds = (await viewport.boundingBox())!;
  const from = {
    x: bounds.x + bounds.width * 0.25,
    y: bounds.y + bounds.height * 0.5,
  };
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + Math.min(180, bounds.width * 0.5), from.y, {
    steps: 10,
  });
  await page.mouse.up();
  await expect
    .poll(() => viewport.evaluate((element) => element.scrollLeft))
    .toBeLessThan(before);
  await expect(page.locator(".ww-stats")).toContainText(/0\s*Helpers/);
  await expect(
    page.getByRole("button", { name: /Dancing bee · Left 90° · 1 remaining/ }),
  ).toBeEnabled();
  // A captured touch drag exercises the same camera without browser page scroll.
  if (testInfo.project.name === "mobile-chromium") {
    const session = await page.context().newCDPSession(page);
    const left = await viewport.evaluate((element) => element.scrollLeft);
    await session.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x: from.x + 100, y: from.y }],
    });
    await session.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: from.x, y: from.y }],
    });
    await session.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await expect
      .poll(() => viewport.evaluate((element) => element.scrollLeft))
      .toBeGreaterThan(left);
    await session.detach();
  }
  await camera.getByRole("button", { name: "Pan board", exact: true }).click();
  await showDetails(page, /^Place precisely$/);
  await page
    .getByRole("spinbutton", { name: "Tool placement column", exact: true })
    .fill("28");
  await page
    .getByRole("spinbutton", { name: "Tool placement row", exact: true })
    .fill("12");
  await page
    .getByRole("button", { name: "Place supplied tool", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Close place precisely", exact: true })
    .click();
  await camera.getByRole("button", { name: "Find helper (1)" }).click();
  const point = await page.locator(".ww-scene").evaluate((element) => {
    const point = new DOMPoint(28.5, 12.5).matrixTransform(
      (element as SVGSVGElement).getScreenCTM()!,
    );
    return { x: point.x, y: point.y };
  });
  const visible = (await viewport.boundingBox())!;
  expect(point.x).toBeGreaterThan(visible.x);
  expect(point.x).toBeLessThan(visible.x + visible.width);
  expect(point.y).toBeGreaterThan(visible.y);
  expect(point.y).toBeLessThan(visible.y + visible.height);
  await page.mouse.click(point.x, point.y);
  await expect(
    page.getByRole("button", { name: "Release guide", exact: true }),
  ).toBeEnabled();
  await camera.getByRole("button", { name: "Fit", exact: true }).click();
  const geometry = await viewport.evaluate((element) => ({
    width: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }));
  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.width + 1);
  await page
    .locator(".ww-game-window")
    .screenshot({ path: testInfo.outputPath("large-board-camera.png") });
});

test("garden library exposes challenges and readable level numbers", async ({
  page,
}, testInfo) => {
  await page.goto("/waggle-way");
  await page.getByRole("button", { name: "Play gardens", exact: true }).click();
  const chooser = page.getByRole("button", { name: "Choose adventure garden" });
  await expect(chooser).toContainText("Gardens");
  await chooser.click();
  const dialog = page.getByRole("dialog", { name: "Adventure gardens" });
  await expect(
    dialog
      .getByRole("region", { name: "Learn the dances" })
      .getByRole("button"),
  ).toHaveCount(5);
  await expect(
    dialog
      .getByRole("region", { name: "Glasshouse challenges" })
      .getByRole("button"),
  ).toHaveCount(6);
  await page.evaluate(() => document.fonts.ready);
  await expect(dialog.locator(".ww-practice-number").nth(1)).toHaveCSS(
    "font-family",
    /^"?Courier New"?, monospace$/,
  );
  await dialog.screenshot({ path: testInfo.outputPath("garden-library.png") });
  await dialog.getByRole("button", { name: "Jump to challenges" }).click();
  const heading = dialog.getByRole("heading", {
    name: "Glasshouse challenges",
  });
  await expect(heading).toBeFocused();
  await expect(heading).toBeInViewport();
  await page.keyboard.press("Tab");
  await expect(
    dialog.getByRole("button", { name: /Open Sesame/ }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("heading", { name: "Open Sesame" }),
  ).toBeFocused();
  await chooser.click();
  await page.keyboard.press("Escape");
  await expect(chooser).toBeFocused();
  await chooser.click();
  for (const [name, count] of [
    ["City gardens", 6],
    ["Rain gardens", 6],
    ["Factory escape", 7],
  ] as const) {
    await expect(
      dialog.getByRole("region", { name }).getByRole("button"),
    ).toHaveCount(count);
  }
  await expect(
    dialog.getByRole("button", { name: /archived|original/i }),
  ).toHaveCount(0);
});

test("all gardens allow jumping to the finale without changing saved progress", async ({
  page,
}, testInfo) => {
  await page.goto("/waggle-way");
  await page.getByRole("button", { name: "Play gardens", exact: true }).click();
  const before = await page.evaluate(() =>
    localStorage.getItem("ares.waggle-way.progress.v1"),
  );
  await openMap(page);
  const map = page.getByRole("dialog", { name: "Adventure gardens" });
  await expect(
    map.getByRole("button", { name: /30 Field of Flowers/ }),
  ).toBeEnabled();
  await map.getByRole("button", { name: /30 Field of Flowers/ }).click();
  await expect(
    page.getByRole("heading", { name: "Field of Flowers", exact: true }),
  ).toBeFocused();
  await expect(
    page.getByRole("button", { name: "Open hive", exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByRole("button", { name: "Assign guide", exact: true }),
  ).toHaveCount(0);
  await page
    .locator(".ww-game-window")
    .screenshot({ path: testInfo.outputPath("current-finale.png") });
  expect(
    await page.evaluate(() =>
      localStorage.getItem("ares.waggle-way.progress.v1"),
    ),
  ).toBe(before);
  await openMap(page);
  await map.getByRole("button", { name: /1 First Waggle/ }).click();
  await expect(
    page.getByRole("heading", { name: "First Waggle", exact: true }),
  ).toBeFocused();
  expect(
    await page.evaluate(() =>
      localStorage.getItem("ares.waggle-way.progress.v1"),
    ),
  ).toBe(before);
});

async function placeFirstDancer(page: Page, column = 10) {
  await showDetails(page, /^Place precisely$/);
  await page
    .getByRole("spinbutton", { name: "Tool placement column", exact: true })
    .fill(String(column));
  await page
    .getByRole("spinbutton", { name: "Tool placement row", exact: true })
    .fill("7");
  await page
    .getByRole("button", { name: "Place supplied tool", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Close place precisely", exact: true })
    .click();
}

test("Rain Check reuses one shelter after rescuing its operator and brings every helper home", async ({
  page,
}, testInfo) => {
  test.setTimeout(90000);
  await page.goto("/waggle-way");
  await page.getByRole("button", { name: "Play gardens", exact: true }).click();
  await openMap(page);
  await page
    .getByRole("dialog", { name: "Adventure gardens" })
    .getByRole("button", { name: /Rain Check/ })
    .click();
  await expect(
    page.getByRole("heading", { name: "Rain Check", exact: true }),
  ).toBeFocused();
  const selectObject = async (id: string) => {
    await showDetails(page, /choose another/);
    await page
      .getByRole("combobox", { name: "Inspect object", exact: true })
      .selectOption(id);
    await page
      .getByRole("button", { name: "Close tool options", exact: true })
      .click();
  };
  await selectObject("switch-1");
  await page
    .getByRole("button", { name: "Assign operator", exact: true })
    .click();
  for (const [stock, x, y] of [
    ["left-dancer", 17, 20],
    ["right-dancer", 16, 4],
    ["leaf-cover", 9, 8],
  ] as const) {
    await showDetails(page, /^Place precisely$/);
    await page
      .getByRole("combobox", { name: "Supplied tool", exact: true })
      .selectOption(stock);
    await page
      .getByLabel("Tool placement column", { exact: true })
      .fill(String(x));
    await page
      .getByLabel("Tool placement row", { exact: true })
      .fill(String(y));
    await page
      .getByRole("button", { name: "Place supplied tool", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Close place precisely", exact: true })
      .click();
  }
  await expect(page.locator(".ww-stats")).toContainText("3 Helpers");
  await page
    .getByRole("combobox", { name: "Speed", exact: true })
    .selectOption("3");
  await page.getByRole("button", { name: "Open hive", exact: true }).click();
  await expect(page.locator(".ww-stats")).toContainText("5 Waiting", {
    timeout: 30000,
  });
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await selectObject("switch-1");
  await page
    .getByRole("button", { name: "Release operator", exact: true })
    .click();
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  await expect(page.locator(".ww-stats")).toContainText("6 Waiting", {
    timeout: 15000,
  });
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await selectObject("placed-3");
  await showDetails(page, /^Precise position$/);
  await page.getByLabel("Move to column", { exact: true }).fill("22");
  await page.getByLabel("Move to row", { exact: true }).fill("1");
  await page.getByRole("button", { name: "Move tool", exact: true }).click();
  await expect(page.locator(".ww-scene .ww-selected")).toHaveAttribute(
    "transform",
    "translate(22 1)",
  );
  await page
    .getByRole("button", { name: "Close tool options", exact: true })
    .click();
  await showDetails(page, /^Place precisely$/);
  await expect(
    page
      .getByRole("combobox", { name: "Supplied tool", exact: true })
      .locator("option:checked"),
  ).toContainText("0 remaining");
  await page
    .getByRole("button", { name: "Close place precisely", exact: true })
    .click();
  await selectObject("rally-1");
  await showDetails(page, /^Tool options$/);
  await page
    .getByRole("button", { name: "Release rally", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Close tool options", exact: true })
    .click();
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  for (const [id, rescued] of [
    ["placed-1", 6],
    ["placed-2", 7],
  ] as const) {
    await expect(page.locator(".ww-stats")).toContainText(`${rescued}/8`, {
      timeout: 30000,
    });
    await page.getByRole("button", { name: "Pause", exact: true }).click();
    await selectObject(id);
    await page
      .getByRole("button", { name: "Release guide", exact: true })
      .click();
    await page.getByRole("button", { name: "Resume", exact: true }).click();
  }
  await expect(
    page.getByText("8 bees reached the flowers.", { exact: true }),
  ).toBeVisible({ timeout: 15000 });
  await expect(page.locator(".ww-stats")).toContainText("0 Lost");
  await page
    .locator(".ww-game-window")
    .screenshot({ path: testInfo.outputPath("rain-check-reused-shelter.png") });
});
