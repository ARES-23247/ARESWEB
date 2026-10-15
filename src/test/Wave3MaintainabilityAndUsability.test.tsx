import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const apiMocks = vi.hoisted(() => ({
  authenticatedFetch: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  authenticatedFetch: apiMocks.authenticatedFetch,
}));

import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";
import {
  getPriorityStyle,
  getStatusLabel,
  getSubteamDescription,
  getSubteamStyle,
} from "@/app/dashboard/tasks/utils/taskStyles";
import { notifyTaskZulip } from "@/app/dashboard/tasks/utils/notifyTaskZulip";
import DashboardOnboardingGuide from "@/app/dashboard/components/DashboardOnboardingGuide";
import DashboardServiceStatusCard from "@/app/dashboard/components/DashboardServiceStatusCard";
import AcademyRookieBanner, {
  type RookieDocumentItem,
} from "@/app/academy/components/AcademyRookieBanner";
import FtcGlossaryBanner from "@/app/tournaments/components/FtcGlossaryBanner";

function CopyHarness({ text, resetMs = 500 }: { text: string; resetMs?: number }) {
  const { copied, copyStatus, copyToClipboard } = useCopyToClipboard(resetMs);
  return (
    <div>
      <span data-testid="copied">{String(copied)}</span>
      <span data-testid="status">{copyStatus}</span>
      <button type="button" onClick={() => void copyToClipboard(text)}>
        Copy now
      </button>
    </div>
  );
}

