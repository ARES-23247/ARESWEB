import { fireEvent, render, screen, act } from "@testing-library/react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import PitKioskDisplayPage from "@/app/pit-display/page";

// Mock SEO
vi.mock("@/components/SEO", () => ({
  default: ({ title, description }: { title: string; description: string }) => (
    <div data-testid="mock-seo" data-title={title} data-description={description} />
  ),
}));

// Mock Tournament API
vi.mock("@/lib/tournamentApi", () => ({
  fetchTournaments: vi.fn().mockResolvedValue([
    {
      id: "wv-state-2026",
      name: "West Virginia State Championship",
      status: "upcoming",
      date: "2026-03-15",
      location: "Morgantown, WV",
      isDeleted: 0,
    },
  ]),
  fetchTournamentMatches: vi.fn().mockResolvedValue([]),
}));

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: Infinity,
      },
    },
  });
}

function renderPitKiosk() {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <PitKioskDisplayPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("PitKioskDisplayPage Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders kiosk brand header, live badge, and terminal info", async () => {
    renderPitKiosk();

    expect(screen.getByText(/ARES 23247 PIT DISPLAY/i)).toBeInTheDocument();
    expect(screen.getByText(/LIVE KIOSK/i)).toBeInTheDocument();
    expect(screen.getByText(/West Virginia Championship 2026/i)).toBeInTheDocument();
    expect(screen.getByText(/Online/i)).toBeInTheDocument();
  });

  it("displays live match queue countdown timer and controls", async () => {
    renderPitKiosk();

    // Default match QM 7 countdown timer
    const timer = screen.getByRole("timer");
    expect(timer).toBeInTheDocument();
    expect(timer).toHaveTextContent("10:00");

    // Advance timer by 2 seconds
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(timer).toHaveTextContent("09:58");

    // Pause timer
    const pauseBtn = screen.getByLabelText(/Pause Countdown/i);
    fireEvent.click(pauseBtn);

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(timer).toHaveTextContent("09:58");

    // Quick set to 5m
    const btn5m = screen.getByLabelText(/Reset Timer to 5 Minutes/i);
    fireEvent.click(btn5m);
    expect(timer).toHaveTextContent("05:00");

    // Add 1m
    const btnAdd1m = screen.getByLabelText(/Add 1 Minute/i);
    fireEvent.click(btnAdd1m);
    expect(timer).toHaveTextContent("06:00");
  });

  it("renders alliance strategy card, partner info, opponents, and switches matches", async () => {
    renderPitKiosk();

    // Default selected match QM 7 partner and opponents
    expect(screen.getAllByText("14220")[0]).toBeInTheDocument();
    expect(screen.getAllByText(/CyberKnights/i)[0]).toBeInTheDocument();
    expect(screen.getAllByText(/TechnoTitans/i)[0]).toBeInTheDocument();
    expect(screen.getAllByText(/RoboPulse/i)[0]).toBeInTheDocument();
    expect(screen.getByText(/Predicted Win Probability:/i)).toBeInTheDocument();

    // Switch to QM 1
    const qm1Btn = screen.getByRole("button", { name: "QM 1" });
    fireEvent.click(qm1Btn);

    expect(screen.getAllByText("18225")[0]).toBeInTheDocument();
    expect(screen.getAllByText(/High Voltage Robotics/i)[0]).toBeInTheDocument();
    expect(screen.getAllByText(/RoboDragons/i)[0]).toBeInTheDocument();
  });

  it("handles robot readiness checklist item toggling, progress calculation, and check all", async () => {
    renderPitKiosk();

    // Battery and intake are pre-checked in initial checklist (4 checked out of 7)
    expect(screen.getAllByText(/4\/7 \(57%\)/i)[0]).toBeInTheDocument();

    // Toggle Gamepads item via its checkbox role
    const checkboxes = screen.getAllByRole("checkbox");
    const padsCheckbox = checkboxes[4];
    expect(padsCheckbox).toHaveAttribute("aria-checked", "false");

    fireEvent.click(padsCheckbox);

    expect(screen.getAllByText(/5\/7 \(71%\)/i)[0]).toBeInTheDocument();
    expect(padsCheckbox).toHaveAttribute("aria-checked", "true");

    // Check All
    const checkAllBtn = screen.getByRole("button", { name: /Check All/i });
    fireEvent.click(checkAllBtn);

    expect(screen.getAllByText(/7\/7 \(100%\)/i)[0]).toBeInTheDocument();
    expect(screen.getByText(/✓ 100% READY/i)).toBeInTheDocument();

    // Reset checklist
    const resetBtn = screen.getByRole("button", { name: /Reset for Next Match/i });
    fireEvent.click(resetBtn);

    expect(screen.getAllByText(/0\/7 \(0%\)/i)[0]).toBeInTheDocument();
  });

  it("supports keyboard navigation on checklist items (Space / Enter)", async () => {
    renderPitKiosk();

    const allianceCheckbox = screen.getAllByRole("checkbox")[5]; // Alliance markers item
    expect(allianceCheckbox).toHaveAttribute("aria-checked", "false");

    fireEvent.keyDown(allianceCheckbox, { key: " " });
    expect(allianceCheckbox).toHaveAttribute("aria-checked", "true");

    fireEvent.keyDown(allianceCheckbox, { key: "Enter" });
    expect(allianceCheckbox).toHaveAttribute("aria-checked", "false");
  });

  it("renders live pit announcements and allows broadcasting a new alert", async () => {
    renderPitKiosk();

    // Default announcement
    expect(
      screen.getByText(/MATCH QUEUE ALERT: QM7 calling to Queuing Area/i)
    ).toBeInTheDocument();

    // Open broadcast modal
    const broadcastBtn = screen.getByLabelText(/Post Announcement/i);
    fireEvent.click(broadcastBtn);

    expect(screen.getByRole("dialog", { name: /Post Pit Announcement/i })).toBeInTheDocument();

    // Pick a quick preset
    const presetBtn = screen.getByRole("button", { name: "Judges Arriving" });
    fireEvent.click(presetBtn);

    const input = screen.getByLabelText(/Announcement Text/i);
    expect(input).toHaveValue(
      "JUDGES VISIT: Judges approaching pit booth for engineering portfolio review."
    );

    // Submit alert
    const submitBtn = screen.getByRole("button", { name: /Broadcast Alert/i });
    fireEvent.click(submitBtn);

    // Modal closes and new alert is broadcasted
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(
      screen.getByText(/JUDGES VISIT: Judges approaching pit booth/i)
    ).toBeInTheDocument();
  });

  it("auto-rotates sponsors and supports pausing / next controls", async () => {
    renderPitKiosk();

    expect(screen.getByText("NASA WV Space Grant Consortium")).toBeInTheDocument();

    // Advance sponsor timer by 6.5s
    act(() => {
      vi.advanceTimersByTime(6500);
    });

    expect(screen.getByText("Morgantown Area Robotics Foundation")).toBeInTheDocument();

    // Manual next sponsor
    const nextSponsorBtn = screen.getByLabelText(/Next sponsor/i);
    fireEvent.click(nextSponsorBtn);

    expect(screen.getByText("West Virginia University Robotics")).toBeInTheDocument();

    // Pause button
    const pauseSponsorBtn = screen.getByLabelText(/Pause Sponsor Carousel/i);
    fireEvent.click(pauseSponsorBtn);

    act(() => {
      vi.advanceTimersByTime(10000);
    });

    // Stays on WVU Statler because paused
    expect(screen.getByText("West Virginia University Robotics")).toBeInTheDocument();
  });

  it("displays offline warning banner when network disconnects", async () => {
    renderPitKiosk();

    expect(screen.queryByText(/OFFLINE FALLBACK ACTIVE/i)).not.toBeInTheDocument();

    // Dispatch offline event
    act(() => {
      window.dispatchEvent(new Event("offline"));
    });

    expect(screen.getByText(/OFFLINE FALLBACK ACTIVE/i)).toBeInTheDocument();
    expect(screen.getByText(/Zero-Loss Pit Mode/i)).toBeInTheDocument();

    // Dispatch online event
    act(() => {
      window.dispatchEvent(new Event("online"));
    });

    expect(screen.queryByText(/OFFLINE FALLBACK ACTIVE/i)).not.toBeInTheDocument();
  });

  it("toggles high-contrast pit ambient mode and fullscreen", async () => {
    renderPitKiosk();

    const container = screen.getByTestId("pit-kiosk-container");
    expect(container).toHaveClass("bg-obsidian");

    // Toggle high-contrast
    const ambientBtn = screen.getByLabelText(/Toggle High-Contrast Pit Mode/i);
    fireEvent.click(ambientBtn);

    expect(container).toHaveClass("bg-black");
    expect(container).toHaveClass("border-ares-gold/80");

    // Toggle Fullscreen button
    const fsBtn = screen.getByLabelText(/Toggle Fullscreen/i);
    fireEvent.click(fsBtn);

    // Keyboard shortcut C for contrast mode
    fireEvent.keyDown(window, { key: "c" });
    expect(container).toHaveClass("bg-obsidian");
  });

  it("handles print sheet trigger cleanly", async () => {
    const printSpy = vi.spyOn(window, "print").mockImplementation(() => {});
    renderPitKiosk();

    const printBtn = screen.getByLabelText(/Print pit sheet/i);
    fireEvent.click(printBtn);

    expect(printSpy).toHaveBeenCalledTimes(1);
    printSpy.mockRestore();
  });

  it("satisfies WCAG AA accessibility attributes and landmarks", async () => {
    renderPitKiosk();

    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(screen.getByRole("main")).toBeInTheDocument();
    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
    expect(screen.getByRole("timer")).toHaveAttribute("aria-live", "polite");

    const checkboxes = screen.getAllByRole("checkbox");
    expect(checkboxes.length).toBeGreaterThan(0);
    checkboxes.forEach((cb) => {
      expect(cb).toHaveAttribute("tabIndex", "0");
      expect(cb).toHaveAttribute("aria-checked");
    });
  });
});
