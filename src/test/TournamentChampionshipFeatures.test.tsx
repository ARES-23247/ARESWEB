import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TournamentAlliancePlanner } from "@/app/tournaments/[id]/TournamentAlliancePlanner";
import { TournamentPitCommand } from "@/app/tournaments/[id]/TournamentPitCommand";
import { TournamentScoutingHub } from "@/app/tournaments/[id]/TournamentScoutingHub";
import type { Tournament, TournamentMatch } from "@/types/tournament";

const mockSubmitPit = vi.hoisted(() => vi.fn());
const mockSubmitStand = vi.hoisted(() => vi.fn());
const mockSavePitState = vi.hoisted(() => vi.fn());

vi.mock("@/lib/tournamentApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/tournamentApi")>();
  return {
    ...actual,
    submitPitScouting: mockSubmitPit,
    submitStandScouting: mockSubmitStand,
    saveTournamentPitState: mockSavePitState,
  };
});

describe("Championship Phase 1 Tournament Components", () => {
  const sampleTournament: Tournament = {
    id: "wv-champ-2027",
    name: "WV State Championship",
    date: "2027-02-20",
    location: "Fairmont, WV",
    status: "upcoming",
    ftcSeason: 2026,
    ftcEventCode: "USWVSTATE",
    opr: 132.4,
    rank: 2,
    wins: 5,
    losses: 1,
    ties: 0,
    oprList: [
      {
        teamNumber: "23247",
        teamName: "ARES",
        opr: 132.4,
        autoOpr: 42.1,
        teleopOpr: 70.3,
        endgameOpr: 20.0,
        rank: 2,
      },
      {
        teamNumber: "11115",
        teamName: "Gluten Free",
        opr: 140.2,
        autoOpr: 46.0,
        teleopOpr: 74.2,
        endgameOpr: 20.0,
        rank: 1,
      },
      {
        teamNumber: "19999",
        teamName: "Gearheads",
        opr: 85.0,
        autoOpr: 20.0,
        teleopOpr: 55.0,
        endgameOpr: 10.0,
        rank: 12,
      },
    ],
    picklist: [{ teamNumber: "11115", tier: "first_pick", notes: "Clean auto" }],
    isDeleted: 0,
  };

  const sampleMatches: TournamentMatch[] = [
    {
      id: "m_qm5",
      tournamentId: "wv-champ-2027",
      matchNumber: "QM5",
      alliance: "red",
      partner: "11115",
      opponents: ["19999", "14444"],
      result: "upcoming",
      completed: false,
      isDeleted: 0,
    },
  ];

  beforeEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
  });

  it("queues Stand Scouting into Offline Pit Outbox on network failure and flushes on manual sync", async () => {
    mockSubmitStand.mockRejectedValueOnce(new Error("Offline venue Wi-Fi"));
    const onRefresh = vi.fn();

    render(
      <TournamentScoutingHub
        tournamentId="wv-champ-2027"
        scoutingBundle={{ pitScouting: [], standScouting: [], teamSummaries: [] }}
        isLoading={false}
        onRefresh={onRefresh}
      />,
    );

    fireEvent.change(screen.getByLabelText(/Match #/i), {
      target: { value: "QM5" },
    });
    fireEvent.change(screen.getByLabelText(/Team #/i), {
      target: { value: "11115" },
    });
    fireEvent.change(screen.getByLabelText(/Auto Est\. Pts/i), {
      target: { value: "38" },
    });
    fireEvent.change(screen.getByLabelText(/TeleOp Cycles/i), {
      target: { value: "11" },
    });

    fireEvent.click(
      screen.getByRole("button", { name: /Submit Stand Report/i }),
    );

    await waitFor(() => {
      expect(screen.getByText(/1 queued offline/i)).toBeInTheDocument();
    });

    mockSubmitStand.mockResolvedValueOnce({
      duplicate: false,
      entry: { id: "s1" },
    });

    fireEvent.click(screen.getByRole("button", { name: /Sync Outbox/i }));

    await waitFor(() => {
      expect(onRefresh).toHaveBeenCalled();
    });
    expect(screen.queryByText(/1 queued offline/i)).not.toBeInTheDocument();
  });

  it("renders Auto/TeleOp/Endgame NP-OPR and saves Mentor/Coach Alliance Picklist tiers", async () => {
    const onSavePicklist = vi.fn().mockResolvedValue([]);

    render(
      <TournamentAlliancePlanner
        tournament={sampleTournament}
        teamSummaries={[
          {
            teamNumber: "11115",
            matchesScouted: 3,
            avgAutoScore: 44,
            avgTeleopCycles: 12,
            highEndgameRate: 100,
            disconnectRate: 0,
          },
        ]}
        canManagePicklist={true}
        onSavePicklist={onSavePicklist}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Open Simulator/i }));
    expect(screen.getByText(/Playoff Alliance Picklist/i)).toBeInTheDocument();
    expect(screen.getByText(/100% High EG/i)).toBeInTheDocument();

    const tierSelect = screen.getByLabelText("Picklist tier for #19999");
    fireEvent.change(tierSelect, { target: { value: "do_not_pick" } });

    fireEvent.click(screen.getByRole("button", { name: /Save Picklist/i }));

    await waitFor(() => {
      expect(onSavePicklist).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            teamNumber: "19999",
            tier: "do_not_pick",
          }),
        ]),
      );
    });
  });

  it("tracks Pit Command batteries, blockers, and opens Fullscreen Pit Kiosk", async () => {
    const onSavePitState = vi.fn().mockResolvedValue({});

    render(
      <TournamentPitCommand
        tournament={sampleTournament}
        matches={sampleMatches}
        pitState={{
          checklists: { QM5: ["battery"] },
          batteries: [
            {
              id: "B1",
              label: "Pack Alpha",
              voltage: 13.5,
              status: "charged",
              cycles: 1,
            },
            {
              id: "B2",
              label: "Pack Beta",
              voltage: 12.4,
              status: "cooldown",
              cycles: 2,
            },
          ],
          triageItems: [
            {
              id: "t1",
              severity: "blocker",
              subsystem: "Claw",
              summary: "Replace stripped servo horn",
              resolved: false,
            },
          ],
        }}
        onSavePitState={onSavePitState}
      />,
    );

    expect(
      screen.getByText("Pre-Match Pit & Queuing Checklist"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Next: Pack Alpha \(13\.5V\)/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Replace stripped servo horn/i),
    ).toBeInTheDocument();

    // Launch Fullscreen Pit Kiosk
    fireEvent.click(screen.getByRole("button", { name: /Launch Pit Kiosk/i }));

    const dialog = screen.getByRole("dialog", {
      name: /Pit Command Kiosk Display/i,
    });
    expect(dialog).toBeInTheDocument();
    expect(screen.getByText(/1 Open Blocker/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Exit Kiosk/i }));
    expect(
      screen.queryByRole("dialog", { name: /Pit Command Kiosk Display/i }),
    ).not.toBeInTheDocument();
  });
});
