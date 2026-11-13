/** @sim {"name":"ARES FTC Feedforward Term Trace","requiresContext":false,"academyApproved":true,"fidelity":"code-derived"} */
import { useMemo, useState } from "react";
import {
  AcademyLabShell,
  AcademyMetric,
  AcademyModelLimit,
  AcademyNumberControl,
} from "@/sims/shared/academy-interaction-ui";

export type FeedforwardStepInput = {
  kS: number;
  kV: number;
  kA: number;
  targetVelocityMps: number;
  previousTargetVelocityMps: number;
  dtSeconds: number;
  batteryVolts: number;
};

export type FeedforwardStepResult = {
  targetVelocityMps: number;
  previousTargetVelocityMps: number;
  maxWheelSpeedMps: number;
  usedDtSeconds: number;
  accelerationMps2: number;
  staticTerm: number;
  velocityTerm: number;
  accelerationTerm: number;
  rawRequest: number;
  voltageCompensationFactor: number;
  unclampedOutput: number;
  output: number;
  saturated: boolean;
  failedClosed: boolean;
};

export const TEAM_PROFILE_SNAPSHOT = {
  kS: 0.05,
  kV: 0.638,
  kA: 0.02,
} as const;

export const TEAM_MAX_WHEEL_SPEED_MPS = 1 / TEAM_PROFILE_SNAPSHOT.kV;

const DEFAULT_INPUT: FeedforwardStepInput = {
  ...TEAM_PROFILE_SNAPSHOT,
  targetVelocityMps: 1,
  previousTargetVelocityMps: 1,
  dtSeconds: 0.02,
  batteryVolts: 12,
};

