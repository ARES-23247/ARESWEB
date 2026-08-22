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
