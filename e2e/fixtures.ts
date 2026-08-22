import { test as base, expect, type Page } from "@playwright/test";

type MockRole = "admin" | "coach" | "mentor" | "member";

interface AresFixtures {
  loginAs: (role: MockRole, name?: string) => Promise<void>;
}

export const test = base.extend<AresFixtures>({
  page: async ({ page }, use) => {
    const pageErrors: Error[] = [];

    await page.addInitScript(() => {
      window.ARES_E2E_BYPASS = true;
    });

    await page.addInitScript(() => {
      window.ARES_E2E_BYPASS = true;
    });

    const errorHandler = (err: Error) => {
      pageErrors.push(err);
    };

    page.on("pageerror", errorHandler);

    await use(page);

    page.removeListener("pageerror", errorHandler);

    if (pageErrors.length > 0) {
      const errorDetails = pageErrors
        .map(
          (err) => `${err.name || "Error"}: ${err.message}\n${err.stack || ""}`,
        )
        .join("\n\n");
      throw new Error(
        `Client-side page error(s) detected during test execution:\n\n${errorDetails}`,
      );
    }
  },
  loginAs: async ({ page }, use) => {
    await use(async (role, name = `Playwright ${role}`) => {
      await installMockSession(page, role, name);
    });
  },
});

async function installMockSession(page: Page, role: MockRole, name: string) {
  await page.addInitScript(
    ({ sessionRole, sessionName }) => {
      if (window !== window.top) return;
      try {
        window.sessionStorage.setItem(
          "ares_mock_user",
          JSON.stringify({
            email: `${sessionRole}@example.test`,
            role: sessionRole,
            name: sessionName,
          }),
        );
      } catch {
        // Chromium may run init scripts once in an opaque initial document. The
        // script runs again after navigation, when the app origin has storage.
      }
    },
    { sessionRole: role, sessionName: name },
  );
}

export { expect };
