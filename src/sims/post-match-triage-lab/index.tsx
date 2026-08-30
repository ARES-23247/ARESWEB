/** @sim {"name":"Post-Match Triage Lab","requiresContext":false,"academyApproved":true,"fidelity":"conceptual"} */
import { AcademyChecklistLab } from "@/sims/shared/academy-interaction-ui";

export type PostMatchRecord = {
  safeStateRecorded: boolean;
  observationRecorded: boolean;
  sourcePreserved: boolean;
  inspectionBoundaryRecorded: boolean;
  ownerAndStopRecorded: boolean;
  nextTestRecorded: boolean;
  returnDecisionRecorded: boolean;
};

export type PostMatchResult =
  | { ready: true; title: string; nextAction: string }
  | { ready: false; title: string; nextAction: string; missingKey: keyof PostMatchRecord };

export const EMPTY_POST_MATCH_RECORD: PostMatchRecord = {
  safeStateRecorded: false,
  observationRecorded: false,
  sourcePreserved: false,
  inspectionBoundaryRecorded: false,
  ownerAndStopRecorded: false,
  nextTestRecorded: false,
  returnDecisionRecorded: false,
};

const CHECKS: Array<{ key: keyof PostMatchRecord; label: string; action: string }> = [
  { key: "safeStateRecorded", label: "The record begins with the robot's safe state.", action: "Record the disabled, neutral, and handling boundary before diagnosis or repair." },
  { key: "observationRecorded", label: "Observed symptoms are separate from possible causes.", action: "Write what happened, when it happened, and what remained unknown." },
  { key: "sourcePreserved", label: "Logs, notes, and configuration identity are preserved.", action: "Preserve the original evidence and record the matching project and inventory identity." },
  { key: "inspectionBoundaryRecorded", label: "The visual and physical inspection boundary is named.", action: "List allowed disabled checks and leave powered or disassembly steps to the current team process." },
  { key: "ownerAndStopRecorded", label: "Each next action has an owner and stop condition.", action: "Assign one owner and write the fact that stops each action." },
  { key: "nextTestRecorded", label: "The smallest discriminating test is recorded.", action: "Choose one bounded test that separates possible causes without changing several things." },
  { key: "returnDecisionRecorded", label: "Return, repair, or hold status is explicit.", action: "Record the current status and the evidence required before it can change." },
];

export function reviewPostMatchRecord(record: PostMatchRecord): PostMatchResult {
  const firstMissing = CHECKS.find((check) => !record[check.key]);
  if (firstMissing) {
    return {
      ready: false,
      title: `Handoff blocked at: ${firstMissing.label}`,
      nextAction: firstMissing.action,
      missingKey: firstMissing.key,
    };
  }
  return {
    ready: true,
    title: "The lesson handoff contains every required record.",
    nextAction: "Preserve it for team process review. The checklist does not authorize repair, powered testing, or return to play.",
  };
}

export default function PostMatchTriageLab() {
  return (
    <AcademyChecklistLab
      titleId="post-match-triage-title"
      title="Post-Match Triage Lab"
      eyebrow="Ordered handoff"
      description="Build a paper handoff from safe return to one bounded next test. The first missing record stays visible."
      initialValues={EMPTY_POST_MATCH_RECORD}
      checks={CHECKS}
      legend="Self-reported handoff evidence"
      resultHeading="Next handoff step"
      review={reviewPostMatchRecord}
      limitLabel="Evidence limit"
      limit="Every box is self-reported. The lab cannot disable or inspect a robot, preserve a log, identify damage, diagnose a cause, assign a real person, approve a repair, authorize motion, or decide that a robot may return to play."
    />
  );
}
