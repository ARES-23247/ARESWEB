import { test, expect } from '@playwright/test';

test.describe('AresPlanner E2E tests', () => {
  test('should load AresPlanner page and render canvas', async ({ page }) => {
    await page.goto('/aresplanner');
    
    // Check that canvas is visible
    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();
    
    // Check for some panel elements
    await expect(page.locator('body')).toContainText('Kinematics');
  });
});
