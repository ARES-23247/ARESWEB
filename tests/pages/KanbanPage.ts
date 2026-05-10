import { Page, Locator } from '@playwright/test';
import { TEST_TIMEOUTS } from '../fixtures/mock-data';

/**
 * Page Object for the Kanban Task Board dashboard page.
 * Encapsulates selectors and actions for task management tests.
 */
export class KanbanPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly createTaskButton: Locator;
  readonly taskInput: Locator;
  readonly createConfirmButton: Locator;
  readonly proseMirrorEditor: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: /Task Board/i });
    // Create button has aria-label, not visible text
    this.createTaskButton = page.getByRole('button', { name: /Create new task/i });
    this.taskInput = page.getByPlaceholder('New task title...');
    this.createConfirmButton = page.getByRole('button', { name: 'Create', exact: true });
    this.proseMirrorEditor = page.locator('.ProseMirror');
  }

  /**
   * Navigate to the Kanban Task Board page.
   */
  async goto(): Promise<void> {
    await this.page.goto('/dashboard/tasks');
  }

  /**
   * Wait for the page to load completely.
   * Also waits for task cards or empty state to appear.
   */
  async waitForLoaded(): Promise<void> {
    await this.heading.first().waitFor({ state: 'visible', timeout: TEST_TIMEOUTS.VERY_SLOW });
    // Wait for tasks to load - check for task cards OR empty state
    await this.page.waitForSelector('[data-testid="task-card"], .p-4:has-text("No tasks")', { timeout: TEST_TIMEOUTS.VERY_SLOW }).catch(() => {
      // If no selector found, just continue - page might still be loading
    });
  }

  /**
   * Create a new task with the given title.
   * Waits for the create form to close and task to appear.
   */
  async createTask(title: string): Promise<void> {
    await this.createTaskButton.click();
    await this.taskInput.fill(title);
    await this.createConfirmButton.click();
    // Wait for the create form to close (input should become hidden)
    await this.page.waitForTimeout(500);
    // Wait for task card to appear
    await this.page.waitForSelector('[data-testid="task-card"]', { timeout: 10000 }).catch(() => {
      // Continue even if task doesn't appear - let the test assertion handle failure
    });
  }

  /**
   * Get locator for a task card by title.
   */
  getTaskCard(title: string): Locator {
    return this.page.getByText(title).first();
  }

  /**
   * Click on a task to open its detail modal.
   * The task title is inside a button within the task card.
   */
  async openTask(title: string): Promise<void> {
    // Try multiple strategies to find and click the task
    const taskCard = this.page.locator('[data-testid="task-card"]').filter({ hasText: title }).first();
    await taskCard.click();
  }

  /**
   * Get the task detail dialog locator.
   */
  getDialog(): Locator {
    return this.page.getByRole('dialog');
  }

  /**
   * Set the task description in the rich text editor.
   */
  async setDescription(text: string): Promise<void> {
    await this.proseMirrorEditor.fill(text);
  }

  /**
   * Click the Save Changes button in the task dialog.
   */
  async saveChanges(): Promise<void> {
    await this.page.getByRole('button', { name: 'Save Changes' }).click();
  }

  /**
   * Get locator for task title input in dialog.
   */
  getTaskTitleInput(): Locator {
    return this.page.getByPlaceholder('Task title...');
  }
}
