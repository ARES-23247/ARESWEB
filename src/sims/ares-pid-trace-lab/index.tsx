/** @sim {"name":"ARES PID Source Trace","requiresContext":false,"academyApproved":true,"fidelity":"code-derived"} */
import { useState } from "react";
import { AcademyMetric } from "@/sims/shared/academy-interaction-ui";

type AresPidTraceInput = {
  p: number;
  i: number;
  d: number;
  measurement: number;
  setpoint: number;
  dtSeconds: number;
  previousMeasurement: number;
  previousFilteredDerivative: number;
  totalError: number;
  isFirstStep?: boolean;
  deadzone?: number;
  minOutput?: number;
  maxOutput?: number;
};

export type AresPidTraceResult = {
  error: number;
  proposedIntegral: number;
  storedIntegral: number;
  filteredMeasurementRate: number;
  pTerm: number;
  iTerm: number;
  dTerm: number;
  preLimitOutput: number;
  output: number;
  integratorFrozen: boolean;
  reason: string;
};

const TRACE_PRESETS = [
  {
    label: "Worked step",
    input: { p: 0.5, i: 0.25, d: 0.4, measurement: 0.6, setpoint: 1, dtSeconds: 0.1, previousMeasurement: 0.5, previousFilteredDerivative: 0, totalError: 0.1 },
  },
  {
    label: "First after reset",
    input: { p: 0.5, i: 0.25, d: 0.4, measurement: 0.6, setpoint: 1, dtSeconds: 0.1, previousMeasurement: 0.5, previousFilteredDerivative: 2, totalError: 0, isFirstStep: true },
  },
  {
    label: "Output limited",
    input: { p: 2, i: 1, d: 0, measurement: 0, setpoint: 10, dtSeconds: 1, previousMeasurement: 0, previousFilteredDerivative: 0, totalError: 0, isFirstStep: true, minOutput: -1, maxOutput: 1 },
  },
  {
    label: "Inside deadzone",
    input: { p: 1, i: 1, d: 1, measurement: 0.95, setpoint: 1, dtSeconds: 0.1, previousMeasurement: 0.5, previousFilteredDerivative: 0.2, totalError: 0.8, deadzone: 0.1 },
  },
  {
    label: "Invalid loop time",
    input: { p: 1, i: 1, d: 1, measurement: 0, setpoint: 1, dtSeconds: 0, previousMeasurement: 0, previousFilteredDerivative: 0, totalError: 0 },
  },
] satisfies { label: string; input: AresPidTraceInput }[];

export function calculateAresPidTrace(input: AresPidTraceInput): AresPidTraceResult {
  const valid = [input.p, input.i, input.d, input.measurement, input.setpoint, input.dtSeconds]
    .every(Number.isFinite) && input.dtSeconds > 0;
  const error = valid ? input.setpoint - input.measurement : 0;
  const base = {
    error,
    proposedIntegral: input.totalError,
    storedIntegral: input.totalError,
    filteredMeasurementRate: 0,
    pTerm: 0,
    iTerm: 0,
    dTerm: 0,
    preLimitOutput: 0,
    output: 0,
    integratorFrozen: false,
  };
  if (!valid) return { ...base, reason: "Invalid input: zero output." };
  const deadzone = input.deadzone ?? 0;
  if (Number.isFinite(deadzone) && deadzone > 0 && Math.abs(error) < deadzone) {
    return { ...base, reason: "Deadzone: output is zero; stored rate clears." };
  }

  const measuredRate = input.isFirstStep ? 0 : (input.measurement - input.previousMeasurement) / input.dtSeconds;
  const filteredMeasurementRate = input.isFirstStep
    ? 0
    : 0.2 * measuredRate + 0.8 * input.previousFilteredDerivative;
  const proposedIntegral = input.totalError + error * input.dtSeconds;
  const proposedOutput = input.p * error + input.i * proposedIntegral - input.d * filteredMeasurementRate;
  const integratorFrozen = (proposedOutput > (input.maxOutput ?? Number.POSITIVE_INFINITY) && error > 0)
    || (proposedOutput < (input.minOutput ?? Number.NEGATIVE_INFINITY) && error < 0);
  const storedIntegral = integratorFrozen ? input.totalError : proposedIntegral;
  const pTerm = input.p * error;
  const iTerm = input.i * storedIntegral;
  const dTerm = -input.d * filteredMeasurementRate;
  const preLimitOutput = pTerm + iTerm + dTerm;
  const output = Math.min(
    input.maxOutput ?? Number.POSITIVE_INFINITY,
    Math.max(input.minOutput ?? Number.NEGATIVE_INFINITY, preLimitOutput),
  );
  return {
    error,
    proposedIntegral,
    storedIntegral,
    filteredMeasurementRate,
    pTerm,
    iTerm,
    dTerm,
    preLimitOutput,
    output,
    integratorFrozen,
    reason: integratorFrozen
      ? "Limit: stored error freezes."
      : "Stored error updates.",
  };
}

export default function AresPidTraceLab() {
  const [presetIndex, setPresetIndex] = useState(0);
  const trace = calculateAresPidTrace(TRACE_PRESETS[presetIndex].input);
  const metrics: [string, number][] = [
    ["Error", trace.error],
    ["Proposed stored error", trace.proposedIntegral],
    ["Stored error used", trace.storedIntegral],
    ["Filtered measured rate", trace.filteredMeasurementRate],
    ["P term", trace.pTerm],
    ["I term", trace.iTerm],
    ["D term", trace.dTerm],
    ["Before output limit", trace.preLimitOutput],
    ["Final output", trace.output],
  ];

  return (
    <section aria-labelledby="ares-pid-trace-title" className="my-8 rounded-xl border border-ares-gold/30 bg-obsidian p-4 sm:p-6">
      <p className="text-xs font-bold uppercase tracking-widest text-ares-gold">ARES 11.1.0 source trace</p>
      <h3 id="ares-pid-trace-title" className="mt-1 text-xl font-black text-white">Follow one tested PID step</h3>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {TRACE_PRESETS.map((preset, index) => (
          <button
            key={preset.label}
            type="button"
            aria-pressed={presetIndex === index}
            onClick={() => setPresetIndex(index)}
            className="min-h-11 rounded border border-white/20 px-3 py-2 text-sm font-bold text-white hover:border-ares-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan aria-pressed:border-ares-gold aria-pressed:bg-ares-gold/15"
          >
            {preset.label}
          </button>
        ))}
      </div>
      <p role="status" className="mt-4 border-l-4 border-ares-gold/60 bg-ares-gold/10 p-3 text-sm text-white">
        {trace.reason}
      </p>
      <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map(([label, value]) => <AcademyMetric key={label} label={label} value={format(value)} />)}
      </dl>
      <p role="note" className="mt-5 border-l-4 border-ares-gold/60 bg-ares-gold/10 p-3 text-sm leading-relaxed text-white">
        <strong>Model limit:</strong> Pinned math only—not Kotlin, hardware, or safe gains.
      </p>
    </section>
  );
}

function format(value: number): string {
  return Number.isFinite(value) ? value.toFixed(3) : "0.000";
}
