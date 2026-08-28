/** @sim {"name":"Kotlin Expression Values Lab","requiresContext":false,"academyApproved":true,"fidelity":"conceptual"} */
import { useMemo, useState } from "react";
import { RotateCcw } from "lucide-react";

export function calculateLinearExpression(raw: number, scale: number, offset: number) {
  if (![raw, scale, offset].every(Number.isFinite)) throw new Error("Expression inputs must be finite.");
  return raw * scale + offset;
}

const DEFAULTS = { raw: 100, scale: 0.01, offset: -0.5 } as const;

export default function KotlinExpressionLab() {
  const [raw, setRaw] = useState<number>(DEFAULTS.raw);
  const [scale, setScale] = useState<number>(DEFAULTS.scale);
  const [offset, setOffset] = useState<number>(DEFAULTS.offset);
  const adjusted = useMemo(() => calculateLinearExpression(raw, scale, offset), [raw, scale, offset]);
  const reset = () => { setRaw(DEFAULTS.raw); setScale(DEFAULTS.scale); setOffset(DEFAULTS.offset); };
  return <section aria-labelledby="kotlin-expression-title" className="my-8 rounded-xl border border-ares-cyan/30 bg-black/35 p-4 sm:p-6">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-widest text-ares-cyan">Expression model</p><h3 id="kotlin-expression-title" className="mt-1 text-xl font-black text-white">Kotlin Expression Values Lab</h3><p className="mt-2 max-w-3xl text-sm leading-relaxed text-marble/80">Change three values and trace one arithmetic expression without running student code.</p></div><button type="button" onClick={reset} className="inline-flex min-h-11 items-center justify-center gap-2 rounded border border-white/20 px-4 py-2 text-sm font-bold text-white hover:border-ares-cyan focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"><RotateCcw aria-hidden="true" size={16} /> Reset</button></div>
    <div className="mt-6 grid gap-6 lg:grid-cols-2"><fieldset className="grid gap-5 rounded-lg border border-white/10 bg-white/5 p-4"><legend className="px-2 text-sm font-bold text-ares-gold">Choose values</legend><NumberInput id="raw-value" label="raw" value={raw} step={1} onChange={setRaw} /><NumberInput id="scale-value" label="scale" value={scale} step={0.01} onChange={setScale} /><NumberInput id="offset-value" label="offset" value={offset} step={0.1} onChange={setOffset} /></fieldset><div className="rounded-lg border border-white/10 bg-obsidian p-4"><h4 className="text-sm font-bold uppercase tracking-wider text-ares-gold">Read the expression</h4><pre className="mt-4 overflow-x-auto rounded border border-white/10 bg-black p-4 text-sm text-ares-cyan"><code>val adjusted = raw * scale + offset</code></pre><dl aria-live="polite" aria-atomic="true" className="mt-4 grid gap-3 sm:grid-cols-2"><Datum label="Substitution" value={`${raw.toFixed(2)} × ${scale.toFixed(3)} + ${offset.toFixed(2)}`} /><Datum label="adjusted" value={adjusted.toFixed(3)} /></dl></div></div>
    <details className="mt-5 rounded border border-white/10 bg-white/5 p-3 text-sm text-white"><summary className="min-h-11 cursor-pointer font-bold text-ares-cyan">Open the evaluation order</summary><ol className="mt-3 list-decimal space-y-2 pl-6 text-marble/80"><li>Read the three values.</li><li>Multiply `raw` by `scale`.</li><li>Add `offset` to the product.</li><li>Store the result in the read-only `adjusted` value.</li></ol></details>
    <p role="note" className="mt-5 border-l-4 border-ares-gold/60 bg-ares-gold/10 p-3 text-sm leading-relaxed text-white"><strong>Model limit:</strong> This fixed calculator does not parse, compile, or execute Kotlin. It does not inspect ARES source, check units, model overflow, change robot state, or command hardware.</p>
  </section>;
}

function NumberInput({ id, label, value, step, onChange }: { id: string; label: string; value: number; step: number; onChange: (value: number) => void }) { return <label htmlFor={id} className="grid gap-2 text-sm font-bold text-white"><span>{label}</span><input id={id} type="number" value={value} step={step} onChange={(event) => onChange(Number(event.currentTarget.value))} className="min-h-11 rounded border border-white/20 bg-black px-3 py-2 font-mono text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan" /></label>; }
function Datum({ label, value }: { label: string; value: string }) { return <div className="rounded border border-white/10 p-3"><dt className="text-xs uppercase tracking-wide text-marble/70">{label}</dt><dd className="mt-1 break-words font-mono font-bold text-white">{value}</dd></div>; }
