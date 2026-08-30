/** @sim {"name":"ARES FTC Feedforward Term Trace","requiresContext":false,"academyApproved":true,"fidelity":"code-derived"} */
import { useMemo, useState } from "react";

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

export const MAX_WHEEL_SPEED_MPS = 3.5;

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

export function calculateFeedforwardStep(input: FeedforwardStepInput): FeedforwardStepResult {
  const targetVelocityMps = Number.isFinite(input.targetVelocityMps)
    ? Math.min(MAX_WHEEL_SPEED_MPS, Math.max(-MAX_WHEEL_SPEED_MPS, input.targetVelocityMps))
    : 0;
  const previousTargetVelocityMps = finiteOrZero(input.previousTargetVelocityMps);
  const usedDtSeconds = Number.isFinite(input.dtSeconds) && input.dtSeconds > 0.0001
    ? input.dtSeconds
    : 0.02;
  const validBattery = Number.isFinite(input.batteryVolts) && input.batteryVolts > 0.1;

  if (!validBattery) {
    return {
      targetVelocityMps,
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

type PresetName = "stop" | "start" | "low";

const PRESETS: Record<PresetName, Pick<FeedforwardStepInput, "targetVelocityMps" | "previousTargetVelocityMps" | "batteryVolts">> = {
  stop: { targetVelocityMps: 0, previousTargetVelocityMps: 0, batteryVolts: 12 },
  start: { targetVelocityMps: 1, previousTargetVelocityMps: 0, batteryVolts: 12 },
  low: { targetVelocityMps: 1, previousTargetVelocityMps: 1, batteryVolts: 9 },
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
    <section
      aria-labelledby="feedforward-term-title"
      className="my-8 rounded-xl border border-ares-cyan/30 bg-black/35 p-4 sm:p-6"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 id="feedforward-term-title" className="text-xl font-black text-white">
            Feedforward Term Trace
          </h3>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-marble/80">
            Trace one wheel with the checked-in Team 23247 profile.
          </p>
        </div>
        <button type="button" onClick={() => setInput(DEFAULT_INPUT)} className={buttonClass}>
          Reset trace
        </button>
      </div>

      <p className="mt-4 border-l-4 border-ares-red/70 bg-ares-red/10 p-3 text-sm leading-relaxed text-white">
        <strong>Open source-contract question:</strong> Declarations say volts, but runtime code
        combines request terms before clamping. This lab says <strong>request units</strong>.
      </p>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="grid content-start gap-5 rounded-lg border border-white/10 bg-white/5 p-4">
          <fieldset className="grid gap-3">
            <legend className="text-sm font-bold text-ares-gold">Checked-in profile values</legend>
            <div className="grid gap-3 sm:grid-cols-3">
              <NumberInput label="kS source value" value={input.kS} min={0} max={1} step={0.01} onChange={(value) => setNumber("kS", value)} />
              <NumberInput label="kV source value" value={input.kV} min={0} max={2} step={0.001} onChange={(value) => setNumber("kV", value)} />
              <NumberInput label="kA source value" value={input.kA} min={0} max={0.5} step={0.01} onChange={(value) => setNumber("kA", value)} />
            </div>
          </fieldset>

          <fieldset className="grid gap-3">
            <legend className="text-sm font-bold text-ares-gold">One loop step</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              <NumberInput label="Target wheel speed" unit="m/s" value={input.targetVelocityMps} min={-3.5} max={3.5} step={0.1} onChange={(value) => setNumber("targetVelocityMps", value)} />
              <NumberInput label="Previous target speed" unit="m/s" value={input.previousTargetVelocityMps} min={-3.5} max={3.5} step={0.1} onChange={(value) => setNumber("previousTargetVelocityMps", value)} />
              <NumberInput label="Loop time" unit="s" value={input.dtSeconds} min={0.01} max={0.1} step={0.01} onChange={(value) => setNumber("dtSeconds", value)} />
              <NumberInput label="Battery input" unit="V" value={input.batteryVolts} min={7.5} max={13.5} step={0.1} onChange={(value) => setNumber("batteryVolts", value)} />
            </div>
          </fieldset>

          <fieldset className="grid gap-2">
            <legend className="text-sm font-bold text-ares-gold">Trace presets</legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <PresetButton label="Stopped" onClick={() => applyPreset("stop")} />
              <PresetButton label="Start step" onClick={() => applyPreset("start")} />
              <PresetButton label="Lower voltage" onClick={() => applyPreset("low")} />
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
            <Result label="Target used" value={`${format(result.targetVelocityMps)} m/s`} />
            <Result label="Acceleration" value={`${format(result.accelerationMps2)} m/s²`} />
            <Result label="Static term" value={format(result.staticTerm)} />
            <Result label="Velocity term" value={format(result.velocityTerm)} />
            <Result label="Acceleration term" value={format(result.accelerationTerm)} />
            <Result label="Raw request" value={format(result.rawRequest)} />
            <Result label="12 V ÷ battery" value={format(result.voltageCompensationFactor)} />
            <Result label="Final duty request" value={format(result.output)} />
          </dl>
        </div>
      </div>

      <p role="note" className="mt-5 border-l-4 border-ares-gold/60 bg-ares-gold/10 p-3 text-sm leading-relaxed text-white">
        <strong>Model limit:</strong> This TypeScript trace does not run Kotlin, add feedback, slew,
        or current limits, model a motor, read the robot, prove the profile, or approve physical use.
      </p>
    </section>
  );
}

function NumberInput({ label, unit, value, min, max, step, onChange }: {
  label: string;
  unit?: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  const id = `feedforward-${label.toLowerCase().replace(/[^a-z0-9]+/gu, "-")}`;
  return (
    <label htmlFor={id} className="grid gap-2 text-sm font-bold text-white">
      {label}
      <span className="flex items-center gap-2">
        <input
          id={id}
          type="number"
          inputMode="decimal"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={(event) => onChange(event.currentTarget.valueAsNumber)}
          className="min-h-11 min-w-0 flex-1 rounded border border-white/20 bg-obsidian px-3 font-mono text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
        />
        {unit && <span aria-hidden="true" className="text-xs text-marble/70">{unit}</span>}
      </span>
    </label>
  );
}

function PresetButton({ label, onClick }: { label: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={buttonClass}>{label}</button>;
}

function Result({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-white/10 p-3">
      <dt className="text-xs uppercase tracking-wide text-marble/70">{label}</dt>
      <dd className="mt-1 break-words font-mono font-bold text-white">{value}</dd>
    </div>
  );
}

function format(value: number): string {
  return Number.isFinite(value) ? value.toFixed(3) : "0.000";
}

const buttonClass = "min-h-11 rounded border border-white/20 px-3 py-2 text-sm font-bold text-white hover:border-ares-cyan focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan";
