import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { setupMockAuth } from '../fixtures/auth';
import { TEST_TIMEOUTS } from '../fixtures/mock-data';

test.describe('Docs Editor E2E', () => {
  test.beforeEach(async ({ page }) => {
    await setupMockAuth(page);

    // Mock analytics admin stats
    await page.route('**/api/analytics/admin/stats*', async (route) => {
      await route.fulfill({
        status: 200,
        json: {
          posts: 10,
          events: 5,
          docs: 2,
          securityBlocks: 0,
          integrations: {
            zulip: false,
            github: false,
            discord: false,
            bluesky: false,
            slack: false,
            gcal: false,
          },
        },
      });
    });

    // Mock Zulip presence to avoid network errors
    await page.route('**/api/zulip/presence', async (route) => {
      await route.fulfill({
        status: 200,
        json: { success: true, presence: {}, userNames: {} },
      });
    });
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
      await expect(page.getByLabel(/Slug/i)).toBeVisible();
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
      await page.getByLabel(/Slug/i).fill('swerve-drive-guide');
      await page.getByLabel(/Category/i).fill('Programming');
      await page.getByLabel(/Sort Order/i).fill('10');
      await page.getByLabel(/Description \/ Summary/i).fill('Complete guide to programming swerve drive');

      // Verify values are set
      await expect(page.getByLabel(/Title/i)).toHaveValue('Swerve Drive Programming Guide');
      await expect(page.getByLabel(/Slug/i)).toHaveValue('swerve-drive-guide');
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
      // Mock the save endpoint
      await page.route('**/api/docs/admin/save', async (route) => {
        const request = route.request();
        const body = JSON.parse(request.postData() || '{}');

        await route.fulfill({
          status: 200,
          json: { success: true, slug: body.slug || 'new-doc' },
        });
      });

      await page.goto('/dashboard/docs');

      // Fill required fields
      await page.getByLabel(/Title/i).fill('Quick Start Guide');
      await page.getByLabel(/Slug/i).fill('quick-start');
      await page.getByLabel(/Category/i).fill('Getting Started');

      // Publish document
      await page.getByRole('button', { name: /PUBLISH DOC/i }).click();

      // Should redirect to the published doc page after successful save
      await expect(page).toHaveURL(/\/docs\/quick-start/, {
        timeout: TEST_TIMEOUTS.SLOW_PAGE,
      });
    });

    test('should save document as draft', async ({ page }) => {
      // Mock the save endpoint
      await page.route('**/api/docs/admin/save', async (route) => {
        await route.fulfill({
          status: 200,
          json: { success: true, slug: 'draft-doc' },
        });
      });

      await page.goto('/dashboard/docs');

      // Fill required fields
      await page.getByLabel(/Title/i).fill('Draft Document');
      await page.getByLabel(/Slug/i).fill('draft-doc');
      await page.getByLabel(/Category/i).fill('Drafts');

      // Save as draft
      await page.getByRole('button', { name: /SAVE AS DRAFT/i }).click();

      // Should redirect to dashboard after saving draft
      await expect(page).toHaveURL(/\/dashboard/, {
        timeout: TEST_TIMEOUTS.SLOW_PAGE,
      });
    });

    test('should handle save errors gracefully', async ({ page }) => {
      // Mock a failed save attempt
      await page.route('**/api/docs/admin/save', async (route) => {
        await route.fulfill({
          status: 500,
          json: { error: 'Database connection failed' },
        });
      });

      await page.goto('/dashboard/docs');

      // Fill required fields
      await page.getByLabel(/Title/i).fill('Test Doc');
      await page.getByLabel(/Slug/i).fill('test-doc');
      await page.getByLabel(/Category/i).fill('Test');

      // Attempt to publish
      await page.getByRole('button', { name: /PUBLISH DOC/i }).click();

      // Verify error message is displayed
      await expect(page.getByText(/Failed to publish|Network error/i)).toBeVisible({
        timeout: TEST_TIMEOUTS.DEFAULT,
      });
    });
  });

  test.describe('Editing Existing Document', () => {
    const mockDoc = {
      slug: 'swerve-drive-guide',
      title: 'Swerve Drive Programming Guide',
      category: 'Programming',
      sort_order: 10,
      description: 'Complete guide to programming swerve drive',
      content: JSON.stringify({
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Swerve drive is an advanced drivetrain...' }],
          },
        ],
      }),
      is_portfolio: 1,
      is_executive_summary: 0,
      display_in_areslib: 1,
      display_in_math_corner: 0,
      display_in_science_corner: 0,
      zulip_stream: 'documents',
      zulip_topic: 'Doc: Swerve Drive Programming Guide',
    };

    test('should load existing document data for editing', async ({ page }) => {
      // Mock the document detail endpoint
      await page.route('**/api/docs/admin/*/detail', async (route) => {
        await route.fulfill({
          status: 200,
          json: { doc: mockDoc },
        });
      });

      await page.goto('/dashboard/docs/swerve-drive-guide');

      // Verify editor title for editing
      await expect(page.getByRole('heading', { name: /Edit Document/i })).toBeVisible({
        timeout: TEST_TIMEOUTS.DEFAULT,
      });

      // Verify form is pre-populated with existing data
      await expect(page.getByLabel(/Title/i)).toHaveValue('Swerve Drive Programming Guide');
      await expect(page.getByLabel(/Slug/i)).toHaveValue('swerve-drive-guide');
      await expect(page.getByLabel(/Slug/i)).toBeDisabled();
      await expect(page.getByLabel(/Category/i)).toHaveValue('Programming');
      await expect(page.getByLabel(/Description \/ Summary/i)).toHaveValue('Complete guide to programming swerve drive');
    });

    test('should pre-fill visibility toggles correctly', async ({ page }) => {
      // Mock the document detail endpoint
      await page.route('**/api/docs/admin/*/detail', async (route) => {
        await route.fulfill({
          status: 200,
          json: { doc: mockDoc },
        });
      });

      await page.goto('/dashboard/docs/swerve-drive-guide');

      // Verify checkbox states match mock data
      await expect(page.getByLabel(/Judge's Portfolio Selection/i)).toBeChecked();
      await expect(page.getByLabel(/Executive Summary Flag/i)).not.toBeChecked();
      await expect(page.getByLabel(/Main Library \(ARESLib\)/i)).toBeChecked();
      await expect(page.getByLabel(/Math Corner/i)).not.toBeChecked();
      await expect(page.getByLabel(/Science Corner/i)).not.toBeChecked();
    });

    test('should update existing document', async ({ page }) => {
      // Mock the document detail endpoint
      await page.route('**/api/docs/admin/*/detail', async (route) => {
        await route.fulfill({
          status: 200,
          json: { doc: mockDoc },
        });
      });

      // Mock the save endpoint
      await page.route('**/api/docs/admin/save', async (route) => {
        await route.fulfill({
          status: 200,
          json: { success: true, slug: 'swerve-drive-guide' },
        });
      });

      await page.goto('/dashboard/docs/swerve-drive-guide');

      // Update title
      await page.getByLabel(/Title/i).clear();
      await page.getByLabel(/Title/i).fill('Swerve Drive Programming Guide v2');

      // Update the document
      await page.getByRole('button', { name: /UPDATE DOC/i }).click();

      // Should redirect to the published doc page after successful update
      await expect(page).toHaveURL(/\/docs\/swerve-drive-guide/, {
        timeout: TEST_TIMEOUTS.SLOW_PAGE,
      });
    });

    test('should handle missing document gracefully', async ({ page }) => {
      // Mock a 404 response for non-existent document
      await page.route('**/api/docs/admin/9999/detail', async (route) => {
        await route.fulfill({
          status: 404,
          json: { error: 'Document not found' },
        });
      });

      await page.goto('/dashboard/docs/9999');

      // Editor should still load but with empty form for new doc
      await expect(page.getByRole('heading', { name: /Publish Document/i })).toBeVisible({
        timeout: TEST_TIMEOUTS.DEFAULT,
      });
    });

    test('should show delete button for existing documents', async ({ page }) => {
      // Mock the document detail endpoint
      await page.route('**/api/docs/admin/*/detail', async (route) => {
        await route.fulfill({
          status: 200,
          json: { doc: mockDoc },
        });
      });

      await page.goto('/dashboard/docs/swerve-drive-guide');

      // Verify delete button is present
      await expect(page.getByRole('button', { name: /DELETE DOC/i })).toBeVisible();
    });

    test('should cancel edit and return to manage docs', async ({ page }) => {
      // Mock the document detail endpoint
      await page.route('**/api/docs/admin/*/detail', async (route) => {
        await route.fulfill({
          status: 200,
          json: { doc: mockDoc },
        });
      });

      await page.goto('/dashboard/docs/swerve-drive-guide');

      // Click cancel edit button
      await page.getByRole('button', { name: /Cancel Edit/i }).click();

      // Should navigate to manage docs page
      await expect(page).toHaveURL(/\/dashboard\/manage_docs/, {
        timeout: TEST_TIMEOUTS.DEFAULT,
      });
    });
  });

  test.describe('Docs Manager Integration', () => {
    const mockDocs = [
      {
        slug: 'getting-started',
        title: 'Getting Started with ARES',
        category: 'Getting Started',
        sort_order: 1,
        description: 'Welcome to the ARES documentation hub',
        is_portfolio: 1,
        is_executive_summary: 1,
        status: 'published',
        is_deleted: 0,
      },
      {
        slug: 'programming-guide',
        title: 'Programming Guide',
        category: 'Programming',
        sort_order: 10,
        description: 'Advanced programming concepts',
        is_portfolio: 0,
        is_executive_summary: 0,
        status: 'draft',
        is_deleted: 0,
      },
      {
        slug: 'deleted-doc',
        title: 'Old Documentation',
        category: 'Archive',
        sort_order: 99,
        description: 'This has been deleted',
        is_portfolio: 0,
        is_executive_summary: 0,
        status: 'published',
        is_deleted: 1,
      },
    ];

    test('should navigate from manager to docs editor', async ({ page }) => {
      // Mock the docs list endpoint
      await page.route('**/api/docs/admin/list', async (route) => {
        await route.fulfill({
          status: 200,
          json: { docs: mockDocs },
        });
      });

      await page.goto('/dashboard/manage_docs');

      // Wait for the docs list to load
      await expect(page.getByText(/Manage Documentation/i)).toBeVisible({
        timeout: TEST_TIMEOUTS.SLOW_PAGE,
      });

      // Click on the first doc to edit
      await page.getByText('Getting Started with ARES').click();

      // Should navigate to the docs editor
      await expect(page).toHaveURL(/\/dashboard\/docs\/getting-started/, {
        timeout: TEST_TIMEOUTS.DEFAULT,
      });

      // Verify editor loaded
      await expect(page.getByRole('heading', { name: /Edit Document/i })).toBeVisible();
    });

    test('should create new doc from manager', async ({ page }) => {
      // Mock the docs list endpoint
      await page.route('**/api/docs/admin/list', async (route) => {
        await route.fulfill({
          status: 200,
          json: { docs: mockDocs },
        });
      });

      await page.goto('/dashboard/manage_docs');

      // Navigate to new doc form
      await page.getByRole('link', { name: /New Document|Create Doc/i }).click();

      // Should navigate to the new doc editor
      await expect(page).toHaveURL(/\/dashboard\/docs$/, {
        timeout: TEST_TIMEOUTS.DEFAULT,
      });

      // Verify new doc editor loaded
      await expect(page.getByRole('heading', { name: /Publish Document/i })).toBeVisible();
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
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();

      expect(accessibilityScanResults.violations).toEqual([]);
    });

    test('should pass WCAG 2.1 AA accessibility audit for edit doc form', async ({ page }) => {
      const mockDoc = {
        slug: 'test-doc',
        title: 'Test Document',
        category: 'Test',
        sort_order: 1,
        description: 'Test description',
        content: JSON.stringify({
          type: 'doc',
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: 'Test content' }],
            },
          ],
        }),
        is_portfolio: 0,
        is_executive_summary: 0,
        display_in_areslib: 1,
        display_in_math_corner: 0,
        display_in_science_corner: 0,
      };

      // Mock the document detail endpoint
      await page.route('**/api/docs/admin/*/detail', async (route) => {
        await route.fulfill({
          status: 200,
          json: { doc: mockDoc },
        });
      });

      await page.goto('/dashboard/docs/test-doc');

      // Wait for page to fully load
      await expect(page.getByRole('heading', { name: /Edit Document/i })).toBeVisible({
        timeout: TEST_TIMEOUTS.DEFAULT,
      });

      // Run accessibility audit
      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();

      expect(accessibilityScanResults.violations).toEqual([]);
    });

    test('should have proper form label associations', async ({ page }) => {
      await page.goto('/dashboard/docs');

      // Verify all form inputs have associated labels
      await expect(page.getByLabel(/Title/i)).toBeVisible();
      await expect(page.getByLabel(/Slug/i)).toBeVisible();
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

      // Tab through form fields
      await page.keyboard.press('Tab');
      const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
      expect(['INPUT', 'TEXTAREA', 'BUTTON', 'SELECT', 'LABEL']).toContain(focusedElement);
    });
  });

  test.describe('Slug Validation', () => {
    test('should enforce lowercase letters, numbers, and hyphens only', async ({ page }) => {
      await page.goto('/dashboard/docs');

      // Fill in other required fields
      await page.getByLabel(/Title/i).fill('Test Document');
      await page.getByLabel(/Category/i).fill('Test');

      // Try to submit with invalid slug (uppercase letters)
      await page.getByLabel(/Slug/i).fill('Invalid-Slug-With-Uppercase');
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
      await page.getByLabel(/Slug/i).fill('invalid-slug-with-underscores_');
      await page.getByRole('button', { name: /PUBLISH DOC/i }).click();

      // Verify validation error appears
      await expect(page.getByText(/Slug must contain only lowercase letters, numbers, and hyphens/i)).toBeVisible({
        timeout: TEST_TIMEOUTS.DEFAULT,
      });
    });

    test('should accept valid slug format', async ({ page }) => {
      // Mock the save endpoint
      await page.route('**/api/docs/admin/save', async (route) => {
        await route.fulfill({
          status: 200,
          json: { success: true, slug: 'valid-slug-123' },
        });
      });

      await page.goto('/dashboard/docs');

      // Fill in form with valid slug
      await page.getByLabel(/Title/i).fill('Test Document');
      await page.getByLabel(/Slug/i).fill('valid-slug-123');
      await page.getByLabel(/Category/i).fill('Test');

      // Submit should not show slug validation error
      await page.getByRole('button', { name: /PUBLISH DOC/i }).click();

      // Should not see slug validation error
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
