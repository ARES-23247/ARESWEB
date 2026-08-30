/** @sim {"name":"Match Cycle Handoff Scenarios","requiresContext":false,"academyApproved":true,"fidelity":"conceptual"} */
import { useMemo, useState } from "react";
import { RotateCcw } from "lucide-react";
import { AcademyChecklistPanel } from "@/sims/shared/academy-interaction-ui";

export type MatchCyclePhase = "pit-to-queue" | "field-setup" | "post-match-return";
export type MatchCycleCheckKey =
  | "safeStateRecorded"
  | "phasePlanRecorded"
  | "changedFactRecorded"
  | "receiverRepeatRecorded"
  | "writtenRecordSaved";

export type MatchCycleRecord = Record<MatchCycleCheckKey, boolean>;

type MatchCycleCheck = {
  key: MatchCycleCheckKey;
  label: string;
  action: string;
};

type MatchCycleScenario = {
  id: MatchCyclePhase;
  label: string;
  prompt: string;
  checks: MatchCycleCheck[];
};

export type MatchCycleReview =
  | { ready: true; title: string; nextAction: string }
  | { ready: false; title: string; nextAction: string; missingKey: MatchCycleCheckKey };

export const EMPTY_MATCH_CYCLE_RECORD: MatchCycleRecord = {
  safeStateRecorded: false,
  phasePlanRecorded: false,
  changedFactRecorded: false,
  receiverRepeatRecorded: false,
  writtenRecordSaved: false,
};

export const MATCH_CYCLE_SCENARIOS: MatchCycleScenario[] = [
  {
    id: "pit-to-queue",
    label: "Pit to queue",
    prompt: "Rehearse the handoff before the robot leaves the pit.",
    checks: [
      { key: "safeStateRecorded", label: "The known robot state is named.", action: "Name the disabled or other required safe handling state." },
      { key: "phasePlanRecorded", label: "The selected routine or intended plan is named.", action: "Record the exact routine or plan selected for this rehearsal." },
      { key: "changedFactRecorded", label: "A changed, limited, or unknown fact is visible.", action: "State one change, limit, or unknown instead of hiding it." },
      { key: "receiverRepeatRecorded", label: "The queue receiver repeats the key state.", action: "Have the receiver repeat the robot state, plan, and limit." },
      { key: "writtenRecordSaved", label: "The rehearsal handoff is written down.", action: "Save the same facts in the paper rehearsal record." },
    ],
  },
  {
    id: "field-setup",
    label: "Queue to field setup",
    prompt: "Rehearse the last transfer before the practice match begins.",
    checks: [
      { key: "safeStateRecorded", label: "The setup and safe-state boundary is named.", action: "Record the current setup state without inventing an event rule." },
      { key: "phasePlanRecorded", label: "The starting plan and routine are named.", action: "State the intended start and selected routine." },
      { key: "changedFactRecorded", label: "Any late change or unknown stays visible.", action: "Name the late change or stop to ask for the reviewed event process." },
      { key: "receiverRepeatRecorded", label: "The operator repeats the final call.", action: "Have the operator repeat the setup, routine, and known limit." },
      { key: "writtenRecordSaved", label: "The setup statement is recorded.", action: "Add the repeated final call to the rehearsal packet." },
    ],
  },
  {
    id: "post-match-return",
    label: "Match to pit return",
    prompt: "Rehearse a fact-based return and evidence handoff.",
    checks: [
      { key: "safeStateRecorded", label: "The disabled and handling state is named.", action: "Record the safe return state before inspection or repair." },
      { key: "phasePlanRecorded", label: "The run and local-log identity are named.", action: "Record the rehearsal run and whether the local log closed." },
      { key: "changedFactRecorded", label: "The observed symptom is separate from a cause.", action: "Write what happened and leave the untested cause as unknown." },
      { key: "receiverRepeatRecorded", label: "The pit receiver repeats the important facts.", action: "Have the receiver repeat the safe state, symptom, and evidence status." },
      { key: "writtenRecordSaved", label: "The debrief and next question are recorded.", action: "Save the observation and one bounded next question." },
    ],
  },
];

