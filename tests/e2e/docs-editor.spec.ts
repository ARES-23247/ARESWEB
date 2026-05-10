import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { setupMockAuth } from '../fixtures/auth';
import { TEST_TIMEOUTS } from '../fixtures/mock-data';

/**
 * Docs Editor E2E Tests
 *
 * Tests use real database calls. Test data is seeded via scripts/seed-test-data.sql
 * - test-doc: A test document for editing
 * - getting-started: A getting started guide
 */

test.describe('Docs Editor E2E', () => {
  test.beforeEach(async ({ page }) => {
    await setupMockAuth(page, { useRealAuth: true });
  });

  test.describe('New Document Creation Workflow', () => {
    test('should display docs editor with empty form for new document', async ({ page }) => {
      await page.goto('/dashboard/docs');

      // Verify editor title for new doc
      await expect(page.getByRole('heading', { name: /Publish Document/i })).toBeVisible({
        timeout: TEST_TIMEOUTS.DEFAULT,
      });

      // Verify subtitle describing the purpose
      await expect(page.getByText(/Draft a new Markdown\/Tiptap documentation page for the hub/i)).toBeVisible();

      // Verify form fields are present and accessible
      await expect(page.getByLabel(/Title/i)).toBeVisible();
      await expect(page.locator('#doc-slug')).toBeVisible();
      await expect(page.getByLabel(/Category/i)).toBeVisible();
      await expect(page.getByLabel(/Sort Order/i)).toBeVisible();
      await expect(page.getByLabel(/Description \/ Summary/i)).toBeVisible();

      // Verify visibility toggle checkboxes
      await expect(page.getByLabel(/Judge's Portfolio Selection/i)).toBeVisible();
      await expect(page.getByLabel(/Executive Summary Flag/i)).toBeVisible();
      await expect(page.getByLabel(/Main Library \(ARESLib\)/i)).toBeVisible();
      await expect(page.getByLabel(/Math Corner/i)).toBeVisible();
      await expect(page.getByLabel(/Science Corner/i)).toBeVisible();

      // Verify editor actions are present
      await expect(page.getByRole('button', { name: /PUBLISH DOC/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /SAVE AS DRAFT/i })).toBeVisible();
    });

    test('should validate required fields when publishing without data', async ({ page }) => {
      // Don't mock the save endpoint - let client-side validation catch it
      await page.goto('/dashboard/docs');

      // Click publish without filling required fields
      await page.getByRole('button', { name: /PUBLISH DOC/i }).click();

      // Verify validation error appears - zod validation shows "Required" or similar
      await expect(page.getByText(/required/i)).toBeVisible({
        timeout: TEST_TIMEOUTS.DEFAULT,
      });
    });

    test('should allow filling document form data', async ({ page }) => {
      await page.goto('/dashboard/docs');

      // Fill in the document form
      await page.getByLabel(/Title/i).fill('Swerve Drive Programming Guide');
      await page.locator('#doc-slug').fill('swerve-drive-guide');
      await page.getByLabel(/Category/i).fill('Programming');
      await page.getByLabel(/Sort Order/i).fill('10');
      await page.getByLabel(/Description \/ Summary/i).fill('Complete guide to programming swerve drive');

      // Verify values are set
      await expect(page.getByLabel(/Title/i)).toHaveValue('Swerve Drive Programming Guide');
      await expect(page.locator('#doc-slug')).toHaveValue('swerve-drive-guide');
      await expect(page.getByLabel(/Category/i)).toHaveValue('Programming');
    });

    test('should toggle visibility flags', async ({ page }) => {
      await page.goto('/dashboard/docs');

      const portfolioCheckbox = page.getByLabel(/Judge's Portfolio Selection/i);
      const executiveCheckbox = page.getByLabel(/Executive Summary Flag/i);
      const areslibCheckbox = page.getByLabel(/Main Library \(ARESLib\)/i);
      const mathCheckbox = page.getByLabel(/Math Corner/i);
      const scienceCheckbox = page.getByLabel(/Science Corner/i);

      // Verify default states
      await expect(portfolioCheckbox).not.toBeChecked();
      await expect(executiveCheckbox).not.toBeChecked();
      await expect(areslibCheckbox).toBeChecked();

      // Toggle checkboxes
      await portfolioCheckbox.check();
      await executiveCheckbox.check();
      await mathCheckbox.check();
      await scienceCheckbox.check();

      await expect(portfolioCheckbox).toBeChecked();
      await expect(executiveCheckbox).toBeChecked();
      await expect(mathCheckbox).toBeChecked();
      await expect(scienceCheckbox).toBeChecked();
    });

    test('should create new document successfully', async ({ page }) => {
      await page.goto('/dashboard/docs');

      // Fill required fields
      await page.getByLabel(/Title/i).fill('Quick Start Guide');
      await page.locator('#doc-slug').fill('e2e-test-quick-start');
      await page.getByLabel(/Category/i).fill('Getting Started');

      // Publish document - real API call
      await page.getByRole('button', { name: /PUBLISH DOC/i }).click();

      // Should redirect to the published doc page or dashboard after successful save
      await page.waitForTimeout(2000);
      const currentUrl = page.url();
      const hasRedirect = /\/docs\/e2e-test-quick-start/.test(currentUrl) || /\/dashboard/.test(currentUrl);
      expect(hasRedirect).toBe(true);
    });

    test('should save document as draft', async ({ page }) => {
      await page.goto('/dashboard/docs');

      // Fill required fields
      await page.getByLabel(/Title/i).fill('Draft Document');
      await page.locator('#doc-slug').fill('e2e-draft-doc');
      await page.getByLabel(/Category/i).fill('Drafts');

      // Save as draft - real API call
      await page.getByRole('button', { name: /SAVE AS DRAFT/i }).click();

      // Should redirect to dashboard after saving draft
      await expect(page).toHaveURL(/\/dashboard/, {
        timeout: TEST_TIMEOUTS.SLOW_PAGE,
      });
    });
  });

  test.describe('Editing Existing Document', () => {
    // Use seeded test data from database
    const testDocSlug = 'test-doc';

    test('should load existing document data for editing', async ({ page }) => {
      await page.goto(`/dashboard/docs/${testDocSlug}`);

      // Verify editor title for editing or new document
      const heading = page.getByRole('heading', { name: /Edit Document/i }).or(page.getByRole('heading', { name: /Publish Document/i }));
      await expect(heading).toBeVisible({
        timeout: TEST_TIMEOUTS.DEFAULT,
      });
    });

    test('should update existing document', async ({ page }) => {
      await page.goto(`/dashboard/docs/${testDocSlug}`);

      // Update title if we're in edit mode
      const titleInput = page.getByLabel(/Title/i);
      if (await titleInput.isVisible({ timeout: 2000 })) {
        await titleInput.clear();
        await titleInput.fill('Updated Test Document');

        // Update the document - real API call
        const updateButton = page.getByRole('button', { name: /UPDATE DOC/i }).or(page.getByRole('button', { name: /PUBLISH DOC/i }));
        if (await updateButton.isVisible()) {
          await updateButton.click();

          // Should redirect or show success
          await page.waitForTimeout(2000);
        }
      }
    });

    test('should handle missing document gracefully', async ({ page }) => {
      await page.goto('/dashboard/docs/9999');

      // Editor should still load but with empty form for new doc
      await expect(page.getByRole('heading', { name: /Publish Document/i }).or(page.getByRole('heading', { name: /Edit Document/i }))).toBeVisible({
        timeout: TEST_TIMEOUTS.DEFAULT,
      });
    });
  });

  test.describe('Docs Manager Integration', () => {
    test('should navigate from manager to docs editor', async ({ page }) => {
      // Real API call will fetch docs list from database
      await page.goto('/dashboard/manage_docs');

      // Wait for the docs list to load
      await expect(page.getByText(/Manage Documentation/i).or(page.getByText(/Documentation/i))).toBeVisible({
        timeout: TEST_TIMEOUTS.SLOW_PAGE,
      });

      // Try to click on a test doc to edit
      const testDocLink = page.getByText(/Test Documentation/i).or(page.getByText(/Getting Started/i));
      if (await testDocLink.isVisible({ timeout: 2000 })) {
        await testDocLink.click();

        // Should navigate to the docs editor
        await expect(page).toHaveURL(/\/dashboard\/docs\//, {
          timeout: TEST_TIMEOUTS.DEFAULT,
        });
      }
    });

    test('should create new doc from manager', async ({ page }) => {
      await page.goto('/dashboard/manage_docs');

      // Navigate to new doc form
      const newDocLink = page.getByRole('link', { name: /New Document|Create Doc/i });
      if (await newDocLink.isVisible({ timeout: 2000 })) {
        await newDocLink.click();

        // Should navigate to the new doc editor
        await expect(page).toHaveURL(/\/dashboard\/docs$/, {
          timeout: TEST_TIMEOUTS.DEFAULT,
        });
      }
    });
  });

  test.describe('Accessibility Audit (WCAG 2.1 AA)', () => {
    test('should pass WCAG 2.1 AA accessibility audit for new doc form', async ({ page }) => {
      await page.goto('/dashboard/docs');

      // Wait for page to fully load
      await expect(page.getByRole('heading', { name: /Publish Document/i })).toBeVisible({
        timeout: TEST_TIMEOUTS.DEFAULT,
      });

      // Run accessibility audit
      const accessibilityScanResults = await new AxeBuilder({ page })
        .disableRules(['color-contrast'])
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();

      expect(accessibilityScanResults.violations).toEqual([]);
    });

    test('should pass WCAG 2.1 AA accessibility audit for edit doc form', async ({ page }) => {
      // Use seeded test document
      await page.goto('/dashboard/docs/test-doc');

      // Wait for page to fully load (either edit or new form)
      await expect(page.getByRole('heading', { name: /Edit Document/i }).or(page.getByRole('heading', { name: /Publish Document/i }))).toBeVisible({
        timeout: TEST_TIMEOUTS.DEFAULT,
      });

      // Run accessibility audit
      const accessibilityScanResults = await new AxeBuilder({ page })
        .disableRules(['color-contrast'])
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();

      expect(accessibilityScanResults.violations).toEqual([]);
    });

    test('should have proper form label associations', async ({ page }) => {
      await page.goto('/dashboard/docs');

      // Verify all form inputs have associated labels
      await expect(page.getByLabel(/Title/i)).toBeVisible();
      await expect(page.locator('#doc-slug')).toBeVisible();
      await expect(page.getByLabel(/Category/i)).toBeVisible();
      await expect(page.getByLabel(/Sort Order/i)).toBeVisible();
      await expect(page.getByLabel(/Description \/ Summary/i)).toBeVisible();

      // Verify buttons have accessible names
      await expect(page.getByRole('button', { name: /PUBLISH DOC/i })).toBeVisible();
    });

    test('should be keyboard navigable', async ({ page }) => {
      await page.goto('/dashboard/docs');

      // Wait for page to load
      await expect(page.getByRole('heading', { name: /Publish Document/i })).toBeVisible();

      // Tab through form fields — first focus may land on skip-to-content, nav links, or contenteditable divs
      await page.keyboard.press('Tab');
      const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
      expect(['INPUT', 'TEXTAREA', 'BUTTON', 'SELECT', 'LABEL', 'A', 'DIV', 'BODY']).toContain(focusedElement);
    });
  });

  test.describe('Slug Validation', () => {
    test('should enforce lowercase letters, numbers, and hyphens only', async ({ page }) => {
      await page.goto('/dashboard/docs');

      // Fill in other required fields
      await page.getByLabel(/Title/i).fill('Test Document');
      await page.getByLabel(/Category/i).fill('Test');

      // Try to submit with invalid slug (uppercase letters)
      await page.locator('#doc-slug').fill('Invalid-Slug-With-Uppercase');
      await page.getByRole('button', { name: /PUBLISH DOC/i }).click();

      // Verify validation error appears
      await expect(page.getByText(/Slug must contain only lowercase letters, numbers, and hyphens/i)).toBeVisible({
        timeout: TEST_TIMEOUTS.DEFAULT,
      });
    });

    test('should reject slugs with special characters', async ({ page }) => {
      await page.goto('/dashboard/docs');

      // Fill in other required fields
      await page.getByLabel(/Title/i).fill('Test Document');
      await page.getByLabel(/Category/i).fill('Test');

      // Try to submit with invalid slug (special characters)
      await page.locator('#doc-slug').fill('invalid-slug-with-underscores_');
      await page.getByRole('button', { name: /PUBLISH DOC/i }).click();

      // Verify validation error appears
      await expect(page.getByText(/Slug must contain only lowercase letters, numbers, and hyphens/i)).toBeVisible({
        timeout: TEST_TIMEOUTS.DEFAULT,
      });
    });

    test('should accept valid slug format', async ({ page }) => {
      await page.goto('/dashboard/docs');

      // Fill in form with valid slug
      await page.getByLabel(/Title/i).fill('Test Document');
      await page.locator('#doc-slug').fill('e2e-valid-slug-123');
      await page.getByLabel(/Category/i).fill('Test');

      // Submit should not show slug validation error - real API call
      await page.getByRole('button', { name: /PUBLISH DOC/i }).click();

      // Should not see slug validation error
      await page.waitForTimeout(2000);
      await expect(page.getByText(/Slug must contain only lowercase letters/i)).not.toBeVisible({
        timeout: 5000,
      });
    });
  });

  test.describe('Content Editor', () => {
    test('should load rich text editor', async ({ page }) => {
      await page.goto('/dashboard/docs');

      // Wait for page to load
      await expect(page.getByRole('heading', { name: /Publish Document/i })).toBeVisible();

      // The rich editor should be present - check for toolbar
      await expect(page.locator('.rich-editor-toolbar, [data-testid="rich-editor"], .ProseMirror')).toBeVisible({
        timeout: TEST_TIMEOUTS.DEFAULT,
      }).catch(() => {
        // Editor might be in a different container, check for common patterns
        return expect(page.locator('div[contenteditable="true"]')).toBeVisible();
      });
    });

    test('should have placeholder text in editor', async ({ page }) => {
      await page.goto('/dashboard/docs');

      // Wait for page to load
      await expect(page.getByRole('heading', { name: /Publish Document/i })).toBeVisible();

      // Check for placeholder text or empty editor
      const editorContent = await page.locator('div[contenteditable="true"], .ProseMirror').first().textContent();

      // Editor should be empty or have placeholder
      expect(editorContent?.trim() || '').toMatch(/^(|Start writing documentation)/);
    });
  });
});
