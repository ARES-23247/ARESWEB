import { test as base, expect } from '@playwright/test';

export const test = base.extend({
  page: async ({ page }, use) => {
    const pageErrors: Error[] = [];

    const errorHandler = (err: Error) => {
      pageErrors.push(err);
    };

    page.on('pageerror', errorHandler);

    await use(page);

    page.removeListener('pageerror', errorHandler);

    if (pageErrors.length > 0) {
      const errorDetails = pageErrors
        .map((err) => `${err.name || 'Error'}: ${err.message}\n${err.stack || ''}`)
        .join('\n\n');
      throw new Error(`Client-side page error(s) detected during test execution:\n\n${errorDetails}`);
    }
  },
});

export { expect };
