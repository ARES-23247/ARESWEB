import { Page, Locator } from '@playwright/test';
import { TEST_TIMEOUTS } from '../fixtures/mock-data';

/**
 * Page Object for the Asset Vault (Media Manager) dashboard page.
 * Encapsulates selectors and actions for media management tests.
 */
export class AssetVaultPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly allAssetsButton: Locator;
  readonly folderInput: Locator;
  readonly uploadInput: Locator;
  readonly uploadLabel: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: 'Asset Vault' });
    this.allAssetsButton = page.getByRole('button', { name: 'All Assets' });
    this.folderInput = page.getByPlaceholder('Assign Tag/Folder');
    this.uploadInput = page.locator('#asset-upload-input');
    this.uploadLabel = page.locator('label[for="asset-upload-input"]');
  }

  /**
   * Navigate to the Asset Vault page.
   */
  async goto(): Promise<void> {
    await this.page.goto('/dashboard/assets');
  }

  /**
   * Wait for the page to load completely.
   */
  async waitForLoaded(): Promise<void> {
    await this.heading.waitFor({ state: 'visible', timeout: TEST_TIMEOUTS.SLOW_PAGE });
  }

  /**
   * Set the folder/tag input value.
   */
  async setFolder(folderName: string): Promise<void> {
    await this.folderInput.fill(folderName);
  }

  /**
   * Upload a file using the mock file input.
   * @param buffer - File content as buffer
   * @param filename - Name of the file
   */
  async uploadFile(buffer: Buffer, filename: string): Promise<void> {
    await this.uploadInput.evaluateHandle(
      (input: HTMLInputElement, { bufferBase64, name }) => {
        const buffer = Uint8Array.from(atob(bufferBase64), (c) => c.charCodeAt(0));
        const file = new File([buffer], name, { type: 'image/png' });
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        input.files = dataTransfer.files;
        input.dispatchEvent(new Event('change', { bubbles: true }));
      },
      { bufferBase64: buffer.toString('base64'), filename },
    );
  }

  /**
   * Get the first delete button on the page.
   */
  getFirstDeleteButton(): Locator {
    return this.page.getByRole('button', { name: 'Delete' }).first();
  }

  /**
   * Get the confirm button (appears after clicking delete).
   */
  getConfirmButton(): Locator {
    return this.page.getByRole('button', { name: 'Confirm' });
  }

  /**
   * Click a folder filter button by name.
   */
  async filterByFolder(folderName: string): Promise<void> {
    await this.page.getByRole('button', { name: folderName }).click();
  }

  /**
   * Check if an asset with the given key is visible.
   */
  async isAssetVisible(key: string): Promise<boolean> {
    const locator = this.page.getByText(key);
    await locator.waitFor({ state: 'attached', timeout: TEST_TIMEOUTS.DEFAULT });
    return locator.isVisible();
  }

  /**
   * Get locator for an asset by its key/filename.
   */
  getAssetLocator(key: string): Locator {
    return this.page.getByText(key);
  }

  /**
   * Accept the native confirm dialog (for delete confirmation).
   */
  async acceptDialog(): Promise<void> {
    this.page.once('dialog', async (dialog) => {
      await dialog.accept();
    });
  }
}
