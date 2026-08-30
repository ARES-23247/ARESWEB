/** @sim {"name":"Motion Profile Lab","requiresContext":false,"academyApproved":true,"fidelity":"conceptual"} */
import { useMemo, useState } from "react";
import { AcademyMetric, AcademyRangeControl } from "@/sims/shared/academy-interaction-ui";
import { RotateCcw } from "lucide-react";

export type MotionProfileSample = {
  time: number;
  position: number;
  velocity: number;
  acceleration: number;
  phase: "accelerate" | "cruise" | "decelerate" | "complete";
};

export type MotionProfileResult = {
  samples: MotionProfileSample[];
  kind: "triangular" | "trapezoidal";
  peakVelocity: number;
  accelerationTime: number;
  cruiseTime: number;
  totalTime: number;
  cruiseThresholdDistance: number;
};

const DEFAULTS = { distance: 3, maxVelocity: 2, maxAcceleration: 1.5 } as const;

export function calculateConceptMotionProfile(
  distance: number,
  maxVelocity: number,
  maxAcceleration: number,
): MotionProfileResult {
  if (
    ![distance, maxVelocity, maxAcceleration].every(Number.isFinite) ||
    distance <= 0 ||
    maxVelocity <= 0 ||
    maxAcceleration <= 0
  ) {
    throw new Error("Motion-profile inputs must be positive finite values.");
  }

  const timeToVelocityLimit = maxVelocity / maxAcceleration;
  const accelerationDistance = 0.5 * maxAcceleration * timeToVelocityLimit ** 2;
  const triangular = 2 * accelerationDistance >= distance;
  const peakVelocity = triangular
    ? Math.sqrt(distance * maxAcceleration)
    : maxVelocity;
  const accelerationTime = peakVelocity / maxAcceleration;
  const cruiseDistance = triangular
    ? 0
    : distance - peakVelocity ** 2 / maxAcceleration;
  const cruiseTime = cruiseDistance / peakVelocity;
  const totalTime = 2 * accelerationTime + cruiseTime;
  const cruiseThresholdDistance = maxVelocity ** 2 / maxAcceleration;
  const samples = Array.from(
    { length: 61 },
    (_unused, index): MotionProfileSample => {
      const time = (totalTime * index) / 60;
      if (index === 60)
        return {
          time,
          position: distance,
          velocity: 0,
          acceleration: 0,
          phase: "complete",
        };
      if (time <= accelerationTime) {
        return {
          time,
          position: 0.5 * maxAcceleration * time ** 2,
          velocity: maxAcceleration * time,
          acceleration: maxAcceleration,
          phase: "accelerate",
        };
      }
      if (time <= accelerationTime + cruiseTime) {
        const elapsed = time - accelerationTime;
        return {
          time,
          position:
            0.5 * maxAcceleration * accelerationTime ** 2 +
            peakVelocity * elapsed,
          velocity: peakVelocity,
          acceleration: 0,
          phase: "cruise",
        };
      }
      const timeRemaining = totalTime - time;
      return {
        time,
        position: distance - 0.5 * maxAcceleration * timeRemaining ** 2,
        velocity: maxAcceleration * timeRemaining,
        acceleration: -maxAcceleration,
        phase: "decelerate",
      };
    },
  );

  return {
    samples,
    kind: triangular ? "triangular" : "trapezoidal",
    peakVelocity,
    accelerationTime,
    cruiseTime,
    totalTime,
    cruiseThresholdDistance,
  };
}

