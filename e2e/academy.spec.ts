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

const nextLesson = {
  ...lesson,
  slug: "safe-output-boundaries",
  title: "Safe Output Boundaries",
  sortOrder: 2,
  description: "Distinguish requested outputs from confirmed hardware writes.",
  topics: ["hardware IO", "safety"],
  estimatedMinutes: 20,
  pathMemberships: [{ pathId: "robotics-foundations", order: 2 }],
  prerequisites: [lesson.slug],
  objectives: ["Explain a neutral-first recovery boundary."],
};

const replayLesson = {
  ...lesson,
  slug: "testing-logs-replay",
  title: "Compare Logs and Replay a Failure",
  description: "Read exact, held, and missing evidence without borrowing a future sample.",
  level: "intermediate",
  pathMemberships: [{ pathId: "testing-debugging-commissioning", order: 3 }],
  prerequisites: ["read-a-telemetry-graph", "simulation-is-not-hardware-validation"],
  objectives: ["Read exact, held, and missing replay evidence."],
  appliesToVersion: "ARES 11.1.0; Studio 2.0.3",
};

const matchCycleLesson = {
  ...lesson,
  slug: "competition-drive-team",
  title: "Run a Drive-Team Match Cycle",
  description: "Practice bounded handoffs without inventing event rules.",
  level: "intermediate",
  pathMemberships: [{ pathId: "competition-operations", order: 3 }],
  prerequisites: ["simulation-is-not-hardware-validation"],
  objectives: ["Rehearse one explicit match-cycle handoff."],
  platforms: ["ftc", "frc"],
  appliesToVersion: "ARES 11.1.0; event-specific rules require current official review",
  safetyScope: "physical-robot",
};

const inspectionLesson = {
  ...matchCycleLesson,
  slug: "competition-ftc-inspection-pit",
  title: "Prepare an FTC Robot for Inspection and the Pit",
  description: "Build a source-backed practice packet without claiming an inspection result.",
  pathMemberships: [{ pathId: "competition-operations", order: 1 }],
  objectives: ["Audit the evidence in a practice inspection packet."],
};

const frcModeLesson = {
  ...matchCycleLesson,
  slug: "frc-mode-handoffs-and-safe-recovery",
  title: "Keep FRC Mode Changes Safe",
  description: "Trace current FRC mode handoffs and persistent fault recovery.",
  pathMemberships: [{ pathId: "frc-robot-with-ares", order: 6 }],
  prerequisites: ["redux-state-actions-reducers", "programming-io-caching"],
  objectives: ["Compare ordered guards with the current FRC lifecycle."],
  platforms: ["frc", "simulator"],
  appliesToVersion: "ARES 13.0.0; ARES-FRC 12.0.0; WPILib 2026.2.1; Studio 3.1.0",
};

