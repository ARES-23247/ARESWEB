/** @sim {"name":"ARES Kotlin Deadband Function Lab","requiresContext":false,"academyApproved":true,"fidelity":"code-derived"} */
import { useState } from "react";

type DeadbandBranch = "inside-deadband" | "denominator-guard" | "rescale";

export type DeadbandTrace = {
  denominator: number;
  branch: DeadbandBranch;
  inputSign: number;
  numerator: number;
  result: number;
};

export function traceDeadband(value: number, deadband: number): DeadbandTrace {
  const denominator = 1 - deadband;
  const inputSign = Math.sign(value);
  const numerator = value - inputSign * deadband;

  const branch =
    Math.abs(value) < deadband
      ? "inside-deadband"
      : Math.abs(denominator) < 1e-6
        ? "denominator-guard"
        : "rescale";
  return {
    denominator,
    branch,
    inputSign,
    numerator,
    result: branch === "rescale" ? numerator / denominator : 0,
  };
}

const DEFAULTS = { value: 0.55, deadband: 0.1 } as const;

const PRESETS = [
  { label: "Inside deadband test", value: 0.04, deadband: 0.05 },
  { label: "Positive rescale test", value: 0.55, deadband: 0.1 },
  { label: "Negative rescale test", value: -0.55, deadband: 0.1 },
  { label: "Full positive input", value: 1, deadband: 0.1 },
] as const;

const branchLabels: Record<DeadbandBranch, string> = {
  "inside-deadband": "Inside the quiet area: return 0",
  "denominator-guard": "Denominator is nearly zero: return 0",
  rescale: "Outside the quiet area: rescale the active range",
};

function format(value: number, digits = 3): string {
  return Object.is(value, -0) ? "0" : value.toFixed(digits);
}

export default function KotlinExpressionLab() {
  const [value, setValue] = useState<number>(DEFAULTS.value);
  const [deadband, setDeadband] = useState<number>(DEFAULTS.deadband);
  const trace = traceDeadband(value, deadband);

  const applyPreset = (preset: (typeof PRESETS)[number]) => {
    setValue(preset.value);
    setDeadband(preset.deadband);
  };

  const reset = () => {
    setValue(DEFAULTS.value);
    setDeadband(DEFAULTS.deadband);
  };

  return (
    <section
      aria-labelledby="kotlin-expression-title"
      className="my-8 rounded-xl border border-ares-cyan/30 bg-black/35 p-4 sm:p-6"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-ares-cyan">
            Current ARES 11.1 function model
          </p>
          <h3
            id="kotlin-expression-title"
            className="mt-1 text-xl font-black text-white"
          >
            ARES Kotlin Deadband Function Lab
          </h3>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-marble/80">
            Trace the parameters, first matching branch, and return value from
            InputMath.applyDeadband.
          </p>
        </div>
        <button
          type="button"
          onClick={reset}
          className="min-h-11 rounded border border-white/20 px-4 py-2 text-sm font-bold text-white hover:border-ares-cyan focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
        >
          Reset values
        </button>
      </div>

      <fieldset className="mt-6 grid gap-3 rounded-lg border border-white/10 bg-white/5 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <legend className="px-2 text-sm font-bold text-ares-gold">
          Load a current unit-test case
        </legend>
        {PRESETS.map((preset) => (
          <button
            key={preset.label}
            type="button"
            onClick={() => applyPreset(preset)}
            className="min-h-11 rounded border border-white/20 bg-black/20 px-3 py-2 text-sm font-bold text-white hover:border-ares-cyan focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
          >
            {preset.label}
          </button>
        ))}
      </fieldset>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <fieldset className="grid content-start gap-5 rounded-lg border border-white/10 bg-white/5 p-4">
          <legend className="px-2 text-sm font-bold text-ares-gold">
            Function arguments
          </legend>
          <p id="deadband-contract-hint" className="text-xs text-marble/70">
            Joystick: -1.00 through 1.00. Deadband: 0.00 through 0.99.
          </p>
          <NumberInput
            id="deadband-value"
            label="Joystick value"
            value={value}
            min={-1}
            max={1}
            step={0.01}
            onChange={setValue}
          />
          <NumberInput
            id="deadband-size"
            label="Deadband"
            value={deadband}
            min={0}
            max={0.99}
            step={0.01}
            onChange={setDeadband}
          />
        </fieldset>

        <div className="rounded-lg border border-white/10 bg-obsidian p-4">
          <h4 className="text-sm font-bold uppercase tracking-wider text-ares-gold">
            Trace the Kotlin decision
          </h4>
          <pre className="mt-4 overflow-x-auto rounded border border-white/10 bg-black p-4 text-sm text-ares-cyan">
            <code>
              InputMath.applyDeadband({format(value, 2)}, {format(deadband, 2)})
            </code>
          </pre>
          <p
            role="status"
            aria-live="polite"
            className="mt-4 rounded border border-ares-cyan/30 bg-ares-cyan/10 p-3 text-sm font-bold text-white"
          >
            {branchLabels[trace.branch]}
          </p>
          <dl className="mt-4 grid gap-3 sm:grid-cols-2">
            <Datum label="denominator" value={format(trace.denominator)} />
            <Datum label="sign(value)" value={format(trace.inputSign, 0)} />
            <Datum label="numerator" value={format(trace.numerator)} />
            <Datum label="return value" value={format(trace.result)} />
          </dl>
        </div>
      </div>

      <p
        role="note"
        className="mt-5 border-l-4 border-ares-gold/60 bg-ares-gold/10 p-3 text-sm leading-relaxed text-white"
      >
        <strong>Model limit:</strong> This TypeScript model copies the current
        Kotlin branch math only for documented valid inputs. It does not compile
        Kotlin, read a gamepad, run the ARES Store, check a controller mapping,
        command hardware, or prove physical robot behavior.
      </p>
    </section>
  );
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
    <div className="grid gap-2 text-sm font-bold text-white">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        aria-describedby="deadband-contract-hint"
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(event) => {
          const next = Number(event.currentTarget.value);
          if (Number.isFinite(next))
            onChange(Math.min(max, Math.max(min, next)));
        }}
        className="min-h-11 rounded border border-white/20 bg-black px-3 py-2 font-mono text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
      />
    </div>
  );
}

function Datum({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-white/10 p-3">
      <dt className="text-xs uppercase tracking-wide text-marble/70">
        {label}
      </dt>
      <dd className="mt-1 break-words font-mono font-bold text-white">
        {value}
      </dd>
    </div>
  );
}
