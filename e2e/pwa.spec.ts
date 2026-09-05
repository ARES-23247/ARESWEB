import { expect, test } from "@playwright/test";

test("physical BUZZLE tools reopen offline with the complete two-letter list and checker", async ({ context, page }) => {
  await page.goto("/buzzle/word-tools");
  await page.getByRole("button", { name: "Keep cookie-free" }).click();
  await expect(page.getByText(/Ready for offline use on this device/)).toBeVisible();
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
  const precache = await page.evaluate(async () => {
    const entries: { url: string; size: number }[] = [];
    for (const name of await caches.keys()) {
      if (!name.includes('workbox-precache')) continue;
      const cache = await caches.open(name);
      for (const request of await cache.keys()) {
        const response = await cache.match(request);
        entries.push({ url: new URL(request.url).pathname, size: (await response!.arrayBuffer()).byteLength });
      }
    }
    return entries;
  });
  expect(precache.some(({ url }) => url === '/data/buzzle-words.txt')).toBe(true);
  // Bound the actual offline download: public lexicon (~2.76 MB) plus shell
  // and the companion's imports (~1.1 MB). Do not precache other lazy games,
  // the editor, definitions, or API responses to make this route work offline.
  expect(precache.reduce((sum, { size }) => sum + size, 0)).toBeLessThan(4_500_000);
  expect(Math.max(...precache.map(({ size }) => size))).toBeLessThan(3_000_000);
  expect(precache.every(({ url }) => /^\/(?:assets\/|data\/buzzle-words\.txt$|index\.html$|manifest\.webmanifest$|favicon\.|robots\.txt$)/.test(url))).toBe(true);
  await context.setOffline(true);
  try {
    // A fresh navigation discards the in-memory dictionary and React state.
    await page.reload();
    await expect(page.getByRole("heading", { name: "Word Tools", exact: true })).toBeVisible();
    await page.getByLabel("Word to check").fill("quizzical");
    await page.getByRole("button", { name: "Check word", exact: true }).click();
    await expect(page.getByText("QUIZZICAL — accepted in BUZZLE.")).toBeVisible();
    await page.getByLabel("Word to check").fill("zzzzzz");
    await page.getByRole("button", { name: "Check word", exact: true }).click();
    await expect(page.getByText("ZZZZZZ — not accepted in BUZZLE.")).toBeVisible();
    await page.getByRole("button", { name: "Two-letter words", exact: true }).click();
    await expect(page.getByRole("button", { name: /^Define / })).toHaveCount(128);
    await page.getByLabel("Filter by letter").fill("qi");
    await expect(page.getByRole("button", { name: "Define QI", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Define QI", exact: true }).click();
    await expect(page.getByText(/Definition service unavailable/)).toBeVisible();
    await page.getByRole("button", { name: "Two-letter words", exact: true }).click();
    await expect(page.getByRole("button", { name: "Define QI", exact: true })).toBeVisible();
  } finally {
    await context.setOffline(false);
  }
});

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
