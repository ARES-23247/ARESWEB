/** @sim {"name":"Wiring Plan Diagnostic Lab","requiresContext":false,"academyApproved":true,"fidelity":"conceptual"} */
import { AcademyChecklistLab } from "@/sims/shared/academy-interaction-ui";

export type WiringReview = {
  sourceIsolated: boolean;
  identityMatches: boolean;
  polarityRecorded: boolean;
  connectionPlanRecorded: boolean;
  routingAndReliefRecorded: boolean;
  protectionSourceRecorded: boolean;
};

export type WiringReviewResult =
  | { ready: true; title: string; nextAction: string }
  | { ready: false; title: string; nextAction: string; missingKey: keyof WiringReview };

export const EMPTY_WIRING_REVIEW: WiringReview = {
  sourceIsolated: false,
  identityMatches: false,
  polarityRecorded: false,
  connectionPlanRecorded: false,
  routingAndReliefRecorded: false,
  protectionSourceRecorded: false,
};

const CHECKS: Array<{ key: keyof WiringReview; label: string; action: string }> = [
  { key: "sourceIsolated", label: "The plan begins with the energy source isolated.", action: "Record how the energy source stays isolated during the paper review." },
  { key: "identityMatches", label: "Device identity matches the canonical inventory.", action: "Match the device name, connection type, bus or parent, and address or channel." },
  { key: "polarityRecorded", label: "Polarity or direction-sensitive pins are recorded.", action: "Mark positive, negative, signal, and direction-sensitive pins from approved sources." },
  { key: "connectionPlanRecorded", label: "The connector and termination plan has a source.", action: "Record the exact connector or termination and the source that defines its use." },
  { key: "routingAndReliefRecorded", label: "Routing, movement, and strain-relief needs are recorded.", action: "Mark moving zones, pinch or sharp-edge risks, service loops, support, and strain relief." },
  { key: "protectionSourceRecorded", label: "Protection and current-limit choices point to current sources.", action: "Attach the current league and component sources before choosing protection or conductor ratings." },
];

export function reviewWiringPlan(review: WiringReview): WiringReviewResult {
  const firstMissing = CHECKS.find((check) => !review[check.key]);
  if (firstMissing) {
    return {
      ready: false,
      title: `Plan blocked at: ${firstMissing.label}`,
      nextAction: firstMissing.action,
      missingKey: firstMissing.key,
    };
  }
  return {
    ready: true,
    title: "The paper plan contains every lesson check.",
    nextAction: "Preserve the record for team review. It still needs authentic inspection and physical evidence.",
  };
}

export default function WiringDiagnosticLab() {
  return (
    <AcademyChecklistLab
      titleId="wiring-diagnostic-title"
      title="Wiring Plan Diagnostic Lab"
      eyebrow="Paper-plan checklist"
      description="Build an ordered evidence record for one invented connection. The first missing check becomes the next paper task."
      initialValues={EMPTY_WIRING_REVIEW}
      checks={CHECKS}
      legend="Self-reported plan evidence"
      resultHeading="Next diagnostic step"
      review={reviewWiringPlan}
      limitLabel="Evidence limit"
      limit="Every box is self-reported. This lab cannot inspect a wire, identify a connector, verify polarity, find damage, measure continuity, choose a conductor or protection rating, energize a circuit, or prove that a robot is wired correctly."
    />
  );
}
