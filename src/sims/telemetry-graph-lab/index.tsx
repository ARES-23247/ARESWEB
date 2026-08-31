/** @sim {"name":"Telemetry Graph Lab","requiresContext":false,"academyApproved":true,"fidelity":"conceptual"} */
import { useId, useMemo, useState } from "react";
import { AcademyLabShell, AcademyModelLimit } from "@/sims/shared/academy-interaction-ui";

type DataPoint = { time: number; value: number | null };
type DataSet = {
  id: string;
  label: string;
  measurement: string;
  unit: string;
  points: DataPoint[];
  observation: string;
  explanation: string;
};

const DATA_SETS: DataSet[] = [
  {
    id: "voltage-dip",
    label: "Voltage dip",
    measurement: "Battery voltage",
    unit: "V",
    points: [
      { time: 0, value: 13 },
      { time: 1, value: 12.9 },
      { time: 2, value: 12.7 },
      { time: 3, value: 11.8 },
      { time: 4, value: 12.6 },
      { time: 5, value: 12.7 },
    ],
    observation: "Voltage reached its lowest value, 11.8 V, at 3 seconds.",
    explanation: "A motor probably caused the voltage dip at 3 seconds.",
  },
  {
    id: "steady-distance",
    label: "Steady motion",
    measurement: "Distance",
    unit: "m",
    points: [
      { time: 0, value: 0 },
      { time: 1, value: 1.2 },
      { time: 2, value: 2.4 },
      { time: 3, value: 3.6 },
      { time: 4, value: 4.8 },
      { time: 5, value: 6 },
    ],
    observation: "Distance increased by 1.2 meters during each one-second step.",
    explanation: "The driver held the joystick in exactly the same place.",
  },
  {
    id: "missing-sample",
    label: "Missing sample",
    measurement: "Wheel speed",
    unit: "RPM",
    points: [
      { time: 0, value: 0 },
      { time: 1, value: 80 },
      { time: 2, value: 120 },
      { time: 3, value: null },
      { time: 4, value: 125 },
      { time: 5, value: 123 },
    ],
    observation: "The record has no wheel-speed value at 3 seconds.",
    explanation: "The sensor wire came loose at 3 seconds.",
  },
];

export default function TelemetryGraphLab() {
  const titleId = useId();
  const [selectedId, setSelectedId] = useState(DATA_SETS[0].id);
  const [answer, setAnswer] = useState<"observation" | "explanation" | null>(null);
  const selected = DATA_SETS.find((dataSet) => dataSet.id === selectedId) ?? DATA_SETS[0];
  const graph = useMemo(() => makeGraph(selected.points), [selected.points]);

  const chooseDataSet = (id: string) => {
    setSelectedId(id);
    setAnswer(null);
  };
  const reset = () => {
    setSelectedId(DATA_SETS[0].id);
    setAnswer(null);
  };

  return (
    <AcademyLabShell
      titleId={titleId}
      title="Telemetry Graph Lab"
      eyebrow="Concept data"
      description="Read the axes and values. Then choose the statement that reports evidence without guessing a cause."
      onReset={reset}
    >
      <fieldset className="mt-5">
        <legend className="text-sm font-bold text-ares-gold">Choose a data set</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          {DATA_SETS.map((dataSet) => (
            <button
              key={dataSet.id}
              type="button"
              aria-pressed={selected.id === dataSet.id}
              onClick={() => chooseDataSet(dataSet.id)}
              className="min-h-11 rounded border border-white/15 px-3 py-2 text-sm font-semibold text-white aria-pressed:border-ares-cyan aria-pressed:bg-ares-cyan/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
            >
              {dataSet.label}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(17rem,0.8fr)]">
        <div>
          <svg viewBox="0 0 520 260" aria-hidden="true" className="w-full rounded-lg border border-white/10 bg-obsidian">
            <line x1="55" y1="20" x2="55" y2="215" stroke="currentColor" className="text-white/50" />
            <line x1="55" y1="215" x2="500" y2="215" stroke="currentColor" className="text-white/50" />
            {graph.segments.map((segment, index) => (
              <polyline key={index} points={segment} fill="none" stroke="var(--ares-cyan)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
            ))}
            {graph.points.map((point) => (
              <circle key={point.key} cx={point.x} cy={point.y} r="6" fill="var(--ares-gold)" />
            ))}
            <text x="275" y="248" textAnchor="middle" fill="currentColor" className="text-marble/70 text-sm">Time (seconds)</text>
            <text x="18" y="120" textAnchor="middle" transform="rotate(-90 18 120)" fill="currentColor" className="text-marble/70 text-sm">{selected.measurement} ({selected.unit})</text>
          </svg>
          <details className="mt-3 rounded border border-white/10 bg-white/5 p-3 text-sm text-white">
            <summary className="min-h-11 cursor-pointer font-bold text-ares-cyan">Read the values as a table</summary>
            <table className="mt-3 w-full text-left">
              <thead><tr><th className="py-2">Time (s)</th><th className="py-2">{selected.measurement} ({selected.unit})</th></tr></thead>
              <tbody>{selected.points.map((point) => (
                <tr key={point.time} className="border-t border-white/10"><td className="py-2">{point.time}</td><td className="py-2">{point.value ?? "No sample"}</td></tr>
              ))}</tbody>
            </table>
          </details>
        </div>

        <div className="rounded-lg border border-white/10 bg-white/5 p-4">
          <h4 className="text-sm font-bold uppercase tracking-wider text-ares-gold">Which is an observation?</h4>
          <div className="mt-4 grid gap-3">
            <AnswerButton text={selected.observation} onClick={() => setAnswer("observation")} />
            <AnswerButton text={selected.explanation} onClick={() => setAnswer("explanation")} />
          </div>
          <div role="status" aria-live="polite" className="mt-4 min-h-16 rounded border border-white/10 bg-black/30 p-3 text-sm leading-relaxed text-white">
            {answer === null && "Choose one statement, then explain your choice to a partner."}
            {answer === "observation" && "Correct. This statement reports a visible value or pattern without naming an untested cause."}
            {answer === "explanation" && "That is a possible explanation. Collect another signal or repeat the test before treating the cause as fact."}
          </div>
        </div>
      </div>

      <AcademyModelLimit>
        These short data sets were written for this lesson. They are not logs from a team robot and do not prove any real failure cause.
      </AcademyModelLimit>
    </AcademyLabShell>
  );
}

function AnswerButton({ text, onClick }: { text: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="min-h-11 rounded border border-white/15 p-3 text-left text-sm text-white hover:border-ares-cyan focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan">{text}</button>;
}

export function makeGraph(points: DataPoint[]) {
  const values = points.flatMap((point) => point.value === null ? [] : [point.value]);
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  const span = Math.max(maximum - minimum, 1);
  const plotted = points.map((point, index) => point.value === null ? null : ({
    key: `${point.time}-${point.value}`,
    x: 55 + (index * (445 / Math.max(points.length - 1, 1))),
    y: 205 - (((point.value - minimum) / span) * 170),
  }));
  const segments: string[] = [];
  let current: string[] = [];
  for (const point of plotted) {
    if (point) current.push(`${point.x},${point.y}`);
    if (!point && current.length > 0) {
      segments.push(current.join(" "));
      current = [];
    }
  }
  if (current.length > 0) segments.push(current.join(" "));
  return { points: plotted.filter((point) => point !== null), segments };
}
