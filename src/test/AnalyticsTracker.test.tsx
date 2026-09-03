import { act, render } from "@testing-library/react";
import { MemoryRouter, useNavigate } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AnalyticsTracker from "@/components/AnalyticsTracker";
import {
  ANALYTICS_CONSENT_CHANGE_EVENT,
  ANALYTICS_CONSENT_STORAGE_KEY,
} from "@/lib/analyticsConsent";

function RouteControl() {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      onClick={() => navigate("/academy?path=robotics-foundations")}
    >
      Change route
    </button>
  );
}

describe("AnalyticsTracker", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_GA_MEASUREMENT_ID", "G-8XWENKB7EZ");
    window.localStorage.removeItem(ANALYTICS_CONSENT_STORAGE_KEY);
    Reflect.deleteProperty(window, "dataLayer");
    Reflect.deleteProperty(window, "gtag");
    document.getElementById("google-analytics-script")?.remove();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    Reflect.deleteProperty(window, "dataLayer");
    Reflect.deleteProperty(window, "gtag");
    document.getElementById("google-analytics-script")?.remove();
  });

  it("initializes supported cookie-free consent before configuring GA4", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <AnalyticsTracker />
      </MemoryRouter>,
    );

    expect(Array.from(window.dataLayer[0] as IArguments)).toEqual([
      "consent",
      "default",
      {
        ad_storage: "denied",
        ad_user_data: "denied",
        ad_personalization: "denied",
        analytics_storage: "denied",
      },
    ]);
    expect(Array.from(window.dataLayer[1] as IArguments)).toEqual([
      "js",
      expect.any(Date),
    ]);
    expect(Array.from(window.dataLayer[2] as IArguments)).toEqual([
      "config",
      "G-8XWENKB7EZ",
      {
        send_page_view: false,
        allow_google_signals: false,
        allow_ad_personalization_signals: false,
        allow_interest_groups: false,
      },
    ]);
    expect(Array.isArray(window.dataLayer[0])).toBe(false);
    expect(
      window.localStorage.getItem(ANALYTICS_CONSENT_STORAGE_KEY),
    ).toBeNull();
    expect(document.getElementById("google-analytics-script")).toHaveAttribute(
      "src",
      "https://www.googletagmanager.com/gtag/js?id=G-8XWENKB7EZ",
    );
  });

  it("sends manual page views without query parameters", () => {
    const { getByRole } = render(
      <MemoryRouter initialEntries={["/"]}>
        <AnalyticsTracker />
        <RouteControl />
      </MemoryRouter>,
    );

    act(() => getByRole("button", { name: "Change route" }).click());

    expect(
      window.dataLayer.map((entry) => Array.from(entry as IArguments)),
    ).toContainEqual([
      "event",
      "page_view",
      expect.objectContaining({
        page_path: "/academy",
        page_location: "http://localhost:3000/academy",
        send_to: "G-8XWENKB7EZ",
      }),
    ]);
  });

  it("restores a saved opt-in while keeping advertising consent denied", () => {
    window.localStorage.setItem(ANALYTICS_CONSENT_STORAGE_KEY, "granted");

    render(
      <MemoryRouter initialEntries={["/privacy"]}>
        <AnalyticsTracker />
      </MemoryRouter>,
    );

    expect(
      window.dataLayer.map((entry) => Array.from(entry as IArguments)),
    ).toContainEqual([
      "consent",
      "update",
      {
        ad_storage: "denied",
        ad_user_data: "denied",
        ad_personalization: "denied",
        analytics_storage: "granted",
      },
    ]);
  });

  it("updates consent and records the current page after a new opt-in", () => {
    render(
      <MemoryRouter initialEntries={["/join?email=student@example.test"]}>
        <AnalyticsTracker />
      </MemoryRouter>,
    );

    act(() => {
      window.dispatchEvent(
        new CustomEvent(ANALYTICS_CONSENT_CHANGE_EVENT, {
          detail: "granted",
        }),
      );
    });

    const commands = window.dataLayer.map((entry) =>
      Array.from(entry as IArguments),
    );
    expect(commands).toContainEqual([
      "consent",
      "update",
      {
        ad_storage: "denied",
        ad_user_data: "denied",
        ad_personalization: "denied",
        analytics_storage: "granted",
      },
    ]);
    expect(commands).toContainEqual([
      "event",
      "page_view",
      {
        page_path: "/join",
        page_location: "http://localhost:3000/join",
        send_to: "G-8XWENKB7EZ",
      },
    ]);
    expect(JSON.stringify(commands)).not.toContain("student@example.test");
  });

  it("does nothing when no measurement ID is configured", () => {
    vi.stubEnv("NEXT_PUBLIC_GA_MEASUREMENT_ID", "");

    render(
      <MemoryRouter>
        <AnalyticsTracker />
      </MemoryRouter>,
    );

    expect(document.getElementById("google-analytics-script")).toBeNull();
    expect(window.dataLayer).toBeUndefined();
  });
});
