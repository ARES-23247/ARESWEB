import { test, expect } from "./fixtures";

test.describe("Navigation & Accessibility E2E tests", () => {
  test("should navigate to homepage and verify branding", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(
      "ARES 23247 | West Virginia Robotics Team (Morgantown, WV)",
    );
    // The team—not one of its software projects—is the primary homepage identity.
    const heroHeading = page.getByRole("heading", {
      name: "ARES 23247 — Engineered To Inspire",
    });
    await expect(heroHeading).toBeVisible();
    const watermarkMask = await page
      .getByTestId("hero-watermark")
      .evaluate((element) => {
        const style = getComputedStyle(element);
        return style.maskImage || style.webkitMaskImage;
      });
    expect(watermarkMask).toContain("radial-gradient");

    // Verify key button "View Schedule" is visible
    const viewScheduleButton = page.getByRole("link", {
      name: "View Schedule",
    });
    await expect(viewScheduleButton).toBeVisible();

    // ARES Robotics Studio remains identifiable as a secondary team project for OAuth
    // verification, without displacing the team's public identity.
    const analyticsSection = page.getByLabel("ARES Robotics Studio");
    await expect(
      analyticsSection.getByRole("heading", { name: "ARES Robotics Studio" }),
    ).toBeVisible();
    await expect(
      analyticsSection.getByRole("link", { name: "Privacy" }),
    ).toHaveAttribute("href", "/privacy");
    await expect(
      analyticsSection.getByRole("link", { name: "Terms" }),
    ).toHaveAttribute("href", "/terms");
  });

  test("should have a working skip link for accessibility", async ({
    page,
    browserName,
  }) => {
    await page.goto("/");

    const skipLink = page.getByRole("link", { name: "Skip to main content" });

    // Press tab to focus the skip link
    if (browserName === "webkit") {
      await skipLink.focus();
    } else {
      await page.keyboard.press("Tab");
    }

    // Check that the active element is indeed the skip link
    await expect(skipLink).toBeFocused();

    // Activate the keyboard bypass control.
    await page.keyboard.press("Enter");

    // The focus or element target should scroll/move to main content
    const mainContent = page.locator("#main-content");
    await expect(mainContent).toBeVisible();
    await expect(mainContent).toBeFocused();
  });

  test("should navigate to public page about roster", async ({ page }) => {
    await page.goto("/about");
    // Ensure the unique about heading is visible
    const aboutHeading = page.getByRole("heading", { name: "About ARES" });
    await expect(aboutHeading).toBeVisible();

    // Ensure the roster section heading is visible
    const rosterHeading = page.getByRole("heading", {
      name: "Our Championship Roster",
    });
    await expect(rosterHeading).toBeVisible();
  });

  test("mobile navigation traps focus and returns it after Escape", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");

    const trigger = page.locator(
      'button[aria-controls="mobile-navigation-drawer"]',
    );
    await expect(trigger).toHaveAccessibleName("Open navigation menu");
    await trigger.click();
    await expect(
      page.getByRole("dialog", { name: "Mobile navigation menu" }),
    ).toBeVisible();
    await expect(trigger).toHaveAttribute("aria-expanded", "true");

    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("dialog", { name: "Mobile navigation menu" }),
    ).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test("homepage and public navigation reflow at a 320px mobile viewport", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto("/");

    const heading = page.getByRole("heading", {
      name: "ARES 23247 — Engineered To Inspire",
    });
    await expect(heading).toBeVisible();

    const reflow = await heading.evaluate((element) => {
      const viewportWidth = document.documentElement.clientWidth;
      const textLines = Array.from(
        element.querySelectorAll(":scope > span:not(.sr-only)"),
      );
      return {
        documentWidth: document.documentElement.scrollWidth,
        viewportWidth,
        linesFit: textLines.every((line) => {
          const rect = line.getBoundingClientRect();
          return rect.left >= 0 && rect.right <= viewportWidth + 1;
        }),
      };
    });
    expect(reflow.documentWidth).toBeLessThanOrEqual(reflow.viewportWidth);
    expect(reflow.linesFit).toBe(true);

    const trigger = page.getByRole("button", { name: "Open navigation menu" });
    const triggerBox = await trigger.boundingBox();
    expect(triggerBox?.width).toBeGreaterThanOrEqual(44);
    expect(triggerBox?.height).toBeGreaterThanOrEqual(44);

    await trigger.click();
    const drawer = page.getByRole("dialog", { name: "Mobile navigation menu" });
    await expect(drawer).toBeVisible();
    const targetHeights = await drawer
      .getByRole("link")
      .or(drawer.getByRole("button"))
      .evaluateAll((targets) =>
        targets.map((target) => target.getBoundingClientRect().height),
      );
    expect(targetHeights.every((height) => height >= 44)).toBe(true);
  });

  test("analytics choices are usable on mobile and can be changed from privacy", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto("/");
    // The shared E2E fixture defaults unset consent to "denied" so routine
    // tests do not render the banner. Use an invalid, non-empty sentinel here:
    // the fixture leaves it alone and the application truthfully treats it as
    // no saved choice on the following page load.
    await page.evaluate(() =>
      localStorage.setItem("ares_analytics_consent_v1", "test-unset"),
    );
    await page.reload();

    const banner = page.getByRole("region", {
      name: "Optional website analytics",
    });
    await expect(banner).toBeVisible();
    const bounds = await banner.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return {
        left: rect.left,
        right: rect.right,
        viewportWidth: document.documentElement.clientWidth,
        documentWidth: document.documentElement.scrollWidth,
      };
    });
    expect(bounds.left).toBeGreaterThanOrEqual(0);
    expect(bounds.right).toBeLessThanOrEqual(bounds.viewportWidth + 1);
    expect(bounds.documentWidth).toBeLessThanOrEqual(bounds.viewportWidth);

    const choices = banner.getByRole("button");
    const choiceSizes = await choices.evaluateAll((buttons) =>
      buttons.map((button) => button.getBoundingClientRect().height),
    );
    expect(choiceSizes.every((height) => height >= 44)).toBe(true);

    await banner.getByRole("button", { name: "Keep cookie-free" }).click();
    await expect(banner).toBeHidden();
    await expect
      .poll(() =>
        page.evaluate(() => localStorage.getItem("ares_analytics_consent_v1")),
      )
      .toBe("denied");

    await page.goto("/privacy");
    await expect(
      page.getByText("This browser remains cookie-free for analytics."),
    ).toBeVisible();
    await page.getByRole("button", { name: "Change analytics choice" }).click();
    await expect(banner).toBeVisible();
    await banner.getByRole("button", { name: "Allow analytics" }).click();
    await expect(
      page.getByText("Analytics is allowed in this browser."),
    ).toBeVisible();
  });

  test("mobile footer links open the destination at the top of the page", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");

    const footer = page.getByRole("contentinfo", { name: "Site Footer" });
    const westVirginiaLink = footer.getByRole("link", {
      name: "Robotics in West Virginia",
    });
    await westVirginiaLink.scrollIntoViewIfNeeded();
    expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);

    await westVirginiaLink.click();

    await expect(page).toHaveURL(/\/robotics-west-virginia$/);
    await expect(
      page.getByRole("heading", { name: "Robotics in West Virginia" }),
    ).toBeVisible();
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  });

  test("admin mobile navigation is an in-bounds modal and closes after navigation", async ({
    page,
    loginAs,
  }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await loginAs("admin");
    await page.goto("/dashboard");

    const trigger = page.getByRole("button", { name: "Open sidebar menu" });
    await trigger.click();

    const drawer = page.getByRole("dialog", { name: "Portal navigation" });
    await expect(drawer).toBeVisible();
    await expect(drawer).toHaveAttribute("aria-modal", "true");

    const bounds = await drawer.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      const close = element.querySelector<HTMLButtonElement>(
        'button[aria-label="Close sidebar"]',
      );
      const closeRect = close?.getBoundingClientRect();
      return {
        left: rect.left,
        right: rect.right,
        viewportWidth: document.documentElement.clientWidth,
        closeRight: closeRect?.right ?? Number.POSITIVE_INFINITY,
        closeWidth: closeRect?.width ?? 0,
        closeHeight: closeRect?.height ?? 0,
      };
    });
    expect(bounds.left).toBeGreaterThanOrEqual(0);
    expect(bounds.right).toBeLessThanOrEqual(bounds.viewportWidth + 1);
    expect(bounds.closeRight).toBeLessThanOrEqual(bounds.viewportWidth + 1);
    expect(bounds.closeWidth).toBeGreaterThanOrEqual(44);
    expect(bounds.closeHeight).toBeGreaterThanOrEqual(44);

    const targetHeights = await drawer
      .getByRole("link")
      .or(drawer.getByRole("button"))
      .evaluateAll((targets) =>
        targets.map((target) => target.getBoundingClientRect().height),
      );
    expect(targetHeights.every((height) => height >= 44)).toBe(true);

    await drawer.getByRole("link", { name: "Manage Users" }).click();
    await expect(page).toHaveURL(/\/dashboard\/users$/);
    await expect(drawer).toBeHidden();
  });

  test.describe("opaque simulation frame", () => {
    // Playwright's global service-worker blocking shim probes
    // navigator.serviceWorker inside every frame. That getter intentionally
    // throws in our allow-scripts-only opaque iframe, so this isolated context
    // permits service workers and validates the application rather than the shim.
    test.use({ serviceWorkers: "allow" });

    test("simulation playground remains usable at a 320px mobile viewport", async ({
      page,
    }) => {
      await page.setViewportSize({ width: 320, height: 568 });
      await page.goto("/academy/playground");

      await expect(
        page.getByRole("heading", { name: "Simulation Playground" }),
      ).toBeVisible();

      const toolbar = page.getByLabel("Simulation editor toolbar");
      await expect(toolbar).toBeVisible();
      await expect(page.getByRole("button", { name: "Run" })).toBeVisible();
      await expect(page.getByLabel("Simulation name")).toBeVisible();

      const measurements = await toolbar.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        const controls = Array.from(
          element.querySelectorAll<HTMLElement>("button, input"),
        );
        return {
          documentWidth: document.documentElement.scrollWidth,
          viewportWidth: document.documentElement.clientWidth,
          toolbarLeft: rect.left,
          toolbarRight: rect.right,
          targetSizes: controls.map((control) => {
            const bounds = control.getBoundingClientRect();
            return { width: bounds.width, height: bounds.height };
          }),
        };
      });

      expect(measurements.documentWidth).toBeLessThanOrEqual(
        measurements.viewportWidth,
      );
      expect(measurements.toolbarLeft).toBeGreaterThanOrEqual(0);
      expect(measurements.toolbarRight).toBeLessThanOrEqual(
        measurements.viewportWidth + 1,
      );
      expect(
        measurements.targetSizes.every(
          ({ width, height }) => width >= 44 && height >= 44,
        ),
      ).toBe(true);
    });
  });
});
