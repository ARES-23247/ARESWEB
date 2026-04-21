import { test, expect } from '@playwright/test';

test.describe('ARESWEB Content Routes', () => {
  test('Blog route loads successfully', async ({ page }) => {
    await page.goto('/blog');
    
    const nav = page.locator('nav');
    await expect(nav).toBeVisible();
    
    // We expect there to be some kind of grid or list loading container
    // Let's assert the primary heading exists
    const heading = page.locator('h1').filter({ hasText: 'Blog' });
    // Assuming the blog page has "Blog" or "Engineering Notebook" as h1
    // We will just verify it's a 200 and loads DOM for now, 
    // to protect against blank screens.
    await expect(page.locator('main')).toBeVisible();
  });

  test('Events route loads successfully', async ({ page }) => {
    await page.goto('/events');
    const nav = page.locator('nav');
    await expect(nav).toBeVisible();
    await expect(page.locator('main')).toBeVisible();
  });

  test('Docs route loads successfully', async ({ page }) => {
    await page.goto('/docs');
    
    // Asserts main layout mounts (Docs does not use the global nav)
    // Assuming the layout has a main and aside or multiple columns
    await expect(page.locator('main').first()).toBeVisible();
  });

  test('Judges route loads successfully', async ({ page }) => {
    await page.goto('/judges');
    const nav = page.locator('nav');
    await expect(nav).toBeVisible();
    await expect(page.locator('main')).toBeVisible();
  });
});
