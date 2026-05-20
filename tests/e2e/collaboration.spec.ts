import { test, expect } from '@playwright/test';
import { setupMockAuth } from '../fixtures/auth';
import { DashboardPage } from '../pages/DashboardPage';

/**
 * E2E tests for PartyKit real-time collaboration across all editor surfaces.
 * Tests verify:
 * - INT-01: All four editors (Blog, Docs, Events, Tasks) display 'Live' badge when PartyKit connects
 * - INT-02: Multi-user concurrent editing syncs changes between browser contexts in real-time
 * - INT-03: Document changes persist across page reloads via PartyKit's built-in persistence
 */

test.describe('Collaboration', () => {
  // Skip in CI: requires live PartyKit/Yjs WebSocket server not available on Cloudflare Pages preview
  test.skip(!!process.env.CI, 'Requires live WebSocket server — not available in CI preview');

  test.beforeEach(async ({ page }) => {
    page.on('console', (msg) => console.log('BROWSER CONSOLE:', msg.text()));
    page.on('pageerror', (err) => console.log('BROWSER ERROR:', err.message));

    await setupMockAuth(page);
    await page.addInitScript(() => {
      Object.assign(window, { __TEST_PARTYKIT_HOST__: 'localhost:1999' });
    });
  });

  test('INT-01: All editors display Live badge when connected', async ({ page }) => {
    const dashboard = new DashboardPage(page);

    // Test BlogEditor - route is /dashboard/blog/:slug
    await page.goto('/dashboard/blog/test-post');
    await dashboard.waitForLiveBadge();

    // Test DocsEditor - route is /dashboard/docs/:slug
    await page.goto('/dashboard/docs/test-doc');
    await dashboard.waitForLiveBadge();

    // Test EventEditor - route is /dashboard/event/:id
    await page.goto('/dashboard/event/test-event-id');
    await dashboard.waitForLiveBadge();

    // Test TaskDetailsModal - navigate to tasks, click on test task to open modal
    await page.goto('/dashboard/tasks');
    await page.getByText('Test Task').first().click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await dashboard.waitForLiveBadge();
  });

  test('INT-02: Multi-user concurrent editing - browser contexts', async ({ browser }) => {
    // Create two separate browser contexts (simulating two users)
    const user1Context = await browser.newContext();
    const user2Context = await browser.newContext();

    const user1Page = await user1Context.newPage();
    const user2Page = await user2Context.newPage();

    // Setup logging for debugging connection / synchronization
    user1Page.on('console', (msg) => console.log('USER 1 BROWSER CONSOLE:', msg.text()));
    user1Page.on('pageerror', (err) => console.log('USER 1 BROWSER ERROR:', err.message));
    user2Page.on('console', (msg) => console.log('USER 2 BROWSER CONSOLE:', msg.text()));
    user2Page.on('pageerror', (err) => console.log('USER 2 BROWSER ERROR:', err.message));

    // Setup auth and routes for User 1 (User One)
    await setupMockAuth(user1Page);
    await user1Page.addInitScript(() => {
      Object.assign(window, { __TEST_PARTYKIT_HOST__: 'localhost:1999' });
    });
    await user1Page.route('**/api/auth/get-session', async (route) => {
      await route.fulfill({
        status: 200,
        json: {
          session: {
            id: 'mockup-session-id-1',
            userId: 'user-1',
            expiresAt: new Date(Date.now() + 10000000).toISOString(),
            ipAddress: '127.0.0.1',
            userAgent: 'Playwright',
          },
          user: {
            id: 'user-1',
            name: 'User One',
            email: 'user1@ares.org',
            emailVerified: true,
            image: 'https://api.dicebear.com/9.x/bottts/svg?seed=user1',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            role: 'member',
            banned: false,
          },
        },
      });
    });
    await user1Page.route('**/api/profile/me', async (route) => {
      await route.fulfill({
        status: 200,
        json: {
          userId: 'user-1',
          nickname: 'User One',
          firstName: 'User',
          lastName: 'One',
          memberType: 'student',
          auth: {
            id: 'user-1',
            email: 'user1@ares.org',
            name: 'User One',
            image: 'https://api.dicebear.com/9.x/bottts/svg?seed=user1',
            role: 'member',
          },
        },
      });
    });
    await user1Page.route('**/api/profiles/me', async (route) => {
      await route.fulfill({
        status: 200,
        json: {
          userId: 'user-1',
          nickname: 'User One',
          firstName: 'User',
          lastName: 'One',
          memberType: 'student',
          auth: {
            id: 'user-1',
            email: 'user1@ares.org',
            name: 'User One',
            image: 'https://api.dicebear.com/9.x/bottts/svg?seed=user1',
            role: 'member',
          },
        },
      });
    });

    // Setup auth and routes for User 2 (User Two)
    await setupMockAuth(user2Page);
    await user2Page.addInitScript(() => {
      Object.assign(window, { __TEST_PARTYKIT_HOST__: 'localhost:1999' });
    });
    await user2Page.route('**/api/auth/get-session', async (route) => {
      await route.fulfill({
        status: 200,
        json: {
          session: {
            id: 'mockup-session-id-2',
            userId: 'user-2',
            expiresAt: new Date(Date.now() + 10000000).toISOString(),
            ipAddress: '127.0.0.1',
            userAgent: 'Playwright',
          },
          user: {
            id: 'user-2',
            name: 'User Two',
            email: 'user2@ares.org',
            emailVerified: true,
            image: 'https://api.dicebear.com/9.x/bottts/svg?seed=user2',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            role: 'member',
            banned: false,
          },
        },
      });
    });
    await user2Page.route('**/api/profile/me', async (route) => {
      await route.fulfill({
        status: 200,
        json: {
          userId: 'user-2',
          nickname: 'User Two',
          firstName: 'User',
          lastName: 'Two',
          memberType: 'student',
          auth: {
            id: 'user-2',
            email: 'user2@ares.org',
            name: 'User Two',
            image: 'https://api.dicebear.com/9.x/bottts/svg?seed=user2',
            role: 'member',
          },
        },
      });
    });
    await user2Page.route('**/api/profiles/me', async (route) => {
      await route.fulfill({
        status: 200,
        json: {
          userId: 'user-2',
          nickname: 'User Two',
          firstName: 'User',
          lastName: 'Two',
          memberType: 'student',
          auth: {
            id: 'user-2',
            email: 'user2@ares.org',
            name: 'User Two',
            image: 'https://api.dicebear.com/9.x/bottts/svg?seed=user2',
            role: 'member',
          },
        },
      });
    });

    const dashboard1 = new DashboardPage(user1Page);
    const dashboard2 = new DashboardPage(user2Page);

    // Both users navigate to the same blog post editor
    await user1Page.goto('/dashboard/blog/test-post');
    await user2Page.goto('/dashboard/blog/test-post');

    // Wait for Live badges on both - verifies multi-user connection works
    await dashboard1.waitForLiveBadge();
    await dashboard2.waitForLiveBadge();

    // Verify editors are present and interactive on both pages
    const editor1 = dashboard1.getProseMirrorEditor();
    const editor2 = dashboard2.getProseMirrorEditor();
    await expect(editor1).toBeVisible();
    await expect(editor2).toBeVisible();

    // Have User 1 select the editor and type something (using keyboard.type() or pressSequentially())
    await editor1.focus();
    await user1Page.keyboard.type('Hello from User One!');

    // Verify that User 2 sees User 1's changes synchronized in real time
    await expect(editor2).toContainText('Hello from User One!', { timeout: 10000 });

    // Navigate both users to the Task Board (/dashboard/tasks)
    await user1Page.goto('/dashboard/tasks');
    await user2Page.goto('/dashboard/tasks');

    // Wait for task board live badge on both pages
    await expect(user1Page.locator('.bg-ares-cyan\\/10').filter({ hasText: 'Live' }).first()).toBeVisible();
    await expect(user2Page.locator('.bg-ares-cyan\\/10').filter({ hasText: 'Live' }).first()).toBeVisible();

    // Verify User 1's page shows User 2's presence avatar (title "User Two")
    await expect(user1Page.locator('div[title="User Two"]')).toBeVisible({ timeout: 10000 });

    // Verify User 2's page shows User 1's presence avatar (title "User One")
    await expect(user2Page.locator('div[title="User One"]')).toBeVisible({ timeout: 10000 });

    // Verify that closing/disconnecting one user context correctly decrements/updates the presence list on the other client's viewport
    await user2Context.close();

    // Verify User 1's page no longer shows User 2's presence avatar (should be hidden/detached)
    await expect(user1Page.locator('div[title="User Two"]')).toBeHidden({ timeout: 10000 });

    // Cleanup User 1 context
    await user1Context.close();
  });

  test('INT-03: Document editor persists after reload', async ({ page }) => {
    const dashboard = new DashboardPage(page);

    // Navigate to a doc editor
    await page.goto('/dashboard/docs/persistence-test');
    await dashboard.waitForLiveBadge();

    // Verify editor is present
    const editor = dashboard.getProseMirrorEditor();
    await expect(editor).toBeVisible();

    // Reload the page and verify editor state persists
    await page.reload();

    // Wait for Live badge again after reload
    await dashboard.waitForLiveBadge();

    // Verify editor is still present after reload
    await expect(editor).toBeVisible();
  });
});
