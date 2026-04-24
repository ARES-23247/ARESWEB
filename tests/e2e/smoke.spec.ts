import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const PUBLIC_ROUTES = [
  '/',
  '/about',
  '/seasons',
  '/events',
  '/blog',
  '/gallery',
  '/outreach',
  '/tech-stack',
  '/accessibility',
  '/privacy',
  '/sponsors',
  '/join',
  '/leaderboard',
  '/bug-report',
];

test.describe('ARESWEB Global Smoke Tests', () => {
  for (const route of PUBLIC_ROUTES) {
    test(`Route ${route} should load successfully without errors and pass basic accessibility`, async ({ page }) => {
      const errors: string[] = [];
      
      // Listen for unhandled exceptions or error boundary catches in console
      page.on('console', msg => {
        if (msg.type() === 'error') {
          // Ignore non-breaking console errors like some third-party script fails
          // But log them if they mention React Error Boundary or chunk loading
          if (msg.text().includes('Minified React error') || msg.text().includes('ChunkLoadError')) {
            errors.push(msg.text());
          }
        }
      });

      page.on('pageerror', exception => {
        errors.push(exception.message);
      });

      const response = await page.goto(route);
      
      // Asserts that there are no 404s or 500s directly from network
      expect(response?.status()).toBeLessThan(400);

      // Asserts the presence of the global Navbar to guarantee successful layout DOM mounting
      const nav = page.locator('nav');
      await expect(nav).toBeVisible();

      // Wait for framer-motion entry animations to settle before a11y scan
      await page.waitForTimeout(1000);
      await page.addStyleTag({
        content: `
          *, *::before, *::after {
            transition: none !important;
            animation: none !important;
            opacity: 1 !important;
          }
        `
      });

      // Ensure no uncaught frontend exceptions crashed the client
      expect(errors).toHaveLength(0);

      // Accessibility assertions — enforce WCAG 2.1 AA rules only (not best-practice advisories)
      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
      expect(accessibilityScanResults.violations).toEqual([]);
    });
  }
});
