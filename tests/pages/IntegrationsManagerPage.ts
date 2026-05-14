import { Page, Locator } from '@playwright/test';
import { DashboardPage } from './DashboardPage';

/**
 * Page Object for the Integrations Manager dashboard page.
 * Provides locators and methods for interacting with integration settings.
 */
export class IntegrationsManagerPage extends DashboardPage {
  readonly pageHeading: Locator;
  readonly saveButton: Locator;
  readonly successMessage: Locator;
  readonly exportButton: Locator;

  // Zulip Card Locators
  readonly zulipCard: Locator;
  readonly zulipUrlInput: Locator;
  readonly zulipBotEmailInput: Locator;
  readonly zulipApiKeyInput: Locator;
  readonly zulipWebhookTokenInput: Locator;
  readonly zulipAdminStreamInput: Locator;
  readonly zulipCommentStreamInput: Locator;

  // GitHub Card Locators
  readonly githubCard: Locator;
  readonly githubPatInput: Locator;
  readonly githubOrgInput: Locator;
  readonly githubProjectIdInput: Locator;
  readonly githubWebhookSecretInput: Locator;

  // Social Integrations Locators
  readonly blueskyCard: Locator;
  readonly blueskyHandleInput: Locator;
  readonly blueskyAppPasswordInput: Locator;

  // Resend Card Locators
  readonly resendCard: Locator;
  readonly resendApiKeyInput: Locator;
  readonly resendFromEmailInput: Locator;

  // Backup Card Locators
  readonly backupCard: Locator;

  constructor(page: Page) {
    super(page);

    // Main page elements
    this.pageHeading = page.getByRole('heading', { name: /API & Integrations/i });
    this.saveButton = page.getByRole('button', { name: /Save Changes/i });
    this.successMessage = page.getByText(/Integrations synchronized securely/i);
    this.exportButton = page.getByRole('button', { name: /Export JSON Backup/i });

    // Zulip Card - using specific IDs from the component
    this.zulipCard = page.locator('.glass-card').filter({ hasText: 'Zulip Team Chat' }).first();
    this.zulipUrlInput = page.locator('#zulip_url');
    this.zulipBotEmailInput = page.locator('#zulip_bot_email');
    this.zulipApiKeyInput = page.locator('#zulip_api_key');
    this.zulipWebhookTokenInput = page.locator('#zulip_webhook_token');
    this.zulipAdminStreamInput = page.locator('#zulip_admin_stream');
    this.zulipCommentStreamInput = page.locator('#zulip_comment_stream');

    // GitHub Card
    this.githubCard = page.locator('.glass-card').filter({ hasText: 'GitHub Projects v2' }).first();
    this.githubPatInput = page.locator('#github_pat');
    this.githubOrgInput = page.locator('#github_org');
    this.githubProjectIdInput = page.locator('#github_project_id');
    this.githubWebhookSecretInput = page.locator('#github_webhook_secret');

    // Social Integrations
    this.blueskyCard = page.locator('.glass-card').filter({ hasText: 'Bluesky Network' }).first();
    this.blueskyHandleInput = page.locator('#bsky_handle');
    this.blueskyAppPasswordInput = page.locator('#bsky_app_pw');

    // Resend Card
    this.resendCard = page.locator('.bg-obsidian').filter({ hasText: 'Resend Mass Email' }).first();
    this.resendApiKeyInput = page.locator('#resend-api-key');
    this.resendFromEmailInput = page.locator('#resend-from-email');

    // Backup Card
    this.backupCard = page.locator('.bg-ares-black').filter({ hasText: 'Data Management & Backup' });
  }

  /**
   * Navigate to the integrations manager page.
   */
  async goto(): Promise<void> {
    await super.goto('integrations');
  }

