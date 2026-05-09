import { Page } from "@playwright/test";

/**
 * Detects if tests are running against a deployed remote environment.
 * Checks for PREVIEW_URL environment variable or CI flag.
 */
export function isRemoteTesting(): boolean {
  return !!process.env.PREVIEW_URL || process.env.CI === 'true';
}

/**
 * Test credentials for real authentication in remote testing mode.
 * These credentials should exist in the seeded database.
 */
export const TEST_CREDENTIALS = {
  email: 'admin@ares.org',
  password: 'test-password-123', // This would need to be set for the test user
  // For now, we'll rely on Cloudflare Access or skip auth in remote mode
} as const;

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

interface SetupMockAuthOptions {
  userId?: string;
  skipProfileMock?: boolean;
  /** Use real authentication instead of mocking (for remote testing) */
  useRealAuth?: boolean;
  /** User role to authenticate as (for real auth) */
  role?: string;
}

/**
 * Sets up mocked authentication for a Playwright page.
 * This eliminates the ~60 lines of duplicated auth mocking across test files.
 *
 * When useRealAuth is true (or in remote testing mode), calls the test-login
 * endpoint to get a real session token from the deployed backend.
 *
 * @param page - Playwright page object
 * @param options - Configuration options
 */
export async function setupMockAuth(
  page: Page,
  options: string | SetupMockAuthOptions = {},
): Promise<void> {
  // Support legacy signature where second arg was userId string
  const userId = typeof options === 'string' ? options : options.userId ?? MOCK_ADMIN_USER.id;
  const skipProfileMock = typeof options === 'string' ? false : options.skipProfileMock ?? false;
  const useRealAuth = typeof options === 'string' ? false : (options.useRealAuth ?? isRemoteTesting());
  const role = typeof options === 'string' ? undefined : options.role;

  // Set test flag
  await page.addInitScript(() => {
    Object.assign(window, { __PLAYWRIGHT_TEST__: true });
  });

  // If using real auth, call test-login endpoint
  if (useRealAuth) {
    await setupRealAuth(page, userId, role);
    return;
  }

  // Mock /api/auth/get-session endpoint
  await page.route('**/api/auth/get-session', async (route) => {
    await route.fulfill({
      status: 200,
      json: createMockSession(userId),
    });
  });

  // Mock /profile/me endpoint (unless skipped)
  if (!skipProfileMock) {
    await page.route('**/profile/me', async (route) => {
      await route.fulfill({
        status: 200,
        json: createMockProfile(userId),
      });
    });
  }

  // Set auth cookie
  await page.context().addCookies([
    {
      name: 'better-auth.session_token',
      value: 'mockup-session-id',
      domain: 'localhost',
      path: '/',
    },
  ]);
}

/**
 * Sets up real authentication by calling the test-login endpoint.
 * This creates a real session in the database and sets the auth cookie.
 *
 * @param page - Playwright page object
 * @param userId - User ID to authenticate as
 * @param role - User role (for looking up seeded test users)
 */
async function setupRealAuth(page: Page, userId: string, role?: string): Promise<void> {
  const baseUrlStr = process.env.PREVIEW_URL || (process.env.CI ? 'http://127.0.0.1:8788' : 'http://localhost:5173');
  // Ensure we don't have double slashes like https://foo.pages.dev//api/auth
  const baseUrl = baseUrlStr.endsWith('/') ? baseUrlStr.slice(0, -1) : baseUrlStr;
  const testLoginUrl = `${baseUrl}/api/auth/test-login`;

  try {
    // Map role to test user ID if specified
    let testUserId = userId;
    if (role === 'author') {
      testUserId = 'test-user-author'; // Should exist in seeded data
    }

    // Call test-login endpoint to get session, with retry for 502s during dev server boot
    let response;
    for (let attempts = 0; attempts < 5; attempts++) {
      response = await page.context().request.post(testLoginUrl, {
        headers: {
          'x-test-bypass-auth': 'true', // Enable test mode
        },
        data: { userId: testUserId },
      });

      if (response.ok()) break;
      
      if (response.status() === 502) {
        console.log(`[Auth] Got 502 from ${testLoginUrl}, waiting for backend to finish booting (attempt ${attempts + 1}/5)...`);
        await new Promise(r => setTimeout(r, 2000));
      } else {
        throw new Error(`Test login failed: ${response.status()} ${await response.text()}`);
      }
    }

    if (!response || !response.ok()) {
      throw new Error(`Test login failed permanently: ${response?.status()}`);
    }

    const data = await response.json() as {
      success: boolean;
      user: { id: string; name: string; email: string; role: string };
      sessionToken: string;
    };

    if (!data.success || !data.sessionToken) {
      throw new Error('Test login did not return session token');
    }

    // Set the session cookie from the response
    const urlObj = new URL(baseUrl);
    const cookieDomain = urlObj.hostname;
    const isSecure = baseUrl.startsWith('https://');

    await page.context().addCookies([
      {
        name: isSecure ? '__Secure-better-auth.session_token' : 'better-auth.session_token',
        value: data.sessionToken,
        domain: cookieDomain || (baseUrl.match(/:\/\/([^/]+)/)?.[1] || 'localhost'),
        path: '/',
        httpOnly: true,
        sameSite: 'Lax' as const,
        secure: isSecure,
      },
    ]);

    // Set real auth flag
    await page.addInitScript(() => {
      Object.assign(window, { __REAL_AUTH__: true });
    });

    console.log(`[Auth] Real auth setup for user: ${data.user.email} (${data.user.role})`);
  } catch (error) {
    console.error('[Auth] Failed to set up real auth:', error);
    throw error;
  }
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
