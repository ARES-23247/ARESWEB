/** @sim {"name":"Tool Task Evidence Lab","requiresContext":false,"academyApproved":true,"fidelity":"conceptual"} */
import { useMemo, useState } from "react";
import { RotateCcw } from "lucide-react";
import { AcademyCheckboxControl } from "@/sims/shared/academy-interaction-ui";

export type ToolTask = "measure" | "hold" | "shape" | "assemble" | "electrical";

export type ToolEvidence = {
  exactToolRecorded: boolean;
  materialAndTaskRecorded: boolean;
  approvedInstructionsAttached: boolean;
  workAreaPlanRecorded: boolean;
  trainingAndProtectionRecorded: boolean;
  isolationAndStopRecorded: boolean;
};

export type ToolReviewResult = {
  reviewPath: string;
  ready: boolean;
  nextAction: string;
  missingKey?: keyof ToolEvidence;
};

export const EMPTY_TOOL_EVIDENCE: ToolEvidence = {
  exactToolRecorded: false,
  materialAndTaskRecorded: false,
  approvedInstructionsAttached: false,
  workAreaPlanRecorded: false,
  trainingAndProtectionRecorded: false,
  isolationAndStopRecorded: false,
};

const CHECKS: Array<{ key: keyof ToolEvidence; label: string; action: string }> = [
  { key: "exactToolRecorded", label: "The exact available tool is identified.", action: "Record the exact team tool and its current condition. Do not substitute from memory." },
  { key: "materialAndTaskRecorded", label: "The material, size, and bounded task are recorded.", action: "Describe what must change and the material or part involved." },
  { key: "approvedInstructionsAttached", label: "Approved instructions for that exact tool are attached.", action: "Attach the current manufacturer and team guidance before planning use." },
  { key: "workAreaPlanRecorded", label: "Workholding, support, and a clear work area are planned.", action: "Record how the work stays supported and how the work area stays clear." },
  { key: "trainingAndProtectionRecorded", label: "Required training and protective steps are recorded.", action: "Use the approved instructions and team process to record training and protective requirements." },
  { key: "isolationAndStopRecorded", label: "Energy isolation, inspection, and stop conditions are recorded.", action: "Record isolation, pre-use inspection, stop conditions, and the post-task check." },
];

const REVIEW_PATHS: Record<ToolTask, string> = {
  measure: "Start with a measurement and marking tool review.",
  hold: "Start with a workholding and support tool review.",
  shape: "Start with a material-shaping tool review.",
  assemble: "Start with an assembly and fastener tool review.",
  electrical: "Start with an electrical preparation tool review.",
};

export function reviewToolTask(task: ToolTask, evidence: ToolEvidence): ToolReviewResult {
  const firstMissing = CHECKS.find((check) => !evidence[check.key]);
  if (firstMissing) {
    return {
      reviewPath: REVIEW_PATHS[task],
      ready: false,
      nextAction: firstMissing.action,
      missingKey: firstMissing.key,
    };
  }
  return {
    reviewPath: REVIEW_PATHS[task],
    ready: true,
    nextAction: "The paper preflight is ready for current team-process review. It does not authorize tool use.",
  };
}

export default function ToolChoiceScenarios() {
  const [task, setTask] = useState<ToolTask>("measure");
  const [evidence, setEvidence] = useState<ToolEvidence>({ ...EMPTY_TOOL_EVIDENCE });
  const result = useMemo(() => reviewToolTask(task, evidence), [task, evidence]);
  const reset = () => {
    setTask("measure");
    setEvidence({ ...EMPTY_TOOL_EVIDENCE });
  };

  return (
    <section aria-labelledby="tool-task-title" className="my-8 rounded-xl border border-ares-cyan/30 bg-black/35 p-4 sm:p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-ares-cyan">Paper preflight</p>
          <h3 id="tool-task-title" className="mt-1 text-xl font-black text-white">Tool Task Evidence Lab</h3>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-marble/80">
            Match a task to a review category, then collect the evidence needed before the team's current tool process begins.
          </p>
        </div>
        <button type="button" onClick={reset} className="mt-2 inline-flex min-h-11 items-center justify-center gap-2 rounded border border-white/20 px-4 py-2 text-sm font-bold text-white hover:border-ares-cyan focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan sm:mt-0">
          <RotateCcw aria-hidden="true" size={16} /> Reset
        </button>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(17rem,0.8fr)]">
        <div className="grid gap-5">
          <label className="grid gap-2 text-sm font-semibold text-white">
            Bounded task
            <select value={task} onChange={(event) => setTask(event.currentTarget.value as ToolTask)} className="min-h-11 rounded border border-white/20 bg-obsidian px-3 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan">
              <option value="measure">Measure or mark a part</option>
              <option value="hold">Hold or support work</option>
              <option value="shape">Cut, drill, or shape material</option>
              <option value="assemble">Assemble or tighten a joint</option>
              <option value="electrical">Prepare an electrical connection</option>
            </select>
          </label>

          <fieldset className="grid gap-3 rounded-lg border border-white/10 bg-white/5 p-4">
            <legend className="px-2 text-sm font-bold text-ares-gold">Self-reported preflight evidence</legend>
            {CHECKS.map((check) => (
              <AcademyCheckboxControl key={check.key} label={check.label} checked={evidence[check.key]} onChange={(checked) => setEvidence((current) => ({ ...current, [check.key]: checked }))} />
            ))}
          </fieldset>
        </div>

        <div aria-live="polite" aria-atomic="true" className="rounded-lg border border-white/10 bg-obsidian p-4">
          <h4 className="text-sm font-bold uppercase tracking-wider text-ares-gold">Review path</h4>
          <p className="mt-4 border-l-4 border-ares-cyan bg-ares-cyan/10 p-3 text-sm font-bold text-white">{result.reviewPath}</p>
          <h4 className="mt-6 text-sm font-bold uppercase tracking-wider text-ares-gold">Next paper step</h4>
          <p className={`mt-3 border-l-4 p-3 text-sm leading-relaxed ${result.ready ? "border-emerald-400 bg-emerald-400/10 text-emerald-100" : "border-ares-red bg-ares-red/10 text-white"}`}>{result.nextAction}</p>
        </div>
      </div>

      <p role="note" className="mt-5 border-l-4 border-ares-gold/60 bg-ares-gold/10 p-3 text-sm leading-relaxed text-white">
        <strong>Evidence limit:</strong> The lab does not identify a real tool, inspect its condition, read instructions, choose protective equipment, verify training, secure work, remove energy, supervise work, or authorize tool use.
      </p>
    </section>
  );
}
