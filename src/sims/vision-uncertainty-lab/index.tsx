/** @sim {"name":"Vision Evidence Rejection Lab","requiresContext":false,"academyApproved":true,"fidelity":"code-derived"} */
import { useMemo, useState } from "react";
import { Camera, RotateCcw } from "lucide-react";

export type VisionEvidence = { finite: boolean; knownTarget: boolean; ambiguityAccepted: boolean; captureTimeInHistory: boolean; insideField: boolean; innovationAccepted: boolean };
export type VisionDecision = { status: "Accepted by this checklist" | "Rejected"; reason: string };

export function classifyVisionEvidence(evidence: VisionEvidence): VisionDecision {
  if (!evidence.finite) return { status: "Rejected", reason: "The pose or uncertainty is not finite" };
  if (!evidence.knownTarget) return { status: "Rejected", reason: "The target identity is not in the reviewed field layout" };
  if (!evidence.ambiguityAccepted) return { status: "Rejected", reason: "The reported target solution is too ambiguous for the chosen policy" };
  if (!evidence.captureTimeInHistory) return { status: "Rejected", reason: "The capture time is outside the stored pose history" };
  if (!evidence.insideField) return { status: "Rejected", reason: "The reported pose is outside the checked field bounds" };
  if (!evidence.innovationAccepted) return { status: "Rejected", reason: "The measurement disagrees too much with prediction for its stated uncertainty" };
  return { status: "Accepted by this checklist", reason: "Every represented gate passed; keep uncertainty and later residuals visible" };
}

const DEFAULTS: VisionEvidence = { finite: true, knownTarget: true, ambiguityAccepted: true, captureTimeInHistory: true, insideField: true, innovationAccepted: true };
const GATES: { key: keyof VisionEvidence; label: string }[] = [
  { key: "finite", label: "Pose and uncertainty are finite" },
  { key: "knownTarget", label: "Target appears in the reviewed field layout" },
  { key: "ambiguityAccepted", label: "Target ambiguity passes the chosen policy" },
  { key: "captureTimeInHistory", label: "Capture time is inside stored pose history" },
  { key: "insideField", label: "Reported pose is inside checked field bounds" },
  { key: "innovationAccepted", label: "Innovation passes the uncertainty-aware check" },
];

export default function VisionUncertaintyLab() {
  const [evidence, setEvidence] = useState(DEFAULTS);
  const decision = useMemo(() => classifyVisionEvidence(evidence), [evidence]);
  const reset = () => setEvidence(DEFAULTS);
  return <section aria-labelledby="vision-evidence-title" className="my-8 rounded-xl border border-ares-cyan/30 bg-black/35 p-4 sm:p-6"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-widest text-ares-cyan">Visible rejection path</p><h3 id="vision-evidence-title" className="mt-1 text-xl font-black text-white">Vision Evidence Rejection Lab</h3><p className="mt-2 max-w-3xl text-sm leading-relaxed text-marble/80">Turn off one invented evidence gate at a time. The first failed gate stays visible as the rejection reason.</p></div><button type="button" onClick={reset} className="inline-flex min-h-11 items-center justify-center gap-2 rounded border border-white/20 px-4 py-2 text-sm font-bold text-white hover:border-ares-cyan focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"><RotateCcw aria-hidden="true" size={16} /> Reset</button></div><div className="mt-6 grid gap-5 lg:grid-cols-2"><fieldset className="grid gap-3 rounded-lg border border-white/10 bg-white/5 p-4"><legend className="px-2 text-sm font-bold text-ares-gold">Invented camera evidence</legend>{GATES.map((gate) => <label key={gate.key} className="flex min-h-11 cursor-pointer items-center gap-3 rounded border border-white/10 p-3 text-sm font-bold text-white"><input type="checkbox" checked={evidence[gate.key]} onChange={(event) => setEvidence({ ...evidence, [gate.key]: event.currentTarget.checked })} className="h-5 w-5 accent-ares-red" />{gate.label}</label>)}</fieldset><div className="rounded-lg border border-white/10 bg-obsidian p-4"><h4 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-ares-gold"><Camera aria-hidden="true" size={18} /> Checklist decision</h4><dl aria-live="polite" aria-atomic="true" className="mt-4 grid gap-3"><Datum label="Status" value={decision.status} /><Datum label="Reason" value={decision.reason} /></dl><p className="mt-4 text-sm leading-relaxed text-marble/75">A rejected row is still useful evidence. Keep its target, capture time, residual, uncertainty, and reason when privacy rules allow.</p></div></div><p role="note" className="mt-5 border-l-4 border-ares-gold/60 bg-ares-gold/10 p-3 text-sm leading-relaxed text-white"><strong>Model limit:</strong> These switches mirror named ARES review stages, but they do not process an image, solve an AprilTag pose, calculate ambiguity or innovation, model latency, run the estimator, connect to a camera, or prove field position.</p></section>;
}

function Datum({ label, value }: { label: string; value: string }) { return <div className="rounded border border-white/10 p-3"><dt className="text-xs uppercase tracking-wide text-marble/70">{label}</dt><dd className="mt-1 font-semibold leading-relaxed text-white">{value}</dd></div>; }
