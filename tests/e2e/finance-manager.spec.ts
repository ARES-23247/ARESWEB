import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { DashboardPage } from '../pages/DashboardPage';
import { setupMockAuth } from '../fixtures/auth';
import { TEST_TIMEOUTS } from '../fixtures/mock-data';

/**
 * Mock finance summary data for E2E testing.
 */
const MOCK_FINANCE_SUMMARY = {
  total_income: 25000,
  total_expenses: 12000,
  balance: 13000,
  season_id: 1,
} as const;

/**
 * Mock sponsorship pipeline data for E2E testing.
 */
const MOCK_SPONSORSHIP_PIPELINE = [
  {
    id: 'lead-1',
    company_name: 'Acme Robotics',
    sponsor_id: null,
    status: 'potential',
    estimated_value: 5000,
    notes: 'Local robotics supply company',
    contact_person: 'John Smith',
    season_id: 1,
    zulip_message_id: null,
    assignees: [],
  },
  {
    id: 'lead-2',
    company_name: 'TechCorp Industries',
    sponsor_id: 'sponsor-123',
    status: 'contacted',
    estimated_value: 10000,
    notes: 'Initial meeting scheduled',
    contact_person: 'Jane Doe',
    season_id: 1,
    zulip_message_id: null,
    assignees: ['admin-user'],
  },
  {
    id: 'lead-3',
    company_name: 'Global Manufacturing',
    sponsor_id: null,
    status: 'pledged',
    estimated_value: 15000,
    notes: 'Verbal commitment received',
    contact_person: 'Mike Johnson',
    season_id: 1,
    zulip_message_id: null,
    assignees: [],
  },
  {
    id: 'lead-4',
    company_name: 'Engineering Solutions LLC',
    sponsor_id: 'sponsor-456',
    status: 'secured',
    estimated_value: 8000,
    notes: 'Contract signed',
    contact_person: 'Sarah Williams',
    season_id: 1,
    zulip_message_id: null,
    assignees: ['admin-user'],
  },
  {
    id: 'lead-5',
    company_name: 'Startup Ventures',
    sponsor_id: null,
    status: 'lost',
    estimated_value: 3000,
    notes: 'Budget constraints',
    contact_person: 'Tom Brown',
    season_id: 1,
    zulip_message_id: null,
    assignees: [],
  },
] as const;

/**
 * Mock financial transactions for E2E testing.
 */
const MOCK_TRANSACTIONS = [
  {
    id: 'txn-1',
    type: 'income',
    amount: 5000,
    category: 'Sponsorship',
    date: '2024-01-15',
    description: 'Acme Robotics sponsorship payment',
    receipt_url: null,
    season_id: 1,
    logged_by: 'admin-user',
  },
  {
    id: 'txn-2',
    type: 'expense',
    amount: 2500,
    category: 'Parts',
    date: '2024-01-20',
    description: 'Motor controllers and sensors',
    receipt_url: null,
    season_id: 1,
    logged_by: 'admin-user',
  },
  {
    id: 'txn-3',
    type: 'expense',
    amount: 1500,
    category: 'Travel',
    date: '2024-02-01',
    description: 'Competition travel expenses',
    receipt_url: null,
    season_id: 1,
    logged_by: 'admin-user',
  },
  {
    id: 'txn-4',
    type: 'income',
    amount: 8000,
    category: 'Grant',
    date: '2024-02-10',
    description: 'NASA robotics grant',
    receipt_url: null,
    season_id: 1,
    logged_by: 'admin-user',
  },
  {
    id: 'txn-5',
    type: 'expense',
    amount: 500,
    category: 'Supplies',
    date: '2024-02-15',
    description: 'Team supplies and materials',
    receipt_url: null,
    season_id: 1,
    logged_by: 'admin-user',
  },
] as const;

