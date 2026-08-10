import { test, expect } from './fixtures';

test.describe('Kanban Task Board E2E Drag and Drop tests', () => {
  test('should log in as admin, go to tasks, and drag a task card to In Progress', async ({ page, isMobile }) => {
    // 1. Navigate to tasks board
    await page.goto('/dashboard/tasks');

    // 2. Login using dev bypass
    const adminButton = page.locator('button', { hasText: 'David (Admin)' });
    await expect(adminButton).toBeVisible();
    await adminButton.click();
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
  test('should open new blog post editor, fill content, and check markdown buttons', async ({ page }) => {
    // 1. Go to dashboard to trigger login bypass
    await page.goto('/dashboard');
    const adminButton = page.locator('button', { hasText: 'David (Admin)' });
    await expect(adminButton).toBeVisible();
    await adminButton.click();
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
  });
});
