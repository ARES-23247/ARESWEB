/** @sim {"name":"Control Response Lab","requiresContext":false,"academyApproved":true,"fidelity":"conceptual"} */
import { useMemo, useState } from "react";
import { RotateCcw } from "lucide-react";

type Sample = { time: number; target: number; measured: number; output: number };

const DEFAULTS = { feedforward: 1, proportional: 0.8, derivative: 0.1 } as const;

export function calculateConceptResponse(feedforward: number, proportional: number, derivative: number): Sample[] {
  const samples: Sample[] = [];
  const dt = 0.1;
  const target = 1;
  let measured = 0;
  let previousError = target;
  for (let index = 0; index <= 50; index += 1) {
    const time = index * dt;
    const error = target - measured;
    const errorRate = index === 0 ? 0 : (error - previousError) / dt;
    const output = Math.max(-3, Math.min(3, feedforward + proportional * error + derivative * errorRate));
    samples.push({ time, target, measured, output });
    const acceleration = (output - measured) / 1.5;
    measured += acceleration * dt;
    previousError = error;
  }
  return samples;
}

export default function ControlResponseLab() {
  const [feedforward, setFeedforward] = useState<number>(DEFAULTS.feedforward);
  const [proportional, setProportional] = useState<number>(DEFAULTS.proportional);
  const [derivative, setDerivative] = useState<number>(DEFAULTS.derivative);
  const samples = useMemo(() => calculateConceptResponse(feedforward, proportional, derivative), [feedforward, proportional, derivative]);
  const final = samples.at(-1)!;
  const peak = Math.max(...samples.map((sample) => sample.measured));

  const reset = () => {
    setFeedforward(DEFAULTS.feedforward);
    setProportional(DEFAULTS.proportional);
    setDerivative(DEFAULTS.derivative);
  };

  const points = samples.map((sample) => `${30 + sample.time * 68},${180 - sample.measured * 100}`).join(" ");

  return (
    <section aria-labelledby="control-response-title" className="my-8 rounded-xl border border-ares-cyan/30 bg-black/35 p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-ares-cyan">Concept model</p>
          <h3 id="control-response-title" className="mt-1 text-xl font-black text-white">Feedforward and Feedback Response Lab</h3>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-marble/80">Compare a predicted base output with proportional and derivative error correction in one invented velocity model.</p>
        </div>
        <button type="button" onClick={reset} className="inline-flex min-h-11 items-center justify-center gap-2 rounded border border-white/20 px-4 py-2 text-sm font-bold text-white hover:border-ares-cyan focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"><RotateCcw aria-hidden="true" size={16} /> Reset</button>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(16rem,0.8fr)_minmax(0,1.2fr)]">
        <fieldset className="grid gap-5 rounded-lg border border-white/10 bg-white/5 p-4">
          <legend className="px-2 text-sm font-bold text-ares-gold">Choose lesson gains</legend>
          <NumberControl label="Feedforward output" value={feedforward} min={0} max={2} step={0.1} onChange={setFeedforward} />
          <NumberControl label="Proportional gain" value={proportional} min={0} max={3} step={0.1} onChange={setProportional} />
          <NumberControl label="Derivative gain" value={derivative} min={0} max={1} step={0.05} onChange={setDerivative} />
        </fieldset>

        <div className="rounded-lg border border-white/10 bg-obsidian p-4">
          <h4 className="text-sm font-bold uppercase tracking-wider text-ares-gold">Invented velocity response</h4>
          <svg viewBox="0 0 390 210" className="mt-3 h-auto w-full" role="img" aria-label={`Target is 1.00. Final modeled velocity is ${final.measured.toFixed(2)} and peak is ${peak.toFixed(2)}.`}>
            <line x1="30" y1="80" x2="370" y2="80" stroke="currentColor" className="text-ares-gold" strokeDasharray="6 5" />
            <line x1="30" y1="180" x2="370" y2="180" stroke="currentColor" className="text-white/40" />
            <line x1="30" y1="20" x2="30" y2="180" stroke="currentColor" className="text-white/40" />
            <polyline points={points} fill="none" stroke="currentColor" className="text-ares-cyan" strokeWidth="4" />
            <text x="34" y="74" fill="currentColor" className="text-[11px] text-ares-gold">target 1.00</text>
            <text x="310" y="198" fill="currentColor" className="text-[11px] text-white">time</text>
          </svg>
          <dl aria-live="polite" aria-atomic="true" className="mt-4 grid gap-3 sm:grid-cols-3">
            <Result label="Final velocity" value={final.measured.toFixed(2)} />
            <Result label="Final error" value={(final.target - final.measured).toFixed(2)} />
            <Result label="Peak velocity" value={peak.toFixed(2)} />
          </dl>
        </div>
      </div>

      <details className="mt-5 rounded border border-white/10 bg-white/5 p-3 text-sm text-white">
        <summary className="min-h-11 cursor-pointer font-bold text-ares-cyan">Open the numeric result table</summary>
        <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[28rem] text-left"><thead><tr><th className="p-2">Time</th><th className="p-2">Target</th><th className="p-2">Measured</th><th className="p-2">Output</th></tr></thead><tbody>{samples.filter((_sample, index) => index % 10 === 0).map((sample) => <tr key={sample.time} className="border-t border-white/10"><td className="p-2">{sample.time.toFixed(1)} s</td><td className="p-2">{sample.target.toFixed(2)}</td><td className="p-2">{sample.measured.toFixed(2)}</td><td className="p-2">{sample.output.toFixed(2)}</td></tr>)}</tbody></table></div>
      </details>

      <p role="note" className="mt-5 border-l-4 border-ares-gold/60 bg-ares-gold/10 p-3 text-sm leading-relaxed text-white"><strong>Model limit:</strong> Every plant value and gain in this activity is invented for learning. It shows control patterns, not an ARES tuning profile, real motor, safe gain, or physical robot response.</p>
    </section>
  );
}

function NumberControl({ label, value, min, max, step, onChange }: { label: string; value: number; min: number; max: number; step: number; onChange: (value: number) => void }) {
  const id = label.toLowerCase().replace(/[^a-z0-9]+/gu, "-");
  return <div className="grid gap-2"><label htmlFor={id} className="flex items-center justify-between gap-3 text-sm font-semibold text-white"><span>{label}</span><output htmlFor={id} className="font-mono text-ares-cyan">{value.toFixed(2)}</output></label><input id={id} aria-label={label} type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.currentTarget.value))} className="min-h-11 w-full cursor-pointer accent-ares-red" /></div>;
}

function Result({ label, value }: { label: string; value: string }) {
  return <div className="rounded border border-white/10 p-3"><dt className="text-xs uppercase tracking-wide text-marble/70">{label}</dt><dd className="mt-1 font-mono text-lg font-bold text-white">{value}</dd></div>;
}
