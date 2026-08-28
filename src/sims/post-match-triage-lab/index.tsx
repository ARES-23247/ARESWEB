/** @sim {"name":"Post-Match Triage Lab","requiresContext":false,"academyApproved":true,"fidelity":"conceptual"} */
import { useMemo, useState } from "react";
import { RotateCcw } from "lucide-react";

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
  const [record, setRecord] = useState<PostMatchRecord>({ ...EMPTY_POST_MATCH_RECORD });
  const result = useMemo(() => reviewPostMatchRecord(record), [record]);
  const reset = () => setRecord({ ...EMPTY_POST_MATCH_RECORD });

  return (
    <section aria-labelledby="post-match-triage-title" className="my-8 rounded-xl border border-ares-cyan/30 bg-black/35 p-4 sm:p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-ares-cyan">Ordered handoff</p>
          <h3 id="post-match-triage-title" className="mt-1 text-xl font-black text-white">Post-Match Triage Lab</h3>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-marble/80">
            Build a paper handoff from safe return to one bounded next test. The first missing record stays visible.
          </p>
        </div>
        <button type="button" onClick={reset} className="mt-2 inline-flex min-h-11 items-center justify-center gap-2 rounded border border-white/20 px-4 py-2 text-sm font-bold text-white hover:border-ares-cyan focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan sm:mt-0">
          <RotateCcw aria-hidden="true" size={16} /> Reset
        </button>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(17rem,0.8fr)]">
        <fieldset className="grid gap-3 rounded-lg border border-white/10 bg-white/5 p-4">
          <legend className="px-2 text-sm font-bold text-ares-gold">Self-reported handoff evidence</legend>
          {CHECKS.map((check) => (
            <label key={check.key} className="flex min-h-11 items-start gap-3 rounded border border-white/10 p-3 text-sm leading-relaxed text-white">
              <input
                type="checkbox"
                checked={record[check.key]}
                onChange={(event) => {
                  const checked = event.currentTarget.checked;
                  setRecord((current) => ({ ...current, [check.key]: checked }));
                }}
                className="mt-0.5 size-5 shrink-0 accent-ares-red"
              />
              <span>{check.label}</span>
            </label>
          ))}
        </fieldset>

        <div aria-live="polite" aria-atomic="true" className="rounded-lg border border-white/10 bg-obsidian p-4">
          <h4 className="text-sm font-bold uppercase tracking-wider text-ares-gold">Next handoff step</h4>
          <p className={`mt-4 border-l-4 p-3 text-sm font-bold ${result.ready ? "border-emerald-400 bg-emerald-400/10 text-emerald-100" : "border-ares-red bg-ares-red/10 text-white"}`}>{result.title}</p>
          <p className="mt-4 text-sm leading-relaxed text-marble/80">{result.nextAction}</p>
        </div>
      </div>

      <p role="note" className="mt-5 border-l-4 border-ares-gold/60 bg-ares-gold/10 p-3 text-sm leading-relaxed text-white">
        <strong>Evidence limit:</strong> Every box is self-reported. The lab cannot disable or inspect a robot, preserve a log, identify damage, diagnose a cause, assign a real person, approve a repair, authorize motion, or decide that a robot may return to play.
      </p>
    </section>
  );
}
