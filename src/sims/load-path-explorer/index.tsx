/** @sim {"name":"Load Path Evidence Explorer","requiresContext":false,"academyApproved":true,"fidelity":"conceptual"} */
import { useMemo, useState } from "react";
import { ArrowRight, RotateCcw } from "lucide-react";
import { AcademyCheckboxControl } from "@/sims/shared/academy-interaction-ui";

export type LoadScenario = "frontContact" | "armPayload" | "sideMechanism" | "hangingSupport";

export type LoadPathEvidence = {
  inputRecorded: boolean;
  transferMembersRecorded: boolean;
  jointRecordsLinked: boolean;
  reactionRecorded: boolean;
  directionChangesRecorded: boolean;
  openPointRecorded: boolean;
  clearanceAndTestPlanRecorded: boolean;
};

export type LoadPathResult = {
  stages: [string, string, string, string];
  ready: boolean;
  nextAction: string;
  missingKey?: keyof LoadPathEvidence;
};

export const EMPTY_LOAD_PATH_EVIDENCE: LoadPathEvidence = {
  inputRecorded: false,
  transferMembersRecorded: false,
  jointRecordsLinked: false,
  reactionRecorded: false,
  directionChangesRecorded: false,
  openPointRecorded: false,
  clearanceAndTestPlanRecorded: false,
};

const SCENARIOS: Record<LoadScenario, [string, string, string, string]> = {
  frontContact: ["front contact", "bumper or guard mounts", "frame members and joints", "wheel-ground support"],
  armPayload: ["payload at arm", "arm link and pivot", "mechanism mount and frame", "wheel-ground support"],
  sideMechanism: ["side force at mechanism", "bracket and joint", "cross member and frame", "wheel-ground support"],
  hangingSupport: ["support contact", "hook or attachment", "frame members and joints", "robot weight"],
};

const CHECKS: Array<{ key: keyof LoadPathEvidence; label: string; action: string }> = [
  { key: "inputRecorded", label: "The input force location and direction are recorded.", action: "Mark where the force enters the paper model and draw its direction." },
  { key: "transferMembersRecorded", label: "Every proposed transfer member is named in order.", action: "Trace the members from the input toward the support without jumping over a part." },
  { key: "jointRecordsLinked", label: "Every connection has a linked joint record.", action: "Link a joint evidence record at every place where the path crosses between parts." },
  { key: "reactionRecorded", label: "The support or reaction boundary is recorded.", action: "Name where the paper path ends and what supports the robot or mechanism." },
  { key: "directionChangesRecorded", label: "Turns, offsets, and direction changes are marked.", action: "Mark every turn or offset. Do not treat a bent path as a straight one." },
  { key: "openPointRecorded", label: "The weakest or still-unknown point is recorded as open.", action: "Name the first unsupported claim, missing source, or unknown connection." },
  { key: "clearanceAndTestPlanRecorded", label: "Clearance, inspection, and a bounded later test are recorded.", action: "Add clearance and inspection needs, then name the smallest later evidence step without claiming validation." },
];

export function reviewLoadPath(scenario: LoadScenario, evidence: LoadPathEvidence): LoadPathResult {
  const firstMissing = CHECKS.find((check) => !evidence[check.key]);
  if (firstMissing) {
    return {
      stages: SCENARIOS[scenario],
      ready: false,
      nextAction: firstMissing.action,
      missingKey: firstMissing.key,
    };
  }
  return {
    stages: SCENARIOS[scenario],
    ready: true,
    nextAction: "The conceptual path record is ready for team-process review. It does not prove strength or safe loading.",
  };
}

export default function LoadPathExplorer() {
  const [scenario, setScenario] = useState<LoadScenario>("frontContact");
  const [evidence, setEvidence] = useState<LoadPathEvidence>({ ...EMPTY_LOAD_PATH_EVIDENCE });
  const result = useMemo(() => reviewLoadPath(scenario, evidence), [scenario, evidence]);
  const reset = () => {
    setScenario("frontContact");
    setEvidence({ ...EMPTY_LOAD_PATH_EVIDENCE });
  };

  return (
    <section aria-labelledby="load-path-title" className="my-8 rounded-xl border border-ares-cyan/30 bg-black/35 p-4 sm:p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-ares-cyan">Conceptual force route</p>
          <h3 id="load-path-title" className="mt-1 text-xl font-black text-white">Load Path Evidence Explorer</h3>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-marble/80">
            Trace where a force may enter, cross members and joints, and reach a support. Keep every strength claim open.
          </p>
        </div>
        <button type="button" onClick={reset} className="mt-2 inline-flex min-h-11 items-center justify-center gap-2 rounded border border-white/20 px-4 py-2 text-sm font-bold text-white hover:border-ares-cyan focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan sm:mt-0">
          <RotateCcw aria-hidden="true" size={16} /> Reset
        </button>
      </div>

      <label className="mt-6 grid max-w-xl gap-2 text-sm font-semibold text-white">
        Practice scenario
        <select value={scenario} onChange={(event) => setScenario(event.currentTarget.value as LoadScenario)} className="min-h-11 rounded border border-white/20 bg-obsidian px-3 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan">
          <option value="frontContact">Front contact into the chassis</option>
          <option value="armPayload">Payload held by an arm</option>
          <option value="sideMechanism">Side force on a mechanism</option>
          <option value="hangingSupport">Robot supported from above</option>
        </select>
      </label>

      <ol aria-label="Conceptual load path" className="mt-5 grid gap-2 sm:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr] sm:items-stretch">
        {result.stages.map((stage, index) => (
          <li key={stage} className="contents">
            <span className="flex min-h-16 items-center justify-center rounded border border-white/15 bg-white/5 p-3 text-center text-sm font-bold text-white">{stage}</span>
            {index < result.stages.length - 1 ? <ArrowRight aria-hidden="true" className="mx-auto rotate-90 self-center text-ares-cyan sm:rotate-0" /> : null}
          </li>
        ))}
      </ol>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(17rem,0.8fr)]">
        <fieldset className="grid gap-3 rounded-lg border border-white/10 bg-white/5 p-4">
          <legend className="px-2 text-sm font-bold text-ares-gold">Self-reported path evidence</legend>
          {CHECKS.map((check) => (
            <AcademyCheckboxControl key={check.key} label={check.label} checked={evidence[check.key]} onChange={(checked) => setEvidence((current) => ({ ...current, [check.key]: checked }))} />
          ))}
        </fieldset>

        <div aria-live="polite" aria-atomic="true" className="rounded-lg border border-white/10 bg-obsidian p-4">
          <h4 className="text-sm font-bold uppercase tracking-wider text-ares-gold">Next paper step</h4>
          <p className={`mt-3 border-l-4 p-3 text-sm leading-relaxed ${result.ready ? "border-emerald-400 bg-emerald-400/10 text-emerald-100" : "border-ares-red bg-ares-red/10 text-white"}`}>{result.nextAction}</p>
        </div>
      </div>

      <p role="note" className="mt-5 border-l-4 border-ares-gold/60 bg-ares-gold/10 p-3 text-sm leading-relaxed text-white">
        <strong>Model limit:</strong> This explorer does not calculate force, stress, stiffness, bending, buckling, impact, fatigue, safety factor, joint capacity, traction, or stability. It cannot inspect a robot, choose material or geometry, authorize loading, or prove a structure safe.
      </p>
    </section>
  );
}
