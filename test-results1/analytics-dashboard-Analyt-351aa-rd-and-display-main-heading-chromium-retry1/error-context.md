# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: analytics-dashboard.spec.ts >> Analytics Dashboard >> should load analytics dashboard and display main heading
- Location: tests/e2e/analytics-dashboard.spec.ts:21:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('heading', { name: /Platform Analytics/i })
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByRole('heading', { name: /Platform Analytics/i })

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
  1   | import { test, expect } from '@playwright/test';
  2   | import AxeBuilder from '@axe-core/playwright';
  3   | import { DashboardPage } from '../pages/DashboardPage';
  4   | import { setupMockAuth } from '../fixtures/auth';
  5   | import { TEST_TIMEOUTS } from '../fixtures/mock-data';
  6   | 
  7   | test.describe('Analytics Dashboard', () => {
  8   |   let dashboardPage: DashboardPage;
  9   | 
  10  |   test.beforeEach(async ({ page }) => {
  11  |     dashboardPage = new DashboardPage(page);
  12  | 
  13  |     // Set up real authentication - tests now hit real APIs with seeded test data
  14  |     await setupMockAuth(page, { useRealAuth: true });
  15  |   });
  16  | 
  17  |   test.afterEach(async ({ page }) => {
  18  |     await page.context().clearCookies();
  19  |   });
  20  | 
  21  |   test('should load analytics dashboard and display main heading', async ({ page }) => {
  22  |     await page.goto('/dashboard/analytics');
  23  | 
  24  |     // Wait for page to load
  25  |     await page.waitForLoadState('domcontentloaded');
  26  | 
  27  |     // Verify main heading is visible
> 28  |     await expect(page.getByRole('heading', { name: /Platform Analytics/i })).toBeVisible();
      |                                                                              ^ Error: expect(locator).toBeVisible() failed
  29  |     await expect(page.getByText(/Real-time visibility into platform traffic/i)).toBeVisible();
  30  |   });
  31  | 
  32  |   test('should display quick stats cards', async ({ page }) => {
  33  |     await page.goto('/dashboard/analytics');
  34  | 
  35  |     // Wait for page to load
  36  |     await page.waitForLoadState('domcontentloaded');
  37  | 
  38  |     // Verify stats sections are visible (actual values come from seeded database)
  39  |     await expect(page.getByText('Total Views')).toBeVisible();
  40  |     await expect(page.getByText('Unique Visitors')).toBeVisible();
  41  |     await expect(page.getByText('Total Assets')).toBeVisible();
  42  |     await expect(page.getByText('API Calls')).toBeVisible();
  43  |   });
  44  | 
  45  |   test('should display 30-Day Activity chart', async ({ page }) => {
  46  |     await page.goto('/dashboard/analytics');
  47  | 
  48  |     // Wait for page to load
  49  |     await page.waitForLoadState('domcontentloaded');
  50  | 
  51  |     // Verify 30-Day Activity section is visible
  52  |     await expect(page.getByText('30-Day Activity')).toBeVisible();
  53  | 
  54  |     // Verify the chart renders (Tremor charts create SVG elements)
  55  |     const chart = page.locator('svg').filter({ has: page.locator('text') }).first();
  56  |     await expect(chart).toBeVisible();
  57  |   });
  58  | 
  59  |   test('should display API Latency chart', async ({ page }) => {
  60  |     await page.goto('/dashboard/analytics');
  61  | 
  62  |     // Wait for page to load
  63  |     await page.waitForLoadState('domcontentloaded');
  64  | 
  65  |     // Verify API Latency section is visible
  66  |     await expect(page.getByText('API Latency (ms)')).toBeVisible();
  67  | 
  68  |     // Verify the chart renders
  69  |     const chart = page.locator('svg').filter({ has: page.locator('text') }).first();
  70  |     await expect(chart).toBeVisible();
  71  |   });
  72  | 
  73  |   test('should display traffic distribution donut chart', async ({ page }) => {
  74  |     await page.goto('/dashboard/analytics');
  75  | 
  76  |     // Wait for page to load
  77  |     await page.waitForLoadState('domcontentloaded');
  78  | 
  79  |     // Verify Traffic Distribution section
  80  |     await expect(page.getByText('Traffic Distribution')).toBeVisible();
  81  |   });
  82  | 
  83  |   test('should display top referrers bar list', async ({ page }) => {
  84  |     await page.goto('/dashboard/analytics');
  85  | 
  86  |     // Wait for page to load
  87  |     await page.waitForLoadState('domcontentloaded');
  88  | 
  89  |     // Verify Top Referrers section
  90  |     await expect(page.getByText('Top Referrers')).toBeVisible();
  91  |   });
  92  | 
  93  |   test('should display real-time feed with recent views', async ({ page }) => {
  94  |     await page.goto('/dashboard/analytics');
  95  | 
  96  |     // Wait for page to load
  97  |     await page.waitForLoadState('domcontentloaded');
  98  | 
  99  |     // Verify Real-time Feed section exists
  100 |     await expect(page.getByText('Real-time Feed')).toBeVisible();
  101 |   });
  102 | 
  103 |   test('should display impact breakdown with top pages', async ({ page }) => {
  104 |     await page.goto('/dashboard/analytics');
  105 | 
  106 |     // Wait for page to load
  107 |     await page.waitForLoadState('domcontentloaded');
  108 | 
  109 |     // Verify Impact Breakdown section exists
  110 |     await expect(page.getByText('Impact Breakdown')).toBeVisible();
  111 |   });
  112 | 
  113 |   test('should handle loading state correctly', async ({ page }) => {
  114 |     await page.goto('/dashboard/analytics');
  115 | 
  116 |     // Verify the page eventually loads with data
  117 |     await expect(page.getByRole('heading', { name: /Platform Analytics/i })).toBeVisible({
  118 |       timeout: TEST_TIMEOUTS.SLOW_PAGE,
  119 |     });
  120 |   });
  121 | 
  122 |   test('should pass WCAG 2.1 AA accessibility audit', async ({ page }) => {
  123 |     await page.goto('/dashboard/analytics');
  124 | 
  125 |     // Wait for page to load and stabilize
  126 |     await page.waitForLoadState('domcontentloaded');
  127 |     await dashboardPage.stabilizeForAccessibility();
  128 | 
```