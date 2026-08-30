/** @sim {"name":"Capstone Evidence Board","requiresContext":false,"academyApproved":true,"fidelity":"conceptual"} */
import { AcademyChecklistLab } from "@/sims/shared/academy-interaction-ui";

export type CapstoneEvidence = {
  requirement: boolean;
  design: boolean;
  implementation: boolean;
  tests: boolean;
  failure: boolean;
  safety: boolean;
  limits: boolean;
};
export type CapstoneReview = {
  ready: boolean;
  title: "INCOMPLETE" | "READY FOR REVIEW";
  nextAction: string;
  complete: number;
  total: number;
};

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
    ? { ready: false, title: "INCOMPLETE", nextAction: missing.next, complete, total: CHECKS.length }
    : { ready: true, title: "READY FOR REVIEW", nextAction: "Ask a teammate to challenge one claim and one missing boundary before editorial review.", complete, total: CHECKS.length };
}

const DEFAULTS: CapstoneEvidence = { requirement: false, design: false, implementation: false, tests: false, failure: false, safety: false, limits: false };

export default function CapstoneEvidenceBoard() {
  return (
    <AcademyChecklistLab
      titleId="capstone-board-title"
      title="Capstone Evidence Board"
      eyebrow="Local self-check"
      description="Mark only evidence that is actually in your packet. The first missing section becomes the next action."
      initialValues={DEFAULTS}
      checks={CHECKS}
      legend="Evidence packet sections"
      resultHeading="Review result"
      review={reviewCapstoneEvidence}
      renderSummary={(review) => (
        <p className="mt-4 text-sm text-marble/80">
          Sections recorded: <strong className="text-white">{review.complete} of {review.total}</strong>
        </p>
      )}
      limit="These self-reported boxes do not inspect a project, verify source links, run tests, review student work, approve website publication, authorize physical operation, or prove a capstone claim."
    />
  );
}
