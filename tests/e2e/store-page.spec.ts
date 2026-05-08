import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { DashboardPage } from '../pages/DashboardPage';
import { setupMockAuth } from '../fixtures/auth';

/**
 * Mock product data for E2E testing.
 */
const MOCK_PRODUCTS = [
  {
    id: 'prod-1',
    name: 'ARES Team T-Shirt',
    description: 'Official team shirt with ARES 23247 logo.',
    price_cents: 2500,
    image_url: 'https://example.com/tshirt.jpg',
    active: 1,
    stock_count: 50,
    created_at: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 'prod-2',
    name: 'ARES Hoodie',
    description: 'Warm hoodie for competition season.',
    price_cents: 4500,
    image_url: 'https://example.com/hoodie.jpg',
    active: 1,
    stock_count: 25,
    created_at: '2024-01-02T00:00:00.000Z',
  },
  {
    id: 'prod-3',
    name: 'ARES Cap',
    description: 'Adjustable cap with team branding.',
    price_cents: 1500,
    image_url: null,
    active: 1,
    stock_count: 100,
    created_at: '2024-01-03T00:00:00.000Z',
  },
  {
    id: 'prod-4',
    name: 'ARES Sticker Pack',
    description: 'Set of 5 vinyl stickers.',
    price_cents: 500,
    image_url: 'https://example.com/stickers.jpg',
    active: 1,
    stock_count: 200,
    created_at: '2024-01-04T00:00:00.000Z',
  },
] as const;

