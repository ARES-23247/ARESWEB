import { test as base } from '@playwright/test';

export const test = base.extend({
  page: async ({ page }, use) => {
    const pageErrors: Error[] = [];

    page.on('pageerror', (err) => {
      pageErrors.push(err);
      // Attempt to fail the test immediately
      throw new Error(`Page Error: ${err.message}\nStack:\n${err.stack || 'No stack trace available'}`);
    });

    await use(page);

    // Fail the test at the end if any page errors occurred during execution
    if (pageErrors.length > 0) {
      const errorDetails = pageErrors
        .map((err) => `${err.name || 'Error'}: ${err.message}\n${err.stack || ''}`)
        .join('\n\n');
      throw new Error(`Client-side page error(s) detected during test execution:\n\n${errorDetails}`);
    }
  },
});

export { expect } from '@playwright/test';
