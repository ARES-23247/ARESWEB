import { Page, Route } from '@playwright/test';
import { isRemoteTesting } from './auth';

/**
 * Options for conditional API mocking.
 */
interface ConditionalMockOptions {
  /** Force mocking even in remote mode */
  forceMock?: boolean;
  /** Custom response handler */
  handler?: (route: Route) => Promise<void> | void;
}

/**
 * Conditionally mock an API route based on testing mode.
 * In local testing, mocks are applied. In remote mode (PREVIEW_URL set),
 * mocking is skipped unless forceMock is true.
 *
 * @example
 * ```ts
 * await setupConditionalMock(page, '**/api/simulations', async (route) => {
 *   if (route.request().method() === 'GET') {
 *     await route.fulfill({ json: { simulations: [] } });
 *   }
 * });
 * ```
 */
export async function setupConditionalMock(
  page: Page,
  pattern: string | RegExp,
  optionsOrHandler: ConditionalMockOptions | ((route: Route) => Promise<void> | void),
): Promise<void> {
  // Normalize arguments
  const options: ConditionalMockOptions = typeof optionsOrHandler === 'function'
    ? { handler: optionsOrHandler }
    : optionsOrHandler;

  const { forceMock = false, handler } = options;

  // Skip mocking if in remote mode and not forced
  if (isRemoteTesting() && !forceMock) {
    return;
  }

  // Set up the mock
  await page.route(pattern, handler || (() => Promise.resolve()));
}

/**
 * Helper to conditionally mock multiple API routes.
 * Useful for setting up all mocks in a beforeEach hook.
 *
 * @example
 * ```ts
 * await setupConditionalMocks(page, {
 *   '**/api/simulations': async (route) => {
 *     await route.fulfill({ json: { simulations: MOCK_SIMULATIONS } });
 *   },
 *   '**/api/tasks': async (route) => {
 *     await route.fulfill({ json: { tasks: [] } });
 *   },
 * });
 * ```
 */
export async function setupConditionalMocks(
  page: Page,
  mocks: Record<string, (route: Route) => Promise<void> | void>,
  forceMock = false,
): Promise<void> {
  for (const [pattern, handler] of Object.entries(mocks)) {
    await setupConditionalMock(page, pattern, { forceMock, handler });
  }
}

/**
 * Determines if the current test should use real API calls.
 * Alias for !isRemoteTesting() for more readable test code.
 */
export function shouldUseRealApi(): boolean {
  return isRemoteTesting();
}
