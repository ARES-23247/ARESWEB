/** @sim {"name":"Scouting Evidence Quality Lab","requiresContext":false,"academyApproved":true,"fidelity":"conceptual"} */
import { useMemo, useState } from "react";
import { RotateCcw } from "lucide-react";
import { AcademyChecklistPanel } from "@/sims/shared/academy-interaction-ui";

export type ScoutingEvidence = {
  sourceRecorded: boolean;
  observationSeparated: boolean;
  contextRecorded: boolean;
  sampleLimitsRecorded: boolean;
  missingDataVisible: boolean;
  personalDataRemoved: boolean;
};

export type ScoutingReviewResult =
  | { ready: true; title: string; nextAction: string }
  | { ready: false; title: string; nextAction: string; missingKey: keyof ScoutingEvidence };

export const EMPTY_SCOUTING_EVIDENCE: ScoutingEvidence = {
  sourceRecorded: false,
  observationSeparated: false,
  contextRecorded: false,
  sampleLimitsRecorded: false,
  missingDataVisible: false,
  personalDataRemoved: false,
};

const CHECKS: Array<{ key: keyof ScoutingEvidence; label: string; action: string }> = [
  { key: "sourceRecorded", label: "The record names its source and time or match identity.", action: "Add the source and a bounded time or match identity before using the record." },
  { key: "observationSeparated", label: "Observed facts are separate from possible explanations.", action: "Rewrite the record so a reader can tell what was seen from what might explain it." },
  { key: "contextRecorded", label: "The task, phase, and relevant conditions are recorded.", action: "Add enough match or practice context to explain what the observation covers." },
  { key: "sampleLimitsRecorded", label: "Sample count and comparison limits are visible.", action: "Record how many observations support the claim and what should not be generalized." },
  { key: "missingDataVisible", label: "Missing, uncertain, or conflicting data stays visible.", action: "Mark the missing or uncertain field instead of turning it into zero or a confident claim." },
  { key: "personalDataRemoved", label: "The record contains no names, contact details, or private notes.", action: "Remove personal details. Use team, robot, match, and role labels only when needed." },
];

export function reviewScoutingEvidence(evidence: ScoutingEvidence): ScoutingReviewResult {
  const firstMissing = CHECKS.find((check) => !evidence[check.key]);
  if (firstMissing) {
    return {
      ready: false,
      title: `Record blocked at: ${firstMissing.label}`,
      nextAction: firstMissing.action,
      missingKey: firstMissing.key,
    };
  }
  return {
    ready: true,
    title: "The record contains every lesson evidence check.",
    nextAction: "Preserve it for team process review. It is evidence for a question, not a complete strategy or a judgment about people.",
  };
}

export default function ScoutingQualityLab() {
  const [evidence, setEvidence] = useState<ScoutingEvidence>({ ...EMPTY_SCOUTING_EVIDENCE });
  const result = useMemo(() => reviewScoutingEvidence(evidence), [evidence]);
  const reset = () => setEvidence({ ...EMPTY_SCOUTING_EVIDENCE });

  return (
    <section aria-labelledby="scouting-quality-title" className="my-8 rounded-xl border border-ares-cyan/30 bg-black/35 p-4 sm:p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-ares-cyan">Evidence review</p>
          <h3 id="scouting-quality-title" className="mt-1 text-xl font-black text-white">Scouting Evidence Quality Lab</h3>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-marble/80">
            Review one invented robot observation in a fixed order. The first missing check becomes the next editing task.
          </p>
        </div>
        <button type="button" onClick={reset} className="mt-2 inline-flex min-h-11 items-center justify-center gap-2 rounded border border-white/20 px-4 py-2 text-sm font-bold text-white hover:border-ares-cyan focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan sm:mt-0">
          <RotateCcw aria-hidden="true" size={16} /> Reset
        </button>
      </div>

      <AcademyChecklistPanel
        checks={CHECKS}
        values={evidence}
        onChange={(key, checked) => setEvidence((current) => ({ ...current, [key]: checked }))}
        legend="Self-reported record evidence"
        resultHeading="Next record step"
        result={result}
      />

      <p role="note" className="mt-5 border-l-4 border-ares-gold/60 bg-ares-gold/10 p-3 text-sm leading-relaxed text-white">
        <strong>Evidence limit:</strong> Every box is self-reported. The lab cannot watch a match, read a log, verify a source, count events, remove private data, compare robots, explain a result, rank a team, or create a match strategy.
      </p>
    </section>
  );
}
