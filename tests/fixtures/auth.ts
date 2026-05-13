import { Page } from "@playwright/test";

/**
 * Detects if tests are running against a deployed remote environment.
 * Checks for PREVIEW_URL environment variable or CI flag.
 */
export function isRemoteTesting(): boolean {
  return !!process.env.PREVIEW_URL || process.env.CI === 'true';
}

/**
 * Get the base URL for testing, handling both local and remote environments.
 */
export function getBaseUrl(): string {
  const previewUrl = process.env.PREVIEW_URL;
  if (previewUrl) {
    // Remove trailing slash for consistency
    return previewUrl.endsWith('/') ? previewUrl.slice(0, -1) : previewUrl;
  }
  return 'http://127.0.0.1:8788';
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
 * NOTE: The API returns camelCase property names (firstName, lastName) to match
 * the Drizzle ORM schema, even though the database columns are snake_case.
 */
export const createMockProfile = (userId: string = MOCK_ADMIN_USER.id) => ({
  userId,
  nickname: MOCK_ADMIN_USER.name,
  firstName: 'Admin',
  lastName: 'User',
  memberType: 'mentor',
  auth: {
    id: userId,
    email: MOCK_ADMIN_USER.email,
    name: MOCK_ADMIN_USER.name,
    image: MOCK_ADMIN_USER.image,
    role: MOCK_ADMIN_USER.role,
  },
  bio: '',
  pronouns: '',
  favoriteFood: '',
  funFact: '',
  showEmail: 0,
  showPhone: 0,
  showOnAbout: 1,
  subteams: '[]',
  dietaryRestrictions: '[]',
  colleges: '[]',
  employers: '[]',
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
 * NOTE: Mock auth works for both local and remote testing. Playwright's route()
 * intercepts network requests before they leave the browser, so it works with
 * deployed URLs too. This avoids D1 database bottlenecks when multiple test
 * shards run in parallel.
 *
 * To use real auth (e.g., testing actual session creation), set useRealAuth: true.
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
  // Default to mock auth even in remote mode to avoid D1 bottlenecks
  const useRealAuth = typeof options === 'string' ? false : (options.useRealAuth ?? false);
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

  // Mock /profile/me and /profiles/me endpoints (unless skipped)
  // The API uses /api/profile/me (singular), so we need to match both patterns
  if (!skipProfileMock) {
    // Match both /api/profile/me and /api/profiles/me for compatibility
    await page.route('**/api/profile/me', async (route) => {
      await route.fulfill({
        status: 200,
        json: createMockProfile(userId),
      });
    });
    await page.route('**/api/profiles/me', async (route) => {
      await route.fulfill({
        status: 200,
        json: createMockProfile(userId),
      });
    });
  }

  // Set auth cookie with dynamic url for both local and remote testing
  const baseUrl = getBaseUrl();
  const isSecure = baseUrl.startsWith('https://');
  const cookieName = isSecure ? '__Secure-better-auth.session_token' : 'better-auth.session_token';

  // Use url for cookies (works for both localhost and remote domains)
  await page.context().addCookies([
    {
      name: cookieName,
      value: 'mockup-session-id',
      url: baseUrl,
      httpOnly: true,
      sameSite: 'Lax' as const,
      secure: isSecure,
    },
  ]);
}

/**
 * Sets up real authentication by calling the test-login endpoint.
 * This creates a real session in the database and sets the auth cookie.
 *
 * NOTE: This is now opt-in via useRealAuth option. Default is to use mock auth.
 *
 * @param page - Playwright page object
 * @param userId - User ID to authenticate as
 * @param role - User role (for looking up seeded test users)
 */
async function setupRealAuth(page: Page, userId: string, role?: string): Promise<void> {
  const baseUrl = getBaseUrl();
  const testLoginUrl = `${baseUrl}/api/auth/test-login`;

  try {
    // Map role to test user ID if specified
    let testUserId = userId;
    if (role === 'author') {
      testUserId = 'test-user-author'; // Should exist in seeded data
    }

    // Call test-login endpoint to get session, with retry for 502s/500s
    // Use exponential backoff to handle concurrent requests from parallel test shards
    let response;
    const maxAttempts = 8; // Increased from 5 to handle more concurrent load
    for (let attempts = 0; attempts < maxAttempts; attempts++) {
      try {
        response = await page.context().request.post(testLoginUrl, {
          headers: {
            'x-test-bypass-auth': 'true', // Enable test mode
          },
          data: { userId: testUserId },
          timeout: 30000, // 30s timeout
        });
      } catch (err) {
        // Network errors (ECONNRESET, ETIMEDOUT, etc.) - retry with backoff
        if (attempts < maxAttempts - 1) {
          const delay = Math.min(1000 * Math.pow(2, attempts), 10000); // Exponential backoff, max 10s
          console.log(`[Auth] Network error to ${testLoginUrl}, retrying in ${delay}ms (attempt ${attempts + 1}/${maxAttempts})...`, err);
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
        throw new Error(`Test login failed after ${maxAttempts} attempts: ${err instanceof Error ? err.message : String(err)}`, { cause: err });
      }

      if (response.ok()) break;

      // Retry on server errors with exponential backoff
      if (response.status() >= 500 || response.status() === 429) {
        const delay = Math.min(1000 * Math.pow(2, attempts), 10000); // Exponential backoff, max 10s
        const retryReason = response.status() === 502 ? 'backend booting' :
                           response.status() === 429 ? 'rate limited' :
                           'transient DB error';
        console.log(`[Auth] Got ${response.status()} from ${testLoginUrl} (${retryReason}), retrying in ${delay}ms (attempt ${attempts + 1}/${maxAttempts})...`);
        await new Promise(r => setTimeout(r, delay));
      } else {
        // Don't retry on client errors (4xx except 429)
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(`Test login failed: ${response.status()} ${errorText}`);
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
    const isSecure = baseUrl.startsWith('https://');
    const cookieName = isSecure ? '__Secure-better-auth.session_token' : 'better-auth.session_token';

    await page.context().addCookies([
      {
        name: cookieName,
        value: data.sessionToken,
        url: baseUrl,
        httpOnly: true,
        sameSite: 'Lax' as const,
        secure: isSecure,
      },
    ]);

    // Set real auth flag
    await page.addInitScript(() => {
      Object.assign(window, { __REAL_AUTH__: true });
    });

    // Verify the cookie was accepted by calling get-session
    const verifyResponse = await page.context().request.get(`${baseUrl}/api/auth/get-session`);
    const verifyData = await verifyResponse.json().catch(() => null) as Record<string, unknown> | null;
    const hasSession = verifyData && 'session' in verifyData && verifyData.session !== null;

    if (!hasSession) {
      console.error(`[Auth] Cookie verification FAILED! get-session returned:`, JSON.stringify(verifyData).slice(0, 200));
      console.error(`[Auth] Cookie details: name=${cookieName}, url=${baseUrl}, secure=${isSecure}`);
      console.error(`[Auth] Token preview: ${data.sessionToken.slice(0, 40)}...`);
      throw new Error(`Auth cookie not accepted by server. Cookie: ${cookieName}, URL: ${baseUrl}`);
    }

    console.log(`[Auth] Real auth setup for user: ${data.user.email} (${data.user.role}) [verified]`);
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
    'Content Security Policy',
    'cloudflareinsights',
    'TrustedHTML',
    'TrustedScript',
    'TrustedScriptURL',
    'Permissions policy violation',
    'Unauthorized: Please log in',
    'xr-spatial-tracking',
    // Benign CSS console logging from chart/visualization libraries
    'font-size:0;color:transparent NaN',
    // TanStack Query retry errors (harmless in E2E tests)
    '[Query Error] Too many requests',
    'Too many requests. Please try again later',
    // QUIC protocol errors (transient network errors from Chrome's QUIC implementation)
    'ERR_QUIC_PROTOCOL_ERROR',
  ];
  return ignorePatterns.some((pattern) => text.includes(pattern));
}
