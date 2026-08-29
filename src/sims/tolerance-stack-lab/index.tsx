/** @sim {"name":"Tolerance Stack Lab","requiresContext":false,"academyApproved":true,"fidelity":"conceptual"} */
import { useMemo, useState } from "react";
import { RotateCcw } from "lucide-react";

export type TolerancePart = { nominal: number; tolerance: number };

export type ToleranceStackResult =
  | { valid: false; reason: string }
  | {
      valid: true;
      nominalTotal: number;
      worstMinimum: number;
      worstMaximum: number;
      requiredMinimum: number;
      requiredMaximum: number;
      fitsWorstCase: boolean;
    };

const DEFAULT_PARTS: TolerancePart[] = [
  { nominal: 40, tolerance: 0.2 },
  { nominal: 30, tolerance: 0.2 },
  { nominal: 20, tolerance: 0.2 },
];
const DEFAULT_REQUIRED = { minimum: 89, maximum: 91 };

export function calculateToleranceStack(
  parts: TolerancePart[],
  requiredMinimum: number,
  requiredMaximum: number,
): ToleranceStackResult {
  const values = [...parts.flatMap((part) => [part.nominal, part.tolerance]), requiredMinimum, requiredMaximum];
  if (!values.every(Number.isFinite)) {
    return { valid: false, reason: "Every value must be a finite number." };
  }
  if (parts.length === 0) {
    return { valid: false, reason: "Add at least one part." };
  }
  if (parts.some((part) => part.nominal < 0 || part.tolerance < 0)) {
    return { valid: false, reason: "Part lengths and plus-or-minus tolerances cannot be negative." };
  }
  if (requiredMinimum > requiredMaximum) {
    return { valid: false, reason: "The required minimum cannot be greater than the required maximum." };
  }

  const nominalTotal = parts.reduce((sum, part) => sum + part.nominal, 0);
  const totalTolerance = parts.reduce((sum, part) => sum + part.tolerance, 0);
  const worstMinimum = nominalTotal - totalTolerance;
  const worstMaximum = nominalTotal + totalTolerance;
  return {
    valid: true,
    nominalTotal,
    worstMinimum,
    worstMaximum,
    requiredMinimum,
    requiredMaximum,
    fitsWorstCase: worstMinimum >= requiredMinimum && worstMaximum <= requiredMaximum,
  };
}

