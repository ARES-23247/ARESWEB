/** @sim {"name":"Current ARES Sensor Evidence Lab","requiresContext":false,"academyApproved":true,"fidelity":"code-derived"} */
import { useState } from "react";
import { AcademyCheckboxControl, AcademyDatum } from "@/sims/shared/academy-interaction-ui";

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
      "The raw contract marks this as failed or out-of-range evidence.",
      "A usable distance plus physical evidence.",
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
      "DistanceSensorIO reports meters, not age or setup health.",
      "Freshness, setup health, and physical accuracy.",
    );
  }
  if (input.layer === "FTC_CACHE") {
    return finding(
      "Cached value only",
      "FtcDistanceSensor caches a value but exposes no sample time.",
      "Known age, setup health, and physical accuracy.",
    );
  }
  if (value > 10) {
    return finding(
      "Blocked",
      "The generated scaffold defaults to 0–10 meters.",
      "An in-range sample or a reviewed range for the real device.",
    );
  }
  if (!input.feedbackValid) {
    return finding(
      "Blocked",
      "The refresh did not produce a valid snapshot.",
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
      "Ages must be finite and non-negative.",
      "A valid age and maximum age.",
    );
  }
  if (input.ageMs > input.maxAgeMs) {
    return finding(
      "Blocked",
      "The snapshot is older than its allowed age.",
      "A newer valid snapshot.",
    );
  }
  return finding(
    "Usable generated snapshot",
    "The snapshot is finite, in range, valid, configured, and fresh.",
    "Physical wiring, placement, target, noise, and robot behavior.",
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
          <h3
            id="sensor-signal-title"
            className="text-xl font-black text-white"
          >
            Sensor Evidence Lab
          </h3>
        </div>
        <button
          type="button"
          onClick={() => setInput(DEFAULTS)}
          className="inline-flex min-h-11 items-center justify-center rounded border border-white/20 px-4 py-2 text-sm font-bold text-white hover:border-ares-cyan focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
        >
          Reset
        </button>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="grid gap-4 rounded-lg border border-white/10 bg-white/5 p-4">
          <SelectField
            id="sensor-layer"
            label="Evidence path"
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
              label="Age (ms)"
              value={input.ageMs}
              step={1}
              minimum={0}
              onChange={(value) => update("ageMs", value)}
            />
            <NumberField
              id="maximum-age"
              label="Max age (ms)"
              value={input.maxAgeMs}
              step={1}
              minimum={0}
              onChange={(value) => update("maxAgeMs", value)}
            />
        <AcademyCheckboxControl
              label="Refresh produced a valid snapshot"
              checked={input.feedbackValid}
              onChange={(checked) => update("feedbackValid", checked)}
            />
        <AcademyCheckboxControl
              label="Device setup is healthy"
              checked={input.configured}
              onChange={(checked) => update("configured", checked)}
            />
          </fieldset>
        </div>

        <div className="rounded-lg border border-white/10 bg-obsidian p-4">
          <h4 className="text-sm font-bold uppercase tracking-wider text-ares-gold">
            Finding
          </h4>
          <dl
            role="status"
            aria-live="polite"
            aria-atomic="true"
            className="mt-4 grid gap-3"
          >
            <Datum label="Path" value={LAYER_LABELS[input.layer]} />
            <Datum label="Status" value={result.status} />
            <Datum label="Reason" value={result.reason} />
            <Datum label="Missing" value={result.missing} />
          </dl>
        </div>
      </div>

      <details className="mt-5 rounded border border-white/10 bg-white/5 p-3 text-sm text-white">
        <summary className="min-h-11 cursor-pointer font-bold text-ares-cyan">
          Read the source boundary
        </summary>
        <ol className="mt-3 list-decimal space-y-2 pl-6 text-marble/80">
          <li>The raw interface gives meters and failure sentinels.</li>
          <li>One FTC adapter caches background reads.</li>
          <li>
            Generated adapters read separately on refresh and add range, time,
            and setup evidence.
          </li>
        </ol>
      </details>

      <p
        role="note"
        className="mt-5 border-l-4 border-ares-gold/60 bg-ares-gold/10 p-3 text-sm leading-relaxed text-white"
      >
        <strong>Model limit:</strong> This model does not read or run a robot.
        It cannot prove wiring, placement, accuracy, or behavior.
        The 0–10 meter range is a scaffold default, not a promise for every
        real sensor.
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

const Datum = AcademyDatum;
