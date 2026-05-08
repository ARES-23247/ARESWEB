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
    this.createTaskButton = page.getByRole('button', { name: 'Create new task' });
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
   */
  async waitForLoaded(): Promise<void> {
    await this.heading.first().waitFor({ state: 'visible', timeout: TEST_TIMEOUTS.VERY_SLOW });
  }

  /**
   * Create a new task with the given title.
   */
  async createTask(title: string): Promise<void> {
    await this.createTaskButton.click();
    await this.taskInput.fill(title);
    await this.createConfirmButton.click();
  }

  /**
   * Get locator for a task card by title.
   */
  getTaskCard(title: string): Locator {
    return this.page.getByText(title).first();
  }

  /**
   * Click on a task to open its detail modal.
   */
  async openTask(title: string): Promise<void> {
    await this.page.getByRole('button', { name: title, exact: true }).click();
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
