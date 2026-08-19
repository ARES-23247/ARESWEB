import { expect, test } from "./fixtures";

/**
 * Smoke coverage for public routes that had no end-to-end assertions: each
 * route must render with its expected document title and a main landmark.
 * Runs as a single sequential test so the suite cost stays bounded across
 * every browser project.
 */
const publicRoutes: Array<{ path: string; titlePart: string }> = [
  { path: "/calendar", titlePart: "Team Calendar" },
  { path: "/videos", titlePart: "Video Hub" },
  { path: "/robots", titlePart: "Our Robots" },
  { path: "/sponsors", titlePart: "Our Sponsors" },
  { path: "/gallery", titlePart: "Photo Gallery" },
  { path: "/outreach", titlePart: "Community Outreach" },
  { path: "/seasons", titlePart: "Team Legacy" },
  { path: "/finance", titlePart: "Financial Transparency Ledger" },
  { path: "/join", titlePart: "Join the Team" },
  { path: "/accessibility", titlePart: "Accessibility" },
];

test("public routes render with their titles and a main landmark", async ({ page, context }) => {
  // Vite preview has no Firebase Hosting /api rewrite. Keep this rendering
  // smoke test deterministic and leave backend behavior to API integration
  // tests instead of allowing WebKit to reject preview-server requests.
  await page.route("**/api/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        events: [],
        videos: [],
        robots: [],
        sponsors: [],
        photos: [],
        outreach: [],
        logs: [],
        seasons: [],
        entries: [],
        transactions: [],
        nextCursor: null,
      }),
    });
  });
  await context.route("https://firestore.googleapis.com/**", (route) => route.abort("blockedbyclient"));
  for (const { path, titlePart } of publicRoutes) {
    await page.goto(path, { waitUntil: "domcontentloaded" });
    await expect(page).toHaveTitle(new RegExp(titlePart), { timeout: 15_000 });
    await expect(page.locator("main").first()).toBeVisible();
  }
});
