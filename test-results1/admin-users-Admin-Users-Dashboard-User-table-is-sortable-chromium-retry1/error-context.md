# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: admin-users.spec.ts >> Admin Users Dashboard >> User table is sortable
- Location: tests/e2e/admin-users.spec.ts:112:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('heading', { name: /User Management/i })
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByRole('heading', { name: /User Management/i })

```

# Page snapshot

```yaml
- generic [ref=e2]:
  - link "Skip to main content" [ref=e3] [cursor=pointer]:
    - /url: "#main-content"
  - region "Notifications alt+T"
  - button "Open AI Assistant" [ref=e4] [cursor=pointer]:
    - img [ref=e7]
  - generic:
    - generic:
      - generic:
        - generic:
          - img
        - generic:
          - generic: ARES Intelligence
          - generic: Online
      - button "Close AI Assistant":
        - img
    - generic:
      - generic:
        - generic:
          - img
        - heading "How can I help you?" [level=4]
        - paragraph: Ask me anything about ARES 23247 engineering standards, software rules, or the team schedule.
        - generic:
          - button "What are the CAD rules?"
          - button "Explain the game strategy"
          - button "When is the next meeting?"
        - generic:
          - img
          - generic: Zero PII Retained
    - generic:
      - generic:
        - generic:
          - textbox "Ask ARES Knowledge Bot a question" [disabled]:
            - /placeholder: Verifying...
        - button "Send message" [disabled]:
          - img
  - navigation "Main Navigation" [ref=e11]:
    - link "Skip to Main Content" [ref=e12] [cursor=pointer]:
      - /url: "#main-content"
    - generic [ref=e13]:
      - button "ARES 23247 Home" [ref=e14] [cursor=pointer]:
        - text: ARES
        - generic [ref=e15]: "23247"
      - generic [ref=e16]:
        - generic [ref=e17]:
          - button "Team" [ref=e18] [cursor=pointer]:
            - text: Team
            - img [ref=e19]
          - generic:
            - link "Who We Are":
              - /url: /about
              - img
              - text: Who We Are
            - link "Seasons":
              - /url: /seasons
              - img
              - text: Seasons
            - link "Our Impact":
              - /url: /outreach
              - img
              - text: Our Impact
            - link "Team Blog":
              - /url: /blog
              - img
              - text: Team Blog
        - link "Calendar" [ref=e21] [cursor=pointer]:
          - /url: /events
          - img [ref=e22]
          - text: Calendar
        - link "Store" [ref=e24] [cursor=pointer]:
          - /url: /store
          - img [ref=e25]
          - text: Store
        - link "Academy" [ref=e28] [cursor=pointer]:
          - /url: /academy
          - img [ref=e29]
          - text: Academy
        - link "ARES Documentation Library" [ref=e32] [cursor=pointer]:
          - /url: /docs
          - generic [ref=e33]: ARES
          - generic [ref=e34]: LIB
      - generic [ref=e35]:
        - button "Open Command Palette" [ref=e36] [cursor=pointer]:
          - img [ref=e37]
          - generic [ref=e40]:
            - text: Search...
            - generic [ref=e41]:
              - generic [ref=e42]: Ctrl
              - generic [ref=e43]: K
        - link "Sign In" [ref=e44] [cursor=pointer]:
          - /url: /login
          - img [ref=e45]
          - generic [ref=e48]: Internal Portal
  - main [ref=e49]:
    - generic [ref=e50]:
      - img [ref=e51]
      - heading "Authentication Required" [level=1] [ref=e53]
      - paragraph [ref=e54]: You must be signed in with a verified ARES account to access the administrative dashboard.
      - link "Return to Login" [ref=e55] [cursor=pointer]:
        - /url: /login
  - contentinfo "Site Footer" [ref=e56]:
    - generic [ref=e57]:
      - generic [ref=e58]:
        - generic [ref=e59]:
          - link "ARES Appalachian Robotics & Engineering Society" [ref=e60] [cursor=pointer]:
            - /url: /
            - heading "ARES" [level=3] [ref=e61]
            - paragraph [ref=e62]: Appalachian Robotics & Engineering Society
          - paragraph [ref=e63]:
            - link "FIRST® Tech Challenge" [ref=e64] [cursor=pointer]:
              - /url: https://www.firstinspires.org/robotics/ftc
              - emphasis [ref=e65]: FIRST
              - text: ® Tech Challenge
            - text: "Team #23247"
        - paragraph [ref=e66]:
          - text: Based in Morgantown, WV, we are engineering the next generation of Mountaineer innovators through the mission of
          - link "FIRST®" [ref=e67] [cursor=pointer]:
            - /url: https://www.firstinspires.org/
            - emphasis [ref=e68]: FIRST
            - text: ®
          - text: .
        - link "Report Technical Issue" [ref=e69] [cursor=pointer]:
          - /url: /bug-report
          - img [ref=e70]
          - text: Report Technical Issue
      - generic [ref=e72]:
        - heading "Organization" [level=4] [ref=e73]:
          - img [ref=e74]
          - text: Organization
        - list [ref=e79]:
          - listitem [ref=e80]:
            - link "About Us" [ref=e81] [cursor=pointer]:
              - /url: /about
          - listitem [ref=e82]:
            - link "Competition History" [ref=e83] [cursor=pointer]:
              - /url: /seasons
          - listitem [ref=e84]:
            - link "Outreach & Impact" [ref=e85] [cursor=pointer]:
              - /url: /outreach
          - listitem [ref=e86]:
            - link "Team Calendar" [ref=e87] [cursor=pointer]:
              - /url: /events
              - img [ref=e88]
              - text: Team Calendar
          - listitem [ref=e90]:
            - link "Join the Team" [ref=e91] [cursor=pointer]:
              - /url: /join
      - generic [ref=e92]:
        - heading "Resources" [level=4] [ref=e93]:
          - img [ref=e94]
          - text: Resources
        - list [ref=e96]:
          - listitem [ref=e97]:
            - link "Team Blog" [ref=e98] [cursor=pointer]:
              - /url: /blog
          - listitem [ref=e99]:
            - link "ARES Academy" [ref=e100] [cursor=pointer]:
              - /url: /academy
          - listitem [ref=e101]:
            - link "ARES Lib" [ref=e102] [cursor=pointer]:
              - /url: /docs
              - generic [ref=e103]:
                - generic [ref=e104]: ARES
                - generic [ref=e105]: Lib
          - listitem [ref=e106]:
            - link "3D Models Archive" [ref=e107] [cursor=pointer]:
              - /url: https://www.printables.com/@ARESFTC_3784306
          - listitem [ref=e108]:
            - link "CAD Workspace" [ref=e109] [cursor=pointer]:
              - /url: https://cad.onshape.com/documents?nodeId=681f8b6764dc7e001a56cb6e&resourceType=resourcecompanyowner
          - listitem [ref=e110]:
            - link "Official Store" [ref=e111] [cursor=pointer]:
              - /url: /store
              - img [ref=e112]
              - text: Official Store
      - generic [ref=e115]:
        - heading "Social Media" [level=4] [ref=e116]:
          - img [ref=e117]
          - text: Social Media
        - generic [ref=e120]:
          - link "Instagram" [ref=e121] [cursor=pointer]:
            - /url: https://instagram.com/ares23247
            - img [ref=e122]
          - link "YouTube" [ref=e124] [cursor=pointer]:
            - /url: https://www.youtube.com/@ARESFTC
            - img [ref=e125]
          - link "Facebook" [ref=e127] [cursor=pointer]:
            - /url: https://www.facebook.com/ARES23247
            - img [ref=e128]
          - link "TikTok" [ref=e130] [cursor=pointer]:
            - /url: https://tiktok.com/@ares.robotics.23247
            - img [ref=e131]
          - link "GitHub Organization" [ref=e133] [cursor=pointer]:
            - /url: https://github.com/ARES-23247
            - img [ref=e134]
          - link "X (Twitter)" [ref=e136] [cursor=pointer]:
            - /url: https://twitter.com/ARESFTC
            - img [ref=e137]
          - link "LinkedIn" [ref=e139] [cursor=pointer]:
            - /url: https://www.linkedin.com/company/ares-23247
            - img [ref=e140]
          - link "Zulip Team Chat" [ref=e142] [cursor=pointer]:
            - /url: https://aresfirst.zulipchat.com
            - img [ref=e143]
          - link "Bluesky" [ref=e145] [cursor=pointer]:
            - /url: https://bsky.app/profile/ares23247.bsky.social
            - img [ref=e146]
          - link "Email Us" [ref=e148] [cursor=pointer]:
            - /url: mailto:contact@aresfirst.org
            - img [ref=e149]
        - generic [ref=e152]:
          - generic [ref=e153]:
            - paragraph [ref=e154]: Direct Contact
            - link "contact@aresfirst.org" [ref=e155] [cursor=pointer]:
              - /url: mailto:contact@aresfirst.org
          - generic [ref=e156]:
            - img [ref=e157]
            - paragraph [ref=e160]: Official ARES Portal. All student data is protected under FIRST YPP.
    - generic [ref=e161]:
      - generic [ref=e162]:
        - paragraph [ref=e163]:
          - generic [ref=e164]: © 2026
          - generic [ref=e165]: ARES
          - text: 23247. All Rights Reserved.
        - paragraph [ref=e166]: Made with ♥ in Morgantown, West Virginia
      - generic [ref=e167]:
        - link "Accessibility" [ref=e168] [cursor=pointer]:
          - /url: /accessibility
          - img [ref=e170]
          - text: Accessibility
        - link "Privacy" [ref=e173] [cursor=pointer]:
          - /url: /privacy
          - img [ref=e174]
          - text: Privacy
        - link "Tech Stack" [ref=e178] [cursor=pointer]:
          - /url: /tech-stack
        - link "SUPPORT ARES" [ref=e179] [cursor=pointer]:
          - /url: /sponsors
          - img [ref=e180]
          - text: SUPPORT ARES
        - generic [ref=e182]:
          - link "WAVE" [ref=e183] [cursor=pointer]:
            - /url: https://wave.webaim.org/
            - img "WAVE" [ref=e184]
          - generic [ref=e185]: PA11Y CI
