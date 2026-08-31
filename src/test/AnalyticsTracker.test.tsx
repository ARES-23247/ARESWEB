import { act, render } from "@testing-library/react";
import { MemoryRouter, useNavigate } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AnalyticsTracker from "@/components/AnalyticsTracker";

function RouteControl() {
  const navigate = useNavigate();
  return (
    <button type="button" onClick={() => navigate("/academy?path=robotics-foundations")}>
      Change route
    </button>
  );
}

describe("AnalyticsTracker", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_GA_MEASUREMENT_ID", "G-0KKZT6G3TG");
    window.localStorage.removeItem("ares_ga_client_id");
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

    expect(window.dataLayer[0]).toEqual([
      "consent",
      "default",
      {
        ad_storage: "denied",
        ad_user_data: "denied",
        ad_personalization: "denied",
        analytics_storage: "denied",
      },
    ]);
    expect(window.dataLayer[1]).toEqual(["js", expect.any(Date)]);
    expect(window.dataLayer[2]).toEqual([
      "config",
      "G-0KKZT6G3TG",
      { send_page_view: false },
    ]);
    expect(window.localStorage.getItem("ares_ga_client_id")).toBeNull();
    expect(document.getElementById("google-analytics-script")).toHaveAttribute(
      "src",
      "https://www.googletagmanager.com/gtag/js?id=G-0KKZT6G3TG",
    );
  });

  it("sends manual page views for React Router navigation", () => {
    const { getByRole } = render(
      <MemoryRouter initialEntries={["/"]}>
        <AnalyticsTracker />
        <RouteControl />
      </MemoryRouter>,
    );

    act(() => getByRole("button", { name: "Change route" }).click());

    expect(window.dataLayer).toContainEqual([
      "event",
      "page_view",
      expect.objectContaining({
        page_path: "/academy?path=robotics-foundations",
        send_to: "G-0KKZT6G3TG",
      }),
    ]);
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
