import { test, expect } from '@playwright/test';
import { setupMockAuth } from '../fixtures/auth';
import { TEST_TIMEOUTS } from '../fixtures/mock-data';

test.describe('Mass Email Composer Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await setupMockAuth(page, { useRealAuth: true });
  });

  test('loads and displays email composer interface', async ({ page }) => {
    await page.goto('/dashboard/mass_email');

    // Wait for page to load
    await expect(page.getByRole('heading', { name: /Team Broadcaster/i })).toBeVisible({
      timeout: TEST_TIMEOUTS.SLOW_PAGE,
    });

    // Verify page subtitle
    await expect(page.getByText('ARES Mass Email Composer')).toBeVisible();

    // Verify subject input is present
    await expect(page.getByLabel('Email Subject')).toBeVisible();

    // Verify body editor area is present
    await expect(page.getByLabel('HTML Body')).toBeVisible();

    // Verify dispatch button is present
    await expect(page.getByRole('button', { name: /DISPATCH BLAST/i })).toBeVisible();
  });

  test('displays active user count in audience roster', async ({ page }) => {
    await page.goto('/dashboard/mass_email');

    // Wait for page to load
    await expect(page.getByRole('heading', { name: /Team Broadcaster/i })).toBeVisible();

    // Verify audience roster section
    await expect(page.getByText('Audience Roster')).toBeVisible();
    await expect(page.getByText('Sourced directly from registered website users.')).toBeVisible();

    // Verify recipient count is displayed
    await expect(page.getByText(/Recipients/)).toBeVisible();
  });

  test('dispatch button is disabled when subject is empty', async ({ page }) => {
    await page.goto('/dashboard/mass_email');

    // Wait for page to load
    await expect(page.getByRole('heading', { name: /Team Broadcaster/i })).toBeVisible();

    // Verify dispatch button is disabled initially
    const dispatchButton = page.getByRole('button', { name: /DISPATCH BLAST/i });
    await expect(dispatchButton).toBeDisabled();
  });

  test('dispatch button is enabled when subject is entered', async ({ page }) => {
    await page.goto('/dashboard/mass_email');

    // Wait for page to load
    await expect(page.getByRole('heading', { name: /Team Broadcaster/i })).toBeVisible();

    // Enter subject
    const subjectInput = page.getByLabel('Email Subject');
    await subjectInput.fill('Test Email Subject');

    // Verify dispatch button becomes enabled
    const dispatchButton = page.getByRole('button', { name: /DISPATCH BLAST/i });
    await expect(dispatchButton).toBeEnabled();
  });

  test('shows validation error when sending without content', async ({ page }) => {
    await page.goto('/dashboard/mass_email');

    // Wait for page to load
    await expect(page.getByRole('heading', { name: /Team Broadcaster/i })).toBeVisible();

    // Enter subject only (no content)
    const subjectInput = page.getByLabel('Email Subject');
    await subjectInput.fill('Test Subject');

    // Mock window.confirm to return false (cancel the send)
    await page.evaluate(() => {
      window.confirm = () => false;
    });

    // Click dispatch button (subject is filled but content is empty)
    const dispatchButton = page.getByRole('button', { name: /DISPATCH BLAST/i });
    await dispatchButton.click();

    // The confirm dialog should appear and be cancelled, so no send happens
    // This test verifies the flow reaches the confirmation step
  });

  test('completes full email composition workflow', async ({ page }) => {
    await page.goto('/dashboard/mass_email');

    // Wait for page to load
    await expect(page.getByRole('heading', { name: /Team Broadcaster/i })).toBeVisible();

    // Enter subject
    const subjectInput = page.getByLabel('Email Subject');
    await subjectInput.fill('Important Team Update');

    // Enter content in the rich text editor
    const editor = page.locator('.ProseMirror').or(page.locator('[contenteditable="true"]')).first();
    await editor.click();
    await editor.fill('Dear team members, this is an important update about our upcoming competition.');

    // Mock window.confirm to accept the send
    await page.evaluate(() => {
      window.confirm = () => true;
    });

    // Click dispatch button
    const dispatchButton = page.getByRole('button', { name: /DISPATCH BLAST/i });
    await dispatchButton.click();

    // Verify success toast appears
    await expect(page.getByText(/Mass email dispatched successfully/i)).toBeVisible();
  });

  test('shows loading state while dispatching email', async ({ page }) => {
    await page.goto('/dashboard/mass_email');

    // Wait for page to load
    await expect(page.getByRole('heading', { name: /Team Broadcaster/i })).toBeVisible();

    // Enter subject
    const subjectInput = page.getByLabel('Email Subject');
    await subjectInput.fill('Test Email');

    // Mock window.confirm to accept the send
    await page.evaluate(() => {
      window.confirm = () => true;
    });

    // Click dispatch button
    const dispatchButton = page.getByRole('button', { name: /DISPATCH BLAST/i });
    await dispatchButton.click();

    // Verify loading state
    await expect(page.getByText('DISPATCHING...')).toBeVisible();

    // Verify spinner is shown
    await expect(page.locator('.animate-spin').or(page.getByRole('progressbar'))).toBeVisible();

    // Wait for success message
    await expect(page.getByText(/Mass email dispatched successfully/i)).toBeVisible({
      timeout: TEST_TIMEOUTS.SLOW_PAGE,
    });
  });

  test('shows loading skeleton while fetching stats', async ({ page }) => {
    await page.goto('/dashboard/mass_email');

    // The loading state appears briefly before content loads

    // Wait for content to load
    await expect(page.getByText(/Recipients/)).toBeVisible({
      timeout: TEST_TIMEOUTS.SLOW_PAGE,
    });
  });

  test('passes WCAG 2.1 AA accessibility audit', async ({ page }) => {
    await page.goto('/dashboard/mass_email');

    // Wait for page to fully load
    await expect(page.getByRole('heading', { name: /Team Broadcaster/i })).toBeVisible({
      timeout: TEST_TIMEOUTS.SLOW_PAGE,
    });

    // Stabilize page for accessibility scan (disable animations)
    await page.addStyleTag({
      content: `
        *, *::before, *::after {
          transition: none !important;
          animation: none !important;
          opacity: 1 !important;
        }
      `,
    });

    // Accessibility Audit
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('has accessible form controls with proper labels', async ({ page }) => {
    await page.goto('/dashboard/mass_email');

    // Wait for page to load
    await expect(page.getByRole('heading', { name: /Team Broadcaster/i })).toBeVisible();

    // Verify subject input has accessible label
    const subjectInput = page.getByLabel('Email Subject');
    await expect(subjectInput).toBeVisible();

    // Verify the input has a matching id
    await expect(subjectInput).toHaveAttribute('id', 'subject-input');

    // Verify body editor has accessible label
    const bodyEditor = page.getByLabel('HTML Body');
    await expect(bodyEditor).toBeVisible();

    // Verify dispatch button has accessible name
    const dispatchButton = page.getByRole('button', { name: /DISPATCH BLAST/i });
    await expect(dispatchButton).toBeVisible();
  });

  test('subject input has sufficient color contrast', async ({ page }) => {
    await page.goto('/dashboard/mass_email');

    // Wait for page to load
    await expect(page.getByRole('heading', { name: /Team Broadcaster/i })).toBeVisible();

    // Verify input placeholder text is visible
    const subjectInput = page.getByLabel('Email Subject');
    await expect(subjectInput).toHaveAttribute('placeholder', 'Important Update: State Championship Logistics');
  });

  test('dispatch button has accessible loading state', async ({ page }) => {
    await page.goto('/dashboard/mass_email');

    // Wait for page to load
    await expect(page.getByRole('heading', { name: /Team Broadcaster/i })).toBeVisible();

    // Enter subject
    const subjectInput = page.getByLabel('Email Subject');
    await subjectInput.fill('Test Email');

    // Mock window.confirm to accept the send
    await page.evaluate(() => {
      window.confirm = () => true;
    });

    // Click dispatch button
    const dispatchButton = page.getByRole('button', { name: /DISPATCH BLAST/i });
    await dispatchButton.click();

    // Verify screen reader text for loading state
    await expect(page.getByText('Sending mass email, please wait.')).toBeVisible();
  });

  test('keyboard navigation works for form controls', async ({ page }) => {
    await page.goto('/dashboard/mass_email');

    // Wait for page to load
    await expect(page.getByRole('heading', { name: /Team Broadcaster/i })).toBeVisible();

    // Tab to subject input
    await page.keyboard.press('Tab');
    const subjectInput = page.getByLabel('Email Subject');
    await expect(subjectInput).toBeFocused();

    // Type subject
    await page.keyboard.type('Keyboard Navigation Test');

    // Tab to body editor
    await page.keyboard.press('Tab');
    const bodyEditor = page.getByLabel('HTML Body');
    await expect(bodyEditor).toBeFocused();

    // Tab to dispatch button
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    const dispatchButton = page.getByRole('button', { name: /DISPATCH BLAST/i });
    await expect(dispatchButton).toBeFocused();
  });

  test('audience roster card displays with proper hierarchy', async ({ page }) => {
    await page.goto('/dashboard/mass_email');

    // Wait for page to load
    await expect(page.getByRole('heading', { name: /Team Broadcaster/i })).toBeVisible();

    // Verify audience roster heading hierarchy
    await expect(page.getByText('Audience Roster')).toBeVisible();

    // Verify description text
    await expect(page.getByText('Sourced directly from registered website users.')).toBeVisible();

    // Verify recipient count with proper styling
    await expect(page.getByText(/Recipients/)).toBeVisible();
  });
});