export default function ToleranceStackLab() {
  const [parts, setParts] = useState<TolerancePart[]>(DEFAULT_PARTS.map((part) => ({ ...part })));
  const [requiredMinimum, setRequiredMinimum] = useState(DEFAULT_REQUIRED.minimum);
  const [requiredMaximum, setRequiredMaximum] = useState(DEFAULT_REQUIRED.maximum);
  const result = useMemo(
    () => calculateToleranceStack(parts, requiredMinimum, requiredMaximum),
    [parts, requiredMinimum, requiredMaximum],
  );

  const updatePart = (index: number, field: keyof TolerancePart, value: number) => {
    setParts((current) => current.map((part, partIndex) => partIndex === index ? { ...part, [field]: value } : part));
  };
  const reset = () => {
    setParts(DEFAULT_PARTS.map((part) => ({ ...part })));
    setRequiredMinimum(DEFAULT_REQUIRED.minimum);
    setRequiredMaximum(DEFAULT_REQUIRED.maximum);
  };

  return (
    <section aria-labelledby="tolerance-stack-title" className="my-8 rounded-xl border border-ares-cyan/30 bg-black/35 p-4 sm:p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-ares-cyan">Concept model</p>
          <h3 id="tolerance-stack-title" className="mt-1 text-xl font-black text-white">Tolerance Stack Lab</h3>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-marble/80">
            Add three ideal lengths and their plus-or-minus ranges. Check whether every worst-case total stays inside one required range.
          </p>
        </div>
        <button type="button" onClick={reset} className="mt-2 inline-flex min-h-11 items-center justify-center gap-2 rounded border border-white/20 px-4 py-2 text-sm font-bold text-white hover:border-ares-cyan focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan sm:mt-0">
          <RotateCcw aria-hidden="true" size={16} /> Reset
        </button>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(17rem,0.8fr)]">
        <fieldset className="grid gap-4 rounded-lg border border-white/10 bg-white/5 p-4">
          <legend className="px-2 text-sm font-bold text-ares-gold">Enter lesson dimensions in millimeters</legend>
          {parts.map((part, index) => (
            <div key={index} className="grid gap-3 rounded border border-white/10 p-3 sm:grid-cols-2">
              <NumberInput label={`Part ${index + 1} nominal length`} value={part.nominal} min={0} step={0.1} onChange={(value) => updatePart(index, "nominal", value)} />
              <NumberInput label={`Part ${index + 1} plus-or-minus tolerance`} value={part.tolerance} min={0} step={0.05} onChange={(value) => updatePart(index, "tolerance", value)} />
            </div>
          ))}
          <div className="grid gap-3 sm:grid-cols-2">
            <NumberInput label="Required minimum" value={requiredMinimum} step={0.1} onChange={setRequiredMinimum} />
            <NumberInput label="Required maximum" value={requiredMaximum} step={0.1} onChange={setRequiredMaximum} />
          </div>
        </fieldset>

        <div aria-live="polite" aria-atomic="true" className="rounded-lg border border-white/10 bg-obsidian p-4">
          <h4 className="text-sm font-bold uppercase tracking-wider text-ares-gold">Worst-case check</h4>
          {result.valid ? (
            <>
              <dl className="mt-4 grid gap-4">
                <Result label="Nominal total" value={`${result.nominalTotal.toFixed(2)} mm`} />
                <Result label="Worst-case total range" value={`${result.worstMinimum.toFixed(2)}–${result.worstMaximum.toFixed(2)} mm`} />
                <Result label="Required range" value={`${result.requiredMinimum.toFixed(2)}–${result.requiredMaximum.toFixed(2)} mm`} />
              </dl>
              <p className={`mt-5 border-l-4 p-3 text-sm font-bold ${result.fitsWorstCase ? "border-emerald-400 bg-emerald-400/10 text-emerald-100" : "border-ares-red bg-ares-red/10 text-white"}`}>
                {result.fitsWorstCase ? "The arithmetic range fits the lesson requirement." : "The arithmetic range does not fit the lesson requirement."}
              </p>
            </>
          ) : (
            <p role="alert" className="mt-4 border-l-4 border-ares-red bg-ares-red/10 p-3 text-sm text-white">{result.reason}</p>
          )}
        </div>
      </div>

      <p role="note" className="mt-5 border-l-4 border-ares-gold/60 bg-ares-gold/10 p-3 text-sm leading-relaxed text-white">
        <strong>Model limit:</strong> This adds independent plus-or-minus lengths in one direction. It ignores hole position, angle, fit type, fastener play, tool error, process capability, material change, flex, load, and measurement uncertainty. It cannot approve a CAD model, fabrication process, or real part.
      </p>
    </section>
  );
}

function NumberInput({ label, value, min, step, onChange }: {
  label: string;
  value: number;
  min?: number;
  step: number;
  onChange: (value: number) => void;
}) {
  const id = label.toLowerCase().replace(/[^a-z0-9]+/gu, "-");
  return (
    <label htmlFor={id} className="grid gap-2 text-sm font-semibold text-white">
      {label}
      <span className="flex items-center gap-2">
        <input id={id} type="number" inputMode="decimal" min={min} step={step} value={value} onChange={(event) => onChange(event.currentTarget.valueAsNumber)} className="min-h-11 min-w-0 flex-1 rounded border border-white/20 bg-obsidian px-3 font-mono text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan" />
        <span aria-hidden="true" className="text-xs text-marble/70">mm</span>
      </span>
    </label>
  );
}

function Result({ label, value }: { label: string; value: string }) {
  return <div className="grid gap-1 border-b border-white/10 pb-2"><dt className="text-sm text-marble/70">{label}</dt><dd className="font-mono text-lg font-bold text-white">{value}</dd></div>;
}
