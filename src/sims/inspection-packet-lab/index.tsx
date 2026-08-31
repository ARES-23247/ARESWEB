/** @sim {"name":"Inspection Packet Evidence Lab","requiresContext":false,"academyApproved":true,"fidelity":"conceptual"} */
import { AcademyChecklistLab } from "@/sims/shared/academy-interaction-ui";

export type InspectionPacketRecord = {
  authority: boolean;
  revision: boolean;
  robotIdentity: boolean;
  itemEvidence: boolean;
  openItems: boolean;
  recheckTriggers: boolean;
};

export type InspectionPacketReview = {
  ready: boolean;
  title: "Continue the packet" | "Ready for a practice handoff";
  nextAction: string;
};

export const EMPTY_INSPECTION_PACKET: InspectionPacketRecord = {
  authority: false,
  revision: false,
  robotIdentity: false,
  itemEvidence: false,
  openItems: false,
  recheckTriggers: false,
};

const CHECKS: { key: keyof InspectionPacketRecord; label: string }[] = [
  { key: "authority", label: "Official FIRST source page recorded" },
  { key: "revision", label: "Season, title, revision, and retrieval date recorded" },
  { key: "robotIdentity", label: "Robot build and configuration identified" },
  { key: "itemEvidence", label: "Checklist rows have results and evidence methods" },
  { key: "openItems", label: "Unknown, changed, and needs-work items remain visible" },
  { key: "recheckTriggers", label: "Changes trigger a recheck" },
];

const NEXT_ACTIONS: Array<[keyof InspectionPacketRecord, string]> = [
  ["authority", "Start at the official FIRST season or event page."],
  ["revision", "Record the current document identity, or clearly mark the checklist as pending."],
  ["robotIdentity", "Name the build, configuration, calibration, and hardware identity."],
  ["itemEvidence", "Use not checked, pass, needs work, or a sourced not-applicable note. Do not guess."],
  ["openItems", "Keep every open item visible until it is resolved."],
  ["recheckTriggers", "List which packet rows become stale after a document or robot change."],
];

export function reviewInspectionPacket(record: InspectionPacketRecord): InspectionPacketReview {
  const missing = NEXT_ACTIONS.find(([key]) => !record[key]);
  return missing
    ? { ready: false, title: "Continue the packet", nextAction: missing[1] }
    : {
      ready: true,
      title: "Ready for a practice handoff",
      nextAction: "Rehearse the handoff. Keep unknowns visible. Only an official inspector records the result.",
    };
}

export default function InspectionPacketLab() {
  return (
    <AcademyChecklistLab
      titleId="inspection-packet-lab-title"
      title="Inspection Packet Evidence Lab"
      eyebrow="Inspection rehearsal"
      description="Mark facts written in this practice packet."
      initialValues={EMPTY_INSPECTION_PACKET}
      checks={CHECKS}
      legend="Evidence present in the practice packet"
      resultHeading="Packet review"
      review={reviewInspectionPacket}
      limit="It does not load FIRST rules, inspect a robot, save a packet, or approve inspection."
      limitLabel="Evidence limit"
      resetLabel="Reset packet"
    />
  );
}