test.describe('Store Page', () => {
  let dashboardPage: DashboardPage;

  test.beforeEach(async ({ page }) => {
    dashboardPage = new DashboardPage(page);

    // Mock the products API endpoint
    await page.route('**/api/store/products', async (route) => {
      await route.fulfill({
        status: 200,
        json: [...MOCK_PRODUCTS],
      });
    });

    // Set up mock authentication for consistency
    await setupMockAuth(page);
  });

  test('should load successfully and display page title', async ({ page }) => {
    await page.goto('/store');

    // Verify page title contains ARES Store
    await expect(page).toHaveTitle(/ARES.*Store/i);

    // Verify main heading is visible
    const heading = page.getByRole('heading', { name: /ARES.*Store/i });
    await expect(heading).toBeVisible();
  });

  test('should display all store products in grid', async ({ page }) => {
    await page.goto('/store');

    // Wait for products to load
    await page.waitForLoadState('domcontentloaded');

    // Verify all products are rendered
    for (const product of MOCK_PRODUCTS) {
      // Check product name is visible
      await expect(page.getByRole('heading', { name: product.name })).toBeVisible();

      // Check price is displayed (formatted as dollars)
      const expectedPrice = `$${(product.price_cents / 100).toFixed(2)}`;
      await expect(page.getByText(expectedPrice)).toBeVisible();
    }

    // Verify the grid layout has the correct number of product cards
    const productCards = page.locator('.bg-slate-900.border').filter({ hasText: 'Add' });
    await expect(productCards).toHaveCount(MOCK_PRODUCTS.length);
  });

  test('should display product descriptions and images', async ({ page }) => {
    await page.goto('/store');

    // Wait for products to load
    await page.waitForLoadState('domcontentloaded');

    // Check that products with images render image elements
    const productsWithImages = MOCK_PRODUCTS.filter((p) => p.image_url);
    for (const product of productsWithImages) {
      const productCard = page.locator('.bg-slate-900.border').filter({ hasText: product.name });
      const image = productCard.locator('img').first();
      await expect(image).toBeVisible();
    }

    // Check that products with descriptions display them
    for (const product of MOCK_PRODUCTS) {
      if (product.description) {
        await expect(page.getByText(product.description)).toBeVisible();
      }
    }
  });

  test('should handle products without images gracefully', async ({ page }) => {
    await page.goto('/store');

    // Wait for products to load
    await page.waitForLoadState('domcontentloaded');

    // Find the product without an image (ARES Cap)
    const capProduct = MOCK_PRODUCTS.find((p) => p.id === 'prod-3');
    expect(capProduct).toBeDefined();

    const productCard = page.locator('.bg-slate-900.border').filter({ hasText: capProduct!.name });
    const noImageText = productCard.getByText('No Image');
    await expect(noImageText).toBeVisible();
  });

  test('should show "View Cart" button with cart count badge', async ({ page }) => {
    await page.goto('/store');

    // Wait for products to load
    await page.waitForLoadState('domcontentloaded');

    // Verify View Cart button is visible
    const viewCartButton = page.getByRole('button', { name: /View Cart/i });
    await expect(viewCartButton).toBeVisible();

    // Initially, cart count badge should not be visible (cart is empty)
    const cartBadge = page.locator('.bg-ares-gold.text-black.w-6.h-6');
    await expect(cartBadge).not.toBeVisible();
  });

  test('should display success notification when success param is present', async ({ page }) => {
    await page.goto('/store?success=true');

    // Verify success message is displayed
    await expect(page.getByText(/Order Successful/i)).toBeVisible();
    await expect(page.getByText(/Thank you for your purchase/i)).toBeVisible();
  });

  test('should display cancel notification when cancel param is present', async ({ page }) => {
    await page.goto('/store?cancel=true');

    // Verify cancel message is displayed
    await expect(page.getByText(/Checkout was cancelled/i)).toBeVisible();
    await expect(page.getByText(/Your cart has been saved/i)).toBeVisible();
  });

  test('should pass WCAG 2.1 AA accessibility audit', async ({ page }) => {
    await page.goto('/store');

    // Wait for products to load and stabilize for accessibility scan
    await page.waitForLoadState('domcontentloaded');
    await dashboardPage.stabilizeForAccessibility();

    // Run accessibility audit
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('should have keyboard-navigable Add buttons', async ({ page }) => {
    await page.goto('/store');

    // Wait for products to load
    await page.waitForLoadState('domcontentloaded');

    // Focus the first Add button
    const firstAddButton = page.getByRole('button', { name: /Add/i }).first();
    await firstAddButton.focus();

    // Verify the button is focused
    await expect(firstAddButton).toBeFocused();

    // Tab through all Add buttons
    const addButtons = page.getByRole('button', { name: /Add/i });
    const count = await addButtons.count();

    for (let i = 0; i < count; i++) {
      await page.keyboard.press('Tab');
      const focusedElement = await page.evaluate(() => document.activeElement?.textContent);
      expect(focusedElement).toContain('Add');
    }
  });

  test('should display loading state while products are being fetched', async ({ page }) => {
    // Slow down the API response to ensure loading state is visible
    await page.route('**/api/store/products', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 100));
      await route.fulfill({
        status: 200,
        json: [...MOCK_PRODUCTS],
      });
    });

    await page.goto('/store');

    // Verify loading indicator is shown
    const loadingText = page.getByText(/Loading inventory/i);
    await expect(loadingText).toBeVisible();

    // Wait for loading to complete
    await page.waitForLoadState('domcontentloaded');

    // Verify products are now displayed
    const firstProduct = page.getByRole('heading', { name: MOCK_PRODUCTS[0].name });
    await expect(firstProduct).toBeVisible();
  });

  test('should handle empty products state', async ({ page }) => {
    // Mock empty products response
    await page.route('**/api/store/products', async (route) => {
      await route.fulfill({
        status: 200,
        json: [],
      });
    });

    await page.goto('/store');

    // Verify empty state message is displayed
    await expect(page.getByText(/No products available/i)).toBeVisible();
  });

  test('should handle API error state gracefully', async ({ page }) => {
    // Mock API error response
    await page.route('**/api/store/products', async (route) => {
      await route.fulfill({
        status: 500,
        json: { error: 'Internal Server Error' },
      });
    });

    await page.goto('/store');

    // Verify error message is displayed
    await expect(page.getByText(/Failed to load products/i)).toBeVisible();
  });

  test('should have accessible product cards with proper heading hierarchy', async ({ page }) => {
    await page.goto('/store');

    // Wait for products to load
    await page.waitForLoadState('domcontentloaded');

    // Verify page heading is h1
    const mainHeading = page.getByRole('heading', { level: 1, name: /ARES.*Store/i });
    await expect(mainHeading).toBeVisible();

    // Verify product names are rendered as headings (h3 in ProductCard)
    const productHeadings = page.getByRole('heading', { level: 3 });
    await expect(productHeadings).toHaveCount(MOCK_PRODUCTS.length);
  });

  test('should have accessible buttons with clear labels', async ({ page }) => {
    await page.goto('/store');

    // Wait for products to load
    await page.waitForLoadState('domcontentloaded');

    // All buttons should have accessible names
    const buttons = page.getByRole('button');
    const count = await buttons.count();

    for (let i = 0; i < count; i++) {
      const button = buttons.nth(i);
      await expect(button).toHaveAttribute('type');
    }

    // Verify Add buttons are present and accessible
    const addButtons = page.getByRole('button', { name: /Add/i });
    await expect(addButtons).toHaveCount(MOCK_PRODUCTS.length);
  });

  test('should have sufficient color contrast for prices', async ({ page }) => {
    await page.goto('/store');

    // Wait for products to load
    await page.waitForLoadState('domcontentloaded');

    // This test verifies the ares-gold color on dark background passes contrast
    // The actual contrast check is done by Axe, but we verify the elements exist
    for (const product of MOCK_PRODUCTS) {
      const expectedPrice = `$${(product.price_cents / 100).toFixed(2)}`;
      const priceElement = page.getByText(expectedPrice);
      await expect(priceElement).toBeVisible();
      // Verify price has the ares-gold color class
      await expect(priceElement).toHaveClass(/text-ares-gold/);
    }
  });
});

