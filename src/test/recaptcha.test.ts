import { afterEach, describe, expect, it, vi } from "vitest";
import { getRecaptchaToken } from "@/lib/recaptcha";

describe("getRecaptchaToken", () => {
  afterEach(() => {
    vi.useRealTimers();
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

    await expect(
      getRecaptchaToken({ allowDevelopmentBypass: false }),
    ).resolves.toBe("verified-token");
    expect(execute).toHaveBeenCalledWith(expect.any(String), {
      action: "submit",
    });
  });

  it("loads the verifier only when a protected action requests a token", async () => {
    const tokenPromise = getRecaptchaToken({ allowDevelopmentBypass: false });
    const script = document.getElementById(
      "recaptcha-script",
    ) as HTMLScriptElement;
    expect(script.src).toContain(
      "https://www.google.com/recaptcha/api.js?render=",
    );

    window.grecaptcha = {
      ready: (callback) => callback(),
      execute: vi.fn().mockResolvedValue("lazy-token"),
    };
    script.dispatchEvent(new Event("load"));

    await expect(tokenPromise).resolves.toBe("lazy-token");
  });

  it("loads the standard verifier when App Check already installed the Enterprise namespace", async () => {
    const enterpriseExecute = vi.fn().mockResolvedValue("enterprise-token");
    window.grecaptcha = {
      enterprise: {
        ready: (callback) => callback(),
        execute: enterpriseExecute,
      },
    };

    const tokenPromise = getRecaptchaToken({ allowDevelopmentBypass: false });
    const script = document.getElementById(
      "recaptcha-script",
    ) as HTMLScriptElement;
    expect(script.src).toContain(
      "https://www.google.com/recaptcha/api.js?render=",
    );

    const execute = vi.fn().mockResolvedValue("standard-token");
    window.grecaptcha = {
      ...window.grecaptcha,
      ready: (callback) => callback(),
      execute,
    };
    script.dispatchEvent(new Event("load"));

    await expect(tokenPromise).resolves.toBe("standard-token");
    expect(execute).toHaveBeenCalledWith(expect.any(String), {
      action: "submit",
    });
    expect(enterpriseExecute).not.toHaveBeenCalled();
  });

  it("removes an unusable standard script so a later attempt can retry", async () => {
    window.grecaptcha = {
      enterprise: {
        ready: (callback) => callback(),
        execute: vi.fn().mockResolvedValue("enterprise-token"),
      },
    };

    const tokenPromise = getRecaptchaToken({ allowDevelopmentBypass: false });
    const script = document.getElementById(
      "recaptcha-script",
    ) as HTMLScriptElement;
    script.dispatchEvent(new Event("load"));

    await expect(tokenPromise).rejects.toThrow(/standard recaptcha api/i);
    expect(document.getElementById("recaptcha-script")).toBeNull();
  });

  it("returns an actionable error when the verifier script is blocked", async () => {
    const tokenPromise = getRecaptchaToken({ allowDevelopmentBypass: false });
    const script = document.getElementById(
      "recaptcha-script",
    ) as HTMLScriptElement;
    script.dispatchEvent(new Event("error"));

    await expect(tokenPromise).rejects.toThrow(/content blocker/i);
  });

  it("times out cleanly and removes the stalled verifier script", async () => {
    vi.useFakeTimers();
    const tokenPromise = getRecaptchaToken({ allowDevelopmentBypass: false });
    const rejection = expect(tokenPromise).rejects.toThrow(/timed out/i);

    await vi.advanceTimersByTimeAsync(15_000);

    await rejection;
    expect(document.getElementById("recaptcha-script")).toBeNull();
  });

  it("preserves verifier execution diagnostics", async () => {
    window.grecaptcha = {
      ready: (callback) => callback(),
      execute: vi.fn().mockRejectedValue(new Error("provider unavailable")),
    };

    await expect(
      getRecaptchaToken({ allowDevelopmentBypass: false }),
    ).rejects.toThrow(/provider unavailable/i);
  });
});
