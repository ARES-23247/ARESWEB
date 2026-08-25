import { test, expect } from "./fixtures";

async function expectNoHorizontalOverflow(page: import("@playwright/test").Page) {
  const overflow = await page.locator("html").evaluate((element) => {
    const viewportWidth = element.clientWidth;
    const offenders = Array.from(document.querySelectorAll<HTMLElement>("body *"))
      .map((candidate) => {
        const bounds = candidate.getBoundingClientRect();
        return {
          tag: candidate.tagName.toLowerCase(),
          className: typeof candidate.className === "string" ? candidate.className : "",
          left: Math.round(bounds.left * 100) / 100,
          right: Math.round(bounds.right * 100) / 100,
        };
      })
      .filter(({ left, right }) => left < 0 || right > viewportWidth)
      .slice(0, 10);

    return { documentWidth: element.scrollWidth, viewportWidth, offenders };
  });

  expect(overflow.documentWidth, JSON.stringify(overflow.offenders, null, 2))
    .toBeLessThanOrEqual(overflow.viewportWidth);
}

const lesson = {
  slug: "robot-state-flow",
  title: "Robot State Flow",
  category: "Robotics & Engineering",
  sortOrder: 1,
  description: "Trace driver intent through Redux state and cached hardware IO.",
  status: "published",
  isDeleted: 0,
  isPortfolio: 0,
  isExecutiveSummary: 0,
  displayInAreslib: 0,
  displayInMathCorner: 0,
  displayInScienceCorner: 1,
  learningSchemaVersion: 1,
  metadataStatus: "complete",
  subject: "robotics-engineering",
  topics: ["Redux", "control flow"],
  contentType: "guided-lab",
  level: "beginner",
  estimatedMinutes: 30,
  pathMemberships: [{ pathId: "robotics-foundations", order: 1 }],
  prerequisites: [],
  objectives: ["Trace one control cycle."],
  platforms: ["simulator", "ftc"],
  sourceReferences: [{
    label: "Released architecture",
    url: "https://github.com/ARES-23247/ARESLib-Kotlin/blob/c7af7d2399815ffc3474a89e8dc08adfe31a534c/docs/architecture.md",
    revision: "v9.10.0",
    blobHash: "c096b51711c57f37d8da7799ccfceb07c0b1d2b0",
  }],
  appliesToVersion: "ARESLib 9.10.0",
  reviewedAt: "2026-08-25",
  reviewedByLabel: "ARES software mentor",
  safetyScope: "simulation-only",
};

test("Academy learning paths and lesson metadata remain usable on a 320px viewport", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.route("**/api/content/docs**", async (route) => {
    const detail = new URL(route.request().url()).pathname !== "/api/content/docs";
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(detail
        ? { document: { ...lesson, content: "# Robot State Flow\n\nThis lab uses simulation before hardware." } }
        : { documents: [lesson] }),
    });
  });

  await page.goto("/academy", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "ARES Academy" })).toBeVisible();
  await expect(page.getByRole("main")).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "Learning paths" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Robot State Flow/i })).toBeVisible();

  await page.getByRole("button", { name: /Robotics Foundations/i }).click();
  await expect(page.getByText("Suggested step 1", { exact: true })).toBeVisible();
  await expect(page.getByText("Personal completion is not collected or stored.", { exact: false })).toBeVisible();

  await expectNoHorizontalOverflow(page);

  await page.getByRole("link", { name: /Robot State Flow/i }).click();
  await expect(page).toHaveURL(/\/academy\/robot-state-flow$/u);
  await expect(page.getByRole("heading", { level: 1, name: "Robot State Flow" })).toBeVisible();
  await expect(page.getByText("Simulation only", { exact: true })).toBeVisible();
  await expect(page.getByText("Applies to ARESLib 9.10.0")).toBeVisible();
  await expect(page.getByRole("link", { name: /Released architecture.*v9.10.0/u })).toHaveAttribute("href", lesson.sourceReferences[0].url);

  await expectNoHorizontalOverflow(page);
  const docsNavigationButton = page.getByRole("button", { name: "Open documentation navigation" });
  const buttonBox = await docsNavigationButton.boundingBox();
  expect(buttonBox?.width).toBeGreaterThanOrEqual(44);
  expect(buttonBox?.height).toBeGreaterThanOrEqual(44);
});
