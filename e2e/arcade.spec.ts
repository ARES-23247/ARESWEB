import { expect, test } from "./fixtures";

test("Arcade sits beside Academy and groups games on desktop, tablet, and phone", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Main Navigation" });
  const arcade = nav.getByRole("link", { name: "Arcade", exact: true });
  await expect(arcade).toBeVisible();
  expect(await nav.getByRole("link", { name: "Academy", exact: true }).evaluate(el => el.nextElementSibling?.textContent?.trim())).toBe("Arcade");
  await arcade.click();
  await expect(page).toHaveURL(/\/arcade$/);
  await expect(page.getByRole("heading", { name: "ARES Arcade", exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--obsidian").trim())).toBe("#1a1a1a");
  await expect(page.getByRole("link", { name: "Play BUZZLE", exact: true })).toHaveCSS("background-color", "rgb(192, 0, 0)");
  const main = page.getByRole("main").last();
  await expect(main.getByRole("link", { name: "Play BUZZLE", exact: true })).toHaveAttribute("href", "/buzzle");
  await expect(main.getByRole("link", { name: "Play BUZZELLO", exact: true })).toHaveAttribute("href", "/buzzello");
  await expect(main.getByRole("link", { name: "Play BUZZHEX", exact: true })).toHaveAttribute("href", "/buzzhex");
  await expect(main.getByRole("link", { name: "Play Pollinator Pile-Up", exact: true })).toHaveAttribute("href", "/pollen");
  const printBuzzle = main.getByRole("link", { name: "3D print BUZZLE on Printables (opens in a new tab)", exact: true });
  await expect(printBuzzle).toHaveAttribute("href", "https://www.printables.com/model/1834054-buzzle-biobuzz-hex-word-game-board-individual-tile");
  await expect(printBuzzle).toHaveAttribute("target", "_blank");
  await expect(printBuzzle).toHaveAttribute("rel", "noopener noreferrer");
  await expect(main.getByRole("link", { name: "3D print BUZZELLO on Printables (opens in a new tab)", exact: true })).toHaveAttribute("href", "https://www.printables.com/model/1834053-buzzello-biobuzz-hex-strategy-board-reversible-pie");
  await expect(main.getByRole("link", { name: /3D print BUZZHEX on Printables/ })).toHaveAttribute("href", "https://www.printables.com/model/1834842-buzzhex-11-x-11-hex-strategy-game-reuse-your-buzze");
  await nav.getByRole("button", { name: "Resources", exact: true }).click();
  await expect(nav.getByRole("link", { name: /BUZZLE|Pollinator/ })).toHaveCount(0);
  await page.keyboard.press("Escape");
  for (const width of [1024, 768, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole("button", { name: "Open navigation menu" }).click();
    const drawer = page.getByRole("dialog", { name: "Mobile navigation menu" });
    const games = drawer.getByRole("region", { name: "Arcade", exact: true });
    await expect(games.getByRole("link", { name: "Pollinator Pile-Up", exact: true })).toBeVisible();
    await games.getByRole("link", { name: "Arcade", exact: true }).click();
    await expect(drawer).toHaveCount(0);
  }
  await main.getByRole("link", { name: "BUZZLE Word Tools", exact: true }).click();
  await expect(page).toHaveURL(/\/buzzle\/word-tools$/);
  await expect(page.getByRole("heading", { name: "Word Tools", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "3D print BUZZLE on Printables (opens in a new tab)", exact: true })).toBeVisible();
});
