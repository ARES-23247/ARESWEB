import {
  test as base,
  expect,
  type ConsoleMessage,
  type Page,
} from "@playwright/test";

type MockRole = "admin" | "coach" | "mentor" | "member";

interface AresFixtures {
  loginAs: (role: MockRole, name?: string) => Promise<void>;
}

export const test = base.extend<AresFixtures>({
  page: async ({ page }, use) => {
    const clientFailures: string[] = [];

    // Incidental shared-layout and public-page requests get explicit truthful
    // empty responses. Individual tests can register later routes to override
    // these defaults when the response itself is under test.
    await page.route("**/api/profiles/about-roster", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ members: [] }),
      }),
    );
    await page.route("**/api/inquiries/pending-exists", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ hasPending: false }),
      }),
    );
    await page.route("**/api/content/posts", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ posts: [] }),
      }),
    );
    await page.route("**/api/content/docs?*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ documents: [] }),
      }),
    );
    await page.route("**/api/seasons", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ seasons: [] }),
      }),
    );
    await page.route("**/api/awards", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ awards: [] }),
      }),
    );
    // The isolated role fixture intentionally does not start Firebase Auth's
    // emulator. WebKit still requests its helper iframe during SDK startup;
    // satisfy only that loopback origin so a missing, unused emulator does not
    // masquerade as an application console failure.
    await page.route("http://127.0.0.1:9099/**", (route) =>
      route.fulfill({ status: 204, body: "" }),
    );

    await page.addInitScript(() => {
      window.ARES_E2E_BYPASS = true;
      // Most tests validate unrelated user journeys and should begin from the
      // stable, privacy-preserving choice. The dedicated consent test removes
      // this value and reopens the banner explicitly.
      try {
        if (!window.localStorage.getItem("ares_analytics_consent_v1")) {
          window.localStorage.setItem("ares_analytics_consent_v1", "denied");
        }
      } catch {
        // The init script also runs in the opaque initial document where
        // storage may be unavailable; it runs again on the application origin.
      }
    });

    const errorHandler = (err: Error) => {
      clientFailures.push(
        `${err.name || "Error"}: ${err.message}\n${err.stack || ""}`,
      );
    };
    const consoleHandler = (message: ConsoleMessage) => {
      if (message.type() === "error") {
        const sourceUrl = message.location().url;
        clientFailures.push(
          `console.error${sourceUrl ? ` (${sourceUrl})` : ""}: ${message.text()}`,
        );
      }
    };
    const requestFailedHandler = (request: {
      url(): string;
      failure(): { errorText?: string } | null;
    }) => {
      const errorText =
        request.failure()?.errorText ?? "unknown network failure";
      if (/ERR_ABORTED|NS_BINDING_ABORTED/i.test(errorText)) return;
      try {
        const currentOrigin = new URL(page.url()).origin;
        if (new URL(request.url()).origin === currentOrigin) {
          clientFailures.push(
            `same-origin request failed: ${request.url()} (${errorText})`,
          );
        }
      } catch {
        // Ignore failures before the first real document establishes an origin.
      }
    };
    const responseHandler = (response: { status(): number; url(): string }) => {
      if (response.status() < 500) return;
      try {
        const currentOrigin = new URL(page.url()).origin;
        if (new URL(response.url()).origin === currentOrigin) {
          clientFailures.push(
            `same-origin HTTP ${response.status()}: ${response.url()}`,
          );
        }
      } catch {
        // Ignore responses before the first real document establishes an origin.
      }
    };

    page.on("pageerror", errorHandler);
    page.on("console", consoleHandler);
    page.on("requestfailed", requestFailedHandler);
    page.on("response", responseHandler);

    await use(page);

    page.removeListener("pageerror", errorHandler);
    page.removeListener("console", consoleHandler);
    page.removeListener("requestfailed", requestFailedHandler);
    page.removeListener("response", responseHandler);

    if (clientFailures.length > 0) {
      throw new Error(
        `Client-side failure(s) detected during test execution:\n\n${clientFailures.join("\n\n")}`,
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
