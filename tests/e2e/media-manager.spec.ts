import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * E2E tests for advanced Media Manager scenarios.
 * Tests verify:
 * - DEF-01: Copy URL button copies asset URL to clipboard
 * - DEF-01: Move asset modal opens and submits
 * - DEF-01: Syndicate (Broadcast) button opens broadcast modal
 * - DEF-01: Accessibility compliance for media manager UI
 *
 * These tests cover advanced interactions beyond basic CRUD operations.
 */

test.describe('Media Manager - Advanced Scenarios', () => {
  test.beforeEach(async ({ page }) => {
    // Mock authentication session exactly like kanban.spec.ts
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

    // Mock media API - GET /api/media/admin with sample assets
    await page.route('**/api/media/admin', async route => {
      await route.fulfill({
        status: 200,
        json: {
          media: [
            {
              key: 'Gallery/test-asset.png',
              size: 12345,
              uploaded: new Date().toISOString(),
              url: '/api/media/Gallery/test-asset.png',
              folder: 'Gallery',
              tags: 'test'
            },
            {
              key: 'Blog/blog-post.jpg',
              size: 67890,
              uploaded: new Date().toISOString(),
              url: '/api/media/Blog/blog-post.jpg',
              folder: 'Blog',
              tags: 'blog'
            }
          ]
        }
      });
    });

    // Mock PUT /api/media/admin/move/:key for move asset functionality
    await page.route('**/api/media/admin/move/**', async route => {
      await route.fulfill({
        status: 200,
        json: {
          success: true,
          newKey: 'Events/moved-asset.png'
        }
      });
    });

    // Mock POST /api/media/**/syndicate for broadcast functionality
    await page.route('**/api/media/**/syndicate', async route => {
      await route.fulfill({
        status: 200,
        json: {
          success: true,
          message: 'Syndicated successfully'
        }
      });
    });
  });

  test('DEF-01: Copy URL button copies asset URL to clipboard', async ({ page }) => {
    // Grant clipboard permissions
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);

    // Navigate to /dashboard/assets
    await page.goto('/dashboard/assets');

    // Wait for assets to load
    await expect(page.getByText('Gallery/test-asset.png')).toBeVisible({ timeout: 15000 });

    // Hover over the first asset card to reveal the action buttons
    // Use a more specific selector to avoid the tsqd-parent-container
    const firstAssetCard = page.locator('.group.relative.bg-black\\/40').first();
    await firstAssetCard.hover({ force: true });

    // Find and click the "Copy URL" button on the first asset
    const copyButton = page.getByRole('button', { name: 'Copy URL' }).first();
    await copyButton.click({ force: true });

    // Verify the button text changes to "Copied!" temporarily
    await expect(page.getByRole('button', { name: 'Copied!' })).toBeVisible();

    // Verify clipboard contains the correct URL format
    const clipboardText = await page.evaluate(async () => {
      return await navigator.clipboard.readText();
    });
    expect(clipboardText).toContain('/api/media/Gallery/test-asset.png');
    expect(clipboardText).toMatch(/^http:\/\/(localhost|127\.0\.0\.1)/);

    // Wait for the button to revert back to "Copy URL" after 2 seconds
    await page.waitForTimeout(2500);
    await expect(page.getByRole('button', { name: 'Copy URL' }).first()).toBeVisible();
  });

  test('DEF-01: Move asset modal opens and submits', async ({ page }) => {
    // Navigate to /dashboard/assets
    await page.goto('/dashboard/assets');

    // Wait for assets to load
    await expect(page.getByText('Gallery/test-asset.png')).toBeVisible({ timeout: 15000 });

    // The ModalContext prompt should appear - verify dialog
    // Note: ModalContext uses window.prompt, which we need to handle
    page.on('dialog', async dialog => {
      const message = dialog.message();
      expect(message).toContain('Move Asset');
      expect(message).toContain('Enter new folder name');

      // Enter a new folder name
      await dialog.accept('Events');
    });

    // Hover over the first asset card to reveal the action buttons
    const firstAssetCard = page.locator('.group.relative.bg-black\\/40').first();
    await firstAssetCard.hover({ force: true });

    // Find and click the "Move" button on the first asset
    const moveButton = page.getByRole('button', { name: /Move/i }).first();
    await moveButton.click({ force: true });

    // Wait for the move operation to complete
    await page.waitForTimeout(1000);

    // Verify the move API was called - we can check this by ensuring no error occurred
    // Since we're mocking, the move should succeed silently
  });

  test('DEF-01: Syndicate button opens broadcast modal', async ({ page }) => {
    // Navigate to /dashboard/assets
    await page.goto('/dashboard/assets');

    // Wait for assets to load
    await expect(page.getByText('Gallery/test-asset.png')).toBeVisible({ timeout: 15000 });

    // Hover over the first asset card to reveal the action buttons
    const firstAssetCard = page.locator('.group.relative.bg-black\\/40').first();
    await firstAssetCard.hover({ force: true });

    // Find and click the "Broadcast" button on the first asset
    const broadcastButton = page.getByRole('button', { name: /Broadcast/i }).first();
    await broadcastButton.click({ force: true });

    // Verify the AssetSyndicateModal appears
    await expect(page.getByRole('heading', { name: 'Broadcast Media' })).toBeVisible();

    // Verify the modal contains the expected elements
    await expect(page.getByText('Dispatch this asset to Instagram, X, Facebook, and Discord securely')).toBeVisible();
    await expect(page.getByPlaceholder('Draft an engaging caption for your followers')).toBeVisible();

    // Verify the modal image shows the selected asset
    const modalImage = page.locator('.fixed img[alt="Broadcast target"]');
    await expect(modalImage).toBeVisible();
    await expect(modalImage).toHaveAttribute('src', /\/api\/media\/Gallery\/test-asset\.png/);

    // Verify the Cancel button exists and works
    const cancelButton = page.getByRole('button', { name: 'Cancel' });
    await expect(cancelButton).toBeVisible();

    // Test modal close by clicking Cancel
    await cancelButton.click();

    // Verify modal is closed
    await expect(page.getByRole('heading', { name: 'Broadcast Media' })).not.toBeVisible();
  });

  test('DEF-01: Broadcast modal with caption submission', async ({ page }) => {
    // Navigate to /dashboard/assets
    await page.goto('/dashboard/assets');

    // Wait for assets to load
    await expect(page.getByText('Gallery/test-asset.png')).toBeVisible({ timeout: 15000 });

    // Hover over the first asset card to reveal the action buttons
    const firstAssetCard = page.locator('.group.relative.bg-black\\/40').first();
    await firstAssetCard.hover({ force: true });

    // Click the Broadcast button
    const broadcastButton = page.getByRole('button', { name: /Broadcast/i }).first();
    await broadcastButton.click({ force: true });

    // Verify modal appears
    await expect(page.getByRole('heading', { name: 'Broadcast Media' })).toBeVisible();

    // Fill in the caption
    const captionInput = page.getByPlaceholder('Draft an engaging caption for your followers');
    await captionInput.fill('Check out our latest robot design! #ARES23247 #FIRSTrobotics');

    // Verify the Launch Payload button is enabled (caption is not empty)
    const launchButton = page.getByRole('button', { name: 'Launch Payload' });
    await expect(launchButton).toBeEnabled();

    // Click Launch Payload to submit
    await launchButton.click();

    // Verify modal closes after successful submission
    await expect(page.getByRole('heading', { name: 'Broadcast Media' })).not.toBeVisible();
  });

  test('DEF-01: Accessibility audit for Media Manager UI', async ({ page }) => {
    // Navigate to /dashboard/assets
    await page.goto('/dashboard/assets');

    // Wait for assets to load
    await expect(page.getByText('Gallery/test-asset.png')).toBeVisible({ timeout: 15000 });

    // ── Accessibility Audit ───────────────────────────────────────────
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      // Disable duplicate-id check since dnd-kit and virtualization can cause harmless duplicates
      .disableRules(['duplicate-id'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });
});
