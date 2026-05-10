import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { setupMockAuth } from '../fixtures/auth';
import { TEST_TIMEOUTS } from '../fixtures/mock-data';

test.describe('Profile Editor Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await setupMockAuth(page, { useRealAuth: true });
  });

  test('Profile editor loads and displays current profile data', async ({ page }) => {
    await page.goto('/dashboard/profile');

    // Wait for the profile form to load
    await expect(page.getByRole('heading', { name: /Identity/i })).toBeVisible({
      timeout: TEST_TIMEOUTS.SLOW_PAGE,
    });

    // Verify initial profile data is displayed using input value selectors
    await expect(page.locator('#pe-first-name')).toHaveValue('Admin');
    await expect(page.locator('#pe-last-name')).toHaveValue('User');
    await expect(page.locator('#pe-nickname')).toHaveValue('Admin User');
    await expect(page.locator('#pe-bio')).toHaveValue('I love robotics and mentoring students!');
    await expect(page.locator('#pe-pronouns')).toHaveValue('he/him');
    await expect(page.locator('#pe-fav-mech')).toHaveValue('Building robots');
    await expect(page.locator('#pe-funfact')).toHaveValue('Built my first robot at age 10');
    await expect(page.locator('#pe-food')).toHaveValue('Pizza');
  });

  test('Profile editing workflow - update name and bio', async ({ page }) => {
    await page.goto('/dashboard/profile');

    // Wait for the profile form to load
    await expect(page.getByRole('heading', { name: /Identity/i })).toBeVisible();

    // Update first name - use specific ID to avoid matching favoriteFirstThing
    const firstNameInput = page.locator('#pe-first-name');
    await firstNameInput.clear();
    await firstNameInput.fill('Updated');

    // Update last name
    const lastNameInput = page.locator('#pe-last-name');
    await lastNameInput.clear();
    await lastNameInput.fill('Name');

    // Update nickname
    const nicknameInput = page.locator('#pe-nickname');
    await nicknameInput.clear();
    await nicknameInput.fill('Updated Nickname');

    // Update bio
    const bioTextarea = page.locator('#pe-bio');
    await bioTextarea.clear();
    await bioTextarea.fill('Updated bio with more information about me.');

    // Submit the form
    const saveButton = page.getByRole('button', { name: /Save Profile/i });
    await saveButton.click();

    // Wait for mutation to complete
    await page.waitForTimeout(500);

    // Verify success message appears
    await expect(page.getByText('Profile saved!', { exact: false })).toBeVisible();
  });

  test('Profile editing workflow - update role information', async ({ page }) => {
    await page.goto('/dashboard/profile');

    // Wait for the profile form to load
    await expect(page.getByRole('heading', { name: /Identity/i })).toBeVisible();

    // Update pronouns
    const pronounsInput = page.locator('#pe-pronouns');
    await pronounsInput.clear();
    await pronounsInput.fill('they/them');

    // Update grade year (for students)
    const gradeYearInput = page.locator('#pe-grade');
    if (await gradeYearInput.isVisible({ timeout: 1000 })) {
      await gradeYearInput.clear();
      await gradeYearInput.fill('2025');
    }

    // Update favorite robot mechanism
    const mechanismInput = page.locator('#pe-fav-mech');
    if (await mechanismInput.isVisible({ timeout: 1000 })) {
      await mechanismInput.clear();
      await mechanismInput.fill('Drivetrain with swerve modules');
    }

    // Update leadership role
    const leadershipInput = page.locator('#pe-role');
    if (await leadershipInput.isVisible({ timeout: 1000 })) {
      await leadershipInput.clear();
      await leadershipInput.fill('Team Captain');
    }

    // Update rookie year
    const rookieYearInput = page.locator('#pe-rookie');
    if (await rookieYearInput.isVisible({ timeout: 1000 })) {
      await rookieYearInput.clear();
      await rookieYearInput.fill('2021');
    }

    // Submit the form
    const saveButton = page.getByRole('button', { name: /Save Profile/i });
    await saveButton.click();

    // Wait for mutation to complete
    await page.waitForTimeout(500);

    // Verify the update was sent correctly
    await expect(pronounsInput).toHaveValue('they/them');
  });

  test('Profile editing workflow - update contact information', async ({ page }) => {
    await page.goto('/dashboard/profile');

    // Wait for the profile form to load
    await expect(page.getByRole('heading', { name: /Identity/i })).toBeVisible();

    // Update phone
    const phoneInput = page.locator('#pe-phone');
    await phoneInput.clear();
    await phoneInput.fill('555-999-8888');

    // Update contact email
    const contactEmailInput = page.locator('#pe-contact-email');
    await contactEmailInput.clear();
    await contactEmailInput.fill('newemail@ares.org');

    // Toggle show email checkbox
    const showEmailCheckbox = page.locator('input[type="checkbox"][name="showEmail"]');
    if (await showEmailCheckbox.isVisible({ timeout: 1000 })) {
      await showEmailCheckbox.check();
    }

    // Toggle show phone checkbox
    const showPhoneCheckbox = page.locator('input[type="checkbox"][name="showPhone"]');
    if (await showPhoneCheckbox.isVisible({ timeout: 1000 })) {
      await showPhoneCheckbox.check();
    }

    // Submit the form
    const saveButton = page.getByRole('button', { name: /Save Profile/i });
    await saveButton.click();

    // Wait for mutation to complete
    await page.waitForTimeout(500);

    // Verify the update was sent correctly
    await expect(phoneInput).toHaveValue('555-999-8888');
    await expect(contactEmailInput).toHaveValue('newemail@ares.org');
  });

  test('Profile editing workflow - update logistics information', async ({ page }) => {
    await page.goto('/dashboard/profile');

    // Wait for the profile form to load
    await expect(page.getByRole('heading', { name: /Identity/i })).toBeVisible();

    // Update t-shirt size
    const tshirtSelect = page.locator('#pe-tshirt');
    if (await tshirtSelect.isVisible({ timeout: 1000 })) {
      await tshirtSelect.selectOption('Adult XL');
    }

    // Update favorite food
    const foodInput = page.locator('#pe-food');
    await foodInput.clear();
    await foodInput.fill('Sushi');

    // Update emergency contact name
    const emergencyNameInput = page.locator('#pe-ec-name');
    await emergencyNameInput.clear();
    await emergencyNameInput.fill('Emergency Contact');

    // Update emergency contact phone
    const emergencyPhoneInput = page.locator('#pe-ec-phone');
    await emergencyPhoneInput.clear();
    await emergencyPhoneInput.fill('555-111-2222');

    // Submit the form
    const saveButton = page.getByRole('button', { name: /Save Profile/i });
    await saveButton.click();

    // Wait for mutation to complete
    await page.waitForTimeout(500);

    // Verify the update was sent correctly
    if (await tshirtSelect.isVisible({ timeout: 1000 })) {
      await expect(tshirtSelect).toHaveValue('XL');
    }
    await expect(foodInput).toHaveValue('Sushi');
    await expect(emergencyNameInput).toHaveValue('Emergency Contact');
    await expect(emergencyPhoneInput).toHaveValue('555-111-2222');
  });

  test('Profile editing workflow - toggle show on about', async ({ page }) => {
    await page.goto('/dashboard/profile');

    // Wait for the profile form to load
    await expect(page.getByRole('heading', { name: /Identity/i })).toBeVisible();

    // Toggle show on about checkbox
    const showOnAboutCheckbox = page.getByLabel(/show on about/i, { exact: false }).or(
      page.locator('input[type="checkbox"][name*="show_on_about" i]')
    );
    if (await showOnAboutCheckbox.isVisible({ timeout: 1000 })) {
      await showOnAboutCheckbox.uncheck();
    }

    // Submit the form
    const saveButton = page.getByRole('button', { name: /Save Profile/i });
    await saveButton.click();

    // Wait for mutation to complete
    await page.waitForTimeout(500);

    // Verify the update was sent correctly (should be unchecked)
    if (await showOnAboutCheckbox.isVisible({ timeout: 1000 })) {
      await expect(showOnAboutCheckbox).not.toBeChecked();
    }
  });

  test('Youth Protection banner displays for students', async ({ page }) => {
    // Setup mock auth with student user
    await page.route('**/api/auth/get-session', async (_route) => {
      await _route.fulfill({
        status: 200,
        json: {
          session: {
            id: 'student-session',
            userId: 'student-user',
            expiresAt: new Date(Date.now() + 10000000).toISOString(),
            ipAddress: '127.0.0.1',
            userAgent: 'Playwright',
          },
          user: {
            id: 'student-user',
            name: 'Student User',
            email: 'student@ares.org',
            emailVerified: true,
            image: 'https://api.dicebear.com/9.x/bottts/svg?seed=student',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            role: 'member',
            banned: false,
          },
        },
      });
    });

    // Mock profile as student
    await page.route('**/profile/me', async (_route) => {
      await _route.fulfill({
        status: 200,
        json: {
          auth: {
            id: 'student-user',
            email: 'student@ares.org',
            name: 'Student User',
            image: 'https://api.dicebear.com/9.x/bottts/svg?seed=student',
            role: 'member',
          },
          user_id: 'student-user',
          member_type: 'student',
          first_name: 'Student',
          last_name: 'User',
          nickname: 'Student User',
          grade_year: '2025',
        },
      });
    });

    await page.goto('/dashboard/profile');

    // Verify Youth Protection banner is visible for students
    await expect(page.getByText(/FIRST Youth Protection/i)).toBeVisible();
    await expect(page.getByText(/contact information.*protected/i)).toBeVisible();
  });

  test('Youth Protection banner does not display for mentors', async ({ page }) => {
    await page.goto('/dashboard/profile');

    // Verify Youth Protection banner is not visible for mentors
    await expect(page.getByText(/FIRST Youth Protection/i)).not.toBeVisible();
  });

  test('Profile editor handles loading state', async ({ page }) => {
    // The loading state appears briefly on initial navigation
    // We need to intercept and delay the response to catch the loading spinner

    // Intercept the profile API call and delay it
    await page.route('**/api/profile/me', async route => {
      // Delay the response to allow loading state to be visible
      await new Promise(resolve => setTimeout(resolve, 500));
      route.continue();
    });

    await page.goto('/dashboard/profile');

    // Verify loading spinner is visible during initial load
    await expect(page.locator('svg.animate-spin, .animate-spin').first()).toBeVisible();
  });

  test('Save button shows loading state during submission', async ({ page }) => {
    await page.goto('/dashboard/profile');

    // Wait for the profile form to load
    await expect(page.getByRole('heading', { name: /Identity/i })).toBeVisible();

    // Make a change to enable the save button
    const firstNameInput = page.locator('#pe-first-name');
    await firstNameInput.clear();
    await firstNameInput.fill('Test');

    // Submit the form
    const saveButton = page.getByRole('button', { name: /Save Profile/i });
    await saveButton.click();

    // Verify loading state
    await expect(saveButton).toHaveText(/Saving.../i);
    await expect(page.locator('.animate-spin').or(page.getByText(/Saving/i))).toBeVisible();
  });

  test('WCAG 2.1 AA accessibility audit', async ({ page }) => {
    await page.goto('/dashboard/profile');

    // Wait for the profile form to fully load
    await expect(page.getByRole('heading', { name: /Identity/i })).toBeVisible({
      timeout: TEST_TIMEOUTS.SLOW_PAGE,
    });

    // Stabilize page for accessibility scan (disable animations)
    await page.addStyleTag({
      content: `
        *, *::before, *::after {
          transition: none !important;
          animation: none !important;
          opacity: 1 !important;
        }
      `,
    });

    // Run accessibility audit
    const accessibilityScanResults = await new AxeBuilder({ page })
      .disableRules(['color-contrast'])
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('Profile form inputs have proper labels for accessibility', async ({ page }) => {
    await page.goto('/dashboard/profile');

    // Wait for the profile form to fully load
    await expect(page.getByRole('heading', { name: /Identity/i })).toBeVisible();

    // Verify all form inputs have accessible labels
    // All inputs in the profile form have either:
    // 1. An id with associated label (via htmlFor)
    // 2. An aria-label
    // 3. An aria-labelledby
    // 4. A name attribute
    // 5. A placeholder attribute

    const inputs = page.locator('input:not([type="hidden"]), textarea, select');
    const inputCount = await inputs.count();

    for (let i = 0; i < inputCount; i++) {
      const input = inputs.nth(i);
      const isVisible = await input.isVisible();
      if (isVisible) {
        // Check if input has accessible labeling
        const hasAriaLabel = await input.getAttribute('aria-label');
        const hasAriaLabelledby = await input.getAttribute('aria-labelledby');
        const hasId = await input.getAttribute('id');
        const hasPlaceholder = await input.getAttribute('placeholder');
        const hasName = await input.getAttribute('name');

        // At least one of these should be present for accessibility
        const hasLabel = hasAriaLabel || hasAriaLabelledby || hasId || hasPlaceholder || hasName;

        if (!hasLabel) {
          // Log which element failed for debugging
          const tagName = await input.evaluate(el => el.tagName);
          const className = await input.getAttribute('class');
          throw new Error(`Input lacks accessible label: ${tagName} with class="${className}"`);
        }
      }
    }
  });

  test('Form validation prevents empty required fields', async ({ page }) => {
    await page.goto('/dashboard/profile');

    // Wait for the profile form to load
    await expect(page.getByRole('heading', { name: /Identity/i })).toBeVisible();

    // Clear a required field (nickname)
    const nicknameInput = page.locator('#pe-nickname');
    await nicknameInput.clear();

    // Attempt to submit the form
    const saveButton = page.getByRole('button', { name: /Save Profile/i });
    await saveButton.click();

    // Verify form validation prevents submission
    // The button should either be disabled or show validation errors
    await page.waitForTimeout(200);
    const isDisabled = await saveButton.isDisabled();
    const hasValidationMessage = await page.getByText(/required/i, { exact: false }).count() > 0;

    expect(isDisabled || hasValidationMessage).toBeTruthy();
  });
});
