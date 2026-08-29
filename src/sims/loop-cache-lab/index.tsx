/** @sim {"name":"Cached Output Decision Lab","requiresContext":false,"academyApproved":true,"fidelity":"conceptual"} */
import { useMemo, useState } from "react";
import { RotateCcw } from "lucide-react";

export type CachedWriteDecision = { effectiveRequest: number; delta: number; shouldWrite: boolean; reason: string };

export function calculateCachedWrite(previous: number, requested: number, epsilon: number, emergencyStop: boolean): CachedWriteDecision {
  if (![previous, requested, epsilon].every(Number.isFinite)) throw new Error("Cache inputs must be finite.");
  if (epsilon < 0) throw new Error("Epsilon cannot be negative.");
  const effectiveRequest = emergencyStop ? 0 : requested;
  const delta = Math.abs(effectiveRequest - previous);
  const hardStop = effectiveRequest === 0 && previous !== 0;
  const shouldWrite = hardStop || delta >= epsilon;
  return { effectiveRequest, delta, shouldWrite, reason: hardStop ? "Write the hard stop" : shouldWrite ? "Write the changed command" : "Skip a redundant write" };
}

const DEFAULTS = { previous: 0.4, requested: 0.41, epsilon: 0.02 } as const;

export default function LoopCacheLab() {
  const [previous, setPrevious] = useState<number>(DEFAULTS.previous);
  const [requested, setRequested] = useState<number>(DEFAULTS.requested);
  const [epsilon, setEpsilon] = useState<number>(DEFAULTS.epsilon);
  const [emergencyStop, setEmergencyStop] = useState(false);
  const decision = useMemo(() => calculateCachedWrite(previous, requested, epsilon, emergencyStop), [previous, requested, epsilon, emergencyStop]);
  const reset = () => { setPrevious(DEFAULTS.previous); setRequested(DEFAULTS.requested); setEpsilon(DEFAULTS.epsilon); setEmergencyStop(false); };

  return (
    <section aria-labelledby="cache-lab-title" className="my-8 rounded-xl border border-ares-cyan/30 bg-black/35 p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-widest text-ares-cyan">Concept decision</p><h3 id="cache-lab-title" className="mt-1 text-xl font-black text-white">Cached Output Decision Lab</h3><p className="mt-2 max-w-3xl text-sm leading-relaxed text-marble/80">Compare a requested motor command with the last command and a write threshold.</p></div><button type="button" onClick={reset} className="inline-flex min-h-11 items-center justify-center gap-2 rounded border border-white/20 px-4 py-2 text-sm font-bold text-white hover:border-ares-cyan focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"><RotateCcw aria-hidden="true" size={16} /> Reset</button></div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <fieldset className="grid gap-5 rounded-lg border border-white/10 bg-white/5 p-4"><legend className="px-2 text-sm font-bold text-ares-gold">Choose lesson-only values</legend><RangeControl id="previous-command" label="Previous command" value={previous} min={-1} max={1} step={0.01} onChange={setPrevious} /><RangeControl id="requested-command" label="Requested command" value={requested} min={-1} max={1} step={0.01} onChange={setRequested} /><RangeControl id="write-threshold" label="Write threshold" value={epsilon} min={0} max={0.1} step={0.005} onChange={setEpsilon} /><label className="flex min-h-11 cursor-pointer items-center gap-3 rounded border border-white/10 p-3 text-sm font-bold text-white"><input type="checkbox" checked={emergencyStop} onChange={(event) => setEmergencyStop(event.currentTarget.checked)} className="h-5 w-5 accent-ares-red" /> Request a zero hard stop</label></fieldset>
        <div className="rounded-lg border border-white/10 bg-obsidian p-4"><h4 className="text-sm font-bold uppercase tracking-wider text-ares-gold">Write decision</h4><p aria-live="polite" aria-atomic="true" className={`mt-4 rounded border p-4 text-lg font-black ${decision.shouldWrite ? "border-ares-red/60 bg-ares-red/10 text-white" : "border-ares-cyan/50 bg-ares-cyan/10 text-ares-cyan"}`}>{decision.reason}</p><dl className="mt-4 grid gap-3 sm:grid-cols-3"><Datum label="Effective request" value={decision.effectiveRequest.toFixed(3)} /><Datum label="Absolute change" value={decision.delta.toFixed(3)} /><Datum label="Threshold" value={epsilon.toFixed(3)} /></dl><p className="mt-4 text-sm leading-relaxed text-marble/80">A zero request is shown as a hard-stop write when the previous command was not zero. A small nonzero change may be skipped.</p></div>
      </div>
      <details className="mt-5 rounded border border-white/10 bg-white/5 p-3 text-sm text-white"><summary className="min-h-11 cursor-pointer font-bold text-ares-cyan">Open the loop-order reminder</summary><ol className="mt-3 grid gap-2 sm:grid-cols-3"><TraceStep title="1. Refresh" text="Read each input at the named loop boundary." /><TraceStep title="2. Calculate" text="Use state and cached inputs for control and safety." /><TraceStep title="3. Write" text="Apply checked outputs, including an explicit stop." /></ol></details>
      <p role="note" className="mt-5 border-l-4 border-ares-gold/60 bg-ares-gold/10 p-3 text-sm leading-relaxed text-white"><strong>Model limit:</strong> This invented calculation models one cached output comparison. It does not read hardware, model the first-write sentinel, validate FTC SDK ranges, run a robot loop, measure bus traffic, or prove a device stops.</p>
    </section>
  );
}

function RangeControl({ id, label, value, min, max, step, onChange }: { id: string; label: string; value: number; min: number; max: number; step: number; onChange: (value: number) => void }) {
  return <div className="grid gap-2"><label htmlFor={id} className="flex items-center justify-between gap-3 text-sm font-semibold text-white"><span>{label}</span><output htmlFor={id} className="font-mono text-ares-cyan">{value.toFixed(3)}</output></label><input id={id} aria-label={label} type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.currentTarget.value))} className="min-h-11 w-full cursor-pointer accent-ares-red" /></div>;
}

function Datum({ label, value }: { label: string; value: string }) { return <div className="rounded border border-white/10 p-3"><dt className="text-xs uppercase tracking-wide text-marble/70">{label}</dt><dd className="mt-1 font-mono font-bold text-white">{value}</dd></div>; }
function TraceStep({ title, text }: { title: string; text: string }) { return <li className="rounded border border-white/10 p-3"><strong className="block text-ares-gold">{title}</strong><span className="mt-1 block leading-relaxed text-marble/80">{text}</span></li>; }
