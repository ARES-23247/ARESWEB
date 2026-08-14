import { useState, type FormEvent } from "react";
import type { TournamentMatch } from "@/types/tournament";

interface TournamentMatchEditFormProps {
  match: TournamentMatch;
  isSaving: boolean;
  onCancel: () => void;
  onSave: (updated: Partial<TournamentMatch> & { id: string }) => Promise<void>;
}

function optionalScore(value: string): number | null {
  if (value.trim() === "") return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

export function TournamentMatchEditForm({
  match,
  isSaving,
  onCancel,
  onSave,
}: TournamentMatchEditFormProps) {
  const [matchNumber, setMatchNumber] = useState(match.matchNumber);
  const [alliance, setAlliance] = useState<TournamentMatch["alliance"]>(
    match.alliance,
  );
  const [partner, setPartner] = useState(match.partner);
  const [opponents, setOpponents] = useState(match.opponents.join(", "));
  const [scoreSelf, setScoreSelf] = useState(match.scoreSelf?.toString() ?? "");
  const [scoreOpponent, setScoreOpponent] = useState(
    match.scoreOpponent?.toString() ?? "",
  );
  const [result, setResult] = useState<TournamentMatch["result"]>(match.result);
  const [notes, setNotes] = useState(match.notes ?? "");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const opponentTeams = opponents
      .split(",")
      .map((team) => team.trim())
      .filter(Boolean);
    if (!matchNumber.trim() || !partner.trim() || opponentTeams.length === 0)
      return;

    try {
      await onSave({
        id: match.id,
        updatedAt: match.updatedAt ?? null,
        matchNumber: matchNumber.trim(),
        alliance,
        partner: partner.trim(),
        opponents: opponentTeams,
        scoreSelf: optionalScore(scoreSelf),
        scoreOpponent: optionalScore(scoreOpponent),
        result,
        completed: result !== "upcoming",
        notes: notes.trim(),
      });
      onCancel();
    } catch {
      // The parent keeps the explicit API error visible; preserve this draft.
    }
  };

  return (
    <form
      onSubmit={submit}
      className="space-y-3"
      aria-label={`Edit ${match.matchNumber}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-black uppercase text-ares-gold">
          Edit Match: {match.matchNumber}
        </span>
        <button
          type="button"
          onClick={onCancel}
          disabled={isSaving}
          className="text-[10px] text-marble/60 uppercase font-black hover:text-white disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <div>
          <label
            htmlFor={`edit_number_${match.id}`}
            className="block text-[9px] uppercase font-bold text-marble/50"
          >
            Match
          </label>
          <input
            id={`edit_number_${match.id}`}
            required
            value={matchNumber}
            onChange={(event) => setMatchNumber(event.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded p-1 text-xs text-white"
          />
        </div>
        <div>
          <label
            htmlFor={`edit_alliance_${match.id}`}
            className="block text-[9px] uppercase font-bold text-marble/50"
          >
            Alliance
          </label>
          <select
            id={`edit_alliance_${match.id}`}
            value={alliance}
            onChange={(event) =>
              setAlliance(event.target.value as TournamentMatch["alliance"])
            }
            className="w-full bg-white/5 border border-white/10 rounded p-1 text-xs text-white"
          >
            <option value="red">Red</option>
            <option value="blue">Blue</option>
          </select>
        </div>
        <div>
          <label
            htmlFor={`edit_partner_${match.id}`}
            className="block text-[9px] uppercase font-bold text-marble/50"
          >
            Partner
          </label>
          <input
            id={`edit_partner_${match.id}`}
            required
            value={partner}
            onChange={(event) => setPartner(event.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded p-1 text-xs text-white"
          />
        </div>
        <div>
          <label
            htmlFor={`edit_opponents_${match.id}`}
            className="block text-[9px] uppercase font-bold text-marble/50"
          >
            Opponents
          </label>
          <input
            id={`edit_opponents_${match.id}`}
            required
            value={opponents}
            onChange={(event) => setOpponents(event.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded p-1 text-xs text-white"
          />
        </div>
        <div>
          <label
            htmlFor={`edit_self_${match.id}`}
            className="block text-[9px] uppercase font-bold text-marble/50"
          >
            Our Score
          </label>
          <input
            id={`edit_self_${match.id}`}
            type="number"
            min="0"
            value={scoreSelf}
            onChange={(event) => setScoreSelf(event.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded p-1 text-xs text-white"
          />
        </div>
        <div>
          <label
            htmlFor={`edit_opp_${match.id}`}
            className="block text-[9px] uppercase font-bold text-marble/50"
          >
            Opponent Score
          </label>
          <input
            id={`edit_opp_${match.id}`}
            type="number"
            min="0"
            value={scoreOpponent}
            onChange={(event) => setScoreOpponent(event.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded p-1 text-xs text-white"
          />
        </div>
        <div>
          <label
            htmlFor={`edit_res_${match.id}`}
            className="block text-[9px] uppercase font-bold text-marble/50"
          >
            Outcome
          </label>
          <select
            id={`edit_res_${match.id}`}
            value={result}
            onChange={(event) =>
              setResult(event.target.value as TournamentMatch["result"])
            }
            className="w-full bg-white/5 border border-white/10 rounded p-1 text-xs text-white"
          >
            <option value="won">Won</option>
            <option value="lost">Lost</option>
            <option value="tie">Tie</option>
            <option value="upcoming">Upcoming</option>
          </select>
        </div>
        <div className="flex items-end">
          <button
            type="submit"
            disabled={isSaving}
            className="w-full bg-ares-red text-white py-1.5 rounded text-[10px] uppercase font-black tracking-wider cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? "Saving..." : "Save Match"}
          </button>
        </div>
      </div>
      <div>
        <label
          htmlFor={`edit_notes_${match.id}`}
          className="block text-[9px] uppercase font-bold text-marble/50"
        >
          Scouting Notes
        </label>
        <textarea
          id={`edit_notes_${match.id}`}
          rows={2}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          className="w-full resize-none rounded border border-white/10 bg-white/5 p-2 text-xs text-white"
        />
      </div>
    </form>
  );
}
