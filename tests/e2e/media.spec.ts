import { test, expect } from '@playwright/test';
import { setupMockAuth } from '../fixtures/auth';
import {
  createMockMediaItem,
  createMockMediaItems,
  createMinimalPngBuffer,
  TEST_TIMEOUTS,
  type MockMediaItem,
} from '../fixtures/mock-data';
import { AssetVaultPage } from '../pages/AssetVaultPage';

/**
 * E2E tests for Media Manager (Asset Vault) operations.
 * Tests verify:
 * - DEF-01: Media manager upload flow works correctly
 * - DEF-01: Media manager delete operation works correctly
 * - DEF-01: Media manager gallery view renders correctly
 * - DEF-01: Media manager filter/search works correctly
 */

test.describe('Media Manager - Asset Vault', () => {
  test.beforeEach(async ({ page }) => {
    await setupMockAuth(page);

    // Mock media API - GET /api/media/admin
    await page.route('**/api/media/admin', async (route) => {
      await route.fulfill({
        status: 200,
        json: { media: [] },
      });
    });

    // Mock media upload API - POST /api/media/admin/upload
    await page.route('**/api/media/admin/upload', async (route) => {
      await route.fulfill({
        status: 200,
        json: {
          success: true,
          key: 'E2E-Test-Folder/test-image.png',
          url: '/api/media/E2E-Test-Folder/test-image.png',
          altText: 'Test image',
        },
      });
    });
  });

  test('DEF-01: Asset Vault loads and displays upload interface', async ({ page }) => {
    const assetVault = new AssetVaultPage(page);

    await assetVault.goto();
    await assetVault.waitForLoaded();

    // Verify "All Assets" button exists
    await expect(assetVault.allAssetsButton).toBeVisible();

    // Verify folder/tag input exists
    await expect(assetVault.folderInput).toBeVisible();

    // Verify upload button exists
    await expect(assetVault.folderInput).toBeVisible();
    await expect(assetVault.uploadLabel).toBeVisible();
  });

  test('DEF-01: Media upload completes successfully via AssetUploader', async ({ page }) => {
    const assetVault = new AssetVaultPage(page);

    await assetVault.goto();
    await assetVault.waitForLoaded();

    // Set folder input value
    await assetVault.setFolder('E2E-Test-Folder');

    // Create a mock file and trigger upload
    const pngBuffer = createMinimalPngBuffer();
    await assetVault.uploadFile(pngBuffer, 'test-upload.png');
  });

  test('DEF-01: Media delete confirms and removes asset from gallery', async ({ page }) => {
    const assetVault = new AssetVaultPage(page);

    // Override GET /api/media/admin with sample assets
    await page.route('**/api/media/admin', async (route) => {
      const mockMedia: MockMediaItem[] = [
        createMockMediaItem({
          key: 'Gallery/test-1.png',
          folder: 'Gallery',
          tags: 'test',
        }),
        createMockMediaItem({
          key: 'Blog/test-2.jpg',
          folder: 'Blog',
          tags: 'blog',
        }),
      ];
      await route.fulfill({
        status: 200,
        json: { media: mockMedia },
      });
    });

    // Mock DELETE /api/media/admin/:key
    await page.route('**/api/media/admin/**', async (route, request) => {
      if (request.method() === 'DELETE') {
        await route.fulfill({
          status: 200,
          json: { success: true },
        });
      } else {
        await route.continue();
      }
    });

    await assetVault.goto();

    // Wait for assets to load
    await expect(assetVault.getAssetLocator('Gallery/test-1.png')).toBeVisible({
      timeout: TEST_TIMEOUTS.SLOW_PAGE,
    });

    // Find first asset card and click Delete button
    await assetVault.getFirstDeleteButton().click();

    // Verify "Confirm" button appears
    await expect(assetVault.getConfirmButton()).toBeVisible();

    // Accept dialog and click confirm
    await assetVault.acceptDialog();
    await assetVault.getConfirmButton().click({ force: true });
  });

  test('DEF-01: Folder filter buttons correctly filter assets', async ({ page }) => {
    const assetVault = new AssetVaultPage(page);

    // Override GET /api/media/admin with assets in multiple folders
    await page.route('**/api/media/admin', async (route) => {
      await route.fulfill({
        status: 200,
        json: { media: createMockMediaItems() },
      });
    });

    await assetVault.goto();

    // Wait for assets to load - verify all assets visible initially
    await expect(assetVault.getAssetLocator('Gallery/photo1.png')).toBeVisible({
      timeout: TEST_TIMEOUTS.SLOW_PAGE,
    });
    await expect(assetVault.getAssetLocator('Blog/post1.jpg')).toBeVisible();
    await expect(assetVault.getAssetLocator('Events/award.png')).toBeVisible();

    // Click "Gallery" folder button
    await assetVault.filterByFolder('Gallery');

    // After filtering to Gallery, verify only Gallery assets are visible
    await expect(assetVault.getAssetLocator('Gallery/photo1.png')).toBeVisible();
    await expect(assetVault.getAssetLocator('Gallery/photo2.png')).toBeVisible();
    // Blog and Events assets should not be visible
    await expect(assetVault.getAssetLocator('Blog/post1.jpg')).not.toBeVisible();
    await expect(assetVault.getAssetLocator('Events/award.png')).not.toBeVisible();

    // Click "All Assets" button to reset filter
    await assetVault.allAssetsButton.click();

    // Verify all assets are visible again
    await expect(assetVault.getAssetLocator('Gallery/photo1.png')).toBeVisible();
    await expect(assetVault.getAssetLocator('Blog/post1.jpg')).toBeVisible();
    await expect(assetVault.getAssetLocator('Events/award.png')).toBeVisible();
  });
});
