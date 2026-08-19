import { expect, test } from "@playwright/test";

/**
 * Smoke coverage for public routes that had no end-to-end assertions: every
 * listed route must render with its expected document title and a main
 * landmark, catching prerender/shell, routing, and PublicDataState
 * regressions that jsdom tests cannot see.
 */
const publicRoutes: Array<{ path: string; titlePart: string }> = [
  { path: "/calendar", titlePart: "Calendar" },
  { path: "/videos", titlePart: "Videos" },
  { path: "/robots", titlePart: "Robots" },
  { path: "/sponsors", titlePart: "Sponsors" },
  { path: "/gallery", titlePart: "Gallery" },
  { path: "/outreach", titlePart: "Outreach" },
  { path: "/seasons", titlePart: "Seasons" },
  { path: "/finance", titlePart: "Finance" },
  { path: "/join", titlePart: "Join" },
  { path: "/location-morgantown", titlePart: "Morgantown" },
  { path: "/robotics-west-virginia", titlePart: "West Virginia" },
  { path: "/accessibility", titlePart: "Accessibility" },
];

for (const { path, titlePart } of publicRoutes) {
  test(`public route ${path} renders with its title and main landmark`, async ({
    page,
  }) => {
    await page.goto(path, { waitUntil: "domcontentloaded" });

    // The SPA sets the document title via the SEO component after mount.
    await expect
      .poll(() => page.title(), { timeout: 20_000 })
      .toContain(titlePart);

    await expect(page.locator("main").first()).toBeVisible();
  });
}