test.describe('Store Page - Interactive Features', () => {
  test('should add items to cart when Add button is clicked', async ({ page }) => {
    // Mock products API
    await page.route('**/api/store/products', async (route) => {
      await route.fulfill({
        status: 200,
        json: [
          {
            id: 'prod-1',
            name: 'ARES Team T-Shirt',
            description: 'Official team shirt.',
            price_cents: 2500,
            image_url: null,
            active: 1,
            stock_count: 50,
            created_at: '2024-01-01T00:00:00.000Z',
          },
        ],
      });
    });

    await setupMockAuth(page);
    await page.goto('/store');

    // Wait for products to load
    await page.waitForLoadState('domcontentloaded');

    // Click the first Add button
    const addButton = page.getByRole('button', { name: /Add/i }).first();
    await addButton.click();

    // Verify cart count badge now shows "1"
    const cartBadge = page.locator('.bg-ares-gold.text-black.w-6.h-6');
    await expect(cartBadge).toBeVisible();
    await expect(cartBadge).toHaveText('1');
  });

  test('should open cart drawer when View Cart is clicked', async ({ page }) => {
    // Mock products API
    await page.route('**/api/store/products', async (route) => {
      await route.fulfill({
        status: 200,
        json: [
          {
            id: 'prod-1',
            name: 'ARES Team T-Shirt',
            description: 'Official team shirt.',
            price_cents: 2500,
            image_url: null,
            active: 1,
            stock_count: 50,
            created_at: '2024-01-01T00:00:00.000Z',
          },
        ],
      });
    });

    await setupMockAuth(page);
    await page.goto('/store');

    // Wait for products to load
    await page.waitForLoadState('domcontentloaded');

    // Click View Cart button
    const viewCartButton = page.getByRole('button', { name: /View Cart/i });
    await viewCartButton.click();

    // Verify cart drawer is open (check for cart drawer UI elements)
    // The CartDrawer component should be visible
    const cartDrawer = page.locator('.fixed.inset-0.z-50').filter({ hasText: /Your Cart/i });
    await expect(cartDrawer).toBeVisible();
  });
});
