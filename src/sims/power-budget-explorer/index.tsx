/** @sim {"name":"Power Budget Explorer","requiresContext":false,"academyApproved":true,"fidelity":"conceptual"} */
import { useMemo, useState } from "react";
import {
  AcademyLabShell,
  AcademyMetric,
  AcademyModelLimit,
  AcademyRangeControl,
} from "@/sims/shared/academy-interaction-ui";

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
    <AcademyLabShell
      titleId="power-budget-title"
      title="Power Budget Explorer"
      eyebrow="Lesson-only values"
      description="Combine three example currents. See how voltage, current, time, power, and energy relate."
      onReset={reset}
    >
      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,0.8fr)]">
        <fieldset className="grid gap-4 rounded-lg border border-white/10 bg-white/5 p-4">
          <legend className="px-2 text-sm font-bold text-ares-gold">Change the example</legend>
          <AcademyRangeControl label="Voltage" unit="V" value={voltage} min={6} max={16} step={0.5} decimals={1} onChange={setVoltage} />
          <AcademyRangeControl label="Drive current" unit="A" value={driveCurrent} min={0} max={20} step={1} decimals={0} onChange={setDriveCurrent} />
          <AcademyRangeControl label="Mechanism current" unit="A" value={mechanismCurrent} min={0} max={20} step={1} decimals={0} onChange={setMechanismCurrent} />
          <AcademyRangeControl label="Controls current" unit="A" value={controlsCurrent} min={0} max={10} step={1} decimals={0} onChange={setControlsCurrent} />
          <AcademyRangeControl label="Time" unit="min" value={minutes} min={1} max={15} step={1} decimals={0} onChange={setMinutes} />
        </fieldset>

        <div aria-live="polite" aria-atomic="true" className="rounded-lg border border-white/10 bg-obsidian p-4">
          <h4 className="text-sm font-bold uppercase tracking-wider text-ares-gold">Ideal calculation</h4>
          <dl className="mt-4 grid gap-4">
            <AcademyMetric label="Total current" value={`${result.totalCurrent.toFixed(1)} A`} />
            <AcademyMetric label="Electrical power" value={`${result.powerWatts.toFixed(1)} W`} />
            <AcademyMetric label="Energy for selected time" value={`${result.energyWattHours.toFixed(1)} Wh`} />
          </dl>
          <p className="mt-5 text-sm leading-relaxed text-marble/80">
            {voltage.toFixed(1)} volts times {result.totalCurrent.toFixed(1)} amps equals {result.powerWatts.toFixed(1)} watts.
          </p>
        </div>
      </div>

      <AcademyModelLimit>
        These are invented lesson values, not team measurements or component ratings. The model leaves out voltage sag, stall current, wire loss, heat, protection devices, and battery limits. Never use it to approve a real electrical system.
      </AcademyModelLimit>
    </AcademyLabShell>
  );
}
