/** @sim {"name":"Commissioning Boundary Checklist","requiresContext":false,"academyApproved":true,"fidelity":"conceptual"} */
import { useMemo, useState } from "react";
import { ClipboardCheck, RotateCcw } from "lucide-react";

export type CommissioningChecks = { code: boolean; simulation: boolean; configuration: boolean; stopReady: boolean; restrained: boolean; unexpected: boolean };
export type CommissioningFinding = { status: "Continue evidence work" | "Stop and investigate" | "Ready to consider one bounded device test"; next: string };

export function chooseCommissioningBoundary(checks: CommissioningChecks): CommissioningFinding {
  if (checks.unexpected) return { status: "Stop and investigate", next: "Record the unexpected result and return to the last boundary with good evidence." };
  if (!checks.code) return { status: "Continue evidence work", next: "Run the required build, verification, and focused tests." };
  if (!checks.simulation) return { status: "Continue evidence work", next: "Run the applicable hardware-free simulation and fault cases." };
  if (!checks.configuration) return { status: "Continue evidence work", next: "Keep disabled and review the exact names, connections, directions, limits, and safe outputs." };
  if (!checks.stopReady) return { status: "Stop and investigate", next: "Do not request motion until the stop control and written stop conditions are ready." };
  if (!checks.restrained) return { status: "Continue evidence work", next: "Prepare a stable restrained setup through the team's robot-safety procedure." };
  return { status: "Ready to consider one bounded device test", next: "Use one small hold-to-run request and stop after any unexpected result." };
}

const DEFAULTS: CommissioningChecks = { code: false, simulation: false, configuration: false, stopReady: false, restrained: false, unexpected: false };
const ITEMS: { key: keyof CommissioningChecks; label: string }[] = [
  { key: "code", label: "Required code checks passed" },
  { key: "simulation", label: "Applicable simulation and fault cases passed" },
  { key: "configuration", label: "Current disabled configuration review is recorded" },
  { key: "stopReady", label: "Stop control and written stop conditions are ready" },
  { key: "restrained", label: "Stable restrained setup is ready" },
  { key: "unexpected", label: "An unexpected result occurred" },
];

export default function CommissioningChecklistLab() {
  const [checks, setChecks] = useState(DEFAULTS);
  const finding = useMemo(() => chooseCommissioningBoundary(checks), [checks]);
  const reset = () => setChecks(DEFAULTS);
  return <section aria-labelledby="commissioning-checklist-title" className="my-8 rounded-xl border border-ares-cyan/30 bg-black/35 p-4 sm:p-6"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-widest text-ares-cyan">Evidence boundary</p><h3 id="commissioning-checklist-title" className="mt-1 text-xl font-black text-white">Commissioning Boundary Checklist</h3><p className="mt-2 max-w-3xl text-sm leading-relaxed text-marble/80">Mark only evidence that is current for one invented system. The result chooses a next boundary, not permission to move a robot.</p></div><button type="button" onClick={reset} className="inline-flex min-h-11 items-center justify-center gap-2 rounded border border-white/20 px-4 py-2 text-sm font-bold text-white hover:border-ares-cyan focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"><RotateCcw aria-hidden="true" size={16} /> Reset</button></div><div className="mt-6 grid gap-5 lg:grid-cols-2"><fieldset className="grid gap-3 rounded-lg border border-white/10 bg-white/5 p-4"><legend className="px-2 text-sm font-bold text-ares-gold">Current evidence</legend>{ITEMS.map((item) => <label key={item.key} className="flex min-h-11 cursor-pointer items-center gap-3 rounded border border-white/10 p-3 text-sm font-bold text-white"><input type="checkbox" checked={checks[item.key]} onChange={(event) => setChecks({ ...checks, [item.key]: event.currentTarget.checked })} className="h-5 w-5 accent-ares-red" />{item.label}</label>)}</fieldset><div className="rounded-lg border border-white/10 bg-obsidian p-4"><h4 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-ares-gold"><ClipboardCheck aria-hidden="true" size={18} /> Next boundary</h4><dl aria-live="polite" aria-atomic="true" className="mt-4 grid gap-3"><Datum label="Status" value={finding.status} /><Datum label="Next action" value={finding.next} /></dl></div></div><p role="note" className="mt-5 border-l-4 border-ares-gold/60 bg-ares-gold/10 p-3 text-sm leading-relaxed text-white"><strong>Model limit:</strong> This checklist uses self-reported boxes. It does not run tests, inspect an inventory, verify a safety setup, connect to hardware, authorize motion, command an actuator, or prove physical behavior.</p></section>;
}

function Datum({ label, value }: { label: string; value: string }) { return <div className="rounded border border-white/10 p-3"><dt className="text-xs uppercase tracking-wide text-marble/70">{label}</dt><dd className="mt-1 font-semibold leading-relaxed text-white">{value}</dd></div>; }
