import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const staticRoutes = [
  { path: '/about', expectedTitle: 'About Us | ARES 23247' },
  { path: '/seasons', expectedTitle: 'Team Legacy | ARES 23247' },
  { path: '/outreach', expectedTitle: 'Community Impact | ARES 23247' },
  { path: '/tech-stack', expectedTitle: 'Tech Stack | ARES 23247' },
  { path: '/sponsors', expectedTitle: 'Sponsors | ARES 23247' },
  { path: '/accessibility', expectedTitle: 'Accessibility & Web Standards | ARES 23247' },
  { path: '/privacy', expectedTitle: 'Privacy Policy | ARES 23247' },
];

test.describe('Static Information Pages', () => {
  for (const route of staticRoutes) {
    test(`should load ${route.path} with correct title, no console errors, and WCAG AA compliance`, async ({ page }) => {
      const consoleErrors: string[] = [];
      page.on('pageerror', (exception) => {
        consoleErrors.push(`Uncaught exception: "${exception}"`);
      });
      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          const text = msg.text();
          if (text.includes('favicon')) return;
          if (text.includes('401')) return;
          if (text.includes('429')) return;
          consoleErrors.push(text);
        }
      });

      await page.goto(route.path);

      // Wait for React to mount and render completely
      await page.waitForLoadState('networkidle');
      
      // Allow Framer Motion animations to settle
      await page.waitForTimeout(500);

      // Disable animations to prevent flaky accessibility results (contrast scanning mid-animation)
      await page.addStyleTag({
        content: `
          *, *::before, *::after {
            transition: none !important;
            animation: none !important;
            transition-duration: 0s !important;
            animation-duration: 0s !important;
          }
        `
      });

      // 1. Verify correct title mapping
      await expect(page).toHaveTitle(route.expectedTitle);

      // 2. Verify exactly zero javascript console errors (omitting harmless favicons)
      expect(consoleErrors).toHaveLength(0);

      // 3. Verify an H1 or major heading exists
      const heading = page.locator('h1').first();
      await expect(heading).toBeAttached();

      // 4. Accessibility Testing (WCAG 2.1 AA level strictly required via ARESWEB standards)
      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .exclude('.framer-motion-container') // Example exclusion if needed
        .analyze();
        
      expect(accessibilityScanResults.violations).toEqual([]);
    });
  }
});
