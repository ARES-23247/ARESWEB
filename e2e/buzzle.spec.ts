import { expect, test } from "./fixtures";

test("starts a local BUZZLE game with a complete accessible hive", async ({ page }) => {
  await page.goto("/buzzle");
  const setup = page.getByRole("dialog", { name: "Choose a BUZZLE game" });
  await setup.getByRole("button", { name: /Pass & Play/u }).click();

  const board = page.getByRole("grid", { name: /BUZZLE board/u });
  await expect(board).toBeVisible();
  await expect(board.getByRole("gridcell")).toHaveCount(217);
  const rack = page.getByRole("list", { name: "Player 1 tiles" });
  await expect(rack.getByRole("listitem")).toHaveCount(7);
  await expect(rack.locator("img")).toHaveCount(0);
  await expect(rack.locator(".buzzle-tile-face")).toHaveCount(7);
  await expect(rack.locator(".buzzle-tile-points")).toHaveCount(7);
  const rackTile = rack.locator('[role="listitem"]:not([aria-label^="Blank"])').first();
  const rackLetterSize = await rackTile.locator(".buzzle-tile-letter")
    .evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize));
  const rackPointSize = await rackTile.locator(".buzzle-tile-points")
    .evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize));
  const rackTileBox = await rackTile.boundingBox();
  const rackGeometry = await rack.locator('[role="listitem"]').evaluateAll((tiles) => tiles.map((tile) => {
    const face = tile.querySelector(".buzzle-tile-face")!.getBoundingClientRect();
    const points = tile.querySelector(".buzzle-tile-points")!.getBoundingClientRect();
    return {
      x: face.x,
      y: face.y,
      width: face.width,
      height: face.height,
      pointRight: points.right,
      pointBottom: points.bottom,
    };
  }));
  const rackTextOverlaps = await rack.locator('[role="listitem"]:not([aria-label^="Blank"])').evaluateAll((tiles) => tiles.some((tile) => {
    const letter = tile.querySelector(".buzzle-tile-letter")!.getBoundingClientRect();
    const points = tile.querySelector(".buzzle-tile-points")!.getBoundingClientRect();
    return letter.left < points.right && letter.right > points.left && letter.top < points.bottom && letter.bottom > points.top;
  }));
  expect(rackLetterSize).toBeGreaterThanOrEqual(20);
  expect(rackLetterSize).toBeLessThanOrEqual(28);
  expect(rackPointSize).toBeGreaterThanOrEqual(10.5);
  expect(rackTileBox!.width).toBeGreaterThanOrEqual(44);
  expect(rackTileBox!.height).toBeGreaterThanOrEqual(44);
  expect(rackTextOverlaps).toBe(false);
  expect(Math.max(...rackGeometry.slice(0, 4).map(({ y }) => y))
    - Math.min(...rackGeometry.slice(0, 4).map(({ y }) => y))).toBeLessThan(1);
  expect(Math.max(...rackGeometry.slice(4).map(({ y }) => y))
    - Math.min(...rackGeometry.slice(4).map(({ y }) => y))).toBeLessThan(1);
  expect(rackGeometry[4]!.x - rackGeometry[0]!.x).toBeGreaterThan(rackGeometry[0]!.width * 0.4);
  expect(rackGeometry[4]!.x - rackGeometry[0]!.x).toBeLessThan(rackGeometry[0]!.width * 0.6);
  for (const geometry of rackGeometry) {
    expect(geometry.pointRight).toBeLessThanOrEqual(geometry.x + geometry.width * 0.9 + 0.5);
    expect(geometry.pointBottom).toBeLessThanOrEqual(geometry.y + geometry.height * 0.9 + 0.5);
  }
  const worstCaseRackTile = rack.locator('[role="listitem"]:not([aria-label^="Blank"])').first();
  const worstCaseRackOverlap = await worstCaseRackTile.evaluate((tile) => {
    const face = tile.querySelector<HTMLElement>(".buzzle-tile-face")!;
    face.dataset.points = "10";
    face.querySelector<HTMLElement>(".buzzle-tile-letter")!.textContent = "Q";
    face.querySelector<HTMLElement>(".buzzle-tile-points")!.textContent = "10";
    const letter = face.querySelector(".buzzle-tile-letter")!.getBoundingClientRect();
    const points = face.querySelector(".buzzle-tile-points")!.getBoundingClientRect();
    return letter.left < points.right && letter.right > points.left
      && letter.top < points.bottom && letter.bottom > points.top;
  });
  expect(worstCaseRackOverlap).toBe(false);

  await worstCaseRackTile.click();
  await board.getByRole("gridcell", { name: /q 0, r 0/u }).click();
  await expect(board.locator('[data-draft="true"]')).toHaveCount(1);
  const boardLetterSize = await board.locator('[data-draft="true"] .buzzle-tile-letter')
    .evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize));
  const boardPointSize = await board.locator('[data-draft="true"] .buzzle-tile-points')
    .evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize));
  const boardTextOverlaps = await board.locator('[data-draft="true"] .buzzle-tile-face')
    .evaluate((tile) => {
      const letter = tile.querySelector(".buzzle-tile-letter")!.getBoundingClientRect();
      const points = tile.querySelector(".buzzle-tile-points")!.getBoundingClientRect();
      return letter.left < points.right && letter.right > points.left && letter.top < points.bottom && letter.bottom > points.top;
    });
  const worstCaseBoardOverlap = await board.locator('[data-draft="true"] .buzzle-tile-face')
    .evaluate((face) => {
      const tileFace = face as HTMLElement;
      tileFace.dataset.points = "10";
      tileFace.querySelector<HTMLElement>(".buzzle-tile-letter")!.textContent = "Q";
      tileFace.querySelector<HTMLElement>(".buzzle-tile-points")!.textContent = "10";
      const letter = tileFace.querySelector(".buzzle-tile-letter")!.getBoundingClientRect();
      const points = tileFace.querySelector(".buzzle-tile-points")!.getBoundingClientRect();
      return letter.left < points.right && letter.right > points.left
        && letter.top < points.bottom && letter.bottom > points.top;
    });
  const desktop = (page.viewportSize()?.width ?? 0) >= 800;
  expect(boardLetterSize).toBeGreaterThanOrEqual(desktop ? 22 : 12);
  expect(boardPointSize).toBeGreaterThanOrEqual(desktop ? 12 : 8.5);
  expect(boardTextOverlaps).toBe(false);
  if (desktop) {
    expect(worstCaseBoardOverlap).toBe(false);
  }
  await page.getByRole("button", { name: "Recall" }).click();
  await expect(board.locator('[data-draft="true"]')).toHaveCount(0);
});