  /**
   * Fill in Zulip integration settings.
   */
  async fillZulipSettings(settings: {
    url: string;
    botEmail: string;
    apiKey: string;
    webhookToken: string;
    adminStream: string;
    commentStream: string;
  }): Promise<void> {
    await this.zulipUrlInput.fill(settings.url);
    await this.zulipBotEmailInput.fill(settings.botEmail);
    await this.zulipApiKeyInput.fill(settings.apiKey);
    await this.zulipWebhookTokenInput.fill(settings.webhookToken);
    await this.zulipAdminStreamInput.fill(settings.adminStream);
    await this.zulipCommentStreamInput.fill(settings.commentStream);
  }

  /**
   * Fill in GitHub integration settings.
   */
  async fillGithubSettings(settings: {
    pat: string;
    org: string;
    projectId: string;
    webhookSecret: string;
  }): Promise<void> {
    await this.githubPatInput.fill(settings.pat);
    await this.githubOrgInput.fill(settings.org);
    await this.githubProjectIdInput.fill(settings.projectId);
    await this.githubWebhookSecretInput.fill(settings.webhookSecret);
  }

  /**
   * Fill in Resend email integration settings.
   */
  async fillResendSettings(settings: {
    apiKey: string;
    fromEmail: string;
  }): Promise<void> {
    await this.resendApiKeyInput.fill(settings.apiKey);
    await this.resendFromEmailInput.fill(settings.fromEmail);
  }

  /**
   * Save the current integration settings.
   */
  async saveSettings(): Promise<void> {
    await this.saveButton.click();
    // Wait for success message to appear
    await this.successMessage.waitFor({ state: 'visible', timeout: 5000 });
  }

  /**
   * Clear all integration settings form fields.
   */
  async clearAllSettings(): Promise<void> {
    await this.zulipUrlInput.fill('');
    await this.zulipBotEmailInput.fill('');
    await this.zulipApiKeyInput.fill('');
    await this.zulipWebhookTokenInput.fill('');
    await this.zulipAdminStreamInput.fill('');
    await this.zulipCommentStreamInput.fill('');
    await this.githubPatInput.fill('');
    await this.githubOrgInput.fill('');
    await this.githubProjectIdInput.fill('');
    await this.githubWebhookSecretInput.fill('');
    await this.discordWebhookInput.fill('');
    await this.blueskyHandleInput.fill('');
    await this.blueskyAppPasswordInput.fill('');
    await this.gcalInternalIdInput.fill('');
    await this.gcalOutreachIdInput.fill('');
    await this.gcalExternalIdInput.fill('');
    await this.resendApiKeyInput.fill('');
    await this.resendFromEmailInput.fill('');
  }

  /**
   * Get the current value of a specific integration setting.
   */
  async getSettingValue(settingKey: string): Promise<string | null> {
    const inputMap: Record<string, Locator> = {
      'ZULIP_URL': this.zulipUrlInput,
      'ZULIP_BOT_EMAIL': this.zulipBotEmailInput,
      'ZULIP_API_KEY': this.zulipApiKeyInput,
      'GITHUB_ORG': this.githubOrgInput,
      'GITHUB_PAT': this.githubPatInput,
      'DISCORD_WEBHOOK_URL': this.discordWebhookInput,
      'BLUESKY_HANDLE': this.blueskyHandleInput,
      'RESEND_FROM_EMAIL': this.resendFromEmailInput,
    };

    const input = inputMap[settingKey];
    if (!input) return null;

    return await input.inputValue();
  }

  /**
   * Check if the save button is enabled.
   */
  async isSaveButtonEnabled(): Promise<boolean> {
    const isEnabled = await this.saveButton.isEnabled();
    return isEnabled;
  }

  /**
   * Check if the success message is visible.
   */
  async isSuccessMessageVisible(): Promise<boolean> {
    return await this.successMessage.isVisible().catch(() => false);
  }

  /**
   * Wait for the settings form to be fully loaded.
   */
  async waitForSettingsLoaded(): Promise<void> {
    await this.zulipUrlInput.waitFor({ state: 'visible', timeout: 10000 });
  }

  /**
   * Click export backup button.
   */
  async clickExportBackup(): Promise<void> {
    await this.exportButton.click();
  }
}
