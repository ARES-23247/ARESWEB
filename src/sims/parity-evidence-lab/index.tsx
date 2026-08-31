/** @sim {"name":"Current ARES Parity Evidence Lab","requiresContext":false,"academyApproved":true,"fidelity":"code-derived"} */
import { useState } from "react";
import {
  AcademyDatum,
  AcademyLabShell,
  AcademyModelLimit,
  AcademySelectControl,
} from "@/sims/shared/academy-interaction-ui";

export type EvidenceArtifact =
  | "generated-contract"
  | "generated-behavior"
  | "ftc-lifecycle"
  | "paired-runtime";
export type AdapterResult = "untested" | "matches" | "differs";

type CaseId =
  | "startup"
  | "write-fault"
  | "homing-current"
  | "output-limit"
  | "disabled-stop"
  | "invalid-cleanup";

export type EvidenceFinding = {
  status: string;
  supports: string;
  limit: string;
};

const CASES: Record<CaseId, { label: string; expected: string }> = {
  startup: { label: "Safe startup", expected: "Declared neutral output" },
  "write-fault": {
    label: "Failed output write",
    expected: "Safe output and declared fault policy",
  },
  "homing-current": {
    label: "Homing and current permits",
    expected: "Neither permit replaces the other",
  },
  "output-limit": {
    label: "Controller output limit",
    expected: "Finite command inside the declared limits",
  },
  "disabled-stop": {
    label: "Disabled or stop",
    expected: "Zero scale commands safe neutral",
  },
  "invalid-cleanup": {
    label: "Invalid feedback and cleanup",
    expected: "Invalid feedback and repeatable safe close",
  },
};

const ARTIFACTS: Record<
  EvidenceArtifact,
  { label: string; finding: EvidenceFinding }
> = {
  "generated-contract": {
    label: "Generated adapter contract",
    finding: {
      status: "Compile evidence only",
      supports: "Physical and mock source share the generated contract.",
      limit: "No adapter behavior or output was compared.",
    },
  },
  "generated-behavior": {
    label: "Generated mock behavior test",
    finding: {
      status: "Mock behavior evidence",
      supports: "The generated controller and Mock IO ran the selected rule.",
      limit: "The FTC or FRC platform adapter did not run.",
    },
  },
  "ftc-lifecycle": {
    label: "FTC simulator lifecycle test",
    finding: {
      status: "Lifecycle integration evidence",
      supports: "One registered instance received read, write, then close.",
      limit: "No hardware-versus-mock output comparison ran.",
    },
  },
  "paired-runtime": {
    label: "Team-authored paired runtime test",
    finding: {
      status: "Incomplete evidence",
      supports: "Nothing until both sides run the same case.",
      limit: "A not-run side cannot support a parity claim.",
    },
  },
};

export function classifyParityEvidence(
  artifact: EvidenceArtifact,
  platform: AdapterResult,
  simulated: AdapterResult,
): EvidenceFinding {
  if (artifact !== "paired-runtime") return ARTIFACTS[artifact].finding;
  if (platform === "untested" || simulated === "untested") {
    return ARTIFACTS[artifact].finding;
  }
  if (platform === "matches" && simulated === "matches") {
    return {
      status: "Aligned for this case",
      supports: "Both boundaries matched the same expected result.",
      limit: "Other cases and physical behavior remain unknown.",
    };
  }
  if (platform === "differs" && simulated === "differs") {
    return {
      status: "Shared expectation failure",
      supports: "Both results disagree with the expected rule.",
      limit: "Recheck the contract before blaming one adapter.",
    };
  }
  return {
    status: "Adapter mismatch",
    supports: "The two boundaries produced different findings.",
    limit: "Find the cause before making a wider parity claim.",
  };
}

const DEFAULTS = {
  artifact: "generated-contract" as EvidenceArtifact,
  caseId: "startup" as CaseId,
  platform: "untested" as AdapterResult,
  simulated: "untested" as AdapterResult,
};

