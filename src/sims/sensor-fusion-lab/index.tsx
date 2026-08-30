/** @sim {"name":"Sensor Fusion Uncertainty Lab","requiresContext":false,"academyApproved":true,"fidelity":"conceptual"} */
import { useMemo, useState } from "react";

export type FusionTrial = {
  accepted: boolean;
  fusedPosition: number;
  residual: number;
  reason: string;
  predictionInfluence: number;
  visionInfluence: number;
};

const DEFAULTS = {
  prediction: 2.8,
  predictionSigma: 0.35,
  vision: 3.3,
  visionSigma: 0.2,
  ambiguity: 0.1,
  truth: 3,
} as const;
const AMBIGUITY_LIMIT = 0.2;

export function calculateConceptFusion(
  prediction: number,
  predictionSigma: number,
  vision: number,
  visionSigma: number,
  ambiguity: number,
): FusionTrial {
  if (
    ![prediction, predictionSigma, vision, visionSigma, ambiguity].every(
      Number.isFinite,
    ) ||
    predictionSigma <= 0 ||
    visionSigma <= 0
  ) {
    throw new Error(
      "Fusion inputs must be finite and uncertainty must be positive.",
    );
  }

  const residual = vision - prediction;
  if (ambiguity > AMBIGUITY_LIMIT) {
    return {
      accepted: false,
      fusedPosition: prediction,
      residual,
      reason: "high ambiguity",
      predictionInfluence: 1,
      visionInfluence: 0,
    };
  }

  const predictionWeight = 1 / predictionSigma ** 2;
  const visionWeight = 1 / visionSigma ** 2;
  const totalWeight = predictionWeight + visionWeight;
  return {
    accepted: true,
    fusedPosition:
      (prediction * predictionWeight + vision * visionWeight) / totalWeight,
    residual,
    reason: "accepted by this lesson rule",
    predictionInfluence: predictionWeight / totalWeight,
    visionInfluence: visionWeight / totalWeight,
  };
}