function finiteOrZero(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

function maxWheelSpeedForKv(kV: number): number {
  return Number.isFinite(kV) && kV > 0.0001 ? 1 / kV : TEAM_MAX_WHEEL_SPEED_MPS;
}

function finiteClampedSpeed(value: number, maxWheelSpeedMps: number): number {
  return Number.isFinite(value)
    ? Math.min(maxWheelSpeedMps, Math.max(-maxWheelSpeedMps, value))
    : 0;
}

export function calculateFeedforwardStep(input: FeedforwardStepInput): FeedforwardStepResult {
  const maxWheelSpeedMps = maxWheelSpeedForKv(input.kV);
  const targetVelocityMps = finiteClampedSpeed(input.targetVelocityMps, maxWheelSpeedMps);
  const previousTargetVelocityMps = finiteClampedSpeed(input.previousTargetVelocityMps, maxWheelSpeedMps);
  const usedDtSeconds = Number.isFinite(input.dtSeconds) && input.dtSeconds > 0.0001
    ? input.dtSeconds
    : 0.02;
  const validBattery = Number.isFinite(input.batteryVolts) && input.batteryVolts > 0.1;
  const active = validBattery && Math.abs(targetVelocityMps) >= 0.0001;
  const accelerationMps2 = active ? (targetVelocityMps - previousTargetVelocityMps) / usedDtSeconds : 0;
  const staticTerm = active ? Math.sign(targetVelocityMps) * finiteOrZero(input.kS) : 0;
  const velocityTerm = active ? targetVelocityMps * finiteOrZero(input.kV) : 0;
  const accelerationTerm = active ? accelerationMps2 * finiteOrZero(input.kA) : 0;
  const rawRequest = staticTerm + velocityTerm + accelerationTerm;
  const voltageCompensationFactor = validBattery ? 12 / input.batteryVolts : 0;
  const unclampedOutput = rawRequest * voltageCompensationFactor;
  const output = Math.min(1, Math.max(-1, unclampedOutput));

  return {
    targetVelocityMps,
    previousTargetVelocityMps,
    maxWheelSpeedMps,
    usedDtSeconds,
    accelerationMps2,
    staticTerm,
    velocityTerm,
    accelerationTerm,
    rawRequest,
    voltageCompensationFactor,
    unclampedOutput,
    output,
    saturated: Math.abs(unclampedOutput) > 1,
    failedClosed: !validBattery,
  };
}

const PRESET_ROWS: readonly [string, number, number, number][] = [
  ["Stopped", 0, 0, 12],
  ["Start step", 1, 0, 12],
  ["Lower voltage", 1, 1, 9],
  ["Invalid battery", 1, 1, 0],
];

export default function FeedforwardTermLab() {
  const [input, setInput] = useState<FeedforwardStepInput>(DEFAULT_INPUT);
  const result = useMemo(() => calculateFeedforwardStep(input), [input]);

  const setNumber = (field: keyof FeedforwardStepInput, value: number) => {
    if (Number.isFinite(value)) setInput((current) => ({ ...current, [field]: value }));
  };

  return (
    <AcademyLabShell
      titleId="feedforward-term-title"
      title="Feedforward Term Trace"
      description="Trace one wheel with the checked-in Team 23247 profile from ARES 13.0.0."
      onReset={() => setInput(DEFAULT_INPUT)}
      resetLabel="Reset trace"
    >
      <p className="mt-4 border-l-4 border-ares-red/70 bg-ares-red/10 p-3 text-sm leading-relaxed text-white">
        <strong>Open source-contract question:</strong> Drivebase files label these values as volts.
        Runtime code treats their sum like a duty request, multiplies it by 12 ÷ battery, and then
        clamps it. This lab therefore says <strong>request units</strong>.
      </p>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="grid content-start gap-5 rounded-lg border border-white/10 bg-white/5 p-4">
          <fieldset className="grid gap-3">
            <legend className="text-sm font-bold text-ares-gold">Checked-in profile values</legend>
            <div className="grid gap-3 sm:grid-cols-3">
              {PROFILE_FIELDS.map(([id, label, key, min, max, step]) => (
                <AcademyNumberControl
                  key={id}
                  id={id}
                  label={label}
                  value={input[key]}
                  min={min}
                  max={max}
                  step={step}
                  onChange={(value) => setNumber(key, value)}
                />
              ))}
            </div>
          </fieldset>

          <fieldset className="grid gap-3">
            <legend className="text-sm font-bold text-ares-gold">One loop step</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              {STEP_FIELDS.map(([id, label, unit, key, min, max, step]) => (
                <AcademyNumberControl
                  key={id}
                  id={id}
                  label={label}
                  unit={unit}
                  value={input[key]}
                  min={min ?? -result.maxWheelSpeedMps}
                  max={max ?? result.maxWheelSpeedMps}
                  step={step}
                  onChange={(value) => setNumber(key, value)}
                />
              ))}
            </div>
          </fieldset>

          <fieldset className="grid gap-2">
            <legend className="text-sm font-bold text-ares-gold">Trace presets</legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {PRESET_ROWS.map(([label, targetVelocityMps, previousTargetVelocityMps, batteryVolts]) => (
                <button
                  key={label}
                  type="button"
                  onClick={() =>
                    setInput((current) => ({
                      ...current,
                      targetVelocityMps,
                      previousTargetVelocityMps,
                      batteryVolts,
                    }))
                  }
                  className={buttonClass}
                >
                  {label}
                </button>
              ))}
            </div>
          </fieldset>
        </div>

        <div className="rounded-lg border border-white/10 bg-obsidian p-4">
          <h4 className="text-sm font-bold uppercase tracking-wider text-ares-gold">
            Feedforward-only result
          </h4>
          <p role="status" aria-live="polite" className="mt-4 rounded border border-ares-cyan/30 bg-ares-cyan/10 p-3 text-sm font-bold text-white">
            {result.failedClosed
              ? "The source path rejects this battery input and leaves output at zero."
              : result.saturated
                ? "The calculated request is outside the duty-cycle range, so the source clamps it."
                : "The calculated request stays inside the duty-cycle range."}
          </p>
          <dl className="mt-4 grid gap-3 sm:grid-cols-2">
            {(
              [
                ["Speed cap used", result.maxWheelSpeedMps, " m/s"],
                ["Target used", result.targetVelocityMps, " m/s"],
                ["Prior target used", result.previousTargetVelocityMps, " m/s"],
                ["Loop time used", result.usedDtSeconds, " s"],
                ["Acceleration", result.accelerationMps2, " m/s²"],
                ["Static term", result.staticTerm, ""],
                ["Velocity term", result.velocityTerm, ""],
                ["Acceleration term", result.accelerationTerm, ""],
                ["Raw request", result.rawRequest, ""],
                ["12 V ÷ battery", result.voltageCompensationFactor, ""],
                ["Before final clamp", result.unclampedOutput, ""],
                ["Final duty request", result.output, ""],
              ] as const
            ).map(([label, value, unit]) => (
              <AcademyMetric key={label} label={label} value={`${format(value)}${unit}`} />
            ))}
          </dl>
        </div>
      </div>

      <AcademyModelLimit>
        This TypeScript trace copies one feedforward calculation and
        the controller's positive-kV speed-cap rule. An invalid kV keeps the checked-in cap as the
        known prior value. The trace does not run Kotlin, add feedback, slew, current limits, or
        hardware scaling, model a motor, read the robot, prove the profile, or approve physical use.
      </AcademyModelLimit>
    </AcademyLabShell>
  );
}

type FieldKey = keyof FeedforwardStepInput;

const PROFILE_FIELDS: readonly [string, string, FieldKey, number, number, number][] = [
  ["feedforward-ks", "kS source value", "kS", 0, 1, 0.01],
  ["feedforward-kv", "kV source value", "kV", 0.1, 2, 0.001],
  ["feedforward-ka", "kA source value", "kA", 0, 0.5, 0.01],
];

const STEP_FIELDS: readonly [string, string, string, FieldKey, number | null, number | null, number][] = [
  ["feedforward-target", "Target wheel speed", "m/s", "targetVelocityMps", null, null, 0.1],
  ["feedforward-previous", "Previous target speed", "m/s", "previousTargetVelocityMps", null, null, 0.1],
  ["feedforward-dt", "Loop time", "s", "dtSeconds", 0.01, 0.1, 0.01],
  ["feedforward-battery", "Battery input", "V", "batteryVolts", 0, 13.5, 0.1],
];

function format(value: number): string {
  return Number.isFinite(value) ? value.toFixed(3) : "0.000";
}

const buttonClass = "min-h-11 rounded border border-white/20 px-3 py-2 text-sm font-bold text-white hover:border-ares-cyan focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan";
