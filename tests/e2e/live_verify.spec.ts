import { test, expect } from '@playwright/test';

test('verify live join form submission', async ({ page }) => {
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
  console.log("E2E SUCCESS! Join form submitted and accepted successfully by live backend.");
});

test('verify live sponsor form submission', async ({ page }) => {
  console.log("Navigating to Sponsors page on live site...");
  await page.goto("https://aresfirst-portal.web.app/sponsors");

  console.log("Filling sponsor form fields...");
  await page.fill("#sponsor-name", "Playwright E2E Test Sponsor LLC");
  await page.fill("#sponsor-email", "sponsorship.test@aresfirst.org");
  await page.fill("#sponsor-phone", "(304) 555-4321");
  await page.selectOption("#sponsor-level", "Gold Tier Sponsor");
  await page.fill("#sponsor-message", "This is an automated E2E test to verify live sponsor reCAPTCHA token.");

  console.log("Submitting sponsor form...");
  await page.click('button[type="submit"]');

  console.log("Waiting for sponsor submission state change...");
  await expect(page.locator('text=Request sent successfully.')).toBeVisible({ timeout: 25000 });
  console.log("E2E SUCCESS! Sponsor form submitted and accepted successfully by live backend.");
});
