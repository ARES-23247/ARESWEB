import { Page, Locator } from '@playwright/test';

/**
 * Page Object for Media Manager advanced scenarios.
 * Encapsulates selectors and actions for copy URL, move, and broadcast functionality.
 */
export class MediaManagerPage {
  readonly page: Page;
  readonly assetCard: Locator;
  readonly copyUrlButton: Locator;
  readonly copiedButton: Locator;
  readonly moveButton: Locator;
  readonly broadcastButton: Locator;
  readonly broadcastHeading: Locator;
  readonly captionInput: Locator;
  readonly launchButton: Locator;
  readonly cancelButton: Locator;
  readonly modalImage: Locator;

  constructor(page: Page) {
    this.page = page;
    this.assetCard = page.locator('.group.relative.bg-black\\/40').first();
    this.copyUrlButton = page.getByRole('button', { name: 'Copy URL' });
    this.copiedButton = page.getByRole('button', { name: 'Copied!' });
    this.moveButton = page.getByRole('button', { name: /Move/i });
    this.broadcastButton = page.getByRole('button', { name: /Broadcast/i });
    this.broadcastHeading = page.getByRole('heading', { name: 'Broadcast Media' });
    this.captionInput = page.getByPlaceholder('Draft an engaging caption for your followers');
    this.launchButton = page.getByRole('button', { name: 'Launch Payload' });
    this.cancelButton = page.getByRole('button', { name: 'Cancel' });
    this.modalImage = page.locator('.fixed img[alt="Broadcast target"]');
  }

  /**
   * Navigate to the Media Manager page.
   */
  async goto(): Promise<void> {
    await this.page.goto('/dashboard/assets');
  }

  /**
   * Wait for assets to load.
   */
  async waitForAssets(): Promise<void> {
    await this.page.waitForTimeout(500); // Brief wait for render
  }

  /**
   * Hover over the first asset card to reveal action buttons.
   */
  async hoverFirstAsset(): Promise<void> {
    await this.assetCard.hover({ force: true });
  }

  /**
   * Click the Copy URL button on the first asset.
   */
  async clickCopyUrl(): Promise<void> {
    await this.copyUrlButton.first().click({ force: true });
  }

  /**
   * Get the current clipboard text.
   */
  async getClipboardText(): Promise<string> {
    return this.page.evaluate(async () => {
      return await navigator.clipboard.readText();
    });
  }

  /**
   * Click the Move button on the first asset.
   */
  async clickMove(): Promise<void> {
    await this.moveButton.first().click({ force: true });
  }

  /**
   * Click the Broadcast button on the first asset.
   */
  async clickBroadcast(): Promise<void> {
    await this.broadcastButton.first().click({ force: true });
  }

  /**
   * Check if the broadcast modal is visible.
   */
  async isBroadcastModalVisible(): Promise<boolean> {
    return this.broadcastHeading.isVisible().catch(() => false);
  }

  /**
   * Fill in the caption input in the broadcast modal.
   */
  async setCaption(text: string): Promise<void> {
    await this.captionInput.fill(text);
  }

  /**
   * Click the Launch Payload button.
   */
  async clickLaunch(): Promise<void> {
    await this.launchButton.click();
  }

  /**
   * Click the Cancel button in the broadcast modal.
   */
  async clickCancel(): Promise<void> {
    await this.cancelButton.click();
  }

  /**
   * Setup dialog handler for move asset prompt.
   */
  async handleMoveDialog(newFolder: string): Promise<void> {
    this.page.on('dialog', async (dialog) => {
      const message = dialog.message();
      if (message.includes('Move Asset')) {
        await dialog.accept(newFolder);
      } else {
        await dialog.dismiss();
      }
    });
  }

  /**
   * Get locator for an asset by key.
   */
  getAssetLocator(key: string): Locator {
    return this.page.getByText(key);
  }
}
