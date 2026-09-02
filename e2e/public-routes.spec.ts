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
  { path: "/blog", titlePart: "Blog" },
  { path: "/academy", titlePart: "ARES Academy" },
  { path: "/buzzello", titlePart: "BUZZELLO" },
  { path: "/docs", titlePart: "ARESLib Documentation" },
  { path: "/finance", titlePart: "Financial Transparency Ledger" },
  { path: "/join", titlePart: "Join the Team" },
  { path: "/accessibility", titlePart: "Accessibility" },
];

test("public routes render with their titles and a main landmark", async ({ page, context }) => {
  // Vite preview has no Firebase Hosting /api rewrite. Keep this rendering
  // smoke test deterministic and leave backend behavior to API integration
  // tests instead of allowing WebKit to reject preview-server requests.
  // Context-level routing also covers requests issued while WebKit replaces
  // the document during rapid sequential navigations. Page-level routing can
  // briefly detach with the old document and let a preview-only /api request
  // escape to Vite, where no Firebase Hosting rewrite exists.
  await context.route(/\/api\//, async (route) => {
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
        awards: [],
        posts: [],
        documents: [],
        entries: [],
        transactions: [],
        nextCursor: null,
      }),
    });
  });
  await context.route("https://firestore.googleapis.com/**", (route) => route.abort("blockedbyclient"));
  await context.route(
    /^https:\/\/(?:www\.)?(?:youtube\.com|youtube-nocookie\.com)\//u,
    (route) => route.abort("blockedbyclient"),
  );
  for (const { path, titlePart } of publicRoutes) {
    // Let route effects and their stubbed API requests settle before replacing
    // the document. The YouTube embed is blocked above so third-party background
    // requests cannot make this local network-idle check nondeterministic.
    await page.goto(path, { waitUntil: "networkidle" });
    await expect(page).toHaveTitle(new RegExp(titlePart), { timeout: 15_000 });
    await expect(page.locator("main").first()).toBeVisible();
    if (path === "/academy" || path === "/docs") {
      await expect(
        page.getByRole("heading", { name: "No Lessons Yet" }),
      ).toBeVisible();
    }
  }
});

test("same-origin gallery media renders without direct Storage traffic", async ({ page, context }) => {
  const onePixelPng = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    "base64",
  );
  let gatewayRequests = 0;
  let directStorageRequests = 0;

  await context.route(/https:\/\/(?:firebasestorage\.googleapis\.com|storage\.googleapis\.com)\//u, async (route) => {
    directStorageRequests += 1;
    await route.abort("blockedbyclient");
  });
  await context.route(/\/api\/photos\/public(?:\?|\/)/u, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.includes("/media/")) {
      gatewayRequests += 1;
      await route.fulfill({ status: 200, contentType: "image/png", body: onePixelPng });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        photos: [{
          id: "photo-1",
          caption: "Drive practice",
          altText: "Drive practice progress",
          category: "Practice",
          publicUrl: "/api/photos/public/media/photo-1/original",
          thumbnailUrl: "/api/photos/public/media/photo-1/thumbnail",
        }],
        hasMore: false,
        nextCursor: null,
      }),
    });
  });

  await page.goto("/gallery", { waitUntil: "networkidle" });
  const thumbnail = page.getByRole("img", { name: "Drive practice progress" }).first();
  await expect(thumbnail).toBeVisible();
  await expect.poll(() => thumbnail.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
  await thumbnail.click();
  const lightboxImage = page.getByRole("dialog").getByRole("img", { name: "Drive practice progress" });
  await expect(lightboxImage).toBeVisible();
  await expect.poll(() => lightboxImage.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
  expect(gatewayRequests).toBeGreaterThanOrEqual(2);
  expect(directStorageRequests).toBe(0);
});
