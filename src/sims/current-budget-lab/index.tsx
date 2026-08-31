/** @sim {"name":"ARES FTC Current Budget Trace","requiresContext":false,"academyApproved":true,"fidelity":"code-derived"} */
import { useState } from "react";
import {
  AcademyLabShell,
  AcademyModelLimit,
  AcademyNumberControl,
  AcademySelectControl,
} from "@/sims/shared/academy-interaction-ui";

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
    <AcademyLabShell
      titleId="current-budget-title"
      title="ARES FTC Current Budget Trace"
      eyebrow="Code-derived state trace"
      description="Step one measured current through the pinned FTC profile."
      onReset={reset}
      resetLabel="Reset trace"
    >
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <AcademySelectControl
          id="prior-budget-state"
          label="Prior budget state"
          value={previousState}
          options={["HEALTHY", "WARNING", "CRITICAL"]}
          onChange={(value) => setPreviousState(value as CurrentBudgetState)}
        />
        <AcademyNumberControl
          id="lesson-current-input"
          label="Lesson current input (amps)"
          unit="A"
          value={currentAmps}
          min={0}
          max={24}
          step={0.5}
          onChange={(value) => {
            if (Number.isFinite(value)) setCurrentAmps(Math.min(24, Math.max(0, value)));
          }}
        />
      </div>
      <div role="status" aria-live="polite" className="mt-4 rounded border border-ares-cyan/30 bg-obsidian p-4 text-sm leading-relaxed text-white">
        <strong>{previousState} → {result.state}</strong> at {result.safeCurrentAmps.toFixed(1)} A; power scale {(result.powerScale * 100).toFixed(1)}%. {result.reason}
      </div>
      <AcademyModelLimit>
        This trace copies one state-machine step from the pinned FTC
        profile with no registered motors. It does not run Kotlin, estimate a motor, read a current
        sensor, model voltage sag or heat, apply a command, or approve electrical hardware.
      </AcademyModelLimit>
    </AcademyLabShell>
  );
}
