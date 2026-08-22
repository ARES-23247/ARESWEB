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
} = {}) {
  let inquiryHandler;
  const close = vi.fn();
  const post = vi.fn().mockResolvedValue({ status: () => canaryStatus });
  const page = {
    on: vi.fn(),
    route: vi.fn(async (_pattern, handler) => {
      inquiryHandler = handler;
    }),
    goto: vi.fn(),
    locator: vi.fn((selector) => {
      if (selector === "script[src]") {
        return {
          evaluateAll: async (callback) =>
            callback(scripts.map((src) => ({ getAttribute: () => src }))),
        };
      }
      return { fill: vi.fn(), selectOption: vi.fn() };
    }),
    getByLabel: vi.fn(() => ({ check: vi.fn() })),
    getByRole: vi.fn(() => ({
      click: async () => {
        await inquiryHandler({
          request: () => ({
            method: () => "POST",
            url: () => "https://aresfirst-portal.web.app/api/inquiries",
            headers: () => ({ "x-firebase-appcheck": "verified-token" }),
            postData: () => JSON.stringify({ type: "student" }),
          }),
          fulfill: vi.fn(),
          continue: vi.fn(),
        });
      },
    })),
    getByText: vi.fn(() => ({ waitFor: vi.fn() })),
  };
  const context = { newPage: async () => page, request: { post } };
  const launch = vi.fn(async () => ({
    newContext: async () => context,
    close,
  }));
  return { launch, close, post };
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
    expect(() => validateOrigin("http://aresfirst.org")).toThrow("HTTPS origin");
    expect(validateDeploymentId("release_2026-08-22.1")).toBe(
      "release_2026-08-22.1",
    );
    expect(() => validateDeploymentId("not allowed/value")).toThrow(
      "unsupported characters",
    );
  });

  it("verifies the Enterprise client, intercepted inquiry token, and canary", async () => {
    const harness = createBrowserHarness();
    await expect(
      runProductionBrowserCheck({
        origin: "https://aresfirst-portal.web.app",
        deploymentId: "test-deployment",
        launch: harness.launch,
      }),
    ).resolves.toEqual({
      origin: "https://aresfirst-portal.web.app",
      enterpriseClient: true,
      appCheckVerified: true,
    });
    expect(harness.post).toHaveBeenCalledWith(
      "https://aresfirst-portal.web.app/api/app-check/canary",
      { headers: { "X-Firebase-AppCheck": "verified-token" } },
    );
    expect(harness.close).toHaveBeenCalledTimes(1);
  });

  it("rejects the retired standard client and still closes the browser", async () => {
    const harness = createBrowserHarness({
      scripts: ["https://www.google.com/recaptcha/api.js"],
    });
    await expect(
      runProductionBrowserCheck({
        origin: "https://aresfirst-portal.web.app",
        deploymentId: "test-deployment",
        launch: harness.launch,
      }),
    ).rejects.toThrow("legacy standard reCAPTCHA client");
    expect(harness.close).toHaveBeenCalledTimes(1);
  });
});
