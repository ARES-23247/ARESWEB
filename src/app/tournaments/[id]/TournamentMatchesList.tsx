import React, { useState, useMemo } from "react";
import { Bookmark, Plus, Check, Edit2, Trash2, Info, X } from "lucide-react";
import { TournamentMatch } from "@/types/tournament";

interface TournamentMatchesListProps {
  tournamentId: string;
  isPast: boolean;
  matches: TournamentMatch[];
  canEdit: boolean;
  isMatchesLoading: boolean;
  onToggleMatch: (matchId: string, completed: boolean) => void;
  onAddMatch: (match: Partial<TournamentMatch>) => void;
  onUpdateMatch: (updated: Partial<TournamentMatch> & { id: string }) => void;
  onDeleteMatch: (matchId: string) => void;
}

export default function TournamentMatchesList({
  tournamentId,
  isPast,
  matches,
  canEdit,
  isMatchesLoading,
  onToggleMatch,
  onAddMatch,
  onUpdateMatch,
  onDeleteMatch
}: TournamentMatchesListProps) {
  const [matchSearchQuery, setMatchSearchQuery] = useState("");
  const [showAddMatchForm, setShowAddMatchForm] = useState(false);
  const [editingMatchId, setEditingMatchId] = useState<string | null>(null);

  // New match fields
  const [newMatchNumber, setNewMatchNumber] = useState("");
  const [newAlliance, setNewAlliance] = useState<"red" | "blue">("red");
  const [newPartner, setNewPartner] = useState("");
  const [newOpponents, setNewOpponents] = useState("");
  const [newScoreSelf, setNewScoreSelf] = useState("");
  const [newScoreOpponent, setNewScoreOpponent] = useState("");
  const [newResult, setNewResult] = useState<"won" | "lost" | "tie" | "upcoming">("upcoming");
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

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMatchNumber) return;

    onAddMatch({
      matchNumber: newMatchNumber,
      alliance: newAlliance,
      partner: newPartner || "TBD",
      opponents: newOpponents ? newOpponents.split(",").map((s) => s.trim()) : ["TBD", "TBD"],
      scoreSelf: newScoreSelf ? parseInt(newScoreSelf) : 0,
      scoreOpponent: newScoreOpponent ? parseInt(newScoreOpponent) : 0,
      result: newResult,
      completed: newResult !== "upcoming",
      notes: newNotes
    });

    setShowAddMatchForm(false);
    resetNewMatchForm();
  };

  const filteredMatches = useMemo(() => {
    return matches.filter((m) => {
      return (
        m.matchNumber.toLowerCase().includes(matchSearchQuery.toLowerCase()) ||
        m.partner.toLowerCase().includes(matchSearchQuery.toLowerCase()) ||
        m.opponents.some((o) => o.toLowerCase().includes(matchSearchQuery.toLowerCase()))
      );
    });
  }, [matches, matchSearchQuery]);

  return (
    <section className="bg-white/5 border border-white/10 rounded-2xl p-6 relative overflow-hidden backdrop-blur-sm shadow-xl text-left">
      <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-6">
        <div>
          <h2 className="text-lg font-bold text-white uppercase tracking-tight font-heading flex items-center gap-2">
            <Bookmark className="text-ares-red" size={18} />
            Match Checklist
          </h2>
          <p className="text-[11px] text-marble/55 mt-0.5">Toggle match completion to track strategy checklists.</p>
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Filter match..."
            value={matchSearchQuery}
            onChange={(e) => setMatchSearchQuery(e.target.value)}
            className="bg-black/40 border border-white/10 rounded px-2.5 py-1 text-[11px] text-white placeholder-marble/45 focus:outline-none focus:border-ares-red"
          />
          {canEdit && (
            <button
              onClick={() => setShowAddMatchForm(!showAddMatchForm)}
              className="bg-ares-red/10 border border-ares-red/35 text-white hover:bg-ares-red hover:text-white transition-colors px-3 py-1 text-[11px] font-black uppercase tracking-wider rounded flex items-center gap-1 cursor-pointer"
            >
              <Plus size={12} /> Add Match
            </button>
          )}
        </div>
      </div>

      {/* Add Match Inline Form */}
      {showAddMatchForm && (
        <form onSubmit={handleAddSubmit} className="bg-black/35 border border-white/10 p-4 rounded-xl mb-6 space-y-3">
          <h3 className="text-xs font-black uppercase text-ares-gold tracking-widest">New Match Log</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-[10px] text-marble/60 uppercase font-bold mb-1">Match Number</label>
              <input
                type="text"
                placeholder="e.g. QM3"
                required
                value={newMatchNumber}
                onChange={(e) => setNewMatchNumber(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded p-1.5 text-xs text-white"
              />
            </div>
            <div>
              <label className="block text-[10px] text-marble/60 uppercase font-bold mb-1">Alliance</label>
              <select
                value={newAlliance}
                onChange={(e) => setNewAlliance(e.target.value as "red" | "blue")}
                className="w-full bg-white/5 border border-white/10 rounded p-1.5 text-xs text-white"
              >
                <option value="red" className="bg-obsidian">Red Alliance</option>
                <option value="blue" className="bg-obsidian">Blue Alliance</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] text-marble/60 uppercase font-bold mb-1">Partner Team</label>
              <input
                type="text"
                placeholder="e.g. 12345"
                value={newPartner}
                onChange={(e) => setNewPartner(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded p-1.5 text-xs text-white"
              />
            </div>
            <div>
              <label className="block text-[10px] text-marble/60 uppercase font-bold mb-1">Opponents (comma-sep)</label>
              <input
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
                <label className="block text-[10px] text-marble/60 uppercase font-bold mb-1">Our Score</label>
                <input
                  type="number"
                  value={newScoreSelf}
                  onChange={(e) => setNewScoreSelf(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded p-1.5 text-xs text-white"
                />
              </div>
              <div>
                <label className="block text-[10px] text-marble/60 uppercase font-bold mb-1">Opponent Score</label>
                <input
                  type="number"
                  value={newScoreOpponent}
                  onChange={(e) => setNewScoreOpponent(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded p-1.5 text-xs text-white"
                />
              </div>
              <div>
                <label className="block text-[10px] text-marble/60 uppercase font-bold mb-1">Result</label>
                <select
                  value={newResult}
                  onChange={(e) => setNewResult(e.target.value as any)}
                  className="w-full bg-white/5 border border-white/10 rounded p-1.5 text-xs text-white"
                >
                  <option value="won" className="bg-obsidian">Won</option>
                  <option value="lost" className="bg-obsidian">Lost</option>
                  <option value="tie" className="bg-obsidian">Tie</option>
                  <option value="upcoming" className="bg-obsidian">Upcoming</option>
                </select>
              </div>
            </div>
          )}

          <div>
            <label className="block text-[10px] text-marble/60 uppercase font-bold mb-1">Match Scouting Notes</label>
            <textarea
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
              className="bg-ares-red border border-ares-bronze/40 text-white px-5 py-1.5 rounded text-xs font-black uppercase tracking-wider cursor-pointer"
            >
              Save Match
            </button>
          </div>
        </form>
      )}

      {/* Matches List */}
      {isMatchesLoading ? (
        <div className="flex items-center justify-center py-10">
          <div className="w-6 h-6 border-2 border-ares-red/35 border-t-ares-red rounded-full animate-spin mr-3" />
          <span className="text-xs uppercase tracking-wider text-marble/55">Loading matches...</span>
        </div>
      ) : filteredMatches.length === 0 ? (
        <div className="text-center py-10 bg-black/20 border border-dashed border-white/10 rounded-xl">
          <p className="text-xs text-marble/55">No match records compiled yet.</p>
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
                  // Edit Score Inline Form
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black uppercase text-ares-gold">Edit Score: {m.matchNumber}</span>
                      <button
                        onClick={() => setEditingMatchId(null)}
                        className="text-[10px] text-marble/60 uppercase font-black hover:text-white"
                      >
                        Cancel
                      </button>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div>
                        <label className="block text-[9px] uppercase font-bold text-marble/50">Our Score</label>
                        <input
                          type="number"
                          defaultValue={m.scoreSelf || 0}
                          id={`edit_self_${m.id}`}
                          className="w-full bg-white/5 border border-white/10 rounded p-1 text-xs text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] uppercase font-bold text-marble/50">Opponent Score</label>
                        <input
                          type="number"
                          defaultValue={m.scoreOpponent || 0}
                          id={`edit_opp_${m.id}`}
                          className="w-full bg-white/5 border border-white/10 rounded p-1 text-xs text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] uppercase font-bold text-marble/50">Outcome</label>
                        <select
                          defaultValue={m.result}
                          id={`edit_res_${m.id}`}
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
                          type="button"
                          onClick={() => {
                            const selfSc = parseInt(
                              (document.getElementById(`edit_self_${m.id}`) as HTMLInputElement)?.value || "0"
                            );
                            const oppSc = parseInt(
                              (document.getElementById(`edit_opp_${m.id}`) as HTMLInputElement)?.value || "0"
                            );
                            const resVal = (document.getElementById(`edit_res_${m.id}`) as HTMLSelectElement)
                              ?.value as any;

                            onUpdateMatch({
                              id: m.id,
                              scoreSelf: selfSc,
                              scoreOpponent: oppSc,
                              result: resVal,
                              completed: resVal !== "upcoming"
                            });
                            setEditingMatchId(null);
                          }}
                          className="w-full bg-ares-red text-white py-1.5 rounded text-[10px] uppercase font-black tracking-wider cursor-pointer"
                        >
                          Save Values
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  // Normal View
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      {/* Checkbox Trigger */}
                      <button
                        onClick={() => onToggleMatch(m.id, !m.completed)}
                        className={`w-5 h-5 rounded border flex items-center justify-center transition-all cursor-pointer ${
                          m.completed
                            ? "bg-ares-red border-ares-red text-white"
                            : "border-white/20 hover:border-ares-gold bg-black/40 text-transparent"
                        }`}
                        aria-label={`Toggle completion for ${m.matchNumber}`}
                      >
                        <Check size={12} className={m.completed ? "opacity-100" : "opacity-0"} />
                      </button>

                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-white font-heading">{m.matchNumber}</span>
                          <span
                            className={`text-[9px] px-1.5 py-0.5 rounded-full font-black uppercase tracking-wider ${
                              isRedAlliance
                                ? "bg-ares-red/15 text-ares-red border border-ares-red/35"
                                : "bg-blue-500/15 text-blue-400 border border-blue-500/35"
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
                                    ? "text-ares-red"
                                    : "text-marble/40"
                              }`}
                            >
                              {m.result}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-marble/55 mt-1">
                          Partner: <strong className="text-white">{m.partner}</strong> | Opponents:{" "}
                          <strong className="text-white">{m.opponents.join(", ")}</strong>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between md:justify-end gap-4 border-t md:border-t-0 border-white/5 pt-2.5 md:pt-0">
                      {/* Score display */}
                      {!isUpcoming && m.scoreSelf !== undefined && (
                        <div className="text-xs font-semibold text-right">
                          <span className={m.result === "won" ? "text-ares-gold font-bold" : "text-white"}>
                            {m.scoreSelf}
                          </span>
                          <span className="text-marble/30 mx-1">-</span>
                          <span className="text-marble/55">{m.scoreOpponent}</span>
                        </div>
                      )}

                      {/* Action tools */}
                      {canEdit && (
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => setEditingMatchId(m.id)}
                            className="p-1.5 text-marble/50 hover:text-ares-gold hover:bg-white/5 rounded transition-all cursor-pointer"
                            title="Edit scoring values"
                          >
                            <Edit2 size={12} />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm("Soft-delete this match record?")) {
                                onDeleteMatch(m.id);
                              }
                            }}
                            className="p-1.5 text-marble/50 hover:text-ares-red hover:bg-white/5 rounded transition-all cursor-pointer"
                            title="Archive match record"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Match notes */}
                {m.notes && !editingMatchId && (
                  <div className="mt-3.5 pt-2.5 border-t border-white/5 text-[11px] text-marble/60 flex items-start gap-1">
                    <Info size={11} className="text-ares-gold shrink-0 mt-0.5" />
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
