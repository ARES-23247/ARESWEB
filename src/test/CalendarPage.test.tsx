import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CalendarPage from "../app/calendar/page";
import { authenticatedFetch } from "@/lib/api";

vi.mock("@/components/SEO", () => ({ default: () => null }));
vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({
    user: { uid: "test-user" },
    authorizedUser: { role: "admin" },
    loading: false,
  }),
}));
vi.mock("@/lib/api", () => ({
  authenticatedFetch: vi.fn(),
}));

function jsonResponse(body: unknown, status = 200, statusText = "OK"): Response {
  return new Response(JSON.stringify(body), {
    status,
    statusText,
    headers: { "Content-Type": "application/json" },
  });
}

const mockEvents = [
  {
    id: "evt_internal_1",
    title: "Software Autonomous Calibration",
    description: "Tuning pure pursuit feedforward gains on the practice field.",
    category: "internal",
    status: "published",
    dateStart: "2026-08-15T18:00:00Z",
    dateEnd: "2026-08-15T21:00:00Z",
    location: "MARS Laboratory",
    createdAt: "2026-01-01T00:00:00Z",
  },
  {
    id: "evt_outreach_1",
    title: "Morgantown Public Library STEM Workshop",
    description: "Hands-on robotics demo for middle school students.",
    category: "outreach",
    status: "published",
    dateStart: "2026-08-20T14:00:00Z",
    dateEnd: "2026-08-20T16:00:00Z",
    location: "Morgantown Public Library",
    createdAt: "2026-01-01T00:00:00Z",
  },
];

describe("CalendarPage Interactive Grid & Filter UX", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders public calendar events, upcoming timeline, and month grid", async () => {
    vi.mocked(authenticatedFetch).mockResolvedValue(jsonResponse({ events: mockEvents, nextCursor: null }));

    render(
      <MemoryRouter>
        <CalendarPage />
      </MemoryRouter>
    );

    expect(await screen.findByRole("heading", { name: "Software Autonomous Calibration" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Morgantown Public Library STEM Workshop" })).toBeInTheDocument();
    expect(screen.getByText("Upcoming Schedule")).toBeInTheDocument();
    expect(screen.getByText("Subscribe to Feed")).toBeInTheDocument();
  });

  it("filters events when selecting category tabs", async () => {
    vi.mocked(authenticatedFetch).mockResolvedValue(jsonResponse({ events: mockEvents, nextCursor: null }));

    render(
      <MemoryRouter>
        <CalendarPage />
      </MemoryRouter>
    );

    await screen.findByRole("heading", { name: "Software Autonomous Calibration" });

    // Filter by Outreach
    fireEvent.click(screen.getByRole("button", { name: "Outreach" }));
    expect(screen.getByRole("heading", { name: "Morgantown Public Library STEM Workshop" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Software Autonomous Calibration" })).not.toBeInTheDocument();

    // Filter by Practices
    fireEvent.click(screen.getByRole("button", { name: "Practices" }));
    expect(screen.getByRole("heading", { name: "Software Autonomous Calibration" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Morgantown Public Library STEM Workshop" })).not.toBeInTheDocument();
  });

  it("handles next and previous month buttons", async () => {
    vi.mocked(authenticatedFetch).mockResolvedValue(jsonResponse({ events: mockEvents, nextCursor: null }));

    render(
      <MemoryRouter>
        <CalendarPage />
      </MemoryRouter>
    );

    await screen.findByRole("heading", { name: "Software Autonomous Calibration" });

    const prevMonthBtn = screen.getByRole("button", { name: "Previous Month" });
    const nextMonthBtn = screen.getByRole("button", { name: "Next Month" });

    expect(prevMonthBtn).toBeInTheDocument();
    expect(nextMonthBtn).toBeInTheDocument();

    fireEvent.click(nextMonthBtn);
    fireEvent.click(prevMonthBtn);
  });

  it("copies calendar feed URL to clipboard and gives visual confirmation", async () => {
    vi.mocked(authenticatedFetch).mockResolvedValue(jsonResponse({ events: mockEvents, nextCursor: null }));
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });

    render(
      <MemoryRouter>
        <CalendarPage />
      </MemoryRouter>
    );

    await screen.findByRole("heading", { name: "Software Autonomous Calibration" });

    const copyBtn = screen.getByRole("button", { name: "Copy calendar feed URL" });
    fireEvent.click(copyBtn);

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalled();
    });
  });

  it("displays PublicDataState error component when the calendar service is unavailable", async () => {
    vi.mocked(authenticatedFetch).mockRejectedValue(new Error("HTTP 503: Service Unavailable"));

    render(
      <MemoryRouter>
        <CalendarPage />
      </MemoryRouter>
    );

    expect(await screen.findByText("Unable to load the team calendar")).toBeInTheDocument();
    expect(screen.getByText("Upcoming schedule unavailable until the calendar reconnects.")).toBeInTheDocument();
  });
});
