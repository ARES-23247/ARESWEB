import { expect, test } from "@playwright/test";

test("registers the production worker and serves its precached shell offline", async ({
  context,
  page,
}) => {
  await page.goto("/");

  const workerUrl = await page.evaluate(async () => {
    if (!("serviceWorker" in navigator)) return "";
    const registration = await navigator.serviceWorker.ready;
    return registration.active?.scriptURL ?? "";
  });
  expect(workerUrl).toMatch(/\/sw\.js$/);

  await page.reload();
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));

  try {
    await context.setOffline(true);
    const cachedShell = await page.evaluate(async () => {
      const response = await fetch("/index.html");
      return {
        ok: response.ok,
        body: await response.text(),
      };
    });
    expect(cachedShell.ok).toBe(true);
    expect(cachedShell.body).toContain('id="root"');
  } finally {
    await context.setOffline(false);
  }
});

test("replaces a previously installed worker through the visible update flow", async ({
  page,
}) => {
  await page.goto("/legacy-pwa.html");
  await expect(page.getByRole("status")).toHaveText(
    "Legacy worker controls this browser",
  );
  await expect
    .poll(() =>
      page.evaluate(() => navigator.serviceWorker.controller?.scriptURL ?? ""),
    )
    .toContain("/legacy-sw.js");

  await page.goto("/");
  await page.getByRole("button", { name: "Keep cookie-free" }).click();
  const updateNotice = page.getByRole("complementary", {
    name: "Portal update ready",
  });
  await expect(updateNotice).toBeVisible({ timeout: 20_000 });

  await Promise.all([
    page.waitForNavigation({ waitUntil: "domcontentloaded" }),
    updateNotice
      .getByRole("button", { name: "Reload and update" })
      .click(),
  ]);

  await expect
    .poll(() =>
      page.evaluate(() => navigator.serviceWorker.controller?.scriptURL ?? ""),
    )
    .toMatch(/\/sw\.js$/);
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          performance.getEntriesByType("navigation")[0] as
            | PerformanceNavigationTiming
            | undefined,
      ).then((entry) => entry?.type ?? "missing"),
    )
    .toBe("reload");
  await expect(
    page.getByRole("complementary", { name: "Portal update ready" }),
  ).toBeHidden();
});
