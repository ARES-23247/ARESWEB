import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import OutreachPage from "../app/outreach/page";
import { getAppCheckHeader } from "@/lib/firebaseAppCheck";

vi.mock("@/components/SEO", () => ({ default: () => null }));
vi.mock("@/lib/firebaseAppCheck", () => ({
  getAppCheckHeader: vi.fn(),
}));

function response(body: unknown, status = 200, statusText = "OK"): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

function renderPage() {
  return render(
    <MemoryRouter>
      <OutreachPage />
    </MemoryRouter>
  );
}

describe("OutreachPage public community impact and STEM requests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getAppCheckHeader).mockResolvedValue({ "X-Firebase-AppCheck": "mock-app-check" });
  });

  it("renders published outreach records and computes summary impact metrics", async () => {
    const mockLogs = [
      {
        id: "out-1",
        title: "Monongalia County Library STEM Demo",
        date: "2026-03-15",
        location: "Morgantown Public Library",
        hours: 6,
        peopleReached: 120,
        impactSummary: "Demonstrated intake mechanisms and autonomous pathing to youth.",
      },
      {
        id: "out-2",
        title: "WV Regional Science Fair Judging",
        date: "2026-04-10",
        location: "WVU Student Union",
        hours: 8,
        peopleReached: 250,
        impactSummary: "Volunteered as robotics and engineering design judges.",
      },
    ];

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response({ logs: mockLogs })));
    renderPage();

    expect(await screen.findByText("Monongalia County Library STEM Demo")).toBeInTheDocument();
    expect(screen.getByText("WV Regional Science Fair Judging")).toBeInTheDocument();
    expect(screen.getByText("370")).toBeInTheDocument(); // 120 + 250
    expect(screen.getByText("14 hrs")).toBeInTheDocument(); // 6 + 8
    expect(screen.getByText("2")).toBeInTheDocument(); // 2 events

    const exportCsvLink = screen.getByRole("link", { name: /export outreach impact log as csv/i });
    expect(exportCsvLink).toBeInTheDocument();
    expect(exportCsvLink).toHaveAttribute("download", "ares-23247-community-outreach-impact.csv");
    expect(exportCsvLink.getAttribute("href")).toContain("data:text/csv;charset=utf-8,");
  });

  it("opens the STEM Demo request modal and submits inquiry successfully", async () => {
    const fetchMock = vi.fn().mockImplementation((input: unknown) => {
      const url = typeof input === "string" ? input : String((input as { url?: string })?.url || input);
      if (url.includes("/api/inquiries")) {
        return Promise.resolve(response({ success: true }));
      }
      return Promise.resolve(response({ logs: [] }));
    });
    vi.stubGlobal("fetch", fetchMock);
    renderPage();

    expect(await screen.findByText("No outreach events are published yet")).toBeInTheDocument();

    const requestDemoButton = screen.getByRole("button", { name: /get in touch/i });
    fireEvent.click(requestDemoButton);

    expect(screen.getByRole("dialog", { name: /request a stem demo/i })).toBeInTheDocument();

    const nameInput = screen.getByLabelText(/your name \*/i);
    const emailInput = screen.getByLabelText(/email address \*/i);
    const orgInput = screen.getByLabelText(/organization/i);
    const phoneInput = screen.getByLabelText(/phone/i);
    const detailsInput = screen.getByLabelText(/details & dates \*/i);

    fireEvent.change(nameInput, { target: { value: "Dr. Jane Smith" } });
    fireEvent.change(emailInput, { target: { value: "jsmith@wvstem.org" } });
    fireEvent.change(orgInput, { target: { value: "Morgantown Middle School" } });
    fireEvent.change(phoneInput, { target: { value: "304-555-0101" } });
    fireEvent.change(detailsInput, { target: { value: "We would love a robotics demonstration for 6th grade classes." } });

    await waitFor(() => expect(nameInput).toHaveValue("Dr. Jane Smith"));
    await waitFor(() => expect(emailInput).toHaveValue("jsmith@wvstem.org"));

    fireEvent.submit(screen.getByTestId("outreach-demo-form"));

    expect(await screen.findByText(/STEM Request Received!/i)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/inquiries", expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({
        "X-Firebase-AppCheck": "mock-app-check",
      }),
      body: expect.stringContaining("Dr. Jane Smith"),
    }));
  });

  it("retries a failed public impact request", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("network unavailable"))
      .mockResolvedValueOnce(response({ logs: [] }));
    vi.stubGlobal("fetch", fetchMock);
    renderPage();

    expect(await screen.findByText("Unable to load outreach impact")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByText("No outreach events are published yet")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
