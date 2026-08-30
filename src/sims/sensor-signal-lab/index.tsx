/** @sim {"name":"Current ARES Sensor Evidence Lab","requiresContext":false,"academyApproved":true,"fidelity":"code-derived"} */
import { useState } from "react";

export type SensorEvidenceLayer =
  "RAW_INTERFACE" | "FTC_CACHE" | "GENERATED_SNAPSHOT";
export type SensorReadingKind = "FINITE" | "NOT_A_NUMBER" | "POSITIVE_INFINITY";

export type SensorEvidenceInput = {
  layer: SensorEvidenceLayer;
  readingKind: SensorReadingKind;
  valueMeters: number;
  feedbackValid: boolean;
  configured: boolean;
  ageMs: number;
  maxAgeMs: number;
};

export type SignalFinding = {
  status:
    | "Blocked"
    | "Raw value only"
    | "Cached value only"
    | "Usable generated snapshot";
  reason: string;
  missing: string;
};

const DEFAULTS: SensorEvidenceInput = {
  layer: "RAW_INTERFACE",
  readingKind: "FINITE",
  valueMeters: 0.75,
  feedbackValid: true,
  configured: true,
  ageMs: 20,
  maxAgeMs: 100,
};

const LAYER_LABELS: Record<SensorEvidenceLayer, string> = {
  RAW_INTERFACE: "Raw interface",
  FTC_CACHE: "FTC cache",
  GENERATED_SNAPSHOT: "Generated snapshot",
};

function finding(
  status: SignalFinding["status"],
  reason: string,
  missing: string,
): SignalFinding {
  return { status, reason, missing };
}

function representedValue(input: SensorEvidenceInput): number {
  if (input.readingKind === "NOT_A_NUMBER") return Number.NaN;
  if (input.readingKind === "POSITIVE_INFINITY")
    return Number.POSITIVE_INFINITY;
  return input.valueMeters;
}

export function classifySensorEvidence(
  input: SensorEvidenceInput,
): SignalFinding {
  const value = representedValue(input);
  if (!Number.isFinite(value)) {
    return finding(
      "Blocked",
      "The raw distance contract uses this value as failed or out-of-range evidence.",
      "A usable distance and physical evidence.",
    );
  }
  if (value < 0) {
    return finding(
      "Blocked",
      "A negative value is not a credible distance.",
      "A non-negative reading and physical range evidence.",
    );
  }
  if (input.layer === "RAW_INTERFACE") {
    return finding(
      "Raw value only",
      "DistanceSensorIO reports meters but does not report age or configuration health.",
      "Freshness, configuration health, and physical accuracy.",
    );
  }
  if (input.layer === "FTC_CACHE") {
    return finding(
      "Cached value only",
      "FtcDistanceSensor returns its cached value but exposes no public sample time.",
      "Known age, configuration health, and physical accuracy.",
    );
  }
  if (value > 10) {
    return finding(
      "Blocked",
      "The generated distance scaffold accepts 0 through 10 meters by default.",
      "An in-range sample or a reviewed range for the real device.",
    );
  }
  if (!input.feedbackValid) {
    return finding(
      "Blocked",
      "The generated refresh did not produce a valid complete snapshot.",
      "A successful finite, in-range refresh.",
    );
  }
  if (!input.configured) {
    return finding(
      "Blocked",
      "Required device configuration is not healthy.",
      "Successful required configuration.",
    );
  }
  if (
    ![input.ageMs, input.maxAgeMs].every(Number.isFinite) ||
    input.ageMs < 0 ||
    input.maxAgeMs < 0
  ) {
    return finding(
      "Blocked",
      "Snapshot ages must be finite and non-negative.",
      "A valid age and maximum age.",
    );
  }
  if (input.ageMs > input.maxAgeMs) {
    return finding(
      "Blocked",
      "The complete snapshot is older than its allowed age.",
      "A newer valid snapshot.",
    );
  }
  return finding(
    "Usable generated snapshot",
    "The snapshot is finite, in range, valid, configured, and fresh.",
    "Physical placement, wiring, target, noise, and robot behavior.",
  );
}

