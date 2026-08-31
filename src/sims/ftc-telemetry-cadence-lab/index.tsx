/** @sim {"name":"FTC Telemetry Cadence Lab","requiresContext":false,"academyApproved":true,"fidelity":"code-derived"} */
import { useId, useState } from "react";
import { AcademyLabShell, AcademyModelLimit } from "@/sims/shared/academy-interaction-ui";

const HELPER_PERIOD_MS = 100;
const DRIVER_STATION_PERIOD_MS = 250;
const DISPLAY_LIMIT = 150;
const LOOP_TIMES_MS = [1000, 1040, 1100, 1150, 1250, 1500] as const;

export type CadenceRow = {
  timeMs: number;
  helperRefreshed: boolean;
  helperGeneration: number;
  driverStationQueued: boolean;
  queuedGeneration: number | null;
};

export function buildTelemetryCadence(times: readonly number[]): CadenceRow[] {
  let lastHelperUpdateMs = 0;
  let lastDriverStationUpdateMs = 0;
  let helperGeneration = 0;

  return times.map((timeMs) => {
    const driverStationQueued = timeMs - lastDriverStationUpdateMs >= DRIVER_STATION_PERIOD_MS;
    const queuedGeneration = driverStationQueued && helperGeneration > 0 ? helperGeneration : null;
    if (driverStationQueued) lastDriverStationUpdateMs = timeMs;

    const helperRefreshed = timeMs - lastHelperUpdateMs >= HELPER_PERIOD_MS;
    if (helperRefreshed) {
      lastHelperUpdateMs = timeMs;
      helperGeneration += 1;
    }

    return {
      timeMs,
      helperRefreshed,
      helperGeneration,
      driverStationQueued,
      queuedGeneration,
    };
  });
}

export function batteryDisplay(voltage: number) {
  if (!Number.isFinite(voltage) || voltage <= 0) return "INVALID";
  if (voltage < 11.5) return `${voltage.toFixed(1)} V (LOW)`;
  return `${voltage.toFixed(1)} V`;
}

export function truncateDriverStationText(value: string) {
  return value.slice(0, DISPLAY_LIMIT);
}

const TRACE = buildTelemetryCadence(LOOP_TIMES_MS);
const BATTERY_OPTIONS = [
  ["12.4", "12.4 V — normal"],
  ["11.2", "11.2 V — low"],
  ["0", "0 V — invalid"],
  ["nan", "Not a number — invalid"],
] as const;

export default function FtcTelemetryCadenceLab() {
  const titleId = useId();
  const batteryId = `${titleId}-battery`;
  const [visibleSteps, setVisibleSteps] = useState(0);
  const [battery, setBattery] = useState("12.4");
  const visibleRows = TRACE.slice(0, visibleSteps);
  const parsedBattery = battery === "nan" ? Number.NaN : Number(battery);
  const lastRow = visibleRows.at(-1);

  const reset = () => {
    setVisibleSteps(0);
    setBattery("12.4");
  };

  return (
    <AcademyLabShell
      titleId={titleId}
      title="FTC Telemetry Cadence Lab"
      eyebrow="Code-derived timing model"
      description="Step through both telemetry gates without running a robot."
      onReset={reset}
    >
      <div className="mt-5 max-w-md">
        <div>
          <label htmlFor={batteryId} className="text-sm font-bold text-white">
            Battery sample
          </label>
          <select
            id={batteryId}
            aria-describedby={`${batteryId}-help`}
            value={battery}
            onChange={(event) => setBattery(event.currentTarget.value)}
            className={controlClass}
          >
            {BATTERY_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <span id={`${batteryId}-help`} className="mt-2 block text-sm font-normal text-marble/80">
            Display text: <strong className="text-white">{batteryDisplay(parsedBattery)}</strong>
          </span>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => setVisibleSteps((current) => Math.min(current + 1, TRACE.length))}
          disabled={visibleSteps >= TRACE.length}
          className="min-h-11 rounded bg-ares-red px-4 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
        >
          Advance one loop
        </button>
        <p role="status" aria-live="polite" className="min-h-11 flex-1 rounded border border-white/10 bg-obsidian px-3 py-2 text-sm leading-relaxed text-white">
          {!lastRow && "No loop has run. Advance once to inspect the two cadence gates."}
          {lastRow && `${lastRow.timeMs} ms: helper ${lastRow.helperRefreshed ? `refreshed generation ${lastRow.helperGeneration}` : "kept its prior summary"}; Driver Station ${lastRow.driverStationQueued ? (lastRow.queuedGeneration ? `queued generation ${lastRow.queuedGeneration}` : "queued before a season summary existed") : "did not queue a snapshot"}.`}
        </p>
      </div>

      <div className="mt-5 overflow-x-auto rounded border border-white/10">
        <table className="min-w-[42rem] w-full text-left text-sm text-white">
          <caption className="bg-white/5 p-3 text-left font-bold text-ares-gold">
            Shared snapshot runs before the season helper in each modeled robot frame
          </caption>
          <thead className="bg-obsidian">
            <tr>
              <th className="p-3">Robot time</th>
              <th className="p-3">Driver Station gate</th>
              <th className="p-3">Season helper gate</th>
              <th className="p-3">Latest summary after frame</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row) => (
              <tr key={row.timeMs} className="border-t border-white/10">
                <td className="p-3 font-mono">{row.timeMs} ms</td>
                <td className="p-3">{row.driverStationQueued ? (row.queuedGeneration ? `Queued generation ${row.queuedGeneration}` : "Queued built-in fields only") : "Skipped"}</td>
                <td className="p-3">{row.helperRefreshed ? "Refreshed" : "Skipped"}</td>
                <td className="p-3">Generation {row.helperGeneration}</td>
              </tr>
            ))}
            {visibleRows.length === 0 && (
              <tr><td colSpan={4} className="p-4 text-marble/70">Advance the model to add a row.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <AcademyModelLimit>
        This deterministic table follows the pinned call order and cadence constants. It does not
        model thread scheduling, queue pressure, Wi-Fi delay, NT4 delivery, a real control loop, or
        physical robot behavior. The selected sample is not sent or saved.
      </AcademyModelLimit>
    </AcademyLabShell>
  );
}

const controlClass = "mt-2 min-h-11 w-full rounded border border-white/20 bg-obsidian px-3 py-2 font-normal text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan";
