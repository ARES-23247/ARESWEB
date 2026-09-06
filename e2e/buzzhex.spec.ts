import { expect, test } from "./fixtures";

test("BUZZHEX plays, swaps, restores, undoes, and resets", async ({
  page,
  isMobile,
}) => {
  await page.goto("/buzzhex");

  const board = page.getByRole("group", { name: /BUZZHEX board/ });

  await expect(board.getByRole("button")).toHaveCount(121);

  if (isMobile) await page.getByRole("button", { name: "F6, empty" }).tap();
  else await page.getByRole("button", { name: "F6, empty" }).click();

  if (isMobile)
    await page.getByRole("button", { name: "Place Black at F6" }).click();

  await page.getByRole("button", { name: "Swap colors" }).click();

  await expect(
    page.getByRole("status", { name: "Current turn", exact: true }),
  ).toContainText("Player 1 · Yellow to move");

  await expect(
    page.getByRole("button", { name: "F6, Black, Player 2" }),
  ).toBeAttached();

  await page.reload();

  await expect(
    page.getByRole("status", { name: "Current turn", exact: true }),
  ).toContainText("Player 1 · Yellow to move");

  await page.getByRole("button", { name: "Undo last action" }).click();

  await expect(page.getByRole("button", { name: "Swap colors" })).toBeVisible();

  await page.getByRole("button", { name: "New game", exact: true }).click();

  await page.getByRole("button", { name: "Start new game" }).click();

  await expect(page.getByRole("button", { name: "F6, empty" })).toBeAttached();

  await expect(
    page.getByRole("button", { name: "Undo last action" }),
  ).toBeDisabled();
});

test("BUZZHEX keyboard, rules focus, zoom and view stay usable", async ({
  page,
}) => {
  await page.goto("/buzzhex");

  await page.getByRole("button", { name: "F6, empty" }).focus();

  await page.keyboard.press("ArrowRight");

  await expect(page.getByRole("button", { name: "G6, empty" })).toBeFocused();

  await page.keyboard.press("Space");

  await expect(
    page.getByRole("button", { name: "G6, Black, Player 1" }),
  ).toBeAttached();

  const rules = page.getByRole("button", { name: "Rules", exact: true });

  await rules.click();

  await expect(
    page.getByRole("dialog", { name: "How to play BUZZHEX" }),
  ).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(rules).toBeFocused();

  await page.getByRole("button", { name: "Zoom in", exact: true }).click();

  await expect(page.locator(".buzzhex-viewport")).toHaveAttribute(
    "data-fit",
    "false",
  );

  await page.getByRole("button", { name: "Fit board", exact: true }).click();

  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);

  await page.screenshot({
    path: `test-results/buzzhex-${test.info().project.name}.png`,
    fullPage: true,
  });
});

test("BUZZHEX highlights a win after swapping and rejects a touch drag", async ({
  page,
  isMobile,
}) => {
  const actions: Array<{ type: string; index?: number }> = [
    { type: "place", index: 5 },
    { type: "swap" },
  ];

  const yellow = [0, 1, 2, 3, 4, 6, 7, 8, 9, 10];

  for (let q = 1; q < 11; q++) {
    actions.push({ type: "place", index: yellow[q - 1] });

    if (q < 10) actions.push({ type: "place", index: q * 11 + 5 });
  }

  await page.addInitScript(
    (save) => localStorage.setItem("ares:buzzhex:v1", JSON.stringify(save)),
    { version: 1, names: ["Bee", "Buzz"], actions },
  );

  await page.goto("/buzzhex");

  const target = page.getByRole("button", { name: "K6, empty" });

  await target.dispatchEvent("pointerdown", {
    pointerId: 1,
    pointerType: "touch",
    isPrimary: true,
    button: 0,
    clientX: 10,
    clientY: 10,
  });

  await target.dispatchEvent("pointerup", {
    pointerId: 1,
    pointerType: "touch",
    isPrimary: true,
    button: 0,
    clientX: 100,
    clientY: 10,
  });

  await expect(target).toHaveAttribute("data-owner", "empty");

  await expect(
    page.getByRole("button", { name: "Place Black at K6" }),
  ).toHaveCount(0);

  if (isMobile) {
    await target.tap();
    await page.getByRole("button", { name: "Place Black at K6" }).click();
  } else await target.click();

  await expect(
    page.getByRole("status", { name: "Current turn", exact: true }),
  ).toHaveText(/Buzz wins as Black/);

  await expect(page.locator("[data-winning=true]")).toHaveCount(11);

  await expect(page.locator(".buzzhex-winning-line")).toBeAttached();

  await expect(page.getByRole("button", { name: "K7, empty" })).toBeDisabled();

  await page.getByRole("button", { name: "Undo last action" }).click();

  await expect(
    page.getByRole("status", { name: "Current turn", exact: true }),
  ).toHaveText(/Buzz.*Black to move/);

  await expect(page.locator(".buzzhex-winning-line")).toHaveCount(0);
});