export default function ParityEvidenceLab() {
  const [artifact, setArtifact] = useState(DEFAULTS.artifact);
  const [caseId, setCaseId] = useState(DEFAULTS.caseId);
  const [platform, setPlatform] = useState(DEFAULTS.platform);
  const [simulated, setSimulated] = useState(DEFAULTS.simulated);
  const paired = artifact === "paired-runtime";
  const finding = classifyParityEvidence(artifact, platform, simulated);

  const reset = () => {
    setArtifact(DEFAULTS.artifact);
    setCaseId(DEFAULTS.caseId);
    setPlatform(DEFAULTS.platform);
    setSimulated(DEFAULTS.simulated);
  };

  return (
    <AcademyLabShell
      titleId="parity-lab-title"
      title="Current ARES Parity Evidence Lab"
      onReset={reset}
    >
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <fieldset className="grid gap-4 rounded-lg border border-white/10 bg-white/5 p-4">
          <legend className="px-2 text-sm font-bold text-ares-gold">
            Recorded evidence
          </legend>
          <AcademySelectControl
            id="parity-artifact"
            label="Evidence artifact"
            value={artifact}
            onChange={(value) => setArtifact(value as EvidenceArtifact)}
            options={Object.entries(ARTIFACTS).map(([value, item]) => ({
              value,
              label: item.label,
            }))}
          />
          <AcademySelectControl
            id="parity-case"
            label="Contract case"
            value={caseId}
            onChange={(value) => setCaseId(value as CaseId)}
            options={Object.entries(CASES).map(([value, item]) => ({
              value,
              label: item.label,
            }))}
          />
          <p
            id="paired-help"
            className="text-sm leading-relaxed text-marble/80"
          >
            Adapter results apply only to a team-authored paired runtime test.
          </p>
          <AcademySelectControl
            id="platform-result"
            label="Platform boundary"
            value={platform}
            onChange={(value) => setPlatform(value as AdapterResult)}
            options={RESULT_OPTIONS}
            disabled={!paired}
            describedBy="paired-help"
          />
          <AcademySelectControl
            id="simulated-result"
            label="Mock or simulated boundary"
            value={simulated}
            onChange={(value) => setSimulated(value as AdapterResult)}
            options={RESULT_OPTIONS}
            disabled={!paired}
            describedBy="paired-help"
          />
        </fieldset>

        <div
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className="rounded-lg border border-white/10 bg-obsidian p-4"
        >
          <h4 className="text-sm font-bold uppercase tracking-wider text-ares-gold">
            Bounded finding
          </h4>
          <dl className="mt-4 grid gap-3">
            <AcademyDatum label="Expected rule" value={CASES[caseId].expected} />
            <AcademyDatum label="Classification" value={finding.status} />
            <AcademyDatum label="This supports" value={finding.supports} />
            <AcademyDatum label="This does not prove" value={finding.limit} />
          </dl>
        </div>
      </div>

      <details className="mt-5 rounded border border-white/10 bg-white/5 p-3 text-sm text-white">
        <summary className="min-h-11 cursor-pointer font-bold text-ares-cyan">
          Open the comparison rules
        </summary>
        <ul className="mt-3 list-disc space-y-2 pl-6 text-marble/80">
          <li>Compile parity is not runtime parity.</li>
          <li>Generated behavior tests use Mock IO.</li>
          <li>The FTC lifecycle test checks one instance and call order.</li>
          <li>
            A paired case keeps inputs, units, clock, fault, and assertion
            equal.
          </li>
        </ul>
      </details>

      <AcademyModelLimit>
        This code-derived planner does not run
        Gradle, load adapters, inject faults, connect to a robot, or prove
        physical behavior.
      </AcademyModelLimit>
    </AcademyLabShell>
  );
}

const RESULT_OPTIONS = [
  { value: "untested", label: "Not run" },
  { value: "matches", label: "Matches expected rule" },
  { value: "differs", label: "Differs from expected rule" },
];
