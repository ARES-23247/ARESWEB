/** @sim {"name":"Subsystem Ownership Decision Lab","requiresContext":false,"academyApproved":true,"fidelity":"conceptual"} */
import { useMemo, useState } from "react";
import { AcademyDatum } from "@/sims/shared/academy-interaction-ui";

export type SubsystemStartingPoint = "descriptor" | "editable" | "existing";
export type EvidenceKey =
  | "pathContract"
  | "units"
  | "inputs"
  | "neutral"
  | "simulation"
  | "verification";
export type EvidenceState = Record<EvidenceKey, boolean>;

type EvidenceItem = { key: EvidenceKey; label: string; help: string };

const COMMON_EVIDENCE_ITEMS: EvidenceItem[] = [
  {
    key: "units",
    label: "Units and direction",
    help: "Purpose, unit, positive direction, bounds, and safe neutral are written down.",
  },
  {
    key: "inputs",
    label: "Cached input contract",
    help: "Each input has one refresh owner plus validity and freshness rules.",
  },
  {
    key: "neutral",
    label: "Fault and neutral rules",
    help: "Failed writes latch safely, and recovery requires the declared successful neutral.",
  },
  {
    key: "simulation",
    label: "Simulation boundary",
    help: "The mock or simulator uses the same units, limits, faults, stop, and close rules.",
  },
  {
    key: "verification",
    label: "Evidence ladder",
    help: "Configuration, tests, simulation, build, and physical checks stay separate.",
  },
];

const PATH_EVIDENCE_ITEMS: Record<SubsystemStartingPoint, EvidenceItem> = {
  descriptor: {
    key: "pathContract",
    label: "Declarative path rules",
    help: "Do not supply source paths or action keys. Keep generated mock and tests on.",
  },
  editable: {
    key: "pathContract",
    label: "Starter path rules",
    help: "Codegen sets source paths and actions. Replacements need a reviewed diff and exact token.",
  },
  existing: {
    key: "pathContract",
    label: "Hand-authored metadata",
    help: "State module, files, classes, simulation, and exposed actions. Turn generated mock and tests off.",
  },
};

const STARTING_POINTS: {
  value: SubsystemStartingPoint;
  label: string;
  help: string;
}[] = [
  {
    value: "descriptor",
    label: "Descriptor can own the behavior",
    help: "No editable Kotlin policy is needed for this new subsystem.",
  },
  {
    value: "editable",
    label: "New editable Kotlin is needed",
    help: "Start from reviewed Kotlin files that the project will own.",
  },
  {
    value: "existing",
    label: "Proven or custom Kotlin exists",
    help: "Preserve project source and declare its integration points.",
  },
];

const EMPTY_EVIDENCE: EvidenceState = {
  pathContract: false,
  units: false,
  inputs: false,
  neutral: false,
  simulation: false,
  verification: false,
};

export type SubsystemPlan = {
  implementation:
    "DECLARATIVE_GENERATED" | "GENERATED_STARTER" | "HAND_AUTHORED";
  ownership: "GENERATED_DO_NOT_EDIT" | "GENERATED_STARTER" | "USER_OWNED";
  sourceTreatment: string;
  nextStep: string;
  missingEvidence: string[];
  readyForPreview: boolean;
};

export function evaluateSubsystemPlan(
  startingPoint: SubsystemStartingPoint,
  evidence: EvidenceState,
): SubsystemPlan {
  const evidenceItems = [
    PATH_EVIDENCE_ITEMS[startingPoint],
    ...COMMON_EVIDENCE_ITEMS,
  ];
  const missingEvidence = evidenceItems.filter(
    ({ key }) => !evidence[key],
  ).map(({ label }) => label);
  const path = {
    descriptor: {
      implementation: "DECLARATIVE_GENERATED" as const,
      ownership: "GENERATED_DO_NOT_EDIT" as const,
      sourceTreatment:
        "Keep runtime, mock, and baseline tests in generated folders. Edit the descriptor instead.",
      nextStep:
        "Review the descriptor and generated preview. Do not edit build/generated files.",
    },
    editable: {
      implementation: "GENERATED_STARTER" as const,
      ownership: "GENERATED_STARTER" as const,
      sourceTreatment:
        "Create missing editable starters. Replacements require a current structured diff and token.",
      nextStep:
        "Preview every starter file before creating it or confirming a replacement.",
    },
    existing: {
      implementation: "HAND_AUTHORED" as const,
      ownership: "USER_OWNED" as const,
      sourceTreatment:
        "Name the module, source files, runtime classes, simulation support, and action keys. Generate no starter implementation.",
      nextStep:
        "Compare the descriptor metadata with real source and project-owned tests.",
    },
  }[startingPoint];
  return {
    ...path,
    missingEvidence,
    readyForPreview: missingEvidence.length === 0,
  };
}

