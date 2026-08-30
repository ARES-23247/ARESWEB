/** @sim {"name":"ARES Task Tree Planner","requiresContext":false,"academyApproved":true,"fidelity":"code-derived"} */
import { useMemo, useState } from "react";

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

const GROUPS: { value: TaskGroupKind; label: string }[] = [
  { value: "sequence", label: "Sequence" },
  { value: "parallel", label: "Parallel" },
  { value: "race", label: "Race" },
  { value: "deadline", label: "Deadline (Task A is the deadline)" },
];

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
  const result = useMemo(
    () => evaluateTaskTree(group, firstResource, secondResource, event),
    [group, firstResource, secondResource, event],
  );

  const reset = () => {
    setGroup("sequence");
    setFirstResource("DRIVE");
    setSecondResource("INTAKE");
    setEvent("normal");
  };

  return (
    <section
      aria-labelledby="task-tree-lab-title"
      className="my-8 rounded-xl border border-ares-cyan/30 bg-black/35 p-4 sm:p-6"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-ares-cyan">
            Code-derived lifecycle model
          </p>
          <h3
            id="task-tree-lab-title"
            className="mt-1 text-xl font-black text-white"
          >
            ARES Task Tree Planner
          </h3>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-marble/80">
            Compare group rules, expose resource conflicts, and trace one
            terminal event.
          </p>
        </div>
        <button
          type="button"
          onClick={reset}
          className="min-h-11 rounded border border-white/20 px-4 py-2 text-sm font-bold text-white hover:border-ares-cyan focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
        >
          Reset
        </button>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="grid gap-5">
          <fieldset className="grid gap-3 rounded-lg border border-white/10 bg-white/5 p-4">
            <legend className="px-2 text-sm font-bold text-ares-gold">
              1. Choose the group
            </legend>
            {GROUPS.map((item) => (
              <label
                key={item.value}
                className="flex min-h-11 cursor-pointer items-center gap-3 rounded border border-white/10 p-3 text-sm font-bold text-white focus-within:ring-2 focus-within:ring-ares-cyan"
              >
                <input
                  type="radio"
                  name="task-group"
                  checked={group === item.value}
                  onChange={() => setGroup(item.value)}
                  className="h-5 w-5 shrink-0 accent-ares-red"
                />
                {item.label}
              </label>
            ))}
          </fieldset>

          <fieldset className="grid gap-4 rounded-lg border border-white/10 bg-white/5 p-4 sm:grid-cols-2">
            <legend className="px-2 text-sm font-bold text-ares-gold">
              2. Assign one resource to each task
            </legend>
            <ResourceSelect
              id="task-a-resource"
              label="Task A resource"
              value={firstResource}
              onChange={setFirstResource}
            />
            <ResourceSelect
              id="task-b-resource"
              label="Task B resource"
              value={secondResource}
              onChange={setSecondResource}
            />
          </fieldset>

          <fieldset className="grid gap-3 rounded-lg border border-white/10 bg-white/5 p-4">
            <legend className="px-2 text-sm font-bold text-ares-gold">
              3. Trace an event
            </legend>
            {(
              [
                ["normal", "Normal completion"],
                ["failure", "One child fails"],
                ["cancel", "One child is cancelled"],
              ] as const
            ).map(([value, label]) => (
              <label
                key={value}
                className="flex min-h-11 cursor-pointer items-center gap-3 rounded border border-white/10 p-3 text-sm font-bold text-white focus-within:ring-2 focus-within:ring-ares-cyan"
              >
                <input
                  type="radio"
                  name="trace-event"
                  checked={event === value}
                  onChange={() => setEvent(value)}
                  className="h-5 w-5 shrink-0 accent-ares-red"
                />
                {label}
              </label>
            ))}
          </fieldset>
        </div>

        <div className="rounded-lg border border-white/10 bg-obsidian p-4 sm:p-5">
          <p className="text-xs font-bold uppercase tracking-widest text-ares-gold">
            Predicted task-tree behavior
          </p>
          <div
            role="status"
            aria-live="polite"
            aria-atomic="true"
            className={`mt-4 rounded border p-4 text-sm leading-relaxed text-white ${
              result.builds
                ? "border-ares-cyan/50 bg-ares-cyan/10"
                : "border-ares-red/60 bg-ares-red/10"
            }`}
          >
            <strong className="block">
              {result.builds ? "Tree can be built" : "Resource conflict"}
            </strong>
            {result.conflict && (
              <span className="mt-2 block">{result.conflict}</span>
            )}
          </div>
          <dl className="mt-4 grid gap-3">
            <Datum label="Start" value={result.startRule} />
            <Datum label="Normal finish" value={result.finishRule} />
            <Datum label="Selected event" value={result.terminalRule} />
            <Datum label="Redux boundary" value={result.actionsRule} />
          </dl>
        </div>
      </div>

      <p
        role="note"
        className="mt-5 border-l-4 border-ares-gold/60 bg-ares-gold/10 p-3 text-sm leading-relaxed text-white"
      >
        <strong>Model limit:</strong> This planner mirrors the current two-child
        group, resource, and terminal rules. It does not build Kotlin, run a
        TaskExecutor, inspect nested trees, dispatch actions, model timing,
        connect to a simulator, command hardware, or prove cleanup on a robot.
      </p>
    </section>
  );
}

function ResourceSelect({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: TaskResource;
  onChange: (value: TaskResource) => void;
}) {
  return (
    <label htmlFor={id} className="grid gap-2 text-sm font-bold text-white">
      <span>{label}</span>
      <select
        id={id}
        value={value}
        onChange={(event) =>
          onChange(event.currentTarget.value as TaskResource)
        }
        className="min-h-11 rounded border border-white/20 bg-black px-3 py-2 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
      >
        {RESOURCES.map((resource) => (
          <option key={resource} value={resource}>
            {resource}
          </option>
        ))}
      </select>
    </label>
  );
}

function Datum({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-white/10 p-3">
      <dt className="text-xs font-bold uppercase tracking-wide text-ares-cyan">
        {label}
      </dt>
      <dd className="mt-1 text-sm leading-relaxed text-white">{value}</dd>
    </div>
  );
}
