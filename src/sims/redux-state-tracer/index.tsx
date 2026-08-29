/** @sim {"name":"Redux State Tracer","requiresContext":false,"academyApproved":true,"fidelity":"code-derived"} */
import { useMemo, useState, type ReactNode } from "react";
import { RotateCcw } from "lucide-react";

type DriveMode = "OPEN_LOOP" | "HEADING_HOLD";

export type LessonRobotState = {
  headingTargetDegrees: number | null;
  driveMode: DriveMode;
};

export type LessonRobotAction =
  | { type: "SetHeadingLockTarget"; degrees: number }
  | { type: "SetDriveMode"; mode: DriveMode }
  | { type: "ClearHeadingLockTarget" };

const INITIAL_STATE: LessonRobotState = {
  headingTargetDegrees: null,
  driveMode: "OPEN_LOOP",
};

export function lessonReducer(state: LessonRobotState, action: LessonRobotAction): LessonRobotState {
  switch (action.type) {
    case "SetHeadingLockTarget":
      return { ...state, headingTargetDegrees: action.degrees };
    case "SetDriveMode":
      return { ...state, driveMode: action.mode };
    case "ClearHeadingLockTarget":
      return { ...state, headingTargetDegrees: null, driveMode: "OPEN_LOOP" };
  }
}

function describeAction(action: LessonRobotAction | null): string {
  if (!action) return "No action yet";
  if (action.type === "SetHeadingLockTarget") return `Set target to ${action.degrees} degrees`;
  if (action.type === "SetDriveMode") return `Set drive mode to ${action.mode}`;
  return "Clear heading target";
}

export default function ReduxStateTracer() {
  const [state, setState] = useState<LessonRobotState>(INITIAL_STATE);
  const [previousState, setPreviousState] = useState<LessonRobotState>(INITIAL_STATE);
  const [lastAction, setLastAction] = useState<LessonRobotAction | null>(null);
  const [step, setStep] = useState(0);

  const targetLabel = useMemo(
    () => state.headingTargetDegrees === null ? "none" : `${state.headingTargetDegrees} degrees`,
    [state.headingTargetDegrees],
  );

  const dispatch = (action: LessonRobotAction) => {
    setPreviousState(state);
    setState(lessonReducer(state, action));
    setLastAction(action);
    setStep((value) => value + 1);
  };

  const reset = () => {
    setState(INITIAL_STATE);
    setPreviousState(INITIAL_STATE);
    setLastAction(null);
    setStep(0);
  };

  return (
    <section aria-labelledby="redux-tracer-title" className="my-8 rounded-xl border border-ares-cyan/30 bg-black/35 p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-ares-cyan">Code-derived model</p>
          <h3 id="redux-tracer-title" className="mt-1 text-xl font-black text-white">Redux State Tracer</h3>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-marble/80">
            Send one action at a time. The lesson reducer returns a new state and never reads or writes robot hardware.
          </p>
        </div>
        <button
          type="button"
          onClick={reset}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded border border-white/20 px-4 py-2 text-sm font-bold text-white hover:border-ares-cyan focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
        >
          <RotateCcw aria-hidden="true" size={16} /> Reset
        </button>
      </div>

      <fieldset className="mt-6 grid gap-3 rounded-lg border border-white/10 bg-white/5 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <legend className="px-2 text-sm font-bold text-ares-gold">Choose one action</legend>
        <ActionButton onClick={() => dispatch({ type: "SetHeadingLockTarget", degrees: 90 })}>Set target to 90°</ActionButton>
        <ActionButton onClick={() => dispatch({ type: "SetDriveMode", mode: "HEADING_HOLD" })}>Enable heading hold</ActionButton>
        <ActionButton onClick={() => dispatch({ type: "SetDriveMode", mode: "OPEN_LOOP" })}>Use open-loop drive</ActionButton>
        <ActionButton onClick={() => dispatch({ type: "ClearHeadingLockTarget" })}>Clear target</ActionButton>
      </fieldset>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <StateCard title="Previous state" state={previousState} />
        <div className="rounded-lg border border-ares-gold/30 bg-ares-gold/10 p-4">
          <h4 className="text-sm font-bold uppercase tracking-wider text-ares-gold">Action</h4>
          <p className="mt-4 font-mono text-sm leading-relaxed text-white">{describeAction(lastAction)}</p>
          <p className="mt-3 text-sm text-marble/70">Action number: {step}</p>
        </div>
        <div aria-live="polite" aria-atomic="true">
          <StateCard title="New state" state={state} />
        </div>
      </div>

      <p className="mt-5 rounded border border-white/10 bg-obsidian p-3 text-sm leading-relaxed text-white">
        Current result: the drive mode is <strong>{state.driveMode}</strong>, and the heading target is <strong>{targetLabel}</strong>.
      </p>
      <p role="note" className="mt-3 border-l-4 border-ares-gold/60 bg-ares-gold/10 p-3 text-sm leading-relaxed text-white">
        <strong>Fidelity limit:</strong> The action names and pure state-change pattern follow ARES 11 Redux teaching material. This small model leaves out the full RobotState and does not command, simulate, or verify a physical robot.
      </p>
    </section>
  );
}

function ActionButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
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

function StateCard({ title, state }: { title: string; state: LessonRobotState }) {
  return (
    <div className="h-full rounded-lg border border-white/10 bg-obsidian p-4">
      <h4 className="text-sm font-bold uppercase tracking-wider text-ares-cyan">{title}</h4>
      <dl className="mt-4 grid gap-3 text-sm">
        <StateRow label="Drive mode" value={state.driveMode} />
        <StateRow label="Heading target" value={state.headingTargetDegrees === null ? "none" : `${state.headingTargetDegrees}°`} />
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
