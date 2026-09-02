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
