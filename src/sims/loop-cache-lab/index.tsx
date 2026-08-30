/** @sim {"name":"ARES FTC Cached Motor Trace","requiresContext":false,"academyApproved":true,"fidelity":"code-derived"} */
import { useState } from "react";

export type MotorCacheState = {
  acceptedPower: number | null;
  delegatePower: number;
  delegateReads: number;
  delegateWrites: number;
  observedPower: number | null;
  delta: number | null;
  event: string;
};

export function createMotorCache(delegatePower = 0.25): MotorCacheState {
  return {
    acceptedPower: null,
    delegatePower,
    delegateReads: 0,
    delegateWrites: 0,
    observedPower: null,
    delta: null,
    event: "No operation yet. The sentinel is active.",
  };
}

export function readCachedPower(state: MotorCacheState): MotorCacheState {
  if (state.acceptedPower === null) {
    return {
      ...state,
      delegateReads: state.delegateReads + 1,
      observedPower: state.delegatePower,
      event: "Read the FTC delegate because no command is cached yet.",
    };
  }
  return {
    ...state,
    observedPower: state.acceptedPower,
    event: "Returned the last accepted command without a delegate read.",
  };
}

export function writeCachedPower(
  state: MotorCacheState,
  requested: number,
  epsilon: number,
): MotorCacheState {
  const lastPower = state.acceptedPower ?? -10;
  const delta = Math.abs(requested - lastPower);
  const hardStop = requested === 0 && lastPower !== 0;
  const changed = delta >= epsilon;
  if (hardStop || changed) {
    return {
      ...state,
      acceptedPower: requested,
      delegatePower: requested,
      delegateWrites: state.delegateWrites + 1,
      delta,
      event: hardStop
        ? "Wrote one changed zero hard stop."
        : "Wrote the request because its change met epsilon.",
    };
  }
  return {
    ...state,
    delta,
    event: "Skipped the request because its change was below epsilon.",
  };
}

const TEST_REQUESTS = [0.4, 0.44, 0, -0.1] as const;

export default function LoopCacheLab() {
  const [state, setState] = useState(createMotorCache);
  const [requested, setRequested] = useState(0.4);
  const [epsilon, setEpsilon] = useState(0.05);
  const reset = () => {
    setState(createMotorCache());
    setRequested(0.4);
    setEpsilon(0.05);
  };

  return (
    <section
      aria-labelledby="cache-lab-title"
      className="my-8 rounded-xl border border-ares-cyan/30 bg-black/35 p-4 sm:p-6"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-ares-cyan">
            Current ARES 11.1 source trace
          </p>
          <h3 id="cache-lab-title" className="mt-1 text-xl font-black text-white">
            ARES FTC Cached Motor Trace
          </h3>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-marble/80">
            Follow the sentinel, getter, and setter used by CachedDcMotorEx.
          </p>
        </div>
        <button type="button" onClick={reset} className={buttonClass}>
          Reset trace
        </button>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <div className="grid content-start gap-5 rounded-lg border border-white/10 bg-white/5 p-4">
          <fieldset className="grid gap-3">
            <legend className="text-sm font-bold text-ares-gold">Source-test request</legend>
            <div className="grid grid-cols-2 gap-2">
              {TEST_REQUESTS.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setRequested(value)}
                  className={buttonClass}
                >
                  Use {format(value)}
                </button>
              ))}
            </div>
          </fieldset>

          <NumberInput
            id="cache-request"
            label="Requested motor power"
            value={requested}
            min={-1}
            max={1}
            step={0.01}
            onChange={setRequested}
          />
          <NumberInput
            id="cache-epsilon"
            label="Epsilon"
            value={epsilon}
            min={0}
            max={1}
            step={0.01}
            onChange={setEpsilon}
          />
          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setState((current) => readCachedPower(current))}
              className={buttonClass}
            >
              Read power
            </button>
            <button
              type="button"
              onClick={() =>
                setState((current) => writeCachedPower(current, requested, epsilon))
              }
              className={buttonClass}
            >
              Write request
            </button>
          </div>
        </div>

        <div className="rounded-lg border border-white/10 bg-obsidian p-4">
          <h4 className="text-sm font-bold uppercase tracking-wider text-ares-gold">
            Wrapper state
          </h4>
          <p
            role="status"
            aria-live="polite"
            className="mt-4 rounded border border-ares-cyan/30 bg-ares-cyan/10 p-3 text-sm font-bold text-white"
          >
            {state.event}
          </p>
          <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Datum
              label="Cache"
              value={
                state.acceptedPower === null
                  ? "No accepted command"
                  : format(state.acceptedPower)
              }
            />
            <Datum label="Delegate power" value={format(state.delegatePower)} />
            <Datum label="Delegate reads" value={String(state.delegateReads)} />
            <Datum label="Delegate writes" value={String(state.delegateWrites)} />
            <Datum
              label="Last observed power"
              value={state.observedPower === null ? "Not read" : format(state.observedPower)}
            />
            <Datum
              label="Last write delta"
              value={state.delta === null ? "Not checked" : format(state.delta)}
            />
          </dl>
        </div>
      </div>

      <p
        role="note"
        className="mt-5 border-l-4 border-ares-gold/60 bg-ares-gold/10 p-3 text-sm leading-relaxed text-white"
      >
        <strong>Model limit:</strong> This TypeScript trace copies the current scalar getter and
        setter rules for documented power and epsilon values. It does not execute Kotlin, validate
        every caller, contact an FTC device, measure bus traffic, or prove a motor stops.
      </p>
    </section>
  );
}

const buttonClass =
  "min-h-11 rounded border border-white/20 px-3 py-2 text-sm font-bold text-white hover:border-ares-cyan focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan";

function format(value: number) {
  return Object.is(value, -0) ? "0.00" : value.toFixed(2);
}

function NumberInput({
  id,
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <label htmlFor={id} className="grid gap-2 text-sm font-bold text-white">
      {label}
      <input
        id={id}
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(event) => {
          const next = Number(event.currentTarget.value);
          if (Number.isFinite(next)) onChange(Math.min(max, Math.max(min, next)));
        }}
        className="min-h-11 rounded border border-white/20 bg-black px-3 py-2 font-mono text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
      />
    </label>
  );
}

function Datum({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-white/10 p-3">
      <dt className="text-xs uppercase tracking-wide text-marble/70">{label}</dt>
      <dd className="mt-1 break-words font-mono font-bold text-white">{value}</dd>
    </div>
  );
}
