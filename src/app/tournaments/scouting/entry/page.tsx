"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchTournaments } from "@/lib/tournamentApi";
import SEO from "@/components/SEO";
import {
  Trophy,
  Wifi,
  WifiOff,
  CheckCircle2,
  AlertCircle,
  ChevronLeft,
  Clock,
  ListOrdered,
} from "lucide-react";
import {
  type MatchScoutingEntry,
  type AllianceColor,
  createDefaultScoutingEntry,
  calculateScoringBreakdown,
  validateScoutingEntry,
  saveScoutingDraft,
  loadScoutingDraft,
  clearScoutingDraft,
  saveScoutingRecord,
  loadScoutingHistory,
  deleteScoutingRecord,
  clearScoutingHistory,
} from "@/lib/scoutingData";
import { ScoutingMetadataSection } from "./ScoutingMetadataSection";
import { ScoutingAutoSection } from "./ScoutingAutoSection";
import { ScoutingTeleopSection } from "./ScoutingTeleopSection";
import { ScoutingEndgameSection } from "./ScoutingEndgameSection";
import { ScoutingSummaryBreakdown } from "./ScoutingSummaryBreakdown";
import { ScoutingHistoryModal } from "./ScoutingHistoryModal";

export default function MatchScoutingEntryPage() {
  const [entry, setEntry] = useState<MatchScoutingEntry>(() => {
    const saved = loadScoutingDraft();
    return createDefaultScoutingEntry(saved || undefined);
  });

  const [history, setHistory] = useState<MatchScoutingEntry[]>([]);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    return typeof navigator !== "undefined" ? navigator.onLine : true;
  });
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState<boolean>(false);
  const [showHistoryModal, setShowHistoryModal] = useState<boolean>(false);

  // Tournaments query for dropdown selector
  const { data: tournaments = [] } = useQuery({
    queryKey: ["tournaments"],
    queryFn: () => fetchTournaments(50),
    staleTime: 120_000,
  });

  // Load history from localStorage on mount
  useEffect(() => {
    setHistory(loadScoutingHistory());
  }, []);

  // Listen to online / offline events
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Auto-save draft to localStorage whenever entry changes
  useEffect(() => {
    saveScoutingDraft(entry);
    setLastSavedAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
  }, [entry]);

  // If tournament selected, look up team name from oprList if teamNumber is entered
  const selectedTournament = useMemo(() => {
    return tournaments.find((t) => t.id === entry.tournamentId);
  }, [tournaments, entry.tournamentId]);

  useEffect(() => {
    if (selectedTournament?.oprList && entry.teamNumber) {
      const match = selectedTournament.oprList.find(
        (t) => t.teamNumber.trim() === entry.teamNumber.trim()
      );
      if (match && !entry.teamName) {
        setEntry((prev) => ({ ...prev, teamName: match.teamName }));
      }
    }
  }, [selectedTournament, entry.teamNumber, entry.teamName]);

  // Live scoring breakdown
  const scoringBreakdown = useMemo(() => {
    return calculateScoringBreakdown(entry);
  }, [entry]);

  // Form field updaters
  const updateAuto = useCallback((field: keyof MatchScoutingEntry["auto"], val: unknown) => {
    setEntry((prev) => ({
      ...prev,
      auto: {
        ...prev.auto,
        [field]: val,
      },
    }));
  }, []);

  const updateTeleop = useCallback((field: keyof MatchScoutingEntry["teleop"], val: unknown) => {
    setEntry((prev) => ({
      ...prev,
      teleop: {
        ...prev.teleop,
        [field]: val,
      },
    }));
  }, []);

  const updateEndgame = useCallback((field: keyof MatchScoutingEntry["endgame"], val: unknown) => {
    setEntry((prev) => ({
      ...prev,
      endgame: {
        ...prev.endgame,
        [field]: val,
      },
    }));
  }, []);

  const handleTournamentSelect = (tournId: string) => {
    const found = tournaments.find((t) => t.id === tournId);
    setEntry((prev) => ({
      ...prev,
      tournamentId: tournId,
      tournamentName: found?.name || prev.tournamentName,
    }));
  };

  const handleResetDraft = () => {
    if (window.confirm("Are you sure you want to reset this match scouting sheet?")) {
      clearScoutingDraft();
      const fresh = createDefaultScoutingEntry({
        tournamentId: entry.tournamentId,
        tournamentName: entry.tournamentName,
        scoutName: entry.scoutName,
      });
      setEntry(fresh);
      setValidationErrors({});
    }
  };

  const handleSaveRecord = () => {
    const validation = validateScoutingEntry(entry);
    if (!validation.isValid) {
      setValidationErrors(validation.errors);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    setValidationErrors({});
    const updatedHistory = saveScoutingRecord(entry);
    setHistory(updatedHistory);
    clearScoutingDraft();

    setSaveSuccessMsg(`Match ${entry.matchNumber} (Team ${entry.teamNumber}) scouted and saved successfully!`);
    setTimeout(() => setSaveSuccessMsg(null), 4500);

    // Increment match number for next entry (e.g. QM1 -> QM2)
    let nextMatchNumber = entry.matchNumber;
    const matchNumMatch = entry.matchNumber.match(/^(.*?)(\d+)$/);
    if (matchNumMatch) {
      const prefix = matchNumMatch[1];
      const num = parseInt(matchNumMatch[2], 10);
      nextMatchNumber = `${prefix}${num + 1}`;
    }

    const nextEntry = createDefaultScoutingEntry({
      tournamentId: entry.tournamentId,
      tournamentName: entry.tournamentName,
      scoutName: entry.scoutName,
      matchNumber: nextMatchNumber,
      alliance: entry.alliance === "red" ? "blue" : "red",
    });

    setEntry(nextEntry);
  };

  const handleCopySummary = async () => {
    const summaryText = `FTC Scouting Summary: Match ${entry.matchNumber} | Team ${entry.teamNumber} (${entry.alliance.toUpperCase()} Alliance)
Tournament: ${entry.tournamentName || entry.tournamentId || "FTC Event"}
Scout: ${entry.scoutName || "ARES Scout"}
---------------------------------------
Auto Score: ${scoringBreakdown.autoPoints} pts (High Spec: ${entry.auto.specimenHigh}, Low Spec: ${entry.auto.specimenLow}, Submerged: ${entry.auto.sampleSubmerged}, Park: ${entry.auto.parkingZone})
TeleOp Score: ${scoringBreakdown.teleopPoints} pts (High Basket: ${entry.teleop.highBasket}, Low Basket: ${entry.teleop.lowBasket}, Spec Transfer: ${entry.teleop.specimenTransfer}, Agility: ${entry.teleop.driverAgility}/5)
Endgame Score: ${scoringBreakdown.endgamePoints} pts (Ascent: ${entry.endgame.ascentLevel})
Penalties: -${scoringBreakdown.penaltyDeduction} pts
---------------------------------------
Total Score: ${scoringBreakdown.totalPoints} pts | Net Score: ${scoringBreakdown.netScore} pts
Match Rating: ${scoringBreakdown.matchRating} / 100
Notes: ${entry.notes || "None"}`;

    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(summaryText);
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 3000);
      }
    } catch {
      // Fallback
    }
  };

  const handleDeleteHistoryItem = (id: string) => {
    if (window.confirm("Remove this scouted match from local storage?")) {
      const updated = deleteScoutingRecord(id);
      setHistory(updated);
    }
  };

  const handleClearAllHistory = () => {
    if (window.confirm("Are you sure you want to clear ALL saved scouting records from this device?")) {
      clearScoutingHistory();
      setHistory([]);
    }
  };

  return (
    <div className="w-full min-h-screen bg-obsidian text-marble py-8">
      <SEO
        title="Tournament Match Scouting Sheet"
        description="Interactive FTC match scouting entry sheet with cycle increment counters, phase score calculators, and offline resilience."
        noindex={true}
      />

      <div className="w-full max-w-5xl mx-auto px-4 md:px-6 py-6 md:py-12">
        {/* Top Breadcrumb & Connectivity Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-4 border-b border-white/10">
          <Link
            to="/tournaments"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-marble/60 hover:text-white transition-colors"
          >
            <ChevronLeft size={16} aria-hidden="true" />
            <span>Tournaments Vault</span>
          </Link>

          {/* Sync & Offline Status Indicator */}
          <div className="flex items-center gap-3">
            <aside
              role="status"
              aria-live="polite"
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                isOnline
                  ? "bg-emerald-950/60 border-emerald-500/40 text-emerald-400"
                  : "bg-amber-950/60 border-amber-500/40 text-amber-300 animate-pulse"
              }`}
            >
              {isOnline ? (
                <>
                  <Wifi size={12} aria-hidden="true" />
                  <span>Online · Auto-saving</span>
                </>
              ) : (
                <>
                  <WifiOff size={12} aria-hidden="true" />
                  <span>Offline Mode · Saved Locally</span>
                </>
              )}
            </aside>

            {lastSavedAt && (
              <span className="text-[10px] text-marble/40 hidden sm:inline-flex items-center gap-1">
                <Clock size={10} /> Saved {lastSavedAt}
              </span>
            )}

            <button
              type="button"
              onClick={() => setShowHistoryModal(true)}
              className="inline-flex items-center gap-1.5 bg-white/5 hover:bg-white/10 border border-white/15 px-3 py-1 rounded-lg text-xs font-bold text-white transition-colors cursor-pointer"
            >
              <ListOrdered size={14} className="text-ares-gold" />
              <span>Saved Matches ({history.length})</span>
            </button>
          </div>
        </div>

        {/* Page Header */}
        <header className="mb-8">
          <div className="inline-flex items-center gap-2 bg-ares-red/15 text-ares-gold border border-ares-bronze/30 px-3.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest mb-4">
            <Trophy size={12} className="text-ares-gold" aria-hidden="true" />
            <span>ARES 23247 Tactical Scouting</span>
          </div>

          <h1 className="text-3xl md:text-5xl font-black uppercase tracking-tight font-heading text-white">
            Match Scouting{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-ares-red via-ares-gold to-ares-cyan">
              Entry Sheet
            </span>
          </h1>
          <p className="text-xs md:text-sm text-marble/60 mt-2 max-w-2xl leading-relaxed">
            Record live robot telemetry during autonomous, teleoperated rapid cycles, and endgame ascent.
            Data auto-saves instantly to your device for zero data loss in arena dead-zones.
          </p>
        </header>

        {/* Success Alert Banner */}
        {saveSuccessMsg && (
          <div
            role="status"
            aria-live="polite"
            className="mb-8 p-4 bg-emerald-950/80 border border-emerald-500/40 rounded-xl flex items-center justify-between gap-3 text-emerald-200 text-xs font-bold animate-in fade-in duration-300"
          >
            <div className="flex items-center gap-2.5">
              <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
              <span>{saveSuccessMsg}</span>
            </div>
            <button
              onClick={() => setSaveSuccessMsg(null)}
              className="text-emerald-400 hover:text-white text-xs underline cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Validation Errors Header Alert */}
        {Object.keys(validationErrors).length > 0 && (
          <div
            role="alert"
            className="mb-8 p-4 bg-ares-red/20 border border-ares-red/50 rounded-xl flex items-start gap-3 text-red-200 text-xs"
          >
            <AlertCircle size={18} className="text-ares-red shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-white uppercase tracking-wider mb-1">
                Please correct the following fields before saving:
              </p>
              <ul className="list-disc pl-4 space-y-0.5 text-marble/80">
                {Object.values(validationErrors).map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Form Main Container */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSaveRecord();
          }}
          className="space-y-8"
        >
          {/* SECTION 1: MATCH METADATA */}
          <ScoutingMetadataSection
            entry={entry}
            tournaments={tournaments}
            validationErrors={validationErrors}
            onTournamentSelect={handleTournamentSelect}
            onTournamentNameChange={(name) =>
              setEntry((prev) => ({ ...prev, tournamentId: name, tournamentName: name }))
            }
            onMatchNumberChange={(match) => setEntry((prev) => ({ ...prev, matchNumber: match }))}
            onTeamNumberChange={(team) => setEntry((prev) => ({ ...prev, teamNumber: team }))}
            onTeamNameChange={(name) => setEntry((prev) => ({ ...prev, teamName: name }))}
            onScoutNameChange={(name) => setEntry((prev) => ({ ...prev, scoutName: name }))}
            onAllianceChange={(alliance: AllianceColor) => setEntry((prev) => ({ ...prev, alliance }))}
          />

          {/* SECTION 2: AUTONOMOUS */}
          <ScoutingAutoSection
            auto={entry.auto}
            autoSubtotal={scoringBreakdown.autoPoints}
            onUpdateAuto={updateAuto}
          />

          {/* SECTION 3: TELEOP */}
          <ScoutingTeleopSection
            teleop={entry.teleop}
            teleopSubtotal={scoringBreakdown.teleopPoints}
            onUpdateTeleop={updateTeleop}
          />

          {/* SECTION 4: ENDGAME */}
          <ScoutingEndgameSection
            endgame={entry.endgame}
            endgameSubtotal={scoringBreakdown.endgamePoints}
            onUpdateEndgame={updateEndgame}
          />

          {/* SECTION 5: NOTES & OBSERVATIONS */}
          <section className="glass-card hero-card p-6 border border-white/10 bg-black/40">
            <label htmlFor="scout-notes" className="text-xs font-bold text-white uppercase tracking-wider block mb-2">
              5. Qualitative Scout Notes & Defensive Strategy
            </label>
            <textarea
              id="scout-notes"
              rows={3}
              placeholder="Record intake reliability, autonomous path consistency, driver defense handling, mechanical jams, or alliance synergy..."
              value={entry.notes}
              onChange={(e) => setEntry((prev) => ({ ...prev, notes: e.target.value }))}
              className="w-full bg-white/5 border border-white/15 rounded-lg p-3 text-xs text-white placeholder-marble/40 focus:outline-none focus:border-ares-gold transition-all"
            />
          </section>

          {/* SECTION 6: LIVE MATCH SUMMARY BREAKDOWN & SUBMISSION */}
          <ScoutingSummaryBreakdown
            breakdown={scoringBreakdown}
            copySuccess={copySuccess}
            onReset={handleResetDraft}
            onCopySummary={handleCopySummary}
            onSubmit={handleSaveRecord}
          />
        </form>

        {/* SECTION 7: SAVED MATCHES MODAL / DRAWER */}
        <ScoutingHistoryModal
          isOpen={showHistoryModal}
          history={history}
          onClose={() => setShowHistoryModal(false)}
          onDeleteRecord={handleDeleteHistoryItem}
          onClearAll={handleClearAllHistory}
        />
      </div>
    </div>
  );
}
