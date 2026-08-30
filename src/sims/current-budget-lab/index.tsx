/** @sim {"name":"ARES FTC Current Budget Trace","requiresContext":false,"academyApproved":true,"fidelity":"code-derived"} */
import { useState } from "react";

export type CurrentBudgetState = "HEALTHY" | "WARNING" | "CRITICAL";

export type CurrentBudgetResult = {
  safeCurrentAmps: number;
  state: CurrentBudgetState;
  powerScale: number;
  reason: string;
};

export const FTC_CURRENT_PROFILE = {
  warningCurrentAmps: 16,
  criticalCurrentAmps: 20,
  minPowerScale: 0.3,
  hysteresisAmps: 2,
} as const;

export function evaluateCurrentBudget(
  previousState: CurrentBudgetState,
  additionalMeasuredCurrentAmps: number,
): CurrentBudgetResult {
  const safeCurrentAmps =
    Number.isFinite(additionalMeasuredCurrentAmps) && additionalMeasuredCurrentAmps >= 0
      ? additionalMeasuredCurrentAmps
      : 0;
  const { warningCurrentAmps, criticalCurrentAmps, minPowerScale, hysteresisAmps } =
    FTC_CURRENT_PROFILE;

  let state: CurrentBudgetState;
  if (previousState === "HEALTHY") {
    state =
      safeCurrentAmps >= criticalCurrentAmps
        ? "CRITICAL"
        : safeCurrentAmps >= warningCurrentAmps
          ? "WARNING"
          : "HEALTHY";
  } else if (previousState === "WARNING") {
    state =
      safeCurrentAmps >= criticalCurrentAmps
        ? "CRITICAL"
        : safeCurrentAmps < warningCurrentAmps - hysteresisAmps
          ? "HEALTHY"
          : "WARNING";
  } else {
    state =
      safeCurrentAmps < criticalCurrentAmps - hysteresisAmps ? "WARNING" : "CRITICAL";
  }

  let powerScale: number;
  if (state === "HEALTHY") {
    powerScale = 1;
  } else if (state === "CRITICAL") {
    powerScale = minPowerScale;
  } else {
    const range = criticalCurrentAmps - warningCurrentAmps;
    const ratio = Math.min(1, Math.max(0, 1 - (safeCurrentAmps - warningCurrentAmps) / range));
    powerScale = minPowerScale + ratio * (1 - minPowerScale);
  }

  const reason =
    state === "HEALTHY"
      ? "The current is in the healthy zone for this state-machine step."
      : state === "CRITICAL"
        ? "The current is in the critical zone, so the source uses its minimum scale."
        : "The current is in the warning zone, so the source uses its warning-band scale.";

  return { safeCurrentAmps, state, powerScale, reason };
}

export default function CurrentBudgetLab() {
  const [previousState, setPreviousState] = useState<CurrentBudgetState>("HEALTHY");
  const [currentAmps, setCurrentAmps] = useState(16);
  const result = evaluateCurrentBudget(previousState, currentAmps);

  const reset = () => {
    setPreviousState("HEALTHY");
    setCurrentAmps(16);
  };

  return (
    <section aria-labelledby="current-budget-title" className="my-6 rounded-lg border border-white/10 bg-charcoal p-4 sm:p-5">
      <h3 id="current-budget-title" className="text-xl font-black text-white">ARES FTC Current Budget Trace</h3>
      <p className="mt-2 text-sm text-marble/80">Step one measured current through the pinned FTC profile.</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-bold text-white">Prior budget state
          <select value={previousState} onChange={(event) => setPreviousState(event.currentTarget.value as CurrentBudgetState)} className={controlClass}>
            <option value="HEALTHY">Healthy</option><option value="WARNING">Warning</option><option value="CRITICAL">Critical</option>
          </select>
        </label>
        <label className="text-sm font-bold text-white">Lesson current input (amps)
          <input type="number" inputMode="decimal" min={0} max={24} step={0.5} value={currentAmps} onChange={(event) => { const next = event.currentTarget.valueAsNumber; if (Number.isFinite(next)) setCurrentAmps(Math.min(24, Math.max(0, next))); }} className={controlClass} />
        </label>
      </div>
      <button type="button" onClick={reset} className="mt-4 min-h-11 rounded border border-white/20 px-4 text-sm font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan">Reset trace</button>
      <div role="status" aria-live="polite" className="mt-4 rounded border border-ares-cyan/30 bg-obsidian p-4 text-sm leading-relaxed text-white">
        <strong>{previousState} → {result.state}</strong> at {result.safeCurrentAmps.toFixed(1)} A; power scale {(result.powerScale * 100).toFixed(1)}%. {result.reason}
      </div>
      <p role="note" className="mt-4 border-l-4 border-ares-gold/60 bg-ares-gold/10 p-3 text-sm leading-relaxed text-white">
        <strong>Model limit:</strong> This trace copies one state-machine step from the pinned FTC
        profile with no registered motors. It does not run Kotlin, estimate a motor, read a current
        sensor, model voltage sag or heat, apply a command, or approve electrical hardware.
      </p>
    </section>
  );
}

const controlClass = "mt-2 min-h-11 w-full rounded border border-white/20 bg-obsidian px-3 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan";
