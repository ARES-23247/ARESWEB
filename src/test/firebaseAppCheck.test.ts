import { beforeEach, describe, expect, it, vi } from "vitest";

const appCheckMocks = vi.hoisted(() => ({
  getToken: vi.fn(),
  initializeAppCheck: vi.fn(),
  providerKeys: [] as string[],
}));

vi.unmock("@/lib/firebaseAppCheck");
vi.mock("@/lib/firebaseCore", () => ({ app: { name: "app-check-test" } }));
vi.mock("firebase/app-check", () => ({
  getToken: appCheckMocks.getToken,
  initializeAppCheck: appCheckMocks.initializeAppCheck,
  ReCaptchaEnterpriseProvider: class ReCaptchaEnterpriseProvider {
    constructor(siteKey: string) {
      appCheckMocks.providerKeys.push(siteKey);
    }
  },
}));

async function loadModule() {
  return import("@/lib/firebaseAppCheck");
}

describe("Firebase App Check browser boundary", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    vi.clearAllMocks();
    appCheckMocks.providerKeys.length = 0;
    appCheckMocks.initializeAppCheck.mockReturnValue({ name: "app-check" });
    appCheckMocks.getToken.mockResolvedValue({ token: "verified-app-check-token" });
    delete window.ARES_E2E_BYPASS;
    delete window.FIREBASE_APPCHECK_DEBUG_TOKEN;
  });

  it("stays disabled when the public Enterprise key is absent", async () => {
    const { getOrInitializeAppCheck, getAppCheckHeader } = await loadModule();

    await expect(getOrInitializeAppCheck()).resolves.toBeUndefined();
    await expect(getAppCheckHeader()).resolves.toEqual({});
    expect(appCheckMocks.initializeAppCheck).not.toHaveBeenCalled();
  });

  it("initializes exactly one Enterprise provider and returns its token header", async () => {
    vi.stubEnv("NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY", "enterprise-site-key");
    const { getOrInitializeAppCheck, getAppCheckHeader } = await loadModule();

    const first = await getOrInitializeAppCheck();
    const second = await getOrInitializeAppCheck();
    await expect(getAppCheckHeader(true)).resolves.toEqual({
      "X-Firebase-AppCheck": "verified-app-check-token",
    });

    expect(first).toBe(second);
    expect(appCheckMocks.providerKeys).toEqual(["enterprise-site-key"]);
    expect(appCheckMocks.initializeAppCheck).toHaveBeenCalledTimes(1);
    expect(appCheckMocks.getToken).toHaveBeenCalledWith(first, true);
  });

  it("enables the debug token only for an explicitly configured local emulator", async () => {
    vi.stubEnv("NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY", "enterprise-site-key");
    vi.stubEnv("VITE_USE_EMULATOR", "true");
    const { getOrInitializeAppCheck } = await loadModule();

    await getOrInitializeAppCheck();

    expect(window.FIREBASE_APPCHECK_DEBUG_TOKEN).toBe(true);
  });

  it("returns no header when token retrieval fails", async () => {
    vi.stubEnv("NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY", "enterprise-site-key");
    appCheckMocks.getToken.mockRejectedValueOnce(new Error("provider unavailable"));
    const { getAppCheckHeader } = await loadModule();

    await expect(getAppCheckHeader()).resolves.toEqual({});
  });

  it("allows an explicit bypass only in the isolated test build", async () => {
    window.ARES_E2E_BYPASS = true;
    const { getAppCheckHeader } = await loadModule();

    await expect(getAppCheckHeader()).resolves.toEqual({
      "X-Firebase-AppCheck": "test-app-check-token",
    });
    expect(appCheckMocks.initializeAppCheck).not.toHaveBeenCalled();
  });

  it("clears a failed initialization so the next request can retry", async () => {
    vi.stubEnv("NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY", "enterprise-site-key");
    appCheckMocks.initializeAppCheck
      .mockImplementationOnce(() => {
        throw new Error("initialization failed");
      })
      .mockReturnValueOnce({ name: "recovered-app-check" });
    const { getOrInitializeAppCheck } = await loadModule();

    await expect(getOrInitializeAppCheck()).resolves.toBeUndefined();
    await expect(getOrInitializeAppCheck()).resolves.toEqual({
      name: "recovered-app-check",
    });
    expect(appCheckMocks.initializeAppCheck).toHaveBeenCalledTimes(2);
  });
});
