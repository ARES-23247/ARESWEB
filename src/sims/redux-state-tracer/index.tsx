/** @sim {"name":"Current ARES Redux State Tracer","requiresContext":false,"academyApproved":true,"fidelity":"code-derived"} */
import { useState, type ReactNode } from "react";

type DriveMode = "TELEOP" | "HEADING_HOLD";

export type LessonRobotState = {
  headingTargetDegrees: number | null;
  driveMode: DriveMode;
  rootTimestampMs: number;
};

export type LessonRobotAction =
  | {
      type: "SetHeadingLockTarget";
      targetDegrees: number | null;
      timestampMs: number;
    }
  | { type: "SetDriveMode"; mode: DriveMode; timestampMs: number };

type UntimedLessonAction =
  | { type: "SetHeadingLockTarget"; targetDegrees: number | null }
  | { type: "SetDriveMode"; mode: DriveMode };

const INITIAL_STATE: LessonRobotState = {
  headingTargetDegrees: null,
  driveMode: "TELEOP",
  rootTimestampMs: 0,
};

export function lessonReducer(
  state: LessonRobotState,
  action: LessonRobotAction,
): LessonRobotState {
  if (action.type === "SetHeadingLockTarget") {
    return {
      ...state,
      headingTargetDegrees: action.targetDegrees,
      rootTimestampMs: action.timestampMs,
    };
  }
  return {
    ...state,
    driveMode: action.mode,
    rootTimestampMs: action.timestampMs,
  };
}

function describeAction(action: LessonRobotAction | null): string {
  if (!action) return "No action yet";
  if (action.type === "SetDriveMode") {
    return `SetDriveMode(${action.mode}) at ${action.timestampMs} ms`;
  }
  const target =
    action.targetDegrees === null ? "null" : `${action.targetDegrees}°`;
  return `SetHeadingLockTarget(${target}) at ${action.timestampMs} ms`;
}

export default function ReduxStateTracer() {
  const [state, setState] = useState<LessonRobotState>(INITIAL_STATE);
  const [previousState, setPreviousState] =
    useState<LessonRobotState>(INITIAL_STATE);
  const [lastAction, setLastAction] = useState<LessonRobotAction | null>(null);
  const [step, setStep] = useState(0);

  const dispatch = (action: UntimedLessonAction) => {
    const timedAction = {
      ...action,
      timestampMs: (step + 1) * 20,
    } as LessonRobotAction;
    setPreviousState(state);
    setState(lessonReducer(state, timedAction));
    setLastAction(timedAction);
    setStep((value) => value + 1);
  };

  const reset = () => {
    setState(INITIAL_STATE);
    setPreviousState(INITIAL_STATE);
    setLastAction(null);
    setStep(0);
  };

  const incomplete =
    state.driveMode === "HEADING_HOLD" && state.headingTargetDegrees === null;

  return (
    <section
      aria-labelledby="redux-tracer-title"
      className="my-8 rounded-xl border border-ares-cyan/30 bg-black/35 p-4 sm:p-6"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-ares-cyan">
            Current ARES 11.1 reducer rules
          </p>
          <h3
            id="redux-tracer-title"
            className="mt-1 text-xl font-black text-white"
          >
            Redux State Tracer
          </h3>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-marble/80">
            Send one real action at a time. Compare the old snapshot with the
            new drive slice and root timestamp.
          </p>
        </div>
        <button
          type="button"
          onClick={reset}
          className="min-h-11 rounded border border-white/20 px-4 py-2 text-sm font-bold text-white hover:border-ares-cyan focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
        >
          Reset trace
        </button>
      </div>

      <fieldset className="mt-6 grid gap-3 rounded-lg border border-white/10 bg-white/5 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <legend className="px-2 text-sm font-bold text-ares-gold">
          Dispatch one action
        </legend>
        <ActionButton
          onClick={() =>
            dispatch({
              type: "SetHeadingLockTarget",
              targetDegrees: 90,
            })
          }
        >
          Set target to 90°
        </ActionButton>
        <ActionButton
          onClick={() =>
            dispatch({ type: "SetDriveMode", mode: "HEADING_HOLD" })
          }
        >
          Enable heading hold
        </ActionButton>
        <ActionButton
          onClick={() =>
            dispatch({
              type: "SetHeadingLockTarget",
              targetDegrees: null,
            })
          }
        >
          Clear target
        </ActionButton>
        <ActionButton
          onClick={() => dispatch({ type: "SetDriveMode", mode: "TELEOP" })}
        >
          Use teleop drive
        </ActionButton>
      </fieldset>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <StateCard title="Previous state" state={previousState} />
        <div className="rounded-lg border border-ares-gold/30 bg-ares-gold/10 p-4">
          <h4 className="text-sm font-bold uppercase tracking-wider text-ares-gold">
            Action
          </h4>
          <p className="mt-4 break-words font-mono text-sm leading-relaxed text-white">
            {describeAction(lastAction)}
          </p>
          <p className="mt-3 text-sm text-marble/70">Action number: {step}</p>
        </div>
        <div aria-live="polite" aria-atomic="true">
          <StateCard title="New state" state={state} />
        </div>
      </div>

      <p
        role="status"
        aria-live="polite"
        className="mt-5 rounded border border-white/10 bg-obsidian p-3 text-sm leading-relaxed text-white"
      >
        {incomplete
          ? "Exact reducer result: HEADING_HOLD remains selected with no target. Later control code must decide what is safe."
          : "Exact reducer result: each action changed only its drive field plus the root timestamp."}
      </p>

      <details className="mt-3 rounded border border-white/10 bg-white/5 p-3 text-sm text-white">
        <summary className="min-h-11 cursor-pointer font-bold text-ares-cyan">
          Why the names changed
        </summary>
        <p className="mt-2 leading-relaxed text-marble/80">
          Current ARES starts in TELEOP. It clears a heading target with
          SetHeadingLockTarget(null). OPEN_LOOP and ClearHeadingLockTarget are
          not current production names.
        </p>
      </details>

      <p
        role="note"
        className="mt-3 border-l-4 border-ares-gold/60 bg-ares-gold/10 p-3 text-sm leading-relaxed text-white"
      >
        <strong>Fidelity limit:</strong> This code-derived model includes only
        two DriveState fields and the root timestamp. It omits Store estimator
        middleware, controllers, adapters, simulation, and physical hardware.
        The lab cannot prove that a robot moved or was safe to move.
      </p>
    </section>
  );
}

function ActionButton({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="min-h-11 rounded border border-white/20 bg-obsidian px-3 py-2 text-sm font-bold text-white hover:border-ares-cyan focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
    >
      {children}
    </button>
  );
}

function StateCard({
  title,
  state,
}: {
  title: string;
  state: LessonRobotState;
}) {
  const target =
    state.headingTargetDegrees === null
      ? "null"
      : `${state.headingTargetDegrees}°`;
  return (
    <div className="h-full rounded-lg border border-white/10 bg-obsidian p-4">
      <h4 className="text-sm font-bold uppercase tracking-wider text-ares-cyan">
        {title}
      </h4>
      <dl className="mt-4 grid gap-3 text-sm">
        <StateRow label="Drive mode" value={state.driveMode} />
        <StateRow label="Heading target" value={target} />
        <StateRow label="Root time" value={`${state.rootTimestampMs} ms`} />
      </dl>
    </div>
  );
}

function StateRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 border-b border-white/10 pb-2">
      <dt className="text-marble/70">{label}</dt>
      <dd className="font-mono font-bold text-white">{value}</dd>
    </div>
  );
}
