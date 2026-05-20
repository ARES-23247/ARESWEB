/**
 * Augmentations to the global Window interface for test mode detection.
 * These properties are set by Playwright tests and should not be accessed in production.
 */
export {};

declare global {
  interface Window {
    /**
     * Set to true during Playwright test execution to bypass certain real-time features.
     * @defaultValue undefined (not set in production)
     */
    readonly __PLAYWRIGHT_TEST__?: true;
    __TEST_PARTYKIT_HOST__?: string;
  }
}
