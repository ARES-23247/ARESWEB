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

  if (!validBattery) {
    return {
      targetVelocityMps,
      previousTargetVelocityMps,
      maxWheelSpeedMps,
      usedDtSeconds,
      accelerationMps2: 0,
      staticTerm: 0,
      velocityTerm: 0,
      accelerationTerm: 0,
      rawRequest: 0,
      voltageCompensationFactor: 0,
      unclampedOutput: 0,
      output: 0,
      saturated: false,
      failedClosed: true,
    };
  }

  if (Math.abs(targetVelocityMps) < 0.0001) {
    return {
      targetVelocityMps,
      previousTargetVelocityMps,
      maxWheelSpeedMps,
      usedDtSeconds,
      accelerationMps2: 0,
      staticTerm: 0,
      velocityTerm: 0,
      accelerationTerm: 0,
      rawRequest: 0,
      voltageCompensationFactor: 12 / input.batteryVolts,
      unclampedOutput: 0,
      output: 0,
      saturated: false,
      failedClosed: false,
    };
  }

  const accelerationMps2 = (targetVelocityMps - previousTargetVelocityMps) / usedDtSeconds;
  const staticTerm = Math.sign(targetVelocityMps) * finiteOrZero(input.kS);
  const velocityTerm = targetVelocityMps * finiteOrZero(input.kV);
  const accelerationTerm = accelerationMps2 * finiteOrZero(input.kA);
  const rawRequest = staticTerm + velocityTerm + accelerationTerm;
  const voltageCompensationFactor = 12 / input.batteryVolts;
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
    failedClosed: false,
  };
}

type PresetName = "stop" | "start" | "low" | "invalid";

const PRESETS: Record<PresetName, Pick<FeedforwardStepInput, "targetVelocityMps" | "previousTargetVelocityMps" | "batteryVolts">> = {
  stop: { targetVelocityMps: 0, previousTargetVelocityMps: 0, batteryVolts: 12 },
  start: { targetVelocityMps: 1, previousTargetVelocityMps: 0, batteryVolts: 12 },
  low: { targetVelocityMps: 1, previousTargetVelocityMps: 1, batteryVolts: 9 },
  invalid: { targetVelocityMps: 1, previousTargetVelocityMps: 1, batteryVolts: 0 },
};

export default function FeedforwardTermLab() {
  const [input, setInput] = useState<FeedforwardStepInput>(DEFAULT_INPUT);
  const result = useMemo(() => calculateFeedforwardStep(input), [input]);

  const setNumber = (field: keyof FeedforwardStepInput, value: number) => {
    if (Number.isFinite(value)) setInput((current) => ({ ...current, [field]: value }));
  };

  const applyPreset = (preset: PresetName) => {
    setInput((current) => ({ ...current, ...PRESETS[preset] }));
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
              <AcademyNumberControl id="feedforward-ks" label="kS source value" value={input.kS} min={0} max={1} step={0.01} onChange={(value) => setNumber("kS", value)} />
              <AcademyNumberControl id="feedforward-kv" label="kV source value" value={input.kV} min={0.1} max={2} step={0.001} onChange={(value) => setNumber("kV", value)} />
              <AcademyNumberControl id="feedforward-ka" label="kA source value" value={input.kA} min={0} max={0.5} step={0.01} onChange={(value) => setNumber("kA", value)} />
            </div>
          </fieldset>

          <fieldset className="grid gap-3">
            <legend className="text-sm font-bold text-ares-gold">One loop step</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              <AcademyNumberControl id="feedforward-target" label="Target wheel speed" unit="m/s" value={input.targetVelocityMps} min={-result.maxWheelSpeedMps} max={result.maxWheelSpeedMps} step={0.1} onChange={(value) => setNumber("targetVelocityMps", value)} />
              <AcademyNumberControl id="feedforward-previous" label="Previous target speed" unit="m/s" value={input.previousTargetVelocityMps} min={-result.maxWheelSpeedMps} max={result.maxWheelSpeedMps} step={0.1} onChange={(value) => setNumber("previousTargetVelocityMps", value)} />
              <AcademyNumberControl id="feedforward-dt" label="Loop time" unit="s" value={input.dtSeconds} min={0.01} max={0.1} step={0.01} onChange={(value) => setNumber("dtSeconds", value)} />
              <AcademyNumberControl id="feedforward-battery" label="Battery input" unit="V" value={input.batteryVolts} min={0} max={13.5} step={0.1} onChange={(value) => setNumber("batteryVolts", value)} />
            </div>
          </fieldset>

          <fieldset className="grid gap-2">
            <legend className="text-sm font-bold text-ares-gold">Trace presets</legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <PresetButton label="Stopped" onClick={() => applyPreset("stop")} />
              <PresetButton label="Start step" onClick={() => applyPreset("start")} />
              <PresetButton label="Lower voltage" onClick={() => applyPreset("low")} />
              <PresetButton label="Invalid battery" onClick={() => applyPreset("invalid")} />
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
            <AcademyMetric label="Speed cap used" value={`${format(result.maxWheelSpeedMps)} m/s`} />
            <AcademyMetric label="Target used" value={`${format(result.targetVelocityMps)} m/s`} />
            <AcademyMetric label="Prior target used" value={`${format(result.previousTargetVelocityMps)} m/s`} />
            <AcademyMetric label="Loop time used" value={`${format(result.usedDtSeconds)} s`} />
            <AcademyMetric label="Acceleration" value={`${format(result.accelerationMps2)} m/s²`} />
            <AcademyMetric label="Static term" value={format(result.staticTerm)} />
            <AcademyMetric label="Velocity term" value={format(result.velocityTerm)} />
            <AcademyMetric label="Acceleration term" value={format(result.accelerationTerm)} />
            <AcademyMetric label="Raw request" value={format(result.rawRequest)} />
            <AcademyMetric label="12 V ÷ battery" value={format(result.voltageCompensationFactor)} />
            <AcademyMetric label="Before final clamp" value={format(result.unclampedOutput)} />
            <AcademyMetric label="Final duty request" value={format(result.output)} />
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

function PresetButton({ label, onClick }: { label: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={buttonClass}>{label}</button>;
}

function format(value: number): string {
  return Number.isFinite(value) ? value.toFixed(3) : "0.000";
}

const buttonClass = "min-h-11 rounded border border-white/20 px-3 py-2 text-sm font-bold text-white hover:border-ares-cyan focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan";
