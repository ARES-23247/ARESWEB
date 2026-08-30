/** @sim {"name":"Odometry Error Lab","requiresContext":false,"academyApproved":true,"fidelity":"conceptual"} */
import { useMemo, useState } from "react";

export type RouteDirection =
  "positive-x" | "positive-y" | "negative-x" | "negative-y";

export type OdometryTrial = {
  trueX: number;
  trueY: number;
  estimatedX: number;
  estimatedY: number;
  residualX: number;
  residualY: number;
  endpointError: number;
};

export type OdometrySource =
  "UNINITIALIZED" | "PINPOINT" | "DRIVETRAIN_FALLBACK";

export type OdometrySourceState = {
  activeSource: OdometrySource;
  healthyRecoverySamples: number;
};

const ROUTES: Record<
  RouteDirection,
  { label: string; headingDegrees: number }
> = {
  "positive-x": { label: "Field +X", headingDegrees: 0 },
  "positive-y": { label: "Field +Y", headingDegrees: 90 },
  "negative-x": { label: "Field −X", headingDegrees: 180 },
  "negative-y": { label: "Field −Y", headingDegrees: -90 },
};

const DEFAULTS = {
  distance: 3,
  scaleErrorPercent: 0,
  headingBiasDegrees: 0,
  routeDirection: "positive-x" as RouteDirection,
} as const;

const RECOVERY_SAMPLES_REQUIRED = 5;
const DEFAULT_SOURCE_STATE: OdometrySourceState = {
  activeSource: "UNINITIALIZED",
  healthyRecoverySamples: 0,
};
const SAMPLE_BUTTON_CLASS =
  "min-h-11 rounded border px-4 py-2 text-sm font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan";

function cleanNearZero(value: number): number {
  return Math.abs(value) < 1e-12 ? 0 : value;
}

export function calculateOdometryTrial(
  distance: number,
  scaleErrorPercent: number,
  headingBiasDegrees: number,
  routeHeadingDegrees = 0,
): OdometryTrial {
  if (
    ![
      distance,
      scaleErrorPercent,
      headingBiasDegrees,
      routeHeadingDegrees,
    ].every(Number.isFinite) ||
    distance <= 0
  ) {
    throw new Error(
      "Odometry trial inputs must be finite and distance must be positive.",
    );
  }

  const trueHeadingRadians = (routeHeadingDegrees * Math.PI) / 180;
  const estimatedHeadingRadians =
    ((routeHeadingDegrees + headingBiasDegrees) * Math.PI) / 180;
  const estimatedDistance = distance * (1 + scaleErrorPercent / 100);
  const trueX = cleanNearZero(distance * Math.cos(trueHeadingRadians));
  const trueY = cleanNearZero(distance * Math.sin(trueHeadingRadians));
  const estimatedX = cleanNearZero(
    estimatedDistance * Math.cos(estimatedHeadingRadians),
  );
  const estimatedY = cleanNearZero(
    estimatedDistance * Math.sin(estimatedHeadingRadians),
  );
  const residualX = estimatedX - trueX;
  const residualY = estimatedY - trueY;

  return {
    trueX,
    trueY,
    estimatedX,
    estimatedY,
    residualX,
    residualY,
    endpointError: Math.hypot(residualX, residualY),
  };
}

export function updateOdometrySource(
  state: OdometrySourceState,
  pinpointPresent: boolean,
  pinpointHealthy: boolean,
): OdometrySourceState {
  if (!pinpointPresent || !pinpointHealthy) {
    return { activeSource: "DRIVETRAIN_FALLBACK", healthyRecoverySamples: 0 };
  }

  if (state.activeSource !== "DRIVETRAIN_FALLBACK") {
    return { activeSource: "PINPOINT", healthyRecoverySamples: 0 };
  }

  const nextHealthySamples = state.healthyRecoverySamples + 1;
  return nextHealthySamples >= RECOVERY_SAMPLES_REQUIRED
    ? { activeSource: "PINPOINT", healthyRecoverySamples: 0 }
    : {
        activeSource: "DRIVETRAIN_FALLBACK",
        healthyRecoverySamples: nextHealthySamples,
      };
}

