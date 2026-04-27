/* eslint-disable @typescript-eslint/no-explicit-any */
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
      (window as Window & { ARES_E2E_BYPASS?: boolean }).ARES_E2E_BYPASS = true;
    });

    // Intercept the API submission so we don't pollute the database,
    // and instead force a success response.
    await page.route(url => url.pathname.includes('/inquiries'), async route => {
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
    try {
      await expect(successAlert).toBeVisible({ timeout: 5000 });
    } catch (e) {
      const errorMsg = await page.locator('.text-ares-red').allTextContents();
      console.error("Form submission failed with errors on page:", errorMsg);
      throw e;
    }
  });

  test('Interactive Zulip cards attempt navigation when clicked', async ({ page }) => {
    // Mock the single event route to return a zulip topic and messages
    await page.route('**/api/events/*', async route => {
      await route.fulfill({
        status: 200,
        json: {
          event: {
            id: 'test-event',
            title: 'Zulip E2E Event',
            date_start: new Date().toISOString(),
            date_end: new Date().toISOString(),
            description: "Test description",
            category: 'meeting'
          }
        }
      });
    });

    await page.route(url => url.pathname.includes('/api/zulip/topic'), async route => {
      await route.fulfill({
        status: 200,
        json: {
          success: true,
          messages: [
            {
              id: 99999,
              sender_id: 1,
              sender_full_name: 'Zulip Tester',
              avatar_url: '',
              content: '<p>This is a test message from Zulip.</p>',
              timestamp: Date.now() / 1000
            }
          ],
          zulipUrl: 'https://aresfirst.zulipchat.com'
        }
      });
    });

    await page.goto('/events/test-event');

    // Ensure the message is rendered
    const msgBlock = page.getByText('This is a test message from Zulip.');
    await expect(msgBlock).toBeVisible({ timeout: 5000 });

    // The message is wrapped in a clickable div. We intercept window.open to prevent actual navigation.
    await page.evaluate(() => {
      (window as any)._openedDeepLinks = [];
      window.open = (url) => {
        (window as any)._openedDeepLinks.push(url);
        return null;
      };
    });

    // Click the message
    await msgBlock.click();

    // Verify window.open was called with the deep link
    const openedLinks = await page.evaluate(() => (window as any)._openedDeepLinks);
    expect(openedLinks).toContain('https://aresfirst.zulipchat.com/#narrow/stream/events/topic/Event.3A.20Zulip.20E2E.20Event/near/99999');
  });
});

