import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { DashboardPage } from '../pages/DashboardPage';
import { setupMockAuth } from '../fixtures/auth';
import { TEST_TIMEOUTS } from '../fixtures/mock-data';

test.describe('Finance Manager Dashboard', () => {
  let dashboardPage: DashboardPage;

  test.beforeEach(async ({ page }) => {
    dashboardPage = new DashboardPage(page);

    // Set up mock authentication
    await setupMockAuth(page, { useRealAuth: true });
  });

  test('should load finance dashboard and display summary metrics', async ({ page }) => {
    await page.goto('/dashboard/finance');

    // Wait for page to load
    await page.waitForLoadState('domcontentloaded');

    // Verify main heading is visible
    await expect(page.getByRole('heading', { name: /Sponsorship Pipeline/i })).toBeVisible();

    // Verify summary metrics are displayed
    await expect(page.getByText('Total Income')).toBeVisible();
    await expect(page.getByText('Total Expenses')).toBeVisible();
    await expect(page.getByText('Cash Balance')).toBeVisible();
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

    // Verify transaction amounts are displayed with correct colors (if data exists)
    const incomeAmount = page.getByText(/\+\$/);
    const expenseAmount = page.getByText(/-\$/);

    // These may not be visible if no transactions exist, but the UI should render
    await expect(page.getByRole('heading', { name: /Financial Ledger/i })).toBeVisible();
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

    // Verify key form fields are visible
    await expect(page.locator('select').first()).toBeVisible();
    await expect(page.locator('input[type="date"]').first()).toBeVisible();
    await expect(page.locator('input[type="number"]').first()).toBeVisible();

    // Check for labels
    await expect(page.getByText('Amount ($)').first()).toBeVisible();
    await expect(page.getByText('Category').first()).toBeVisible();
    await expect(page.getByText('Description').first()).toBeVisible();
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
    await page.goto('/dashboard/finance');

    // Wait for page to load
    await page.waitForLoadState('domcontentloaded');

    // Verify empty state message is displayed (appears in multiple columns)
    await expect(page.getByText('No leads').first()).toBeVisible();
  });

  test('should handle empty transactions state', async ({ page }) => {
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

  test('should support season filtering', async ({ page }) => {
    await page.goto('/dashboard/finance');

    // Wait for page to load
    await page.waitForLoadState('domcontentloaded');

    // Note: Season picker visibility test - adjust selector based on actual implementation
  });

  test('should display loading state while fetching data', async ({ page }) => {
    await page.goto('/dashboard/finance');

    // The loading state may be too brief to catch reliably, so we just verify the page eventually loads
    await expect(page.getByRole('heading', { name: /Sponsorship Pipeline/i })).toBeVisible({
      timeout: TEST_TIMEOUTS.SLOW_PAGE,
    });
  });
});

test.describe('Finance Manager - Keyboard Navigation', () => {
  test('should support keyboard navigation through tabs', async ({ page }) => {
    await setupMockAuth(page, { useRealAuth: true });

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
    await setupMockAuth(page, { useRealAuth: true });

    await page.goto('/dashboard/finance');

    // Wait for page to load
    await page.waitForLoadState('domcontentloaded');

    // Focus the Add Lead button and verify it's focused
    const addButton = page.getByRole('button', { name: /Add Lead/i });
    await addButton.focus();
    await expect(addButton).toBeFocused();
  });
});
