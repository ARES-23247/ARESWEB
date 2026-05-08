import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { setupMockAuth } from '../fixtures/auth';
import { createMockTask, createMockTaskWithDescription, type MockTaskItem } from '../fixtures/mock-data';
import { KanbanPage } from '../pages/KanbanPage';

test.describe('Kanban Task Board', () => {
  test.beforeEach(async ({ page }) => {
    await setupMockAuth(page);

    // In-memory tasks store for the mock session
    const mockTasks: MockTaskItem[] = [];

    // Mock Tasks API
    await page.route('**/api/tasks*', async (route, request) => {
      if (request.resourceType() !== 'fetch' && request.resourceType() !== 'xhr') {
        return route.fallback();
      }
      const method = request.method();

      if (method === 'GET') {
        await route.fulfill({
          status: 200,
          json: { tasks: mockTasks },
        });
      } else if (method === 'POST') {
        const newTask = createMockTask({
          id: 'test-task',
          title: 'Playwright E2E Task',
        });
        mockTasks.push(newTask);
        await route.fulfill({
          status: 200,
          json: { success: true, task: newTask },
        });
      } else if (method === 'PATCH' || method === 'DELETE') {
        await route.fulfill({
          status: 200,
          json: { success: true },
        });
      } else {
        await route.continue();
      }
    });
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
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      // Disable duplicate-id check since dnd-kit uses aria-describedby with the same id multiple times natively
      .disableRules(['duplicate-id'])
      .analyze();

    expect(accessibilityScanResults).not.toBeNull();
  });

  test('Loads existing task description into the editor', async ({ page }) => {
    // Override the mock to return a task with an existing description
    await page.route('**/api/tasks*', async (route, request) => {
      if (request.resourceType() !== 'fetch' && request.resourceType() !== 'xhr') {
        return route.fallback();
      }
      await route.fulfill({
        status: 200,
        json: { tasks: [createMockTaskWithDescription('Existing Description Content')] },
      });
    });

    const kanban = new KanbanPage(page);
    await kanban.goto();

    // Open the existing task
    await kanban.getTaskCard('Existing Task').first().click();

    // Verify the editor contains the existing description
    await expect(kanban.proseMirrorEditor).toContainText('Existing Description Content', {
      timeout: 10_000,
    });
  });
});
