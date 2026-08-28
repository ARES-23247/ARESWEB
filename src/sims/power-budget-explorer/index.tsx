/** @sim {"name":"Power Budget Explorer","requiresContext":false,"academyApproved":true,"fidelity":"conceptual"} */
import { useMemo, useState } from "react";
import { RotateCcw } from "lucide-react";

const DEFAULTS = { voltage: 12, driveCurrent: 8, mechanismCurrent: 4, controlsCurrent: 1, minutes: 5 } as const;

export function calculatePowerBudget(voltage: number, currents: number[], minutes: number) {
  const totalCurrent = currents.reduce((sum, current) => sum + current, 0);
  const powerWatts = voltage * totalCurrent;
  return { totalCurrent, powerWatts, energyWattHours: powerWatts * minutes / 60 };
}

export default function PowerBudgetExplorer() {
  const [voltage, setVoltage] = useState<number>(DEFAULTS.voltage);
  const [driveCurrent, setDriveCurrent] = useState<number>(DEFAULTS.driveCurrent);
  const [mechanismCurrent, setMechanismCurrent] = useState<number>(DEFAULTS.mechanismCurrent);
  const [controlsCurrent, setControlsCurrent] = useState<number>(DEFAULTS.controlsCurrent);
  const [minutes, setMinutes] = useState<number>(DEFAULTS.minutes);
  const result = useMemo(
    () => calculatePowerBudget(voltage, [driveCurrent, mechanismCurrent, controlsCurrent], minutes),
    [voltage, driveCurrent, mechanismCurrent, controlsCurrent, minutes],
  );
  const reset = () => {
    setVoltage(DEFAULTS.voltage);
    setDriveCurrent(DEFAULTS.driveCurrent);
    setMechanismCurrent(DEFAULTS.mechanismCurrent);
    setControlsCurrent(DEFAULTS.controlsCurrent);
    setMinutes(DEFAULTS.minutes);
  };

  return (
    <section aria-labelledby="power-budget-title" className="my-8 rounded-xl border border-ares-cyan/30 bg-black/35 p-4 sm:p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-ares-cyan">Lesson-only values</p>
          <h3 id="power-budget-title" className="mt-1 text-xl font-black text-white">Power Budget Explorer</h3>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-marble/80">Combine three example currents. See how voltage, current, time, power, and energy relate.</p>
        </div>
        <button type="button" onClick={reset} className="mt-2 inline-flex min-h-11 items-center justify-center gap-2 rounded border border-white/20 px-4 py-2 text-sm font-bold text-white hover:border-ares-cyan focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan sm:mt-0">
          <RotateCcw aria-hidden="true" size={16} /> Reset
        </button>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,0.8fr)]">
        <fieldset className="grid gap-4 rounded-lg border border-white/10 bg-white/5 p-4">
          <legend className="px-2 text-sm font-bold text-ares-gold">Change the example</legend>
          <PowerControl label="Voltage" unit="V" value={voltage} min={6} max={16} step={0.5} onChange={setVoltage} />
          <PowerControl label="Drive current" unit="A" value={driveCurrent} min={0} max={20} onChange={setDriveCurrent} />
          <PowerControl label="Mechanism current" unit="A" value={mechanismCurrent} min={0} max={20} onChange={setMechanismCurrent} />
          <PowerControl label="Controls current" unit="A" value={controlsCurrent} min={0} max={10} onChange={setControlsCurrent} />
          <PowerControl label="Time" unit="min" value={minutes} min={1} max={15} onChange={setMinutes} />
        </fieldset>

        <div aria-live="polite" aria-atomic="true" className="rounded-lg border border-white/10 bg-obsidian p-4">
          <h4 className="text-sm font-bold uppercase tracking-wider text-ares-gold">Ideal calculation</h4>
          <dl className="mt-4 grid gap-4">
            <PowerResult label="Total current" value={`${result.totalCurrent.toFixed(1)} A`} />
            <PowerResult label="Electrical power" value={`${result.powerWatts.toFixed(1)} W`} />
            <PowerResult label="Energy for selected time" value={`${result.energyWattHours.toFixed(1)} Wh`} />
          </dl>
          <p className="mt-5 text-sm leading-relaxed text-marble/80">
            {voltage.toFixed(1)} volts times {result.totalCurrent.toFixed(1)} amps equals {result.powerWatts.toFixed(1)} watts.
          </p>
        </div>
      </div>

      <p role="note" className="mt-5 border-l-4 border-ares-gold/60 bg-ares-gold/10 p-3 text-sm leading-relaxed text-white">
        <strong>Model limit:</strong> These are invented lesson values, not team measurements or component ratings. The model leaves out voltage sag, stall current, wire loss, heat, protection devices, and battery limits. Never use it to approve a real electrical system.
      </p>
    </section>
  );
}

function PowerControl({ label, unit, value, min, max, step = 1, onChange }: {
  label: string;
  unit: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  const id = `power-${label.toLowerCase().replace(/[^a-z0-9]+/gu, "-")}`;
  return (
    <div className="grid gap-2">
      <label htmlFor={id} className="flex justify-between gap-3 text-sm font-semibold text-white"><span>{label}</span><output htmlFor={id} className="font-mono text-ares-cyan">{value} {unit}</output></label>
      <input id={id} aria-label={label} type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.currentTarget.value))} className="min-h-11 w-full cursor-pointer accent-ares-red" />
    </div>
  );
}

function PowerResult({ label, value }: { label: string; value: string }) {
  return <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-3 border-b border-white/10 pb-2"><dt className="text-sm text-marble/70">{label}</dt><dd className="font-mono text-lg font-bold text-white">{value}</dd></div>;
}
