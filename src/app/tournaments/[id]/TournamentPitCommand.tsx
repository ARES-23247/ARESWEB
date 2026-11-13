import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  AlertTriangle,
  BatteryCharging,
  CheckSquare,
  CloudOff,
  Maximize2,
  Plus,
  RotateCcw,
  Wrench,
  X,
} from "lucide-react";
import {
  enqueueTournamentMutation,
  flushTournamentOutbox,
  generateOutboxId,
  isPermanentOutboxError,
  listTournamentOutbox,
  PitOutboxQuotaError,
} from "@/lib/pitModeOutbox";
import { submitPitScouting, submitStandScouting } from "@/lib/tournamentApi";
import { useFocusTrap } from "@/lib/useFocusTrap";
import type {
  PitBattery,
  PitBatteryStatus,
  PitTriageItem,
  Tournament,
  TournamentMatch,
  TournamentPitState,
} from "@/types/tournament";

const PIT_CHECKLIST_ITEMS = [
  {
    id: "battery",
    label: "Battery Voltage Verified (≥ 13.0V Loaded)",
    detail:
      "Fresh 12V battery installed, secured with strap, and power lead seated.",
  },
  {
    id: "autonomous",
    label: "Autonomous Alliance & Start Position",
    detail:
      "Correct OpMode selected on Driver Hub matching alliance color and starting tile.",
  },
  {
    id: "hardware",
    label: "Hardware & Fastener Inspection",
    detail:
      "Set screws, belts/chains, bumper clearances, and dead-wheel pods checked.",
  },
  {
    id: "sensors",
    label: "Sensor & Vision Calibration",
    detail:
      "IMU heading zeroed, camera pipeline verified, and cable strain reliefs intact.",
  },
  {
    id: "gamepads",
    label: "Driver Station & Gamepad Pairing",
    detail:
      "Gamepad 1 (Start+A) and Gamepad 2 (Start+B) verified; 30-second match timer off.",
  },
] as const;

interface TournamentPitCommandProps {
  tournament: Tournament;
  userUid?: string | null;
  matches: TournamentMatch[];
  pitState: TournamentPitState | undefined;
  onSavePitState: (
    next: Pick<TournamentPitState, "checklists" | "batteries" | "triageItems">,
  ) => Promise<unknown>;
}

