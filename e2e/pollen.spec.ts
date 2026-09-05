import { test, expect } from "./fixtures";

// Playwright's blocking init script reads navigator.serviceWorker inside every
// frame, which throws in an opaque sandbox. The sandbox itself prevents workers.
test.use({ serviceWorkers: "allow" });

test("Pollenator is public, playable by keyboard, and supports fullscreen without losing the stack", async ({ page }) => {
  await page.goto("/pollen");
  await expect(page.getByRole("heading", { name: "Pollenator Pile-Up", exact: true })).toBeVisible();
  const iframe = page.locator('iframe[title="Pollenator Pile-Up game"]');
  await expect(iframe).toHaveAttribute("sandbox", "allow-scripts");
  const game = page.frameLocator('iframe[title="Pollenator Pile-Up game"]');
  await game.getByRole("button", { name: /Pass & Play/ }).click();
  // The focusable canvas is the keyboard game surface, with a descriptive label.
  const canvas = game.locator("#game-canvas");
  await canvas.focus();
  await canvas.press("Space");
  await expect(game.locator("#hud-critters-val")).toHaveText("1", { timeout: 15000 });
  await expect(game.locator("#hud-turn-info")).toHaveText("Player 2's Turn");
  await page.getByRole("button", { name: "Enter full screen" }).click();
  await expect(page.locator('[data-game-fullscreen="true"]')).toBeVisible();
  await expect(page.getByRole("button", { name: "Exit full screen" })).toBeVisible();
  await page.getByRole("button", { name: "Exit full screen" }).click();
  await expect(game.locator("#hud-critters-val")).toHaveText("1");
  await page.setViewportSize({ width: 320, height: 740 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(canvas).toBeVisible();
});

test("Ranger Dave takes a turn and the isolated game stores only a device score", async ({ page }) => {
  await page.goto("/pollen");
  const iframe = page.locator('iframe[title="Pollenator Pile-Up game"]');
  const game = page.frameLocator('iframe[title="Pollenator Pile-Up game"]');
  await game.getByRole("button", { name: /Vs. Ranger Dave/ }).click();
  await game.locator("#game-canvas").press("Space");
  await expect(game.locator("#hud-critters-val")).toHaveText("2", { timeout: 20000 });
  const frame = await (await iframe.elementHandle())!.contentFrame();
  // Exercise the actual game-over score save and its sandbox boundary.
  await frame!.evaluate(() => {
    const scope = window as unknown as { game: { triggerTumble: (reason: string) => void } };
    scope.game.triggerTumble("test");
  });
  await expect(game.locator("#game-over-modal")).toBeVisible();
  await expect.poll(() => page.evaluate(() => Number(localStorage.getItem("pollen_appalachian_high_score")))).toBeGreaterThan(0);
  expect(await frame!.evaluate(() => {
    try { return !!parent.document; } catch { return false; }
  })).toBe(false);
  await game.getByRole("button", { name: /Change Game Mode/ }).click();
  await expect(game.getByRole("button", { name: /Solo High Score/ })).toBeVisible();
});
