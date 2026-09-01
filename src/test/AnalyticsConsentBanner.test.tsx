import { act, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import AnalyticsConsentBanner, {
  AnalyticsConsentPreferencesButton,
} from "@/components/AnalyticsConsentBanner";
import { ANALYTICS_CONSENT_STORAGE_KEY } from "@/lib/analyticsConsent";

function renderControls() {
  return render(
    <MemoryRouter>
      <AnalyticsConsentBanner />
      <AnalyticsConsentPreferencesButton />
    </MemoryRouter>,
  );
}

describe("AnalyticsConsentBanner", () => {
  afterEach(() => {
    window.localStorage.removeItem(ANALYTICS_CONSENT_STORAGE_KEY);
    vi.restoreAllMocks();
  });

  it("offers equal clear choices until the visitor decides", () => {
    renderControls();

    expect(
      screen.getByRole("heading", { name: "Optional website analytics" }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Allow analytics" }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Keep cookie-free" }),
    ).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Read our privacy details" }),
    ).toHaveAttribute("href", "/privacy");
  });

  it("stores an opt-in, closes the banner, and updates the status", () => {
    renderControls();
    act(() => screen.getByRole("button", { name: "Allow analytics" }).click());

    expect(window.localStorage.getItem(ANALYTICS_CONSENT_STORAGE_KEY)).toBe(
      "granted",
    );
    expect(
      screen.queryByRole("heading", { name: "Optional website analytics" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText("Analytics is allowed in this browser."),
    ).toBeVisible();
  });

  it("stores a decline and can reopen the choices", () => {
    renderControls();
    act(() => screen.getByRole("button", { name: "Keep cookie-free" }).click());

    expect(window.localStorage.getItem(ANALYTICS_CONSENT_STORAGE_KEY)).toBe(
      "denied",
    );
    expect(
      screen.getByText("This browser remains cookie-free for analytics."),
    ).toBeVisible();

    act(() =>
      screen.getByRole("button", { name: "Change analytics choice" }).click(),
    );
    expect(
      screen.getByRole("heading", { name: "Optional website analytics" }),
    ).toBeVisible();
  });

  it("stays closed when a saved choice exists", () => {
    window.localStorage.setItem(ANALYTICS_CONSENT_STORAGE_KEY, "denied");
    renderControls();

    expect(
      screen.queryByRole("heading", { name: "Optional website analytics" }),
    ).not.toBeInTheDocument();
  });

  it("honors the current-session choice if storage is blocked", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("blocked");
    });
    renderControls();

    act(() => screen.getByRole("button", { name: "Keep cookie-free" }).click());
    expect(
      screen.queryByRole("heading", { name: "Optional website analytics" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText("This browser remains cookie-free for analytics."),
    ).toBeVisible();
  });
});