export default function SensorFusionLab() {
  const [prediction, setPrediction] = useState<number>(DEFAULTS.prediction);
  const [predictionSigma, setPredictionSigma] = useState<number>(
    DEFAULTS.predictionSigma,
  );
  const [vision, setVision] = useState<number>(DEFAULTS.vision);
  const [visionSigma, setVisionSigma] = useState<number>(DEFAULTS.visionSigma);
  const [ambiguity, setAmbiguity] = useState<number>(DEFAULTS.ambiguity);
  const [truth, setTruth] = useState<number>(DEFAULTS.truth);
  const result = useMemo(
    () =>
      calculateConceptFusion(
        prediction,
        predictionSigma,
        vision,
        visionSigma,
        ambiguity,
      ),
    [ambiguity, prediction, predictionSigma, vision, visionSigma],
  );
  const resultError = Math.abs(result.fusedPosition - truth);
  const x = (value: number) => 35 + value * 66;

  const reset = () => {
    setPrediction(DEFAULTS.prediction);
    setPredictionSigma(DEFAULTS.predictionSigma);
    setVision(DEFAULTS.vision);
    setVisionSigma(DEFAULTS.visionSigma);
    setAmbiguity(DEFAULTS.ambiguity);
    setTruth(DEFAULTS.truth);
  };

  return (
    <section
      aria-labelledby="sensor-fusion-title"
      className="my-8 rounded-xl border border-ares-cyan/30 bg-black/35 p-4 sm:p-6"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-ares-cyan">
            Concept
          </p>
          <h3
            id="sensor-fusion-title"
            className="mt-1 text-xl font-black text-white"
          >
            Sensor Fusion Uncertainty Lab
          </h3>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-marble/80">
            Compare a 1D update, a rejection, and independent truth.
          </p>
        </div>
        <button
          type="button"
          onClick={reset}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded border border-white/20 px-4 py-2 text-sm font-bold text-white hover:border-ares-cyan focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
        >
          <span aria-hidden="true">↺</span> Reset
        </button>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(17rem,0.9fr)_minmax(0,1.1fr)]">
        <fieldset className="grid gap-4 rounded-lg border border-white/10 bg-white/5 p-4">
          <legend className="px-2 text-sm font-bold text-ares-gold">
            Choose lesson measurements
          </legend>
          <NumberControl
            label="Predicted position"
            unit="m"
            value={prediction}
            min={0}
            max={5}
            step={0.1}
            onChange={setPrediction}
          />
          <NumberControl
            label="Prediction uncertainty"
            unit="m"
            value={predictionSigma}
            min={0.1}
            max={1}
            step={0.05}
            onChange={setPredictionSigma}
          />
          <NumberControl
            label="Vision position"
            unit="m"
            value={vision}
            min={0}
            max={5}
            step={0.1}
            onChange={setVision}
          />
          <NumberControl
            label="Vision uncertainty"
            unit="m"
            value={visionSigma}
            min={0.1}
            max={1}
            step={0.05}
            onChange={setVisionSigma}
          />
          <NumberControl
            label="Vision ambiguity"
            unit=""
            value={ambiguity}
            min={0}
            max={0.5}
            step={0.01}
            onChange={setAmbiguity}
          />
          <NumberControl
            label="Independent truth"
            unit="m"
            value={truth}
            min={0}
            max={5}
            step={0.1}
            onChange={setTruth}
          />
        </fieldset>

        <div className="rounded-lg border border-white/10 bg-obsidian p-4">
          <h4 className="text-sm font-bold uppercase tracking-wider text-ares-gold">
            One-dimensional position comparison
          </h4>
          <svg
            viewBox="0 0 400 165"
            className="mt-3 h-auto w-full"
            role="img"
            aria-label={`Prediction ${prediction.toFixed(2)} m; vision ${vision.toFixed(2)} m ${result.accepted ? "accepted" : "rejected"}; result ${result.fusedPosition.toFixed(2)} m; truth ${truth.toFixed(2)} m.`}
          >
            <line
              x1="35"
              y1="80"
              x2="365"
              y2="80"
              stroke="currentColor"
              className="text-white/40"
            />
            <circle
              cx={x(prediction)}
              cy="45"
              r="8"
              fill="currentColor"
              className="text-ares-gold"
            />
            <circle
              cx={x(result.fusedPosition)}
              cy="80"
              r="7"
              fill="currentColor"
              className="text-ares-cyan"
            />
            <circle
              cx={x(vision)}
              cy="110"
              r="8"
              fill="currentColor"
              className="text-ares-red"
            />
            <circle
              cx={x(truth)}
              cy="135"
              r="6"
              fill="currentColor"
              className="text-white"
            />
            <text
              x="35"
              y="158"
              fill="currentColor"
              className="text-[11px] text-white"
            >
              0 m
            </text>
            <text
              x="340"
              y="158"
              fill="currentColor"
              className="text-[11px] text-white"
            >
              5 m
            </text>
          </svg>
          <dl
            aria-live="polite"
            className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
          >
            <Result
              label="Vision decision"
              value={result.accepted ? "Accepted" : "Rejected"}
            />
            <Result
              label="Lesson result"
              value={`${result.fusedPosition.toFixed(2)} m`}
            />
            <Result
              label="Signed residual"
              value={`${result.residual.toFixed(2)} m`}
            />
            <Result
              label="Prediction influence"
              value={`${(result.predictionInfluence * 100).toFixed(0)}%`}
            />
            <Result
              label="Vision influence"
              value={`${(result.visionInfluence * 100).toFixed(0)}%`}
            />
            <Result
              label="Result error vs truth"
              value={`${resultError.toFixed(2)} m`}
            />
          </dl>
          <p className="mt-3 text-sm text-marble/80">
            Reason: {result.reason}. Lesson ambiguity limit:{" "}
            {AMBIGUITY_LIMIT.toFixed(2)}.
          </p>
        </div>
      </div>

      <details className="mt-5 rounded border border-white/10 bg-white/5 p-3 text-sm text-white">
        <summary className="min-h-11 cursor-pointer font-bold text-ares-cyan">
          Open the measurement table
        </summary>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[30rem] text-left">
            <thead>
              <tr>
                <th className="p-2">Source</th>
                <th className="p-2">Position</th>
                <th className="p-2">Uncertainty</th>
                <th className="p-2">Use</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-white/10">
                <td className="p-2">Prediction</td>
                <td className="p-2">{prediction.toFixed(2)} m</td>
                <td className="p-2">{predictionSigma.toFixed(2)} m</td>
                <td className="p-2">Prior</td>
              </tr>
              <tr className="border-t border-white/10">
                <td className="p-2">Vision</td>
                <td className="p-2">{vision.toFixed(2)} m</td>
                <td className="p-2">{visionSigma.toFixed(2)} m</td>
                <td className="p-2">
                  {result.accepted ? "Fused" : "Rejected"}
                </td>
              </tr>
              <tr className="border-t border-white/10">
                <td className="p-2">Independent truth</td>
                <td className="p-2">{truth.toFixed(2)} m</td>
                <td className="p-2">Not modeled</td>
                <td className="p-2">Checks result only</td>
              </tr>
            </tbody>
          </table>
        </div>
      </details>

      <p
        role="note"
        className="mt-5 border-l-4 border-ares-gold/60 bg-ares-gold/10 p-3 text-sm leading-relaxed text-white"
      >
        <strong>Model limit:</strong> This invented 1D weighted average is not
        the ARES EKF. Its single ambiguity rule omits field bounds, timestamps,
        tag count, viewing angle, covariance matrices, history replay,
        innovation tests, and physical camera behavior. Independent truth checks
        the displayed result but never changes it.
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
          {value.toFixed(2)}
          {unit ? ` ${unit}` : ""}
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

function Result({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-white/10 p-3">
      <dt className="text-xs uppercase tracking-wide text-marble/70">
        {label}
      </dt>
      <dd className="mt-1 font-mono text-lg font-bold text-white">{value}</dd>
    </div>
  );
}
