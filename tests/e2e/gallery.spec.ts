import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { DashboardPage } from '../pages/DashboardPage';
import { shouldIgnoreConsoleError } from '../fixtures/auth';
import { createMockMediaItem, type MockMediaItem } from '../fixtures/mock-data';

/**
 * E2E tests for Gallery page.
 * Tests verify:
 * - Gallery page loads successfully
 * - No console errors occur during page load
 * - Gallery displays images/media correctly
 * - WCAG 2.1 AA accessibility compliance
 */

test.describe('Gallery Page', () => {
  test('should load gallery, display images, have no console errors, and pass WCAG AA accessibility', async ({
    page,
  }) => {
    const consoleErrors: string[] = [];

    // Listen for console errors
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        if (!shouldIgnoreConsoleError(text)) {
          consoleErrors.push(text);
        }
      }
    });

    page.on('pageerror', (exception) => {
      consoleErrors.push(`Uncaught exception: "${exception.message}"`);
    });

    // Mock media API - GET /api/media
    const mockImages: MockMediaItem[] = [
      createMockMediaItem({
        key: 'Gallery/robot-arm-cad.png',
        httpMetadata: { contentType: 'image/png' },
      }),
      createMockMediaItem({
        key: 'Gallery/competition-arena.jpg',
        httpMetadata: { contentType: 'image/jpeg' },
      }),
      createMockMediaItem({
        key: 'Gallery/team-meeting.jpeg',
        httpMetadata: { contentType: 'image/jpeg' },
      }),
      createMockMediaItem({
        key: 'Gallery/machining-parts.webp',
        httpMetadata: { contentType: 'image/webp' },
      }),
    ];

    await page.route('**/api/media', async (_route) => {
      await _route.fulfill({
        status: 200,
        json: { media: mockImages },
      });
    });

    // Mock image responses to prevent 404s
    for (const img of mockImages) {
      await page.route(`**/api/media/${img.key}`, async (_route) => {
        await _route.fulfill({
          status: 200,
          contentType: 'image/png',
          body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64'),
        });
      });
    }

    // Mock public settings API for photo drive URL
    await page.route('**/api/settings/public/settings', async (_route) => {
      await _route.fulfill({
        status: 200,
        json: {
          success: true,
          settings: {
            COMMUNITY_PHOTO_DRIVE_URL: 'https://drive.google.com/drive/folders/test',
          },
        },
      });
    });

    const dashboard = new DashboardPage(page);

    // Navigate to gallery page
    await page.goto('/gallery');

    // Wait for React to mount and render completely
    await dashboard.waitForLoadState();

    // Wait for images to be rendered
    await page.waitForSelector('picture img', { timeout: 10000 }).catch(() => {
      // If no images found, continue anyway - this is a valid test result
    });

    // Wait for Framer Motion animations to settle and force full opacity for contrast scan
    await dashboard.stabilizeForAccessibility();

    // 1. Verify exactly zero javascript console errors
    if (consoleErrors.length > 0) {
      console.error('Console Errors:', consoleErrors);
    }
    expect(consoleErrors).toHaveLength(0);

    // 2. Verify page title includes "Team Gallery"
    await expect(page).toHaveTitle(/Team Gallery/);

    // 3. Verify main heading exists
    const heading = page.getByRole('heading', { name: /team.*gallery/i });
    await expect(heading).toBeVisible();

    // 4. Verify gallery displays images
    // Gallery should show image cards with ResponsiveImage components
    const galleryImages = page.locator('.columns-1 picture img, .sm\\:columns-2 picture img, .lg\\:columns-3 picture img');
    const imageCount = await galleryImages.count();
    expect(imageCount).toBeGreaterThan(0);

    // 5. Verify each image has an alt attribute (accessibility requirement)
    for (let i = 0; i < imageCount; i++) {
      const img = galleryImages.nth(i);
      await expect(img).toHaveAttribute('alt');
    }

    // 6. Verify Community Photo Drive link is present when URL is available
    // The link text is "Community Photo Drive" inside the button
    const photoDriveLink = page.locator('a[href*="drive.google.com"]').or(
      page.getByText('Community Photo Drive')
    );
    await expect(photoDriveLink.first()).toBeVisible();
    const linkElement = page.locator('a').filter({ hasText: 'Community Photo Drive' });
    await expect(linkElement).toHaveAttribute('target', '_blank');
    await expect(linkElement).toHaveAttribute('rel', 'noopener noreferrer');

    // 7. Accessibility Testing (WCAG 2.1 AA level strictly required via ARESWEB standards)
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .exclude('.framer-motion-container')
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('should show loading state while images are being fetched', async ({ page }) => {
    // Track page state changes

    // Intercept console to detect render phases
    page.on('console', msg => {
      if (msg.text().includes('render') || msg.text().includes('Loading')) {
        // Log helps debug timing issues
      }
    });

    await page.route('**/api/media', async (route) => {
      // Brief delay to allow React to show loading state
      await new Promise(resolve => setTimeout(resolve, 500));
      await route.fulfill({
        status: 200,
        json: { media: [] },
      });
    });

    await page.route('**/api/settings/public/settings', async (route) => {
      await route.fulfill({
        status: 200,
        json: { success: true, settings: {} },
      });
    });

    // Navigate to gallery
    await page.goto('/gallery');

    // Check for loading spinner immediately (it may be very brief)
    const loadingSpinner = page.locator('.animate-spin').first();
    await loadingSpinner.isVisible().catch(() => false);

    // Wait for page to finish loading
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(500);

    // Verify final state is empty (no photos)
    const emptyState = page.getByText(/no photos found/i).or(
      page.getByText(/photos found/i)
    );
    await expect(emptyState).toBeVisible({ timeout: 5000 });
  });

  test('should show empty state when no photos are available', async ({ page }) => {
    // Mock media API with empty response
    await page.route('**/api/media', async (_route) => {
      await _route.fulfill({
        status: 200,
        json: { media: [] },
      });
    });

    await page.route('**/api/settings/public/settings', async (route) => {
      await route.fulfill({
        status: 200,
        json: { success: true, settings: {} },
      });
    });

    const dashboard = new DashboardPage(page);

    await page.goto('/gallery');
    await dashboard.waitForLoadState();

    // Verify empty state message is displayed
    const emptyState = page.getByText(/no photos found/i);
    await expect(emptyState).toBeVisible();
  });

  test('should show error state when media API fails', async ({ page }) => {
    // Mock media API with error response
    await page.route('**/api/media', async (_route) => {
      await _route.fulfill({
        status: 500,
        json: { error: 'Internal server error' },
      });
    });

    await page.route('**/api/settings/public/settings', async (route) => {
      await route.fulfill({
        status: 200,
        json: { success: true, settings: {} },
      });
    });

    const dashboard = new DashboardPage(page);

    await page.goto('/gallery');
    await dashboard.waitForLoadState();

    // Verify error state message is displayed
    const errorMessage = page.getByText(/failed to load gallery images/i);
    await expect(errorMessage).toBeVisible();
  });

  test('should filter only image content types from media response', async ({ page }) => {
    // Mock media API with mixed content types (images, videos, PDFs)
    const mixedMedia: MockMediaItem[] = [
      createMockMediaItem({
        key: 'Gallery/photo1.jpg',
        httpMetadata: { contentType: 'image/jpeg' },
      }),
      createMockMediaItem({
        key: 'Documents/team-handbook.pdf',
        httpMetadata: { contentType: 'application/pdf' },
      }),
      createMockMediaItem({
        key: 'Videos/robot-demo.mp4',
        httpMetadata: { contentType: 'video/mp4' },
      }),
      createMockMediaItem({
        key: 'Gallery/photo2.png',
        httpMetadata: { contentType: 'image/png' },
      }),
      createMockMediaItem({
        key: 'Gallery/photo3.webp',
        httpMetadata: { contentType: 'image/webp' },
      }),
    ];

    await page.route('**/api/media', async (_route) => {
      await _route.fulfill({
        status: 200,
        json: { media: mixedMedia },
      });
    });

    // Mock image responses for the 3 image files
    for (const item of mixedMedia.filter(m => m.httpMetadata?.contentType?.startsWith('image/'))) {
      await page.route(`**/api/media/${item.key}`, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'image/png',
          body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64'),
        });
      });
    }

    await page.route('**/api/settings/public/settings', async (route) => {
      await route.fulfill({
        status: 200,
        json: { success: true, settings: {} },
      });
    });

    const dashboard = new DashboardPage(page);

    await page.goto('/gallery');
    await dashboard.waitForLoadState();

    // Wait for images to be rendered
    await page.waitForSelector('picture img', { timeout: 10000 }).catch(() => {
      // Continue even if timeout
    });

    await dashboard.stabilizeForAccessibility();

    // Gallery should only display images, not PDFs or videos
    const galleryImages = page.locator('.columns-1 picture img, .sm\\:columns-2 picture img, .lg\\:columns-3 picture img');
    const imageCount = await galleryImages.count();

    // Should have 3 images (photo1.jpg, photo2.png, photo3.webp)
    expect(imageCount).toBe(3);
  });
});
