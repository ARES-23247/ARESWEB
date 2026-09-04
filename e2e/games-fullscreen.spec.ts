import { expect, test } from "./fixtures";

const games = [
  {
    path: "/buzzle",
    setupDialog: "Choose a BUZZLE game",
  },
  {
    path: "/buzzello",
    setupDialog: "Start a new BUZZELLO match",
  },
] as const;

for (const game of games) {
  test(`${game.path} fills the viewport when full-screen mode is active`, async ({ page }) => {
    await page.goto(game.path);
    await page.getByRole("dialog", { name: game.setupDialog })
      .getByRole("button", { name: /Pass & Play/u })
      .click();

    await page.evaluate(() => {
      Object.defineProperty(document.documentElement, "requestFullscreen", {
        configurable: true,
        value: undefined,
      });
    });

    await page.getByRole("button", { name: "Enter full screen" }).click();
    const shell = page.locator("main.game-fullscreen-target");
    await expect(shell).toHaveAttribute("data-game-fullscreen", "true");
    await expect(page.getByRole("button", { name: "Exit full screen" })).toHaveAttribute("aria-pressed", "true");

    const geometry = await shell.evaluate((element) => {
      const bounds = element.getBoundingClientRect();
      return {
        position: getComputedStyle(element).position,
        top: bounds.top,
        left: bounds.left,
        width: bounds.width,
        height: bounds.height,
        bodyOverflow: document.body.style.overflow,
      };
    });
    expect(geometry.position).toBe("fixed");
    expect(geometry.top).toBe(0);
    expect(geometry.left).toBe(0);
    expect(geometry.width).toBe(page.viewportSize()!.width);
    expect(geometry.height).toBe(page.viewportSize()!.height);
    expect(geometry.bodyOverflow).toBe("hidden");

    await page.getByRole("button", { name: "Exit full screen" }).click();
    await expect(shell).not.toHaveAttribute("data-game-fullscreen");
  });
}
