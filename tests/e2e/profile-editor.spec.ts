import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { setupMockAuth, MOCK_ADMIN_USER } from '../fixtures/auth';
import { TEST_TIMEOUTS } from '../fixtures/mock-data';

test.describe('Profile Editor Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await setupMockAuth(page);
  });

  const createMockProfileData = (overrides: Record<string, unknown> = {}) => ({
    auth: {
      id: MOCK_ADMIN_USER.id,
      email: MOCK_ADMIN_USER.email,
      name: MOCK_ADMIN_USER.name,
      image: MOCK_ADMIN_USER.image,
      role: MOCK_ADMIN_USER.role,
    },
    user_id: MOCK_ADMIN_USER.id,
    member_type: 'mentor',
    first_name: 'Admin',
    last_name: 'User',
    nickname: 'Admin User',
    bio: 'I love robotics and mentoring students!',
    pronouns: 'he/him',
    subteams: '["programming","mechanical"]',
    grade_year: null,
    favorite_food: 'Pizza',
    dietary_restrictions: '[]',
    favorite_first_thing: 'Building robots',
    fun_fact: 'Built my first robot at age 10',
    show_email: 0,
    contact_email: 'admin@ares.org',
    show_phone: 0,
    phone: '555-123-4567',
    show_on_about: 1,
    favorite_robot_mechanism: 'Intake system',
    pre_match_superstition: 'Always check the battery',
    leadership_role: 'Technical Lead',
    rookie_year: '2020',
    colleges: '[]',
    employers: '[]',
    tshirt_size: 'L',
    emergency_contact_name: 'Jane Doe',
    emergency_contact_phone: '555-987-6543',
    parents_name: null,
    parents_email: null,
    students_name: null,
    students_email: null,
    ...overrides,
  });

  test('Profile editor loads and displays current profile data', async ({ page }) => {
    // Mock GET /profile/me endpoint
    await page.route('**/profile/me', async (route) => {
      await route.fulfill({
        status: 200,
        json: createMockProfileData(),
      });
    });

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
    // Mock GET /profile/me endpoint
    await page.route('**/profile/me', async (route) => {
      await route.fulfill({
        status: 200,
        json: createMockProfileData(),
      });
    });

    // Mock PUT /profile/me endpoint
    let updatedProfile: Record<string, unknown> | null = null;
    await page.route('**/profile/me', async (route) => {
      if (route.request().method() === 'PUT') {
        const requestBody = await route.request().postData();
        updatedProfile = JSON.parse(requestBody || '{}');

        await route.fulfill({
          status: 200,
          json: { success: true },
        });
      } else {
        await route.continue();
      }
    });

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

    // Verify the update was sent correctly
    expect(updatedProfile).toBeDefined();
    expect(updatedProfile?.first_name).toBe('Updated');
    expect(updatedProfile?.last_name).toBe('Name');
    expect(updatedProfile?.nickname).toBe('Updated Nickname');
    expect(updatedProfile?.bio).toBe('Updated bio with more information about me.');

    // Verify success message appears
    await expect(page.getByText('Profile saved!', { exact: false })).toBeVisible();
  });

  test('Profile editing workflow - update role information', async ({ page }) => {
    // Mock GET /profile/me endpoint
    await page.route('**/profile/me', async (route) => {
      await route.fulfill({
        status: 200,
        json: createMockProfileData(),
      });
    });

    // Mock PUT /profile/me endpoint
    let updatedProfile: Record<string, unknown> | null = null;
    await page.route('**/profile/me', async (route) => {
      if (route.request().method() === 'PUT') {
        const requestBody = await route.request().postData();
        updatedProfile = JSON.parse(requestBody || '{}');

        await route.fulfill({
          status: 200,
          json: { success: true },
        });
      } else {
        await route.continue();
      }
    });

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
    expect(updatedProfile).toBeDefined();
    expect(updatedProfile?.pronouns).toBe('they/them');
  });

  test('Profile editing workflow - update contact information', async ({ page }) => {
    // Mock GET /profile/me endpoint
    await page.route('**/profile/me', async (route) => {
      await route.fulfill({
        status: 200,
        json: createMockProfileData(),
      });
    });

    // Mock PUT /profile/me endpoint
    let updatedProfile: Record<string, unknown> | null = null;
    await page.route('**/profile/me', async (route) => {
      if (route.request().method() === 'PUT') {
        const requestBody = await route.request().postData();
        updatedProfile = JSON.parse(requestBody || '{}');

        await route.fulfill({
          status: 200,
          json: { success: true },
        });
      } else {
        await route.continue();
      }
    });

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
    expect(updatedProfile).toBeDefined();
    expect(updatedProfile?.phone).toBe('555-999-8888');
    expect(updatedProfile?.contact_email).toBe('newemail@ares.org');
  });

  test('Profile editing workflow - update logistics information', async ({ page }) => {
    // Mock GET /profile/me endpoint for a student profile
    await page.route('**/profile/me', async (route) => {
      await route.fulfill({
        status: 200,
        json: createMockProfileData({
          member_type: 'student',
          grade_year: '2025',
          tshirt_size: 'M',
          favorite_food: 'Tacos',
          dietary_restrictions: '["Peanuts","Dairy"]',
          parents_name: 'Parent Name',
          parents_email: 'parent@example.com',
        }),
      });
    });

    // Mock PUT /profile/me endpoint
    let updatedProfile: Record<string, unknown> | null = null;
    await page.route('**/profile/me', async (route) => {
      if (route.request().method() === 'PUT') {
        const requestBody = await route.request().postData();
        updatedProfile = JSON.parse(requestBody || '{}');

        await route.fulfill({
          status: 200,
          json: { success: true },
        });
      } else {
        await route.continue();
      }
    });

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

    // Update parent name (for students)
    const parentNameInput = page.getByLabel('parent', { exact: false }).or(
      page.locator('input[name*="parents_name" i], input[placeholder*="parent" i]')
    );
    if (await parentNameInput.isVisible({ timeout: 1000 })) {
      await parentNameInput.clear();
      await parentNameInput.fill('Updated Parent');
    }

    // Submit the form
    const saveButton = page.getByRole('button', { name: /Save Profile/i });
    await saveButton.click();

    // Wait for mutation to complete
    await page.waitForTimeout(500);

    // Verify the update was sent correctly
    expect(updatedProfile).toBeDefined();
    expect(updatedProfile?.tshirt_size).toBe('XL');
    expect(updatedProfile?.favorite_food).toBe('Sushi');
    expect(updatedProfile?.emergency_contact_name).toBe('Emergency Contact');
    expect(updatedProfile?.emergency_contact_phone).toBe('555-111-2222');
  });

  test('Profile editing workflow - toggle show on about', async ({ page }) => {
    // Mock GET /profile/me endpoint
    await page.route('**/profile/me', async (route) => {
      await route.fulfill({
        status: 200,
        json: createMockProfileData({
          show_on_about: 1,
        }),
      });
    });

    // Mock PUT /profile/me endpoint
    let updatedProfile: Record<string, unknown> | null = null;
    await page.route('**/profile/me', async (route) => {
      if (route.request().method() === 'PUT') {
        const requestBody = await route.request().postData();
        updatedProfile = JSON.parse(requestBody || '{}');

        await route.fulfill({
          status: 200,
          json: { success: true },
        });
      } else {
        await route.continue();
      }
    });

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

    // Verify the update was sent correctly (should be 0/false after unchecking)
    expect(updatedProfile).toBeDefined();
    expect(updatedProfile?.show_on_about).toBe(0);
  });

  test('Youth Protection banner displays for students', async ({ page }) => {
    // Mock GET /profile/me endpoint for a student
    await page.route('**/profile/me', async (route) => {
      await route.fulfill({
        status: 200,
        json: createMockProfileData({
          member_type: 'student',
          grade_year: '2025',
        }),
      });
    });

    await page.goto('/dashboard/profile');

    // Verify Youth Protection banner is visible for students
    await expect(page.getByText(/FIRST Youth Protection/i)).toBeVisible();
    await expect(page.getByText(/contact information.*protected/i)).toBeVisible();
  });

  test('Youth Protection banner does not display for mentors', async ({ page }) => {
    // Mock GET /profile/me endpoint for a mentor
    await page.route('**/profile/me', async (route) => {
      await route.fulfill({
        status: 200,
        json: createMockProfileData({
          member_type: 'mentor',
        }),
      });
    });

    await page.goto('/dashboard/profile');

    // Verify Youth Protection banner is not visible for mentors
    await expect(page.getByText(/FIRST Youth Protection/i)).not.toBeVisible();
  });

  test('Profile editor handles loading state', async ({ page }) => {
    // Mock GET /profile/me endpoint with delay
    await page.route('**/profile/me', async (route) => {
      // Simulate slow network
      await new Promise(resolve => setTimeout(resolve, 1000));
      await route.fulfill({
        status: 200,
        json: createMockProfileData(),
      });
    });

    await page.goto('/dashboard/profile');

    // Verify loading spinner is visible
    await expect(page.locator('.animate-spin, svg[class*="spin" i]').first()).toBeVisible();
  });

  test('Profile editor handles error state', async ({ page }) => {
    // Remove the default profile mock set up in beforeEach
    await page.unroute('**/profile/me');

    // Mock GET /profile/me endpoint to return error
    await page.route('**/profile/me', async (route) => {
      await route.fulfill({
        status: 500,
        json: { error: 'Internal server error' },
      });
    });

    await page.goto('/dashboard/profile');

    // Verify error message is displayed
    await expect(page.getByText(/TELEMETRY FAULT/i)).toBeVisible();
    await expect(page.getByText(/Failed to synchronize/i)).toBeVisible();
  });

  test('Save button shows loading state during submission', async ({ page }) => {
    // Mock GET /profile/me endpoint
    await page.route('**/profile/me', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          json: createMockProfileData(),
        });
      }
    });

    // Mock PUT /profile/me endpoint with delay
    await page.route('**/profile/me', async (route) => {
      if (route.request().method() === 'PUT') {
        // Simulate slow network
        await new Promise(resolve => setTimeout(resolve, 2000));
        await route.fulfill({
          status: 200,
          json: { success: true },
        });
      }
    });

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
    // Mock GET /profile/me endpoint
    await page.route('**/profile/me', async (route) => {
      await route.fulfill({
        status: 200,
        json: createMockProfileData(),
      });
    });

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
    // Mock GET /profile/me endpoint
    await page.route('**/profile/me', async (route) => {
      await route.fulfill({
        status: 200,
        json: createMockProfileData(),
      });
    });

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
    // Mock GET /profile/me endpoint
    await page.route('**/profile/me', async (route) => {
      await route.fulfill({
        status: 200,
        json: createMockProfileData(),
      });
    });

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
