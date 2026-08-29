/** @sim {"name":"Hardware Topology Diagnostic","requiresContext":false,"academyApproved":true,"fidelity":"conceptual"} */
import { useMemo, useState } from "react";
import { Network, RotateCcw } from "lucide-react";

export type TopologyEvidence = { inventory: boolean; name: boolean; connection: boolean; startupHealth: boolean; freshInput: boolean; outputWrite: boolean };
export type TopologyFinding = { stage: string; next: string };

export function diagnoseTopologyEvidence(evidence: TopologyEvidence): TopologyFinding {
  if (!evidence.inventory) return { stage: "Canonical inventory missing", next: "Stop guessing and identify the exact project document and device record." };
  if (!evidence.name) return { stage: "Stable name mismatch", next: "Keep disabled and compare the software name with the configured hardware name." };
  if (!evidence.connection) return { stage: "Connection identity mismatch", next: "Compare platform, parent, port, bus, address, and channel with the reviewed inventory." };
  if (!evidence.startupHealth) return { stage: "Startup health failed", next: "Keep outputs neutral and preserve the named required or optional device failure." };
  if (!evidence.freshInput) return { stage: "Input evidence is stale or invalid", next: "Inspect the single refresh owner, timestamp, validity, unit, and diagnostic state." };
  if (!evidence.outputWrite) return { stage: "Output write failed", next: "Latch or report the failure and require a neutral recovery before another motion request." };
  return { stage: "No fault found in these software checks", next: "Continue with a bounded physical inspection; do not call the device proven operational." };
}

const DEFAULTS: TopologyEvidence = { inventory: true, name: true, connection: true, startupHealth: true, freshInput: true, outputWrite: true };
const CHECKS: { key: keyof TopologyEvidence; label: string }[] = [
  { key: "inventory", label: "Exact canonical device record is available" },
  { key: "name", label: "Stable software and configured hardware names match" },
  { key: "connection", label: "Parent, port, bus, address, or channel matches" },
  { key: "startupHealth", label: "Required or optional startup health is explicit" },
  { key: "freshInput", label: "Cached input is valid, fresh, and unit-labeled" },
  { key: "outputWrite", label: "Commanded output write reports success" },
];

export default function HardwareTopologyDiagnostic() {
  const [evidence, setEvidence] = useState(DEFAULTS);
  const finding = useMemo(() => diagnoseTopologyEvidence(evidence), [evidence]);
  const reset = () => setEvidence(DEFAULTS);
  return <section aria-labelledby="topology-diagnostic-title" className="my-8 rounded-xl border border-ares-cyan/30 bg-black/35 p-4 sm:p-6"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-widest text-ares-cyan">First visible mismatch</p><h3 id="topology-diagnostic-title" className="mt-1 text-xl font-black text-white">Hardware Topology Diagnostic</h3><p className="mt-2 max-w-3xl text-sm leading-relaxed text-marble/80">Turn off one invented evidence check. The model identifies the earliest represented boundary that needs work.</p></div><button type="button" onClick={reset} className="inline-flex min-h-11 items-center justify-center gap-2 rounded border border-white/20 px-4 py-2 text-sm font-bold text-white hover:border-ares-cyan focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"><RotateCcw aria-hidden="true" size={16} /> Reset</button></div><div className="mt-6 grid gap-5 lg:grid-cols-2"><fieldset className="grid gap-3 rounded-lg border border-white/10 bg-white/5 p-4"><legend className="px-2 text-sm font-bold text-ares-gold">Invented evidence record</legend>{CHECKS.map((check) => <label key={check.key} className="flex min-h-11 cursor-pointer items-center gap-3 rounded border border-white/10 p-3 text-sm font-bold text-white"><input type="checkbox" checked={evidence[check.key]} onChange={(event) => setEvidence({ ...evidence, [check.key]: event.currentTarget.checked })} className="h-5 w-5 accent-ares-red" />{check.label}</label>)}</fieldset><div className="rounded-lg border border-white/10 bg-obsidian p-4"><h4 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-ares-gold"><Network aria-hidden="true" size={18} /> Diagnostic result</h4><dl aria-live="polite" aria-atomic="true" className="mt-4 grid gap-3"><Datum label="First stage to inspect" value={finding.stage} /><Datum label="Next action" value={finding.next} /></dl></div></div><p role="note" className="mt-5 border-l-4 border-ares-gold/60 bg-ares-gold/10 p-3 text-sm leading-relaxed text-white"><strong>Model limit:</strong> These self-reported checks do not open an ARES project, scan a hardware map, connect to a controller, read power or wiring, poll a sensor, write an actuator, identify a root cause, or prove a device works.</p></section>;
}

function Datum({ label, value }: { label: string; value: string }) { return <div className="rounded border border-white/10 p-3"><dt className="text-xs uppercase tracking-wide text-marble/70">{label}</dt><dd className="mt-1 font-semibold leading-relaxed text-white">{value}</dd></div>; }
