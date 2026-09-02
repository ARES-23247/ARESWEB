import { expect, test } from "./fixtures";

test("starts a local BUZZLE game with a complete accessible hive", async ({ page }) => {
  await page.goto("/buzzle");
  const setup = page.getByRole("dialog", { name: "Choose a BUZZLE game" });
  await setup.getByRole("button", { name: /Pass & Play/u }).click();

  const board = page.getByRole("grid", { name: /BUZZLE board/u });
  await expect(board).toBeVisible();
  await expect(board.getByRole("gridcell")).toHaveCount(127);
  const rack = page.getByRole("list", { name: "Player 1 tiles" });
  await expect(rack.getByRole("listitem")).toHaveCount(7);
  expect(await rack.locator("img").evaluateAll((images) => images.every((image) =>
    image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0,
  ))).toBe(true);

  await rack.getByRole("listitem").first().click();
  await board.getByRole("gridcell", { name: /q 0, r 0/u }).click();
  await expect(board.locator('[data-draft="true"]')).toHaveCount(1);
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

test("fits the entire 127-cell board on a narrow phone without a nested scroller", async ({ page }) => {
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
  expect(firstCell!.width).toBeGreaterThanOrEqual(30);
  expect(firstCell!.height).toBeGreaterThanOrEqual(24);
});