test("Academy learning paths and lesson metadata remain usable on a 320px viewport", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.route("**/api/content/docs**", async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    const detail = pathname !== "/api/content/docs";
    const selected = pathname.endsWith(nextLesson.slug) ? nextLesson : lesson;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(detail
        ? { document: { ...selected, content: `# ${selected.title}\n\nThis lab uses simulation before hardware.` } }
        : { documents: [lesson, nextLesson] }),
    });
  });

  await page.goto("/academy", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "ARES Academy" })).toBeVisible();
  await expect(page.getByRole("main")).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "Learning paths" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Robot State Flow/i })).toBeVisible();

  const pathButton = page.getByRole("button").filter({
    has: page.getByText("Robotics Foundations", { exact: true }),
  });
  await pathButton.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/path=robotics-foundations/u);
  await expect(page.getByText("Suggested step 1", { exact: true })).toBeVisible();
  await expect(page.getByText("Progress is private to this browser.", { exact: false })).toBeVisible();

  await page.getByLabel("Platform").selectOption("simulator");
  await page.getByLabel("Duration").selectOption("30");
  await page.getByLabel("Search titles and topics").fill("control flow");
  await expect(page).toHaveURL(/search=control(?:\+|%20)flow/u);
  await expect(page.getByText("Showing 1 of 2 items.")).toBeVisible();
  await page.getByRole("button", { name: "Clear filters" }).first().click();
  await expect(page).not.toHaveURL(/search=|path=/u);
  await expect(page.getByLabel("Search titles and topics")).toHaveValue("");
  await expect(page.getByLabel("Platform")).toHaveValue("all");
  await expect(page.getByLabel("Duration")).toHaveValue("all");
  await expect(page.getByText("Showing 2 of 2 items.")).toBeVisible();

  await pathButton.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("link", { name: /Start path/i })).toBeVisible();
  await expect(page.getByText("Ready next", { exact: true })).toBeVisible();
  await expect(page.getByText("1 prerequisite remaining", { exact: true })).toBeVisible();

  await expectNoHorizontalOverflow(page);

  await page.getByRole("link", { name: /Start path/i }).click();
  await expect(page).toHaveURL(/\/academy\/robot-state-flow\?path=robotics-foundations$/u);
  await expect(page.getByRole("heading", { level: 1, name: "Robot State Flow" })).toBeVisible();
  await expect(page.getByText("Simulation only", { exact: true })).toBeVisible();
  await expect(page.getByText("Applies to ARESLib 9.10.0")).toBeVisible();
  await expect(page.getByRole("link", { name: /Released architecture.*v9.10.0/u })).toHaveAttribute("href", lesson.sourceReferences[0].url);

  await page.getByRole("button", { name: "Mark lesson complete" }).click();
  await expect(page.getByRole("button", { name: "Completed — undo" })).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => page.evaluate(() => window.localStorage.getItem("ares-academy-progress-v1")))
    .toContain(lesson.slug);
  const nextLink = page.getByRole("link", { name: /Next Safe Output Boundaries/i });
  await expect(nextLink).toHaveAttribute("href", `/academy/${nextLesson.slug}?path=robotics-foundations`);
  await nextLink.click();
  await expect(page.getByRole("heading", { level: 1, name: nextLesson.title })).toBeVisible();
  await expect(page.getByText("Completed locally", { exact: true })).toBeVisible();

  await page.goto("/academy", { waitUntil: "networkidle" });
  await expect(page.getByText("1 of 2 complete on this browser", { exact: true }).first()).toBeVisible();
  await pathButton.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("link", { name: /Continue path/i })).toHaveAttribute(
    "href",
    `/academy/${nextLesson.slug}?path=robotics-foundations`,
  );
  await expect(page.getByText("Lesson completed", { exact: true })).toBeVisible();
  await expect(page.getByText("Ready next", { exact: true })).toBeVisible();
  await page.getByLabel("Progress").selectOption("completed");
  await expect(page).toHaveURL(/progress=completed/u);
  await expect(page.getByText("Showing 1 of 2 items.")).toBeVisible();
  const browseLibrary = page.locator('section[aria-labelledby="browse-library-heading"]');
  await expect(browseLibrary.getByRole("link", { name: /Robot State Flow/i })).toBeVisible();
  await expect(browseLibrary.getByRole("link", { name: /Safe Output Boundaries/i })).toHaveCount(0);

  await page.getByLabel("Progress").selectOption("not-started");
  await expect(page).toHaveURL(/progress=not-started/u);
  await expect(browseLibrary.getByRole("link", { name: /Safe Output Boundaries/i })).toBeVisible();
  await expect(browseLibrary.getByRole("link", { name: /Robot State Flow/i })).toHaveCount(0);

  await expectNoHorizontalOverflow(page);
  const docsNavigationButton = page.getByRole("button", { name: "Open documentation navigation" });
  const buttonBox = await docsNavigationButton.boundingBox();
  expect(buttonBox?.width).toBeGreaterThanOrEqual(44);
  expect(buttonBox?.height).toBeGreaterThanOrEqual(44);
});