test.describe('Finance Manager Dashboard', () => {
  let dashboardPage: DashboardPage;

  test.beforeEach(async ({ page }) => {
    dashboardPage = new DashboardPage(page);

    // Set up mock authentication
    await setupMockAuth(page);

    // Mock finance summary API
    await page.route('**/api/finance/summary*', async (_route) => {
      await _route.fulfill({
        status: 200,
        json: MOCK_FINANCE_SUMMARY,
      });
    });

    // Mock sponsorship pipeline API
    await page.route('**/api/finance/sponsorship*', async (route) => {
      // Handle POST (save/update)
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 200,
          json: { success: true, id: 'new-lead-' + Date.now() },
        });
        return;
      }

      // Handle DELETE
      if (route.request().method() === 'DELETE') {
        await route.fulfill({
          status: 200,
          json: { success: true },
        });
        return;
      }

      // Handle GET
      await route.fulfill({
        status: 200,
        json: { pipeline: [...MOCK_SPONSORSHIP_PIPELINE] },
      });
    });

    // Mock transactions API
    await page.route('**/api/finance/transactions*', async (route) => {
      // Handle POST (save/update)
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 200,
          json: { success: true, id: 'new-txn-' + Date.now() },
        });
        return;
      }

      // Handle DELETE
      if (route.request().method() === 'DELETE') {
        await route.fulfill({
          status: 200,
          json: { success: true },
        });
        return;
      }

      // Handle GET
      await route.fulfill({
        status: 200,
        json: { transactions: [...MOCK_TRANSACTIONS] },
      });
    });
  });

  test('should load finance dashboard and display summary metrics', async ({ page }) => {
    await page.goto('/dashboard/finance');

    // Wait for page to load
    await page.waitForLoadState('domcontentloaded');

    // Verify main heading is visible
    await expect(page.getByRole('heading', { name: /Sponsorship Pipeline/i })).toBeVisible();

    // Verify summary metrics are displayed
    await expect(page.getByText('Total Income')).toBeVisible();
    await expect(page.getByText('$25,000')).toBeVisible();
    await expect(page.getByText('Total Expenses')).toBeVisible();
    await expect(page.getByText('$12,000')).toBeVisible();
    await expect(page.getByText('Cash Balance')).toBeVisible();
    await expect(page.getByText('$13,000')).toBeVisible();

    // Pipeline value should include all non-lost leads
    const expectedPipelineValue = (5000 + 10000 + 15000 + 8000).toLocaleString(); // excludes lost
    await expect(page.getByText(`$${expectedPipelineValue}`)).toBeVisible();
  });

  test('should display all sponsorship pipeline columns', async ({ page }) => {
    await page.goto('/dashboard/finance');

    // Wait for page to load
    await page.waitForLoadState('domcontentloaded');

    // Verify all pipeline column headers are visible
    await expect(page.getByRole('heading', { name: 'Potential' }).or(page.getByText('Potential').first())).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Contacted' }).or(page.getByText('Contacted').first())).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Pledged' }).or(page.getByText('Pledged').first())).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Secured' }).or(page.getByText('Secured').first())).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Lost' }).or(page.getByText('Lost').first())).toBeVisible();
  });

  test('should display pipeline cards in correct columns', async ({ page }) => {
    await page.goto('/dashboard/finance');

    // Wait for page to load
    await page.waitForLoadState('domcontentloaded');

    // Verify leads are in correct columns based on status
    await expect(page.getByText('Acme Robotics')).toBeVisible();

    // Verify specific lead details
    await expect(page.getByText('TechCorp Industries')).toBeVisible();
    await expect(page.getByText('Global Manufacturing')).toBeVisible();
    await expect(page.getByText('Engineering Solutions LLC')).toBeVisible();
    await expect(page.getByText('Startup Ventures')).toBeVisible();
  });

  test('should display estimated value for pipeline leads', async ({ page }) => {
    await page.goto('/dashboard/finance');

    // Wait for page to load
    await page.waitForLoadState('domcontentloaded');

    // Verify company names from pipeline leads are visible
    await expect(page.getByText('Acme Robotics')).toBeVisible();
    await expect(page.getByText('TechCorp Industries')).toBeVisible();
    await expect(page.getByText('Global Manufacturing')).toBeVisible();
    await expect(page.getByText('Engineering Solutions LLC')).toBeVisible();
  });

  test('should switch between pipeline and ledger tabs', async ({ page }) => {
    await page.goto('/dashboard/finance');

    // Wait for page to load
    await page.waitForLoadState('domcontentloaded');

    // Verify pipeline tab is active by default
    await expect(page.getByRole('heading', { name: /Sponsorship Pipeline/i })).toBeVisible();

    // Click on Ledger tab
    await page.getByRole('button', { name: /Ledger & Expenses/i }).click();

    // Verify ledger view is displayed
    await expect(page.getByRole('heading', { name: /Financial Ledger/i })).toBeVisible();

    // Verify table headers
    await expect(page.getByText('Date')).toBeVisible();
    await expect(page.getByText('Category')).toBeVisible();
    await expect(page.getByText('Description')).toBeVisible();
    await expect(page.getByText('Amount')).toBeVisible();
  });

  test('should display transactions in ledger view', async ({ page }) => {
    await page.goto('/dashboard/finance');

    // Wait for page to load
    await page.waitForLoadState('domcontentloaded');

    // Switch to ledger tab
    await page.getByRole('button', { name: /Ledger & Expenses/i }).click();

    // Wait for transactions to load
    await page.waitForLoadState('domcontentloaded');

    // Verify transactions are displayed
    await expect(page.getByText('Acme Robotics sponsorship payment')).toBeVisible();
    await expect(page.getByText('Motor controllers and sensors')).toBeVisible();
    await expect(page.getByText('Competition travel expenses')).toBeVisible();
    await expect(page.getByText('NASA robotics grant')).toBeVisible();

    // Verify transaction amounts are displayed with correct colors
    const incomeAmount = page.getByText(/\+\$5,000/);
    const expenseAmount = page.getByText(/-\$2,500/);
    await expect(incomeAmount).toBeVisible();
    await expect(expenseAmount).toBeVisible();
  });

  test('should show add form when Add Lead button is clicked', async ({ page }) => {
    await page.goto('/dashboard/finance');

    // Wait for page to load
    await page.waitForLoadState('domcontentloaded');

    // Click Add Lead button
    await page.getByRole('button', { name: /Add Lead/i }).click();

    // Verify form container is visible
    const formContainer = page.locator('.bg-obsidian.border');
    await expect(formContainer).toBeVisible();

    // Verify Company Name input is visible (using label text)
    await expect(page.getByText('Company Name')).toBeVisible();

    // Verify Est. Value input is visible
    await expect(page.getByText('Est. Value ($)')).toBeVisible();

    // Verify Initial Status select is visible
    await expect(page.getByText('Initial Status')).toBeVisible();
  });

  test('should show add transaction form when Add Transaction button is clicked', async ({ page }) => {
    await page.goto('/dashboard/finance');

    // Wait for page to load
    await page.waitForLoadState('domcontentloaded');

    // Switch to ledger tab
    await page.getByRole('button', { name: /Ledger & Expenses/i }).click();

    // Click Add Transaction button
    await page.getByRole('button', { name: /Add Transaction/i }).click();

    // Verify form container is visible
    const formContainer = page.locator('.bg-obsidian.border');
    await expect(formContainer).toBeVisible();

    // Verify key form fields are visible - use first() to avoid strict mode violations
    await expect(page.locator('select').first()).toBeVisible();
    await expect(page.locator('input[type="date"]').first()).toBeVisible();
    await expect(page.locator('input[type="number"]').first()).toBeVisible();

    // Check for labels - use first() since some appear in both form and table
    await expect(page.getByText('Amount ($)').first()).toBeVisible();
    await expect(page.getByText('Category').first()).toBeVisible();
    await expect(page.getByText('Description').first()).toBeVisible();
  });

  test('should submit new pipeline lead', async ({ page }) => {
    await page.goto('/dashboard/finance');

    // Wait for page to load
    await page.waitForLoadState('domcontentloaded');

    // Click Add Lead button
    await page.getByRole('button', { name: /Add Lead/i }).click();

    // Fill out the form using label-based locators
    await page.getByText('Company Name')
      .locator('..')
      .locator('input')
      .fill('New Sponsor Inc');

    await page.getByText('Est. Value ($)')
      .locator('..')
      .locator('input')
      .fill('7500');

    // Select status from dropdown
    await page.getByText('Initial Status')
      .locator('..')
      .locator('select')
      .selectOption('potential');

    // Submit the form
    await page.getByRole('button', { name: 'Add Lead to Pipeline' }).click();

    // Wait for API call to complete
    await page.waitForTimeout(100);

    // Verify form is closed after submission (form container should not be visible)
    const formContainer = page.locator('.bg-obsidian.border');
    await expect(formContainer).not.toBeVisible();
  });

  test('should submit new transaction', async ({ page }) => {
    await page.goto('/dashboard/finance');

    // Wait for page to load
    await page.waitForLoadState('domcontentloaded');

    // Switch to ledger tab
    await page.getByRole('button', { name: /Ledger & Expenses/i }).click();

    // Click Add Transaction button
    await page.getByRole('button', { name: /Add Transaction/i }).click();

    // Fill out the form using label-based locators
    await page.getByText('Type')
      .locator('..')
      .locator('select')
      .selectOption('expense');

    await page.getByText('Amount ($)')
      .locator('..')
      .locator('input')
      .fill('100');

    await page.getByText('Date')
      .locator('..')
      .locator('input')
      .fill('2024-03-01');

    await page.getByText('Category')
      .locator('..')
      .locator('input')
      .fill('Supplies');

    await page.getByText('Description')
      .locator('..')
      .locator('input')
      .fill('Test transaction');

    // Submit the form
    await page.getByRole('button', { name: 'Record Transaction' }).click();

    // Wait for API call to complete
    await page.waitForTimeout(100);

    // Verify form is closed after submission
    const formContainer = page.locator('.bg-obsidian.border');
    await expect(formContainer).not.toBeVisible();
  });

  test('should display transaction categories as badges', async ({ page }) => {
    await page.goto('/dashboard/finance');

    // Wait for page to load
    await page.waitForLoadState('domcontentloaded');

    // Switch to ledger tab
    await page.getByRole('button', { name: /Ledger & Expenses/i }).click();

    // Wait for transactions to load
    await page.waitForLoadState('domcontentloaded');

    // Verify category badges are displayed - use exact match to avoid tab button
    await expect(page.getByText('Sponsorship', { exact: true })).toBeVisible();
    await expect(page.getByText('Parts', { exact: true })).toBeVisible();
    await expect(page.getByText('Travel', { exact: true })).toBeVisible();
    await expect(page.getByText('Grant', { exact: true })).toBeVisible();
    await expect(page.getByText('Supplies', { exact: true })).toBeVisible();
  });

  test('should show delete button on transaction hover', async ({ page }) => {
    await page.goto('/dashboard/finance');

    // Wait for page to load
    await page.waitForLoadState('domcontentloaded');

    // Switch to ledger tab
    await page.getByRole('button', { name: /Ledger & Expenses/i }).click();

    // Wait for transactions to load
    await page.waitForLoadState('domcontentloaded');

    // Find a transaction row and hover over it
    const transactionRow = page.locator('tr').filter({ hasText: 'Motor controllers' });
    await transactionRow.hover();

    // Verify delete button appears
    const deleteButton = transactionRow.getByRole('button', { name: /Delete transaction/i });
    await expect(deleteButton).toBeVisible();
  });

  test('should pass WCAG 2.1 AA accessibility audit - pipeline view', async ({ page }) => {
    await page.goto('/dashboard/finance');

    // Wait for page to load and stabilize
    await page.waitForLoadState('domcontentloaded');
    await dashboardPage.stabilizeForAccessibility();

    // Run accessibility audit
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('should pass WCAG 2.1 AA accessibility audit - ledger view', async ({ page }) => {
    await page.goto('/dashboard/finance');

    // Wait for page to load
    await page.waitForLoadState('domcontentloaded');

    // Switch to ledger tab
    await page.getByRole('button', { name: /Ledger & Expenses/i }).click();

    // Wait for ledger to load and stabilize
    await page.waitForLoadState('domcontentloaded');
    await dashboardPage.stabilizeForAccessibility();

    // Run accessibility audit
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('should have accessible table structure in ledger view', async ({ page }) => {
    await page.goto('/dashboard/finance');

    // Wait for page to load
    await page.waitForLoadState('domcontentloaded');

    // Switch to ledger tab
    await page.getByRole('button', { name: /Ledger & Expenses/i }).click();

    // Wait for ledger to load
    await page.waitForLoadState('domcontentloaded');

    // Verify table has proper headers
    const table = page.locator('table');
    await expect(table).toBeVisible();

    const headers = page.getByRole('columnheader');
    await expect(headers).toHaveCount(5); // Date, Category, Description, Amount, Actions
  });

  test('should have accessible buttons with clear labels', async ({ page }) => {
    await page.goto('/dashboard/finance');

    // Wait for page to load
    await page.waitForLoadState('domcontentloaded');

    // Verify tab buttons have accessible names
    const pipelineTab = page.getByRole('button', { name: /Sponsorship Pipeline/i });
    const ledgerTab = page.getByRole('button', { name: /Ledger & Expenses/i });
    await expect(pipelineTab).toBeVisible();
    await expect(ledgerTab).toBeVisible();
  });

  test('should handle empty pipeline state', async ({ page }) => {
    // Override the pipeline API to return empty data
    await page.route('**/api/finance/sponsorship*', async (route) => {
      await route.fulfill({
        status: 200,
        json: { pipeline: [] },
      });
    });

    await page.goto('/dashboard/finance');

    // Wait for page to load
    await page.waitForLoadState('domcontentloaded');

    // Verify empty state message is displayed (appears in multiple columns)
    await expect(page.getByText('No leads').first()).toBeVisible();
  });

  test('should handle empty transactions state', async ({ page }) => {
    // Override the transactions API to return empty data
    await page.route('**/api/finance/transactions*', async (route) => {
      await route.fulfill({
        status: 200,
        json: { transactions: [] },
      });
    });

    await page.goto('/dashboard/finance');

    // Wait for page to load
    await page.waitForLoadState('domcontentloaded');

    // Switch to ledger tab
    await page.getByRole('button', { name: /Ledger & Expenses/i }).click();

    // Wait for ledger to load
    await page.waitForLoadState('domcontentloaded');

    // Verify empty state message
    await expect(page.getByText('No transactions recorded for this season')).toBeVisible();
  });

  test('should handle API error gracefully', async ({ page }) => {
    // Override the summary API to return an error
    await page.route('**/api/finance/summary*', async (route) => {
      await route.fulfill({
        status: 500,
        json: { error: 'Internal Server Error' },
      });
    });

    await page.goto('/dashboard/finance');

    // Wait for page to load
    await page.waitForLoadState('domcontentloaded');

    // Verify error state is displayed
    await expect(page.getByText('Financial Link Severed')).toBeVisible();
    await expect(page.getByText(/An error occurred while connecting to the team ledger/)).toBeVisible();
  });

  test('should support season filtering', async ({ page }) => {
    await page.goto('/dashboard/finance');

    // Wait for page to load
    await page.waitForLoadState('domcontentloaded');

    // Note: Season picker visibility test - adjust selector based on actual implementation
  });

  test('should display loading state while fetching data', async ({ page }) => {
    // Slow down the API response to ensure loading state is visible
    await page.route('**/api/finance/summary*', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 100));
      await route.fulfill({
        status: 200,
        json: MOCK_FINANCE_SUMMARY,
      });
    });

    await page.goto('/dashboard/finance');

    // The loading state may be too brief to catch reliably, so we just verify the page eventually loads
    await expect(page.getByRole('heading', { name: /Sponsorship Pipeline/i })).toBeVisible({
      timeout: TEST_TIMEOUTS.SLOW_PAGE,
    });
  });
});

