import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { readFile } from "node:fs/promises";
import { ADVANCED_GARDENS } from "../packages/waggle-way/src/content/advanced";
import { parseLevelFile, serializeLevel } from "@ares/waggle-way/level";

type Route = {
  title: string;
  variant?: string;
  operator?: boolean;
  pollen?: number;
  tools: [string, number, number][];
};
const routes: Route[] = [
  {
    title: "Bring Everyone",
    operator: true,
    tools: [
      ["left", 16, 18],
      ["lift", 14, 12],
      ["right", 15, 4],
    ],
  },
  {
    title: "Shelter the Swarm",
    tools: [
      ["left", 12, 18],
      ["right", 11, 4],
      ["cover", 11, 1],
    ],
  },
  {
    title: "Crosswinds",
    tools: [
      ["left", 12, 15],
      ["right", 11, 6],
      ["left", 30, 7],
      ["cover", 5, 9],
      ["cover", 19, 2],
    ],
  },
  {
    title: "The Long Way Home",
    variant: "short rescue",
    pollen: 0,
    tools: [
      ["lift", 14, 24],
      ["left", 34, 24],
      ["cover", 5, 12],
    ],
  },
  {
    title: "The Long Way Home",
    variant: "pollen route",
    pollen: 1,
    tools: [
      ["left", 13, 24],
      ["right", 12, 10],
      ["left", 34, 11],
      ["cover", 5, 12],
      ["cover", 21, 2],
    ],
  },
  {
    title: "Pipework",
    tools: [
      ["right", 8, 24],
      ["lift", 9, 15],
      ["right", 9, 5],
      ["left", 39, 6],
    ],
  },
  {
    title: "High Road, Low Road",
    variant: "high route",
    pollen: 0,
    tools: [
      ["lift", 13, 20],
      ["left", 32, 20],
    ],
  },
  {
    title: "High Road, Low Road",
    variant: "pollen route",
    pollen: 1,
    tools: [
      ["left", 12, 20],
      ["right", 11, 6],
      ["left", 32, 7],
    ],
  },
  {
    title: "Pollen on the Side",
    variant: "rescue only",
    pollen: 0,
    tools: [
      ["left", 12, 26],
      ["right", 11, 12],
      ["left", 30, 13],
      ["right", 29, 3],
      ["cover", 5, 13],
      ["cover", 22, 3],
    ],
  },
  {
    title: "Pollen on the Side",
    variant: "pollen route",
    pollen: 1,
    tools: [
      ["left", 12, 26],
      ["right", 11, 14],
      ["left", 30, 15],
      ["right", 29, 3],
      ["cover", 5, 13],
      ["cover", 22, 3],
    ],
  },
  {
    title: "The Last Dancer",
    operator: true,
    tools: [
      ["lift", 14, 20],
      ["lift", 23, 20],
      ["left", 34, 20],
      ["cover", 19, 7],
    ],
  },
];

async function panel(page: Page, title: RegExp) {
  const summary = page.locator("summary").filter({ hasText: title });
  const ancestors = summary.locator("xpath=ancestor::details");
  for (let index = 0; index < (await ancestors.count()) - 1; index++) {
    const ancestor = ancestors.nth(index);
    if ((await ancestor.getAttribute("open")) === null)
      await ancestor.locator(":scope > summary").click();
  }
  if ((await summary.locator("..").getAttribute("open")) === null)
    await summary.click();
}

