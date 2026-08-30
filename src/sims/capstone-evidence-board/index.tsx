/** @sim {"name":"Capstone Evidence Board","requiresContext":false,"academyApproved":true,"fidelity":"conceptual"} */
import { useMemo, useState } from "react";
import { ClipboardCheck, RotateCcw } from "lucide-react";
import { AcademyDatum } from "@/sims/shared/academy-interaction-ui";

export type CapstoneEvidence = {
  requirement: boolean;
  design: boolean;
  implementation: boolean;
  tests: boolean;
  failure: boolean;
  safety: boolean;
  limits: boolean;
};
export type CapstoneReview = { complete: number; total: number; next: string; status: "INCOMPLETE" | "READY FOR REVIEW" };

const CHECKS: { key: keyof CapstoneEvidence; label: string; next: string }[] = [
  { key: "requirement", label: "Requirement has a number, unit, and constraints", next: "Write one measurable requirement with units and constraints." },
  { key: "design", label: "Design records ownership, interfaces, and expected behavior", next: "Record the design, owners, interfaces, and expected behavior." },
  { key: "implementation", label: "Implementation evidence points to reviewed source", next: "Link the exact reviewed source or generated preview." },
  { key: "tests", label: "Tests include expected, observed, and evidence level", next: "Add expected and observed results with an evidence label." },
  { key: "failure", label: "At least one controlled failure and recovery are recorded", next: "Run or plan one controlled failure and record recovery." },
  { key: "safety", label: "Neutral, stop, and physical-test boundaries are explicit", next: "State neutral, stop, and physical-test boundaries." },
  { key: "limits", label: "Unsupported claims and missing evidence stay visible", next: "List unsupported claims, missing evidence, and model limits." },
];

export function reviewCapstoneEvidence(evidence: CapstoneEvidence): CapstoneReview {
  const complete = CHECKS.filter((check) => evidence[check.key]).length;
  const missing = CHECKS.find((check) => !evidence[check.key]);
  return missing
    ? { complete, total: CHECKS.length, next: missing.next, status: "INCOMPLETE" }
    : { complete, total: CHECKS.length, next: "Ask a teammate to challenge one claim and one missing boundary before editorial review.", status: "READY FOR REVIEW" };
}

const DEFAULTS: CapstoneEvidence = { requirement: false, design: false, implementation: false, tests: false, failure: false, safety: false, limits: false };

export default function CapstoneEvidenceBoard() {
  const [evidence, setEvidence] = useState(DEFAULTS);
  const review = useMemo(() => reviewCapstoneEvidence(evidence), [evidence]);
  const reset = () => setEvidence(DEFAULTS);
  return <section aria-labelledby="capstone-board-title" className="my-8 rounded-xl border border-ares-cyan/30 bg-black/35 p-4 sm:p-6"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-widest text-ares-cyan">Local self-check</p><h3 id="capstone-board-title" className="mt-1 text-xl font-black text-white">Capstone Evidence Board</h3><p className="mt-2 max-w-3xl text-sm leading-relaxed text-marble/80">Mark only evidence that is actually in your packet. The first missing section becomes the next action.</p></div><button type="button" onClick={reset} className="inline-flex min-h-11 items-center justify-center gap-2 rounded border border-white/20 px-4 py-2 text-sm font-bold text-white hover:border-ares-cyan focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"><RotateCcw aria-hidden="true" size={16} /> Reset</button></div><div className="mt-6 grid gap-5 lg:grid-cols-2"><fieldset className="grid gap-3 rounded-lg border border-white/10 bg-white/5 p-4"><legend className="px-2 text-sm font-bold text-ares-gold">Evidence packet sections</legend>{CHECKS.map((check) => <label key={check.key} className="flex min-h-11 cursor-pointer items-center gap-3 rounded border border-white/10 p-3 text-sm font-bold text-white"><input type="checkbox" checked={evidence[check.key]} onChange={(event) => setEvidence({ ...evidence, [check.key]: event.currentTarget.checked })} className="h-5 w-5 accent-ares-red" />{check.label}</label>)}</fieldset><div className="rounded-lg border border-white/10 bg-obsidian p-4"><h4 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-ares-gold"><ClipboardCheck aria-hidden="true" size={18} /> Review result</h4><dl aria-live="polite" aria-atomic="true" className="mt-4 grid gap-3"><Datum label="Status" value={review.status} /><Datum label="Sections recorded" value={`${review.complete} of ${review.total}`} /><Datum label="Next action" value={review.next} /></dl></div></div><p role="note" className="mt-5 border-l-4 border-ares-gold/60 bg-ares-gold/10 p-3 text-sm leading-relaxed text-white"><strong>Model limit:</strong> These self-reported boxes do not inspect a project, verify source links, run tests, review student work, approve website publication, authorize physical operation, or prove a capstone claim.</p></section>;
}

const Datum = AcademyDatum;
