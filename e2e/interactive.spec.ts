import { test, expect } from './fixtures';

test.describe('Kanban Task Board E2E Drag and Drop tests', () => {
  test('should log in as admin, go to tasks, and drag a task card to In Progress', async ({ page, isMobile, loginAs }) => {
    await loginAs('admin');
    // 1. Navigate to tasks board
    await page.goto('/dashboard/tasks');

    await expect(page.getByRole('heading', { name: 'Kanban Tasks' })).toBeVisible({ timeout: 15000 });

    // 3. Locate task card on board
    const taskCard = page.locator('[role="button"][aria-label^="Task:"]').first();
    await expect(taskCard).toBeVisible();
    const taskLabel = await taskCard.getAttribute('aria-label');

    const inProgressColumn = page.getByLabel('In Progress task column');

    if (isMobile) {
      await expect(inProgressColumn).toBeVisible();
      return;
    }

    // 4. Perform the drag-and-drop
    await taskCard.dragTo(inProgressColumn);
    
    // Settle animation/state update
    await page.waitForTimeout(500);

    await expect(inProgressColumn.locator(`[aria-label="${taskLabel}"]`)).toBeVisible();
  });

  test('blocks creating a task until a title is provided', async ({ page }) => {
    await page.goto('/dashboard/tasks');
    await page.locator('button', { hasText: 'David (Admin)' }).click();
    await expect(page.getByRole('heading', { name: 'Kanban Tasks' })).toBeVisible({ timeout: 15000 });

    await page.getByRole('button', { name: 'Create Task' }).click();
    const editor = page.getByRole('dialog', { name: 'Create Task Card' });
    await expect(editor).toBeVisible();

    const submit = editor.getByRole('button', { name: 'Add Task Card' });
    await expect(submit).toBeDisabled();
    await editor.getByLabel('Task Title').fill('Validate drivetrain telemetry');
    await expect(submit).toBeEnabled();
  });
});

test.describe('Store checkout availability', () => {
  test('does not offer checkout until verified payments are connected', async ({ page }) => {
    await page.goto('/store');

    await expect(page.getByRole('heading', { name: 'Online ordering is not available yet' })).toBeVisible();
    await expect(page.getByText('Checkout unavailable')).toBeVisible();
    await expect(page.getByRole('button', { name: /checkout/i })).toHaveCount(0);
    await expect(page).not.toHaveURL(/success=true/);
  });
});

test.describe('Markdown Editor & Blog Post Creator E2E tests', () => {
  test('opens an accessible editor and protects a dirty draft from accidental close', async ({ page, loginAs }) => {
    await loginAs('admin');
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: 'Command Center' })).toBeVisible({ timeout: 15000 });

    // 2. Navigate to blog feed page
    await page.goto('/blog');

    // 3. Click "New Blog Post" button to open the editor drawer
    const newPostBtn = page.locator('button:has-text("New Blog Post")');
    await expect(newPostBtn).toBeVisible();
    await newPostBtn.click();

    // 4. Verify editor drawer textarea is visible
    const editorTextarea = page.locator('form textarea').first();
    await expect(editorTextarea).toBeVisible();
    
    // Fill in content
    await editorTextarea.fill('This is a test blog post for ARES.');

    // Verify content changed
    await expect(editorTextarea).not.toBeEmpty();

    const editor = page.getByRole('dialog');
    const closeEditor = page.getByRole('button', { name: 'Close editor', exact: true });
    await expect(editor).toBeVisible();
    await expect(closeEditor).toBeInViewport();

    await closeEditor.click();
    const dirtyClosePrompt = page.getByRole('alertdialog', { name: 'Close with unsaved changes?' });
    await expect(dirtyClosePrompt).toBeVisible();
    await expect(dirtyClosePrompt.getByRole('button', { name: 'Keep Editing' })).toBeFocused();
    await dirtyClosePrompt.getByRole('button', { name: 'Keep Editing' }).click();
    await expect(editor).toBeVisible();
    await expect(dirtyClosePrompt).toBeHidden();

    await closeEditor.click();
    await dirtyClosePrompt.getByRole('button', { name: 'Close and Keep Draft' }).click();
    await expect(editor).toBeHidden();

    await newPostBtn.click();
    const recoveryPrompt = page.getByRole('alertdialog', { name: 'Local recovery draft available' });
    await expect(recoveryPrompt).toBeVisible();
    await recoveryPrompt.getByRole('button', { name: 'Restore Draft' }).click();
    await expect(page.locator('form textarea').first()).toHaveValue('This is a test blog post for ARES.');
  });
});