export function reviewMatchCycleHandoff(
  phase: MatchCyclePhase,
  record: MatchCycleRecord,
): MatchCycleReview {
  const scenario = MATCH_CYCLE_SCENARIOS.find((item) => item.id === phase)
    ?? MATCH_CYCLE_SCENARIOS[0];
  const firstMissing = scenario.checks.find((check) => !record[check.key]);
  if (firstMissing) {
    return {
      ready: false,
      title: `Handoff needs: ${firstMissing.label}`,
      nextAction: firstMissing.action,
      missingKey: firstMissing.key,
    };
  }
  return {
    ready: true,
    title: "The rehearsal handoff records all five lesson facts.",
    nextAction: "Repeat it aloud, preserve the paper record, and send the proposed process for team review before using it at an event.",
  };
}

export default function MatchCycleScenarios() {
  const [phase, setPhase] = useState<MatchCyclePhase>("pit-to-queue");
  const [record, setRecord] = useState<MatchCycleRecord>({ ...EMPTY_MATCH_CYCLE_RECORD });
  const scenario = MATCH_CYCLE_SCENARIOS.find((item) => item.id === phase)
    ?? MATCH_CYCLE_SCENARIOS[0];
  const result = useMemo(() => reviewMatchCycleHandoff(phase, record), [phase, record]);
  const checkedCount = Object.values(record).filter(Boolean).length;

  const choosePhase = (nextPhase: MatchCyclePhase) => {
    setPhase(nextPhase);
    setRecord({ ...EMPTY_MATCH_CYCLE_RECORD });
  };
  const reset = () => {
    setPhase("pit-to-queue");
    setRecord({ ...EMPTY_MATCH_CYCLE_RECORD });
  };

  return (
    <section aria-labelledby="match-cycle-scenarios-title" className="my-8 rounded-xl border border-ares-cyan/30 bg-black/35 p-4 sm:p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-ares-cyan">Rehearsal handoffs</p>
          <h3 id="match-cycle-scenarios-title" className="mt-1 text-xl font-black text-white">Match Cycle Handoff Scenarios</h3>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-marble/80">
            Choose one phase. Check only facts your paper rehearsal actually contains. The first missing fact stays visible.
          </p>
        </div>
        <button type="button" onClick={reset} className="mt-2 inline-flex min-h-11 items-center justify-center gap-2 rounded border border-white/20 px-4 py-2 text-sm font-bold text-white hover:border-ares-cyan focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan sm:mt-0">
          <RotateCcw aria-hidden="true" size={16} /> Reset rehearsal
        </button>
      </div>

      <fieldset className="mt-6 grid gap-3 sm:grid-cols-3">
        <legend className="mb-2 text-sm font-bold text-ares-gold">Choose a handoff phase</legend>
        {MATCH_CYCLE_SCENARIOS.map((item) => (
          <label key={item.id} className="flex min-h-11 cursor-pointer items-center gap-3 rounded border border-white/15 bg-white/5 p-3 text-sm font-semibold text-white focus-within:ring-2 focus-within:ring-ares-cyan">
            <input
              type="radio"
              name="match-cycle-phase"
              value={item.id}
              checked={phase === item.id}
              onChange={() => choosePhase(item.id)}
              className="size-5 shrink-0 accent-ares-red"
            />
            <span>{item.label}</span>
          </label>
        ))}
      </fieldset>

      <p className="mt-4 border-l-4 border-ares-cyan bg-ares-cyan/10 p-3 text-sm leading-relaxed text-white">
        {scenario.prompt}
      </p>

      <AcademyChecklistPanel
        checks={scenario.checks}
        values={record}
        onChange={(key, checked) => setRecord((current) => ({ ...current, [key]: checked }))}
        legend="Facts present in this rehearsal"
        resultHeading="Handoff review"
        result={result}
        summary={(
          <dl className="mt-4 grid gap-3 text-sm">
            <div className="flex items-baseline justify-between gap-3 border-b border-white/10 pb-2">
              <dt className="text-marble/70">Phase</dt>
              <dd className="text-right font-semibold text-white">{scenario.label}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-3 border-b border-white/10 pb-2">
              <dt className="text-marble/70">Recorded facts</dt>
              <dd className="font-mono font-bold text-white">{checkedCount} of 5</dd>
            </div>
          </dl>
        )}
      />

      <p role="note" className="mt-5 border-l-4 border-ares-gold/60 bg-ares-gold/10 p-3 text-sm leading-relaxed text-white">
        <strong>Evidence limit:</strong> This conceptual lab reads only the boxes you select. It cannot read a robot or event system, verify a safe state, supply current game or queue rules, assign real team roles, preserve a log, or approve an event procedure.
      </p>
    </section>
  );
}
