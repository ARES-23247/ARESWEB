import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { CommandPalette } from "@/components/navigation/CommandPalette";
import { TournamentPitChecklistSection } from "@/app/tournaments/[id]/TournamentDetailSections";
import type { TournamentMatch } from "@/types/tournament";

function LocationProbe() {
  return <output>{useLocation().pathname}</output>;
}

describe("Quick Jump regressions", () => {
  it("does not let a delayed animation frame steal focus after keyboard navigation", () => {
    vi.useFakeTimers();
    const frames: FrameRequestCallback[] = [];
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      frames.push(callback);
      return frames.length;
    });
    try {
      const view = render(<MemoryRouter><CommandPalette isSignedIn={false} userRole="unverified" /></MemoryRouter>);
      fireEvent.click(screen.getByRole("button", { name: "Open quick jump search" }));
      act(() => vi.advanceTimersByTime(50));
      const search = screen.getByRole("searchbox");
      expect(search).toHaveFocus();
      fireEvent.keyDown(search, { key: "Tab", shiftKey: true });
      const last = screen.getAllByRole("option").at(-1)!;
      expect(last).toHaveFocus();
      act(() => frames.forEach((callback) => callback(100)));
      expect(last).toHaveFocus();
      view.unmount();
    } finally {
      vi.useRealTimers();
      vi.restoreAllMocks();
    }
  });

  it("traps Tab in both directions, closes with Escape, and restores each trigger", async () => {
    render(<MemoryRouter><CommandPalette isSignedIn={false} userRole="unverified" /></MemoryRouter>);
    const trigger = screen.getByRole("button", { name: "Open quick jump search" });
    trigger.focus();
    fireEvent.click(trigger);
    const input = screen.getByRole("searchbox");
    await waitFor(() => expect(input).toHaveFocus());
    const last = screen.getAllByRole("option").at(-1)!;
    fireEvent.keyDown(input, { key: "Tab", shiftKey: true });
    expect(last).toHaveFocus();
    fireEvent.keyDown(last, { key: "Tab" });
    expect(input).toHaveFocus();
    fireEvent.keyDown(input, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    fireEvent.keyDown(trigger, { key: "k", ctrlKey: true });
    const option = screen.getAllByRole("option")[0];
    option.focus();
    fireEvent.keyDown(option, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("opens the public simulation playground from search", () => {
    render(<MemoryRouter><CommandPalette isSignedIn={false} userRole="unverified" /><LocationProbe /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: "Open quick jump search" }));
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "Interactive Simulations" } });
    fireEvent.keyDown(screen.getByRole("searchbox"), { key: "Enter" });
    expect(screen.getByText("/academy/playground")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

const match: TournamentMatch = {
  id: "m-1", tournamentId: "t-1", matchNumber: "Q-1", alliance: "red",
  partner: "19999", opponents: ["11111", "22222"], result: "upcoming", completed: false, isDeleted: 0,
};
function completeChecklist() {
  screen.getAllByRole("checkbox").forEach((checkbox) => fireEvent.click(checkbox));
  expect(screen.getByText("Queue Ready")).toBeInTheDocument();
}
describe("match-scoped pit readiness", () => {
  it("preserves the same match on refetch but resets for a new match or tournament", () => {
    const second = { ...match, id: "m-2", matchNumber: "Q-2" };
    const view = render(<TournamentPitChecklistSection matches={[match, second]} />);
    completeChecklist();
    view.rerender(<TournamentPitChecklistSection matches={[{ ...match }, { ...second }]} />);
    expect(screen.getByText("Queue Ready")).toBeInTheDocument();
    view.rerender(<TournamentPitChecklistSection matches={[{ ...match, completed: true }, second]} />);
    expect(screen.getByText("Q-2")).toBeInTheDocument();
    expect(screen.getByText("0 / 5 Ready")).toBeInTheDocument();
    screen.getAllByRole("checkbox").forEach((checkbox) => expect(checkbox).not.toBeChecked());
    completeChecklist();
    view.rerender(<TournamentPitChecklistSection matches={[{ ...second, tournamentId: "t-2" }]} />);
    expect(screen.getByText("0 / 5 Ready")).toBeInTheDocument();
  });

  it("never offers readiness without an upcoming match and clears prior checks", () => {
    const view = render(<TournamentPitChecklistSection matches={[match]} />);
    completeChecklist();
    for (const matches of [[{ ...match, completed: true }], []]) {
      view.rerender(<TournamentPitChecklistSection matches={matches} />);
      expect(screen.getByText("No upcoming match")).toBeInTheDocument();
      expect(screen.queryByText("Queue Ready")).not.toBeInTheDocument();
      screen.getAllByRole("checkbox").forEach((checkbox) => {
        expect(checkbox).not.toBeChecked();
        expect(checkbox).toBeDisabled();
      });
    }
    view.rerender(<TournamentPitChecklistSection matches={[match]} />);
    expect(screen.getByText("0 / 5 Ready")).toBeInTheDocument();
  });
});
