import { test, expect } from "./fixtures";

test.describe("Kanban Task Board status movement tests", () => {
  test("should log in as admin, go to tasks, and move a task card to In Progress", async ({
    page,
    loginAs,
  }) => {
    await loginAs("admin");
    // 1. Navigate to tasks board
    await page.goto("/dashboard/tasks");

    await expect(
      page.getByRole("heading", { name: "Kanban Tasks" }),
    ).toBeVisible({ timeout: 15000 });

    // 3. Locate task card on board
    const taskCard = page.getByRole("article", { name: /^Task:/ }).first();
    await expect(taskCard).toBeVisible();
    const taskLabel = await taskCard.getAttribute("aria-label");

    const inProgressColumn = page.getByLabel("In Progress task column");

    // 4. Use the deterministic keyboard-accessible status control. Native
    // HTML drag remains available as a pointer enhancement, but its synthetic
    // dataTransfer behavior differs across browser engines.
    await taskCard
      .getByRole("combobox", { name: /Move .* to another status/ })
      .selectOption("in_progress");

    await expect(
      inProgressColumn.locator(`[aria-label="${taskLabel}"]`),
    ).toBeVisible();
  });

  test("opens the exact task card from a ?task= deep link", async ({ page, loginAs }) => {
    await loginAs("admin");
    await page.goto("/dashboard/tasks?task=task_1");

    const dialog = page.getByRole("dialog", { name: "Task Card Details" });
    await expect(dialog).toBeVisible({ timeout: 15000 });
    await expect(dialog.getByLabel("Task Title")).toHaveValue("Calibrate Mecanum kS Friction Feedforward");
  });

  test("blocks creating a task until a title is provided", async ({
    page,
    loginAs,
  }) => {
    await loginAs("admin");
    await page.goto("/dashboard/tasks");
    await expect(
      page.getByRole("heading", { name: "Kanban Tasks" }),
    ).toBeVisible({ timeout: 15000 });

    await page.getByRole("button", { name: "Create Task" }).click();
    const editor = page.getByRole("dialog", { name: "Create Task Card" });
    await expect(editor).toBeVisible();

    const submit = editor.getByRole("button", { name: "Add Task Card" });
    await expect(submit).toBeDisabled();
    const title = editor.getByLabel("Task Title");
    const taskTitle = "Validate drivetrain telemetry";
    // A development-mode remount can race the first synthetic input event
    // under a saturated WebKit run. Retry the complete user action together
    // with its observable value and validation result, never the assertion in
    // isolation.
    await expect(async () => {
      await title.fill(taskTitle);
      await expect(title).toHaveValue(taskTitle);
      await expect(submit).toBeEnabled();
    }).toPass();
  });
});

