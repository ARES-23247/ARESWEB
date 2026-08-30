/** @sim {"name":"ARES Task Tree Planner","requiresContext":false,"academyApproved":true,"fidelity":"code-derived"} */
import { useState } from "react";

export type TaskGroupKind = "sequence" | "parallel" | "race" | "deadline";
export type TaskResource = "NONE" | "DRIVE" | "INTAKE" | "LIGHTING";
export type TraceEvent = "normal" | "failure" | "cancel";

type TaskTreeResult = {
  builds: boolean;
  conflict: string | null;
  startRule: string;
  finishRule: string;
  terminalRule: string;
  actionsRule: string;
};

const GROUPS: [TaskGroupKind, string][] = [["sequence", "Sequence"], ["parallel", "Parallel"], ["race", "Race"], ["deadline", "Deadline (Task A decides)"]];

const RESOURCES: TaskResource[] = ["NONE", "DRIVE", "INTAKE", "LIGHTING"];

export function evaluateTaskTree(
  group: TaskGroupKind,
  firstResource: TaskResource,
  secondResource: TaskResource,
  event: TraceEvent,
): TaskTreeResult {
  const concurrent = group !== "sequence";
  const hasConflict =
    concurrent && firstResource !== "NONE" && firstResource === secondResource;
  const conflict = hasConflict
    ? `${group} cannot be built because Task A and Task B both claim ${firstResource}.`
    : null;

  const startRule =
    group === "sequence"
      ? "Task A starts first. Task B starts only after Task A ends normally."
      : "Task A and Task B initialize together.";
  const finishRule = {
    sequence: "The group finishes after Task A, then Task B, finish.",
    parallel: "The group finishes only after both tasks finish.",
    race: "The first task to finish wins. The unfinished task is interrupted.",
    deadline:
      "Task A decides when the group finishes. An unfinished Task B is interrupted.",
  }[group];
  const terminalRule = conflict
    ? "No lifecycle event runs. Resolve the resource conflict before building this tree."
    : {
        normal: finishRule,
        failure:
          "A failed child makes the group fail. Interrupted cleanup runs, and the executor aborts queued and preempted work.",
        cancel:
          "A cancelled child makes the group cancel. Interrupted cleanup runs, and the executor clears queued and preempted work.",
      }[event];

  return {
    builds: !hasConflict,
    conflict,
    startRule,
    finishRule,
    terminalRule,
    actionsRule:
      "The executor returns Redux actions. The robot lifecycle owner must dispatch them, including cleanup actions.",
  };
}

export default function TaskSequenceLab() {
  const [group, setGroup] = useState<TaskGroupKind>("sequence");
  const [firstResource, setFirstResource] = useState<TaskResource>("DRIVE");
  const [secondResource, setSecondResource] = useState<TaskResource>("INTAKE");
  const [event, setEvent] = useState<TraceEvent>("normal");
  const result = evaluateTaskTree(group, firstResource, secondResource, event);

  const reset = () => {
    setGroup("sequence");
    setFirstResource("DRIVE");
    setSecondResource("INTAKE");
    setEvent("normal");
  };

  return (
    <section aria-labelledby="task-tree-lab-title" className="my-6 rounded-lg border border-white/10 bg-charcoal p-4 sm:p-5">
      <h3 id="task-tree-lab-title" className="text-xl font-black text-white">ARES Task Tree Planner</h3>
      <p className="mt-2 text-sm text-marble/80">Compare group rules, resource conflicts, and one terminal event.</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-bold text-white">Task group
          <select value={group} onChange={(event) => setGroup(event.currentTarget.value as TaskGroupKind)} className={controlClass}>
            {GROUPS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label className="text-sm font-bold text-white">Trace event
          <select value={event} onChange={(event) => setEvent(event.currentTarget.value as TraceEvent)} className={controlClass}>
            <option value="normal">Normal completion</option><option value="failure">One child fails</option><option value="cancel">One child is cancelled</option>
          </select>
        </label>
        <ResourceSelect label="Task A resource" value={firstResource} onChange={setFirstResource} />
        <ResourceSelect label="Task B resource" value={secondResource} onChange={setSecondResource} />
      </div>
      <button type="button" onClick={reset} className="mt-4 min-h-11 rounded border border-white/20 px-4 text-sm font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan">Reset</button>
      <div role="status" aria-live="polite" aria-atomic="true" className="mt-4 rounded border border-white/10 bg-obsidian p-4 text-sm leading-relaxed text-white">
        <strong>{result.builds ? "Tree can be built." : "Resource conflict."}</strong> {result.conflict ?? result.terminalRule}
      </div>
      <div className="mt-3 grid gap-2 text-sm leading-relaxed text-white"><p><strong>Start:</strong> {result.startRule}</p><p><strong>Normal finish:</strong> {result.finishRule}</p><p><strong>Redux:</strong> {result.actionsRule}</p></div>
      <p role="note" className="mt-4 border-l-4 border-ares-gold/60 bg-ares-gold/10 p-3 text-sm leading-relaxed text-white">
        <strong>Model limit:</strong> This planner mirrors the current two-child
        group, resource, and terminal rules. It does not build Kotlin, run a
        TaskExecutor, inspect nested trees, dispatch actions, model timing,
        connect to a simulator, command hardware, or prove cleanup on a robot.
      </p>
    </section>
  );
}

function ResourceSelect({ label, value, onChange }: {
  label: string;
  value: TaskResource;
  onChange: (value: TaskResource) => void;
}) {
  return (
    <label className="text-sm font-bold text-white">{label}
      <select value={value} onChange={(event) => onChange(event.currentTarget.value as TaskResource)} className={controlClass}>
        {RESOURCES.map((resource) => (
          <option key={resource} value={resource}>
            {resource}
          </option>
        ))}
      </select>
    </label>
  );
}

const controlClass = "mt-2 min-h-11 w-full rounded border border-white/20 bg-obsidian px-3 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan";
