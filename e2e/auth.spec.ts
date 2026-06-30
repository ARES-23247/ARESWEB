import { test, expect } from './fixtures';

test.describe('Dashboard Authentication & Access Control E2E tests', () => {
  test('should log in using developer bypass as admin and access dashboard', async ({ page }) => {
    // Go to dashboard (which triggers login overlay)
    await page.goto('/dashboard');
    
    // Check that we see the developer bypass active text
    await expect(page.locator('body')).toContainText('Developer Bypass Active');
    
    // Click the mock admin login button
    const adminButton = page.locator('button', { hasText: 'David (Admin)' });
    await expect(adminButton).toBeVisible();
    await adminButton.click();
    
    // Verify that we are logged in and see the dashboard profile name
    await expect(page.locator('text=Sign Out')).toBeVisible({ timeout: 15000 });
  });

  test('should log in as student member and receive access denied on admin routes', async ({ page }) => {
    await page.goto('/dashboard');
    
    // Click Member bypass button
    const memberButton = page.locator('button', { hasText: 'Member' });
    await expect(memberButton).toBeVisible();
    await memberButton.click();
    
    // Check dashboard loads
    await expect(page.locator('text=Sign Out')).toBeVisible({ timeout: 15000 });
    
    // Navigate to inquiries page
    await page.goto('/dashboard/inquiries');
    await expect(page.locator('h1')).toContainText('Access Denied', { timeout: 15000 });
    
    // Navigate to users page
    await page.goto('/dashboard/users');
    await expect(page.locator('h1')).toContainText('Access Denied', { timeout: 15000 });
  });
});

test.describe('Public Forms E2E tests', () => {
  test('should successfully validate and submit the join recruitment form', async ({ page }) => {
    // Intercept and mock the recruitment API post request to avoid failing if backend/DB is offline
    await page.route('**/api/inquiries', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    });

    await page.goto('/join');
    
    // Fill out student inquiry form
    await page.locator('#join-name').fill('Playwright Test Runner');
    await page.locator('#join-email').fill('playwright.test@aresfirst.org');
    await page.locator('#join-phone').fill('(304) 555-9876');
    await page.locator('#join-school').fill('Scouting Academy High');
    await page.locator('#join-grade').selectOption('11');
    
    // Toggle first interest checkbox (e.g. Robot Programming)
    const programmingCheckbox = page.locator('input[type="checkbox"]').first();
    await programmingCheckbox.check();
    
    await page.locator('#join-additional').fill('I want to learn EKF Odometry calibrations.');
    
    // Click submit button
    const submitBtn = page.locator('button[type="submit"]');
    await submitBtn.click();
    
    // Verify success banner is shown
    await expect(page.locator('body')).toContainText('Application submitted successfully', { timeout: 15000 });
  });
});

test.describe('WebGL & Simulations E2E tests', () => {
  test('should load the dashboard simulations catalog without throwing page errors', async ({ page }) => {
    await page.goto('/dashboard');
    
    // Login as admin
    const adminButton = page.locator('button', { hasText: 'David (Admin)' });
    await adminButton.click();
    await expect(page.locator('text=Sign Out')).toBeVisible({ timeout: 15000 });
    
    // Navigate to simulations catalog
    await page.goto('/dashboard/simulations');
    await expect(page.locator('body')).toContainText('Simulations Manager', { timeout: 15000 });
  });
});
