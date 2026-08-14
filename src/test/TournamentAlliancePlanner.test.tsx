import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { TournamentAlliancePlanner } from "@/app/tournaments/[id]/TournamentAlliancePlanner";
import type { Tournament } from "@/types/tournament";

describe("TournamentAlliancePlanner", () => {
  const mockTournament: Tournament = {
    id: "wv-state-2026",
    name: "WV State Championship",
    date: "2026-03-01",
    location: "Fairmont, WV",
    status: "upcoming",
    opr: 180,
    oprList: [
      { teamNumber: "23247", teamName: "ARES", opr: 180 },
      { teamNumber: "14210", teamName: "Quantum", opr: 190 },
      { teamNumber: "18214", teamName: "Knights", opr: 150 },
      { teamNumber: "11111", teamName: "RoboTitans", opr: 140 },
    ],
    isDeleted: 0,
  };

  it("renders collapsed by default and expands when toggled", () => {
    render(<TournamentAlliancePlanner tournament={mockTournament} />);

    expect(
      screen.getByText("Alliance Strategy & Selection Planner")
    ).toBeInTheDocument();

    const toggleBtn = screen.getByRole("button", { name: /Open Simulator/i });
    fireEvent.click(toggleBtn);

    expect(screen.getByText("Your Alliance")).toBeInTheDocument();
    expect(screen.getByText("Opposing Alliance")).toBeInTheDocument();
  });

  it("calculates combined OPR and advantage differential accurately", () => {
    render(<TournamentAlliancePlanner tournament={mockTournament} />);

    // Open planner
    const toggleBtn = screen.getByRole("button", { name: /Open Simulator/i });
    fireEvent.click(toggleBtn);

    // Initial Your Alliance: 23247 (180) + 14210 (190) = 370
    expect(screen.getByText("Combined OPR: 370")).toBeInTheDocument();

    // Select Opponent Captain: 18214 (150)
    const oppCapSelect = screen.getByLabelText("Opponent Captain");
    fireEvent.change(oppCapSelect, { target: { value: "18214" } });

    // Select Opponent Partner: 11111 (140)
    const oppPartnerSelect = screen.getByLabelText("Opponent Partner");
    fireEvent.change(oppPartnerSelect, { target: { value: "11111" } });

    // Opponent total: 150 + 140 = 290
    expect(screen.getByText("Combined OPR: 290")).toBeInTheDocument();

    // Advantage differential: 370 - 290 = +80 pts
    expect(screen.getByText("+80 pts")).toBeInTheDocument();
  });

  it("renders null if fewer than 2 teams exist in oprList", () => {
    const singleTeamTourney: Tournament = {
      ...mockTournament,
      oprList: [{ teamNumber: "23247", teamName: "ARES", opr: 180 }],
    };
    const { container } = render(
      <TournamentAlliancePlanner tournament={singleTeamTourney} />
    );
    expect(container.firstChild).toBeNull();
  });
});
