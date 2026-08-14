import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TournamentMatchEditForm } from "@/app/tournaments/[id]/TournamentMatchEditForm";
import type { TournamentMatch } from "@/types/tournament";

const tournamentMatch: TournamentMatch = {
  id: "qm-4",
  tournamentId: "states",
  matchNumber: "QM4",
  alliance: "red",
  partner: "12345",
  opponents: ["11111", "22222"],
  scoreSelf: 100,
  scoreOpponent: 95,
  result: "won",
  completed: true,
  notes: "Original notes",
  isDeleted: 0,
  updatedAt: "2026-08-14T09:00:00.000Z",
};

describe("TournamentMatchEditForm", () => {
  it("edits the complete match record and closes only after a confirmed save", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onCancel = vi.fn();
    render(
      <TournamentMatchEditForm
        match={tournamentMatch}
        isSaving={false}
        onCancel={onCancel}
        onSave={onSave}
      />,
    );

    fireEvent.change(screen.getByLabelText("Match"), {
      target: { value: "SF1" },
    });
    fireEvent.change(screen.getByLabelText("Alliance"), {
      target: { value: "blue" },
    });
    fireEvent.change(screen.getByLabelText("Partner"), {
      target: { value: "33333" },
    });
    fireEvent.change(screen.getByLabelText("Opponents"), {
      target: { value: "44444, 55555" },
    });
    fireEvent.change(screen.getByLabelText("Our Score"), {
      target: { value: "130" },
    });
    fireEvent.change(screen.getByLabelText("Opponent Score"), {
      target: { value: "120" },
    });
    fireEvent.change(screen.getByLabelText("Outcome"), {
      target: { value: "tie" },
    });
    fireEvent.change(screen.getByLabelText("Scouting Notes"), {
      target: { value: "  Replay review  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save Match" }));

    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith({
        id: "qm-4",
        updatedAt: "2026-08-14T09:00:00.000Z",
        matchNumber: "SF1",
        alliance: "blue",
        partner: "33333",
        opponents: ["44444", "55555"],
        scoreSelf: 130,
        scoreOpponent: 120,
        result: "tie",
        completed: true,
        notes: "Replay review",
      }),
    );
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("preserves the draft when the API rejects the save", async () => {
    const onSave = vi.fn().mockRejectedValue(new Error("offline"));
    const onCancel = vi.fn();
    render(
      <TournamentMatchEditForm
        match={tournamentMatch}
        isSaving={false}
        onCancel={onCancel}
        onSave={onSave}
      />,
    );

    fireEvent.change(screen.getByLabelText("Scouting Notes"), {
      target: { value: "Unsaved pit note" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save Match" }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(screen.getByLabelText("Scouting Notes")).toHaveValue(
      "Unsaved pit note",
    );
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("sends null scores when an editor deliberately clears recorded values", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <TournamentMatchEditForm
        match={tournamentMatch}
        isSaving={false}
        onCancel={vi.fn()}
        onSave={onSave}
      />,
    );

    fireEvent.change(screen.getByLabelText("Our Score"), {
      target: { value: "" },
    });
    fireEvent.change(screen.getByLabelText("Opponent Score"), {
      target: { value: "" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save Match" }));

    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          scoreSelf: null,
          scoreOpponent: null,
        }),
      ),
    );
  });
});
