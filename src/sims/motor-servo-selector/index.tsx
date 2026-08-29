/** @sim {"name":"Motor and Servo Evidence Sorter","requiresContext":false,"academyApproved":true,"fidelity":"conceptual"} */
import { useMemo, useState } from "react";
import { RotateCcw } from "lucide-react";

export type MotionNeed = "continuous-speed" | "bounded-angle" | "multi-turn-position";

export type ActuatorEvidence = {
  outputDefined: boolean;
  transmissionRecorded: boolean;
  manufacturerSourceAttached: boolean;
  feedbackPlanRecorded: boolean;
  safetyPlanRecorded: boolean;
};

export type ActuatorReviewResult = {
  startingPath: string;
  ready: boolean;
  nextAction: string;
  missingKey?: keyof ActuatorEvidence;
};

export const EMPTY_ACTUATOR_EVIDENCE: ActuatorEvidence = {
  outputDefined: false,
  transmissionRecorded: false,
  manufacturerSourceAttached: false,
  feedbackPlanRecorded: false,
  safetyPlanRecorded: false,
};

const CHECKS: Array<{ key: keyof ActuatorEvidence; label: string; action: string }> = [
  { key: "outputDefined", label: "Required output motion and units are defined.", action: "Write the required speed, angle, or position range with units." },
  { key: "transmissionRecorded", label: "The ratio or direct-drive plan is recorded.", action: "Record the proposed transmission and show how motor motion becomes output motion." },
  { key: "manufacturerSourceAttached", label: "Current manufacturer specifications are attached.", action: "Attach an approved manufacturer source for every real actuator being compared." },
  { key: "feedbackPlanRecorded", label: "Feedback, homing, and validity needs are recorded.", action: "State what feedback is needed, how a reference is established, and what invalid data means." },
  { key: "safetyPlanRecorded", label: "Limits and a safe neutral are recorded.", action: "Define hard or soft boundaries, the safe neutral, and the response to a failed check." },
];

export function reviewActuatorEvidence(
  motionNeed: MotionNeed,
  evidence: ActuatorEvidence,
): ActuatorReviewResult {
  const startingPath = motionNeed === "continuous-speed"
    ? "Start with a motor or gearmotor comparison."
    : motionNeed === "bounded-angle"
      ? "Compare a sourced servo path with a position-controlled motor path."
      : "Start with a position-controlled motor or gearmotor comparison.";
  const firstMissing = CHECKS.find((check) => !evidence[check.key]);
  if (firstMissing) {
    return {
      startingPath,
      ready: false,
      nextAction: firstMissing.action,
      missingKey: firstMissing.key,
    };
  }
  return {
    startingPath,
    ready: true,
    nextAction: "The paper record is ready for team comparison. It has not selected or approved a real actuator.",
  };
}

export default function MotorServoSelector() {
  const [motionNeed, setMotionNeed] = useState<MotionNeed>("continuous-speed");
  const [evidence, setEvidence] = useState<ActuatorEvidence>({ ...EMPTY_ACTUATOR_EVIDENCE });
  const result = useMemo(() => reviewActuatorEvidence(motionNeed, evidence), [motionNeed, evidence]);
  const reset = () => {
    setMotionNeed("continuous-speed");
    setEvidence({ ...EMPTY_ACTUATOR_EVIDENCE });
  };

  return (
    <section aria-labelledby="motor-servo-title" className="my-8 rounded-xl border border-ares-cyan/30 bg-black/35 p-4 sm:p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-ares-cyan">Evidence path</p>
          <h3 id="motor-servo-title" className="mt-1 text-xl font-black text-white">Motor and Servo Evidence Sorter</h3>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-marble/80">
            Describe one motion need. Then build the evidence record needed before the team compares real actuators.
          </p>
        </div>
        <button type="button" onClick={reset} className="mt-2 inline-flex min-h-11 items-center justify-center gap-2 rounded border border-white/20 px-4 py-2 text-sm font-bold text-white hover:border-ares-cyan focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan sm:mt-0">
          <RotateCcw aria-hidden="true" size={16} /> Reset
        </button>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(17rem,0.8fr)]">
        <div className="grid gap-5">
          <label className="grid gap-2 text-sm font-semibold text-white">
            Needed output motion
            <select
              value={motionNeed}
              onChange={(event) => setMotionNeed(event.currentTarget.value as MotionNeed)}
              className="min-h-11 rounded border border-white/20 bg-obsidian px-3 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
            >
              <option value="continuous-speed">Continuous speed or rolling motion</option>
              <option value="bounded-angle">A bounded angle or short position range</option>
              <option value="multi-turn-position">A multi-turn position or long travel</option>
            </select>
          </label>

          <fieldset className="grid gap-3 rounded-lg border border-white/10 bg-white/5 p-4">
            <legend className="px-2 text-sm font-bold text-ares-gold">Self-reported comparison evidence</legend>
            {CHECKS.map((check) => (
              <label key={check.key} className="flex min-h-11 items-start gap-3 rounded border border-white/10 p-3 text-sm leading-relaxed text-white">
                <input
                  type="checkbox"
                  checked={evidence[check.key]}
                  onChange={(event) => {
                    const checked = event.currentTarget.checked;
                    setEvidence((current) => ({ ...current, [check.key]: checked }));
                  }}
                  className="mt-0.5 size-5 shrink-0 accent-ares-red"
                />
                <span>{check.label}</span>
              </label>
            ))}
          </fieldset>
        </div>

        <div aria-live="polite" aria-atomic="true" className="rounded-lg border border-white/10 bg-obsidian p-4">
          <h4 className="text-sm font-bold uppercase tracking-wider text-ares-gold">Starting path</h4>
          <p className="mt-4 border-l-4 border-ares-cyan bg-ares-cyan/10 p-3 text-sm font-bold text-white">{result.startingPath}</p>
          <h4 className="mt-6 text-sm font-bold uppercase tracking-wider text-ares-gold">Next evidence step</h4>
          <p className={`mt-3 border-l-4 p-3 text-sm leading-relaxed ${result.ready ? "border-emerald-400 bg-emerald-400/10 text-emerald-100" : "border-ares-red bg-ares-red/10 text-white"}`}>{result.nextAction}</p>
        </div>
      </div>

      <p role="note" className="mt-5 border-l-4 border-ares-gold/60 bg-ares-gold/10 p-3 text-sm leading-relaxed text-white">
        <strong>Evidence limit:</strong> The sorter reads only your selections. It cannot inspect a requirement, verify a specification, calculate load, heat, current, life, or strength, choose a product, command hardware, or approve physical operation.
      </p>
    </section>
  );
}
