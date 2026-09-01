import { test, expect } from './fixtures';

test.describe('Dashboard Authentication & Access Control E2E tests', () => {
  test('should use the isolated admin auth fixture and access dashboard', async ({ page, loginAs }) => {
    await loginAs('admin', 'Test Administrator');
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: 'Command Center' })).toBeVisible({ timeout: 15000 });
    await expect(page.locator('body')).not.toContainText('Developer Bypass Active');
  });

  test('should expose the mobile Team Today workspace to authenticated members', async ({ page, loginAs }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.route('**/api/calendar/events**', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ events: [], nextCursor: null }),
    }));
    await page.route('**/api/photos?**', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ photos: [] }),
    }));
    await page.route('**/api/announcements', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ announcement: null }),
    }));

    await loginAs('member', 'Mobile Member');
    await page.goto('/dashboard/today');

    await expect(page.getByRole('heading', { name: 'Team Today' })).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('No urgent team alert is active.')).toBeVisible();
    await expect(page.getByText('No upcoming event is currently published.')).toBeVisible();
    const viewport = await page.locator('html').evaluate((element) => ({
      documentWidth: element.scrollWidth,
      viewportWidth: element.clientWidth,
    }));
    expect(viewport.documentWidth).toBeLessThanOrEqual(viewport.viewportWidth);
  });

  test('should expose Academy evidence requests to editors without mobile overflow', async ({ page, loginAs }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await loginAs('admin', 'Curriculum Editor');
    await page.goto('/dashboard/academy');

    await expect(page.getByRole('heading', { name: 'Academy Manager' })).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('heading', { name: 'Curriculum evidence needed' })).toBeVisible();
    await page.getByText('Review all 20 open requests (1 partially supported)').click();
    await expect(page.getByRole('heading', { name: 'Mechanical Measurement Design Notebook' })).toBeVisible();
    await expect(page.getByText(/Approved team photo shows a student-safe measurement setup/i)).toBeVisible();

    const viewport = await page.locator('html').evaluate((element) => ({
      documentWidth: element.scrollWidth,
      viewportWidth: element.clientWidth,
    }));
    expect(viewport.documentWidth).toBeLessThanOrEqual(viewport.viewportWidth);
  });

  test('should keep shared media dashboard actions usable at a 320px viewport', async ({ page, loginAs }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.route('**/api/videos?**', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ videos: [], hasMore: false, nextCursor: null }),
    }));
    await loginAs('admin', 'Media Manager');
    await page.goto('/dashboard/videos');

    await expect(page.getByRole('heading', { name: 'Manage Videos' })).toBeVisible({ timeout: 15000 });
    const actions = page.getByRole('button', { name: /Sync YouTube|Add video/ });
    const actionSizes = await actions.evaluateAll((buttons) => buttons.map((button) => {
      const bounds = button.getBoundingClientRect();
      return { width: bounds.width, height: bounds.height };
    }));
    expect(actionSizes).toHaveLength(2);
    expect(actionSizes.every(({ width, height }) => width >= 44 && height >= 44)).toBe(true);

    const viewport = await page.locator('html').evaluate((element) => ({
      documentWidth: element.scrollWidth,
      viewportWidth: element.clientWidth,
    }));
    expect(viewport.documentWidth).toBeLessThanOrEqual(viewport.viewportWidth);
  });

  test('should deny the isolated member fixture on admin routes', async ({ page, loginAs }) => {
    await loginAs('member', 'Test Member');
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: 'Command Center' })).toBeVisible({ timeout: 15000 });
    
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
    let submittedBody: Record<string, unknown> | undefined;
    let submittedAppCheck = "";
    // Intercept and mock the recruitment API post request to avoid failing if backend/DB is offline
    await page.route('**/api/inquiries', async (route) => {
      submittedBody = JSON.parse(route.request().postData() ?? "{}") as Record<string, unknown>;
      submittedAppCheck = route.request().headers()['x-firebase-appcheck'] ?? "";
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    });

    await page.goto('/join');
    await expect(page.getByRole('alert')).toHaveCount(0);
    
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
    expect(submittedAppCheck).toBe('test-app-check-token');
    expect(submittedBody).toBeDefined();
    expect(submittedBody).not.toHaveProperty('recaptchaToken');
  });
});

test.describe('WebGL & Simulations E2E tests', () => {
  test('should load the dashboard simulations catalog without throwing page errors', async ({ page, loginAs }) => {
    await loginAs('admin');
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: 'Command Center' })).toBeVisible({ timeout: 15000 });
    
    // Navigate to simulations catalog
    await page.goto('/dashboard/simulations');
    await expect(page.locator('body')).toContainText('Simulations Manager', { timeout: 15000 });
  });
});
