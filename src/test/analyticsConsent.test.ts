import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ANALYTICS_CONSENT_CHANGE_EVENT,
  ANALYTICS_CONSENT_OPEN_EVENT,
  ANALYTICS_CONSENT_STORAGE_KEY,
  openAnalyticsConsentChoices,
  readAnalyticsConsent,
  saveAnalyticsConsent,
} from "@/lib/analyticsConsent";

describe("analytics consent storage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    window.localStorage.removeItem(ANALYTICS_CONSENT_STORAGE_KEY);
  });

  it("returns only supported stored choices", () => {
    expect(readAnalyticsConsent()).toBeNull();
    window.localStorage.setItem(ANALYTICS_CONSENT_STORAGE_KEY, "granted");
    expect(readAnalyticsConsent()).toBe("granted");
    window.localStorage.setItem(ANALYTICS_CONSENT_STORAGE_KEY, "denied");
    expect(readAnalyticsConsent()).toBe("denied");
    window.localStorage.setItem(ANALYTICS_CONSENT_STORAGE_KEY, "unexpected");
    expect(readAnalyticsConsent()).toBeNull();
  });

  it("persists and publishes a consent choice", () => {
    const listener = vi.fn();
    window.addEventListener(ANALYTICS_CONSENT_CHANGE_EVENT, listener);

    expect(saveAnalyticsConsent("granted")).toBe(true);
    expect(window.localStorage.getItem(ANALYTICS_CONSENT_STORAGE_KEY)).toBe(
      "granted",
    );
    expect(listener).toHaveBeenCalledOnce();
    expect((listener.mock.calls[0][0] as CustomEvent).detail).toBe("granted");

    window.removeEventListener(ANALYTICS_CONSENT_CHANGE_EVENT, listener);
  });

  it("keeps the session choice working when browser storage is unavailable", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("blocked");
    });
    const listener = vi.fn();
    window.addEventListener(ANALYTICS_CONSENT_CHANGE_EVENT, listener);

    expect(saveAnalyticsConsent("denied")).toBe(false);
    expect(listener).toHaveBeenCalledOnce();

    window.removeEventListener(ANALYTICS_CONSENT_CHANGE_EVENT, listener);
  });

  it("returns no choice when browser storage cannot be read", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("blocked");
    });
    expect(readAnalyticsConsent()).toBeNull();
  });

  it("publishes the request to reopen analytics choices", () => {
    const listener = vi.fn();
    window.addEventListener(ANALYTICS_CONSENT_OPEN_EVENT, listener);
    openAnalyticsConsentChoices();
    expect(listener).toHaveBeenCalledOnce();
    window.removeEventListener(ANALYTICS_CONSENT_OPEN_EVENT, listener);
  });

  it("is safe during server rendering", () => {
    vi.stubGlobal("window", undefined);
    expect(readAnalyticsConsent()).toBeNull();
    expect(saveAnalyticsConsent("granted")).toBe(false);
    expect(openAnalyticsConsentChoices()).toBeUndefined();
  });
});
