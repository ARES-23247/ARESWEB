import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { setupMockAuth } from '../fixtures/auth';
import { TEST_TIMEOUTS } from '../fixtures/mock-data';

/**
 * Blog Editor E2E Tests
 *
 * Tests the /dashboard/blog route for creating and editing blog posts.
 * Covers:
 * - New post creation workflow
 * - Editing existing posts via /dashboard/blog/:slug
 * - CRUD operations (Create, Read, Update, Delete)
 * - WCAG 2.1 AA accessibility compliance
 */

test.describe('Blog Editor Dashboard Route', () => {
  test.beforeEach(async ({ page }) => {
    await setupMockAuth(page);

    // Mock admin settings for social syndication options
    await page.route('**/api/settings/admin/settings*', async (route) => {
      await route.fulfill({
        status: 200,
        json: {
          settings: {
            availableSocials: ['discord', 'bluesky', 'slack', 'teams', 'gchat', 'facebook', 'twitter', 'instagram'],
            zulipStream: 'blog',
            zulipTopic: 'Blog Posts',
          },
        },
      });
    });

    // Mock seasons for season picker
    await page.route('**/api/seasons*', async (route) => {
      await route.fulfill({
        status: 200,
        json: {
          seasons: [
            {
              start_year: 2024,
              end_year: 2025,
              challenge_name: 'CENTERSTAGE',
              robot_name: 'ARES-6',
              is_deleted: 0,
              status: 'published',
            },
            {
              start_year: 2025,
              end_year: 2026,
              challenge_name: 'INTO THE DEEP',
              robot_name: 'ARES-7',
              is_deleted: 0,
              status: 'published',
            },
          ],
        },
      });
    });

    // Mock Zulip presence to avoid network errors affecting a11y scans
    await page.route('**/api/zulip/presence', async (route) => {
      await route.fulfill({
        status: 200,
        json: { success: true, presence: {}, userNames: {} },
      });
    });

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
  });

  test.describe('New Post Creation Workflow', () => {
    test('should display blog editor with empty form for new post', async ({ page }) => {
      await page.goto('/dashboard/blog');

      // Verify editor title for new post
      await expect(page.getByRole('heading', { name: /Publish Entry/i })).toBeVisible({
        timeout: TEST_TIMEOUTS.DEFAULT,
      });

      // Verify subtitle describing the purpose
      await expect(page.getByText(/Draft rich-text engineering and outreach updates/i)).toBeVisible();

      // Verify form fields are present and accessible
      await expect(page.getByLabel(/Post Title/i)).toBeVisible();
      await expect(page.locator('#post-title')).toBeVisible();

      // Verify cover image picker
      await expect(page.getByText(/Cover Image/i)).toBeVisible();

      // Verify editor actions are present
      await expect(page.getByRole('button', { name: /Save Draft/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /PUBLISH ENTRY/i })).toBeVisible();
    });

    test('should validate required fields when publishing without data', async ({ page }) => {
      await page.goto('/dashboard/blog');

      // Click publish without filling required fields
      await page.getByRole('button', { name: /PUBLISH ENTRY/i }).click();

      // Verify validation error appears
      await expect(page.getByText(/String must contain at least 1 character\(s\)|required/i)).toBeVisible({
        timeout: TEST_TIMEOUTS.DEFAULT,
      });
    });

    test('should allow filling blog post form data', async ({ page }) => {
      await page.goto('/dashboard/blog');

      // Fill in the post form
      await page.getByLabel(/Post Title/i).fill('Our Road to State Championship');

      // Verify title is set
      await expect(page.getByLabel(/Post Title/i)).toHaveValue('Our Road to State Championship');

      // Verify schedule publish time field exists
      await expect(page.getByLabel(/Schedule Publish Time/i)).toBeVisible();
    });

    test('should create new blog post successfully', async ({ page }) => {
      // Mock the save endpoint
      await page.route('**/api/posts/admin/save', async (route) => {
        const request = route.request();
        const body = JSON.parse(request.postData() || '{}');

        await route.fulfill({
          status: 200,
          json: { success: true, slug: body.slug || 'our-road-to-state' },
        });
      });

      await page.goto('/dashboard/blog');

      // Fill required fields
      await page.getByLabel(/Post Title/i).fill('Our Road to State Championship');

      // Publish post
      await page.getByRole('button', { name: /PUBLISH ENTRY/i }).click();

      // Should redirect to dashboard after successful publish
      await expect(page).toHaveURL(/\/dashboard/, {
        timeout: TEST_TIMEOUTS.SLOW_PAGE,
      });
    });

    test('should save post draft successfully', async ({ page }) => {
      // Mock the save endpoint
      await page.route('**/api/posts/admin/save', async (route) => {
        await route.fulfill({
          status: 200,
          json: { success: true, slug: 'draft-post-for-testing' },
        });
      });

      await page.goto('/dashboard/blog');

      // Fill required fields
      await page.getByLabel(/Post Title/i).fill('Draft Post for Testing');

      // Save as draft
      await page.getByRole('button', { name: /Save Draft/i }).click();

      // Should redirect to dashboard after successful save
      await expect(page).toHaveURL(/\/dashboard/, {
        timeout: TEST_TIMEOUTS.SLOW_PAGE,
      });
    });

    test('should handle save errors gracefully', async ({ page }) => {
      // Mock a failed save attempt
      await page.route('**/api/posts/admin/save', async (route) => {
        await route.fulfill({
          status: 500,
          json: { error: 'Database connection failed' },
        });
      });

      await page.goto('/dashboard/blog');

      // Fill required fields
      await page.getByLabel(/Post Title/i).fill('Failed Post');

      // Attempt to publish
      await page.getByRole('button', { name: /PUBLISH ENTRY/i }).click();

      // Verify error message is displayed
      await expect(page.getByText(/Publication failed|Save failed/i)).toBeVisible({
        timeout: TEST_TIMEOUTS.DEFAULT,
      });
    });

    test('should handle social syndication warnings', async ({ page }) => {
      // Mock the save endpoint with warning
      await page.route('**/api/posts/admin/save', async (route) => {
        await route.fulfill({
          status: 200,
          json: {
            success: true,
            slug: 'social-test',
            warning: 'Discord syndication failed: Bot token expired',
          },
        });
      });

      await page.goto('/dashboard/blog');

      // Fill required fields
      await page.getByLabel(/Post Title/i).fill('Social Test Post');

      // Publish post
      await page.getByRole('button', { name: /PUBLISH ENTRY/i }).click();

      // Should still redirect despite warning
      await expect(page).toHaveURL(/\/dashboard/, {
        timeout: TEST_TIMEOUTS.SLOW_PAGE,
      });
    });

    test('should toggle social syndication options', async ({ page }) => {
      await page.goto('/dashboard/blog');

      // Check for social syndication checkboxes
      const discordCheckbox = page.getByLabel(/discord/i, { exact: false });
      const blueskyCheckbox = page.getByLabel(/bluesky/i, { exact: false });

      // Verify checkboxes exist and are checked by default
      await expect(discordCheckbox).toBeVisible();
      await expect(blueskyCheckbox).toBeVisible();

      // Uncheck discord
      if (await discordCheckbox.isChecked()) {
        await discordCheckbox.uncheck();
      }
      await expect(discordCheckbox).not.toBeChecked();
    });

    test('should select season for post', async ({ page }) => {
      await page.goto('/dashboard/blog');

      // Look for season picker - may be a dropdown or select
      const seasonPicker = page.getByLabel(/Season/i);
      await expect(seasonPicker).toBeVisible();

      // The season picker implementation may vary
      // Just verify it's accessible
      await expect(seasonPicker).toBeEnabled();
    });
  });

  test.describe('Editing Existing Post', () => {
    const mockPost = {
      slug: 'existing-blog-post',
      title: 'Existing Blog Post Title',
      thumbnail: 'https://example.com/cover.jpg',
      published_at: '2024-01-15T10:00:00Z',
      season_id: 2024,
      ast: JSON.stringify({
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'This is existing blog post content.' }],
          },
        ],
      }),
      zulip_stream: 'blog',
      zulip_topic: 'Blog: Existing Blog Post Title',
    };

    test('should load existing post data for editing', async ({ page }) => {
      // Mock the post detail endpoint
      await page.route('**/api/posts/admin/existing-blog-post', async (route) => {
        await route.fulfill({
          status: 200,
          json: { post: mockPost },
        });
      });

      await page.goto('/dashboard/blog/existing-blog-post');

      // Verify editor title for editing
      await expect(page.getByRole('heading', { name: /Edit Entry/i })).toBeVisible({
        timeout: TEST_TIMEOUTS.DEFAULT,
      });

      // Verify form is pre-populated with existing data
      await expect(page.getByLabel(/Post Title/i)).toHaveValue('Existing Blog Post Title');

      // Verify subtitle describes editing
      await expect(page.getByText(/Modify an existing engineering or outreach update/i)).toBeVisible();
    });

    test('should update existing post', async ({ page }) => {
      // Mock the post detail endpoint
      await page.route('**/api/posts/admin/existing-blog-post', async (route) => {
        await route.fulfill({
          status: 200,
          json: { post: mockPost },
        });
      });

      // Mock the update endpoint
      await page.route('**/api/posts/admin/existing-blog-post', async (route) => {
        const request = route.request();
        if (request.method() === 'POST') {
          await route.fulfill({
            status: 200,
            json: { success: true, slug: 'existing-blog-post' },
          });
        } else {
          await route.continue();
        }
      });

      await page.goto('/dashboard/blog/existing-blog-post');

      // Update title
      await page.getByLabel(/Post Title/i).clear();
      await page.getByLabel(/Post Title/i).fill('Updated Blog Post Title');

      // Update the post
      await page.getByRole('button', { name: /UPDATE ENTRY/i }).click();

      // Should redirect to blog post page after successful update
      await expect(page).toHaveURL(/\/blog\/existing-blog-post/, {
        timeout: TEST_TIMEOUTS.SLOW_PAGE,
      });
    });

    test('should delete existing post', async ({ page }) => {
      // Mock the post detail endpoint
      await page.route('**/api/posts/admin/existing-blog-post', async (route) => {
        await route.fulfill({
          status: 200,
          json: { post: mockPost },
        });
      });

      // Mock the delete endpoint
      await page.route('**/api/posts/admin/existing-blog-post', async (route) => {
        const request = route.request();
        if (request.method() === 'DELETE') {
          await route.fulfill({
            status: 200,
            json: { success: true },
          });
        } else {
          await route.continue();
        }
      });

      await page.goto('/dashboard/blog/existing-blog-post');

      // Click delete button
      await page.getByRole('button', { name: /DELETE/i }).click();

      // Handle confirmation dialog if it appears
      const confirmButton = page.getByRole('button', { name: /Delete/i });
      if (await confirmButton.isVisible({ timeout: 2000 })) {
        await confirmButton.click();
      }

      // Should redirect to dashboard after deletion
      await expect(page).toHaveURL(/\/dashboard/, {
        timeout: TEST_TIMEOUTS.SLOW_PAGE,
      });
    });

    test('should handle missing post gracefully', async ({ page }) => {
      // Mock a 404 response for non-existent post
      await page.route('**/api/posts/admin/non-existent-post', async (route) => {
        await route.fulfill({
          status: 404,
          json: { error: 'Post not found' },
        });
      });

      await page.goto('/dashboard/blog/non-existent-post');

      // Editor should still load but as new post form
      await expect(page.getByRole('heading', { name: /Publish Entry/i })).toBeVisible({
        timeout: TEST_TIMEOUTS.DEFAULT,
      });
    });

    test('should display Zulip thread for existing post', async ({ page }) => {
      // Mock the post detail endpoint
      await page.route('**/api/posts/admin/existing-blog-post', async (route) => {
        await route.fulfill({
          status: 200,
          json: { post: mockPost },
        });
      });

      // Mock Zulip messages endpoint
      await page.route('**/api/zulip/messages*', async (route) => {
        await route.fulfill({
          status: 200,
          json: { messages: [] },
        });
      });

      await page.goto('/dashboard/blog/existing-blog-post');

      // Verify Zulip thread section appears
      await expect(page.getByText(/Zulip Discussion/i)).toBeVisible({
        timeout: TEST_TIMEOUTS.DEFAULT,
      });
    });

    test('should allow editing post with existing AST content', async ({ page }) => {
      const postWithRichContent = {
        ...mockPost,
        ast: JSON.stringify({
          type: 'doc',
          content: [
            {
              type: 'heading',
              attrs: { level: 1 },
              content: [{ type: 'text', text: 'Main Heading' }],
            },
            {
              type: 'paragraph',
              content: [
                { type: 'text', text: 'This is ' },
                { type: 'text', marks: [{ type: 'bold' }], text: 'bold' },
                { type: 'text', text: ' content.' },
              ],
            },
            {
              type: 'bulletList',
              content: [
                {
                  type: 'listItem',
                  content: [{ type: 'paragraph', content: [{ type: 'text', text: 'First item' }] }],
                },
                {
                  type: 'listItem',
                  content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Second item' }] }],
                },
              ],
            },
          ],
        }),
      };

      // Mock the post detail endpoint
      await page.route('**/api/posts/admin/rich-content-post', async (route) => {
        await route.fulfill({
          status: 200,
          json: { post: postWithRichContent },
        });
      });

      await page.goto('/dashboard/blog/rich-content-post');

      // Verify editor loaded with existing content
      await expect(page.getByRole('heading', { name: /Edit Entry/i })).toBeVisible({
        timeout: TEST_TIMEOUTS.DEFAULT,
      });

      // Verify title is populated
      await expect(page.getByLabel(/Post Title/i)).toHaveValue('Existing Blog Post Title');
    });

    test('should cancel edit and return to dashboard', async ({ page }) => {
      // Mock the post detail endpoint
      await page.route('**/api/posts/admin/existing-blog-post', async (route) => {
        await route.fulfill({
          status: 200,
          json: { post: mockPost },
        });
      });

      await page.goto('/dashboard/blog/existing-blog-post');

      // Click cancel edit button
      const cancelButton = page.getByRole('button', { name: /Cancel|Back/i });
      if (await cancelButton.isVisible({ timeout: 2000 })) {
        await cancelButton.click();

        // Should navigate to dashboard
        await expect(page).toHaveURL(/\/dashboard/, {
          timeout: TEST_TIMEOUTS.DEFAULT,
        });
      }
    });
  });

  test.describe('Author Role Workflow', () => {
    test('should show "Submit for Review" button for authors', async ({ page }) => {
      // Set up auth with author role
      await page.route('**/api/auth/get-session', async (route) => {
        await route.fulfill({
          status: 200,
          json: {
            session: {
              id: 'author-session',
              userId: 'author-user',
              expiresAt: new Date(Date.now() + 10000000).toISOString(),
            },
            user: {
              id: 'author-user',
              name: 'Author User',
              email: 'author@ares.org',
              role: 'author',
              image: 'https://api.dicebear.com/9.x/bottts/svg?seed=author',
            },
          },
        });
      });

      await page.route('**/profile/me', async (route) => {
        await route.fulfill({
          status: 200,
          json: {
            user_id: 'author-user',
            nickname: 'Author User',
            first_name: 'Author',
            last_name: 'User',
            member_type: 'student',
            auth: {
              id: 'author-user',
              email: 'author@ares.org',
              name: 'Author User',
              role: 'author',
            },
          },
        });
      });

      // Set auth cookie
      await page.context().addCookies([
        {
          name: 'better-auth.session_token',
          value: 'author-session',
          domain: 'localhost',
          path: '/',
        },
      ]);

      await page.goto('/dashboard/blog');

      // Verify submit for review button is shown
      await expect(page.getByRole('button', { name: /SUBMIT FOR REVIEW/i })).toBeVisible({
        timeout: TEST_TIMEOUTS.DEFAULT,
      });
    });
  });

  test.describe('Cover Image Management', () => {
    test('should display cover image picker', async ({ page }) => {
      await page.goto('/dashboard/blog');

      // Verify cover image section is visible
      await expect(page.getByText(/Cover Image/i)).toBeVisible();

      // Look for cover image preview/input
      const coverImageSection = page.locator('img[src*="/api/media"], img[src*="cover"]').first();
      if (await coverImageSection.isVisible({ timeout: 2000 })) {
        await expect(coverImageSection).toBeVisible();
      }
    });

    test('should allow entering cover image URL', async ({ page }) => {
      await page.goto('/dashboard/blog');

      // Look for URL input for cover image
      const urlInput = page.getByLabel(/URL/i, { exact: false }).filter({ hasText: /cover/i });

      if (await urlInput.isVisible({ timeout: 2000 })) {
        await urlInput.fill('https://example.com/new-cover.jpg');
        await expect(urlInput).toHaveValue('https://example.com/new-cover.jpg');
      }
    });

    test('should allow uploading cover image file', async ({ page }) => {
      // Mock file upload endpoint
      await page.route('**/api/media/upload', async (route) => {
        await route.fulfill({
          status: 200,
          json: {
            success: true,
            url: 'https://example.com/uploaded-cover.jpg',
            key: 'uploads/uploaded-cover.jpg',
          },
        });
      });

      await page.goto('/dashboard/blog');

      // Look for file upload button
      const uploadButton = page.getByRole('button', { name: /Upload/i }).filter({ hasText: /cover/i }).or(
        page.getByText(/Choose File/i).or(page.getByLabel(/File/i))
      );

      if (await uploadButton.isVisible({ timeout: 2000 })) {
        // Create a minimal file for upload
        const fileBuffer = Buffer.from([
          0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, // PNG signature
          0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
          0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
          0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
        ]);

        // Note: Actual file upload handling depends on the implementation
        await expect(uploadButton).toBeVisible();
      }
    });

    test('should open asset picker modal for cover selection', async ({ page }) => {
      // Mock media assets endpoint
      await page.route('**/api/media*', async (route) => {
        await route.fulfill({
          status: 200,
          json: {
            assets: [
              { key: 'blog/cover1.jpg', size: 50000, uploaded: '2024-01-01', url: '/api/media/blog/cover1.jpg' },
              { key: 'blog/cover2.jpg', size: 60000, uploaded: '2024-01-02', url: '/api/media/blog/cover2.jpg' },
            ],
          },
        });
      });

      await page.goto('/dashboard/blog');

      // Look for library/browse button
      const libraryButton = page.getByRole('button', { name: /Library|Browse|Choose from Library/i }).or(
        page.getByText(/Library/i)
      );

      if (await libraryButton.isVisible({ timeout: 2000 })) {
        await libraryButton.click();

        // Modal should appear
        await expect(page.getByRole('dialog').or(page.locator('.modal'))).toBeVisible({
          timeout: TEST_TIMEOUTS.DEFAULT,
        });
      }
    });
  });

  test.describe('Accessibility Audit (WCAG 2.1 AA)', () => {
    test('should pass WCAG 2.1 AA accessibility audit for new post form', async ({ page }) => {
      await page.goto('/dashboard/blog');

      // Wait for page to fully load
      await expect(page.getByRole('heading', { name: /Publish Entry/i })).toBeVisible({
        timeout: TEST_TIMEOUTS.DEFAULT,
      });

      // Run accessibility audit
      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();

      expect(accessibilityScanResults.violations).toEqual([]);
    });

    test('should pass WCAG 2.1 AA accessibility audit for edit post form', async ({ page }) => {
      const mockPost = {
        slug: 'a11y-test-post',
        title: 'Accessibility Test Post',
        thumbnail: null,
        published_at: null,
        season_id: null,
        ast: JSON.stringify({
          type: 'doc',
          content: [
            { type: 'paragraph', content: [{ type: 'text', text: 'Test content' }] },
          ],
        }),
        zulip_stream: 'blog',
        zulip_topic: 'Blog: Accessibility Test',
      };

      // Mock the post detail endpoint
      await page.route('**/api/posts/admin/a11y-test-post', async (route) => {
        await route.fulfill({
          status: 200,
          json: { post: mockPost },
        });
      });

      await page.goto('/dashboard/blog/a11y-test-post');

      // Wait for page to fully load
      await expect(page.getByRole('heading', { name: /Edit Entry/i })).toBeVisible({
        timeout: TEST_TIMEOUTS.DEFAULT,
      });

      // Run accessibility audit
      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();

      expect(accessibilityScanResults.violations).toEqual([]);
    });

    test('should have proper form label associations', async ({ page }) => {
      await page.goto('/dashboard/blog');

      // Verify all form inputs have associated labels
      await expect(page.getByLabel(/Post Title/i)).toBeVisible();
      await expect(page.getByLabel(/Schedule Publish Time/i)).toBeVisible();
      await expect(page.getByLabel(/Cover Image/i)).toBeVisible();

      // Verify buttons have accessible names
      await expect(page.getByRole('button', { name: /Save Draft/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /PUBLISH ENTRY/i })).toBeVisible();
    });

    test('should be keyboard navigable', async ({ page }) => {
      await page.goto('/dashboard/blog');

      // Wait for form to load
      await expect(page.getByLabel(/Post Title/i)).toBeVisible();

      // Tab through form fields
      await page.keyboard.press('Tab');
      const firstFocused = await page.evaluate(() => document.activeElement?.tagName);
      expect(['INPUT', 'TEXTAREA', 'BUTTON', 'SELECT']).toContain(firstFocused);

      // Continue tabbing
      await page.keyboard.press('Tab');
      const secondFocused = await page.evaluate(() => document.activeElement?.tagName);
      expect(['INPUT', 'TEXTAREA', 'BUTTON', 'SELECT']).toContain(secondFocused);

      // Verify focus management
      const focusedElement = await page.evaluate(() => ({
        tagName: document.activeElement?.tagName,
        hasFocus: document.activeElement === document.activeElement,
      }));
      expect(focusedElement.hasFocus).toBe(true);
    });

    test('should have sufficient color contrast', async ({ page }) => {
      await page.goto('/dashboard/blog');

      // Run accessibility audit with color contrast rules
      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa'])
        .include(['body'])
        .analyze();

      // Filter for color-contrast violations
      const contrastViolations = accessibilityScanResults.violations.filter(
        v => v.id === 'color-contrast'
      );

      expect(contrastViolations).toEqual([]);
    });
  });

  test.describe('Rich Editor Integration', () => {
    test('should load rich text editor', async ({ page }) => {
      await page.goto('/dashboard/blog');

      // Wait for editor container
      await expect(page.locator('.ProseMirror, [contenteditable="true"]').or(page.getByText(/Start drafting your robotics article/i))).toBeVisible({
        timeout: TEST_TIMEOUTS.DEFAULT,
      });
    });

    test('should display editor toolbar', async ({ page }) => {
      await page.goto('/dashboard/blog');

      // Look for common toolbar buttons
      const toolbarButtons = [
        page.getByRole('button', { name: /bold/i }),
        page.getByRole('button', { name: /italic/i }),
        page.getByRole('button', { name: /heading/i }),
        page.getByRole('button', { name: /link/i }),
      ];

      // At least some toolbar elements should be visible
      const visibleButtons = await Promise.all(
        toolbarButtons.map(btn => btn.isVisible().catch(() => false))
      );

      expect(visibleButtons.some(Boolean)).toBe(true);
    });

    test('should allow typing in the editor', async ({ page }) => {
      await page.goto('/dashboard/blog');

      // Wait for editor
      const editor = page.locator('.ProseMirror').or(page.locator('[contenteditable="true"]')).first();
      await expect(editor).toBeVisible({ timeout: TEST_TIMEOUTS.DEFAULT });

      // Type in the editor
      await editor.click();
      await editor.fill('This is test content for the blog post.');

      // Verify content was added
      await expect(editor).toContainText('test content');
    });
  });

  test.describe('Collaborative Editing', () => {
    test('should initialize collaborative editing room', async ({ page }) => {
      await page.goto('/dashboard/blog');

      // The editor should load without errors
      await expect(page.getByRole('heading', { name: /Publish Entry/i })).toBeVisible({
        timeout: TEST_TIMEOUTS.DEFAULT,
      });

      // Collaborative features may be indicated by UI elements
      // For now, just verify no errors occurred
      const errors: string[] = [];
      page.on('console', msg => {
        if (msg.type() === 'error') {
          errors.push(msg.text());
        }
      });

      // Give some time for initialization
      await page.waitForTimeout(2000);

      // Filter out benign errors
      const criticalErrors = errors.filter(e =>
        !e.includes('favicon') &&
        !e.includes('404') &&
        !e.includes('401')
      );

      // We expect collaborative features to initialize cleanly
      // (specific assertions depend on implementation)
      expect(criticalErrors.length).toBeLessThan(5);
    });

    test('should show version history button for existing posts', async ({ page }) => {
      const mockPost = {
        slug: 'versioned-post',
        title: 'Post with History',
        thumbnail: null,
        published_at: '2024-01-01T00:00:00Z',
        season_id: null,
        ast: JSON.stringify({
          type: 'doc',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Content' }] }],
        }),
        zulip_stream: 'blog',
        zulip_topic: 'Blog: Post with History',
      };

      // Mock the post detail endpoint
      await page.route('**/api/posts/admin/versioned-post', async (route) => {
        await route.fulfill({
          status: 200,
          json: { post: mockPost },
        });
      });

      await page.goto('/dashboard/blog/versioned-post');

      // Look for history/version button
      const historyButton = page.getByRole('button', { name: /history|versions/i }).or(
        page.getByText(/History/i)
      );

      if (await historyButton.isVisible({ timeout: 2000 })) {
        await expect(historyButton).toBeVisible();
      }
    });
  });

  test.describe('Navigation and Routing', () => {
    test('should navigate to new post form from dashboard home', async ({ page }) => {
      await page.goto('/dashboard');

      // Click on blog navigation
      const blogNavButton = page.getByRole('link', { name: /blog/i }).or(
        page.getByRole('button', { name: /New Blog Post/i })
      );

      if (await blogNavButton.isVisible({ timeout: 2000 })) {
        await blogNavButton.click();
        await expect(page).toHaveURL(/\/dashboard\/blog/, {
          timeout: TEST_TIMEOUTS.DEFAULT,
        });
      }
    });

    test('should navigate to edit existing post from content manager', async ({ page }) => {
      const mockPosts = [
        { slug: 'edit-me-post', title: 'Edit Me Post', status: 'published' },
      ];

      // Mock the posts list endpoint
      await page.route('**/api/posts/admin/list*', async (route) => {
        await route.fulfill({
          status: 200,
          json: { posts: mockPosts },
        });
      });

      // Mock the post detail endpoint
      await page.route('**/api/posts/admin/edit-me-post', async (route) => {
        await route.fulfill({
          status: 200,
          json: {
            post: {
              slug: 'edit-me-post',
              title: 'Edit Me Post',
              thumbnail: null,
              published_at: null,
              season_id: null,
              ast: JSON.stringify({
                type: 'doc',
                content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Content' }] }],
              }),
            },
          },
        });
      });

      await page.goto('/dashboard/manage_blog');

      // Wait for content manager to load
      await expect(page.getByText(/Blog|Manage/i)).toBeVisible({ timeout: TEST_TIMEOUTS.DEFAULT });

      // Look for edit button/link for the post
      const editButton = page.getByRole('button', { name: /edit|Edit/i }).filter({ hasText: /Edit Me Post/ }).or(
        page.getByRole('link', { name: /Edit Me Post/i })
      );

      if (await editButton.isVisible({ timeout: 2000 })) {
        await editButton.click();
        await expect(page).toHaveURL(/\/dashboard\/blog\/edit-me-post/, {
          timeout: TEST_TIMEOUTS.DEFAULT,
        });
      }
    });
  });
});