test("offers friend, guest, and team online play without chat", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/buzzle#join=ABC23456");
  const online = page.getByRole("dialog", { name: "Online BUZZLE" });
  await expect(online).toBeVisible();
  await expect(online.getByLabel("Join with a code")).toHaveValue("ABC23456");
  await expect(online.getByRole("button", { name: /Find a guest/u })).toBeVisible();
  await expect(online.getByRole("button", { name: /Team matchmaking/u })).toBeVisible();
  await expect(online.getByRole("button", { name: /Create friend invite/u })).toBeVisible();
  await expect(online).toContainText(/no chat, profiles, or permanent room history/u);
  await expect(page).toHaveURL(/\/buzzle$/u);
});

test("fits the entire 217-cell board on a narrow phone without a nested scroller", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/buzzle");
  await page.getByRole("dialog", { name: "Choose a BUZZLE game" })
    .getByRole("button", { name: /Pass & Play/u }).click();
  const board = page.getByRole("grid", { name: /BUZZLE board/u });
  const box = await board.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(360);
  expect(box!.height).toBeGreaterThan(box!.width);
  const overflow = await page.locator(".buzzle-board-wrap").evaluate((element) => {
    const style = getComputedStyle(element);
    return [style.overflowX, style.overflowY];
  });
  expect(overflow).not.toContain("auto");
  expect(overflow).not.toContain("scroll");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const firstCell = await board.getByRole("gridcell").first().boundingBox();
  expect(firstCell!.width).toBeGreaterThanOrEqual(24);
  expect(firstCell!.height).toBeGreaterThanOrEqual(20);
});
