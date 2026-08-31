/** @sim {"name":"Log Alignment and Comparison Lab","requiresContext":false,"academyApproved":true,"fidelity":"conceptual"} */
import { useMemo, useState } from "react";
import { ChartNoAxesCombined } from "lucide-react";
import {
  AcademyDatum,
  AcademyLabShell,
  AcademyModelLimit,
  AcademySelectControl,
} from "@/sims/shared/academy-interaction-ui";

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
    <AcademyLabShell
      titleId="log-comparison-title"
      title="Log Alignment and Comparison Lab"
      eyebrow="Synthetic run comparison"
      description="Compare two tiny invented runs. Alignment moves timestamps. The evidence readout uses the newest sample at or before the selected time."
      onReset={reset}
    >
      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <fieldset className="grid gap-4 rounded-lg border border-white/10 bg-white/5 p-4">
          <legend className="px-2 text-sm font-bold text-ares-gold">Comparison choices</legend>
          <AcademySelectControl
            id="log-anchor"
            label="Alignment anchor"
            value={anchor}
            options={["RUN_START", "SHARED_EVENT"]}
            onChange={changeAnchor}
          />
          <AcademySelectControl
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

          <dl aria-live="polite" className="grid gap-3">
            <AcademyDatum label="Baseline evidence" value={formatSample(baselineSample, unit)} />
            <AcademyDatum label="Incident evidence" value={formatSample(incidentSample, unit)} />
            <AcademyDatum
              label="Difference at this evidence time"
              value={difference === null ? "Not comparable: one run has no earlier sample" : `${difference.toFixed(1)} ${unit}`}
            />
          </dl>
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
    </AcademyLabShell>
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
