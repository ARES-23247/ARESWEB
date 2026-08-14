import { useState, type FormEvent } from "react";
import { MinusCircle, PlusCircle, X } from "lucide-react";
import type { Tournament, TournamentWriteInput } from "@/types/tournament";

export interface TournamentFormSubmission extends TournamentWriteInput {
  id?: string;
}

interface TournamentFormProps {
  tournament: Tournament | null;
  isSaving: boolean;
  saveError: Error | null;
  onClose: () => void;
  onSubmit: (submission: TournamentFormSubmission) => void;
}

type OprEntry = NonNullable<Tournament["oprList"]>[number];

export function TournamentForm({
  tournament,
  isSaving,
  saveError,
  onClose,
  onSubmit,
}: TournamentFormProps) {
  const [name, setName] = useState(tournament?.name ?? "");
  const [seasonName, setSeasonName] = useState(tournament?.seasonName ?? "");
  const [challengeName, setChallengeName] = useState(
    tournament?.challengeName ?? "",
  );
  const [date, setDate] = useState(tournament?.date ?? "");
  const [location, setLocation] = useState(tournament?.location ?? "");
  const [description, setDescription] = useState(tournament?.description ?? "");
  const [status, setStatus] = useState<"upcoming" | "past">(
    tournament?.status ?? "upcoming",
  );
  const [opr, setOpr] = useState(tournament?.opr?.toString() ?? "");
  const [photoAlbumId, setPhotoAlbumId] = useState(
    tournament?.photoAlbumId ?? "",
  );
  const [autoPathNotes, setAutoPathNotes] = useState(
    tournament?.scoutingDetails?.autoPathNotes ?? "",
  );
  const [driverFeedback, setDriverFeedback] = useState(
    tournament?.scoutingDetails?.driverFeedback ?? "",
  );
  const [robotSpecs, setRobotSpecs] = useState(
    tournament?.scoutingDetails?.robotSpecs ?? "",
  );
  const [oprList, setOprList] = useState<OprEntry[]>(tournament?.oprList ?? []);
  const [subteamNumber, setSubteamNumber] = useState("");
  const [subteamName, setSubteamName] = useState("");
  const [subteamOpr, setSubteamOpr] = useState("");

  const addOprEntry = () => {
    if (!subteamNumber || !subteamOpr) return;
    setOprList((current) => [
      ...current,
      {
        teamNumber: subteamNumber,
        teamName: subteamName || `Team ${subteamNumber}`,
        opr: Number.parseFloat(subteamOpr) || 0,
      },
    ]);
    setSubteamNumber("");
    setSubteamName("");
    setSubteamOpr("");
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!name || !date || !location) return;
    onSubmit({
      id: tournament?.id,
      name,
      seasonName: seasonName.trim() || undefined,
      challengeName: challengeName.trim() || undefined,
      date,
      location,
      description,
      status,
      opr: opr ? Number.parseFloat(opr) : 0,
      photoAlbumId,
      scoutingDetails: { autoPathNotes, driverFeedback, robotSpecs },
      oprList,
    });
  };

  return (
    <div className="bg-white/5 border border-white/10 p-6 rounded-2xl relative backdrop-blur-sm shadow-2xl">
      <button
        type="button"
        onClick={onClose}
        aria-label="Close tournament form"
        className="absolute top-4 right-4 text-marble/55 hover:text-white p-1 rounded-full hover:bg-white/5 transition-colors cursor-pointer"
      >
        <X size={18} />
      </button>

      <h3 className="text-lg font-extrabold uppercase text-ares-gold font-heading mb-6 border-b border-white/5 pb-2">
        {tournament
          ? `Edit Tournament: ${tournament.name}`
          : "Create New Tournament Record"}
      </h3>

      <form onSubmit={submit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-4">
            <div>
              <label
                htmlFor="tourney-name"
                className="block text-xs uppercase font-bold text-marble/70 mb-1.5"
              >
                Tournament Name *
              </label>
              <input
                id="tourney-name"
                type="text"
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. WV State Championship 2026"
                className="w-full bg-black/40 border border-white/15 rounded-lg px-4 py-2.5 text-xs text-white placeholder-marble/35 focus:outline-none focus:border-ares-red"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="tourney-season"
                  className="block text-xs uppercase font-bold text-marble/70 mb-1.5"
                >
                  Season
                </label>
                <input
                  id="tourney-season"
                  type="text"
                  value={seasonName}
                  onChange={(event) => setSeasonName(event.target.value)}
                  placeholder="e.g. 2026–2027"
                  className="w-full bg-black/40 border border-white/15 rounded-lg px-4 py-2.5 text-xs text-white placeholder-marble/35 focus:outline-none focus:border-ares-red"
                />
              </div>
              <div>
                <label
                  htmlFor="tourney-challenge"
                  className="block text-xs uppercase font-bold text-marble/70 mb-1.5"
                >
                  Game / Challenge
                </label>
                <input
                  id="tourney-challenge"
                  type="text"
                  value={challengeName}
                  onChange={(event) => setChallengeName(event.target.value)}
                  placeholder="e.g. DECODE™"
                  className="w-full bg-black/40 border border-white/15 rounded-lg px-4 py-2.5 text-xs text-white placeholder-marble/35 focus:outline-none focus:border-ares-red"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="tourney-date"
                  className="block text-xs uppercase font-bold text-marble/70 mb-1.5"
                >
                  Tournament Date *
                </label>
                <input
                  id="tourney-date"
                  type="date"
                  required
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                  className="w-full bg-black/40 border border-white/15 rounded-lg px-4 py-2.5 text-xs text-white focus:outline-none focus:border-ares-red"
                />
              </div>
              <div>
                <label
                  htmlFor="tourney-location"
                  className="block text-xs uppercase font-bold text-marble/70 mb-1.5"
                >
                  Location *
                </label>
                <input
                  id="tourney-location"
                  type="text"
                  required
                  value={location}
                  onChange={(event) => setLocation(event.target.value)}
                  placeholder="e.g. Fairmont, WV"
                  className="w-full bg-black/40 border border-white/15 rounded-lg px-4 py-2.5 text-xs text-white placeholder-marble/35 focus:outline-none focus:border-ares-red"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="tourney-description"
                className="block text-xs uppercase font-bold text-marble/70 mb-1.5"
              >
                Description / Overview
              </label>
              <textarea
                id="tourney-description"
                rows={3}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Summary of ARES participation, robot performance overview, and major achievements..."
                className="w-full bg-black/40 border border-white/15 rounded-lg px-4 py-2.5 text-xs text-white placeholder-marble/35 focus:outline-none focus:border-ares-red resize-none"
              />
            </div>
          </div>

          <div className="space-y-4 bg-black/35 p-4 rounded-xl border border-white/5">
            <div>
              <label
                htmlFor="tourney-status"
                className="block text-xs uppercase font-bold text-marble/70 mb-1.5"
              >
                Tournament Status
              </label>
              <select
                id="tourney-status"
                value={status}
                onChange={(event) =>
                  setStatus(event.target.value as "upcoming" | "past")
                }
                className="w-full bg-black/40 border border-white/15 rounded-lg px-4 py-2.5 text-xs text-white focus:outline-none focus:border-ares-red"
              >
                <option value="upcoming" className="bg-obsidian">
                  Upcoming Event
                </option>
                <option value="past" className="bg-obsidian">
                  Past Tournament
                </option>
              </select>
            </div>
            <div>
              <label
                htmlFor="tourney-opr"
                className="block text-xs uppercase font-bold text-marble/70 mb-1.5"
              >
                Team OPR (At Event)
              </label>
              <input
                id="tourney-opr"
                type="number"
                step="0.1"
                value={opr}
                onChange={(event) => setOpr(event.target.value)}
                placeholder="e.g. 185.4"
                className="w-full bg-black/40 border border-white/15 rounded-lg px-4 py-2.5 text-xs text-white placeholder-marble/35 focus:outline-none focus:border-ares-red"
              />
            </div>
            <div>
              <label
                htmlFor="tourney-album-id"
                className="block text-xs uppercase font-bold text-marble/70 mb-1.5"
              >
                Photo Album ID
              </label>
              <input
                id="tourney-album-id"
                type="text"
                value={photoAlbumId}
                onChange={(event) => setPhotoAlbumId(event.target.value)}
                placeholder="e.g. wv-state-2026"
                className="w-full bg-black/40 border border-white/15 rounded-lg px-4 py-2.5 text-xs text-white placeholder-marble/35 focus:outline-none focus:border-ares-red"
              />
            </div>
          </div>
        </div>

        <div className="bg-black/20 border border-white/5 p-4 rounded-xl space-y-4">
          <h4 className="text-xs font-black uppercase text-ares-gold tracking-widest border-b border-white/5 pb-1">
            Technical Scouting Logs
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label
                htmlFor="tourney-auto-notes"
                className="block text-[10px] uppercase font-bold text-marble/60 mb-1"
              >
                Autonomous Trajectory Notes
              </label>
              <textarea
                id="tourney-auto-notes"
                rows={3}
                value={autoPathNotes}
                onChange={(event) => setAutoPathNotes(event.target.value)}
                placeholder="Path configurations, sample counters, or error slips..."
                className="w-full bg-black/40 border border-white/10 rounded p-2 text-xs text-white resize-none focus:outline-none focus:border-ares-red"
              />
            </div>
            <div>
              <label
                htmlFor="tourney-driver-feedback"
                className="block text-[10px] uppercase font-bold text-marble/60 mb-1"
              >
                Driver Feedback Logs
              </label>
              <textarea
                id="tourney-driver-feedback"
                rows={3}
                value={driverFeedback}
                onChange={(event) => setDriverFeedback(event.target.value)}
                placeholder="Subsystem controls, glide responsiveness, or climb timing..."
                className="w-full bg-black/40 border border-white/10 rounded p-2 text-xs text-white resize-none focus:outline-none focus:border-ares-red"
              />
            </div>
            <div>
              <label
                htmlFor="tourney-robot-specs"
                className="block text-[10px] uppercase font-bold text-marble/60 mb-1"
              >
                Robot Subsystem Blueprints
              </label>
              <textarea
                id="tourney-robot-specs"
                rows={3}
                value={robotSpecs}
                onChange={(event) => setRobotSpecs(event.target.value)}
                placeholder="Chassis specs, slide levels, or active intake configurations..."
                className="w-full bg-black/40 border border-white/10 rounded p-2 text-xs text-white resize-none focus:outline-none focus:border-ares-red"
              />
            </div>
          </div>
        </div>

        <div className="bg-black/20 border border-white/5 p-4 rounded-xl space-y-4">
          <h4 className="text-xs font-black uppercase text-ares-gold tracking-widest border-b border-white/5 pb-1">
            OPR Leaderboard Rankings
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-4 gap-3 items-end">
            <div>
              <label
                htmlFor="tourney-subteam-number"
                className="block text-[9px] uppercase font-bold text-marble/60 mb-1"
              >
                Team #
              </label>
              <input
                id="tourney-subteam-number"
                type="text"
                value={subteamNumber}
                onChange={(event) => setSubteamNumber(event.target.value)}
                placeholder="e.g. 23247"
                className="w-full bg-black/40 border border-white/10 rounded p-1.5 text-xs text-white"
              />
            </div>
            <div>
              <label
                htmlFor="tourney-subteam-name"
                className="block text-[9px] uppercase font-bold text-marble/60 mb-1"
              >
                Team Name
              </label>
              <input
                id="tourney-subteam-name"
                type="text"
                value={subteamName}
                onChange={(event) => setSubteamName(event.target.value)}
                placeholder="e.g. ARES"
                className="w-full bg-black/40 border border-white/10 rounded p-1.5 text-xs text-white"
              />
            </div>
            <div>
              <label
                htmlFor="tourney-subteam-opr"
                className="block text-[9px] uppercase font-bold text-marble/60 mb-1"
              >
                OPR Score
              </label>
              <input
                id="tourney-subteam-opr"
                type="number"
                step="0.1"
                value={subteamOpr}
                onChange={(event) => setSubteamOpr(event.target.value)}
                placeholder="e.g. 185.4"
                className="w-full bg-black/40 border border-white/10 rounded p-1.5 text-xs text-white"
              />
            </div>
            <button
              type="button"
              onClick={addOprEntry}
              className="bg-ares-red/10 border border-ares-red/35 text-white hover:bg-ares-red transition-all py-1.5 rounded text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1 cursor-pointer"
            >
              <PlusCircle size={14} /> Add Leaderboard Entry
            </button>
          </div>

          {oprList.length > 0 ? (
            <div className="overflow-hidden border border-white/5 rounded-lg bg-black/40">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-white/5 text-marble/50 text-[9px] uppercase tracking-wider font-bold border-b border-white/5">
                    <th className="px-3 py-2">Team Number</th>
                    <th className="px-3 py-2">Team Name</th>
                    <th className="px-3 py-2 text-right">OPR Value</th>
                    <th className="px-3 py-2 text-center w-16">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {oprList.map((entry, index) => (
                    <tr
                      key={`${entry.teamNumber}-${index}`}
                      className="text-marble/70"
                    >
                      <td className="px-3 py-2 font-mono">
                        #{entry.teamNumber}
                      </td>
                      <td className="px-3 py-2">{entry.teamName}</td>
                      <td className="px-3 py-2 text-right font-bold text-ares-gold">
                        {entry.opr}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <button
                          type="button"
                          onClick={() =>
                            setOprList((current) =>
                              current.filter(
                                (_, itemIndex) => itemIndex !== index,
                              ),
                            )
                          }
                          aria-label={`Remove OPR entry for team ${entry.teamNumber}`}
                          className="text-marble/40 hover:text-ares-gold transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-ares-cyan"
                        >
                          <MinusCircle size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-[10px] text-marble/40 italic">
              No teams registered in the OPR board.
            </p>
          )}
        </div>

        <div className="flex justify-end gap-3 border-t border-white/5 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 text-xs text-marble/60 hover:text-white uppercase font-black tracking-wider cursor-pointer"
          >
            Cancel Changes
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="bg-ares-red hover:bg-ares-bronze border border-ares-bronze/45 text-white font-black text-xs tracking-wider uppercase px-6 py-2 rounded shadow-lg cursor-pointer disabled:cursor-not-allowed disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-ares-cyan"
          >
            {isSaving ? "Syncing..." : "Publish Record"}
          </button>
        </div>

        {saveError && (
          <div
            role="alert"
            className="rounded-lg border border-ares-red/40 bg-ares-red/10 p-3"
          >
            <p className="text-xs font-bold text-white">
              The tournament was not saved. Your form values are still here.
            </p>
            <p className="mt-1 font-mono text-[11px] text-marble/80">
              {saveError.message}
            </p>
          </div>
        )}
      </form>
    </div>
  );
}
