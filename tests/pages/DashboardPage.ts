import { Page, Locator } from '@playwright/test';
import { TEST_TIMEOUTS } from '../fixtures/mock-data';

/**
 * Base Page Object for ARES dashboard pages.
 * Provides common functionality for all dashboard sub-pages.
 */
export class DashboardPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  /**
   * Navigate to a dashboard sub-path.
   */
  async goto(path: string): Promise<void> {
    await this.page.goto(`/dashboard/${path}`);
  }

  /**
   * Wait for page to be in loaded state.
   */
  async waitForLoadState(): Promise<void> {
    await this.page.waitForLoadState('domcontentloaded');
  }

  /**
   * Wait for animations to settle and force opacity for accessibility scans.
   * This replaces the waitForTimeout anti-pattern with a more deterministic approach.
   */
  async stabilizeForAccessibility(): Promise<void> {
    // Wait for React to finish rendering
    await this.page.waitForLoadState('domcontentloaded');

    // Wait for Framer Motion animations to settle
    await this.page.waitForFunction(() => {
      const animations = document.getAnimations();
      return animations.every((anim) => anim.playState === 'finished' || anim.playState === 'idle');
    }).catch(() => {
      // If timeout, continue anyway - some animations may loop
    });

    // Force full opacity for contrast scan
    await this.page.addStyleTag({
      content: `
        *, *::before, *::after {
          transition: none !important;
          animation: none !important;
          opacity: 1 !important;
        }
      `,
    });
  }

  /**
   * Get locator for a heading by text.
   */
  getHeading(text: string): Locator {
    return this.page.getByRole('heading', { name: text });
  }

  /**
   * Get locator for a button by name.
   */
  getButton(name: string): Locator {
    return this.page.getByRole('button', { name: name });
  }

  /**
   * Get locator for an input by placeholder.
   */
  getInputByPlaceholder(placeholder: string): Locator {
    return this.page.getByPlaceholder(placeholder);
  }

  /**
   * Check if a live badge is visible (for collaboration tests).
   * Uses the implementation-tied selector as this is tied to current UI.
   */
  async isLiveBadgeVisible(): Promise<boolean> {
    const badge = this.page.locator('.bg-emerald-500\\/10').filter({ hasText: 'Live' }).first();
    const isVisible = await badge.isVisible().catch(() => false);
    return isVisible;
  }

  /**
   * Wait for live badge to be visible.
   */
  async waitForLiveBadge(): Promise<void> {
    const badge = this.page.locator('.bg-emerald-500\\/10').filter({ hasText: 'Live' }).first();
    await badge.waitFor({ state: 'visible', timeout: TEST_TIMEOUTS.SLOW_PAGE });
  }

  /**
   * Get the ProseMirror editor locator.
   */
  getProseMirrorEditor(): Locator {
    return this.page.locator('.ProseMirror');
  }
}
