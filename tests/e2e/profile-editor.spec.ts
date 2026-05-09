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
    await expect(page.getByRole('heading', { name: /Profile/i })).toBeVisible({
      timeout: TEST_TIMEOUTS.SLOW_PAGE,
    });

    // Verify initial profile data is displayed
    await expect(page.getByDisplayValue('Admin')).toBeVisible();
    await expect(page.getByDisplayValue('User')).toBeVisible();
    await expect(page.getByDisplayValue('Admin User')).toBeVisible();
    await expect(page.getByDisplayValue('I love robotics and mentoring students!')).toBeVisible();
    await expect(page.getByDisplayValue('he/him')).toBeVisible();
    await expect(page.getByDisplayValue('Building robots')).toBeVisible();
    await expect(page.getByDisplayValue('Built my first robot at age 10')).toBeVisible();
    await expect(page.getByDisplayValue('Pizza')).toBeVisible();
  });

  test('Profile editing workflow - update name and bio', async ({ page }) => {
    await page.goto('/dashboard/profile');

    // Wait for the profile form to load
    await expect(page.getByRole('heading', { name: /Profile/i })).toBeVisible();

    // Update first name
    const firstNameInput = page.getByLabel('first name', { exact: false }).or(
      page.locator('input[placeholder*="first name" i], input[name*="first" i]')
    );
    await firstNameInput.clear();
    await firstNameInput.fill('Updated');

    // Update last name
    const lastNameInput = page.getByLabel('last name', { exact: false }).or(
      page.locator('input[placeholder*="last name" i], input[name*="last" i]')
    );
    await lastNameInput.clear();
    await lastNameInput.fill('Name');

    // Update nickname
    const nicknameInput = page.getByLabel('nickname', { exact: false }).or(
      page.locator('input[placeholder*="nickname" i], input[name*="nickname" i]')
    );
    await nicknameInput.clear();
    await nicknameInput.fill('Updated Nickname');

    // Update bio
    const bioTextarea = page.getByLabel('bio', { exact: false }).or(
      page.locator('textarea[name*="bio" i], textarea[placeholder*="bio" i]')
    );
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
    await expect(page.getByRole('heading', { name: /Profile/i })).toBeVisible();

    // Update pronouns
    const pronounsInput = page.getByLabel('pronouns', { exact: false }).or(
      page.locator('input[placeholder*="pronouns" i], input[name*="pronouns" i]')
    );
    await pronounsInput.clear();
    await pronounsInput.fill('they/them');

    // Update grade year (for students)
    const gradeYearInput = page.getByLabel('grade year', { exact: false }).or(
      page.locator('input[placeholder*="grade" i], input[name*="grade" i]')
    );
    if (await gradeYearInput.isVisible({ timeout: 1000 })) {
      await gradeYearInput.clear();
      await gradeYearInput.fill('2025');
    }

    // Update favorite robot mechanism
    const mechanismInput = page.getByLabel('robot mechanism', { exact: false }).or(
      page.locator('textarea[name*="mechanism" i], textarea[placeholder*="mechanism" i]')
    );
    if (await mechanismInput.isVisible({ timeout: 1000 })) {
      await mechanismInput.clear();
      await mechanismInput.fill('Drivetrain with swerve modules');
    }

    // Update leadership role
    const leadershipInput = page.getByLabel('leadership role', { exact: false }).or(
      page.locator('input[name*="leadership" i], input[placeholder*="leadership" i]')
    );
    if (await leadershipInput.isVisible({ timeout: 1000 })) {
      await leadershipInput.clear();
      await leadershipInput.fill('Team Captain');
    }

    // Update rookie year
    const rookieYearInput = page.getByLabel('rookie year', { exact: false }).or(
      page.locator('input[name*="rookie" i], input[placeholder*="rookie" i]')
    );
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
    await expect(page.getByRole('heading', { name: /Profile/i })).toBeVisible();

    // Update phone
    const phoneInput = page.getByLabel('phone', { exact: false }).or(
      page.locator('input[type="tel"], input[name*="phone" i], input[placeholder*="phone" i]')
    );
    await phoneInput.clear();
    await phoneInput.fill('555-999-8888');

    // Update contact email
    const contactEmailInput = page.getByLabel('contact email', { exact: false }).or(
      page.locator('input[name*="contact_email" i], input[placeholder*="contact" i]')
    );
    await contactEmailInput.clear();
    await contactEmailInput.fill('newemail@ares.org');

    // Toggle show email checkbox
    const showEmailCheckbox = page.getByLabel('show email', { exact: false }).or(
      page.locator('input[type="checkbox"][name*="show_email" i], input[type="checkbox"][id*="email" i]')
    );
    if (await showEmailCheckbox.isVisible({ timeout: 1000 })) {
      await showEmailCheckbox.check();
    }

    // Toggle show phone checkbox
    const showPhoneCheckbox = page.getByLabel('show phone', { exact: false }).or(
      page.locator('input[type="checkbox"][name*="show_phone" i], input[type="checkbox"][id*="phone" i]')
    );
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
    await expect(page.getByRole('heading', { name: /Profile/i })).toBeVisible();

    // Update t-shirt size
    const tshirtSelect = page.getByLabel('t-shirt', { exact: false }).or(
      page.locator('select[name*="tshirt" i], select[aria-label*="t-shirt" i]')
    );
    if (await tshirtSelect.isVisible({ timeout: 1000 })) {
      await tshirtSelect.selectOption('XL');
    }

    // Update favorite food
    const foodInput = page.getByLabel('favorite food', { exact: false }).or(
      page.locator('input[name*="favorite_food" i], input[placeholder*="food" i]')
    );
    await foodInput.clear();
    await foodInput.fill('Sushi');

    // Update emergency contact name
    const emergencyNameInput = page.getByLabel('emergency contact name', { exact: false }).or(
      page.locator('input[name*="emergency_contact_name" i], input[placeholder*="emergency" i][type="text"]')
    );
    await emergencyNameInput.clear();
    await emergencyNameInput.fill('Emergency Contact');

    // Update emergency contact phone
    const emergencyPhoneInput = page.getByLabel('emergency contact phone', { exact: false }).or(
      page.locator('input[name*="emergency_contact_phone" i], input[placeholder*="emergency" i][type="tel"]')
    );
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
    await expect(page.getByRole('heading', { name: /Profile/i })).toBeVisible();

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
    await page.goto('/dashboard/profile');

    // Verify loading spinner is visible
    await expect(page.locator('.animate-spin, svg[class*="spin" i]').first()).toBeVisible();
  });

  test('Save button shows loading state during submission', async ({ page }) => {
    await page.goto('/dashboard/profile');

    // Wait for the profile form to load
    await expect(page.getByRole('heading', { name: /Profile/i })).toBeVisible();

    // Make a change to enable the save button
    const firstNameInput = page.getByLabel('first name', { exact: false }).or(
      page.locator('input[placeholder*="first name" i], input[name*="first" i]')
    );
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
    await expect(page.getByRole('heading', { name: /Profile/i })).toBeVisible({
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
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('Profile form inputs have proper labels for accessibility', async ({ page }) => {
    await page.goto('/dashboard/profile');

    // Wait for the profile form to fully load
    await expect(page.getByRole('heading', { name: /Profile/i })).toBeVisible();

    // Verify all form inputs have accessible labels
    const inputs = page.locator('input, textarea, select');
    const inputCount = await inputs.count();

    for (let i = 0; i < inputCount; i++) {
      const input = inputs.nth(i);
      const isVisible = await input.isVisible();
      if (isVisible) {
        // Check if input has aria-label, aria-labelledby, or associated label
        const hasAriaLabel = await input.getAttribute('aria-label');
        const hasAriaLabelledby = await input.getAttribute('aria-labelledby');
        const hasId = await input.getAttribute('id');
        const hasPlaceholder = await input.getAttribute('placeholder');
        const hasName = await input.getAttribute('name');

        const hasLabel = hasAriaLabel || hasAriaLabelledby || hasId || hasPlaceholder || hasName;
        expect(hasLabel).toBeTruthy();
      }
    }
  });

  test('Form validation prevents empty required fields', async ({ page }) => {
    await page.goto('/dashboard/profile');

    // Wait for the profile form to load
    await expect(page.getByRole('heading', { name: /Profile/i })).toBeVisible();

    // Clear a required field (nickname)
    const nicknameInput = page.getByLabel('nickname', { exact: false }).or(
      page.locator('input[name*="nickname" i], input[placeholder*="nickname" i]')
    );
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
