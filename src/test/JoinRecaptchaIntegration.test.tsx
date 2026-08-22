import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import JoinPage from "@/app/join/page";
import { getAppCheckHeader } from "@/lib/firebaseAppCheck";

vi.mock("@/components/SEO", () => ({ default: () => null }));
vi.mock("@/lib/firebaseAppCheck", () => ({
  getAppCheckHeader: vi.fn(),
}));

function jsonResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    json: () => Promise.resolve(body),
  } as Response;
}

describe("join form reCAPTCHA integration", () => {
  beforeEach(() => {
    vi.mocked(getAppCheckHeader).mockResolvedValue({
      "X-Firebase-AppCheck": "integration-app-check",
    });
    delete window.ARES_E2E_BYPASS;
    window.grecaptcha = {
      enterprise: {
        ready: (callback) => callback(),
        execute: vi.fn().mockResolvedValue("enterprise-token"),
      },
    };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ success: true })),
    );
  });

  afterEach(() => {
    document.getElementById("recaptcha-script")?.remove();
    delete window.grecaptcha;
    delete window.ARES_E2E_BYPASS;
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("submits through the standard verifier when App Check installed Enterprise first", async () => {
    render(<JoinPage />);

    fireEvent.change(screen.getByLabelText(/full name/i), {
      target: { value: "Integration Applicant" },
    });
    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: "integration@example.test" },
    });
    fireEvent.change(screen.getByLabelText(/school/i), {
      target: { value: "Integration School" },
    });
    fireEvent.change(screen.getByLabelText(/current grade/i), {
      target: { value: "10" },
    });
    fireEvent.click(screen.getByLabelText(/programming/i));
    fireEvent.click(
      screen.getByRole("button", { name: /submit student application/i }),
    );

    const script = document.getElementById(
      "recaptcha-script",
    ) as HTMLScriptElement;
    expect(script).toBeInstanceOf(HTMLScriptElement);

    const standardExecute = vi.fn().mockResolvedValue("standard-token");
    window.grecaptcha = {
      ...window.grecaptcha,
      ready: (callback) => callback(),
      execute: standardExecute,
    };
    script.dispatchEvent(new Event("load"));

    await waitFor(() => {
      expect(
        screen.getByText(/application submitted successfully/i),
      ).toBeInTheDocument();
    });

    expect(standardExecute).toHaveBeenCalledWith(expect.any(String), {
      action: "submit",
    });
    expect(fetch).toHaveBeenCalledWith(
      "/api/inquiries",
      expect.objectContaining({
        headers: expect.objectContaining({
          "X-Firebase-AppCheck": "integration-app-check",
        }),
        body: expect.stringContaining('"recaptchaToken":"standard-token"'),
      }),
    );
  });
});