export default function SensorSignalLab() {
  const [input, setInput] = useState<SensorEvidenceInput>(DEFAULTS);
  const result = classifySensorEvidence(input);
  const isGenerated = input.layer === "GENERATED_SNAPSHOT";
  const update = <Key extends keyof SensorEvidenceInput>(
    key: Key,
    value: SensorEvidenceInput[Key],
  ) => {
    setInput((current) => ({ ...current, [key]: value }));
  };

  return (
    <section
      aria-labelledby="sensor-signal-title"
      className="my-8 rounded-xl border border-ares-cyan/30 bg-black/35 p-4 sm:p-6"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-ares-cyan">
            Three current source layers
          </p>
          <h3
            id="sensor-signal-title"
            className="mt-1 text-xl font-black text-white"
          >
            Current ARES Sensor Evidence Lab
          </h3>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-marble/80">
            Compare evidence from a raw value, FTC cache, and generated
            snapshot.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setInput(DEFAULTS)}
          className="inline-flex min-h-11 items-center justify-center rounded border border-white/20 px-4 py-2 text-sm font-bold text-white hover:border-ares-cyan focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
        >
          Reset evidence
        </button>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="grid gap-4 rounded-lg border border-white/10 bg-white/5 p-4">
          <SelectField
            id="sensor-layer"
            label="Evidence layer"
            value={input.layer}
            options={Object.entries(LAYER_LABELS)}
            onChange={(value) => update("layer", value as SensorEvidenceLayer)}
          />
          <SelectField
            id="sensor-reading-kind"
            label="Reported reading"
            value={input.readingKind}
            options={[
              ["FINITE", "Finite number"],
              ["NOT_A_NUMBER", "NaN sentinel"],
              ["POSITIVE_INFINITY", "Positive-infinity sentinel"],
            ]}
            onChange={(value) =>
              update("readingKind", value as SensorReadingKind)
            }
          />
          <NumberField
            id="distance-value"
            label="Distance (meters)"
            value={input.valueMeters}
            step={0.05}
            disabled={input.readingKind !== "FINITE"}
            onChange={(value) => update("valueMeters", value)}
          />

          <fieldset
            disabled={!isGenerated}
            className="grid gap-4 rounded border border-white/10 p-4 disabled:opacity-55"
          >
            <legend className="px-2 text-sm font-bold text-ares-gold">
              Generated snapshot evidence
            </legend>
            <NumberField
              id="sample-age"
              label="Snapshot age (milliseconds)"
              value={input.ageMs}
              step={1}
              minimum={0}
              onChange={(value) => update("ageMs", value)}
            />
            <NumberField
              id="maximum-age"
              label="Maximum allowed age (milliseconds)"
              value={input.maxAgeMs}
              step={1}
              minimum={0}
              onChange={(value) => update("maxAgeMs", value)}
            />
            <CheckField
              label="Generated refresh produced a valid snapshot"
              checked={input.feedbackValid}
              onChange={(checked) => update("feedbackValid", checked)}
            />
            <CheckField
              label="Required device configuration is healthy"
              checked={input.configured}
              onChange={(checked) => update("configured", checked)}
            />
          </fieldset>
        </div>

        <div className="rounded-lg border border-white/10 bg-obsidian p-4">
          <h4 className="text-sm font-bold uppercase tracking-wider text-ares-gold">
            Evidence finding
          </h4>
          <dl
            role="status"
            aria-live="polite"
            aria-atomic="true"
            className="mt-4 grid gap-3"
          >
            <Datum label="Selected layer" value={LAYER_LABELS[input.layer]} />
            <Datum label="Status" value={result.status} />
            <Datum label="Reason" value={result.reason} />
            <Datum label="Still missing" value={result.missing} />
          </dl>
        </div>
      </div>

      <details className="mt-5 rounded border border-white/10 bg-white/5 p-3 text-sm text-white">
        <summary className="min-h-11 cursor-pointer font-bold text-ares-cyan">
          Read the current source boundary
        </summary>
        <ol className="mt-3 list-decimal space-y-2 pl-6 text-marble/80">
          <li>The raw interface exposes meters and failure sentinels.</li>
          <li>
            The FTC adapter polls in the background and returns its cached
            number.
          </li>
          <li>
            Generated code adds a default 0–10 meter range plus validity, time,
            and configuration evidence.
          </li>
          <li>The generated subsystem rejects an old snapshot.</li>
        </ol>
      </details>

      <p
        role="note"
        className="mt-5 border-l-4 border-ares-gold/60 bg-ares-gold/10 p-3 text-sm leading-relaxed text-white"
      >
        <strong>Model limit:</strong> This code-derived model does not read a
        sensor or run robot code. It cannot prove wiring, placement, accuracy,
        or behavior. The 0–10 meter range is a scaffold default, not a promise
        about every real sensor.
      </p>
    </section>
  );
}

function SelectField({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  options: Array<[string, string]>;
  onChange: (value: string) => void;
}) {
  return (
    <label htmlFor={id} className="grid gap-2 text-sm font-bold text-white">
      <span>{label}</span>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
        className="min-h-11 rounded border border-white/20 bg-black px-3 py-2 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </label>
  );
}

function NumberField({
  id,
  label,
  value,
  step,
  minimum,
  disabled = false,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  step: number;
  minimum?: number;
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <label htmlFor={id} className="grid gap-2 text-sm font-bold text-white">
      <span>{label}</span>
      <input
        id={id}
        type="number"
        value={value}
        step={step}
        min={minimum}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.currentTarget.value))}
        className="min-h-11 rounded border border-white/20 bg-black px-3 py-2 font-mono text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan disabled:cursor-not-allowed"
      />
    </label>
  );
}

function CheckField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded border border-white/10 p-3 text-sm font-bold text-white">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.currentTarget.checked)}
        className="h-5 w-5 accent-ares-red"
      />
      {label}
    </label>
  );
}

function Datum({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-white/10 p-3">
      <dt className="text-xs uppercase tracking-wide text-marble/70">
        {label}
      </dt>
      <dd className="mt-1 font-semibold leading-relaxed text-white">{value}</dd>
    </div>
  );
}