export default function MotionProfileLab() {
  const [distance, setDistance] = useState<number>(DEFAULTS.distance);
  const [maxVelocity, setMaxVelocity] = useState<number>(DEFAULTS.maxVelocity);
  const [maxAcceleration, setMaxAcceleration] = useState<number>(
    DEFAULTS.maxAcceleration,
  );
  const profile = useMemo(
    () => calculateConceptMotionProfile(distance, maxVelocity, maxAcceleration),
    [distance, maxVelocity, maxAcceleration],
  );
  const boundaryMargin = distance - profile.cruiseThresholdDistance;

  const reset = () => {
    setDistance(DEFAULTS.distance);
    setMaxVelocity(DEFAULTS.maxVelocity);
    setMaxAcceleration(DEFAULTS.maxAcceleration);
  };
  const velocityPoints = profile.samples
    .map(
      (sample) =>
        `${30 + (sample.time / profile.totalTime) * 340},${180 - (sample.velocity / Math.max(profile.peakVelocity, 0.01)) * 130}`,
    )
    .join(" ");

  return (
    <section
      aria-labelledby="motion-profile-title"
      className="my-8 rounded-xl border border-ares-cyan/30 bg-black/35 p-4 sm:p-6"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-ares-cyan">
            Concept model
          </p>
          <h3
            id="motion-profile-title"
            className="mt-1 text-xl font-black text-white"
          >
            Motion Profile Lab
          </h3>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-marble/80">
            Plan a rest-to-rest move with bounded velocity and acceleration.
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

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(16rem,0.8fr)_minmax(0,1.2fr)]">
        <fieldset className="grid gap-5 rounded-lg border border-white/10 bg-white/5 p-4">
          <legend className="px-2 text-sm font-bold text-ares-gold">
            Choose motion limits
          </legend>
          <NumberControl
            label="Move distance"
            unit="m"
            value={distance}
            min={0.5}
            max={5}
            step={0.1}
            onChange={setDistance}
          />
          <NumberControl
            label="Maximum velocity"
            unit="m/s"
            value={maxVelocity}
            min={0.5}
            max={4}
            step={0.1}
            onChange={setMaxVelocity}
          />
          <NumberControl
            label="Maximum acceleration"
            unit="m/s²"
            value={maxAcceleration}
            min={0.5}
            max={5}
            step={0.1}
            onChange={setMaxAcceleration}
          />
        </fieldset>

        <div className="rounded-lg border border-white/10 bg-obsidian p-4">
          <h4 className="text-sm font-bold uppercase tracking-wider text-ares-gold">
            Velocity setpoint over time
          </h4>
          <svg
            viewBox="0 0 400 210"
            className="mt-3 h-auto w-full"
            role="img"
            aria-label={`${profile.kind} velocity profile. Peak velocity ${profile.peakVelocity.toFixed(2)} meters per second. Total time ${profile.totalTime.toFixed(2)} seconds.`}
          >
            <line
              x1="30"
              y1="180"
              x2="370"
              y2="180"
              stroke="currentColor"
              className="text-white/40"
            />
            <line
              x1="30"
              y1="30"
              x2="30"
              y2="180"
              stroke="currentColor"
              className="text-white/40"
            />
            <polyline
              points={velocityPoints}
              fill="none"
              stroke="currentColor"
              className="text-ares-cyan"
              strokeWidth="4"
            />
            <text
              x="34"
              y="25"
              fill="currentColor"
              className="text-[11px] text-white"
            >
              velocity
            </text>
            <text
              x="315"
              y="198"
              fill="currentColor"
              className="text-[11px] text-white"
            >
              time
            </text>
          </svg>
          <dl
            aria-live="polite"
            aria-atomic="true"
            className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
          >
            <Result label="Profile shape" value={profile.kind} />
            <Result
              label="Peak velocity"
              value={`${profile.peakVelocity.toFixed(2)} m/s`}
            />
            <Result
              label="Speed-up time"
              value={`${profile.accelerationTime.toFixed(2)} s`}
            />
            <Result
              label="Cruise time"
              value={`${profile.cruiseTime.toFixed(2)} s`}
            />
            <Result
              label="Total time"
              value={`${profile.totalTime.toFixed(2)} s`}
            />
            <Result
              label="Cruise boundary"
              value={`${profile.cruiseThresholdDistance.toFixed(2)} m`}
            />
            <Result
              label="Boundary margin"
              value={`${boundaryMargin >= 0 ? "+" : ""}${boundaryMargin.toFixed(2)} m`}
            />
          </dl>
        </div>
      </div>

      <details className="mt-5 rounded border border-white/10 bg-white/5 p-3 text-sm text-white">
        <summary className="min-h-11 cursor-pointer font-bold text-ares-cyan">
          Open the numeric result table
        </summary>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[30rem] text-left">
            <thead>
              <tr>
                <th className="p-2">Time</th>
                <th className="p-2">Position</th>
                <th className="p-2">Velocity</th>
                <th className="p-2">Acceleration</th>
                <th className="p-2">Phase</th>
              </tr>
            </thead>
            <tbody>
              {profile.samples
                .filter((_sample, index) => index % 10 === 0)
                .map((sample) => (
                  <tr key={sample.time} className="border-t border-white/10">
                    <td className="p-2">{sample.time.toFixed(2)} s</td>
                    <td className="p-2">{sample.position.toFixed(2)} m</td>
                    <td className="p-2">{sample.velocity.toFixed(2)} m/s</td>
                    <td className="p-2">
                      {sample.acceleration.toFixed(2)} m/s²
                    </td>
                    <td className="p-2 capitalize">{sample.phase}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </details>

      <p
        role="note"
        className="mt-5 border-l-4 border-ares-gold/60 bg-ares-gold/10 p-3 text-sm leading-relaxed text-white"
      >
        <strong>Model limit:</strong> This classroom lab uses the same basic
        rest-to-rest motion math, but it does not execute ARES. It plans only
        positive, one-dimensional motion. ARES also handles reverse moves and
        nonzero boundary speeds. Neither model proves traction, load, current,
        backlash, controller tracking, or safe physical limits.
      </p>
    </section>
  );
}

function NumberControl(props: Parameters<typeof AcademyRangeControl>[0]) {
  return <AcademyRangeControl {...props} decimals={1} />;
}

function Result(props: Parameters<typeof AcademyMetric>[0]) {
  return <AcademyMetric {...props} capitalize />;
}
