/** @sim {"name":"Sensor Signal Evidence Lab","requiresContext":false,"academyApproved":true,"fidelity":"conceptual"} */
import { useMemo, useState } from "react";
import { RotateCcw, ScanSearch } from "lucide-react";

type Health = "HEALTHY" | "STALE" | "INVALID" | "DISCONNECTED";
export type SignalFinding = { status: "Usable in this concept frame" | "Blocked"; reason: string };

export function classifyDistanceSignal(valueMeters: number, ageMs: number, maxAgeMs: number, health: Health, configured: boolean): SignalFinding {
  if (![valueMeters, ageMs, maxAgeMs].every(Number.isFinite)) return { status: "Blocked", reason: "A numeric input is not finite" };
  if (ageMs < 0 || maxAgeMs < 0) throw new Error("Signal ages must not be negative.");
  if (!configured) return { status: "Blocked", reason: "Sensor identity or configuration is not healthy" };
  if (health !== "HEALTHY") return { status: "Blocked", reason: `Health is ${health.toLowerCase()}` };
  if (ageMs > maxAgeMs) return { status: "Blocked", reason: "Sample is older than its allowed age" };
  if (valueMeters < 0) return { status: "Blocked", reason: "Distance is outside the lesson range" };
  return { status: "Usable in this concept frame", reason: "Finite value, known identity, healthy status, and fresh sample" };
}

const DEFAULTS = { value: 0.75, age: 20, maxAge: 100, health: "HEALTHY" as Health, configured: true };

export default function SensorSignalLab() {
  const [value, setValue] = useState(DEFAULTS.value);
  const [age, setAge] = useState(DEFAULTS.age);
  const [maxAge, setMaxAge] = useState(DEFAULTS.maxAge);
  const [health, setHealth] = useState<Health>(DEFAULTS.health);
  const [configured, setConfigured] = useState(DEFAULTS.configured);
  const finding = useMemo(() => classifyDistanceSignal(value, age, maxAge, health, configured), [value, age, maxAge, health, configured]);
  const reset = () => { setValue(DEFAULTS.value); setAge(DEFAULTS.age); setMaxAge(DEFAULTS.maxAge); setHealth(DEFAULTS.health); setConfigured(DEFAULTS.configured); };

  return (
    <section aria-labelledby="sensor-signal-title" className="my-8 rounded-xl border border-ares-cyan/30 bg-black/35 p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-widest text-ares-cyan">Cached signal model</p><h3 id="sensor-signal-title" className="mt-1 text-xl font-black text-white">Sensor Signal Evidence Lab</h3><p className="mt-2 max-w-3xl text-sm leading-relaxed text-marble/80">Decide whether one invented distance sample has enough value, identity, health, and freshness evidence.</p></div><button type="button" onClick={reset} className="inline-flex min-h-11 items-center justify-center gap-2 rounded border border-white/20 px-4 py-2 text-sm font-bold text-white hover:border-ares-cyan focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"><RotateCcw aria-hidden="true" size={16} /> Reset</button></div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <fieldset className="grid gap-4 rounded-lg border border-white/10 bg-white/5 p-4"><legend className="px-2 text-sm font-bold text-ares-gold">One cached distance sample</legend><NumberField id="distance-value" label="Distance (meters)" value={value} step={0.01} onChange={setValue} /><NumberField id="sample-age" label="Sample age (milliseconds)" value={age} step={1} onChange={setAge} /><NumberField id="maximum-age" label="Maximum allowed age (milliseconds)" value={maxAge} step={1} onChange={setMaxAge} /><label htmlFor="signal-health" className="grid gap-2 text-sm font-bold text-white"><span>Reported health</span><select id="signal-health" value={health} onChange={(event) => setHealth(event.currentTarget.value as Health)} className="min-h-11 rounded border border-white/20 bg-black px-3 py-2 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"><option value="HEALTHY">Healthy</option><option value="STALE">Stale</option><option value="INVALID">Invalid</option><option value="DISCONNECTED">Disconnected</option></select></label><label className="flex min-h-11 cursor-pointer items-center gap-3 rounded border border-white/10 p-3 text-sm font-bold text-white"><input type="checkbox" checked={configured} onChange={(event) => setConfigured(event.currentTarget.checked)} className="h-5 w-5 accent-ares-red" /> Identity and configuration are healthy</label></fieldset>

        <div className="rounded-lg border border-white/10 bg-obsidian p-4"><h4 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-ares-gold"><ScanSearch aria-hidden="true" size={18} /> Concept finding</h4><dl aria-live="polite" aria-atomic="true" className="mt-4 grid gap-3"><Datum label="Status" value={finding.status} /><Datum label="Reason" value={finding.reason} /><Datum label="Recorded sample" value={`${value.toFixed(2)} m at age ${age.toFixed(0)} ms`} /></dl></div>
      </div>

      <details className="mt-5 rounded border border-white/10 bg-white/5 p-3 text-sm text-white"><summary className="min-h-11 cursor-pointer font-bold text-ares-cyan">Open the signal checklist</summary><ol className="mt-3 list-decimal space-y-2 pl-6 text-marble/80"><li>Confirm stable sensor identity and configuration.</li><li>Read the sensor once at the owned refresh point.</li><li>Keep the value, unit, timestamp, and health together.</li><li>Block control when required evidence is bad or old.</li><li>Report the reason instead of replacing failure with zero.</li></ol></details>

      <p role="note" className="mt-5 border-l-4 border-ares-gold/60 bg-ares-gold/10 p-3 text-sm leading-relaxed text-white"><strong>Model limit:</strong> This invented distance check does not read a sensor, discover a port, validate a device range, model noise or surfaces, select hardware, run a robot loop, command an actuator, or prove physical sensing.</p>
    </section>
  );
}

function NumberField({ id, label, value, step, onChange }: { id: string; label: string; value: number; step: number; onChange: (value: number) => void }) { return <label htmlFor={id} className="grid gap-2 text-sm font-bold text-white"><span>{label}</span><input id={id} type="number" value={value} step={step} min="0" onChange={(event) => onChange(Number(event.currentTarget.value))} className="min-h-11 rounded border border-white/20 bg-black px-3 py-2 font-mono text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan" /></label>; }
function Datum({ label, value }: { label: string; value: string }) { return <div className="rounded border border-white/10 p-3"><dt className="text-xs uppercase tracking-wide text-marble/70">{label}</dt><dd className="mt-1 font-semibold leading-relaxed text-white">{value}</dd></div>; }
