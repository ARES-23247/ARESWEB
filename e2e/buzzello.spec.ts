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