describe("Wave 3 maintainability utilities & novice usability components", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("useCopyToClipboard", () => {
    it("copies text, transitions to copied, and resets to idle after timeout", async () => {
      vi.useFakeTimers();
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, "clipboard", {
        value: { writeText },
        configurable: true,
      });

      render(<CopyHarness text="ARES-23247" resetMs={300} />);
      expect(screen.getByTestId("status")).toHaveTextContent("idle");

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Copy now" }));
      });

      expect(writeText).toHaveBeenCalledWith("ARES-23247");
      expect(screen.getByTestId("copied")).toHaveTextContent("true");
      expect(screen.getByTestId("status")).toHaveTextContent("copied");

      act(() => {
        vi.advanceTimersByTime(350);
      });

      expect(screen.getByTestId("copied")).toHaveTextContent("false");
      expect(screen.getByTestId("status")).toHaveTextContent("idle");
    });

    it("sets status to error when clipboard write rejects or text is empty", async () => {
      const writeText = vi.fn().mockRejectedValue(new Error("Clipboard denied"));
      Object.defineProperty(navigator, "clipboard", {
        value: { writeText },
        configurable: true,
      });

      const { rerender } = render(<CopyHarness text="fail-me" />);
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Copy now" }));
      });
      expect(screen.getByTestId("status")).toHaveTextContent("error");

      rerender(<CopyHarness text="" />);
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Copy now" }));
      });
      expect(screen.getByTestId("status")).toHaveTextContent("error");
    });
  });

  describe("taskStyles", () => {
    it("returns expected styles, labels, and novice subteam descriptions", () => {
      expect(getPriorityStyle("high")).toContain("text-ares-red");
      expect(getPriorityStyle("medium")).toContain("text-ares-gold");
      expect(getPriorityStyle("low")).toContain("text-marble/60");

      expect(getStatusLabel("todo")).toBe("To Do");
      expect(getStatusLabel("in_progress")).toBe("In Progress");
      expect(getStatusLabel("review")).toBe("In Review");
      expect(getStatusLabel("completed")).toBe("Completed");
      expect(getStatusLabel("custom")).toBe("custom");

      expect(getSubteamStyle("software")).toContain("text-ares-cyan");
      expect(getSubteamStyle("hardware")).toContain("text-ares-red");
      expect(getSubteamStyle("business")).toContain("text-ares-gold");
      expect(getSubteamStyle("outreach")).toContain("text-ares-bronze");

      expect(getSubteamDescription("software")).toContain("autonomous routines");
      expect(getSubteamDescription("hardware")).toContain("Mechanical CAD");
      expect(getSubteamDescription("business")).toContain("Sponsorships");
      expect(getSubteamDescription("outreach")).toContain("Community STEM demos");
      expect(getSubteamDescription("other")).toContain("General team coordination");
    });
  });

  describe("notifyTaskZulip", () => {
    it("posts notification and updates syncState to syncing -> success -> idle", async () => {
      vi.useFakeTimers();
      apiMocks.authenticatedFetch.mockResolvedValue({
        ok: true,
        status: 200,
        statusText: "OK",
      });
      const states: string[] = [];

      const ok = await notifyTaskZulip(
        {
          taskId: "task_1",
          action: "create",
          title: "Tune PID loop",
          priority: "high",
          subteam: "software",
        },
        { setSyncState: (s) => states.push(s) },
      );

      expect(ok).toBe(true);
      expect(states).toEqual(["syncing", "success"]);
      act(() => {
        vi.advanceTimersByTime(3100);
      });
      expect(states).toEqual(["syncing", "success", "idle"]);
    });

    it("handles HTTP errors by reporting notificationError and setting error syncState", async () => {
      vi.useFakeTimers();
      apiMocks.authenticatedFetch.mockResolvedValue({
        ok: false,
        status: 503,
        statusText: "Service Unavailable",
      });
      const states: string[] = [];
      const onNotificationError = vi.fn();

      const ok = await notifyTaskZulip(
        {
          taskId: "task_2",
          action: "move",
          title: "Inspect drivetrain",
          status: "review",
        },
        {
          setSyncState: (s) => states.push(s),
          onNotificationError,
        },
      );

      expect(ok).toBe(false);
      expect(onNotificationError).toHaveBeenCalledWith(
        expect.objectContaining({
          message:
            "The task was saved, but its Zulip notification failed. The board remains the source of truth.",
        }),
      );
      expect(states).toEqual(["syncing", "error"]);
      act(() => {
        vi.advanceTimersByTime(3100);
      });
      expect(states).toEqual(["syncing", "error", "idle"]);
    });
  });

  describe("DashboardOnboardingGuide & DashboardServiceStatusCard", () => {
    it("renders 4 rookie steps, supports dismissal to localStorage, and restores when requested", () => {
      render(
        <MemoryRouter>
          <DashboardOnboardingGuide isUnverified={true} />
        </MemoryRouter>,
      );

      expect(
        screen.getByRole("heading", { name: "Getting Started with the ARES Portal" }),
      ).toBeInTheDocument();
      expect(screen.getByText(/Welcome to ARES #23247!/i)).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /Open Profile/i })).toHaveAttribute(
        "href",
        "/dashboard/profile",
      );
      expect(screen.getByRole("link", { name: /Browse Academy/i })).toHaveAttribute(
        "href",
        "/academy",
      );

      fireEvent.click(
        screen.getByRole("button", { name: "Dismiss Getting Started Guide" }),
      );
      expect(
        screen.queryByRole("heading", {
          name: "Getting Started with the ARES Portal",
        }),
      ).not.toBeInTheDocument();

      const restoreButton = screen.getByRole("button", {
        name: /Show Getting Started Guide/i,
      });
      fireEvent.click(restoreButton);
      expect(
        screen.getByRole("heading", { name: "Getting Started with the ARES Portal" }),
      ).toBeInTheDocument();
    });

    it("renders service states accurately in DashboardServiceStatusCard", () => {
      const { rerender } = render(
        <DashboardServiceStatusCard
          databaseState="error"
          canUseAi={false}
          appCheckActive={true}
          isSignedIn={false}
        />,
      );

      expect(screen.getByText("Unavailable")).toBeInTheDocument();
      expect(screen.getByText("Role restricted")).toBeInTheDocument();
      expect(screen.getByText("Configured")).toBeInTheDocument();
      expect(screen.getByText("Signed out")).toBeInTheDocument();

      rerender(
        <DashboardServiceStatusCard
          databaseState="connecting"
          canUseAi={true}
          appCheckActive={false}
          isSignedIn={true}
        />,
      );

      expect(screen.getByText("Syncing...")).toBeInTheDocument();
      expect(screen.getByText("Role eligible")).toBeInTheDocument();
      expect(screen.getByText("Not configured")).toBeInTheDocument();
      expect(screen.getByText("Signed in")).toBeInTheDocument();
    });
  });

  describe("AcademyRookieBanner & FtcGlossaryBanner", () => {
    it("links rookie tracks to the first lesson in each preferred learning path and toggles visibility", () => {
      const mockDocs: RookieDocumentItem[] = [
        {
          slug: "intro-robot-loop",
          title: "Understanding the Robot Loop",
          level: "beginner",
          pathMemberships: [{ pathId: "robotics-foundations", order: 1 }],
        },
        {
          slug: "cad-fasteners-101",
          title: "Fasteners & Extrusion Basics",
          level: "beginner",
          pathMemberships: [{ pathId: "mechanical-design-fabrication", order: 1 }],
        },
      ];

      render(
        <MemoryRouter>
          <AcademyRookieBanner documents={mockDocs} />
        </MemoryRouter>,
      );

      expect(
        screen.getByRole("heading", { name: "New to Robotics? Start Here" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("link", {
          name: /Start: Understanding the Robot Loop/i,
        }),
      ).toHaveAttribute(
        "href",
        "/academy/intro-robot-loop?path=robotics-foundations",
      );
      expect(
        screen.getByRole("link", {
          name: /Start: Fasteners & Extrusion Basics/i,
        }),
      ).toHaveAttribute(
        "href",
        "/academy/cad-fasteners-101?path=mechanical-design-fabrication",
      );

      fireEvent.click(screen.getByRole("button", { name: /Hide tracks/i }));
      expect(
        screen.queryByText("Fasteners & Extrusion Basics"),
      ).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: /Show tracks/i }));
      expect(
        screen.getByText(/Start: Fasteners & Extrusion Basics/i),
      ).toBeInTheDocument();
    });

    it("expands and collapses the FTC Match & Scoring Glossary on Tournaments", async () => {
      render(<FtcGlossaryBanner />);

      expect(
        screen.getByRole("heading", {
          name: /New to FIRST Tech Challenge\? Match & Scoring Guide/i,
        }),
      ).toBeInTheDocument();
      expect(screen.queryByText("2v2 Alliances")).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: /Explain terms/i }));
      expect(screen.getByText("2v2 Alliances")).toBeInTheDocument();
      expect(screen.getByText("Match Phases (2:30)")).toBeInTheDocument();
      expect(screen.getByText("RP (Ranking Points)")).toBeInTheDocument();
      expect(screen.getByText("OPR (Offensive Power Rating)")).toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: /Hide guide/i }));
      expect(screen.queryByText("2v2 Alliances")).not.toBeInTheDocument();
    });
  });
});
