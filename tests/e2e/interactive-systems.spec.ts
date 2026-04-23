import { test, expect } from '@playwright/test';

test.describe('Interactive Systems & Workflows', () => {
  
  test('Command Palette triggers, searches, and navigates correctly', async ({ page }) => {
    // Navigate to homepage
    await page.goto('/');
    
    // Ensure the Command Palette button exists in the header
    const commandPaletteBtn = page.getByRole('button', { name: 'Open Command Palette' }).first();
    await expect(commandPaletteBtn).toBeVisible();
    
    // Open Command Palette
    await commandPaletteBtn.click();
    
    // Verify modal appeared and input is focused
    const searchInput = page.getByPlaceholder('Search documentation, routes, workflows...');
    await expect(searchInput).toBeVisible();
    await expect(searchInput).toBeFocused();
    
    // Type a query
    await searchInput.fill('Sponsorships');
    
    // Wait for the results to filter
    const resultItem = page.getByText('Sponsorships & ROI');
    await expect(resultItem).toBeVisible();
    
    // Select the item and verify navigation
    await resultItem.click();
    await expect(page).toHaveURL(/\/sponsors/);
  });

  test('Join the Team inquiry flow submits successfully', async ({ page }) => {
    // SEC-03: Enable Turnstile bypass for E2E
    await page.addInitScript(() => {
      (window as any).ARES_E2E_BYPASS = true;
    });

    // Intercept the API submission so we don't pollute the database,
    // and instead force a success response.
    await page.route('/api/inquiries', async route => {
      // Small artificial delay to ensure "Sending..." state is visible if quickly checked
      await new Promise(resolve => setTimeout(resolve, 300));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, id: 'test-id' })
      });
    });

    // Navigate to the join page
    await page.goto('/join');
    
    // Verify an inquiry form is on the page
    const nameInput = page.getByLabel(/Full Name/i);
    await expect(nameInput).toBeVisible();
    
    // Fill out the form
    await nameInput.fill('John Doe');
    await page.getByLabel(/Email Address/i).fill('johndoe@test.com');
    await page.getByLabel(/School/i).fill('Morgantown High School');
    await page.getByLabel(/Current Grade/i).selectOption('10');
    // Check one of the interest boxes
    await page.getByLabel(/Programming/i).check();
    await page.getByLabel(/Additional Information/i).fill('I love robotics and want to build things.');
    
    // Submit the form
    const submitBtn = page.getByRole('button', { name: /Submit Student Application/i });
    await expect(submitBtn).toBeVisible();
    await submitBtn.click();
    
    // Verify success message rendered! (Checks Join.tsx UI state)
    const successAlert = page.getByText(/Application submitted successfully/i);
    await expect(successAlert).toBeVisible();
  });
});