test("the replay comparison lab exposes held and missing evidence by keyboard at 320px", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.route("**/api/content/docs**", async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    const detail = pathname !== "/api/content/docs";
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(detail
        ? { document: { ...replayLesson, content: "# Compare logs and replay a failure\n\n<logcomparisonlab />" } }
        : { documents: [replayLesson] }),
    });
  });

  await page.goto("/academy/testing-logs-replay?path=testing-debugging-commissioning", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "Log Alignment and Comparison Lab" })).toBeVisible();
  await page.getByLabel("Alignment anchor").selectOption("SHARED_EVENT");

  const playhead = page.getByRole("slider", { name: "Evidence time relative to anchor" });
  await expect(playhead).toHaveValue("0");
  await playhead.focus();
  for (let step = 0; step < 5; step += 1) await page.keyboard.press("ArrowLeft");

  await expect(playhead).toHaveValue("-50");
  await expect(page.getByText("Missing before first sample")).toBeVisible();
  await expect(page.getByText("1.0 A (held 10 ms)")).toBeVisible();
  await expect(page.getByText("Not comparable: one run has no earlier sample")).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("the match-cycle handoff lab resets phase evidence by keyboard at 320px", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.route("**/api/content/docs**", async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    const detail = pathname !== "/api/content/docs";
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(detail
        ? { document: { ...matchCycleLesson, content: "# Run a drive-team match cycle\n\n<matchcyclescenarios />" } }
        : { documents: [matchCycleLesson] }),
    });
  });

  await page.goto("/academy/competition-drive-team?path=competition-operations", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "Match Cycle Handoff Scenarios" })).toBeVisible();
  const pitPhase = page.getByRole("radio", { name: "Pit to queue" });
  const fieldPhase = page.getByRole("radio", { name: "Queue to field setup" });
  await expect(pitPhase).toBeChecked();

  await pitPhase.focus();
  await page.keyboard.press("ArrowRight");
  await expect(fieldPhase).toBeChecked();
  await expect(page.getByText("Rehearse the last transfer before the practice match begins.")).toBeVisible();

  const firstCheck = page.getByRole("checkbox").first();
  await firstCheck.focus();
  await page.keyboard.press("Space");
  await expect(firstCheck).toBeChecked();
  await expect(page.getByText("1 of 5")).toBeVisible();

  await page.getByRole("button", { name: "Reset rehearsal" }).click();
  await expect(pitPhase).toBeChecked();
  await expect(page.getByRole("checkbox").first()).not.toBeChecked();
  await expect(page.getByRole("note")).toContainText("cannot read a robot or event system");
  await expectNoHorizontalOverflow(page);
});

test("the inspection packet lab preserves evidence limits at 320px", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.route("**/api/content/docs**", async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    const detail = pathname !== "/api/content/docs";
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(detail
        ? { document: { ...inspectionLesson, content: "# Prepare an FTC robot for inspection\n\n<inspectionpacketlab />" } }
        : { documents: [inspectionLesson] }),
    });
  });

  await page.goto("/academy/competition-ftc-inspection-pit?path=competition-operations", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "Inspection Packet Evidence Lab" })).toBeVisible();
  const checks = page.getByRole("checkbox");
  await checks.first().focus();
  await page.keyboard.press("Space");
  await expect(checks.first()).toBeChecked();
  await expect(page.getByText(/record the current document identity/i)).toBeVisible();

  for (let index = 1; index < await checks.count(); index += 1) await checks.nth(index).check();
  await expect(page.getByText("Ready for a practice handoff")).toBeVisible();
  await expect(page.getByRole("note")).toContainText("does not load FIRST rules");
  await expect(page.getByRole("note")).toContainText("approve inspection");

  await page.getByRole("button", { name: "Reset packet" }).click();
  for (let index = 0; index < await checks.count(); index += 1) await expect(checks.nth(index)).not.toBeChecked();
  await expectNoHorizontalOverflow(page);
});

test("the FRC mode lesson practices guard precedence without claiming runtime proof at 320px", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.route("**/api/content/docs**", async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    const detail = pathname !== "/api/content/docs";
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(detail
        ? { document: { ...frcModeLesson, content: "# Keep FRC mode changes safe\n\n<superstructurestatelab />" } }
        : { documents: [frcModeLesson] }),
    });
  });

  await page.goto("/academy/frc-mode-handoffs-and-safe-recovery?path=frc-robot-with-ares", {
    waitUntil: "networkidle",
  });
  await expect(page.getByRole("heading", { name: "Superstructure State Coordination Lab" })).toBeVisible();

  const disabled = page.getByRole("checkbox", { name: "Robot is disabled" });
  await disabled.focus();
  await page.keyboard.press("Space");
  await expect(disabled).toBeChecked();
  await expect(page.getByText("Disabled policy runs first")).toBeVisible();

  await page.getByRole("button", { name: "Evaluate next tick" }).click();
  await expect(page.getByText("Current posture").locator("..")).toContainText("STOWED");
  await page.getByRole("button", { name: "Reset" }).click();
  await expect(disabled).not.toBeChecked();
  await expect(page.getByRole("note")).toContainText("invented three-posture model");
  await expect(page.getByRole("note")).toContainText("prove safe motion");
  await expectNoHorizontalOverflow(page);
});
