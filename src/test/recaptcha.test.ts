import { afterEach, describe, expect, it, vi } from "vitest";
import { getRecaptchaToken } from "@/lib/recaptcha";

describe("getRecaptchaToken", () => {
  afterEach(() => {
    document.getElementById("recaptcha-script")?.remove();
    delete window.grecaptcha;
    delete window.ARES_E2E_BYPASS;
    vi.restoreAllMocks();
  });

  it("uses the explicit development bypass without loading a third-party script", async () => {
    window.ARES_E2E_BYPASS = true;
    await expect(getRecaptchaToken()).resolves.toBe("test-bypass-token");
    expect(document.getElementById("recaptcha-script")).toBeNull();
  });

  it("uses an already loaded verifier and preserves the server-required action", async () => {
    const execute = vi.fn().mockResolvedValue("verified-token");
    window.grecaptcha = {
      ready: (callback) => callback(),
      execute,
    };

    await expect(getRecaptchaToken({ allowDevelopmentBypass: false })).resolves.toBe("verified-token");
    expect(execute).toHaveBeenCalledWith(expect.any(String), { action: "submit" });
  });

  it("loads the verifier only when a protected action requests a token", async () => {
    const tokenPromise = getRecaptchaToken({ allowDevelopmentBypass: false });
    const script = document.getElementById("recaptcha-script") as HTMLScriptElement;
    expect(script.src).toContain("https://www.google.com/recaptcha/api.js?render=");

    window.grecaptcha = {
      ready: (callback) => callback(),
      execute: vi.fn().mockResolvedValue("lazy-token"),
    };
    script.dispatchEvent(new Event("load"));

    await expect(tokenPromise).resolves.toBe("lazy-token");
  });

  it("returns an actionable error when the verifier script is blocked", async () => {
    const tokenPromise = getRecaptchaToken({ allowDevelopmentBypass: false });
    const script = document.getElementById("recaptcha-script") as HTMLScriptElement;
    script.dispatchEvent(new Event("error"));

    await expect(tokenPromise).rejects.toThrow(/content blocker/i);
  });

  it("preserves verifier execution diagnostics", async () => {
    window.grecaptcha = {
      ready: (callback) => callback(),
      execute: vi.fn().mockRejectedValue(new Error("provider unavailable")),
    };

    await expect(getRecaptchaToken({ allowDevelopmentBypass: false })).rejects.toThrow(/provider unavailable/i);
  });
});
