import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import JoinPage from "../app/join/page";
import { getAppCheckHeader } from "@/lib/firebaseAppCheck";

vi.mock("@/components/SEO", () => ({ default: () => null }));
vi.mock("@/lib/firebaseAppCheck", () => ({
  getAppCheckHeader: vi.fn(),
}));

function jsonResponse(body: unknown, status = 200, statusText = "OK"): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

describe("JoinPage Recruitment & Form Verification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getAppCheckHeader).mockResolvedValue({ "X-Firebase-AppCheck": "mock-appcheck-token" });
  });

  it("validates student fields before submitting and shows success state upon completion", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ success: true, message: "Application submitted successfully." }));
    vi.stubGlobal("fetch", fetchMock);

    render(<JoinPage />);

    // Fill in basic details
    fireEvent.change(screen.getByLabelText(/Full Name \*/i), { target: { value: "Alex Student" } });
    fireEvent.change(screen.getByLabelText(/Email Address \*/i), { target: { value: "alex@example.com" } });
    fireEvent.change(screen.getByLabelText(/School \*/i), { target: { value: "Morgantown High" } });
    fireEvent.change(screen.getByLabelText(/Current Grade \*/i), { target: { value: "10" } });

    // Select interest
    fireEvent.click(screen.getByLabelText(/Programming/i));

    // Submit
    fireEvent.click(screen.getByRole("button", { name: /Submit Student Application/i }));

    await waitFor(() => {
      expect(screen.getByText(/Application submitted successfully!/i)).toBeInTheDocument();
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/inquiries", expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({
        "Content-Type": "application/json",
        "X-Firebase-AppCheck": "mock-appcheck-token",
      }),
      body: expect.stringContaining("Alex Student"),
    }));
    const requestBody = JSON.parse(fetchMock.mock.calls[0][1].body as string) as Record<string, unknown>;
    expect(requestBody).not.toHaveProperty("recaptchaToken");
  });

  it("switches to mentor form, validates occupation, and submits mentor application", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ success: true, message: "Application submitted successfully." }));
    vi.stubGlobal("fetch", fetchMock);

    render(<JoinPage />);

    // Switch to Mentor Application
    fireEvent.click(screen.getByRole("button", { name: /Mentor Application/i }));

    expect(screen.getByLabelText(/Current Occupation \/ Company \*/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Current Grade \*/i)).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Full Name \*/i), { target: { value: "Dr. Mentor" } });
    fireEvent.change(screen.getByLabelText(/Email Address \*/i), { target: { value: "mentor@example.com" } });
    fireEvent.change(screen.getByLabelText(/Current Occupation \/ Company \*/i), { target: { value: "Software Architect at NASA" } });

    // Select interest
    fireEvent.click(screen.getByLabelText(/Mechanical \/ CAD/i));

    // Submit
    fireEvent.click(screen.getByRole("button", { name: /Submit Mentor Application/i }));

    await waitFor(() => {
      expect(screen.getByText(/Application submitted successfully!/i)).toBeInTheDocument();
    });
  });

  it("sends a general contact message with name, email, and question only", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ success: true }));
    vi.stubGlobal("fetch", fetchMock);

    render(<JoinPage />);

    fireEvent.click(screen.getByRole("button", { name: /Just a Question/i }));

    // No application-specific fields for general messages.
    expect(screen.queryByLabelText(/School \*/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Current Occupation \/ Company \*/i)).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Full Name \*/i), { target: { value: "Curious Visitor" } });
    fireEvent.change(screen.getByLabelText(/Email Address \*/i), { target: { value: "visitor@example.com" } });
    fireEvent.change(screen.getByLabelText(/Additional Information/i), { target: { value: "Can ARES demo robots at our summer camp?" } });

    fireEvent.click(screen.getByRole("button", { name: /Send Message/i }));

    await waitFor(() => {
      expect(screen.getByText(/Message sent!/i)).toBeInTheDocument();
    });
    expect(fetchMock).toHaveBeenCalledWith("/api/inquiries", expect.objectContaining({
      method: "POST",
      body: expect.stringContaining('"type":"general"'),
    }));
  });

  it("handles backend error responses gracefully without crashing", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ success: false, error: "Too many submissions from this IP." }, 429));
    vi.stubGlobal("fetch", fetchMock);

    render(<JoinPage />);

    fireEvent.change(screen.getByLabelText(/Full Name \*/i), { target: { value: "Alex Student" } });
    fireEvent.change(screen.getByLabelText(/Email Address \*/i), { target: { value: "alex@example.com" } });
    fireEvent.change(screen.getByLabelText(/School \*/i), { target: { value: "Morgantown High" } });
    fireEvent.change(screen.getByLabelText(/Current Grade \*/i), { target: { value: "11" } });
    fireEvent.click(screen.getByLabelText(/Electrical/i));

    fireEvent.click(screen.getByRole("button", { name: /Submit Student Application/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Too many submissions from this IP.");
    });
  });

  it("does not transmit applicant data when App Check cannot attest the browser", async () => {
    vi.mocked(getAppCheckHeader).mockResolvedValue({});
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(<JoinPage />);
    fireEvent.change(screen.getByLabelText(/Full Name \*/i), { target: { value: "Protected Applicant" } });
    fireEvent.change(screen.getByLabelText(/Email Address \*/i), { target: { value: "protected@example.test" } });
    fireEvent.change(screen.getByLabelText(/School \*/i), { target: { value: "Protected School" } });
    fireEvent.change(screen.getByLabelText(/Current Grade \*/i), { target: { value: "10" } });
    fireEvent.click(screen.getByLabelText(/Programming/i));
    fireEvent.click(screen.getByRole("button", { name: /Submit Student Application/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/Security verification failed/i);
    });
    expect(getAppCheckHeader).toHaveBeenCalledTimes(2);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("covers required-field validation, deselection, phone entry, and role reset controls", async () => {
    vi.stubGlobal("fetch", vi.fn());
    render(<JoinPage />);

    fireEvent.submit(
      screen
        .getByRole("button", { name: /Submit Student Application/i })
        .closest("form")!,
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Full Name \*/i), {
      target: { value: "Validation Student" },
    });
    fireEvent.change(screen.getByLabelText(/Email Address \*/i), {
      target: { value: "validation@example.test" },
    });
    const studentForm = screen
      .getByRole("button", { name: /Submit Student Application/i })
      .closest("form")!;
    fireEvent.submit(studentForm);
    expect(screen.getByRole("alert")).toHaveTextContent(/school and grade/i);

    fireEvent.change(screen.getByLabelText(/School \*/i), {
      target: { value: "Test School" },
    });
    fireEvent.change(screen.getByLabelText(/Current Grade \*/i), {
      target: { value: "10" },
    });
    fireEvent.change(screen.getByLabelText(/Phone Number/i), {
      target: { value: "304-555-0100" },
    });
    fireEvent.submit(studentForm);
    expect(screen.getByRole("alert")).toHaveTextContent(/select at least one/i);

    const programming = screen.getByLabelText(/Programming/i);
    fireEvent.click(programming);
    fireEvent.click(programming);
    fireEvent.submit(studentForm);
    expect(screen.getByRole("alert")).toHaveTextContent(/select at least one/i);

    fireEvent.click(screen.getByRole("button", { name: /Mentor Application/i }));
    fireEvent.click(screen.getByRole("button", { name: /Student Application/i }));
    expect(screen.getByLabelText(/Phone Number/i)).toHaveValue("304-555-0100");
  });

  it("shows mentor occupation validation before interest validation", () => {
    vi.stubGlobal("fetch", vi.fn());
    render(<JoinPage />);
    fireEvent.click(screen.getByRole("button", { name: /Mentor Application/i }));
    fireEvent.change(screen.getByLabelText(/Full Name \*/i), {
      target: { value: "Validation Mentor" },
    });
    fireEvent.change(screen.getByLabelText(/Email Address \*/i), {
      target: { value: "mentor-validation@example.test" },
    });
    fireEvent.submit(
      screen
        .getByRole("button", { name: /Submit Mentor Application/i })
        .closest("form")!,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(/occupation\/company/i);
  });
});
