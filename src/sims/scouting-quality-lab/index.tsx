/** @sim {"name":"Scouting Evidence Quality Lab","requiresContext":false,"academyApproved":true,"fidelity":"conceptual"} */
import { AcademyChecklistLab } from "@/sims/shared/academy-interaction-ui";

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
  return (
    <AcademyChecklistLab
      titleId="scouting-quality-title"
      title="Scouting Evidence Quality Lab"
      eyebrow="Evidence review"
      description="Review one invented robot observation in a fixed order. The first missing check becomes the next editing task."
      initialValues={EMPTY_SCOUTING_EVIDENCE}
      checks={CHECKS}
      legend="Self-reported record evidence"
      resultHeading="Next record step"
      review={reviewScoutingEvidence}
      limitLabel="Evidence limit"
      limit="Every box is self-reported. The lab cannot watch a match, read a log, verify a source, count events, remove private data, compare robots, explain a result, rank a team, or create a match strategy."
    />
  );
}
