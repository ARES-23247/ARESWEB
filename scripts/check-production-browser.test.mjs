import { describe, expect, it, vi } from "vitest";
import {
  readOption,
  runProductionBrowserCheck,
  validateDeploymentId,
  validateOrigin,
} from "./check-production-browser.mjs";

function createBrowserHarness({
  scripts = ["https://www.google.com/recaptcha/enterprise.js?render=test"],
  canaryStatus = 204,
  pageUrl = "https://aresfirst-portal.web.app/join",
  appCheckToken = "verified-token",
  attestationStatus = 200,
  attestationBody = "",
  securityAlert = "",
} = {}) {
  let inquiryHandler;
  const close = vi.fn();
  const post = vi.fn().mockResolvedValue({ status: () => canaryStatus });
  const page = {
    on: vi.fn(),
    url: vi.fn(() => pageUrl),
    route: vi.fn(async (_pattern, handler) => {
      inquiryHandler = handler;
    }),
    goto: vi.fn(),
    waitForFunction: vi.fn(),
    waitForResponse: vi.fn(async () => ({
      status: () => attestationStatus,
      text: async () => attestationBody,
    })),
    locator: vi.fn((selector) => {
      if (selector === "script[src]") {
        return {
          evaluateAll: async (callback) =>
            callback(scripts.map((src) => ({ getAttribute: () => src }))),
        };
      }
      return { fill: vi.fn(), selectOption: vi.fn(), waitFor: vi.fn() };
    }),
    getByLabel: vi.fn(() => ({ check: vi.fn() })),
    getByRole: vi.fn((role) =>
      role === "alert"
        ? { textContent: async () => securityAlert }
        : {
            click: async () => {
              if (!appCheckToken) return;
              await inquiryHandler({
                request: () => ({
                  method: () => "POST",
                  url: () => "https://aresfirst-portal.web.app/api/inquiries",
                  headers: () => ({
                    "x-firebase-appcheck": appCheckToken,
                  }),
                  postData: () => JSON.stringify({ type: "student" }),
                }),
                fulfill: vi.fn(),
                continue: vi.fn(),
              });
            },
          },
    ),
    getByText: vi.fn(() => ({ isVisible: async () => Boolean(appCheckToken) })),
  };
  const context = { newPage: async () => page, request: { post } };
  const newContext = vi.fn(async () => context);
  const launch = vi.fn(async () => ({
    newContext,
    close,
  }));
  return { launch, close, newContext, post };
}

describe("production browser security check", () => {
  it("validates bounded command-line inputs", () => {
    expect(readOption([], "--origin", "fallback")).toBe("fallback");
    expect(() => readOption(["--origin"], "--origin", "fallback")).toThrow(
      "requires a value",
    );
    expect(validateOrigin("https://aresfirst-portal.web.app")).toBe(
      "https://aresfirst-portal.web.app",
    );
    expect(() => validateOrigin("http://aresfirst.org")).toThrow(
      "HTTPS origin",
    );
    const deploymentId = "a".repeat(40);
    expect(validateDeploymentId(deploymentId)).toBe(deploymentId);
    expect(() => validateDeploymentId("release_2026-08-22.1")).toThrow(
      "full lowercase Git commit SHA",
    );
  });

  it("verifies the Enterprise client, intercepted inquiry token, and canary", async () => {
    const harness = createBrowserHarness();
    await expect(
      runProductionBrowserCheck({
        origin: "https://aresfirst-portal.web.app",
        deploymentId: "a".repeat(40),
        launch: harness.launch,
      }),
    ).resolves.toEqual({
      origin: "https://aresfirst-portal.web.app",
      enterpriseClient: true,
      appCheckVerified: true,
      headlessRejectionVerified: false,
    });
    expect(harness.post).toHaveBeenCalledWith(
      "https://aresfirst-portal.web.app/api/app-check/canary",
      { headers: { "X-Firebase-AppCheck": "verified-token" } },
    );
    expect(harness.newContext).toHaveBeenCalledWith({
      serviceWorkers: "allow",
    });
    expect(harness.close).toHaveBeenCalledTimes(1);
  });

  it("rejects the retired standard client and still closes the browser", async () => {
    const harness = createBrowserHarness({
      scripts: ["https://www.google.com/recaptcha/api.js"],
    });
    await expect(
      runProductionBrowserCheck({
        origin: "https://aresfirst-portal.web.app",
        deploymentId: "a".repeat(40),
        launch: harness.launch,
      }),
    ).rejects.toThrow("legacy standard reCAPTCHA client");
    expect(harness.close).toHaveBeenCalledTimes(1);
  });

  it("rejects a deployment probe that crosses the canonical CDN boundary", async () => {
    const harness = createBrowserHarness({
      pageUrl: "https://aresfirst.org/join",
    });
    await expect(
      runProductionBrowserCheck({
        origin: "https://aresfirst-portal.web.app",
        deploymentId: "a".repeat(40),
        launch: harness.launch,
      }),
    ).rejects.toThrow("Deployment probe left the direct Hosting origin");
    expect(harness.close).toHaveBeenCalledTimes(1);
  });

  it("accepts only the precise fail-closed outcome for a rejected headless attestation", async () => {
    const harness = createBrowserHarness({
      appCheckToken: "",
      attestationStatus: 403,
      attestationBody: JSON.stringify({
        error: { code: 403, message: "App attestation failed." },
      }),
      securityAlert:
        "Security verification failed. Please refresh and try again.",
      canaryStatus: 401,
    });

    await expect(
      runProductionBrowserCheck({
        origin: "https://aresfirst-portal.web.app",
        deploymentId: "a".repeat(40),
        launch: harness.launch,
      }),
    ).resolves.toEqual({
      origin: "https://aresfirst-portal.web.app",
      enterpriseClient: true,
      appCheckVerified: false,
      headlessRejectionVerified: true,
    });
    expect(harness.post).toHaveBeenCalledWith(
      "https://aresfirst-portal.web.app/api/app-check/canary",
    );
    expect(harness.close).toHaveBeenCalledTimes(1);
  });

  it("reports the final URL and captured browser errors when hydration fails", async () => {
    const harness = createBrowserHarness();
    const browser = await harness.launch();
    const context = await browser.newContext();
    const page = await context.newPage();
    page.locator = vi.fn(() => ({
      waitFor: vi.fn().mockRejectedValue(new Error("timeout")),
    }));
    page.on.mockImplementation((event, handler) => {
      if (event === "pageerror") handler(new Error("boot failed"));
    });
    const launch = vi.fn(async () => browser);

    await expect(
      runProductionBrowserCheck({
        origin: "https://aresfirst-portal.web.app",
        deploymentId: "a".repeat(40),
        launch,
      }),
    ).rejects.toThrow(
      "Join form did not become ready at https://aresfirst-portal.web.app/join\npageerror: boot failed",
    );
    expect(harness.close).toHaveBeenCalledTimes(1);
  });
});
