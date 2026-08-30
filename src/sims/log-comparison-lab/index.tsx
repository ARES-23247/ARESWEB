/** @sim {"name":"Log Alignment and Comparison Lab","requiresContext":false,"academyApproved":true,"fidelity":"conceptual"} */
import { useMemo, useState } from "react";
import { ChartNoAxesCombined, RotateCcw } from "lucide-react";
import { AcademyModelLimit } from "@/sims/shared/academy-interaction-ui";

type Anchor = "RUN_START" | "SHARED_EVENT";
type Signal = "CURRENT" | "POSITION";

export type LogPoint = { time: number; value: number };
export type HeldSample = {
  point: LogPoint;
  ageMs: number;
  status: "EXACT" | "HELD";
};

type Comparison = {
  baseline: LogPoint[];
  incident: LogPoint[];
};

const BASELINE = { event: 40, current: [1, 2, 3, 2, 1], position: [0, 1, 2, 3, 4] };
const INCIDENT = { event: 60, current: [1, 2, 7, 10, 1], position: [0, 1, 1.2, 1.2, 1.2] };
const TIMES = [0, 20, 40, 60, 80];

export function compareSyntheticLogs(anchor: Anchor, signal: Signal): Comparison {
  const baselineValues = signal === "CURRENT" ? BASELINE.current : BASELINE.position;
  const incidentValues = signal === "CURRENT" ? INCIDENT.current : INCIDENT.position;
  const baselineShift = anchor === "SHARED_EVENT" ? BASELINE.event : 0;
  const incidentShift = anchor === "SHARED_EVENT" ? INCIDENT.event : 0;

  return {
    baseline: TIMES.map((time, index) => ({ time: time - baselineShift, value: baselineValues[index] })),
    incident: TIMES.map((time, index) => ({ time: time - incidentShift, value: incidentValues[index] })),
  };
}

export function sampleAtOrBefore(points: LogPoint[], playheadMs: number): HeldSample | null {
  const point = points.findLast((candidate) => candidate.time <= playheadMs);
  if (!point) return null;

  const ageMs = playheadMs - point.time;
  return {
    point,
    ageMs,
    status: ageMs === 0 ? "EXACT" : "HELD",
  };
}