export default function SubsystemOwnershipLab() {
  const [startingPoint, setStartingPoint] =
    useState<SubsystemStartingPoint>("descriptor");
  const [evidence, setEvidence] = useState<EvidenceState>(EMPTY_EVIDENCE);
  const result = useMemo(
    () => evaluateSubsystemPlan(startingPoint, evidence),
    [startingPoint, evidence],
  );
  const evidenceItems = useMemo(
    () => [PATH_EVIDENCE_ITEMS[startingPoint], ...COMMON_EVIDENCE_ITEMS],
    [startingPoint],
  );
  const reset = () => {
    setStartingPoint("descriptor");
    setEvidence(EMPTY_EVIDENCE);
  };

  return (
    <section
      aria-labelledby="ownership-lab-title"
      className="my-8 rounded-xl border border-ares-cyan/30 bg-black/35 p-4 sm:p-6"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3
            id="ownership-lab-title"
            className="text-xl font-black text-white"
          >
            Subsystem Ownership Decision Lab
          </h3>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-marble/80">
            Choose a source starting point, then expose the evidence still
            missing before a code preview.
          </p>
        </div>
        <button
          type="button"
          onClick={reset}
          className="min-h-11 rounded border border-white/20 px-4 py-2 text-sm font-bold text-white hover:border-ares-cyan focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
        >
          Reset
        </button>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="grid gap-5">
          <fieldset className="grid gap-3 rounded-lg border border-white/10 bg-white/5 p-4">
            <legend className="px-2 text-sm font-bold text-ares-gold">
              1. Choose the current source truth
            </legend>
            {STARTING_POINTS.map((item) => (
              <label
                key={item.value}
                className="flex min-h-11 cursor-pointer items-start gap-3 rounded border border-white/10 p-3 text-sm text-white focus-within:ring-2 focus-within:ring-ares-cyan"
              >
                <input
                  type="radio"
                  name="subsystem-start"
                  value={item.value}
                  checked={startingPoint === item.value}
                  onChange={() => {
                    setStartingPoint(item.value);
                    setEvidence((current) => ({
                      ...current,
                      pathContract: false,
                    }));
                  }}
                  className="mt-0.5 h-5 w-5 shrink-0 accent-ares-red"
                />
                <span>
                  <strong className="block">{item.label}</strong>
                  <span className="mt-1 block text-marble/70">{item.help}</span>
                </span>
              </label>
            ))}
          </fieldset>

          <fieldset className="grid gap-3 rounded-lg border border-white/10 bg-white/5 p-4">
            <legend className="px-2 text-sm font-bold text-ares-gold">
              2. Mark evidence already written down
            </legend>
            {evidenceItems.map((item) => (
              <label
                key={item.key}
                className="flex min-h-11 cursor-pointer items-start gap-3 rounded border border-white/10 p-3 text-sm text-white focus-within:ring-2 focus-within:ring-ares-cyan"
              >
                <input
                  type="checkbox"
                  checked={evidence[item.key]}
                  onChange={(event) => {
                    const checked = event.currentTarget.checked;
                    setEvidence((current) => ({
                      ...current,
                      [item.key]: checked,
                    }));
                  }}
                  className="mt-0.5 h-5 w-5 shrink-0 accent-ares-red"
                />
                <span>
                  <strong className="block">{item.label}</strong>
                  <span className="mt-1 block text-marble/70">{item.help}</span>
                </span>
              </label>
            ))}
          </fieldset>
        </div>

        <div className="rounded-lg border border-white/10 bg-obsidian p-4 sm:p-5">
          <dl aria-live="polite" aria-atomic="true" className="grid gap-3">
            <Datum label="Implementation" value={result.implementation} />
            <Datum label="Ownership" value={result.ownership} />
            <Datum label="Source treatment" value={result.sourceTreatment} />
            <Datum label="Next source step" value={result.nextStep} />
          </dl>
          <div
            role="status"
            className={`mt-4 rounded border p-4 text-sm leading-relaxed ${result.readyForPreview ? "border-ares-cyan/50 bg-ares-cyan/10 text-white" : "border-ares-gold/50 bg-ares-gold/10 text-white"}`}
          >
            <strong className="block">
              {result.readyForPreview
                ? "Checklist filled in for source preview"
                : `${result.missingEvidence.length} evidence area${result.missingEvidence.length === 1 ? "" : "s"} still missing`}
            </strong>
            {result.missingEvidence.length > 0 && (
              <span className="mt-2 block">
                Record: {result.missingEvidence.join(", ")}.
              </span>
            )}
          </div>
        </div>
      </div>

      <p
        role="note"
        className="mt-5 border-l-4 border-ares-gold/60 bg-ares-gold/10 p-3 text-sm leading-relaxed text-white"
      >
        <strong>Model limit:</strong> This form does not inspect Kotlin or a
        descriptor, find hazards, generate files, run tests, connect to a
        simulator, command hardware, or prove that a subsystem is safe.
        “Checklist filled in” means only that all six planning boxes are
        checked.
      </p>
    </section>
  );
}

function Datum(props: Parameters<typeof AcademyDatum>[0]) {
  return <AcademyDatum {...props} accented />;
}