export default function OdometryErrorLab() {
  const [distance, setDistance] = useState<number>(DEFAULTS.distance);
  const [scaleErrorPercent, setScaleErrorPercent] = useState<number>(
    DEFAULTS.scaleErrorPercent,
  );
  const [headingBiasDegrees, setHeadingBiasDegrees] = useState<number>(
    DEFAULTS.headingBiasDegrees,
  );
  const [routeDirection, setRouteDirection] = useState<RouteDirection>(
    DEFAULTS.routeDirection,
  );
  const [sourceState, setSourceState] =
    useState<OdometrySourceState>(DEFAULT_SOURCE_STATE);
  const route = ROUTES[routeDirection];
  const result = useMemo(
    () =>
      calculateOdometryTrial(
        distance,
        scaleErrorPercent,
        headingBiasDegrees,
        route.headingDegrees,
      ),
    [distance, scaleErrorPercent, headingBiasDegrees, route.headingDegrees],
  );

  const scale = 20;
  const originX = 180;
  const originY = 105;
  const point = (x: number, y: number) => ({
    x: originX + x * scale,
    y: originY - y * scale,
  });
  const truePoint = point(result.trueX, result.trueY);
  const estimatedPoint = point(result.estimatedX, result.estimatedY);

  const reset = () => {
    setDistance(DEFAULTS.distance);
    setScaleErrorPercent(DEFAULTS.scaleErrorPercent);
    setHeadingBiasDegrees(DEFAULTS.headingBiasDegrees);
    setRouteDirection(DEFAULTS.routeDirection);
    setSourceState(DEFAULT_SOURCE_STATE);
  };

  const sendSourceSample = (present: boolean, healthy: boolean) => {
    setSourceState((current) =>
      updateOdometrySource(current, present, healthy),
    );
  };

  return (
    <section
      aria-labelledby="odometry-error-title"
      className="my-8 rounded-xl border border-ares-cyan/30 bg-black/35 p-4 sm:p-6"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-ares-cyan">
            Concept model
          </p>
          <h3
            id="odometry-error-title"
            className="mt-1 text-xl font-black text-white"
          >
            Odometry Calibration and Source Lab
          </h3>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-marble/80">
            Compare field directions and trace FTC source recovery.
          </p>
        </div>
        <button
          type="button"
          onClick={reset}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded border border-white/20 px-4 py-2 text-sm font-bold text-white hover:border-ares-cyan focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
        >
          Reset
        </button>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(16rem,0.8fr)_minmax(0,1.2fr)]">
        <fieldset className="grid gap-5 rounded-lg border border-white/10 bg-white/5 p-4">
          <legend className="px-2 text-sm font-bold text-ares-gold">
            Calibration trial
          </legend>
          <div className="grid gap-2">
            <label
              htmlFor="route-direction"
              className="text-sm font-semibold text-white"
            >
              Surveyed route direction
            </label>
            <select
              id="route-direction"
              value={routeDirection}
              onChange={(event) =>
                setRouteDirection(event.currentTarget.value as RouteDirection)
              }
              className="min-h-11 rounded border border-white/20 bg-obsidian px-3 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
            >
              {Object.entries(ROUTES).map(([value, option]) => (
                <option key={value} value={value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <NumberControl
            label="Surveyed distance"
            unit="m"
            value={distance}
            min={1}
            max={6}
            step={0.1}
            onChange={setDistance}
          />
          <NumberControl
            label="Distance scale error"
            unit="%"
            value={scaleErrorPercent}
            min={-10}
            max={10}
            step={0.5}
            onChange={setScaleErrorPercent}
          />
          <NumberControl
            label="Heading bias"
            unit="°"
            value={headingBiasDegrees}
            min={-15}
            max={15}
            step={1}
            onChange={setHeadingBiasDegrees}
          />
        </fieldset>

        <div className="rounded-lg border border-white/10 bg-obsidian p-4">
          <h4 className="text-sm font-bold uppercase tracking-wider text-ares-gold">
            Endpoint comparison
          </h4>
          <svg
            viewBox="0 0 360 210"
            className="mt-3 h-auto w-full"
            aria-hidden="true"
          >
            <line
              x1="20"
              y1={originY}
              x2="340"
              y2={originY}
              stroke="currentColor"
              className="text-white/30"
            />
            <line
              x1={originX}
              y1="15"
              x2={originX}
              y2="195"
              stroke="currentColor"
              className="text-white/30"
            />
            <line
              x1={originX}
              y1={originY}
              x2={truePoint.x}
              y2={truePoint.y}
              stroke="currentColor"
              className="text-ares-gold"
              strokeWidth="5"
            />
            <line
              x1={originX}
              y1={originY}
              x2={estimatedPoint.x}
              y2={estimatedPoint.y}
              stroke="currentColor"
              className="text-ares-cyan"
              strokeWidth="5"
            />
            <circle
              cx={truePoint.x}
              cy={truePoint.y}
              r="6"
              fill="currentColor"
              className="text-ares-gold"
            />
            <circle
              cx={estimatedPoint.x}
              cy={estimatedPoint.y}
              r="6"
              fill="currentColor"
              className="text-ares-cyan"
            />
            <text
              x="315"
              y="98"
              fill="currentColor"
              className="text-[11px] text-white"
            >
              +X
            </text>
            <text
              x="186"
              y="25"
              fill="currentColor"
              className="text-[11px] text-white"
            >
              +Y
            </text>
          </svg>
          <p
            aria-live="polite"
            aria-atomic="true"
            className="mt-4 rounded border border-white/10 p-3 font-mono text-sm text-white"
          >
            Surveyed ({result.trueX.toFixed(2)}, {result.trueY.toFixed(2)}) m ·
            Estimate ({result.estimatedX.toFixed(2)},{" "}
            {result.estimatedY.toFixed(2)}) m · Residual (
            {result.residualX.toFixed(2)}, {result.residualY.toFixed(2)}) m ·
            Error {result.endpointError.toFixed(2)} m
          </p>
        </div>
      </div>

      <fieldset className="mt-6 rounded-lg border border-white/10 bg-white/5 p-4">
        <legend className="px-2 text-sm font-bold text-ares-gold">
          FTC source recovery
        </legend>
        <p className="text-sm leading-relaxed text-marble/80">
          Start uninitialized. The first sample selects Pinpoint or fallback.
          After a fault, five healthy samples in a row return to Pinpoint.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => sendSourceSample(true, true)}
            className={`${SAMPLE_BUTTON_CLASS} border-ares-cyan/60`}
          >
            Healthy sample
          </button>
          <button
            type="button"
            onClick={() => sendSourceSample(true, false)}
            className={`${SAMPLE_BUTTON_CLASS} border-ares-gold/60`}
          >
            Bad sample
          </button>
          <button
            type="button"
            onClick={() => sendSourceSample(false, false)}
            className={`${SAMPLE_BUTTON_CLASS} border-ares-red/70`}
          >
            Pinpoint unavailable
          </button>
        </div>
        <div
          aria-live="polite"
          aria-atomic="true"
          className="mt-4 rounded border border-white/10 bg-obsidian p-4 text-sm text-white"
        >
          <strong>Active source:</strong>{" "}
          <span className="font-mono text-ares-cyan">
            {sourceState.activeSource}
          </span>
          <span className="ml-3 text-marble/80">
            Recovery {sourceState.healthyRecoverySamples}/
            {RECOVERY_SAMPLES_REQUIRED}
          </span>
        </div>
      </fieldset>

      <p
        role="note"
        className="mt-5 border-l-4 border-ares-gold/60 bg-ares-gold/10 p-3 text-sm leading-relaxed text-white"
      >
        <strong>Model limit:</strong> This exact-error model and source trace do
        not run the estimator, inspect Pinpoint or IMU hardware, calculate
        sample health, model noise or slip, or prove accuracy. It uses five
        healthy samples. ARES rebases each source during handoff; this page does
        not.
      </p>
    </section>
  );
}

function NumberControl({
  label,
  unit,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  unit: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  const id = label.toLowerCase().replace(/[^a-z0-9]+/gu, "-");
  return (
    <div className="grid gap-2">
      <label
        htmlFor={id}
        className="flex items-center justify-between gap-3 text-sm font-semibold text-white"
      >
        <span>{label}</span>
        <output htmlFor={id} className="font-mono text-ares-cyan">
          {value.toFixed(1)} {unit}
        </output>
      </label>
      <input
        id={id}
        aria-label={label}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.currentTarget.value))}
        className="min-h-11 w-full cursor-pointer accent-ares-red"
      />
    </div>
  );
}