export default function LogComparisonLab() {
  const [anchor, setAnchor] = useState<Anchor>("RUN_START");
  const [signal, setSignal] = useState<Signal>("CURRENT");
  const [playheadMs, setPlayheadMs] = useState(0);
  const comparison = useMemo(() => compareSyntheticLogs(anchor, signal), [anchor, signal]);
  const unit = signal === "CURRENT" ? "A" : "rad";
  const timeline = [...comparison.baseline, ...comparison.incident].map((point) => point.time);
  const minimumTime = Math.min(...timeline);
  const maximumTime = Math.max(...timeline);
  const baselineSample = sampleAtOrBefore(comparison.baseline, playheadMs);
  const incidentSample = sampleAtOrBefore(comparison.incident, playheadMs);
  const difference = baselineSample && incidentSample
    ? Math.abs(baselineSample.point.value - incidentSample.point.value)
    : null;

  const reset = () => {
    setAnchor("RUN_START");
    setSignal("CURRENT");
    setPlayheadMs(0);
  };

  const changeAnchor = (value: string) => {
    setAnchor(value as Anchor);
    setPlayheadMs(0);
  };

  return (
    <section aria-labelledby="log-comparison-title" className="my-8 rounded-xl border border-ares-cyan/30 bg-black/35 p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-ares-cyan">Synthetic run comparison</p>
          <h3 id="log-comparison-title" className="mt-1 text-xl font-black text-white">Log Alignment and Comparison Lab</h3>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-marble/80">
            Compare two tiny invented runs. Alignment moves timestamps. The evidence readout uses the newest sample at or before the selected time.
          </p>
        </div>
        <button
          type="button"
          onClick={reset}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded border border-white/20 px-4 py-2 text-sm font-bold text-white hover:border-ares-cyan focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
        >
          <RotateCcw aria-hidden="true" size={16} /> Reset
        </button>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <fieldset className="grid gap-4 rounded-lg border border-white/10 bg-white/5 p-4">
          <legend className="px-2 text-sm font-bold text-ares-gold">Comparison choices</legend>
          <SelectField
            id="log-anchor"
            label="Alignment anchor"
            value={anchor}
            options={["RUN_START", "SHARED_EVENT"]}
            onChange={changeAnchor}
          />
          <SelectField
            id="log-signal"
            label="One signal"
            value={signal}
            options={["CURRENT", "POSITION"]}
            onChange={(value) => setSignal(value as Signal)}
          />
          <div className="grid gap-2 text-sm font-bold text-white">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <label htmlFor="log-playhead">Evidence time relative to anchor</label>
              <output htmlFor="log-playhead" className="font-mono text-ares-cyan">{formatTime(playheadMs)}</output>
            </div>
            <input
              id="log-playhead"
              type="range"
              min={minimumTime}
              max={maximumTime}
              step={10}
              value={playheadMs}
              aria-describedby="log-playhead-help"
              aria-valuetext={formatTime(playheadMs)}
              onChange={(event) => setPlayheadMs(Number(event.currentTarget.value))}
              className="min-h-11 w-full accent-ares-cyan"
            />
          </div>
          <p id="log-playhead-help" className="text-xs leading-relaxed text-marble/70">
            Negative time is before the chosen anchor. Time zero is the anchor itself.
          </p>

          <div aria-live="polite" className="grid gap-3">
            <Datum label="Baseline evidence" value={formatSample(baselineSample, unit)} />
            <Datum label="Incident evidence" value={formatSample(incidentSample, unit)} />
            <Datum
              label="Difference at this evidence time"
              value={difference === null ? "Not comparable: one run has no earlier sample" : `${difference.toFixed(1)} ${unit}`}
            />
          </div>
        </fieldset>

        <div className="overflow-x-auto rounded-lg border border-white/10 bg-obsidian p-4">
          <h4 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-ares-gold">
            <ChartNoAxesCombined aria-hidden="true" size={18} /> Aligned evidence table
          </h4>
          <table className="mt-4 w-full min-w-96 border-collapse text-left text-sm text-white">
            <caption className="sr-only">Synthetic baseline and incident values after the selected alignment</caption>
            <thead>
              <tr>
                <th className="border-b border-white/20 p-2">Point</th>
                <th className="border-b border-white/20 p-2">Baseline time</th>
                <th className="border-b border-white/20 p-2">Baseline</th>
                <th className="border-b border-white/20 p-2">Incident time</th>
                <th className="border-b border-white/20 p-2">Incident</th>
              </tr>
            </thead>
            <tbody>
              {comparison.baseline.map((point, index) => (
                <tr key={point.time}>
                  <th scope="row" className="border-b border-white/10 p-2">{index + 1}</th>
                  <td className="border-b border-white/10 p-2 font-mono">{formatTime(point.time)}</td>
                  <td className="border-b border-white/10 p-2 font-mono">{point.value} {unit}</td>
                  <td className="border-b border-white/10 p-2 font-mono">{formatTime(comparison.incident[index].time)}</td>
                  <td className="border-b border-white/10 p-2 font-mono">{comparison.incident[index].value} {unit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <AcademyModelLimit>These five-point runs are invented. The lab models exact, held, and missing values, but it does not import a log, run the production replay engine, verify source identity, infer a cause, compare different robots, connect to hardware, or prove a physical fault.</AcademyModelLimit>
    </section>
  );
}

function formatTime(timeMs: number): string {
  if (timeMs === 0) return "0 ms";
  return `${timeMs > 0 ? "+" : ""}${timeMs} ms`;
}

function formatSample(sample: HeldSample | null, unit: string): string {
  if (!sample) return "Missing before first sample";
  const state = sample.status === "EXACT" ? "exact sample" : `held ${sample.ageMs} ms`;
  return `${sample.point.value.toFixed(1)} ${unit} (${state})`;
}

function SelectField({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label htmlFor={id} className="grid gap-2 text-sm font-bold text-white">
      <span>{label}</span>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
        className="min-h-11 rounded border border-white/20 bg-black px-3 py-2 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
      >
        {options.map((option) => <option key={option} value={option}>{option.replaceAll("_", " ").toLowerCase()}</option>)}
      </select>
    </label>
  );
}

function Datum({ label, value }: { label: string; value: string }) {
  return (
    <dl className="rounded border border-white/10 p-3">
      <dt className="text-xs uppercase tracking-wide text-marble/70">{label}</dt>
      <dd className="mt-1 font-mono font-semibold text-white">{value}</dd>
    </dl>
  );
}
