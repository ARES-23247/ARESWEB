/** @sim {"name":"Mechanism Motion Explorer","requiresContext":false,"academyApproved":true,"fidelity":"conceptual"} */
import { useMemo, useState } from "react";
import { RotateCcw } from "lucide-react";

export type MechanismKind = "arm" | "elevator" | "roller";

export type MechanismMotionResult =
  | { valid: false; reason: string }
  | {
      valid: true;
      mechanismTurns: number;
      idealTorqueMultiplier: number;
      primaryLabel: string;
      primaryValue: number;
      primaryUnit: "degrees" | "meters";
    };

const DEFAULTS = {
  kind: "arm" as MechanismKind,
  motorTurns: 2,
  motorTurnsPerMechanismTurn: 4,
  radiusMeters: 0.04,
};

export function calculateMechanismMotion(
  kind: MechanismKind,
  motorTurns: number,
  motorTurnsPerMechanismTurn: number,
  radiusMeters: number,
): MechanismMotionResult {
  if (![motorTurns, motorTurnsPerMechanismTurn, radiusMeters].every(Number.isFinite)) {
    return { valid: false, reason: "Every input must be a finite number." };
  }
  if (motorTurnsPerMechanismTurn <= 0) {
    return { valid: false, reason: "The ratio must be greater than zero." };
  }
  if (radiusMeters <= 0) {
    return { valid: false, reason: "The radius must be greater than zero." };
  }

  const mechanismTurns = motorTurns / motorTurnsPerMechanismTurn;
  const common = {
    valid: true as const,
    mechanismTurns,
    idealTorqueMultiplier: motorTurnsPerMechanismTurn,
  };

  if (kind === "arm") {
    return {
      ...common,
      primaryLabel: "Ideal arm angle change",
      primaryValue: mechanismTurns * 360,
      primaryUnit: "degrees",
    };
  }

  return {
    ...common,
    primaryLabel: kind === "elevator" ? "Ideal elevator travel" : "Ideal roller surface travel",
    primaryValue: mechanismTurns * 2 * Math.PI * radiusMeters,
    primaryUnit: "meters",
  };
}

export default function MechanismMotionExplorer() {
  const [kind, setKind] = useState<MechanismKind>(DEFAULTS.kind);
  const [motorTurns, setMotorTurns] = useState(DEFAULTS.motorTurns);
  const [ratio, setRatio] = useState(DEFAULTS.motorTurnsPerMechanismTurn);
  const [radius, setRadius] = useState(DEFAULTS.radiusMeters);
  const result = useMemo(
    () => calculateMechanismMotion(kind, motorTurns, ratio, radius),
    [kind, motorTurns, ratio, radius],
  );

  const reset = () => {
    setKind(DEFAULTS.kind);
    setMotorTurns(DEFAULTS.motorTurns);
    setRatio(DEFAULTS.motorTurnsPerMechanismTurn);
    setRadius(DEFAULTS.radiusMeters);
  };

  return (
    <section aria-labelledby="mechanism-motion-title" className="my-8 rounded-xl border border-ares-cyan/30 bg-black/35 p-4 sm:p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-ares-cyan">Concept model</p>
          <h3 id="mechanism-motion-title" className="mt-1 text-xl font-black text-white">Mechanism Motion Explorer</h3>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-marble/80">
            Apply one ideal ratio to an arm, elevator, or roller. Compare output motion before you choose or test real hardware.
          </p>
        </div>
        <button
          type="button"
          onClick={reset}
          className="mt-2 inline-flex min-h-11 items-center justify-center gap-2 rounded border border-white/20 px-4 py-2 text-sm font-bold text-white hover:border-ares-cyan focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan sm:mt-0"
        >
          <RotateCcw aria-hidden="true" size={16} /> Reset
        </button>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,0.8fr)]">
        <fieldset className="grid gap-4 rounded-lg border border-white/10 bg-white/5 p-4">
          <legend className="px-2 text-sm font-bold text-ares-gold">Describe the ideal motion</legend>
          <label className="grid gap-2 text-sm font-semibold text-white">
            Mechanism type
            <select
              value={kind}
              onChange={(event) => setKind(event.currentTarget.value as MechanismKind)}
              className="min-h-11 rounded border border-white/20 bg-obsidian px-3 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
            >
              <option value="arm">Arm</option>
              <option value="elevator">Elevator</option>
              <option value="roller">Intake roller</option>
            </select>
          </label>
          <NumberInput label="Motor rotations" value={motorTurns} min={0} step={0.25} onChange={setMotorTurns} />
          <NumberInput label="Motor rotations per mechanism rotation" value={ratio} min={0.25} step={0.25} onChange={setRatio} />
          <NumberInput
            label="Output radius in meters"
            value={radius}
            min={0.01}
            step={0.01}
            onChange={setRadius}
            hint={kind === "arm" ? "The simple arm-angle result does not use radius." : "Measure from the output axis to the cable or contact surface."}
          />
        </fieldset>

        <div className="rounded-lg border border-white/10 bg-obsidian p-4" aria-live="polite" aria-atomic="true">
          <h4 className="text-sm font-bold uppercase tracking-wider text-ares-gold">Calculated result</h4>
          {result.valid ? (
            <>
              <dl className="mt-4 grid gap-4">
                <Result label="Mechanism rotations" value={result.mechanismTurns.toFixed(2)} />
                <Result label={result.primaryLabel} value={`${result.primaryValue.toFixed(2)} ${result.primaryUnit}`} />
                <Result label="Ideal torque multiplier" value={`${result.idealTorqueMultiplier.toFixed(2)}×`} />
              </dl>
              <p className="mt-5 text-sm leading-relaxed text-marble/80">
                {motorTurns.toFixed(2)} motor rotations become {result.mechanismTurns.toFixed(2)} ideal mechanism rotations at a {ratio.toFixed(2)}:1 reduction.
              </p>
            </>
          ) : (
            <p role="alert" className="mt-4 border-l-4 border-ares-red bg-ares-red/10 p-3 text-sm text-white">{result.reason}</p>
          )}
        </div>
      </div>

      <p role="note" className="mt-5 border-l-4 border-ares-gold/60 bg-ares-gold/10 p-3 text-sm leading-relaxed text-white">
        <strong>Model limit:</strong> This ideal model ignores gravity, load, friction, efficiency, backlash, flex, slip, acceleration, motor limits, linkage geometry, and hard stops. It cannot choose hardware, check clearance, command a robot, or prove safe motion.
      </p>
    </section>
  );
}

function NumberInput({
  label,
  value,
  min,
  step,
  hint,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  step: number;
  hint?: string;
  onChange: (value: number) => void;
}) {
  const id = label.toLowerCase().replace(/[^a-z0-9]+/gu, "-");
  return (
    <label htmlFor={id} className="grid gap-2 text-sm font-semibold text-white">
      {label}
      <input
        id={id}
        type="number"
        inputMode="decimal"
        min={min}
        step={step}
        value={value}
        onChange={(event) => onChange(event.currentTarget.valueAsNumber)}
        className="min-h-11 rounded border border-white/20 bg-obsidian px-3 font-mono text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
      />
      {hint ? <span className="text-xs font-normal leading-relaxed text-marble/70">{hint}</span> : null}
    </label>
  );
}

function Result({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-3 border-b border-white/10 pb-2">
      <dt className="text-sm text-marble/70">{label}</dt>
      <dd className="text-right font-mono text-lg font-bold text-white">{value}</dd>
    </div>
  );
}