export function TournamentPitCommand({
  tournament,
  userUid,
  matches,
  pitState,
  onSavePitState,
}: TournamentPitCommandProps) {
  const nextMatch = useMemo(
    () => matches.find((m) => !m.completed) ?? null,
    [matches],
  );
  const matchKey = nextMatch?.matchNumber || "GENERAL";

  const [checklists, setChecklists] = useState<Record<string, string[]>>(
    () => pitState?.checklists ?? {},
  );
  const [batteries, setBatteries] = useState<PitBattery[]>(
    () => pitState?.batteries ?? [],
  );
  const [triageItems, setTriageItems] = useState<PitTriageItem[]>(
    () => pitState?.triageItems ?? [],
  );
  const [kioskOpen, setKioskOpen] = useState(false);

  // Add battery inputs
  const [newBatteryLabel, setNewBatteryLabel] = useState("");
  const [newBatteryVoltage, setNewBatteryVoltage] = useState("13.4");

  // Add triage inputs
  const [triageSeverity, setTriageSeverity] = useState<"blocker" | "warn">("blocker");
  const [triageSubsystem, setTriageSubsystem] = useState("");
  const [triageSummary, setTriageSummary] = useState("");
  const [hasPendingPitSync, setHasPendingPitSync] = useState(() =>
    listTournamentOutbox(tournament.id, userUid).some((m) => m.kind === "pit_state"),
  );
  const [pitSyncNotice, setPitSyncNotice] = useState<string | null>(null);
  const [isSyncingPit, setIsSyncingPit] = useState(false);

  const syncPendingPitState = useCallback(async () => {
    setIsSyncingPit(true);
    try {
      const result = await flushTournamentOutbox(
        tournament.id,
        {
          submitPit: submitPitScouting,
          submitStand: submitStandScouting,
          savePitState: (_tid, next) => onSavePitState(next),
        },
        userUid,
      );
      setHasPendingPitSync(result.remaining.some((m) => m.kind === "pit_state"));
      if (result.rejected.length > 0) {
        setPitSyncNotice(`Pit change rejected by server: ${result.rejected[0].message}`);
      } else if (result.flushed > 0) {
        setPitSyncNotice(null);
      }
    } finally {
      setIsSyncingPit(false);
    }
  }, [onSavePitState, tournament.id, userUid]);

  useEffect(() => {
    setHasPendingPitSync(
      listTournamentOutbox(tournament.id, userUid).some((m) => m.kind === "pit_state"),
    );
  }, [tournament.id, userUid]);

  useEffect(() => {
    const handleOnline = () => {
      if (listTournamentOutbox(tournament.id, userUid).length > 0) {
        void syncPendingPitState();
      }
    };
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [syncPendingPitState, tournament.id, userUid]);

  useEffect(() => {
    if (!pitState) return;
    setChecklists(pitState.checklists);
    setBatteries(pitState.batteries);
    setTriageItems(pitState.triageItems);
  }, [pitState]);

  const kioskTriggerRef = useRef<HTMLButtonElement>(null);

  const closeKiosk = useCallback(() => {
    setKioskOpen(false);
    try {
      if (document.fullscreenElement) {
        void document.exitFullscreen?.().catch(() => undefined);
      }
    } catch {
      // Ignore fullscreen exit errors.
    }
    if (typeof window !== "undefined") {
      window.requestAnimationFrame(() => {
        kioskTriggerRef.current?.focus();
      });
    }
  }, []);

  const kioskRef = useFocusTrap(kioskOpen, closeKiosk);

  useEffect(() => {
    if (!kioskOpen) return;
    let enteredFullscreen = Boolean(document.fullscreenElement);
    const handleFullscreenChange = () => {
      if (document.fullscreenElement) {
        enteredFullscreen = true;
      } else if (enteredFullscreen) {
        setKioskOpen(false);
      }
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, [kioskOpen]);

  const persistState = async (
    nextChecklists: Record<string, string[]>,
    nextBatteries: PitBattery[],
    nextTriage: PitTriageItem[],
  ) => {
    setChecklists(nextChecklists);
    setBatteries(nextBatteries);
    setTriageItems(nextTriage);
    const payload = {
      checklists: nextChecklists,
      batteries: nextBatteries,
      triageItems: nextTriage,
    };
    try {
      await onSavePitState(payload);
      setHasPendingPitSync(false);
      setPitSyncNotice(null);
    } catch (err) {
      if (isPermanentOutboxError(err)) {
        setPitSyncNotice(
          `Pit update not saved: ${err instanceof Error ? err.message : "Server rejected change."}`,
        );
        return;
      }
      try {
        const nextQueue = enqueueTournamentMutation(
          {
            tournamentId: tournament.id,
            kind: "pit_state",
            payload,
          },
          userUid,
        );
        setHasPendingPitSync(nextQueue.some((m) => m.kind === "pit_state"));
        setPitSyncNotice(
          "Venue network unreachable — Pit changes queued offline for automatic sync.",
        );
      } catch (queueErr) {
        setPitSyncNotice(
          queueErr instanceof PitOutboxQuotaError
            ? "Offline storage is full — Pit changes could not be queued."
            : "Offline Pit changes could not be queued.",
        );
      }
    }
  };

  const checkedIds = checklists[matchKey] ?? [];
  const isReady =
    Boolean(nextMatch) && checkedIds.length === PIT_CHECKLIST_ITEMS.length;

  const recommendedBattery = useMemo(() => {
    return (
      [...batteries]
        .filter((b) => b.status === "charged")
        .sort((a, b) => b.voltage - a.voltage)[0] ?? null
    );
  }, [batteries]);

  const openBlockers = useMemo(
    () => triageItems.filter((item) => !item.resolved && item.severity === "blocker"),
    [triageItems],
  );

  const toggleCheckItem = (itemId: string) => {
    const current = checklists[matchKey] ?? [];
    const updated = current.includes(itemId)
      ? current.filter((id) => id !== itemId)
      : [...current, itemId];
    void persistState({ ...checklists, [matchKey]: updated }, batteries, triageItems);
  };

  const resetChecklist = () => {
    void persistState({ ...checklists, [matchKey]: [] }, batteries, triageItems);
  };

  const handleAddBattery = (event: FormEvent) => {
    event.preventDefault();
    const label = newBatteryLabel.trim();
    const voltage = Number.parseFloat(newBatteryVoltage);
    if (!label || !Number.isFinite(voltage)) return;
    const nextBatteries: PitBattery[] = [
      ...batteries,
      {
        id: generateOutboxId("bat"),
        label,
        voltage: Math.round(voltage * 10) / 10,
        status: "charged",
        cycles: 0,
      },
    ];
    setNewBatteryLabel("");
    void persistState(checklists, nextBatteries, triageItems);
  };

  const updateBatteryStatus = (id: string, status: PitBatteryStatus) => {
    const nextBatteries = batteries.map((b) =>
      b.id === id
        ? {
            ...b,
            status,
            cycles: status === "in_robot" ? b.cycles + 1 : b.cycles,
          }
        : b,
    );
    void persistState(checklists, nextBatteries, triageItems);
  };

  const handleAddTriage = (event: FormEvent) => {
    event.preventDefault();
    const subsystem = triageSubsystem.trim() || "General";
    const summary = triageSummary.trim();
    if (!summary) return;
    const nextTriage: PitTriageItem[] = [
      {
        id: generateOutboxId("fix"),
        severity: triageSeverity,
        subsystem,
        summary,
        resolved: false,
      },
      ...triageItems,
    ];
    setTriageSubsystem("");
    setTriageSummary("");
    void persistState(checklists, batteries, nextTriage);
  };

  const toggleTriageResolved = (id: string) => {
    const nextTriage = triageItems.map((t) =>
      t.id === id ? { ...t, resolved: !t.resolved } : t,
    );
    void persistState(checklists, batteries, nextTriage);
  };

  const openKiosk = () => {
    kioskTriggerRef.current?.focus();
    setKioskOpen(true);
    const isE2EBypass =
      typeof window !== "undefined" &&
      Boolean((window as Window & { ARES_E2E_BYPASS?: unknown }).ARES_E2E_BYPASS);
    if (isE2EBypass) return;
    try {
      void document.documentElement.requestFullscreen?.().catch(() => undefined);
    } catch {
      // Fullscreen API optional in jsdom / restricted browsers.
    }
  };

  const lookupTeamOpr = (teamNum: string) =>
    tournament.oprList?.find((t) => t.teamNumber === teamNum)?.opr;

  return (
    <section
      aria-labelledby="pit-readiness-heading"
      className="bg-white/5 border border-white/10 rounded-2xl p-6 relative overflow-hidden backdrop-blur-sm shadow-xl space-y-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 pb-4">
        <div>
          <h2
            id="pit-readiness-heading"
            className="text-lg font-bold text-white uppercase tracking-tight font-heading flex items-center gap-2"
          >
            <CheckSquare
              className="text-ares-gold"
              size={18}
              aria-hidden="true"
            />
            Pre-Match Pit &amp; Queuing Checklist
          </h2>
          {nextMatch && (
            <p className="mt-1 text-xs text-marble/70">
              Target Match:{" "}
              <strong className="text-white font-mono">
                {nextMatch.matchNumber}
              </strong>{" "}
              ·{" "}
              <span
                className={
                  nextMatch.alliance === "red"
                    ? "text-ares-red-light font-bold uppercase"
                    : "text-ares-cyan font-bold uppercase"
                }
              >
                {nextMatch.alliance} Alliance
              </span>{" "}
              (Partner: #{nextMatch.partner})
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {hasPendingPitSync && (
            <div className="flex items-center gap-2 rounded-lg border border-ares-gold/40 bg-ares-gold/10 px-2.5 py-1">
              <CloudOff size={12} className="text-ares-gold" aria-hidden="true" />
              <span className="text-[10px] font-black uppercase tracking-wider text-ares-gold">
                Pit changes queued
              </span>
              <button
                type="button"
                disabled={isSyncingPit}
                onClick={() => void syncPendingPitState()}
                className="rounded bg-ares-gold px-2 py-0.5 text-[10px] font-black uppercase text-obsidian hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
              >
                {isSyncingPit ? "Syncing..." : "Sync Now"}
              </button>
            </div>
          )}

          <span
            className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${
              isReady && openBlockers.length === 0
                ? "border-ares-success/40 bg-ares-success/15 text-ares-success"
                : openBlockers.length > 0
                  ? "border-ares-red/40 bg-ares-red/15 text-ares-red-light"
                  : "border-ares-gold/30 bg-ares-gold/10 text-ares-gold"
            }`}
          >
            {!nextMatch
              ? "No upcoming match"
              : openBlockers.length > 0
                ? `${openBlockers.length} Blocker${openBlockers.length === 1 ? "" : "s"}`
                : isReady
                  ? "Queue Ready"
                  : `${checkedIds.length} / ${PIT_CHECKLIST_ITEMS.length} Ready`}
          </span>

          {checkedIds.length > 0 && (
            <button
              type="button"
              onClick={resetChecklist}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-white/15 bg-black/40 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-marble/80 hover:border-ares-gold hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
            >
              <RotateCcw size={12} aria-hidden="true" /> Reset Checklist
            </button>
          )}

          <button
            ref={kioskTriggerRef}
            type="button"
            onClick={openKiosk}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-ares-gold/40 bg-ares-gold/15 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-ares-gold hover:bg-ares-gold hover:text-obsidian focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
          >
            <Maximize2 size={12} aria-hidden="true" /> Launch Pit Kiosk
          </button>
        </div>
      </div>

      {pitSyncNotice && (
        <div
          role="status"
          aria-live="polite"
          className="rounded-lg border border-ares-gold/40 bg-ares-gold/10 px-3.5 py-2 text-xs text-white"
        >
          {pitSyncNotice}
        </div>
      )}

      {/* Synced Pre-Match Checklist */}
      <div className="grid grid-cols-1 gap-2.5">
        {PIT_CHECKLIST_ITEMS.map((item) => {
          const checked = checkedIds.includes(item.id);
          return (
            <label
              key={item.id}
              className={`flex items-start gap-3.5 rounded-xl border p-3.5 transition-colors cursor-pointer ${
                checked
                  ? "border-ares-success/40 bg-ares-success/10"
                  : "border-white/10 bg-black/35 hover:border-white/25"
              }`}
            >
              <input
                type="checkbox"
                disabled={!nextMatch}
                checked={checked}
                onChange={() => toggleCheckItem(item.id)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-ares-gold"
              />
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-extrabold uppercase tracking-wide text-white">
                  {item.label}
                </span>
                <span className="mt-0.5 block text-xs text-marble/70 leading-relaxed">
                  {item.detail}
                </span>
              </span>
            </label>
          );
        })}
      </div>

      {/* Battery Fleet & Between-Match Pit Triage */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
        {/* Battery Fleet */}
        <div className="rounded-xl border border-white/10 bg-black/35 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black uppercase tracking-wider text-white flex items-center gap-1.5">
              <BatteryCharging
                size={15}
                className="text-ares-gold"
                aria-hidden="true"
              />
              Battery Rotation Fleet
            </h3>
            {recommendedBattery && (
              <span className="text-[10px] font-mono font-bold text-ares-success">
                Next: {recommendedBattery.label} ({recommendedBattery.voltage}V)
              </span>
            )}
          </div>

          <form onSubmit={handleAddBattery} className="flex gap-2">
            <label htmlFor="new-battery-label" className="sr-only">
              Battery label
            </label>
            <input
              id="new-battery-label"
              type="text"
              placeholder="Pack #1"
              value={newBatteryLabel}
              onChange={(e) => setNewBatteryLabel(e.target.value)}
              className="min-w-0 flex-1 rounded border border-white/15 bg-black/50 px-2.5 py-1.5 text-xs text-white"
            />
            <label htmlFor="new-battery-voltage" className="sr-only">
              Battery voltage
            </label>
            <input
              id="new-battery-voltage"
              type="number"
              step="0.1"
              min={9}
              max={16}
              value={newBatteryVoltage}
              onChange={(e) => setNewBatteryVoltage(e.target.value)}
              className="w-20 rounded border border-white/15 bg-black/50 px-2 py-1.5 text-xs font-mono text-white"
            />
            <button
              type="submit"
              aria-label="Add battery pack"
              className="inline-flex items-center gap-1 rounded bg-white/10 px-2.5 py-1.5 text-[10px] font-black uppercase text-white hover:bg-ares-gold hover:text-obsidian"
            >
              <Plus size={12} aria-hidden="true" /> Add
            </button>
          </form>

          {batteries.length === 0 ? (
            <p className="text-[11px] text-marble/55">
              Add numbered 12V packs to track resting voltage and match rotation.
            </p>
          ) : (
            <ul className="space-y-2">
              {batteries.map((b) => (
                <li
                  key={b.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs"
                >
                  <div>
                    <span className="font-bold text-white">{b.label}</span>
                    <span className="ml-2 font-mono text-ares-gold">
                      {b.voltage}V
                    </span>
                    <span className="ml-2 text-[10px] text-marble/55">
                      ({b.cycles} cyc)
                    </span>
                  </div>
                  <label htmlFor={`bat-status-${b.id}`} className="sr-only">
                    Status for {b.label}
                  </label>
                  <select
                    id={`bat-status-${b.id}`}
                    value={b.status}
                    onChange={(e) =>
                      updateBatteryStatus(b.id, e.target.value as PitBatteryStatus)
                    }
                    className="rounded border border-white/15 bg-black/70 px-2 py-1 text-[10px] font-bold uppercase text-white"
                  >
                    <option value="charged">Charged</option>
                    <option value="in_robot">In Robot</option>
                    <option value="cooldown">Cooldown</option>
                    <option value="charging">Charging</option>
                  </select>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Pit Triage Fix List */}
        <div className="rounded-xl border border-white/10 bg-black/35 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black uppercase tracking-wider text-white flex items-center gap-1.5">
              <Wrench size={14} className="text-ares-gold" aria-hidden="true" />
              Between-Match Pit Triage
            </h3>
            <span className="text-[10px] font-mono text-marble/60">
              {triageItems.filter((t) => !t.resolved).length} open
            </span>
          </div>

          <form onSubmit={handleAddTriage} className="space-y-2">
            <div className="flex gap-2">
              <label htmlFor="triage-severity" className="sr-only">
                Issue severity
              </label>
              <select
                id="triage-severity"
                value={triageSeverity}
                onChange={(e) =>
                  setTriageSeverity(e.target.value as "blocker" | "warn")
                }
                className="rounded border border-white/15 bg-black/60 px-2 py-1.5 text-[10px] font-bold uppercase text-white"
              >
                <option value="blocker">Blocker</option>
                <option value="warn">Warning</option>
              </select>
              <label htmlFor="triage-subsystem" className="sr-only">
                Subsystem
              </label>
              <input
                id="triage-subsystem"
                type="text"
                placeholder="Subsystem (e.g. Claw)"
                value={triageSubsystem}
                onChange={(e) => setTriageSubsystem(e.target.value)}
                className="min-w-0 flex-1 rounded border border-white/15 bg-black/50 px-2.5 py-1.5 text-xs text-white"
              />
            </div>
            <div className="flex gap-2">
              <label htmlFor="triage-summary" className="sr-only">
                Pit fix description
              </label>
              <input
                id="triage-summary"
                type="text"
                placeholder="Describe mechanical / code fix before next queue..."
                value={triageSummary}
                onChange={(e) => setTriageSummary(e.target.value)}
                className="min-w-0 flex-1 rounded border border-white/15 bg-black/50 px-2.5 py-1.5 text-xs text-white"
              />
              <button
                type="submit"
                className="rounded bg-ares-red px-3 py-1.5 text-[10px] font-black uppercase text-white hover:bg-ares-bronze"
              >
                Log Fix
              </button>
            </div>
          </form>

          {triageItems.length === 0 ? (
            <p className="text-[11px] text-marble/55">
              Zero open mechanical or software work items.
            </p>
          ) : (
            <ul className="space-y-2 max-h-44 overflow-y-auto">
              {triageItems.map((item) => (
                <li
                  key={item.id}
                  className={`flex items-start gap-2.5 rounded-lg border px-3 py-2 text-xs ${
                    item.resolved
                      ? "border-white/5 bg-black/20 opacity-60"
                      : item.severity === "blocker"
                        ? "border-ares-red/40 bg-ares-red/10"
                        : "border-ares-gold/30 bg-black/40"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={item.resolved}
                    onChange={() => toggleTriageResolved(item.id)}
                    aria-label={`Mark resolved: ${item.summary}`}
                    className="mt-0.5 h-4 w-4 accent-ares-success"
                  />
                  <div className="min-w-0 flex-1">
                    <span className="text-[10px] font-black uppercase tracking-wider text-ares-gold">
                      {item.subsystem}
                    </span>
                    <p
                      className={`text-xs ${item.resolved ? "line-through text-marble/50" : "text-white"}`}
                    >
                      {item.summary}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Fullscreen Pit Kiosk Modal */}
      {kioskOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Pit Command Kiosk Display"
          tabIndex={-1}
          ref={kioskRef}
          className="fixed inset-0 z-50 bg-obsidian text-marble p-6 md:p-10 overflow-y-auto flex flex-col justify-between"
        >
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-5">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.25em] text-ares-gold">
                ARES #23247 · Pit Command Kiosk
              </p>
              <h2 className="text-2xl md:text-4xl font-black uppercase font-heading text-white mt-1">
                {tournament.name}
              </h2>
            </div>
            <button
              type="button"
              onClick={closeKiosk}
              className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/5 px-4 py-2.5 text-xs font-black uppercase tracking-wider text-white hover:border-ares-gold"
            >
              <X size={16} aria-hidden="true" /> Exit Kiosk
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 my-auto py-8">
            {/* Next Match Banner */}
            <div className="lg:col-span-2 rounded-2xl border border-white/15 bg-black/55 p-8 space-y-5">
              <span className="text-xs font-black uppercase tracking-widest text-marble/60">
                Next Scheduled Queue
              </span>
              {nextMatch ? (
                <>
                  <div className="flex flex-wrap items-baseline gap-4">
                    <span className="text-5xl md:text-7xl font-black font-mono text-white">
                      {nextMatch.matchNumber}
                    </span>
                    <span
                      className={`rounded-xl px-4 py-1.5 text-lg font-black uppercase tracking-wider ${
                        nextMatch.alliance === "red"
                          ? "bg-ares-red text-white"
                          : "bg-ares-cyan/25 text-ares-cyan border border-ares-cyan/50"
                      }`}
                    >
                      {nextMatch.alliance} Alliance
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                      <span className="text-[10px] font-black uppercase tracking-widest text-ares-gold block">
                        Alliance Partner
                      </span>
                      <span className="text-2xl font-black font-mono text-white">
                        #{nextMatch.partner}
                      </span>
                      {lookupTeamOpr(nextMatch.partner) !== undefined && (
                        <span className="block text-xs font-mono text-marble/70 mt-1">
                          OPR: {lookupTeamOpr(nextMatch.partner)}
                        </span>
                      )}
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                      <span className="text-[10px] font-black uppercase tracking-widest text-marble/60 block">
                        Opposing Alliance
                      </span>
                      <span className="text-xl font-black font-mono text-white">
                        {nextMatch.opponents.map((o) => `#${o}`).join(" · ")}
                      </span>
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-2xl font-bold text-marble/60">
                  All recorded matches completed.
                </p>
              )}
            </div>

            {/* Readiness, Battery & Blocker Status */}
            <div className="space-y-4">
              <div className="rounded-2xl border border-white/15 bg-black/55 p-6">
                <span className="text-xs font-black uppercase tracking-widest text-marble/60 block">
                  Checklist Status
                </span>
                <span className="mt-2 block text-3xl font-black font-mono text-ares-gold">
                  {checkedIds.length} / {PIT_CHECKLIST_ITEMS.length} Ready
                </span>
              </div>

              <div className="rounded-2xl border border-white/15 bg-black/55 p-6">
                <span className="text-xs font-black uppercase tracking-widest text-marble/60 block">
                  Recommended Battery
                </span>
                <span className="mt-2 block text-2xl font-black font-mono text-ares-success">
                  {recommendedBattery
                    ? `${recommendedBattery.label} (${recommendedBattery.voltage}V)`
                    : "No charged pack logged"}
                </span>
              </div>

              <div
                className={`rounded-2xl border p-6 ${
                  openBlockers.length > 0
                    ? "border-ares-red bg-ares-red/15"
                    : "border-ares-success/40 bg-ares-success/10"
                }`}
              >
                <span className="text-xs font-black uppercase tracking-widest text-white flex items-center gap-2">
                  <AlertTriangle size={15} aria-hidden="true" />
                  {openBlockers.length === 0
                    ? "0 Open Blockers"
                    : `${openBlockers.length} Open Blocker${openBlockers.length === 1 ? "" : "s"}`}
                </span>
                {openBlockers.map((b) => (
                  <p key={b.id} className="mt-2 text-sm font-bold text-white">
                    [{b.subsystem}] {b.summary}
                  </p>
                ))}
              </div>
            </div>
          </div>

          <p className="text-[11px] uppercase tracking-widest text-marble/50 text-center">
            {pitState?.updatedByNickname
              ? `Last Pit Sync by ${pitState.updatedByNickname}`
              : "Live ARES Pit Command"}
          </p>
        </div>
      )}
    </section>
  );
}
