/** @sim {"name":"Mechanism Ratio Explorer","requiresContext":false,"academyApproved":true,"fidelity":"conceptual"} */
import { useMemo, useState } from "react";
import { RotateCcw } from "lucide-react";

const DEFAULTS = { driverTeeth: 20, drivenTeeth: 40, inputSpeed: 100 } as const;

export function calculateMechanismRatio(driverTeeth: number, drivenTeeth: number, inputSpeed: number) {
  return {
    outputTurnsPerInputTurn: driverTeeth / drivenTeeth,
    idealTorqueMultiplier: drivenTeeth / driverTeeth,
    outputSpeed: inputSpeed * driverTeeth / drivenTeeth,
  };
}

export default function MechanismRatioExplorer() {
  const [driverTeeth, setDriverTeeth] = useState<number>(DEFAULTS.driverTeeth);
  const [drivenTeeth, setDrivenTeeth] = useState<number>(DEFAULTS.drivenTeeth);
  const [inputSpeed, setInputSpeed] = useState<number>(DEFAULTS.inputSpeed);
  const result = useMemo(
    () => calculateMechanismRatio(driverTeeth, drivenTeeth, inputSpeed),
    [driverTeeth, drivenTeeth, inputSpeed],
  );

  const reset = () => {
    setDriverTeeth(DEFAULTS.driverTeeth);
    setDrivenTeeth(DEFAULTS.drivenTeeth);
    setInputSpeed(DEFAULTS.inputSpeed);
  };

  return (
    <section aria-labelledby="mechanism-ratio-title" className="my-8 rounded-xl border border-ares-cyan/30 bg-black/35 p-4 sm:p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-ares-cyan">Concept model</p>
          <h3 id="mechanism-ratio-title" className="mt-1 text-xl font-black text-white">Mechanism Ratio Explorer</h3>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-marble/80">
            Change the two gear sizes and the input speed. Watch how a larger driven gear trades speed for ideal torque.
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
        <fieldset className="grid gap-5 rounded-lg border border-white/10 bg-white/5 p-4">
          <legend className="px-2 text-sm font-bold text-ares-gold">Choose the mechanism</legend>
          <NumberControl label="Driver gear teeth" value={driverTeeth} min={10} max={80} onChange={setDriverTeeth} />
          <NumberControl label="Driven gear teeth" value={drivenTeeth} min={10} max={80} onChange={setDrivenTeeth} />
          <NumberControl label="Driver speed in RPM" value={inputSpeed} min={10} max={600} step={10} onChange={setInputSpeed} />
        </fieldset>

        <div className="rounded-lg border border-white/10 bg-obsidian p-4" aria-live="polite" aria-atomic="true">
          <h4 className="text-sm font-bold uppercase tracking-wider text-ares-gold">Calculated result</h4>
          <dl className="mt-4 grid gap-4">
            <Result label="Output speed" value={`${result.outputSpeed.toFixed(1)} RPM`} />
            <Result label="Output turns per input turn" value={result.outputTurnsPerInputTurn.toFixed(2)} />
            <Result label="Ideal torque multiplier" value={`${result.idealTorqueMultiplier.toFixed(2)}×`} />
          </dl>
          <p className="mt-5 text-sm leading-relaxed text-marble/80">
            A {driverTeeth}-tooth driver turning a {drivenTeeth}-tooth gear makes the output turn at {result.outputTurnsPerInputTurn.toFixed(2)} times the input speed.
          </p>
        </div>
      </div>

      <p role="note" className="mt-5 border-l-4 border-ares-gold/60 bg-ares-gold/10 p-3 text-sm leading-relaxed text-white">
        <strong>Model limit:</strong> This ideal model ignores friction, gear strength, motor limits, backlash, and battery voltage. It helps compare ratios; it does not prove a real mechanism is safe or strong enough.
      </p>
    </section>
  );
}

function NumberControl({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  const id = label.toLowerCase().replace(/[^a-z0-9]+/gu, "-");
  return (
    <div className="grid gap-2">
      <label htmlFor={id} className="flex items-center justify-between gap-3 text-sm font-semibold text-white">
        <span>{label}</span>
        <output htmlFor={id} className="font-mono text-ares-cyan">{value}</output>
      </label>
      <input
        id={id}
        aria-label={label}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.currentTarget.value))}
        className="min-h-11 w-full cursor-pointer accent-ares-red"
      />
    </div>
  );
}

function Result({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-3 border-b border-white/10 pb-2">
      <dt className="text-sm text-marble/70">{label}</dt>
      <dd className="font-mono text-lg font-bold text-white">{value}</dd>
    </div>
  );
}