test("workshop edits height and lift supply and preserves them through save and test", async ({
  page,
}, info) => {
  const level = ADVANCED_GARDENS[0];
  const close = async () => {
    const dialog = page.getByRole("dialog");
    if (await dialog.isVisible())
      await dialog
        .getByRole("button", { name: "Close dialog", exact: true })
        .click();
    else {
      const button = page.getByRole("button", { name: /^Close / }).first();
      if (await button.isVisible()) await button.click();
    }
  };
  await page.goto("/waggle-way/builder");
  await panel(page, /Files and saved gardens/);
  await page.getByLabel("Import a garden file", { exact: true }).setInputFiles({
    name: "height-garden.json",
    mimeType: "application/json",
    buffer: Buffer.from(serializeLevel(level)),
  });
  await expect(page.getByText(/Garden imported\./)).toBeVisible();
  await close();
  const terrain = level.objects.find((object) => object.elevation === "low")!;
  await page
    .getByRole("combobox", { name: "Selected object", exact: true })
    .selectOption(terrain.id);
  await page.getByRole("button", { name: "Edit piece", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Obstacle height", exact: true })
    .selectOption("tall");
  await page
    .getByRole("button", { name: "Apply properties", exact: true })
    .click();
  await close();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await page.getByRole("button", { name: "Edit piece", exact: true }).click();
  await expect(
    page.getByRole("combobox", { name: "Obstacle height", exact: true }),
  ).toHaveValue("tall");
  await page
    .getByRole("combobox", { name: "Obstacle height", exact: true })
    .selectOption("low");
  await page
    .getByRole("button", { name: "Apply properties", exact: true })
    .click();
  await close();
  await panel(page, /Player tool supply/);
  const supply = page.getByRole("form", {
    name: "Edit lift-dancer",
    exact: true,
  });
  await expect(
    supply.getByRole("combobox", { name: "Dance type", exact: true }),
  ).toHaveValue("lift");
  await supply.getByLabel("Supply count", { exact: true }).fill("2");
  await supply
    .getByRole("button", { name: "Apply supply", exact: true })
    .click();
  await close();
  await close();
  await page.getByRole("button", { name: "Save garden", exact: true }).click();
  await page.getByRole("button", { name: "Test garden", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: level.title, exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Return to editor", exact: true })
    .click();
  await page.reload();
  await panel(page, /Files and saved gardens/);
  await page.getByRole("button", { name: "Load library", exact: true }).click();
  await panel(page, /Files and saved gardens/);
  await page
    .getByRole("combobox", { name: "Saved gardens", exact: true })
    .selectOption(level.id);
  const downloaded = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export garden", exact: true })
    .click();
  const path = await (await downloaded).path();
  const restored = parseLevelFile(await readFile(path!, "utf8"));
  expect(restored.rulesVersion).toBe(8);
  expect(
    restored.objects.find((object) => object.id === terrain.id)?.elevation,
  ).toBe("low");
  expect(
    restored.inventory?.find((stock) => stock.id === "lift-dancer"),
  ).toMatchObject({ dance: "lift", count: 2 });
  await close();
  await page
    .locator(".ww-page")
    .screenshot({ path: info.outputPath("height-workshop.png") });
});

async function gardenControls(page: Page, title: string) {
  await page.goto("/waggle-way");
  await page.getByRole("button", { name: "Play gardens", exact: true }).click();
  await page
    .getByRole("button", { name: "Choose adventure garden", exact: true })
    .click();
  await page
    .getByRole("dialog", { name: "Adventure gardens" })
    .getByRole("button", { name: new RegExp(title) })
    .click();
  let placed = 0;
  const button = (name: string) =>
    page.getByRole("button", { name, exact: true });
  const select = async (id: string) => {
    await panel(page, /choose another/);
    await page
      .getByRole("combobox", { name: "Inspect object", exact: true })
      .selectOption(id);
    await button("Close tool options").click();
  };
  const place = async (stock: string, x: number, y: number) => {
    await panel(page, /^Place precisely$/);
    await page
      .getByRole("combobox", { name: "Supplied tool", exact: true })
      .selectOption(stock);
    await page
      .getByLabel("Tool placement column", { exact: true })
      .fill(String(x));
    await page
      .getByLabel("Tool placement row", { exact: true })
      .fill(String(y));
    await button("Place supplied tool").click();
    await button("Close place precisely").click();
    await expect(page.locator(".ww-scene .ww-selected")).toHaveAttribute(
      "transform",
      `translate(${x} ${y})`,
    );
    return `placed-${++placed}`;
  };
  const travel = async (waiting: number, leaving?: number) => {
    await button("Resume").click();
    if (leaving !== undefined)
      await expect(page.locator(".ww-stats")).not.toContainText(
        `${leaving} Waiting`,
      );
    await expect(page.locator(".ww-stats")).toContainText(
      `${waiting} Waiting`,
      { timeout: 35000 },
    );
    await button("Pause").click();
    await expect(page.locator(".ww-stats")).toContainText("0 Lost");
  };
  return {
    button,
    select,
    place,
    travel,
    async assign(id: string) {
      await select(id);
      await button("Assign operator").click();
    },
    async start(waiting: number) {
      await page
        .getByRole("combobox", { name: "Speed", exact: true })
        .selectOption("3");
      await button("Open hive").click();
      await expect(page.locator(".ww-stats")).toContainText(
        `${waiting} Waiting`,
        { timeout: 35000 },
      );
      await button("Pause").click();
    },
    async release(id: string) {
      await select(id);
      await button(
        id.startsWith("switch") ? "Release operator" : "Release guide",
      ).click();
    },
    async rally(id: string) {
      await select(id);
      await panel(page, /^Tool options$/);
      await button("Release rally").click();
      await button("Close tool options").click();
    },
    async move(id: string, x: number, y: number) {
      await select(id);
      await panel(page, /^Precise position$/);
      await page.getByLabel("Move to column", { exact: true }).fill(String(x));
      await page.getByLabel("Move to row", { exact: true }).fill(String(y));
      await button("Move tool").click();
      await button("Close tool options").click();
      await expect(page.locator(".ww-scene .ww-selected")).toHaveAttribute(
        "transform",
        `translate(${x} ${y})`,
      );
    },
  };
}

for (const route of routes) {
  test(`${route.title} ${route.variant ?? "rescue"} works through real controls`, async ({
    page,
  }, info) => {
    test.setTimeout(150000);
    const game = await gardenControls(page, route.title);
    const helpers: string[] = [];
    if (route.operator) {
      await game.assign("switch-1");
      helpers.push("switch-1");
    }
    for (const [tool, x, y] of route.tools) {
      const id = await game.place(
        tool === "cover" ? "leaf-cover" : `${tool}-dancer`,
        x,
        y,
      );
      if (tool !== "cover") helpers.push(id);
    }
    await game.button("Flowers").click();
    expect(
      await page
        .locator(".ww-camera-viewport")
        .evaluate((element) => element.scrollLeft),
    ).toBeGreaterThan(0);
    await page
      .locator(".ww-game-window")
      .screenshot({ path: info.outputPath("destination-route.png") });
    await page
      .getByRole("combobox", { name: "Speed", exact: true })
      .selectOption("3");
    await game.button("Open hive").click();
    let rescued = 8 - helpers.length;
    for (const id of helpers) {
      await expect(page.locator(".ww-stats")).toContainText(`${rescued}/8`, {
        timeout: 35000,
      });
      await game.button("Pause").click();
      await game.release(id);
      await game.button("Resume").click();
      rescued++;
    }
    await expect(
      page.getByText("8 bees reached the flowers.", { exact: true }),
    ).toBeVisible({ timeout: 15000 });
    await expect(page.locator(".ww-stats")).toContainText("0 Lost");
    if (route.pollen !== undefined)
      await expect(page.locator(".ww-game-window")).toContainText(
        `${route.pollen} delivered`,
      );
  });
}

test("Factory Entrance reuses two jobs through real controls", async ({
  page,
}) => {
  test.setTimeout(120000);
  const game = await gardenControls(page, "Factory Entrance");
  await game.assign("switch-1");
  const lift = await game.place("lift-dancer", 16, 20);
  await game.start(6);
  await game.release("switch-1");
  await game.travel(7);
  await game.rally("rally-1");
  await game.travel(7, 7);
  await game.release(lift);
  await game.travel(8);
  const turn = await game.place("left-dancer", 25, 20);
  await game.button("Find helper (8)").click();
  await expect(page.locator(".ww-scene .ww-selected")).toBeInViewport();
  await game.rally("rally-2");
  await game.button("Resume").click();
  await expect(page.locator(".ww-stats")).toContainText("7/8", {
    timeout: 20000,
  });
  await game.button("Pause").click();
  await game.release(turn);
  await game.button("Resume").click();
  await expect(
    page.getByText("8 bees reached the flowers.", { exact: true }),
  ).toBeVisible({ timeout: 15000 });
  await expect(page.locator(".ww-stats")).toContainText("0 Lost");
});

for (const finale of [false, true]) {
  test(`${finale ? "Field of Flowers" : "All Together"} completes its staged capstone through real controls`, async ({
    page,
  }, info) => {
    test.setTimeout(300000);
    const game = await gardenControls(
      page,
      finale ? "Field of Flowers" : "All Together",
    );
    await game.assign("switch-1");
    await game.assign("switch-2");
    const lift = await game.place(
      "lift-dancer",
      finale ? 22 : 24,
      finale ? 30 : 28,
    );
    const secondLift = finale ? await game.place("lift-dancer", 31, 30) : null;
    const roof = await game.place("leaf-cover", 11, finale ? 17 : 15);
    if (finale) await game.place("leaf-cover", 27, 17);
    let waiting = finale ? 4 : 5;
    await game.start(waiting);
    for (const id of ["switch-1", "switch-2"]) {
      await game.release(id);
      await game.travel(++waiting);
    }
    if (finale) {
      for (const id of [lift, secondLift!]) {
        await game.release(id);
        await game.travel(++waiting);
      }
    }
    await game.move(roof, finale ? 44 : 37, finale ? 1 : 3);
    if (!finale) {
      await game.rally("rally-1");
      await game.travel(7, 7);
      await game.release(lift);
      await game.travel(8);
    }
    const climb = await game.place(
      "left-dancer",
      finale ? 40 : 32,
      finale ? 29 : 27,
    );
    await game.rally(finale ? "rally-1" : "rally-2");
    await game.travel(7, 7);
    await game.release(climb);
    await game.travel(8);
    if (finale) {
      const lastLift = await game.place("lift-dancer", 40, 13);
      await game.rally("rally-2");
      await game.travel(7, 7);
      await game.release(lastLift);
      await game.travel(8);
    }
    const turn = await game.place(
      "right-dancer",
      finale ? 41 : 33,
      finale ? 5 : 11,
    );
    await game.button("Find helper (8)").click();
    await expect(page.locator(".ww-scene .ww-selected")).toBeInViewport();
    await page
      .locator(".ww-game-window")
      .screenshot({ path: info.outputPath("final-recruitment.png") });
    await game.rally("rally-3");
    await game.button("Resume").click();
    await expect(page.locator(".ww-stats")).toContainText("7/8", {
      timeout: 25000,
    });
    await game.button("Pause").click();
    await game.release(turn);
    await game.button("Resume").click();
    await expect(
      page.getByText("8 bees reached the flowers.", { exact: true }),
    ).toBeVisible({ timeout: 15000 });
    await expect(page.locator(".ww-stats")).toContainText("0 Lost");
  });
}