```

# Test source

```ts
  16  | 
  17  |   test('User Management dashboard loads and displays user list', async ({ page }) => {
  18  |     await page.goto('/dashboard/users');
  19  | 
  20  |     // Wait for the page to load
  21  |     await expect(page.getByRole('heading', { name: /User Management/i })).toBeVisible({
  22  |       timeout: TEST_TIMEOUTS.SLOW_PAGE,
  23  |     });
  24  | 
  25  |     // Verify the table exists
  26  |     const userTable = page.getByRole('table');
  27  |     await expect(userTable).toBeVisible();
  28  |   });
  29  | 
  30  |   test('User role modification workflow', async ({ page }) => {
  31  |     await page.goto('/dashboard/users');
  32  | 
  33  |     // Wait for the page to load
  34  |     await expect(page.getByRole('heading', { name: /User Management/i })).toBeVisible();
  35  | 
  36  |     // Find the role select dropdown for the test user
  37  |     const roleSelect = page.locator('select').first();
  38  | 
  39  |     // Verify initial role exists
  40  |     await expect(roleSelect).toBeVisible();
  41  | 
  42  |     // Change the role to admin
  43  |     await roleSelect.selectOption('admin');
  44  | 
  45  |     // Wait for the mutation to complete
  46  |     await page.waitForTimeout(500);
  47  | 
  48  |     // Verify the select still has admin selected
  49  |     await expect(roleSelect).toHaveValue('admin');
  50  |   });
  51  | 
  52  |   test('Member type modification workflow', async ({ page }) => {
  53  |     await page.goto('/dashboard/users');
  54  | 
  55  |     // Wait for the page to load
  56  |     await expect(page.getByRole('heading', { name: /User Management/i })).toBeVisible();
  57  | 
  58  |     // Find a member type select dropdown
  59  |     const memberTypeSelect = page.locator('select').nth(1);
  60  | 
  61  |     // Verify member type select exists
  62  |     await expect(memberTypeSelect).toBeVisible();
  63  | 
  64  |     // Change the member type to mentor
  65  |     await memberTypeSelect.selectOption('mentor');
  66  | 
  67  |     // Wait for the mutation to complete
  68  |     await page.waitForTimeout(500);
  69  | 
  70  |     // Verify the member type was updated
  71  |     await expect(memberTypeSelect).toHaveValue('mentor');
  72  |   });
  73  | 
  74  |   test('Search functionality filters users', async ({ page }) => {
  75  |     await page.goto('/dashboard/users');
  76  | 
  77  |     // Wait for the page to load
  78  |     await expect(page.getByRole('heading', { name: /User Management/i })).toBeVisible();
  79  | 
  80  |     // Verify search input exists
  81  |     const searchInput = page.getByPlaceholder(/Search/i);
  82  |     await expect(searchInput).toBeVisible();
  83  |   });
  84  | 
  85  |   test('WCAG 2.1 AA accessibility audit', async ({ page }) => {
  86  |     await page.goto('/dashboard/users');
  87  | 
  88  |     // Wait for the page to fully load
  89  |     await expect(page.getByRole('heading', { name: /User Management/i })).toBeVisible({
  90  |       timeout: TEST_TIMEOUTS.SLOW_PAGE,
  91  |     });
  92  | 
  93  |     // Stabilize page for accessibility scan (disable animations)
  94  |     await page.addStyleTag({
  95  |       content: `
  96  |         *, *::before, *::after {
  97  |           transition: none !important;
  98  |           animation: none !important;
  99  |           opacity: 1 !important;
  100 |         }
  101 |       `,
  102 |     });
  103 | 
  104 |     // Run accessibility audit
  105 |     const accessibilityScanResults = await new AxeBuilder({ page })
  106 |       .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
  107 |       .analyze();
  108 | 
  109 |     expect(accessibilityScanResults.violations).toEqual([]);
  110 |   });
  111 | 
  112 |   test('User table is sortable', async ({ page }) => {
  113 |     await page.goto('/dashboard/users');
  114 | 
  115 |     // Wait for the page to load
> 116 |     await expect(page.getByRole('heading', { name: /User Management/i })).toBeVisible();
      |                                                                           ^ Error: expect(locator).toBeVisible() failed
  117 | 
  118 |     // Verify table exists
  119 |     const userTable = page.getByRole('table');
  120 |     await expect(userTable).toBeVisible();
  121 |   });
  122 | 
  123 |   test('Non-admin user is denied access', async ({ page }) => {
  124 |     // Setup auth with a non-admin user (author role) - use mock for this specific test
  125 |     // since we're testing access control behavior
  126 |     await page.route('**/api/auth/get-session', async (route) => {
  127 |       await route.fulfill({
  128 |         status: 200,
  129 |         json: {
  130 |           session: {
  131 |             id: 'author-session-id',
  132 |             userId: 'author-user',
  133 |             expiresAt: new Date(Date.now() + 10000000).toISOString(),
  134 |             ipAddress: '127.0.0.1',
  135 |             userAgent: 'Playwright',
  136 |           },
  137 |           user: {
  138 |             id: 'author-user',
  139 |             name: 'Author User',
  140 |             email: 'author@ares.org',
  141 |             emailVerified: true,
  142 |             image: 'https://api.dicebear.com/9.x/bottts/svg?seed=author',
  143 |             createdAt: new Date().toISOString(),
  144 |             updatedAt: new Date().toISOString(),
  145 |             role: 'author',
  146 |             banned: false,
  147 |           },
  148 |         },
  149 |       });
  150 |     });
  151 | 
  152 |     // Mock profile with author role
  153 |     await page.route('**/profile/me', async (route) => {
  154 |       await route.fulfill({
  155 |         status: 200,
  156 |         json: {
  157 |           user_id: 'author-user',
  158 |           nickname: 'Author User',
  159 |           first_name: 'Author',
  160 |           last_name: 'User',
  161 |           member_type: 'mentor',
  162 |           auth: {
  163 |             role: 'author',
  164 |           },
  165 |         },
  166 |       });
  167 |     });
  168 | 
  169 |     await page.goto('/dashboard/users');
  170 | 
  171 |     // Verify access denied message is shown
  172 |     await expect(page.getByText(/Access Denied/i)).toBeVisible({
  173 |       timeout: TEST_TIMEOUTS.SLOW_PAGE,
  174 |     });
  175 |   });
  176 | });
  177 | 
```