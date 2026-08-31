/** @sim {"name":"Robot Input-to-Output Flow Tracer","requiresContext":false,"academyApproved":true,"fidelity":"conceptual"} */
import { useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import {
  AcademyDatum,
  AcademyLabShell,
  AcademyModelLimit,
} from "@/sims/shared/academy-interaction-ui";

export type FlowScenario = "driver" | "sensor";
export type FlowStage = { title: string; input: string; work: string; output: string };

const FLOW_STAGES: Record<FlowScenario, FlowStage[]> = {
  driver: [
    { title: "Driver input", input: "Stick or button sample", work: "The platform adapter reads one operator input.", output: "A named control value" },
    { title: "Binding", input: "Named control value", work: "The binding applies its event and threshold rules.", output: "A typed RobotAction" },
    { title: "Store and reducer", input: "Current state plus RobotAction", work: "A pure reducer calculates the next state without hardware access.", output: "Next immutable RobotState" },
    { title: "Controller and safety", input: "State plus cached inputs", work: "Control and safety logic calculate a bounded request.", output: "A checked output request" },
    { title: "Cached I/O write", input: "Checked output request", work: "The platform adapter writes the approved value to a device or mock.", output: "One output boundary result" },
    { title: "Telemetry and logs", input: "State and named signals", work: "Evidence is published after the loop work.", output: "Visible or saved evidence" },
  ],
  sensor: [
    { title: "Cached input refresh", input: "Physical device or simulator mock", work: "The adapter refreshes the sensor sample once for this loop.", output: "One cached sample" },
    { title: "Observation action", input: "Cached sample", work: "Robot code describes the observation with a typed action.", output: "A typed RobotAction" },
    { title: "Store and reducer", input: "Current state plus RobotAction", work: "A pure reducer calculates the next state without reading the device again.", output: "Next immutable RobotState" },
    { title: "Controller and safety", input: "State plus the same cached sample", work: "Every controller sees data from the same loop boundary.", output: "A checked output request" },
    { title: "Cached I/O write", input: "Checked output request", work: "The platform adapter writes outputs after state and safety checks.", output: "One output boundary result" },
    { title: "Telemetry and logs", input: "State and named signals", work: "The sample and result become reviewable evidence.", output: "Visible or saved evidence" },
  ],
};

export function getFlowStage(scenario: FlowScenario, requestedIndex: number) {
  if (!Number.isFinite(requestedIndex)) throw new Error("Flow index must be finite.");
  const stages = FLOW_STAGES[scenario];
  const index = Math.max(0, Math.min(stages.length - 1, Math.trunc(requestedIndex)));
  return { index, count: stages.length, stage: stages[index] };
}

export default function RobotFlowTracer() {
  const [scenario, setScenario] = useState<FlowScenario>("driver");
  const [index, setIndex] = useState(0);
  const current = getFlowStage(scenario, index);

  const chooseScenario = (next: FlowScenario) => {
    setScenario(next);
    setIndex(0);
  };

  return (
    <AcademyLabShell
      titleId="robot-flow-title"
      title="Robot Input-to-Output Flow Tracer"
      eyebrow="Concept trace"
      description="Follow one request or observation through a simplified ARES robot loop."
      onReset={() => { setScenario("driver"); setIndex(0); }}
    >
      <fieldset className="mt-5 grid gap-3 sm:grid-cols-2">
        <legend className="mb-2 text-sm font-bold text-ares-gold">Choose what enters the loop</legend>
        <ScenarioButton active={scenario === "driver"} onClick={() => chooseScenario("driver")} label="Driver request" description="Start with a stick or button." />
        <ScenarioButton active={scenario === "sensor"} onClick={() => chooseScenario("sensor")} label="Sensor observation" description="Start with one refreshed sensor sample." />
      </fieldset>

      <ol className="mt-6 grid gap-2 sm:grid-cols-3 lg:grid-cols-6" aria-label={`${scenario === "driver" ? "Driver request" : "Sensor observation"} flow stages`}>
        {FLOW_STAGES[scenario].map((stage, stageIndex) => (
          <li key={stage.title} className={`rounded border p-3 text-sm ${stageIndex === current.index ? "border-ares-cyan bg-ares-cyan/15 text-white" : "border-white/10 bg-white/5 text-marble/70"}`} aria-current={stageIndex === current.index ? "step" : undefined}>
            <span className="block text-xs font-bold uppercase tracking-wide">Step {stageIndex + 1}</span>
            <span className="mt-1 block font-semibold">{stage.title}</span>
          </li>
        ))}
      </ol>

      <div aria-live="polite" aria-atomic="true" className="mt-5 rounded-lg border border-white/10 bg-obsidian p-4 sm:p-5">
        <p className="text-xs font-bold uppercase tracking-widest text-ares-gold">Step {current.index + 1} of {current.count}</p>
        <h4 className="mt-1 text-lg font-black text-white">{current.stage.title}</h4>
        <dl className="mt-4 grid gap-3 md:grid-cols-3">
          <AcademyDatum label="Input" value={current.stage.input} accented />
          <AcademyDatum label="Work" value={current.stage.work} accented />
          <AcademyDatum label="Output" value={current.stage.output} accented />
        </dl>
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <button type="button" disabled={current.index === 0} onClick={() => setIndex((value) => Math.max(0, value - 1))} className="inline-flex min-h-11 items-center gap-2 rounded border border-white/20 px-4 py-2 font-bold text-white enabled:hover:border-ares-cyan disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan">
          <ArrowLeft aria-hidden="true" size={16} /> Previous
        </button>
        <button type="button" disabled={current.index === current.count - 1} onClick={() => setIndex((value) => Math.min(current.count - 1, value + 1))} className="inline-flex min-h-11 items-center gap-2 rounded bg-ares-red px-4 py-2 font-bold text-white enabled:hover:bg-ares-red/80 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan">
          Next <ArrowRight aria-hidden="true" size={16} />
        </button>
      </div>

      <AcademyModelLimit>
        This fixed teaching trace does not inspect project code, dispatch an action, read a controller or sensor, run the ARES scheduler, command hardware, or prove loop timing.
      </AcademyModelLimit>
    </AcademyLabShell>
  );
}

function ScenarioButton({ active, onClick, label, description }: { active: boolean; onClick: () => void; label: string; description: string }) {
  return <button type="button" aria-pressed={active} onClick={onClick} className={`min-h-14 rounded border p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan ${active ? "border-ares-cyan bg-ares-cyan/15 text-white" : "border-white/15 bg-white/5 text-marble/80 hover:border-white/30"}`}><span className="block font-bold">{label}</span><span className="mt-1 block text-sm">{description}</span></button>;
}
