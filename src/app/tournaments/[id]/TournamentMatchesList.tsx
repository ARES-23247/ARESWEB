import { useState, useMemo } from "react";
import { Bookmark, Plus, Check, Edit2, Trash2, Info } from "lucide-react";
import { TournamentMatch } from "@/types/tournament";
import { summarizeTournamentMatches } from "@/lib/tournamentStats";
import { TournamentMatchEditForm } from "./TournamentMatchEditForm";

interface TournamentMatchesListProps {
  isPast: boolean;
  matches: TournamentMatch[];
  canEdit: boolean;
  isMatchesLoading: boolean;
  isSavingMatch: boolean;
  onToggleMatch: (matchId: string, completed: boolean) => void;
  onAddMatch: (match: Partial<TournamentMatch>) => Promise<void>;
  onUpdateMatch: (
    updated: Partial<TournamentMatch> & { id: string },
  ) => Promise<void>;
  onDeleteMatch: (matchId: string) => Promise<void>;
}

export default function TournamentMatchesList({
  isPast,
  matches,
  canEdit,
  isMatchesLoading,
  isSavingMatch,
  onToggleMatch,
  onAddMatch,
  onUpdateMatch,
  onDeleteMatch,
}: TournamentMatchesListProps) {
  const [matchSearchQuery, setMatchSearchQuery] = useState("");
  const [showAddMatchForm, setShowAddMatchForm] = useState(false);
  const [editingMatchId, setEditingMatchId] = useState<string | null>(null);
  const [pendingArchiveId, setPendingArchiveId] = useState<string | null>(null);

  // New match fields
  const [newMatchNumber, setNewMatchNumber] = useState("");
  const [newAlliance, setNewAlliance] = useState<"red" | "blue">("red");
  const [newPartner, setNewPartner] = useState("");
  const [newOpponents, setNewOpponents] = useState("");
  const [newScoreSelf, setNewScoreSelf] = useState("");
  const [newScoreOpponent, setNewScoreOpponent] = useState("");
  const [newResult, setNewResult] = useState<
    "won" | "lost" | "tie" | "upcoming"
  >("upcoming");
  const [newNotes, setNewNotes] = useState("");

  const resetNewMatchForm = () => {
    setNewMatchNumber("");
    setNewAlliance("red");
    setNewPartner("");
    setNewOpponents("");
    setNewScoreSelf("");
    setNewScoreOpponent("");
    setNewResult("upcoming");
    setNewNotes("");
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMatchNumber) return;

    try {
      await onAddMatch({
        matchNumber: newMatchNumber.trim(),
        alliance: newAlliance,
        partner: newPartner.trim() || "TBD",
        opponents: newOpponents
          ? newOpponents
              .split(",")
              .map((team) => team.trim())
              .filter(Boolean)
          : ["TBD"],
        scoreSelf: newScoreSelf ? Number.parseInt(newScoreSelf, 10) : undefined,
        scoreOpponent: newScoreOpponent
          ? Number.parseInt(newScoreOpponent, 10)
          : undefined,
        result: newResult,
        completed: newResult !== "upcoming",
        notes: newNotes.trim(),
      });
      setShowAddMatchForm(false);
      resetNewMatchForm();
    } catch {
      // The parent exposes the API error; keep every entered value for retry.
    }
  };

  const filteredMatches = useMemo(() => {
    return matches.filter((m) => {
      return (
        m.matchNumber.toLowerCase().includes(matchSearchQuery.toLowerCase()) ||
        m.partner.toLowerCase().includes(matchSearchQuery.toLowerCase()) ||
        m.opponents.some((o) =>
          o.toLowerCase().includes(matchSearchQuery.toLowerCase()),
        )
      );
    });
  }, [matches, matchSearchQuery]);
  const summary = useMemo(() => summarizeTournamentMatches(matches), [matches]);

  return (
    <section className="bg-white/5 border border-white/10 rounded-2xl p-6 relative overflow-hidden backdrop-blur-sm shadow-xl text-left">
      <div className="flex flex-col gap-4 border-b border-white/5 pb-4 mb-6 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-bold text-white uppercase tracking-tight font-heading flex items-center gap-2">
            <Bookmark className="text-ares-gold" size={18} aria-hidden="true" />
            Match Checklist
          </h2>
          <p className="text-[11px] text-marble/55 mt-0.5">
            Toggle match completion to track strategy checklists.
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <label htmlFor="match-search" className="sr-only">
            Filter matches by number or team
          </label>
          <input
            id="match-search"
            type="text"
            placeholder="Filter match..."
            value={matchSearchQuery}
            onChange={(e) => setMatchSearchQuery(e.target.value)}
            className="bg-black/40 border border-white/10 rounded px-2.5 py-1 text-[11px] text-white placeholder-marble/45 focus:outline-none focus:border-ares-red"
          />
          {canEdit && (
            <button
              type="button"
              onClick={() => setShowAddMatchForm(!showAddMatchForm)}
              aria-expanded={showAddMatchForm}
              className="bg-ares-red/10 border border-ares-red/35 text-white hover:bg-ares-red hover:text-white transition-colors px-3 py-1 text-[11px] font-black uppercase tracking-wider rounded flex items-center gap-1 cursor-pointer"
            >
              <Plus size={12} /> Add Match
            </button>
          )}
        </div>
      </div>

      {/* Add Match Inline Form */}
      {showAddMatchForm && (
        <form
          onSubmit={handleAddSubmit}
          className="bg-black/35 border border-white/10 p-4 rounded-xl mb-6 space-y-3"
        >
          <h3 className="text-xs font-black uppercase text-ares-gold tracking-widest">
            New Match Log
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label
                htmlFor="new-match-number"
                className="block text-[10px] text-marble/60 uppercase font-bold mb-1"
              >
                Match Number
              </label>
              <input
                id="new-match-number"
                type="text"
                placeholder="e.g. QM3"
                required
                value={newMatchNumber}
                onChange={(e) => setNewMatchNumber(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded p-1.5 text-xs text-white"
              />
            </div>
            <div>
              <label
                htmlFor="new-match-alliance"
                className="block text-[10px] text-marble/60 uppercase font-bold mb-1"
              >
                Alliance
              </label>
              <select
                id="new-match-alliance"
                value={newAlliance}
                onChange={(e) =>
                  setNewAlliance(e.target.value as "red" | "blue")
                }
                className="w-full bg-white/5 border border-white/10 rounded p-1.5 text-xs text-white"
              >
                <option value="red" className="bg-obsidian">
                  Red Alliance
                </option>
                <option value="blue" className="bg-obsidian">
                  Blue Alliance
                </option>
              </select>
            </div>
            <div>
              <label
                htmlFor="new-match-partner"
                className="block text-[10px] text-marble/60 uppercase font-bold mb-1"
              >
                Partner Team
              </label>
              <input
                id="new-match-partner"
                type="text"
                placeholder="e.g. 12345"
                value={newPartner}
                onChange={(e) => setNewPartner(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded p-1.5 text-xs text-white"
              />
            </div>
            <div>
              <label
                htmlFor="new-match-opponents"
                className="block text-[10px] text-marble/60 uppercase font-bold mb-1"
              >
                Opponents (comma-sep)
              </label>
              <input
                id="new-match-opponents"
                type="text"
                placeholder="e.g. 99999, 8888"
                value={newOpponents}
                onChange={(e) => setNewOpponents(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded p-1.5 text-xs text-white"
              />
            </div>
          </div>

          {isPast && (
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label
                  htmlFor="new-match-score-self"
                  className="block text-[10px] text-marble/60 uppercase font-bold mb-1"
                >
                  Our Score
                </label>
                <input
                  id="new-match-score-self"
                  type="number"
                  value={newScoreSelf}
                  onChange={(e) => setNewScoreSelf(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded p-1.5 text-xs text-white"
                />
              </div>
              <div>
                <label
                  htmlFor="new-match-score-opponent"
                  className="block text-[10px] text-marble/60 uppercase font-bold mb-1"
                >
                  Opponent Score
                </label>
                <input
                  id="new-match-score-opponent"
                  type="number"
                  value={newScoreOpponent}
                  onChange={(e) => setNewScoreOpponent(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded p-1.5 text-xs text-white"
                />
              </div>
              <div>
                <label
                  htmlFor="new-match-result"
                  className="block text-[10px] text-marble/60 uppercase font-bold mb-1"
                >
                  Result
                </label>
                <select
                  id="new-match-result"
                  value={newResult}
                  onChange={(e) =>
                    setNewResult(e.target.value as TournamentMatch["result"])
                  }
                  className="w-full bg-white/5 border border-white/10 rounded p-1.5 text-xs text-white"
                >
                  <option value="won" className="bg-obsidian">
                    Won
                  </option>
                  <option value="lost" className="bg-obsidian">
                    Lost
                  </option>
                  <option value="tie" className="bg-obsidian">
                    Tie
                  </option>
                  <option value="upcoming" className="bg-obsidian">
                    Upcoming
                  </option>
                </select>
              </div>
            </div>
          )}

          <div>
            <label
              htmlFor="new-match-notes"
              className="block text-[10px] text-marble/60 uppercase font-bold mb-1"
            >
              Match Scouting Notes
            </label>
            <textarea
              id="new-match-notes"
              placeholder="Scouting telemetry, hardware issues, or driver feedback..."
              rows={2}
              value={newNotes}
              onChange={(e) => setNewNotes(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded p-1.5 text-xs text-white resize-none"
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowAddMatchForm(false)}
              className="px-4 py-1.5 text-xs text-marble/60 hover:text-white uppercase font-black tracking-wider"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSavingMatch}
              className="bg-ares-red border border-ares-bronze/40 text-white px-5 py-1.5 rounded text-xs font-black uppercase tracking-wider cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSavingMatch ? "Saving..." : "Save Match"}
            </button>
          </div>
        </form>
      )}

      {!isMatchesLoading && matches.length > 0 && (
        <section
          aria-label="Event-day match summary"
          className="mb-5 grid grid-cols-1 gap-3 rounded-xl border border-white/10 bg-black/25 p-4 sm:grid-cols-3"
        >
          <div>
            <span className="block text-[9px] font-black uppercase tracking-widest text-marble/55">
              Checklist Progress
            </span>
            <strong className="mt-1 block text-lg text-white">
              {summary.completed}/{summary.total}
            </strong>
            <progress
              className="mt-2 h-1.5 w-full accent-ares-red"
              max={summary.total}
              value={summary.completed}
              aria-label={`${summary.completed} of ${summary.total} matches complete`}
            />
            <span className="mt-1 block text-[10px] text-marble/55">
              {summary.pending} awaiting completion
            </span>
          </div>
          <div>
            <span className="block text-[9px] font-black uppercase tracking-widest text-marble/55">
              Recorded Outcomes
            </span>
            <strong className="mt-1 block text-lg text-white">
              {summary.recordedOutcomes > 0
                ? `${summary.wins}-${summary.losses}-${summary.ties}`
                : "Not recorded"}
            </strong>
            <span className="mt-1 block text-[10px] text-marble/55">
              Wins-losses-ties from saved results
            </span>
          </div>
          <div>
            <span className="block text-[9px] font-black uppercase tracking-widest text-marble/55">
              Average Recorded Score
            </span>
            <strong className="mt-1 block text-lg text-ares-gold">
              {summary.averageScore ?? "Not recorded"}
            </strong>
            <span className="mt-1 block text-[10px] text-marble/55">
              Completed results with a saved score
            </span>
          </div>
        </section>
      )}

      {/* Matches List */}
      {isMatchesLoading ? (
        <div className="flex items-center justify-center py-10">
          <div className="w-6 h-6 border-2 border-ares-red/35 border-t-ares-red rounded-full animate-spin mr-3" />
          <span className="text-xs uppercase tracking-wider text-marble/55">
            Loading matches...
          </span>
        </div>
      ) : matches.length === 0 ? (
        <div className="text-center py-10 bg-black/20 border border-dashed border-white/10 rounded-xl">
          <p className="text-xs text-marble/55">
            No match records compiled yet.
          </p>
        </div>
      ) : filteredMatches.length === 0 ? (
        <div className="text-center py-10 bg-black/20 border border-dashed border-white/10 rounded-xl">
          <p className="text-xs text-marble/55">
            No matches fit this filter. Clear the search field to see all
            records.
          </p>
        </div>
      ) : (
        <div className="space-y-3.5">
          {filteredMatches.map((m) => {
            const isRedAlliance = m.alliance === "red";
            const isUpcoming = m.result === "upcoming";

            return (
              <div
                key={m.id}
                className={`border rounded-xl p-4 transition-all ${
                  m.completed
                    ? "bg-black/35 border-white/10"
                    : "bg-white/5 border-ares-bronze/35 shadow-[0_0_10px_rgba(205,127,50,0.05)]"
                }`}
              >
                {editingMatchId === m.id ? (
                  <TournamentMatchEditForm
                    match={m}
                    isSaving={isSavingMatch}
                    onCancel={() => setEditingMatchId(null)}
                    onSave={onUpdateMatch}
                  />
                ) : (
                  // Normal View
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      {/* Checkbox Trigger */}
                      {canEdit ? (
                        <button
                          type="button"
                          onClick={() => onToggleMatch(m.id, !m.completed)}
                          className={`w-5 h-5 rounded border flex items-center justify-center transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-ares-cyan ${
                            m.completed
                              ? "bg-ares-red border-ares-red text-white"
                              : "border-white/20 hover:border-ares-gold bg-black/40 text-transparent"
                          }`}
                          aria-label={`${m.completed ? "Mark incomplete" : "Mark complete"}: ${m.matchNumber}`}
                          aria-pressed={m.completed}
                        >
                          <Check
                            size={12}
                            className={
                              m.completed ? "opacity-100" : "opacity-0"
                            }
                            aria-hidden="true"
                          />
                        </button>
                      ) : (
                        <span
                          className={`w-5 h-5 rounded border flex items-center justify-center ${m.completed ? "bg-ares-red border-ares-red text-white" : "border-white/20 bg-black/40"}`}
                          aria-label={`${m.matchNumber} is ${m.completed ? "complete" : "incomplete"}`}
                        >
                          {m.completed && (
                            <Check size={12} aria-hidden="true" />
                          )}
                        </span>
                      )}

                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-white font-heading">
                            {m.matchNumber}
                          </span>
                          <span
                            className={`text-[9px] px-1.5 py-0.5 rounded-full font-black uppercase tracking-wider ${
                              isRedAlliance
                                ? "bg-ares-red text-white border border-ares-red"
                                : "bg-ares-gold/15 text-ares-gold border border-ares-gold/35"
                            }`}
                          >
                            {m.alliance} alliance
                          </span>
                          {!isUpcoming && (
                            <span
                              className={`text-[9px] uppercase font-black ${
                                m.result === "won"
                                  ? "text-ares-gold"
                                  : m.result === "lost"
                                    ? "rounded bg-ares-red px-1.5 py-0.5 text-white"
                                    : "text-marble/40"
                              }`}
                            >
                              {m.result}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-marble/55 mt-1">
                          Partner:{" "}
                          <strong className="text-white">{m.partner}</strong> |
                          Opponents:{" "}
                          <strong className="text-white">
                            {m.opponents.join(", ")}
                          </strong>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between md:justify-end gap-4 border-t md:border-t-0 border-white/5 pt-2.5 md:pt-0">
                      {/* Score display */}
                      {!isUpcoming &&
                        typeof m.scoreSelf === "number" &&
                        typeof m.scoreOpponent === "number" && (
                          <div className="text-xs font-semibold text-right">
                            <span
                              className={
                                m.result === "won"
                                  ? "text-ares-gold font-bold"
                                  : "text-white"
                              }
                            >
                              {m.scoreSelf}
                            </span>
                            <span className="text-marble/30 mx-1">-</span>
                            <span className="text-marble/55">
                              {m.scoreOpponent}
                            </span>
                          </div>
                        )}

                      {/* Action tools */}
                      {canEdit && (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setEditingMatchId(m.id)}
                            aria-label={`Edit scoring values for ${m.matchNumber}`}
                            className="p-1.5 text-marble/50 hover:text-ares-gold hover:bg-white/5 rounded transition-all cursor-pointer"
                            title="Edit scoring values"
                          >
                            <Edit2 size={12} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setPendingArchiveId(m.id)}
                            aria-label={`Archive ${m.matchNumber}`}
                            className="p-1.5 text-marble/50 hover:text-ares-gold hover:bg-white/5 rounded transition-all cursor-pointer"
                            title="Archive match record"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {pendingArchiveId === m.id && (
                  <div
                    role="alertdialog"
                    aria-labelledby={`archive-match-${m.id}`}
                    className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-ares-red/40 bg-ares-red/10 p-3"
                  >
                    <p
                      id={`archive-match-${m.id}`}
                      className="text-xs text-white"
                    >
                      Archive {m.matchNumber}? It will be hidden but kept in the
                      record history.
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setPendingArchiveId(null)}
                        className="rounded border border-white/20 px-3 py-1 text-[10px] font-bold uppercase text-white focus-visible:ring-2 focus-visible:ring-ares-cyan"
                      >
                        Keep Match
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await onDeleteMatch(m.id);
                            setPendingArchiveId(null);
                          } catch {
                            // Keep the confirmation open while the parent shows the error.
                          }
                        }}
                        disabled={isSavingMatch}
                        className="rounded bg-ares-red px-3 py-1 text-[10px] font-bold uppercase text-white focus-visible:ring-2 focus-visible:ring-ares-cyan disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Archive Match
                      </button>
                    </div>
                  </div>
                )}

                {/* Match notes */}
                {m.notes && !editingMatchId && (
                  <div className="mt-3.5 pt-2.5 border-t border-white/5 text-[11px] text-marble/60 flex items-start gap-1">
                    <Info
                      size={11}
                      className="text-ares-gold shrink-0 mt-0.5"
                    />
                    <p className="italic leading-relaxed">{m.notes}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
