import { test, expect } from "./fixtures";

test.describe("Markdown Editor & Blog Post Creator E2E tests", () => {
  test("opens an accessible editor and protects a dirty draft from accidental close", async ({
    page,
    loginAs,
  }) => {
    await loginAs("admin");
    await page.goto("/dashboard");
    await expect(
      page.getByRole("heading", { name: "Command Center" }),
    ).toBeVisible({ timeout: 15000 });

    // 2. Navigate to blog feed page
    await page.goto("/blog");

    // 3. Click "New Blog Post" button to open the editor drawer
    const newPostBtn = page.locator('button:has-text("New Blog Post")');
    await expect(newPostBtn).toBeVisible();
    await newPostBtn.click();

    // 4. Verify the labeled editor summary is interactive. Development-mode
    // remounts may race the first synthetic input event under WebKit, so retry
    // the complete user action and exact-value assertion as one operation.
    const editor = page.getByRole("dialog");
    const editorTextarea = editor.getByRole("textbox", {
      name: "Short Abstract Summary",
    });
    await expect(editorTextarea).toBeVisible();
    const summary = "This is a test blog post for ARES.";
    await expect(async () => {
      await editorTextarea.fill(summary);
      await expect(editorTextarea).toHaveValue(summary);
    }).toPass();

    const closeEditor = page.getByRole("button", {
      name: "Close editor",
      exact: true,
    });
    await expect(editor).toBeVisible();
    await expect(closeEditor).toBeInViewport();

    await closeEditor.click();
    const dirtyClosePrompt = page.getByRole("alertdialog", {
      name: "Close with unsaved changes?",
    });
    await expect(dirtyClosePrompt).toBeVisible();
    await expect(
      dirtyClosePrompt.getByRole("button", { name: "Keep Editing" }),
    ).toBeFocused();
    await dirtyClosePrompt
      .getByRole("button", { name: "Keep Editing" })
      .click();
    await expect(editor).toBeVisible();
    await expect(dirtyClosePrompt).toBeHidden();

    await closeEditor.click();
    await dirtyClosePrompt
      .getByRole("button", { name: "Close and Keep Draft" })
      .click();
    await expect(editor).toBeHidden();

    await newPostBtn.click();
    const recoveryPrompt = page.getByRole("alertdialog", {
      name: "Local recovery draft available",
    });
    await expect(recoveryPrompt).toBeVisible();
    await recoveryPrompt.getByRole("button", { name: "Restore Draft" }).click();
    await expect(
      page
        .getByRole("dialog")
        .getByRole("textbox", { name: "Short Abstract Summary" }),
    ).toHaveValue(summary);
  });
});
