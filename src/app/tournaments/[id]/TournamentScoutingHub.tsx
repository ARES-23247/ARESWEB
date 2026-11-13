import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import {
  ClipboardCheck,
  CloudOff,
  RefreshCw,
  Send,
  Wrench,
} from "lucide-react";
import {
  enqueueTournamentMutation,
  flushTournamentOutbox,
  generateOutboxId,
  isPermanentOutboxError,
  listTournamentOutbox,
  PitOutboxQuotaError,
  type PitOutboxMutation,
} from "@/lib/pitModeOutbox";
import {
  saveTournamentPitState,
  submitPitScouting,
  submitStandScouting,
} from "@/lib/tournamentApi";
import type {
  StandEndgameTier,
  StandPenaltyTier,
  TournamentScoutingBundle,
} from "@/types/tournament";

interface TournamentScoutingHubProps {
  tournamentId: string;
  userUid?: string | null;
  scoutingBundle: TournamentScoutingBundle | undefined;
  isLoading: boolean;
  onRefresh: () => void;
}

export function TournamentScoutingHub({
  tournamentId,
  userUid,
  scoutingBundle,
  isLoading,
  onRefresh,
}: TournamentScoutingHubProps) {
  const [activeTab, setActiveTab] = useState<"stand" | "pit" | "rollup">("stand");
  const [outbox, setOutbox] = useState<PitOutboxMutation[]>(() =>
    listTournamentOutbox(tournamentId, userUid),
  );
  const [isFlushing, setIsFlushing] = useState(false);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);

  // Stand form state
  const [matchNumber, setMatchNumber] = useState("");
  const [standTeam, setStandTeam] = useState("");
  const [alliance, setAlliance] = useState<"red" | "blue">("red");
  const [autoScore, setAutoScore] = useState("0");
  const [teleopCycles, setTeleopCycles] = useState("0");
  const [endgameTier, setEndgameTier] = useState<StandEndgameTier>("high");
  const [disconnected, setDisconnected] = useState(false);
  const [penalties, setPenalties] = useState<StandPenaltyTier>("none");
  const [defenseRating, setDefenseRating] = useState("0");
  const [standNotes, setStandNotes] = useState("");

  // Pit form state
  const [pitTeam, setPitTeam] = useState("");
  const [pitTeamName, setPitTeamName] = useState("");
  const [drivetrain, setDrivetrain] = useState("Mecanum");
  const [canClearBarrier, setCanClearBarrier] = useState(true);
  const [preferredStart, setPreferredStart] = useState("");
  const [autoSummary, setAutoSummary] = useState("");
  const [teleopStrengths, setTeleopStrengths] = useState("");
  const [endgameCap, setEndgameCap] = useState("");
  const [pitNotes, setPitNotes] = useState("");

  const flushingRef = useRef(false);

  const syncOutboxNow = useCallback(async () => {
    if (flushingRef.current) return;
    flushingRef.current = true;
    setIsFlushing(true);
    try {
      const result = await flushTournamentOutbox(
        tournamentId,
        {
          submitPit: submitPitScouting,
          submitStand: submitStandScouting,
          savePitState: saveTournamentPitState,
        },
        userUid,
      );
      setOutbox(result.remaining);
      if (result.rejected.length > 0 && result.flushed > 0) {
        setStatusBanner(
          `Synced ${result.flushed} offline report${result.flushed === 1 ? "" : "s"}, but rejected ${result.rejected.length}: ${result.rejected[0].message}`,
        );
        onRefresh();
      } else if (result.rejected.length > 0) {
        setStatusBanner(
          `Removed ${result.rejected.length} rejected offline report${result.rejected.length === 1 ? "" : "s"}: ${result.rejected[0].message}`,
        );
      } else if (result.flushed > 0) {
        setStatusBanner(
          `Synced ${result.flushed} offline report${result.flushed === 1 ? "" : "s"} to team vault.`,
        );
        onRefresh();
      }
    } finally {
      flushingRef.current = false;
      setIsFlushing(false);
    }
  }, [onRefresh, tournamentId, userUid]);

  useEffect(() => {
    setOutbox(listTournamentOutbox(tournamentId, userUid));
  }, [tournamentId, userUid]);

  useEffect(() => {
    const handleOnline = () => {
      if (listTournamentOutbox(tournamentId, userUid).length > 0) {
        void syncOutboxNow();
      }
    };
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [syncOutboxNow, tournamentId, userUid]);

  const handleStandSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const trimmedMatch = matchNumber.trim().toUpperCase();
    const trimmedTeam = standTeam.trim();
    if (!trimmedMatch || !/^\d{1,7}$/u.test(trimmedTeam)) return;

    const submissionId = generateOutboxId("stand");
    const payload = {
      clientSubmissionId: submissionId,
      matchNumber: trimmedMatch,
      teamNumber: trimmedTeam,
      alliance,
      autoScoreEstimate: Math.max(0, Number.parseInt(autoScore, 10) || 0),
      teleopCycles: Math.max(0, Number.parseInt(teleopCycles, 10) || 0),
      endgameTier,
      disconnected,
      penalties,
      defenseRating: Math.min(5, Math.max(0, Number.parseInt(defenseRating, 10) || 0)),
      notes: standNotes.trim() || undefined,
    };

    try {
      await submitStandScouting(tournamentId, payload);
      setStatusBanner(`Recorded ${trimmedMatch} observation for #${trimmedTeam}.`);
      onRefresh();
    } catch (err) {
      if (isPermanentOutboxError(err)) {
        setStatusBanner(
          `Observation not saved: ${err instanceof Error ? err.message : "Server rejected submission."}`,
        );
        return;
      }
      try {
        const nextQueue = enqueueTournamentMutation(
          {
            id: submissionId,
            tournamentId,
            kind: "stand_scouting",
            payload,
          },
          userUid,
        );
        setOutbox(nextQueue);
        setStatusBanner(
          "Venue network unreachable — saved to Offline Pit Outbox and will sync automatically.",
        );
      } catch (queueErr) {
        setStatusBanner(
          queueErr instanceof PitOutboxQuotaError
            ? "Offline storage is full — clear old data or reconnect to submit."
            : "Could not save offline observation.",
        );
        return;
      }
    }

    setStandTeam("");
    setAutoScore("0");
    setTeleopCycles("0");
    setDisconnected(false);
    setPenalties("none");
    setStandNotes("");
  };

  const handlePitSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const trimmedTeam = pitTeam.trim();
    if (!/^\d{1,7}$/u.test(trimmedTeam) || !drivetrain.trim()) return;

    const payload = {
      teamNumber: trimmedTeam,
      teamName: pitTeamName.trim() || undefined,
      drivetrain: drivetrain.trim(),
      canClearBarrierOrTrench: canClearBarrier,
      preferredStartZone: preferredStart.trim() || undefined,
      autoSummary: autoSummary.trim() || undefined,
      teleopStrengths: teleopStrengths.trim() || undefined,
      endgameCapability: endgameCap.trim() || undefined,
      notes: pitNotes.trim() || undefined,
    };

    try {
      await submitPitScouting(tournamentId, payload);
      setStatusBanner(`Saved Pit Scouting card for #${trimmedTeam}.`);
      onRefresh();
    } catch (err) {
      if (isPermanentOutboxError(err)) {
        setStatusBanner(
          `Pit card not saved: ${err instanceof Error ? err.message : "Server rejected submission."}`,
        );
        return;
      }
      try {
        const nextQueue = enqueueTournamentMutation(
          {
            tournamentId,
            kind: "pit_scouting",
            payload,
          },
          userUid,
        );
        setOutbox(nextQueue);
        setStatusBanner(
          "Venue network unreachable — Pit Scouting card queued in Offline Pit Outbox.",
        );
      } catch (queueErr) {
        setStatusBanner(
          queueErr instanceof PitOutboxQuotaError
            ? "Offline storage is full — clear old data or reconnect to save Pit card."
            : "Could not queue offline Pit Scouting card.",
        );
        return;
      }
    }

    setPitTeam("");
    setPitTeamName("");
    setAutoSummary("");
    setTeleopStrengths("");
    setEndgameCap("");
    setPitNotes("");
  };

  const summaries = scoutingBundle?.teamSummaries ?? [];
  const pitEntries = scoutingBundle?.pitScouting ?? [];
  const standEntries = scoutingBundle?.standScouting ?? [];

  return (
    <section
      aria-labelledby="student-scouting-heading"
      className="bg-white/5 border border-white/10 rounded-2xl p-6 relative overflow-hidden backdrop-blur-sm shadow-xl"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 pb-4 mb-5">
        <div>
          <h2
            id="student-scouting-heading"
            className="text-lg font-bold text-white uppercase tracking-tight font-heading flex items-center gap-2"
          >
            <ClipboardCheck
              className="text-ares-gold"
              size={18}
              aria-hidden="true"
            />
            Student Stand &amp; Pit Scouting Vault
          </h2>
          <p className="mt-1 text-xs text-marble/65">
            Attributed team observations with offline venue outbox protection.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {outbox.length > 0 && (
            <div className="flex items-center gap-2 rounded-lg border border-ares-gold/40 bg-ares-gold/10 px-3 py-1.5">
              <CloudOff size={13} className="text-ares-gold" aria-hidden="true" />
              <span className="text-[10px] font-black uppercase tracking-wider text-ares-gold">
                {outbox.length} queued offline
              </span>
              <button
                type="button"
                disabled={isFlushing}
                onClick={() => void syncOutboxNow()}
                className="rounded bg-ares-gold px-2 py-0.5 text-[10px] font-black uppercase text-obsidian hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
              >
                {isFlushing ? "Syncing..." : "Sync Outbox"}
              </button>
            </div>
          )}

          <div
            role="tablist"
            aria-label="Scouting input modes"
            className="inline-flex rounded-lg border border-white/10 bg-black/40 p-1"
          >
            {(
              [
                ["stand", "Stand Match"],
                ["pit", "Pit Robot"],
                ["rollup", `Rollup (${summaries.length})`],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={activeTab === key}
                onClick={() => setActiveTab(key)}
                className={`rounded px-3 py-1 text-[10px] font-black uppercase tracking-wider transition-colors ${
                  activeTab === key
                    ? "bg-ares-red text-white"
                    : "text-marble/70 hover:text-white"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {statusBanner && (
        <div
          role="status"
          className="mb-4 flex items-center justify-between gap-2 rounded-lg border border-ares-cyan/35 bg-ares-cyan/10 px-3.5 py-2 text-xs text-white"
        >
          <span>{statusBanner}</span>
          <button
            type="button"
            onClick={() => setStatusBanner(null)}
            className="text-[10px] font-black uppercase text-marble/70 hover:text-white"
          >
            Dismiss
          </button>
        </div>
      )}

      {activeTab === "stand" && (
        <form onSubmit={(e) => void handleStandSubmit(e)} className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label
                htmlFor="stand-match-number"
                className="block text-[10px] font-bold uppercase text-marble/70 mb-1"
              >
                Match # *
              </label>
              <input
                id="stand-match-number"
                type="text"
                required
                placeholder="e.g. QM5"
                value={matchNumber}
                onChange={(e) => setMatchNumber(e.target.value)}
                className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-xs text-white focus:border-ares-gold focus:outline-none"
              />
            </div>
            <div>
              <label
                htmlFor="stand-team-number"
                className="block text-[10px] font-bold uppercase text-marble/70 mb-1"
              >
                Team # *
              </label>
              <input
                id="stand-team-number"
                type="text"
                inputMode="numeric"
                required
                placeholder="e.g. 11115"
                value={standTeam}
                onChange={(e) => setStandTeam(e.target.value)}
                className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-xs text-white focus:border-ares-gold focus:outline-none"
              />
            </div>
            <div>
              <label
                htmlFor="stand-alliance"
                className="block text-[10px] font-bold uppercase text-marble/70 mb-1"
              >
                Alliance
              </label>
              <select
                id="stand-alliance"
                value={alliance}
                onChange={(e) => setAlliance(e.target.value as "red" | "blue")}
                className="w-full rounded-lg border border-white/15 bg-black/60 px-3 py-2 text-xs text-white focus:border-ares-gold focus:outline-none"
              >
                <option value="red">Red Alliance</option>
                <option value="blue">Blue Alliance</option>
              </select>
            </div>
            <div>
              <label
                htmlFor="stand-endgame"
                className="block text-[10px] font-bold uppercase text-marble/70 mb-1"
              >
                Endgame Tier
              </label>
              <select
                id="stand-endgame"
                value={endgameTier}
                onChange={(e) =>
                  setEndgameTier(e.target.value as StandEndgameTier)
                }
                className="w-full rounded-lg border border-white/15 bg-black/60 px-3 py-2 text-xs text-white focus:border-ares-gold focus:outline-none"
              >
                <option value="high">High Ascent / Full</option>
                <option value="low">Low / Partial</option>
                <option value="park">Park Only</option>
                <option value="none">None / Failed</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label
                htmlFor="stand-auto-pts"
                className="block text-[10px] font-bold uppercase text-marble/70 mb-1"
              >
                Auto Est. Pts
              </label>
              <input
                id="stand-auto-pts"
                type="number"
                min={0}
                max={500}
                value={autoScore}
                onChange={(e) => setAutoScore(e.target.value)}
                className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-xs text-white focus:border-ares-gold focus:outline-none"
              />
            </div>
            <div>
              <label
                htmlFor="stand-teleop-cycles"
                className="block text-[10px] font-bold uppercase text-marble/70 mb-1"
              >
                TeleOp Cycles
              </label>
              <input
                id="stand-teleop-cycles"
                type="number"
                min={0}
                max={200}
                value={teleopCycles}
                onChange={(e) => setTeleopCycles(e.target.value)}
                className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-xs text-white focus:border-ares-gold focus:outline-none"
              />
            </div>
            <div>
              <label
                htmlFor="stand-penalties"
                className="block text-[10px] font-bold uppercase text-marble/70 mb-1"
              >
                Penalties
              </label>
              <select
                id="stand-penalties"
                value={penalties}
                onChange={(e) =>
                  setPenalties(e.target.value as StandPenaltyTier)
                }
                className="w-full rounded-lg border border-white/15 bg-black/60 px-3 py-2 text-xs text-white focus:border-ares-gold focus:outline-none"
              >
                <option value="none">Clean (0 Fouls)</option>
                <option value="minor">Minor Foul</option>
                <option value="major">Major Foul</option>
              </select>
            </div>
            <div>
              <label
                htmlFor="stand-defense"
                className="block text-[10px] font-bold uppercase text-marble/70 mb-1"
              >
                Defense (0–5)
              </label>
              <input
                id="stand-defense"
                type="number"
                min={0}
                max={5}
                value={defenseRating}
                onChange={(e) => setDefenseRating(e.target.value)}
                className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-xs text-white focus:border-ares-gold focus:outline-none"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="inline-flex items-center gap-2 text-xs text-marble/85 cursor-pointer">
              <input
                type="checkbox"
                checked={disconnected}
                onChange={(e) => setDisconnected(e.target.checked)}
                className="h-4 w-4 accent-ares-red"
              />
              <span>Robot disconnected / disabled during match</span>
            </label>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <label htmlFor="stand-notes" className="sr-only">
              Stand match notes
            </label>
            <input
              id="stand-notes"
              type="text"
              placeholder="Cycle path, intake bottlenecks, partner synergy..."
              value={standNotes}
              onChange={(e) => setStandNotes(e.target.value)}
              className="flex-1 rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-xs text-white focus:border-ares-gold focus:outline-none"
            />
            <button
              type="submit"
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-ares-red px-5 py-2 text-xs font-black uppercase tracking-wider text-white hover:bg-ares-bronze focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
            >
              <Send size={13} aria-hidden="true" /> Submit Stand Report
            </button>
          </div>
        </form>
      )}

      {activeTab === "pit" && (
        <form onSubmit={(e) => void handlePitSubmit(e)} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label
                htmlFor="pit-team-number"
                className="block text-[10px] font-bold uppercase text-marble/70 mb-1"
              >
                Team # *
              </label>
              <input
                id="pit-team-number"
                type="text"
                inputMode="numeric"
                required
                placeholder="e.g. 11115"
                value={pitTeam}
                onChange={(e) => setPitTeam(e.target.value)}
                className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-xs text-white focus:border-ares-gold focus:outline-none"
              />
            </div>
            <div>
              <label
                htmlFor="pit-team-name"
                className="block text-[10px] font-bold uppercase text-marble/70 mb-1"
              >
                Team Name
              </label>
              <input
                id="pit-team-name"
                type="text"
                placeholder="Optional team name"
                value={pitTeamName}
                onChange={(e) => setPitTeamName(e.target.value)}
                className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-xs text-white focus:border-ares-gold focus:outline-none"
              />
            </div>
            <div>
              <label
                htmlFor="pit-drivetrain"
                className="block text-[10px] font-bold uppercase text-marble/70 mb-1"
              >
                Drivetrain *
              </label>
              <input
                id="pit-drivetrain"
                type="text"
                required
                placeholder="e.g. Custom Mecanum + Deadwheels"
                value={drivetrain}
                onChange={(e) => setDrivetrain(e.target.value)}
                className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-xs text-white focus:border-ares-gold focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label
                htmlFor="pit-start-zone"
                className="block text-[10px] font-bold uppercase text-marble/70 mb-1"
              >
                Preferred Auto Start
              </label>
              <input
                id="pit-start-zone"
                type="text"
                placeholder="Audience / Truss / Flexible"
                value={preferredStart}
                onChange={(e) => setPreferredStart(e.target.value)}
                className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-xs text-white focus:border-ares-gold focus:outline-none"
              />
            </div>
            <div>
              <label
                htmlFor="pit-auto-summary"
                className="block text-[10px] font-bold uppercase text-marble/70 mb-1"
              >
                Autonomous Capability
              </label>
              <input
                id="pit-auto-summary"
                type="text"
                placeholder="e.g. 4-cycle + park"
                value={autoSummary}
                onChange={(e) => setAutoSummary(e.target.value)}
                className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-xs text-white focus:border-ares-gold focus:outline-none"
              />
            </div>
            <div>
              <label
                htmlFor="pit-endgame"
                className="block text-[10px] font-bold uppercase text-marble/70 mb-1"
              >
                Endgame Mechanism
              </label>
              <input
                id="pit-endgame"
                type="text"
                placeholder="e.g. Dual PTO high ascent"
                value={endgameCap}
                onChange={(e) => setEndgameCap(e.target.value)}
                className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-xs text-white focus:border-ares-gold focus:outline-none"
              />
            </div>
          </div>

          <label className="inline-flex items-center gap-2 text-xs text-marble/85 cursor-pointer">
            <input
              type="checkbox"
              checked={canClearBarrier}
              onChange={(e) => setCanClearBarrier(e.target.checked)}
              className="h-4 w-4 accent-ares-gold"
            />
            <span>Clears field barrier / low clearance zone cleanly</span>
          </label>

          <div className="flex flex-col sm:flex-row gap-3">
            <label htmlFor="pit-notes" className="sr-only">
              Pit robot scouting notes
            </label>
            <input
              id="pit-notes"
              type="text"
              placeholder="TeleOp cycle strengths, spare parts readiness, wiring notes..."
              value={pitNotes}
              onChange={(e) => setPitNotes(e.target.value)}
              className="flex-1 rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-xs text-white focus:border-ares-gold focus:outline-none"
            />
            <button
              type="submit"
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-ares-red px-5 py-2 text-xs font-black uppercase tracking-wider text-white hover:bg-ares-bronze focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
            >
              <Wrench size={13} aria-hidden="true" /> Save Pit Card
            </button>
          </div>
        </form>
      )}

      {activeTab === "rollup" && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-marble/70">
              {isLoading
                ? "Refreshing scouting observations..."
                : `${standEntries.length} match reports · ${pitEntries.length} pit cards`}
            </span>
            <button
              type="button"
              onClick={onRefresh}
              className="inline-flex items-center gap-1.5 rounded border border-white/15 bg-black/40 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-marble/80 hover:text-white"
            >
              <RefreshCw size={11} aria-hidden="true" /> Refresh
            </button>
          </div>

          {summaries.length === 0 && pitEntries.length === 0 ? (
            <p className="rounded-xl border border-white/10 bg-black/30 p-4 text-xs text-marble/60">
              No student scouting entries recorded for this tournament yet.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-white/10 bg-black/35">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-white/10 bg-white/5 text-[10px] font-black uppercase tracking-wider text-marble/60">
                    <th className="px-3 py-2">Team</th>
                    <th className="px-3 py-2">Matches</th>
                    <th className="px-3 py-2">Avg Auto</th>
                    <th className="px-3 py-2">Avg Cycles</th>
                    <th className="px-3 py-2">High EG</th>
                    <th className="px-3 py-2">Disconnects</th>
                    <th className="px-3 py-2">Pit Summary</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {summaries.map((summary) => {
                    const pit = pitEntries.find(
                      (p) => p.teamNumber === summary.teamNumber,
                    );
                    return (
                      <tr key={summary.teamNumber} className="text-marble/85">
                        <td className="px-3 py-2 font-mono font-bold text-white">
                          #{summary.teamNumber}
                        </td>
                        <td className="px-3 py-2 font-mono">
                          {summary.matchesScouted}
                        </td>
                        <td className="px-3 py-2 font-mono text-ares-gold">
                          {summary.avgAutoScore}
                        </td>
                        <td className="px-3 py-2 font-mono">
                          {summary.avgTeleopCycles}
                        </td>
                        <td className="px-3 py-2 font-mono">
                          {summary.highEndgameRate}%
                        </td>
                        <td
                          className={`px-3 py-2 font-mono ${
                            summary.disconnectRate > 0
                              ? "text-ares-red-light font-bold"
                              : "text-ares-success"
                          }`}
                        >
                          {summary.disconnectRate}%
                        </td>
                        <td className="px-3 py-2 text-marble/70">
                          {pit
                            ? `${pit.drivetrain}${pit.preferredStartZone ? ` · ${pit.preferredStartZone}` : ""} (${pit.scoutNickname})`
                            : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
