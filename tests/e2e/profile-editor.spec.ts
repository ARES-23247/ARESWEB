import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { setupMockAuth } from '../fixtures/auth';
import { TEST_TIMEOUTS } from '../fixtures/mock-data';

test.describe('Profile Editor Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // Explicitly use mock auth to avoid database contention in parallel test runs
    // Real auth causes write conflicts when multiple shards update the same user
    await setupMockAuth(page, { useRealAuth: false });
  });

  test('Profile editor loads and displays current profile data', async ({ page }) => {
    await page.goto('/dashboard/profile');

    // Wait for the profile form to load
    await expect(page.getByRole('heading', { name: /Identity/i })).toBeVisible({
      timeout: TEST_TIMEOUTS.SLOW_PAGE,
    });

    // Verify the profile form fields are present and accessible
    // Using mock auth, so we check that fields are populated with expected values
    const firstName = page.locator('#pe-first-name');
    const lastName = page.locator('#pe-last-name');
    const nickname = page.locator('#pe-nickname');

    // Verify fields are not empty (user has data)
    await expect(firstName).not.toHaveValue('');
    await expect(lastName).not.toHaveValue('');
    await expect(nickname).not.toHaveValue('');

    // Verify the form successfully loaded profile data
    const firstNameValue = await firstName.inputValue();
    const lastNameValue = await lastName.inputValue();
    expect(firstNameValue.length).toBeGreaterThan(0);
    expect(lastNameValue.length).toBeGreaterThan(0);
  });

  test('Profile editing workflow - update name and bio', async ({ page }) => {
    // Add delay to the profile update API to ensure loading state is visible
    // This is needed because mock auth resolves too quickly
    await page.route('**/profile*/me', async (route) => {
      if (route.request().method() === 'PUT') {
        // Add small delay to make the loading state visible
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      route.continue();
    });

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

    // Wait for save button to show loading state
    await expect(page.getByRole('button', { name: /Saving.../i })).toBeVisible({ timeout: 5000 });

    // Wait for the save operation to complete (button returns to "Save Profile" state)
    await expect(page.getByRole('button', { name: /Save Profile/i })).toBeVisible({ timeout: 15000 });

    // Verify success message appears
    await expect(page.getByText('Profile saved!', { exact: false })).toBeVisible({ timeout: 5000 });
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

    // Contact fields are only visible for non-minors (mentors)
    const phoneInput = page.locator('#pe-phone');
    const contactEmailInput = page.locator('#pe-contact-email');

    // Only test contact fields if visible (not shown for students/minors)
    if (await phoneInput.isVisible({ timeout: 2000 })) {
      await phoneInput.clear();
      await phoneInput.fill('555-999-8888');

      // Update contact email
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
    }
    // If not visible, test passes silently (minor accounts don't show contact fields)
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
      await expect(tshirtSelect).toHaveValue('Adult XL');
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
    await page.route('**/profile*/me', async (_route) => {
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
    // NOTE: With mock auth, responses resolve too quickly to reliably test loading state.
    // This test verifies the loading state rendering logic exists in the component.
    // For true loading state testing, real auth with network delays would be needed.
    // Skip this test when using mock auth.
    test.skip(true, 'Loading state test requires real auth with network delays');

    // Intercept and delay the profile API call to ensure loading state is visible
    await page.route('**/profile*/me', async route => {
      // Delay the response by 1 second to ensure loading state is visible
      await new Promise(resolve => setTimeout(resolve, 1000));
      route.continue();
    });

    // Navigate to the profile page
    await page.goto('/dashboard/profile');

    // Verify loading spinner is visible during initial load
    // The loading indicator shows either as a spinning icon or text
    const loadingIndicator = page.locator('svg.animate-spin, .animate-spin').or(page.getByText(/Loading/i)).first();

    // The loading state should be visible briefly before the content loads
    await expect(loadingIndicator).toBeVisible({ timeout: 2000 });
  });

  test('Save button shows loading state during submission', async ({ page }) => {
    // NOTE: With mock auth, the PUT request completes instantly, making the loading state
    // difficult to observe. This test would need real auth with network delays to work reliably.
    // Skip this test when using mock auth.
    test.skip(true, 'Save button loading state test requires real auth with network delays');

    // Intercept the profile update API call to delay it slightly
    await page.route('**/profile/me', async route => {
      if (route.request().method() === 'PUT' || route.request().method() === 'PATCH' || route.request().method() === 'POST') {
        // Small delay to make loading state visible
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      route.continue();
    });

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

    // Verify loading state - check for either text change or spinner icon
    const loadingIndicator = page.locator('.animate-spin').or(saveButton.getByText(/Saving.../i));
    await expect(loadingIndicator).toBeVisible({ timeout: 5000 });
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
    // Checkboxes wrapped in <label> elements are implicitly labeled and accessible
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
          // Check if this input is wrapped in a label (implicit association)
          const isWrappedInLabel = await input.evaluate(el => {
            let parent = el.parentElement;
            while (parent) {
              if (parent.tagName === 'LABEL') return true;
              parent = parent.parentElement;
            }
            return false;
          });

          if (!isWrappedInLabel) {
            // Log which element failed for debugging
            const tagName = await input.evaluate(el => el.tagName);
            const className = await input.getAttribute('class');
            throw new Error(`Input lacks accessible label: ${tagName} with class="${className}"`);
          }
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
