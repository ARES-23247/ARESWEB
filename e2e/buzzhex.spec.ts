import { expect, test } from "./fixtures";

for (const difficulty of ["easy", "medium", "hard"]) {
  test(`BUZZHEX ${difficulty} computer responds, saves, and undoes`, async ({
    page,
  }) => {
    await page.goto("/buzzhex");
    await expect(
      page.getByRole("dialog", { name: "Choose a BUZZHEX game" }),
    ).toBeVisible();
    await expect(page.getByRole("dialog")).toContainText("Opening swap rule");
    await expect(page.getByRole("dialog")).toContainText(
      "the board stays in place",
    );
    const modes = {
      easy: "Rookie AI",
      medium: "Tactical AI",
      hard: "Master AI",
    };
    await page
      .getByRole("button", {
        name: new RegExp(modes[difficulty as keyof typeof modes]),
      })
      .click();
    await expect(
      page.getByRole("link", { name: /3D print BUZZHEX/ }),
    ).toHaveAttribute("href", /printables.com\/model\/1834842-/);
    // Wait for the dialog's focus restoration before focusing a board cell.
    // Otherwise a delayed close effect can redirect Enter back to New game.
    await expect(
      page.getByRole("button", { name: "New game", exact: true }),
    ).toBeFocused();
    // Keyboard placement works on touch and desktop without a synthetic tap.
    await page.getByRole("button", { name: "F6, empty" }).focus();
    await page.keyboard.press("Enter");
    // The initial status also says Player 1 to move. Observe the opening move
    // before waiting for the computer's reply or reloading the saved board.
    await expect(page.locator('[data-owner="black"]')).toHaveCount(1);
    const status = page.getByRole("status", {
      name: "Current turn",
      exact: true,
    });
    await expect(status).toHaveText(/Player 1.*to move/);
    const swapped =
      (await page
        .getByRole("button", { name: "F6, Black, Computer" })
        .count()) === 1;
    if (difficulty !== "easy") expect(swapped).toBe(true);
    const humanColor = swapped ? "Yellow" : "Black";
    if (swapped) {
      await expect(
        page.getByRole("status", { name: "Opening swap", exact: true }),
      ).toContainText("Player 1 now plays Yellow");
    }
    await expect(page.locator('[data-owner="yellow"]')).toHaveCount(
      swapped ? 0 : 1,
    );
    const nextCell = page.locator('[data-owner="empty"]').first();
    const nextLabel = await nextCell.getAttribute("data-cell");
    await nextCell.focus();
    await page.keyboard.press("Enter");
    await expect(page.locator('[data-owner="black"]')).toHaveCount(2);
    await expect(page.locator('[data-owner="yellow"]')).toHaveCount(
      swapped ? 1 : 2,
    );
    await expect(status).toHaveText(
      new RegExp(`Player 1.*${humanColor} to move`),
    );
    await expect(
      page.getByRole("button", {
        name: `${nextLabel}, ${humanColor}, Player 1`,
      }),
    ).toBeAttached();
    await page.reload();
    await expect(
      page.getByRole("button", { name: "Undo your last turn" }),
    ).toBeEnabled();
    await page.getByRole("button", { name: "Undo your last turn" }).click();
    await expect(page.locator('[data-owner="black"]')).toHaveCount(1);
    await expect(page.locator('[data-owner="yellow"]')).toHaveCount(
      swapped ? 0 : 1,
    );
    await page.getByRole("button", { name: "Undo your last turn" }).click();
    await expect(page.locator('[data-owner="empty"]')).toHaveCount(121);
    await page.getByRole("button", { name: "A1, empty" }).focus();
    await page.keyboard.press("Enter");
    await expect(status).toHaveText(/Player 1.*to move/);
    if (difficulty !== "easy")
      await expect(page.locator('[data-owner="yellow"]')).toHaveCount(1);
    await page.screenshot({
      path: `test-results/buzzhex-ai-${difficulty}-${test.info().project.name}.png`,
      fullPage: true,
    });
  });
}

test("BUZZHEX plays, swaps, restores, undoes, and resets", async ({
  page,
  isMobile,
}) => {
  await page.goto("/buzzhex");

  await page.getByRole("button", { name: /Pass & Play/ }).click();
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

  await page.getByRole("button", { name: /Pass & Play/ }).click();

  await expect(page.getByRole("button", { name: "F6, empty" })).toBeAttached();

  await expect(
    page.getByRole("button", { name: "Undo last action" }),
  ).toBeDisabled();
});

test("BUZZHEX keyboard, rules focus, zoom and view stay usable", async ({
  page,
}) => {
  await page.goto("/buzzhex");
  const picker = page.getByRole("dialog", { name: "Choose a BUZZHEX game" });
  await expect(picker).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Pass & Play/ }),
  ).toBeInViewport();
  await picker.screenshot({
    path: `test-results/buzzhex-picker-${test.info().project.name}.png`,
  });
  await page.getByRole("button", { name: /Pass & Play/ }).click();
  await expect(
    page.getByRole("button", { name: "New game", exact: true }),
  ).toBeFocused();
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

test("BUZZHEX AI swap keeps the opening tile and continues the same game", async ({
  page,
}) => {
  await page.goto("/buzzhex");
  await page.getByRole("button", { name: /Tactical AI/ }).click();
  await expect(
    page.getByRole("button", { name: "New game", exact: true }),
  ).toBeFocused();
  await page.getByRole("button", { name: "F6, empty" }).focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("status", { name: "Opening swap", exact: true }),
  ).toContainText("play continues");
  await page
    .getByRole("status", { name: "Opening swap", exact: true })
    .screenshot({
      path: `test-results/buzzhex-swap-${test.info().project.name}.png`,
    });
  await expect(
    page.getByRole("button", { name: "F6, Black, Computer" }),
  ).toBeAttached();
  await page.getByRole("button", { name: "F7, empty" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.locator('[data-owner="black"]')).toHaveCount(2);
  await expect(
    page.getByRole("button", { name: "F7, Yellow, Player 1" }),
  ).toBeAttached();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "F6, Black, Computer" }),
  ).toBeAttached();
  await expect(
    page.getByRole("status", { name: "Current turn", exact: true }),
  ).toContainText("Player 1 · Yellow to move");
});
