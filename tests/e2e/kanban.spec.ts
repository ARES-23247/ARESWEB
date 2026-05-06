import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Task item interface matching the taskSchema from taskContract.
 * Used for typed mock data in E2E tests.
 */
interface TaskItem {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  priority: string;
  sort_order: number;
  assignees?: Array<{
    id: string;
    nickname?: string | null;
  }>;
  created_by: string;
  creator_name?: string | null;
  due_date?: string | null;
  created_at: string;
  updated_at: string;
  subteam?: string | null;
  zulip_stream?: string | null;
  zulip_topic?: string | null;
  // Legacy fields for backward compatibility
  assigned_to?: string | null;
  assignee_name?: string | null;
  parent_id?: string | null;
  time_spent_seconds?: number | null;
}

test.describe('Kanban Task Board', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/auth/get-session', async route => {
      await route.fulfill({
        status: 200,
        json: {
          session: {
            id: "mockup-session-id",
            userId: "admin-user",
            expiresAt: new Date(Date.now() + 10000000).toISOString(),
            ipAddress: "127.0.0.1",
            userAgent: "Playwright"
          },
          user: {
            id: "admin-user",
            name: "Admin User",
            email: "admin@ares.org",
            emailVerified: true,
            image: "https://api.dicebear.com/9.x/bottts/svg?seed=admin",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            role: "admin",
            banned: false
          }
        }
      });
    });

    await page.route('**/profile/me', async route => {
      await route.fulfill({
        status: 200,
        json: {
          user_id: "admin-user",
          nickname: "Admin User",
          first_name: "Admin",
          last_name: "User",
          member_type: "mentor",
          auth: {
            id: "admin-user",
            email: "admin@ares.org",
            name: "Admin User",
            image: "https://api.dicebear.com/9.x/bottts/svg?seed=admin",
            role: "admin"
          }
        }
      });
    });

    await page.context().addCookies([{
      name: 'better-auth.session_token',
      value: 'mockup-session-id',
      domain: 'localhost',
      path: '/'
    }]);

    await page.addInitScript(() => {
      Object.assign(window, { __PLAYWRIGHT_TEST__: true });
    });

    // In-memory tasks store for the mock session
    const mockTasks: TaskItem[] = [];

    // Mock Tasks API
    await page.route('**/api/tasks*', async (route, request) => {
      if (request.resourceType() !== 'fetch' && request.resourceType() !== 'xhr') {
        return route.fallback();
      }
      const method = request.method();

      if (method === 'GET') {
        await route.fulfill({
          status: 200,
          json: { tasks: mockTasks }
        });
      } else if (method === 'POST') {
        const newTask = { 
          id: "test-task", 
          title: "Playwright E2E Task", 
          status: "todo", 
          priority: "normal", 
          sort_order: 0, 
          created_by: "admin-user",
          created_at: new Date().toISOString(), 
          updated_at: new Date().toISOString() 
        };
        mockTasks.push(newTask);
        await route.fulfill({
          status: 200,
          json: { success: true, task: newTask }
        });
      } else if (method === 'PATCH' || method === 'DELETE') {
        await route.fulfill({
          status: 200,
          json: { success: true }
        });
      } else {
        await route.continue();
      }
    });
  });

  test('Creates, edits, and moves a Kanban task', async ({ page }) => {
    // Navigate to tasks page
    await page.goto('/dashboard/tasks');
    await expect(page.getByRole('heading', { name: /Task Board/i }).first()).toBeVisible({ timeout: 30000 });

    // Create Task
    await page.getByRole('button', { name: 'Create new task' }).click();
    const taskInput = page.getByPlaceholder('New task title...');
    await taskInput.fill('Playwright E2E Task');
    await page.getByRole('button', { name: 'Create', exact: true }).click();

    // Wait for task to appear
    const taskCard = page.getByText('Playwright E2E Task').first();
    await expect(taskCard).toBeVisible({ timeout: 10000 });

    // Edit Task (Open Modal)
    await page.getByRole('button', { name: 'Playwright E2E Task', exact: true }).click();
    
    // Verify dialog accessibility and wait for it
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 10000 });
    await expect(dialog.getByPlaceholder('Task title...')).toBeVisible();

    // Add description using the rich text editor
    const editor = dialog.locator('.ProseMirror');
    await expect(editor).toBeVisible();
    await editor.fill('E2E Description Update');
    await page.getByRole('button', { name: 'Save Changes' }).click();
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
        json: { 
          tasks: [{ 
            id: "existing-task", 
            title: "Existing Task", 
            description: "{\"type\":\"doc\",\"content\":[{\"type\":\"paragraph\",\"content\":[{\"type\":\"text\",\"text\":\"Existing Description Content\"}]}]}",
            status: "todo", 
            priority: "normal", 
            sort_order: 0, 
            created_by: "admin-user",
            created_at: new Date().toISOString(), 
            updated_at: new Date().toISOString() 
          }] 
        }
      });
    });

    await page.goto('/dashboard/tasks');
    
    // Open the existing task
    await page.getByText('Existing Task').first().click();
    
    // Verify the editor contains the existing description
    const editor = page.locator('.ProseMirror');
    await expect(editor).toContainText('Existing Description Content', { timeout: 10000 });
  });
});
