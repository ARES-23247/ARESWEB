import { Page } from "@playwright/test";
/**
 * Mock admin user for E2E tests.
 */
export const MOCK_ADMIN_USER = {
  id: 'admin-user',
  name: 'Admin User',
  email: 'admin@ares.org',
  role: 'admin',
  image: 'https://api.dicebear.com/9.x/bottts/svg?seed=admin',
} as const;

/**
 * Mock session data for E2E tests.
 */
export const createMockSession = (userId: string = MOCK_ADMIN_USER.id) => ({
  session: {
    id: 'mockup-session-id',
    userId,
    expiresAt: new Date(Date.now() + 10000000).toISOString(),
    ipAddress: '127.0.0.1',
    userAgent: 'Playwright',
  },
  user: {
    id: userId,
    name: MOCK_ADMIN_USER.name,
    email: MOCK_ADMIN_USER.email,
    emailVerified: true,
    image: MOCK_ADMIN_USER.image,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    role: MOCK_ADMIN_USER.role,
    banned: false,
  },
});

/**
 * Mock profile data for E2E tests.
 */
export const createMockProfile = (userId: string = MOCK_ADMIN_USER.id) => ({
  user_id: userId,
  nickname: MOCK_ADMIN_USER.name,
  first_name: 'Admin',
  last_name: 'User',
  member_type: 'mentor',
  auth: {
    id: userId,
    email: MOCK_ADMIN_USER.email,
    name: MOCK_ADMIN_USER.name,
    image: MOCK_ADMIN_USER.image,
    role: MOCK_ADMIN_USER.role,
  },
});

/**
 * Sets up mocked authentication for a Playwright page.
 * This eliminates the ~60 lines of duplicated auth mocking across test files.
 *
 * @param page - Playwright page object
 * @param userId - Optional user ID override (defaults to admin-user)
 */
export async function setupMockAuth(
  page: Page,
  userId: string = MOCK_ADMIN_USER.id,
): Promise<void> {
  // Mock /api/auth/get-session endpoint
  await page.route('**/api/auth/get-session', async (route) => {
    await route.fulfill({
      status: 200,
      json: createMockSession(userId),
    });
  });

  // Mock /profile/me endpoint
  await page.route('**/profile/me', async (route) => {
    await route.fulfill({
      status: 200,
      json: createMockProfile(userId),
    });
  });

  // Set auth cookie
  await page.context().addCookies([
    {
      name: 'better-auth.session_token',
      value: 'mockup-session-id',
      domain: 'localhost',
      path: '/',
    },
  ]);

  // Set flag to bypass client-side checks
  await page.addInitScript(() => {
    Object.assign(window, { __PLAYWRIGHT_TEST__: true });
  });
}

/**
 * Filter function for benign console errors that should not fail tests.
 *
 * @param text - Console message text
 * @returns true if the error should be ignored
 */
export function shouldIgnoreConsoleError(text: string): boolean {
  const ignorePatterns = [
    'favicon',
    '400',
    '401',
    '404',
    '429',
    '500',
    '502',
    '504',
    'ERR_CONNECTION_REFUSED',
    'ERR_CONNECTION_TIMED_OUT',
    'ERR_NAME_NOT_RESOLVED',
    'queryKey needs to be an Array',
    'uncontrolled input',
  ];
  return ignorePatterns.some((pattern) => text.includes(pattern));
}
