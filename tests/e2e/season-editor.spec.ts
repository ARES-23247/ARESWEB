import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { setupMockAuth } from '../fixtures/auth';
import { TEST_TIMEOUTS } from '../fixtures/mock-data';

test.describe('Season/Award Editor E2E', () => {
  test.beforeEach(async ({ page }) => {
    await setupMockAuth(page);

    // Mock Zulip presence to avoid network errors affecting a11y scans
    await page.route('**/api/zulip/presence', async (_route) => {
      await _route.fulfill({
        status: 200,
        json: { success: true, presence: {}, userNames: {} },
      });
    });

    // Mock analytics admin stats
    await page.route('**/api/analytics/admin/stats*', async (_route) => {
      await _route.fulfill({
        status: 200,
        json: {
          posts: 10,
          events: 5,
          docs: 2,
          securityBlocks: 0,
          integrations: {
            zulip: false,
            github: false,
            discord: false,
            bluesky: false,
            slack: false,
            gcal: false,
          },
        },
      });
    });
  });

  test.describe('Season Creation Workflow', () => {
    test('should display season editor with empty form for new season', async ({ page }) => {
      await page.goto('/dashboard/seasons');

      // Verify editor title for new season
      await expect(page.getByRole('heading', { name: /Forge New Legacy/i })).toBeVisible({
        timeout: TEST_TIMEOUTS.DEFAULT,
      });

      // Verify subtitle describing the purpose
      await expect(page.getByText(/Documenting the evolution of ARES 23247/i)).toBeVisible();

      // Verify form fields are present and accessible
      await expect(page.getByLabel(/Season Year/i)).toBeVisible();
      await expect(page.getByLabel(/Challenge Name/i)).toBeVisible();
      await expect(page.getByLabel(/Robot Name/i)).toBeVisible();
      await expect(page.getByLabel(/Google Photos Album Link/i)).toBeVisible();
      await expect(page.getByLabel(/CAD Link/i)).toBeVisible();
      await expect(page.getByLabel(/Brief Summary/i)).toBeVisible();

      // Verify editor actions are present
      await expect(page.getByRole('button', { name: /Save Draft/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /Establish Legacy/i })).toBeVisible();
    });

    test('should validate required fields when publishing without data', async ({ page }) => {
      await page.goto('/dashboard/seasons');

      // Click publish without filling required fields
      await page.getByRole('button', { name: /Establish Legacy/i }).click();

      // Verify validation error appears
      await expect(page.getByText(/Start Year and Challenge Name are required/i)).toBeVisible({
        timeout: TEST_TIMEOUTS.DEFAULT,
      });
    });

    test('should allow filling season form data', async ({ page }) => {
      await page.goto('/dashboard/seasons');

      // Fill in the season form
      await page.getByLabel(/Season Year/i).fill('2025');
      await page.getByLabel(/Challenge Name/i).fill('CRESCENDO');
      await page.getByLabel(/Robot Name/i).fill('ARES-7');
      await page.getByLabel(/CAD Link/i).fill('https://cad.onshape.com/documents/ares-7');
      await page.getByLabel(/Brief Summary/i).fill('Our most competitive robot yet.');

      // Verify values are set
      await expect(page.getByLabel(/Season Year/i)).toHaveValue('2025');
      await expect(page.getByLabel(/Challenge Name/i)).toHaveValue('CRESCENDO');
      await expect(page.getByLabel(/Robot Name/i)).toHaveValue('ARES-7');
    });

    test('should save season draft successfully', async ({ page }) => {
      // Mock the save endpoint
      await page.route('**/api/seasons/admin/save', async (_route) => {
        await _route.fulfill({
          status: 200,
          json: { success: true },
        });
      });

      await page.goto('/dashboard/seasons');

      // Fill required fields
      await page.getByLabel(/Season Year/i).fill('2025');
      await page.getByLabel(/Challenge Name/i).fill('CRESCENDO');

      // Save as draft
      await page.getByRole('button', { name: /Save Draft/i }).click();

      // Should redirect to manage seasons page after successful save
      await expect(page).toHaveURL(/\/dashboard\/manage_seasons/, {
        timeout: TEST_TIMEOUTS.SLOW_PAGE,
      });
    });

    test('should publish season successfully', async ({ page }) => {
      // Mock the save endpoint
      await page.route('**/api/seasons/admin/save', async (_route) => {
        await _route.fulfill({
          status: 200,
          json: { success: true },
        });
      });

      await page.goto('/dashboard/seasons');

      // Fill required fields
      await page.getByLabel(/Season Year/i).fill('2025');
      await page.getByLabel(/Challenge Name/i).fill('CRESCENDO');
      await page.getByLabel(/Robot Name/i).fill('ARES-7');

      // Publish season
      await page.getByRole('button', { name: /Establish Legacy/i }).click();

      // Should redirect to manage seasons page after successful publish
      await expect(page).toHaveURL(/\/dashboard\/manage_seasons/, {
        timeout: TEST_TIMEOUTS.SLOW_PAGE,
      });
    });

    test('should handle save errors gracefully', async ({ page }) => {
      // Mock a failed save attempt
      await page.route('**/api/seasons/admin/save', async (_route) => {
        await _route.fulfill({
          status: 500,
          json: { error: 'Database connection failed' },
        });
      });

      await page.goto('/dashboard/seasons');

      // Fill required fields
      await page.getByLabel(/Season Year/i).fill('2025');
      await page.getByLabel(/Challenge Name/i).fill('CRESCENDO');

      // Attempt to publish
      await page.getByRole('button', { name: /Establish Legacy/i }).click();

      // Verify error message is displayed
      await expect(page.getByText(/Save failed|Failed to save season/i)).toBeVisible({
        timeout: TEST_TIMEOUTS.DEFAULT,
      });
    });
  });

  test.describe('Editing Existing Season', () => {
    const mockSeason = {
      original_year: 2024,
      start_year: 2024,
      end_year: 2025,
      challenge_name: 'CENTERSTAGE',
      robot_name: 'ARES-6',
      robot_image: 'https://example.com/robot.jpg',
      robot_description: JSON.stringify({
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'A tall robot with a shooter' }],
          },
        ],
      }),
      robot_cad_url: 'https://cad.onshape.com/documents/ares-6',
      summary: 'Our most successful season yet',
      album_url: 'https://photos.app.goo.gl/xyz',
      album_cover: 'https://example.com/cover.jpg',
      status: 'published',
      is_deleted: 0,
    };

    test('should load existing season data for editing', async ({ page }) => {
      // Mock the season detail endpoint
      await page.route('**/api/seasons/admin/2024', async (_route) => {
        await _route.fulfill({
          status: 200,
          json: { season: mockSeason },
        });
      });

      await page.goto('/dashboard/seasons/2024');

      // Verify editor title for editing
      await expect(page.getByRole('heading', { name: /Update Legacy/i })).toBeVisible({
        timeout: TEST_TIMEOUTS.DEFAULT,
      });

      // Verify form is pre-populated with existing data
      await expect(page.getByLabel(/Season Year/i)).toHaveValue('2024');
      await expect(page.getByLabel(/Challenge Name/i)).toHaveValue('CENTERSTAGE');
      await expect(page.getByLabel(/Robot Name/i)).toHaveValue('ARES-6');
      await expect(page.getByLabel(/CAD Link/i)).toHaveValue('https://cad.onshape.com/documents/ares-6');
      await expect(page.getByLabel(/Brief Summary/i)).toHaveValue('Our most successful season yet');
    });

    test('should update existing season', async ({ page }) => {
      // Mock the season detail endpoint
      await page.route('**/api/seasons/admin/2024', async (_route) => {
        await _route.fulfill({
          status: 200,
          json: { season: mockSeason },
        });
      });

      // Mock the save endpoint
      await page.route('**/api/seasons/admin/save', async (_route) => {
        await _route.fulfill({
          status: 200,
          json: { success: true },
        });
      });

      await page.goto('/dashboard/seasons/2024');

      // Update robot name
      await page.getByLabel(/Robot Name/i).clear();
      await page.getByLabel(/Robot Name/i).fill('ARES-6.5');

      // Update the season
      await page.getByRole('button', { name: /UPDATE LEGACY/i }).click();

      // Should redirect to manage seasons page after successful update
      await expect(page).toHaveURL(/\/dashboard\/manage_seasons/, {
        timeout: TEST_TIMEOUTS.SLOW_PAGE,
      });
    });

    test('should handle missing season gracefully', async ({ page }) => {
      // Mock a 404 response for non-existent season
      await page.route('**/api/seasons/admin/9999', async (_route) => {
        await _route.fulfill({
          status: 404,
          json: { error: 'Season not found' },
        });
      });

      await page.goto('/dashboard/seasons/9999');

      // Editor should still load but with empty form
      await expect(page.getByRole('heading', { name: /Forge New Legacy/i })).toBeVisible({
        timeout: TEST_TIMEOUTS.DEFAULT,
      });
    });
  });

  test.describe('Season Manager Integration', () => {
    const mockSeasons = [
      {
        start_year: 2024,
        end_year: 2025,
        challenge_name: 'CENTERSTAGE',
        robot_name: 'ARES-6',
        is_deleted: 0,
        status: 'published',
      },
      {
        start_year: 2023,
        end_year: 2024,
        challenge_name: 'POWERPLAY',
        robot_name: 'ARES-5',
        is_deleted: 0,
        status: 'draft',
      },
      {
        start_year: 2022,
        end_year: 2023,
        challenge_name: 'RAPID REACT',
        robot_name: 'ARES-4',
        is_deleted: 1,
        status: 'published',
      },
    ];

    test('should navigate from manager to season editor', async ({ page }) => {
      // Mock the seasons list endpoint
      await page.route('**/api/seasons/admin/list', async (_route) => {
        await _route.fulfill({
          status: 200,
          json: { seasons: mockSeasons },
        });
      });

      // Mock the season detail endpoint
      await page.route('**/api/seasons/admin/2024', async (_route) => {
        await _route.fulfill({
          status: 200,
          json: { season: mockSeasons[0] },
        });
      });

      await page.goto('/dashboard/manage_seasons');

      // Wait for the season list to load
      await expect(page.getByText(/Season Archive/i)).toBeVisible({
        timeout: TEST_TIMEOUTS.SLOW_PAGE,
      });

      // Click on the first season to edit
      await page.getByText('CENTERSTAGE 2024-2025').click();

      // Should navigate to the season editor
      await expect(page).toHaveURL(/\/dashboard\/seasons\/2024/, {
        timeout: TEST_TIMEOUTS.DEFAULT,
      });

      // Verify editor loaded
      await expect(page.getByRole('heading', { name: /Update Legacy/i })).toBeVisible();
    });

    test('should create new season from manager', async ({ page }) => {
      // Mock the seasons list endpoint
      await page.route('**/api/seasons/admin/list', async (_route) => {
        await _route.fulfill({
          status: 200,
          json: { seasons: mockSeasons },
        });
      });

      await page.goto('/dashboard/manage_seasons');

      // Navigate to new season form
      await page.getByRole('link', { name: /Forge Legacy|Create Season/i }).click();

      // Should navigate to the new season editor
      await expect(page).toHaveURL(/\/dashboard\/seasons$/, {
        timeout: TEST_TIMEOUTS.DEFAULT,
      });

      // Verify new season editor loaded
      await expect(page.getByRole('heading', { name: /Forge New Legacy/i })).toBeVisible();
    });
  });

  test.describe('Accessibility Audit (WCAG 2.1 AA)', () => {
    test('should pass WCAG 2.1 AA accessibility audit for new season form', async ({ page }) => {
      await page.goto('/dashboard/seasons');

      // Wait for page to fully load
      await expect(page.getByRole('heading', { name: /Forge New Legacy/i })).toBeVisible({
        timeout: TEST_TIMEOUTS.DEFAULT,
      });

      // Run accessibility audit
      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();

      expect(accessibilityScanResults.violations).toEqual([]);
    });

    test('should pass WCAG 2.1 AA accessibility audit for edit season form', async ({ page }) => {
      const mockSeason = {
        original_year: 2024,
        start_year: 2024,
        end_year: 2025,
        challenge_name: 'CENTERSTAGE',
        robot_name: 'ARES-6',
        robot_image: null,
        robot_description: null,
        robot_cad_url: null,
        summary: null,
        album_url: null,
        album_cover: null,
        status: 'published',
        is_deleted: 0,
      };

      // Mock the season detail endpoint
      await page.route('**/api/seasons/admin/2024', async (_route) => {
        await _route.fulfill({
          status: 200,
          json: { season: mockSeason },
        });
      });

      await page.goto('/dashboard/seasons/2024');

      // Wait for page to fully load
      await expect(page.getByRole('heading', { name: /Update Legacy/i })).toBeVisible({
        timeout: TEST_TIMEOUTS.DEFAULT,
      });

      // Run accessibility audit
      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();

      expect(accessibilityScanResults.violations).toEqual([]);
    });

    test('should have proper form label associations', async ({ page }) => {
      await page.goto('/dashboard/seasons');

      // Verify all form inputs have associated labels
      const seasonYearInput = page.getByLabel(/Season Year/i);
      await expect(seasonYearInput).toBeVisible();

      const challengeNameInput = page.getByLabel(/Challenge Name/i);
      await expect(challengeNameInput).toBeVisible();

      const robotNameInput = page.getByLabel(/Robot Name/i);
      await expect(robotNameInput).toBeVisible();

      const summaryInput = page.getByLabel(/Brief Summary/i);
      await expect(summaryInput).toBeVisible();

      // Verify buttons have accessible names
      await expect(page.getByRole('button', { name: /Save Draft/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /Establish Legacy/i })).toBeVisible();
    });

    test('should be keyboard navigable', async ({ page }) => {
      await page.goto('/dashboard/seasons');

      // Tab through form fields
      await page.keyboard.press('Tab');
      await expect(page.getByLabel(/Season Year/i)).toBeFocused();

      await page.keyboard.press('Tab');
      await expect(page.getByLabel(/Challenge Name/i)).toBeFocused();

      await page.keyboard.press('Tab');
      await expect(page.getByLabel(/Robot Name/i)).toBeFocused();

      // Verify focus visible state is handled
      const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
      expect(['INPUT', 'TEXTAREA', 'BUTTON', 'SELECT']).toContain(focusedElement);
    });
  });

  test.describe('Award Editor Integration', () => {
    const mockAwards = [
      {
        id: '1',
        title: 'Excellence in Engineering',
        year: 2024,
        event_name: 'West Virginia State Championship',
        image_url: 'https://example.com/award.jpg',
        description: 'Award for outstanding robot design and engineering',
        season_id: 2024,
      },
      {
        id: '2',
        title: 'Winning Alliance Captain',
        year: 2024,
        event_name: 'League Championship',
        image_url: null,
        description: 'Led the winning alliance',
        season_id: 2024,
      },
    ];

    test('should load award editor from dashboard', async ({ page }) => {
      // Mock the awards endpoint
      await page.route('**/api/awards*', async (_route) => {
        await _route.fulfill({
          status: 200,
          json: { awards: mockAwards },
        });
      });

      // Mock seasons for season picker
      await page.route('**/api/seasons*', async (_route) => {
        await _route.fulfill({
          status: 200,
          json: {
            seasons: [
              {
                start_year: 2024,
                end_year: 2025,
                challenge_name: 'CENTERSTAGE',
                robot_name: 'ARES-6',
                is_deleted: 0,
                status: 'published',
              },
            ],
          },
        });
      });

      await page.goto('/dashboard/legacy');

      // Verify award editor loads
      await expect(page.getByRole('heading', { name: /Trophy Case Management/i })).toBeVisible({
        timeout: TEST_TIMEOUTS.DEFAULT,
      });

      // Verify existing awards are displayed
      await expect(page.getByText('Excellence in Engineering')).toBeVisible();
      await expect(page.getByText('Winning Alliance Captain')).toBeVisible();
    });

    test('should add new award', async ({ page }) => {
      // Mock the awards endpoint
      await page.route('**/api/awards*', async (route) => {
        const _request = route.request();
        if (_request.method() === 'POST') {
          await _route.fulfill({
            status: 200,
            json: { success: true },
          });
        } else {
          await _route.fulfill({
            status: 200,
            json: { awards: [] },
          });
        }
      });

      // Mock seasons for season picker
      await page.route('**/api/seasons*', async (_route) => {
        await _route.fulfill({
          status: 200,
          json: {
            seasons: [
              {
                start_year: 2024,
                end_year: 2025,
                challenge_name: 'CENTERSTAGE',
                robot_name: 'ARES-6',
                is_deleted: 0,
                status: 'published',
              },
            ],
          },
        });
      });

      await page.goto('/dashboard/legacy');

      // Click Add Award button
      await page.getByRole('button', { name: /Add Award/i }).click();

      // Fill award form
      await page.getByLabel(/Award Title/i).fill('Innovative Design');
      await page.getByLabel(/Event Name/i).fill('World Championship');
      await page.getByLabel(/Description/i).fill('Unique mechanism for scoring');

      // Submit form
      await page.getByRole('button', { name: /Commemorate Achievement/i }).click();

      // Form should close after submission
      await expect(page.getByRole('button', { name: /Add Award/i })).toBeVisible({
        timeout: TEST_TIMEOUTS.DEFAULT,
      });
    });

    test('should pass WCAG 2.1 AA accessibility audit for award editor', async ({ page }) => {
      // Mock the awards endpoint
      await page.route('**/api/awards*', async (_route) => {
        await _route.fulfill({
          status: 200,
          json: { awards: mockAwards },
        });
      });

      // Mock seasons for season picker
      await page.route('**/api/seasons*', async (_route) => {
        await _route.fulfill({
          status: 200,
          json: {
            seasons: [
              {
                start_year: 2024,
                end_year: 2025,
                challenge_name: 'CENTERSTAGE',
                robot_name: 'ARES-6',
                is_deleted: 0,
                status: 'published',
              },
            ],
          },
        });
      });

      await page.goto('/dashboard/legacy');

      // Wait for page to fully load
      await expect(page.getByRole('heading', { name: /Trophy Case Management/i })).toBeVisible({
        timeout: TEST_TIMEOUTS.DEFAULT,
      });

      // Run accessibility audit
      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();

      expect(accessibilityScanResults.violations).toEqual([]);
    });
  });

  test.describe('Cross-Integration: Seasons to Awards', () => {
    test('should maintain data consistency between seasons and awards', async ({ page }) => {
      const mockSeason = {
        original_year: 2024,
        start_year: 2024,
        end_year: 2025,
        challenge_name: 'CENTERSTAGE',
        robot_name: 'ARES-6',
        robot_image: null,
        robot_description: null,
        robot_cad_url: null,
        summary: 'Best season ever',
        album_url: null,
        album_cover: null,
        status: 'published',
        is_deleted: 0,
      };

      const mockSeasonAwards = [
        {
          id: '1',
          title: 'Inspire Award',
          year: 2024,
          event_name: 'State Championship',
          image_url: null,
          description: 'Granted for embodiment of FTC values',
          season_id: 2024,
        },
      ];

      // Mock both endpoints
      await page.route('**/api/seasons/admin/2024', async (_route) => {
        await _route.fulfill({
          status: 200,
          json: { season: mockSeason },
        });
      });

      await page.route('**/api/awards*', async (_route) => {
        await _route.fulfill({
          status: 200,
          json: { awards: mockSeasonAwards },
        });
      });

      await page.route('**/api/seasons*', async (_route) => {
        await _route.fulfill({
          status: 200,
          json: {
            seasons: [mockSeason],
          },
        });
      });

      // Navigate to season editor
      await page.goto('/dashboard/seasons/2024');
      await expect(page.getByRole('heading', { name: /Update Legacy/i })).toBeVisible();

      // Verify season data
      await expect(page.getByLabel(/Challenge Name/i)).toHaveValue('CENTERSTAGE');

      // Navigate to award editor
      await page.goto('/dashboard/legacy');
      await expect(page.getByRole('heading', { name: /Trophy Case Management/i })).toBeVisible();

      // Verify award is linked to correct season
      await expect(page.getByText('Inspire Award')).toBeVisible();
      await expect(page.getByText('2024')).toBeVisible();
    });
  });
});
