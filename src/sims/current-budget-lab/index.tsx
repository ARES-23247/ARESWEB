/** @sim {"name":"ARES FTC Current Budget Trace","requiresContext":false,"academyApproved":true,"fidelity":"code-derived"} */
import { useMemo, useState } from "react";

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

const PRESETS = [13.5, 14, 16, 17, 17.5, 18, 20] as const;

export default function CurrentBudgetLab() {
  const [previousState, setPreviousState] = useState<CurrentBudgetState>("HEALTHY");
  const [currentAmps, setCurrentAmps] = useState(16);
  const result = useMemo(
    () => evaluateCurrentBudget(previousState, currentAmps),
    [previousState, currentAmps],
  );

  const reset = () => {
    setPreviousState("HEALTHY");
    setCurrentAmps(16);
  };

  return (
    <section
      aria-labelledby="current-budget-title"
      className="my-8 rounded-xl border border-ares-cyan/30 bg-black/35 p-4 sm:p-6"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-ares-cyan">
            Current ARES 11.1 source trace
          </p>
          <h3 id="current-budget-title" className="mt-1 text-xl font-black text-white">
            ARES FTC Current Budget Trace
          </h3>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-marble/80">
            Step one current value through the fixed FTC profile in CurrentBudgetManager.
          </p>
        </div>
        <button type="button" onClick={reset} className={buttonClass}>
          Reset trace
        </button>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="grid content-start gap-5 rounded-lg border border-white/10 bg-white/5 p-4">
          <label className="grid gap-2 text-sm font-bold text-white">
            Prior budget state
            <select
              value={previousState}
              onChange={(event) =>
                setPreviousState(event.currentTarget.value as CurrentBudgetState)
              }
              className="min-h-11 rounded border border-white/20 bg-obsidian px-3 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
            >
              <option value="HEALTHY">Healthy</option>
              <option value="WARNING">Warning</option>
              <option value="CRITICAL">Critical</option>
            </select>
          </label>

          <label htmlFor="current-budget-amps" className="grid gap-2 text-sm font-bold text-white">
            Lesson current input
            <span className="flex items-center gap-2">
              <input
                id="current-budget-amps"
                type="number"
                inputMode="decimal"
                min={0}
                max={24}
                step={0.5}
                value={currentAmps}
                onChange={(event) => {
                  const next = event.currentTarget.valueAsNumber;
                  if (Number.isFinite(next)) setCurrentAmps(Math.min(24, Math.max(0, next)));
                }}
                className="min-h-11 min-w-0 flex-1 rounded border border-white/20 bg-obsidian px-3 font-mono text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
              />
              <span aria-hidden="true" className="text-xs text-marble/70">
                A
              </span>
            </span>
          </label>

          <fieldset className="grid gap-2">
            <legend className="text-sm font-bold text-ares-gold">Boundary presets</legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {PRESETS.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setCurrentAmps(value)}
                  className={buttonClass}
                >
                  {value.toFixed(1)} A
                </button>
              ))}
            </div>
          </fieldset>
        </div>

        <div className="rounded-lg border border-white/10 bg-obsidian p-4">
          <h4 className="text-sm font-bold uppercase tracking-wider text-ares-gold">
            One-step result
          </h4>
          <p
            role="status"
            aria-live="polite"
            className="mt-4 rounded border border-ares-cyan/30 bg-ares-cyan/10 p-3 text-sm font-bold text-white"
          >
            {result.reason}
          </p>
          <dl className="mt-4 grid gap-3 sm:grid-cols-2">
            <Result label="Prior state" value={previousState} />
            <Result label="Next state" value={result.state} />
            <Result label="Current used" value={`${result.safeCurrentAmps.toFixed(1)} A`} />
            <Result label="Power scale" value={`${(result.powerScale * 100).toFixed(1)}%`} />
            <Result label="Warning boundary" value="16.0 A" />
            <Result label="Critical boundary" value="20.0 A" />
          </dl>
        </div>
      </div>

      <p
        role="note"
        className="mt-5 border-l-4 border-ares-gold/60 bg-ares-gold/10 p-3 text-sm leading-relaxed text-white"
      >
        <strong>Model limit:</strong> This trace copies one state-machine step from the pinned FTC
        profile with no registered motors. It does not run Kotlin, estimate a motor, read a current
        sensor, model voltage sag or heat, apply a command, or approve electrical hardware.
      </p>
    </section>
  );
}

const buttonClass =
  "min-h-11 rounded border border-white/20 px-3 py-2 text-sm font-bold text-white hover:border-ares-cyan focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan";

function Result({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-white/10 p-3">
      <dt className="text-xs uppercase tracking-wide text-marble/70">{label}</dt>
      <dd className="mt-1 break-words font-mono font-bold text-white">{value}</dd>
    </div>
  );
}