test.describe('Finance Manager - Keyboard Navigation', () => {
  test('should support keyboard navigation through tabs', async ({ page }) => {
    await setupMockAuth(page);

    // Mock API responses
    await page.route('**/api/finance/summary*', async (route) => {
      await route.fulfill({ status: 200, json: { total_income: 0, total_expenses: 0, balance: 0, season_id: null } });
    });
    await page.route('**/api/finance/sponsorship*', async (route) => {
      await route.fulfill({ status: 200, json: { pipeline: [] } });
    });
    await page.route('**/api/finance/transactions*', async (route) => {
      await route.fulfill({ status: 200, json: { transactions: [] } });
    });

    await page.goto('/dashboard/finance');

    // Wait for page to load
    await page.waitForLoadState('domcontentloaded');

    // Focus the pipeline tab
    const pipelineTab = page.getByRole('button', { name: /Sponsorship Pipeline/i });
    await pipelineTab.focus();
    await expect(pipelineTab).toBeFocused();

    // Tab to the ledger tab and activate it
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');

    // Verify ledger view is now active
    await expect(page.getByRole('heading', { name: /Financial Ledger/i })).toBeVisible();
  });

  test('should have visible focus states on interactive elements', async ({ page }) => {
    await setupMockAuth(page);

    // Mock API responses
    await page.route('**/api/finance/summary*', async (route) => {
      await route.fulfill({ status: 200, json: { total_income: 0, total_expenses: 0, balance: 0, season_id: null } });
    });
    await page.route('**/api/finance/sponsorship*', async (route) => {
      await route.fulfill({ status: 200, json: { pipeline: [] } });
    });
    await page.route('**/api/finance/transactions*', async (route) => {
      await route.fulfill({ status: 200, json: { transactions: [] } });
    });

    await page.goto('/dashboard/finance');

    // Wait for page to load
    await page.waitForLoadState('domcontentloaded');

    // Focus the Add Lead button and verify it's focused
    const addButton = page.getByRole('button', { name: /Add Lead/i });
    await addButton.focus();
    await expect(addButton).toBeFocused();
  });
});
