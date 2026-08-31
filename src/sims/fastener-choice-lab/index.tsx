/** @sim {"name":"Fastener Joint Evidence Lab","requiresContext":false,"academyApproved":true,"fidelity":"conceptual"} */
import { useMemo, useState } from "react";
import {
  AcademyCheckboxControl,
  AcademyLabShell,
  AcademyModelLimit,
} from "@/sims/shared/academy-interaction-ui";

export type JointPurpose = "removablePanel" | "fixedBracket" | "rotatingPivot" | "serviceCover";

export type FastenerEvidence = {
  jointNeedRecorded: boolean;
  exactPartsRecorded: boolean;
  standardSourceAttached: boolean;
  matingAndEngagementRecorded: boolean;
  loadAndClearanceRecorded: boolean;
  retentionAndTorqueSourceAttached: boolean;
  inspectionAndServicePlanRecorded: boolean;
};

export type FastenerReviewResult = {
  reviewPath: string;
  ready: boolean;
  nextAction: string;
  missingKey?: keyof FastenerEvidence;
};

export const EMPTY_FASTENER_EVIDENCE: FastenerEvidence = {
  jointNeedRecorded: false,
  exactPartsRecorded: false,
  standardSourceAttached: false,
  matingAndEngagementRecorded: false,
  loadAndClearanceRecorded: false,
  retentionAndTorqueSourceAttached: false,
  inspectionAndServicePlanRecorded: false,
};

const CHECKS: Array<{ key: keyof FastenerEvidence; label: string; action: string }> = [
  { key: "jointNeedRecorded", label: "The joint's job and needed motion are recorded.", action: "Record what the joint must hold, align, or let move before naming hardware." },
  { key: "exactPartsRecorded", label: "The exact joined parts, materials, and thicknesses are recorded.", action: "Identify the exact parts, materials, thicknesses, and revision." },
  { key: "standardSourceAttached", label: "An approved source for the exact fastener standard is attached.", action: "Attach current manufacturer or standard documentation for the exact proposed hardware." },
  { key: "matingAndEngagementRecorded", label: "Mating threads, engagement, and non-threaded interfaces are recorded.", action: "Record every mating thread and interface using the approved source. Do not infer compatibility by appearance." },
  { key: "loadAndClearanceRecorded", label: "Load direction, alignment, access, and clearance are recorded.", action: "Draw the expected load direction and check alignment, tool access, and nearby clearance." },
  { key: "retentionAndTorqueSourceAttached", label: "Retention and tightening requirements have approved sources.", action: "Attach the source for retention, locking, and tightening requirements. Do not invent a torque." },
  { key: "inspectionAndServicePlanRecorded", label: "Inspection, marking, recheck, and service steps are recorded.", action: "Record how the joint will be inspected, marked, rechecked, and serviced without hiding wear or loosening." },
];

const REVIEW_PATHS: Record<JointPurpose, string> = {
  removablePanel: "Review a removable panel joint and repeatable alignment.",
  fixedBracket: "Review a fixed bracket joint and its load path.",
  rotatingPivot: "Review a pivot joint that must retain parts without clamping away motion.",
  serviceCover: "Review a frequently serviced cover and its access plan.",
};

export function reviewFastenerJoint(purpose: JointPurpose, evidence: FastenerEvidence): FastenerReviewResult {
  const firstMissing = CHECKS.find((check) => !evidence[check.key]);
  if (firstMissing) {
    return {
      reviewPath: REVIEW_PATHS[purpose],
      ready: false,
      nextAction: firstMissing.action,
      missingKey: firstMissing.key,
    };
  }
  return {
    reviewPath: REVIEW_PATHS[purpose],
    ready: true,
    nextAction: "The paper joint record is ready for team-process review. It does not select hardware or authorize assembly.",
  };
}

export default function FastenerChoiceLab() {
  const [purpose, setPurpose] = useState<JointPurpose>("removablePanel");
  const [evidence, setEvidence] = useState<FastenerEvidence>({ ...EMPTY_FASTENER_EVIDENCE });
  const result = useMemo(() => reviewFastenerJoint(purpose, evidence), [purpose, evidence]);
  const reset = () => {
    setPurpose("removablePanel");
    setEvidence({ ...EMPTY_FASTENER_EVIDENCE });
  };

  return (
    <AcademyLabShell
      titleId="fastener-lab-title"
      title="Fastener Joint Evidence Lab"
      eyebrow="Paper joint review"
      description="Start from the joint's job, then collect the evidence needed to review a real fastener proposal."
      onReset={reset}
    >

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(17rem,0.8fr)]">
        <div className="grid gap-5">
          <label className="grid gap-2 text-sm font-semibold text-white">
            Joint purpose
            <select value={purpose} onChange={(event) => setPurpose(event.currentTarget.value as JointPurpose)} className="min-h-11 rounded border border-white/20 bg-obsidian px-3 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan">
              <option value="removablePanel">Removable panel</option>
              <option value="fixedBracket">Fixed structural bracket</option>
              <option value="rotatingPivot">Rotating pivot</option>
              <option value="serviceCover">Frequently serviced cover</option>
            </select>
          </label>

          <fieldset className="grid gap-3 rounded-lg border border-white/10 bg-white/5 p-4">
            <legend className="px-2 text-sm font-bold text-ares-gold">Self-reported joint evidence</legend>
            {CHECKS.map((check) => (
              <AcademyCheckboxControl key={check.key} label={check.label} checked={evidence[check.key]} onChange={(checked) => setEvidence((current) => ({ ...current, [check.key]: checked }))} />
            ))}
          </fieldset>
        </div>

        <div aria-live="polite" aria-atomic="true" className="rounded-lg border border-white/10 bg-obsidian p-4">
          <h4 className="text-sm font-bold uppercase tracking-wider text-ares-gold">Joint review path</h4>
          <p className="mt-4 border-l-4 border-ares-cyan bg-ares-cyan/10 p-3 text-sm font-bold text-white">{result.reviewPath}</p>
          <h4 className="mt-6 text-sm font-bold uppercase tracking-wider text-ares-gold">Next paper step</h4>
          <p className={`mt-3 border-l-4 p-3 text-sm leading-relaxed ${result.ready ? "border-emerald-400 bg-emerald-400/10 text-emerald-100" : "border-ares-red bg-ares-red/10 text-white"}`}>{result.nextAction}</p>
        </div>
      </div>

      <AcademyModelLimit label="Evidence limit">The lab does not inspect a joint, identify thread size, verify compatibility, calculate strength or clamping force, choose a fastener, set torque, detect loosening, supervise assembly, or approve physical use.</AcademyModelLimit>
    </AcademyLabShell>
  );
}
