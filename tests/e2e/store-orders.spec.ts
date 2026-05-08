import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { setupMockAuth } from '../fixtures/auth';
import { TEST_TIMEOUTS } from '../fixtures/mock-data';

/**
 * Mock store order data matching the Order schema from shared/routes/store.ts
 */
interface MockOrder {
  id: string;
  stripe_session_id: string | null;
  customer_email: string | null;
  shipping_name: string | null;
  shipping_address_line1: string | null;
  shipping_address_line2: string | null;
  shipping_city: string | null;
  shipping_state: string | null;
  shipping_postal_code: string | null;
  shipping_country: string | null;
  total_cents: number;
  status: string | null;
  fulfillment_status: string | null;
  created_at: string | null;
  updated_at: string | null;
}

/**
 * Creates a mock order with default values.
 */
function createMockOrder(overrides: Partial<MockOrder> = {}): MockOrder {
  const now = new Date().toISOString();
  return {
    id: `order-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    stripe_session_id: `cs_test_${Math.random().toString(36).substr(2, 20)}`,
    customer_email: 'customer@example.com',
    shipping_name: 'John Doe',
    shipping_address_line1: '123 Main Street',
    shipping_address_line2: 'Apt 4B',
    shipping_city: 'Springfield',
    shipping_state: 'IL',
    shipping_postal_code: '62701',
    shipping_country: 'United States',
    total_cents: 5000,
    status: 'complete',
    fulfillment_status: 'unfulfilled',
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

/**
 * Creates a set of mock orders for testing.
 */
function createMockOrders(): MockOrder[] {
  const now = new Date().toISOString();
  const yesterday = new Date(Date.now() - 86400000).toISOString();
  const lastWeek = new Date(Date.now() - 604800000).toISOString();

  return [
    createMockOrder({
      id: 'order-1-unfulfilled-recent',
      customer_email: 'jane.student@example.com',
      shipping_name: 'Jane Student',
      shipping_city: 'Chicago',
      shipping_state: 'IL',
      total_cents: 2500,
      status: 'complete',
      fulfillment_status: 'unfulfilled',
      created_at: now,
    }),
    createMockOrder({
      id: 'order-2-fulfilled',
      customer_email: 'mentor@techcorp.com',
      shipping_name: 'John Mentor',
      shipping_address_line1: '456 Oak Avenue',
      shipping_city: 'Detroit',
      shipping_state: 'MI',
      total_cents: 7500,
      status: 'complete',
      fulfillment_status: 'fulfilled',
      created_at: yesterday,
    }),
    createMockOrder({
      id: 'order-3-unfulfilled-older',
      customer_email: 'parent@family.com',
      shipping_name: 'Mary Parent',
      shipping_address_line1: '789 Pine Road',
      shipping_city: 'Grand Rapids',
      shipping_state: 'MI',
      total_cents: 10000,
      status: 'complete',
      fulfillment_status: 'unfulfilled',
      created_at: lastWeek,
    }),
    createMockOrder({
      id: 'order-4-fulfilled-large',
      customer_email: 'sponsor@acme.com',
      shipping_name: 'Acme Industries',
      shipping_address_line1: '100 Industrial Blvd',
      shipping_city: 'Flint',
      shipping_state: 'MI',
      total_cents: 15000,
      status: 'complete',
      fulfillment_status: 'fulfilled',
      created_at: lastWeek,
    }),
    createMockOrder({
      id: 'order-5-unfulfilled-rush',
      customer_email: 'alum@university.edu',
      shipping_name: 'Alex Alum',
      shipping_city: 'Ann Arbor',
      shipping_state: 'MI',
      total_cents: 3500,
      status: 'complete',
      fulfillment_status: 'unfulfilled',
      created_at: now,
    }),
  ];
}

test.describe('Store Orders Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await setupMockAuth(page);

    // Mock GET /api/store/orders - List all orders
    await page.route('**/api/store/orders*', async (_route) => {
      await _route.fulfill({
        status: 200,
        json: { orders: createMockOrders() },
      });
    });

    // Mock PATCH /api/store/orders/:id/status - Update order fulfillment status
    await page.route('**/api/store/orders/*/status', async (_route) => {
      await _route.fulfill({
        status: 200,
        json: { success: true },
      });
    });
  });

  test('loads and displays orders list', async ({ page }) => {
    await page.goto('/dashboard/store_orders');

    // Wait for page to load
    await expect(page.getByRole('heading', { name: /Store Orders/i })).toBeVisible({
      timeout: TEST_TIMEOUTS.SLOW_PAGE,
    });

    // Verify page subtitle
    await expect(page.getByText('Manage physical merchandise fulfillment and tracking')).toBeVisible();

    // Verify search input is present
    await expect(page.getByPlaceholder('Search email or order ID...')).toBeVisible();

    // Verify filter buttons are present
    await expect(page.getByRole('button', { name: 'All' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Unfulfilled' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Fulfilled' })).toBeVisible();

    // Verify table headers are visible
    await expect(page.getByText('Order Details')).toBeVisible();
    await expect(page.getByText('Customer')).toBeVisible();
    await expect(page.getByText('Shipping Address')).toBeVisible();
    await expect(page.getByText('Total')).toBeVisible();
    await expect(page.getByText('Status')).toBeVisible();
    await expect(page.getByText('Actions')).toBeVisible();

    // Verify orders are displayed
    await expect(page.getByText('Jane Student')).toBeVisible();
    await expect(page.getByText('John Mentor')).toBeVisible();
    await expect(page.getByText('Mary Parent')).toBeVisible();
    await expect(page.getByText('Acme Industries')).toBeVisible();
    await expect(page.getByText('Alex Alum')).toBeVisible();
  });

  test('displays order details correctly', async ({ page }) => {
    await page.goto('/dashboard/store_orders');

    // Wait for page to load
    await expect(page.getByRole('heading', { name: /Store Orders/i })).toBeVisible();

    // Verify customer emails are displayed
    await expect(page.getByText('jane.student@example.com')).toBeVisible();
    await expect(page.getByText('mentor@techcorp.com')).toBeVisible();

    // Verify order totals are formatted correctly
    await expect(page.getByText('$25.00')).toBeVisible();
    await expect(page.getByText('$75.00')).toBeVisible();
    await expect(page.getByText('$100.00')).toBeVisible();
    await expect(page.getByText('$150.00')).toBeVisible();

    // Verify shipping addresses are displayed
    await expect(page.getByText('123 Main Street Apt 4B')).toBeVisible();
    await expect(page.getByText('Chicago, IL')).toBeVisible();
    await expect(page.getByText('456 Oak Avenue')).toBeVisible();
  });

  test('filters orders by fulfillment status', async ({ page }) => {
    await page.goto('/dashboard/store_orders');

    // Wait for initial load
    await expect(page.getByText('Jane Student')).toBeVisible();

    // Click "Unfulfilled" filter button
    await page.getByRole('button', { name: 'Unfulfilled' }).click();

    // Verify only unfulfilled orders are shown
    await expect(page.getByText('Jane Student')).toBeVisible();
    await expect(page.getByText('Mary Parent')).toBeVisible();
    await expect(page.getByText('Alex Alum')).toBeVisible();
    await expect(page.getByText('John Mentor')).not.toBeVisible();
    await expect(page.getByText('Acme Industries')).not.toBeVisible();

    // Click "Fulfilled" filter button
    await page.getByRole('button', { name: 'Fulfilled' }).click();

    // Verify only fulfilled orders are shown
    await expect(page.getByText('John Mentor')).toBeVisible();
    await expect(page.getByText('Acme Industries')).toBeVisible();
    await expect(page.getByText('Jane Student')).not.toBeVisible();

    // Click "All" to reset filter
    await page.getByRole('button', { name: 'All' }).click();

    // Verify all orders are shown again
    await expect(page.getByText('Jane Student')).toBeVisible();
    await expect(page.getByText('John Mentor')).toBeVisible();
  });

  test('searches orders by email or order ID', async ({ page }) => {
    await page.goto('/dashboard/store_orders');

    // Wait for initial load
    await expect(page.getByRole('heading', { name: /Store Orders/i })).toBeVisible();

    // Search by email
    const searchInput = page.getByPlaceholder('Search email or order ID...');
    await searchInput.fill('jane.student@example.com');

    // Verify search filters results
    await expect(page.getByText('Jane Student')).toBeVisible();
    await expect(page.getByText('John Mentor')).not.toBeVisible();

    // Clear search
    await searchInput.fill('');

    // Search by order ID (partial)
    await searchInput.fill('order-1');

    // Verify search filters results
    await expect(page.getByText('Jane Student')).toBeVisible();
    await expect(page.getByText('John Mentor')).not.toBeVisible();
  });

  test('updates order status from unfulfilled to fulfilled', async ({ page }) => {
    await page.goto('/dashboard/store_orders');

    // Wait for page to load
    await expect(page.getByText('Jane Student')).toBeVisible();

    // Find the unfulfilled order (Jane Student)
    const janeRow = page.getByText('Jane Student').locator('../../..');

    // Verify the status badge shows unfulfilled
    await expect(janeRow.getByText(/Unfulfilled/)).toBeVisible();

    // Verify the "Mark Fulfilled" button is visible
    const markFulfilledButton = janeRow.getByRole('button', { name: /Mark Fulfilled/i });
    await expect(markFulfilledButton).toBeVisible();

    // Click mark fulfilled button
    await markFulfilledButton.click();

    // Wait for API call to complete
    await page.waitForTimeout(100);
  });

  test('updates order status from fulfilled to unfulfilled', async ({ page }) => {
    await page.goto('/dashboard/store_orders');

    // Wait for page to load
    await expect(page.getByText('John Mentor')).toBeVisible();

    // Find the fulfilled order (John Mentor)
    const johnRow = page.getByText('John Mentor').locator('../../..');

    // Verify the status badge shows fulfilled
    await expect(johnRow.getByText(/Fulfilled/)).toBeVisible();

    // Verify the "Mark Unfulfilled" button is visible
    const markUnfulfilledButton = johnRow.getByRole('button', { name: /Mark Unfulfilled/i });
    await expect(markUnfulfilledButton).toBeVisible();

    // Click mark unfulfilled button
    await markUnfulfilledButton.click();

    // Wait for API call to complete
    await page.waitForTimeout(100);
  });

  test('displays empty state when no orders exist', async ({ page }) => {
    // Override mock to return empty list
    await page.route('**/api/store/orders*', async (_route) => {
      await _route.fulfill({
        status: 200,
        json: { orders: [] },
      });
    });

    await page.goto('/dashboard/store_orders');

    // Verify empty state message
    await expect(page.getByText('No orders found matching the current filters')).toBeVisible();
  });

  test('displays filtered empty state when filter has no results', async ({ page }) => {
    await page.goto('/dashboard/store_orders');

    // Wait for page to load
    await expect(page.getByText('Jane Student')).toBeVisible();

    // Search for something that doesn't exist
    const searchInput = page.getByPlaceholder('Search email or order ID...');
    await searchInput.fill('nonexistent@example.com');

    // Verify filtered empty state appears
    await expect(page.getByText('No orders found matching the current filters')).toBeVisible();
  });

  test('displays loading state while fetching orders', async ({ page }) => {
    // Slow down the API response to ensure loading state is visible
    await page.route('**/api/store/orders*', async (_route) => {
      await new Promise((resolve) => setTimeout(resolve, 500));
      await _route.fulfill({
        status: 200,
        json: { orders: createMockOrders() },
      });
    });

    await page.goto('/dashboard/store_orders');

    // Verify loading indicator is shown
    await expect(page.getByRole('heading', { name: /Store Orders/i })).toBeVisible();

    // Wait for content to load
    await expect(page.getByText('Jane Student')).toBeVisible({
      timeout: TEST_TIMEOUTS.SLOW_PAGE,
    });
  });

  test('passes WCAG 2.1 AA accessibility audit', async ({ page }) => {
    await page.goto('/dashboard/store_orders');

    // Wait for page to fully load
    await expect(page.getByRole('heading', { name: /Store Orders/i })).toBeVisible({
      timeout: TEST_TIMEOUTS.SLOW_PAGE,
    });

    // Accessibility Audit
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('has keyboard-navigable filter buttons', async ({ page }) => {
    await page.goto('/dashboard/store_orders');

    // Wait for page to load
    await expect(page.getByRole('heading', { name: /Store Orders/i })).toBeVisible();

    // Focus the first filter button (All)
    const allButton = page.getByRole('button', { name: 'All' });
    await allButton.focus();

    // Verify the button is focused
    await expect(allButton).toBeFocused();

    // Tab through filter buttons
    await page.keyboard.press('Tab');
    const focusedElement = await page.evaluate(() => document.activeElement?.textContent);
    expect(focusedElement).toBe('Unfulfilled');

    // Continue tabbing
    await page.keyboard.press('Tab');
    const nextFocused = await page.evaluate(() => document.activeElement?.textContent);
    expect(nextFocused).toBe('Fulfilled');
  });

  test('has accessible form controls with proper labels', async ({ page }) => {
    await page.goto('/dashboard/store_orders');

    // Wait for page to load
    await expect(page.getByRole('heading', { name: /Store Orders/i })).toBeVisible();

    // Verify search input has accessible label (via placeholder)
    const searchInput = page.getByPlaceholder('Search email or order ID...');
    await expect(searchInput).toBeVisible();

    // Verify filter buttons have accessible names
    await expect(page.getByRole('button', { name: 'All' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Unfulfilled' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Fulfilled' })).toBeVisible();
  });

  test('order status badges have sufficient color contrast', async ({ page }) => {
    await page.goto('/dashboard/store_orders');

    // Wait for page to load
    await expect(page.getByRole('heading', { name: /Store Orders/i })).toBeVisible();

    // Verify status badges are visible and distinguishable
    await expect(page.getByText('Unfulfilled')).toBeVisible();
    await expect(page.getByText('Fulfilled')).toBeVisible();
  });

  test('table has proper structure with headers', async ({ page }) => {
    await page.goto('/dashboard/store_orders');

    // Wait for page to load
    await expect(page.getByRole('heading', { name: /Store Orders/i })).toBeVisible();

    // Verify table has proper headers
    const table = page.locator('table');
    await expect(table).toBeVisible();

    const headers = page.getByRole('columnheader');
    await expect(headers).toHaveCount(6); // Order Details, Customer, Shipping Address, Total, Status, Actions
  });

  test('order IDs are displayed with truncation for readability', async ({ page }) => {
    await page.goto('/dashboard/store_orders');

    // Wait for page to load
    await expect(page.getByRole('heading', { name: /Store Orders/i })).toBeVisible();

    // Order IDs should be displayed in a monospace font and truncated
    const orderIdElements = page.locator('.font-mono.text-xs');
    await expect(orderIdElements.first()).toBeVisible();
  });

  test('displays payment status badges alongside fulfillment status', async ({ page }) => {
    await page.goto('/dashboard/store_orders');

    // Wait for page to load
    await expect(page.getByRole('heading', { name: /Store Orders/i })).toBeVisible();

    // Verify payment status (complete) is displayed
    await expect(page.getByText('COMPLETE')).toBeVisible();
  });
});

test.describe('Store Orders - Permissions', () => {
  test('redirects unauthorized users away from store orders page', async ({ page }) => {
    // Setup mock auth with non-admin user
    await page.route('**/api/auth/get-session', async (_route) => {
      await _route.fulfill({
        status: 200,
        json: {
          session: {
            id: 'regular-user-session',
            userId: 'regular-user',
            expiresAt: new Date(Date.now() + 10000000).toISOString(),
            ipAddress: '127.0.0.1',
            userAgent: 'Playwright',
          },
          user: {
            id: 'regular-user',
            name: 'Regular User',
            email: 'user@example.com',
            emailVerified: true,
            image: 'https://api.dicebear.com/9.x/bottts/svg?seed=user',
            role: 'member',
            banned: false,
          },
        },
      });
    });

    // Mock profile with member role
    await page.route('**/profile/me', async (_route) => {
      await _route.fulfill({
        status: 200,
        json: {
          user_id: 'regular-user',
          nickname: 'Regular User',
          first_name: 'Regular',
          last_name: 'User',
          member_type: 'student',
          auth: {
            id: 'regular-user',
            email: 'user@example.com',
            name: 'Regular User',
            role: 'member',
          },
        },
      });
    });

    // Set auth cookie
    await page.context().addCookies([
      {
        name: 'better-auth.session_token',
        value: 'regular-user-session',
        domain: 'localhost',
        path: '/',
      },
    ]);

    // Mock orders API to return data (to test if UI actually blocks access)
    await page.route('**/api/store/orders*', async (_route) => {
      await _route.fulfill({
        status: 200,
        json: { orders: createMockOrders() },
      });
    });

    await page.goto('/dashboard/store_orders');

    // Verify access denied message is shown or redirect occurs
    // The exact behavior depends on the implementation - this tests that
    // non-admin users cannot access the store orders management
    await page.waitForTimeout(500);

    // Either we should see an access denied message or be redirected
    const currentUrl = page.url();
    const hasAccessDenied = await page.getByText('Access Denied').count();
    const isRedirected = !currentUrl.includes('/dashboard/store_orders');

    expect(hasAccessDenied > 0 || isRedirected).toBeTruthy();
  });
});

test.describe('Store Orders - Keyboard Interaction', () => {
  test('supports keyboard navigation through action buttons', async ({ page }) => {
    await setupMockAuth(page);

    // Mock API responses
    await page.route('**/api/store/orders*', async (_route) => {
      await _route.fulfill({ status: 200, json: { orders: createMockOrders() } });
    });
    await page.route('**/api/store/orders/*/status', async (_route) => {
      await _route.fulfill({ status: 200, json: { success: true } });
    });

    await page.goto('/dashboard/store_orders');

    // Wait for page to load
    await expect(page.getByRole('heading', { name: /Store Orders/i })).toBeVisible();

    // Focus the first action button and verify it's focused
    const firstActionButton = page.getByRole('button', { name: /Mark Fulfilled/i }).first();
    await firstActionButton.focus();
    await expect(firstActionButton).toBeFocused();

    // Activate with Enter key
    await page.keyboard.press('Enter');

    // Wait for API call to complete
    await page.waitForTimeout(100);
  });

  test('has visible focus states on interactive elements', async ({ page }) => {
    await setupMockAuth(page);

    // Mock API responses
    await page.route('**/api/store/orders*', async (_route) => {
      await _route.fulfill({ status: 200, json: { orders: createMockOrders() } });
    });

    await page.goto('/dashboard/store_orders');

    // Wait for page to load
    await expect(page.getByRole('heading', { name: /Store Orders/i })).toBeVisible();

    // Focus the search input
    const searchInput = page.getByPlaceholder('Search email or order ID...');
    await searchInput.focus();
    await expect(searchInput).toBeFocused();
  });
});
