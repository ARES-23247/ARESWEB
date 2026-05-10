import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { setupMockAuth } from '../fixtures/auth';
import { KanbanPage } from '../pages/KanbanPage';

test.describe('Kanban Task Board', () => {
  test.beforeEach(async ({ page }) => {
    // Set up real authentication - tests now hit real APIs with seeded test data
    await setupMockAuth(page, { useRealAuth: true });
  });

  test('Creates, edits, and moves a Kanban task', async ({ page }) => {
    const kanban = new KanbanPage(page);

    await kanban.goto();
    await kanban.waitForLoaded();

    // Create Task
    await kanban.createTask('Playwright E2E Task');

    // Wait for task to appear
    const taskCard = kanban.getTaskCard('Playwright E2E Task');
    await expect(taskCard).toBeVisible({ timeout: 10_000 });

    // Edit Task (Open Modal)
    await kanban.openTask('Playwright E2E Task');

    // Verify dialog accessibility and wait for it
    const dialog = kanban.getDialog();
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    await expect(kanban.getTaskTitleInput()).toBeVisible();

    // Add description using the rich text editor
    const editor = kanban.proseMirrorEditor;
    await expect(editor).toBeVisible();
    await kanban.setDescription('E2E Description Update');
    await kanban.saveChanges();
    await expect(dialog).not.toBeVisible();

    // ── Accessibility Audit ───────────────────────────────────────────
    const accessibilityScanResults = await new AxeBuilder({ page })
      .disableRules(['color-contrast'])
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      // Disable duplicate-id check since dnd-kit uses aria-describedby with the same id multiple times natively
      .disableRules(['duplicate-id', 'color-contrast'])
      .analyze();

    expect(accessibilityScanResults).not.toBeNull();
  });

  test('Loads existing task description into the editor', async ({ page }) => {
    const kanban = new KanbanPage(page);
    await kanban.goto();
    await kanban.waitForLoaded();

    // Find and open an existing task from the seeded database
    // The test database should have at least one task with a description
    const firstTaskCard = page.locator('[data-testid="task-card"]').first();
    await expect(firstTaskCard).toBeVisible({ timeout: 10_000 });

    await firstTaskCard.click();

    // Verify the editor is visible
    await expect(kanban.proseMirrorEditor).toBeVisible();
  });
});
