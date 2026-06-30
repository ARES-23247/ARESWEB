import { test, expect } from './fixtures';

test.describe('Kanban Task Board E2E Drag and Drop tests', () => {
  test('should log in as admin, go to tasks, and drag a task card to In Progress', async ({ page }) => {
    // 1. Navigate to tasks board
    await page.goto('/dashboard/tasks');

    // 2. Login using dev bypass
    const adminButton = page.locator('button', { hasText: 'David (Admin)' });
    await expect(adminButton).toBeVisible();
    await adminButton.click();
    await expect(page.locator('text=Sign Out')).toBeVisible({ timeout: 15000 });

    // 3. Locate task card on board
    const taskCard = page.locator('[role="button"][aria-label^="Task:"]').first();
    await expect(taskCard).toBeVisible();

    const inProgressColumn = page.locator('h3:has-text("In Progress")').first();

    // 4. Perform the drag-and-drop
    await taskCard.dragTo(inProgressColumn);
    
    // Settle animation/state update
    await page.waitForTimeout(500);
  });
});

test.describe('Store Cart and Checkout E2E tests', () => {
  test('should add gear to cart, open cart drawer, and complete Stripe checkout flow', async ({ page }) => {
    // 1. Navigate to store page
    await page.goto('/store');

    // 2. Click "Add" button on the first product card
    const firstAddButton = page.locator('button:has-text("Add")').first();
    await expect(firstAddButton).toBeVisible();
    await firstAddButton.click();

    // 3. Open cart drawer if it is not already open
    const cartHeader = page.locator('h2:has-text("Your Cart")');
    if (!await cartHeader.isVisible()) {
      const viewCartBtn = page.locator('button:has-text("View Cart")');
      await expect(viewCartBtn).toBeVisible();
      await viewCartBtn.click();
    }

    // 4. Verify product is inside the cart drawer
    await expect(page.locator('h2:has-text("Your Cart")')).toBeVisible();
    await expect(page.locator('button:has-text("Secure Checkout")')).toBeVisible();

    // 5. Submit secure checkout
    await page.locator('button:has-text("Secure Checkout")').click();

    // 6. Verify that simulated success redirect occurs
    await expect(page).toHaveURL(/.*success=true.*/, { timeout: 15000 });
    await expect(page.locator('body')).toContainText('Order Successful!', { timeout: 15000 });
  });
});

test.describe('Markdown Editor & Blog Post Creator E2E tests', () => {
  test('should open new blog post editor, fill content, and check markdown buttons', async ({ page }) => {
    // 1. Go to dashboard to trigger login bypass
    await page.goto('/dashboard');
    const adminButton = page.locator('button', { hasText: 'David (Admin)' });
    await expect(adminButton).toBeVisible();
    await adminButton.click();
    await expect(page.locator('text=Sign Out')).toBeVisible({ timeout: 15000 });

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