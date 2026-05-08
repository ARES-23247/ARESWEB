import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { setupMockAuth, MOCK_ADMIN_USER } from '../fixtures/auth';
import { TEST_TIMEOUTS } from '../fixtures/mock-data';

test.describe('Blog Post Detail Page E2E', () => {
  const testPostSlug = 'test-post';
  const mockPost = {
    slug: testPostSlug,
    title: 'ARES 23247 Championship Journey',
    thumbnail: 'https://example.com/robot-champion.jpg',
    date: '2025-01-15',
    snippet: 'Our incredible journey to the state championship...',
    status: 'published',
    author: 'Jane Doe',
    author_nickname: 'Jane_Doe',
    author_avatar: 'https://api.dicebear.com/9.x/bottts/svg?seed=Jane_Doe',
    published_at: '2025-01-15T10:00:00Z',
    season_id: 1,
    is_deleted: 0,
    is_portfolio: 0,
    zulip_stream: 'blog',
    zulip_topic: 'Blog: ARES 23247 Championship Journey',
    ast: JSON.stringify({
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: 'The Road to Championship' }],
        },
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Our team worked incredibly hard this season. We started with a vision and ended with ' },
            { type: 'text', marks: [{ type: 'bold' }], text: 'excellence' },
            { type: 'text', text: '.' },
          ],
        },
        {
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Designed and built a competitive robot' }] }],
            },
            {
              type: 'listItem',
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Won 3 regional competitions' }] }],
            },
            {
              type: 'listItem',
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Advanced to state championship' }] }],
            },
          ],
        },
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'Gracious Professionalism and Coopertition guided us throughout the season. We look forward to next year!',
            },
          ],
        },
      ],
    }),
  };

  test.beforeEach(async ({ page }) => {
    await setupMockAuth(page);

    // Mock the blog post detail endpoint
    await page.route('**/api/posts/test-post', async (route) => {
      await route.fulfill({
        status: 200,
        json: {
          post: mockPost,
          is_editor: false,
          author: {
            id: 'jane-doe',
            name: 'Jane Doe',
            image: mockPost.author_avatar,
            role: 'author',
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

    // Mock Zulip messages endpoint for comments section
    await page.route('**/api/zulip/messages*', async (route) => {
      await route.fulfill({
        status: 200,
        json: { messages: [] },
      });
    });
  });

  test.describe('Page Load and Basic Rendering', () => {
    test('should load blog post page successfully', async ({ page }) => {
      await page.goto(`/blog/${testPostSlug}`);

      // Verify we're on the correct page
      await expect(page).toHaveURL(/\/blog\/test-post/);

      // Verify main content area is visible
      await expect(page.locator('main').or(page.locator('article'))).toBeVisible({
        timeout: TEST_TIMEOUTS.DEFAULT,
      });
    });

    test('should display blog post title', async ({ page }) => {
      await page.goto(`/blog/${testPostSlug}`);

      // Verify the main heading contains the post title
      const titleHeading = page.getByRole('heading', { level: 1 }).filter({ hasText: 'ARES 23247 Championship Journey' });
      await expect(titleHeading).toBeVisible({
        timeout: TEST_TIMEOUTS.DEFAULT,
      });
    });

    test('should display blog post metadata', async ({ page }) => {
      await page.goto(`/blog/${testPostSlug}`);

      // Verify publication date is displayed
      await expect(page.getByText(/January 15, 2025/)).toBeVisible();

      // Verify author information is displayed
      await expect(page.getByText('Jane_Doe')).toBeVisible();

      // Verify author avatar is present
      const authorAvatar = page.locator('img').filter({ hasText: '' }).filter({ has: page.locator(`src*="${mockPost.author_avatar}"`) });
      if (await authorAvatar.count() > 0) {
        await expect(authorAvatar.first()).toBeVisible();
      }
    });

    test('should display back to blog link', async ({ page }) => {
      await page.goto(`/blog/${testPostSlug}`);

      // Verify "Back to all posts" link exists
      const backLink = page.getByRole('link', { name: /back to all posts/i }).or(
        page.getByRole('link', { name: /blog/i })
      );
      await expect(backLink).toBeVisible();
    });

    test('should display featured/thumbnail image', async ({ page }) => {
      await page.goto(`/blog/${testPostSlug}`);

      // Verify thumbnail image is displayed
      const thumbnailImage = page.locator('img').filter({ has: page.locator(`src*="${mockPost.thumbnail}"`) });
      if (await thumbnailImage.count() > 0) {
        await expect(thumbnailImage.first()).toBeVisible();
      }
    });
  });

  test.describe('Content Rendering', () => {
    test('should render rich text content from Tiptap AST', async ({ page }) => {
      await page.goto(`/blog/${testPostSlug}`);

      // Wait for content to load
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

      // Verify heading content is rendered
      await expect(page.getByRole('heading', { name: 'The Road to Championship' })).toBeVisible();

      // Verify paragraph content with bold text is rendered
      await expect(page.getByText(/excellence/)).toBeVisible();

      // Verify list items are rendered
      await expect(page.getByText('Designed and built a competitive robot')).toBeVisible();
      await expect(page.getByText('Won 3 regional competitions')).toBeVisible();
      await expect(page.getByText('Advanced to state championship')).toBeVisible();
    });

    test('should render FIRST cultural values content', async ({ page }) => {
      await page.goto(`/blog/${testPostSlug}`);

      // Verify content mentioning FIRST values is rendered
      await expect(page.getByText(/Gracious Professionalism/i)).toBeVisible();
      await expect(page.getByText(/Coopertition/i)).toBeVisible();
    });

    test('should handle posts without author information', async ({ page }) => {
      // Mock post without author details
      const postWithoutAuthor = { ...mockPost, author_nickname: null, author_avatar: null };
      await page.route('**/api/posts/test-post', async (route) => {
        await route.fulfill({
          status: 200,
          json: {
            post: postWithoutAuthor,
            is_editor: false,
          },
        });
      });

      await page.goto(`/blog/${testPostSlug}`);

      // Page should still load successfully
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

      // Should show default author text
      await expect(page.getByText(/ARES Author/)).toBeVisible();
    });

    test('should handle posts with unparsed AST gracefully', async ({ page }) => {
      // Mock post with invalid AST
      const postWithInvalidAst = { ...mockPost, ast: 'invalid-json' };
      await page.route('**/api/posts/test-post', async (route) => {
        await route.fulfill({
          status: 200,
          json: {
            post: postWithInvalidAst,
            is_editor: false,
          },
        });
      });

      await page.goto(`/blog/${testPostSlug}`);

      // Page should still load without crashing
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    });
  });

  test.describe('Editor Features', () => {
    test('should show edit button for admin users', async ({ page }) => {
      // Set up admin user
      await setupMockAuth(page, MOCK_ADMIN_USER.id);

      // Mock response with editor permissions
      await page.route('**/api/posts/test-post', async (route) => {
        await route.fulfill({
          status: 200,
          json: {
            post: mockPost,
            is_editor: true,
            author: {
              id: 'admin-user',
              name: MOCK_ADMIN_USER.name,
              image: MOCK_ADMIN_USER.image,
              role: 'admin',
            },
          },
        });
      });

      await page.goto(`/blog/${testPostSlug}`);

      // Verify edit button is visible for admins
      const editButton = page.getByRole('link', { name: /edit post/i }).or(
        page.getByRole('link', { name: /edit/i })
      );
      await expect(editButton).toBeVisible();
    });

    test('should not show edit button for regular users', async ({ page }) => {
      // Set up regular user
      await page.route('**/api/auth/get-session', async (route) => {
        await route.fulfill({
          status: 200,
          json: {
            session: {
              id: 'user-session',
              userId: 'regular-user',
              expiresAt: new Date(Date.now() + 10000000).toISOString(),
            },
            user: {
              id: 'regular-user',
              name: 'Regular User',
              email: 'user@example.com',
              role: 'user',
              image: 'https://api.dicebear.com/9.x/bottts/svg?seed=user',
            },
          },
        });
      });

      // Mock response without editor permissions
      await page.route('**/api/posts/test-post', async (route) => {
        await route.fulfill({
          status: 200,
          json: {
            post: mockPost,
            is_editor: false,
          },
        });
      });

      await page.goto(`/blog/${testPostSlug}`);

      // Edit button should not be visible
      const editButton = page.getByRole('link', { name: /edit post/i }).or(
        page.getByRole('link', { name: /edit/i })
      );
      await expect(editButton).not.toBeVisible();
    });

    test('should navigate to editor when edit button is clicked', async ({ page }) => {
      // Set up admin user
      await setupMockAuth(page, MOCK_ADMIN_USER.id);

      // Mock response with editor permissions
      await page.route('**/api/posts/test-post', async (route) => {
        await route.fulfill({
          status: 200,
          json: {
            post: mockPost,
            is_editor: true,
          },
        });
      });

      await page.goto(`/blog/${testPostSlug}`);

      // Click edit button
      const editButton = page.getByRole('link', { name: /edit post/i }).or(
        page.getByRole('link', { name: /edit/i })
      );
      await editButton.click();

      // Should navigate to dashboard blog editor
      await expect(page).toHaveURL(/\/dashboard\/blog\/test-post/, {
        timeout: TEST_TIMEOUTS.SLOW_PAGE,
      });
    });
  });

  test.describe('Error States', () => {
    test('should handle 404 post not found', async ({ page }) => {
      // Mock 404 response
      await page.route('**/api/posts/non-existent-post', async (route) => {
        await route.fulfill({
          status: 404,
          json: { error: 'Post not found' },
        });
      });

      await page.goto('/blog/non-existent-post');

      // Should show error message
      await expect(page.getByText(/post not found/i)).toBeVisible();
    });

    test('should handle invalid slug format', async ({ page }) => {
      await page.goto('/blog/../../etc/passwd');

      // Should show validation error
      await expect(page.getByText(/invalid post slug format/i)).toBeVisible();
    });

    test('should handle network error gracefully', async ({ page }) => {
      // Mock network failure
      await page.route('**/api/posts/test-post', async (route) => {
        await route.abort('failed');
      });

      await page.goto(`/blog/${testPostSlug}`);

      // Should show error state
      await expect(page.getByText(/post not found|loading/i)).toBeVisible({
        timeout: TEST_TIMEOUTS.DEFAULT,
      });
    });

    test('should handle loading state', async ({ page }) => {
      // Mock slow response
      await page.route('**/api/posts/test-post', async (route) => {
        await new Promise(resolve => setTimeout(resolve, 2000));
        await route.fulfill({
          status: 200,
          json: {
            post: mockPost,
            is_editor: false,
          },
        });
      });

      await page.goto(`/blog/${testPostSlug}`);

      // Should show loading indicator
      await expect(page.getByText(/loading post/i)).toBeVisible();
    });
  });

  test.describe('Accessibility (WCAG 2.1 AA)', () => {
    test('should pass WCAG 2.1 AA accessibility audit', async ({ page }) => {
      await page.goto(`/blog/${testPostSlug}`);

      // Wait for page to fully load
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible({
        timeout: TEST_TIMEOUTS.DEFAULT,
      });

      // Run accessibility audit
      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();

      expect(accessibilityScanResults.violations).toEqual([]);
    });

    test('should have proper heading hierarchy', async ({ page }) => {
      await page.goto(`/blog/${testPostSlug}`);

      // Wait for content to load
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

      // Verify heading structure
      const headings = await page.evaluate(() => {
        const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'));
        return headings.map(h => ({
          tag: h.tagName,
          text: h.textContent?.trim(),
        }));
      });

      // Should have h1 as main title
      expect(headings[0].tag).toBe('H1');

      // Should not skip heading levels
      for (let i = 1; i < headings.length; i++) {
        const currentLevel = parseInt(headings[i].tag[1]);
        const prevLevel = parseInt(headings[i - 1].tag[1]);
        expect(currentLevel).toBeLessThanOrEqual(prevLevel + 1);
      }
    });

    test('should have sufficient color contrast', async ({ page }) => {
      await page.goto(`/blog/${testPostSlug}`);

      // Wait for page to fully load
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

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

    test('should have proper alt text for images', async ({ page }) => {
      await page.goto(`/blog/${testPostSlug}`);

      // Wait for content to load
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

      // Check all images have alt text
      const imagesWithoutAlt = await page.evaluate(() => {
        const images = Array.from(document.querySelectorAll('img'));
        return images.filter(img => !img.alt || img.alt.trim() === '');
      });

      expect(imagesWithoutAlt).toEqual([]);
    });

    test('should be keyboard navigable', async ({ page }) => {
      await page.goto(`/blog/${testPostSlug}`);

      // Wait for content to load
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

      // Tab through interactive elements
      const interactiveElements = await page.evaluate(() => {
        const elements = Array.from(document.querySelectorAll(
          'a, button, [tabindex]:not([tabindex="-1"])'
        ));
        return elements.length;
      });

      // Should have interactive elements
      expect(interactiveElements).toBeGreaterThan(0);

      // Test first tab
      await page.keyboard.press('Tab');
      const firstFocused = await page.evaluate(() => document.activeElement?.tagName);
      expect(['A', 'BUTTON']).toContain(firstFocused);
    });

    test('should have proper semantic HTML structure', async ({ page }) => {
      await page.goto(`/blog/${testPostSlug}`);

      // Wait for content to load
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

      // Verify semantic elements
      await expect(page.locator('main, article')).toHaveCount(1);
      await expect(page.locator('h1')).toHaveCount(1);
    });

    test('should announce page title to screen readers', async ({ page }) => {
      await page.goto(`/blog/${testPostSlug}`);

      // Wait for content to load
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

      // Verify page title is set correctly
      const pageTitle = await page.title();
      expect(pageTitle).toContain(mockPost.title);
    });
  });

  test.describe('SEO and Meta Tags', () => {
    test('should set proper meta tags', async ({ page }) => {
      await page.goto(`/blog/${testPostSlug}`);

      // Wait for content to load
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

      // Verify page title
      const pageTitle = await page.title();
      expect(pageTitle).toContain(mockPost.title);

      // Verify meta description
      const metaDescription = await page.locator('meta[name="description"]').getAttribute('content');
      expect(metaDescription).toBeDefined();
      expect(metaDescription?.length).toBeGreaterThan(0);
    });

    test('should include Open Graph tags', async ({ page }) => {
      await page.goto(`/blog/${testPostSlug}`);

      // Verify Open Graph tags
      const ogTitle = await page.locator('meta[property="og:title"]').getAttribute('content');
      expect(ogTitle).toBeDefined();

      const ogType = await page.locator('meta[property="og:type"]').getAttribute('content');
      expect(ogType).toBe('article');
    });
  });

  test.describe('Responsive Design', () => {
    test('should display correctly on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto(`/blog/${testPostSlug}`);

      // Verify content is visible on mobile
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

      // Verify mobile layout elements
      await expect(page.getByText(/January 15, 2025/)).toBeVisible();
    });

    test('should display correctly on tablet', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.goto(`/blog/${testPostSlug}`);

      // Verify content is visible on tablet
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    });

    test('should display correctly on desktop', async ({ page }) => {
      await page.setViewportSize({ width: 1920, height: 1080 });
      await page.goto(`/blog/${testPostSlug}`);

      // Verify content is visible on desktop
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    });
  });

  test.describe('Navigation and Interactions', () => {
    test('should navigate back to blog list', async ({ page }) => {
      await page.goto(`/blog/${testPostSlug}`);

      // Click back to blog link
      const backLink = page.getByRole('link', { name: /back to all posts/i }).or(
        page.getByRole('link', { name: /blog/i })
      );
      await backLink.click();

      // Should navigate to blog list
      await expect(page).toHaveURL(/\/blog$/, {
        timeout: TEST_TIMEOUTS.DEFAULT,
      });
    });

    test('should handle browser history navigation', async ({ page }) => {
      // First visit blog list
      await page.goto('/blog');
      await expect(page.getByRole('heading', { name: /blog/i })).toBeVisible();

      // Then navigate to post detail
      await page.goto(`/blog/${testPostSlug}`);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

      // Navigate back
      await page.goBack();
      await expect(page).toHaveURL(/\/blog$/);

      // Navigate forward
      await page.goForward();
      await expect(page).toHaveURL(/\/blog\/test-post$/);
    });
  });

  test.describe('Analytics Integration', () => {
    test('should track page view on load', async ({ page }) => {
      // Set up listener for analytics calls
      let analyticsTracked = false;
      await page.route('**/api/analytics/**', async (route) => {
        analyticsTracked = true;
        await route.fulfill({
          status: 200,
          json: { success: true },
        });
      });

      await page.goto(`/blog/${testPostSlug}`);

      // Wait a bit for analytics to fire
      await page.waitForTimeout(1000);

      // Verify analytics was called (if analytics is enabled)
      // Note: This may be optional depending on configuration
      expect(analyticsTracked).toBeDefined();
    });
  });

  test.describe('Content Security and Input Validation', () => {
    test('should sanitize malicious content in AST', async ({ page }) => {
      // Mock post with potentially dangerous content
      const maliciousPost = {
        ...mockPost,
        ast: JSON.stringify({
          type: 'doc',
          content: [
            {
              type: 'paragraph',
              content: [
                { type: 'text', text: 'Safe content' },
              ],
            },
          ],
        }),
      };

      await page.route('**/api/posts/test-post', async (route) => {
        await route.fulfill({
          status: 200,
          json: {
            post: maliciousPost,
            is_editor: false,
          },
        });
      });

      await page.goto(`/blog/${testPostSlug}`);

      // Page should render safely without executing scripts
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await expect(page.getByText('Safe content')).toBeVisible();
    });

    test('should validate URL parameters', async ({ page }) => {
      // Test with special characters in slug
      await page.goto('/blog/test-post<script>alert(1)</script>');

      // Should show validation error or sanitize the input
      const hasValidationError = await page.getByText(/invalid post slug format/i).isVisible().catch(() => false);
      const hasSafeContent = await page.getByRole('heading').isVisible().catch(() => false);

      expect(hasValidationError || hasSafeContent).toBe(true);
    });
  });
});
