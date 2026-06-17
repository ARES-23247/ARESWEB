import { test, expect } from '@playwright/test';

test('verify live form submission', async ({ page }) => {
  console.log("Navigating to Join page on live site...");
  await page.goto("https://aresfirst-portal.web.app/join");

  console.log("Filling form fields...");
  await page.fill("#join-name", "Playwright E2E Test Candidate");
  await page.fill("#join-email", "playwright.test@aresfirst.org");
  await page.fill("#join-phone", "(304) 555-9876");
  await page.fill("#join-school", "Morgantown High School");
  await page.selectOption("#join-grade", "9");

  console.log("Selecting interest...");
  await page.click('label:has-text("Programming")');

  await page.fill("#join-additional", "This is an automated E2E test to verify live reCAPTCHA token execution.");

  console.log("Submitting form...");
  await page.click('button[type="submit"]');

  console.log("Waiting for submission state change...");
  await expect(page.locator('text=Application submitted successfully!')).toBeVisible({ timeout: 25000 });
  console.log("E2E SUCCESS! Form submitted and accepted successfully by live backend.");
});
