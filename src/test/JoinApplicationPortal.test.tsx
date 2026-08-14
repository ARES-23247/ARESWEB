import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import JoinApplyWizardPage from "../app/join/apply/page";

vi.mock("@/components/SEO", () => ({ default: () => null }));
vi.mock("@/components/GreekMeander", () => ({ GreekMeander: () => <div data-testid="greek-meander" /> }));
vi.mock("@/lib/recaptcha", () => ({
  getRecaptchaToken: vi.fn().mockResolvedValue("mock-recaptcha-token"),
}));
vi.mock("@/lib/firebaseAppCheck", () => ({
  getAppCheckHeader: vi.fn().mockResolvedValue({ "X-Firebase-AppCheck": "mock-appcheck-token" }),
}));

function jsonResponse(body: unknown, status = 200, statusText = "OK"): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

describe("JoinApplyWizardPage Multi-Step Application Verification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders wizard step 1 and validates subteam selection before progressing", () => {
    render(
      <MemoryRouter>
        <JoinApplyWizardPage />
      </MemoryRouter>
    );

    expect(screen.getByRole("heading", { name: /1\. Select Subteam Interests/i })).toBeInTheDocument();
    expect(screen.getByText(/CAD & Mechanical Engineering/i)).toBeInTheDocument();
    expect(screen.getByText(/Autonomous Software & Controls/i)).toBeInTheDocument();

    // Clicking Next without selection shows error
    const nextBtn = screen.getByRole("button", { name: /Next Step/i });
    fireEvent.click(nextBtn);
    expect(screen.getByRole("alert")).toHaveTextContent(/Please select at least one subteam interest/i);

    // Select subteam and proceed
    const subteamCard = screen.getByText(/CAD & Mechanical Engineering/i);
    fireEvent.click(subteamCard);
    fireEvent.click(nextBtn);

    // Should now be on step 2
    expect(screen.getByRole("heading", { name: /2\. Student Information/i })).toBeInTheDocument();
  });

  it("validates required student contact fields on step 2", () => {
    render(
      <MemoryRouter>
        <JoinApplyWizardPage />
      </MemoryRouter>
    );

    // Select subteam and proceed to step 2
    fireEvent.click(screen.getByText(/Autonomous Software & Controls/i));
    fireEvent.click(screen.getByRole("button", { name: /Next Step/i }));

    // Click Next without student info
    fireEvent.click(screen.getByRole("button", { name: /Next Step/i }));
    expect(screen.getByRole("alert")).toHaveTextContent(/Please provide your name, email, and school/i);

    // Fill student info
    fireEvent.change(screen.getByPlaceholderText(/Alex Mercer/i), { target: { value: "Sam Developer" } });
    fireEvent.change(screen.getByPlaceholderText(/student@example.org/i), { target: { value: "sam@example.org" } });
    fireEvent.change(screen.getByPlaceholderText(/Morgantown High School/i), { target: { value: "Morgantown High" } });
    fireEvent.click(screen.getByRole("button", { name: /Next Step/i }));

    // Should now be on step 3 (Skills & Tools)
    expect(screen.getByRole("heading", { name: /3\. Skills & Prior Experience/i })).toBeInTheDocument();
  });

  it("completes full wizard submission with parental consent and receives reference code", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ success: true, message: "Application submitted successfully." }));
    vi.stubGlobal("fetch", fetchMock);

    render(
      <MemoryRouter>
        <JoinApplyWizardPage />
      </MemoryRouter>
    );

    // Step 1: Subteam
    fireEvent.click(screen.getByText(/Autonomous Software & Controls/i));
    fireEvent.click(screen.getByRole("button", { name: /Next Step/i }));

    // Step 2: Student Info
    fireEvent.change(screen.getByPlaceholderText(/Alex Mercer/i), { target: { value: "Morgan Cadet" } });
    fireEvent.change(screen.getByPlaceholderText(/student@example.org/i), { target: { value: "morgan@example.org" } });
    fireEvent.change(screen.getByPlaceholderText(/Morgantown High School/i), { target: { value: "Suncrest Middle" } });
    fireEvent.click(screen.getByRole("button", { name: /Next Step/i }));

    // Step 3: Tools & Experience
    fireEvent.click(screen.getByText(/Java or Kotlin Programming/i));
    fireEvent.click(screen.getByRole("button", { name: /Next Step/i }));

    // Step 4: Parent Consent Validation
    expect(screen.getByRole("heading", { name: /4\. Youth Safety & Parent \/ Guardian Consent/i })).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText(/Jordan Mercer/i), { target: { value: "Pat Cadet" } });
    fireEvent.change(screen.getByPlaceholderText(/parent@example.org/i), { target: { value: "parent@example.org" } });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: /Next Step/i }));

    // Step 5: Review & Submit
    expect(screen.getByRole("heading", { name: /5\. Review & Submit Application/i })).toBeInTheDocument();
    expect(screen.getByText(/Morgan Cadet/i)).toBeInTheDocument();

    const submitBtn = screen.getByRole("button", { name: /Confirm & Submit Application/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/Application Submitted Successfully!/i)).toBeInTheDocument();
      expect(screen.getByText(/Application Reference Code/i)).toBeInTheDocument();
    });
  });
});
