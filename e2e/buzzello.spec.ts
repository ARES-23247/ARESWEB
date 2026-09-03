import { expect, test } from "./fixtures";

test("plays an accessible local BUZZELLO turn and restores the opening state", async ({
  page,
}) => {
  await page.goto("/buzzello");

  const setup = page.getByRole("dialog", {
    name: "Start a new BUZZELLO match",
  });
  await expect(setup).toBeVisible();
  await setup.getByRole("button", { name: /Pass & Play/ }).click();

  const board = page.getByRole("grid", { name: /BUZZELLO board/ });
  await expect(board).toBeVisible();
  await expect(board.getByRole("gridcell")).toHaveCount(61);
  await expect(board.locator(".buzzello-tile-art")).toHaveCount(6);
  await expect(
    board.locator(
      '.buzzello-piece[data-player="yellow"] img[src="/images/games/biobuzz-tile-yellow.png"]',
    ),
  ).toHaveCount(3);
  await expect(
    board.locator(
      '.buzzello-piece[data-player="black"] img[src="/images/games/biobuzz-tile-black.png"]',
    ),
  ).toHaveCount(3);
  expect(
    await board.locator(".buzzello-tile-art").evaluateAll((images) =>
      images.every(
        (image) =>
          image instanceof HTMLImageElement &&
          image.complete &&
          image.naturalWidth > 0,
      ),
    ),
  ).toBe(true);
  await board
    .locator('[role="gridcell"][aria-label*="legal move"]')
    .first()
    .click();
  await expect(page.getByText("Black to move.")).toBeVisible();

  await page.getByRole("button", { name: "Undo move" }).click();
  await expect(page.getByText(/Yellow opens/)).toBeVisible();

  const rulesTrigger = page.getByRole("button", { name: "Rules" });
  await rulesTrigger.click();
  await expect(
    page.getByRole("dialog", { name: "How to play BUZZELLO" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(rulesTrigger).toBeFocused();
});

test("keeps friend, guest, and team online choices usable on a phone viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/buzzello#join=ABC23456");

  const onlineSetup = page.getByRole("dialog", { name: "Online BUZZELLO" });
  await expect(onlineSetup).toBeVisible();
  await expect(onlineSetup.getByLabel("Join with a code")).toHaveValue(
    "ABC23456",
  );
  await expect(
    onlineSetup.getByRole("button", { name: "Find a match" }),
  ).toBeVisible();
  await expect(
    onlineSetup.getByRole("button", { name: "Find a teammate" }),
  ).toBeVisible();
  await expect(
    onlineSetup.getByRole("button", { name: "Create friend invite" }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/buzzello$/u);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("keeps the hex board playable without horizontal scrolling on a narrow phone", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/buzzello");
  await page
    .getByRole("dialog", { name: "Start a new BUZZELLO match" })
    .getByRole("button", { name: /Pass & Play/ })
    .click();

  const board = page.getByRole("grid", { name: /BUZZELLO board/ });
  const boardBox = await board.boundingBox();
  expect(boardBox).not.toBeNull();
  expect(boardBox!.x).toBeGreaterThanOrEqual(0);
  expect(boardBox!.x + boardBox!.width).toBeLessThanOrEqual(360);
  expect(boardBox!.height).toBeGreaterThan(boardBox!.width);

  const arenaOverflow = await page
    .locator(".buzzello-arena")
    .evaluate((element) => {
      const style = getComputedStyle(element);
      return [style.overflowX, style.overflowY];
    });
  const boardWrapperOverflow = await page
    .locator(".buzzello-board-wrap")
    .evaluate((element) => {
      const style = getComputedStyle(element);
      return [style.overflowX, style.overflowY];
    });
  expect(arenaOverflow).not.toContain("auto");
  expect(arenaOverflow).not.toContain("scroll");
  expect(boardWrapperOverflow).not.toContain("auto");
  expect(boardWrapperOverflow).not.toContain("scroll");

  const cellsStayInsideBoard = await board.evaluate((element) => {
    const boardRect = element.getBoundingClientRect();
    return [...element.querySelectorAll('[role="gridcell"]')].every((cell) => {
      const cellRect = cell.getBoundingClientRect();
      return (
        cellRect.left >= boardRect.left - 0.5 &&
        cellRect.right <= boardRect.right + 0.5 &&
        cellRect.top >= boardRect.top - 0.5 &&
        cellRect.bottom <= boardRect.bottom + 0.5
      );
    });
  });
  expect(cellsStayInsideBoard).toBe(true);

  const legalCell = board
    .locator('[role="gridcell"][aria-label*="legal move"]')
    .first();
  const cellBox = await legalCell.boundingBox();
  expect(cellBox).not.toBeNull();
  expect(cellBox!.width).toBeGreaterThanOrEqual(40);
  expect(cellBox!.height).toBeGreaterThanOrEqual(36);
  await expect(page.locator(".buzzello-mobile-status")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
