/** @sim {"name":"SysId and One-Change Evidence Lab","requiresContext":false,"academyApproved":true,"fidelity":"code-derived"} */
import { useState, type ReactNode } from "react";
import {
  AcademyCheckboxControl,
  AcademyNumberControl,
  AcademySelectControl,
} from "@/sims/shared/academy-interaction-ui";

export type SysIdMechanism =
  "LINEAR" | "ANGULAR" | "FLYWHEEL" | "ELEVATOR" | "ARM" | "CUSTOM";
export type SysIdRoutine = "QUASISTATIC" | "DYNAMIC";
export type SysIdHandshake =
  "COMPLETE" | "STOP_MISSING" | "TOKEN_STALE" | "LEASE_STALE";
export type ExperimentDirection = "LOWER" | "HIGHER";
export type ChangeCount = "ONE" | "MULTIPLE";
export type CandidateEvidence =
  "ELIGIBLE" | "WRONG_WORKSPACE" | "NOT_SIMULATION" | "TOO_OLD";

export type SysIdScenario = {
  mechanism: SysIdMechanism;
  routine: SysIdRoutine;
  capabilityAdvertised: boolean;
  handshake: SysIdHandshake;
  leaseAgeMs: number;
  sampleValid: boolean;
  elapsedSeconds: number;
  travel: number;
};

export type SysIdPreview = {
  status: "BLOCKED" | "RUNNING" | "STOPPED";
  voltage: number;
  reason: string;
};

export type ExperimentInput = {
  baseline: number;
  candidate: number;
  thresholdPercent: number;
  direction: ExperimentDirection;
  changeCount: ChangeCount;
  evidence: CandidateEvidence;
};

export type ExperimentResult = {
  classification: "BLOCKED" | "IMPROVED" | "REGRESSED" | "INCONCLUSIVE";
  improvementPercent: number | null;
};

const SYSID_DEFAULTS: SysIdScenario = {
  mechanism: "LINEAR",
  routine: "QUASISTATIC",
  capabilityAdvertised: true,
  handshake: "COMPLETE",
  leaseAgeMs: 100,
  sampleValid: true,
  elapsedSeconds: 1,
  travel: 0.4,
};

const EXPERIMENT_DEFAULTS: ExperimentInput = {
  baseline: 1.2,
  candidate: 1.05,
  thresholdPercent: 10,
  direction: "LOWER",
  changeCount: "ONE",
  evidence: "ELIGIBLE",
};

const BLOCKED_EXPERIMENT: ExperimentResult = {
  classification: "BLOCKED",
  improvementPercent: null,
};

function stopSysId(
  reason: string,
  status: SysIdPreview["status"] = "STOPPED",
): SysIdPreview {
  return { status, voltage: 0, reason };
}

export function previewSysId(input: SysIdScenario): SysIdPreview {
  if (!input.capabilityAdvertised) {
    return stopSysId("Capability missing.", "BLOCKED");
  }
  if (input.handshake !== "COMPLETE") {
    const reason = {
      STOP_MISSING: "STOP-first handshake missing.",
      TOKEN_STALE: "Fresh enable token missing.",
      LEASE_STALE: "Fresh lease sequence missing.",
    }[input.handshake];
    return stopSysId(reason, "BLOCKED");
  }
  if (!Number.isFinite(input.leaseAgeMs) || input.leaseAgeMs < 0) {
    return stopSysId("Invalid lease age.");
  }
  if (input.leaseAgeMs > 500) {
    return stopSysId("Enable lease expired.");
  }
  if (
    !input.sampleValid ||
    !Number.isFinite(input.elapsedSeconds) ||
    !Number.isFinite(input.travel) ||
    input.elapsedSeconds < 0
  ) {
    return stopSysId("Invalid sample/time.");
  }
  if (input.elapsedSeconds > 5) {
    return stopSysId("Past five seconds.");
  }

  const travelLimit = {
    LINEAR: 1.5,
    ANGULAR: 4 * Math.PI,
    FLYWHEEL: Number.POSITIVE_INFINITY,
    ELEVATOR: 1.5,
    ARM: 2 * Math.PI,
    CUSTOM: Number.POSITIVE_INFINITY,
  }[input.mechanism];
  const lowerLimit = input.mechanism === "ELEVATOR" ? -0.1 : -travelLimit;
  if (input.travel < lowerLimit || input.travel > travelLimit) {
    return stopSysId(`${input.mechanism.toLowerCase()} travel limit exceeded.`);
  }

  const oneWay =
    input.mechanism === "FLYWHEEL" || input.mechanism === "ELEVATOR";
  const voltage =
    input.routine === "QUASISTATIC"
      ? oneWay || input.elapsedSeconds < 2.5
        ? 1.2 * input.elapsedSeconds
        : -1.2 * (input.elapsedSeconds - 2.5)
      : oneWay
        ? input.elapsedSeconds < 2.5
          ? 6
          : 0
        : input.elapsedSeconds < 1.5
          ? 3
          : -3;

  return {
    status: "RUNNING",
    voltage: Math.max(-12, Math.min(12, voltage)),
    reason: "Checks pass.",
  };
}

export function classifyExperiment(input: ExperimentInput): ExperimentResult {
  if (
    !Number.isFinite(input.thresholdPercent) ||
    input.thresholdPercent < 0.1 ||
    input.thresholdPercent > 100
  ) {
    return BLOCKED_EXPERIMENT;
  }
  if (input.changeCount !== "ONE") {
    return BLOCKED_EXPERIMENT;
  }
  if (input.evidence !== "ELIGIBLE") {
    return BLOCKED_EXPERIMENT;
  }
  if (
    !Number.isFinite(input.baseline) ||
    !Number.isFinite(input.candidate) ||
    Math.abs(input.baseline) <= 1e-12
  ) {
    return {
      classification: "INCONCLUSIVE",
      improvementPercent: null,
    };
  }

  const signedChange =
    input.direction === "LOWER"
      ? input.baseline - input.candidate
      : input.candidate - input.baseline;
  const improvementPercent = (signedChange / Math.abs(input.baseline)) * 100;
  if (improvementPercent >= input.thresholdPercent) {
    return {
      classification: "IMPROVED",
      improvementPercent,
    };
  }
  if (improvementPercent < 0) {
    return {
      classification: "REGRESSED",
      improvementPercent,
    };
  }
  return {
    classification: "INCONCLUSIVE",
    improvementPercent,
  };
}

export default function SysIdTuningLab() {
  const [sysId, setSysId] = useState(SYSID_DEFAULTS);
  const [experiment, setExperiment] = useState(EXPERIMENT_DEFAULTS);
  const sysIdResult = previewSysId(sysId);
  const experimentResult = classifyExperiment(experiment);
  const reset = () => {
    setSysId(SYSID_DEFAULTS);
    setExperiment(EXPERIMENT_DEFAULTS);
  };

  return (
    <section
      aria-labelledby="sysid-tuning-lab-title"
      className="my-8 rounded-xl border border-ares-cyan/30 bg-black/35 p-4 sm:p-6"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <h3 id="sysid-tuning-lab-title" className="text-xl font-black text-white">
          SysId Evidence Lab
        </h3>
        <button
          type="button"
          onClick={reset}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded border border-white/20 px-4 py-2 text-sm font-bold text-white hover:border-ares-cyan focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
        >
          Reset
        </button>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <SysIdPanel value={sysId} onChange={setSysId} result={sysIdResult} />
        <ExperimentPanel
          value={experiment}
          onChange={setExperiment}
          result={experimentResult}
        />
      </div>

      <p
        role="note"
        className="mt-5 border-l-4 border-ares-gold/60 bg-ares-gold/10 p-3 text-sm leading-relaxed text-white"
      >
        <strong>Model limit:</strong> No Studio, hardware link, gain fit,
        current check, motion, safety proof, or profile promotion. Callers
        omit current data, so no current trip is claimed.
      </p>
    </section>
  );
}

function SysIdPanel({
  value,
  onChange,
  result,
}: {
  value: SysIdScenario;
  onChange: (value: SysIdScenario) => void;
  result: SysIdPreview;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-4">
      <h4 className="text-sm font-bold uppercase tracking-wider text-ares-gold">
        Part 1: SysId envelope
      </h4>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <SelectField
          id="sysid-mechanism"
          label="Mechanism"
          value={value.mechanism}
          options={[
            "LINEAR",
            "ANGULAR",
            "FLYWHEEL",
            "ELEVATOR",
            "ARM",
            "CUSTOM",
          ]}
          onChange={(mechanism) =>
            onChange({ ...value, mechanism: mechanism as SysIdMechanism })
          }
        />
        <SelectField
          id="sysid-routine"
          label="Routine"
          value={value.routine}
          options={["QUASISTATIC", "DYNAMIC"]}
          onChange={(routine) =>
            onChange({ ...value, routine: routine as SysIdRoutine })
          }
        />
        <NumberField
          id="sysid-time"
          label="Time (s)"
          value={value.elapsedSeconds}
          onChange={(elapsedSeconds) => onChange({ ...value, elapsedSeconds })}
        />
        <NumberField
          id="sysid-travel"
          label="Travel (m or rad)"
          value={value.travel}
          onChange={(travel) => onChange({ ...value, travel })}
        />
        <NumberField
          id="sysid-lease-age"
          label="Lease age (ms)"
          value={value.leaseAgeMs}
          onChange={(leaseAgeMs) => onChange({ ...value, leaseAgeMs })}
        />
        <SelectField
          id="sysid-handshake"
          label="STOP-first handshake"
          value={value.handshake}
          options={["COMPLETE", "STOP_MISSING", "TOKEN_STALE", "LEASE_STALE"]}
          onChange={(handshake) =>
            onChange({ ...value, handshake: handshake as SysIdHandshake })
          }
        />
      </div>
      <div className="mt-4 grid gap-2">
        <AcademyCheckboxControl
          label="Runtime advertises mechanism"
          checked={value.capabilityAdvertised}
          onChange={(capabilityAdvertised) =>
            onChange({ ...value, capabilityAdvertised })
          }
        />
        <AcademyCheckboxControl
          label="Position and velocity valid"
          checked={value.sampleValid}
          onChange={(sampleValid) => onChange({ ...value, sampleValid })}
        />
      </div>
      <ResultBox label="SysId preview" tone={result.status}>
        <strong>{result.status}</strong>
        <span>{result.reason}</span>
        <span>Command preview: {result.voltage.toFixed(2)} V</span>
      </ResultBox>
    </div>
  );
}

function ExperimentPanel({
  value,
  onChange,
  result,
}: {
  value: ExperimentInput;
  onChange: (value: ExperimentInput) => void;
  result: ExperimentResult;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-4">
      <h4 className="text-sm font-bold uppercase tracking-wider text-ares-gold">
        Part 2: one change
      </h4>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <NumberField
          id="tune-baseline"
          label="Baseline (s)"
          value={value.baseline}
          onChange={(baseline) => onChange({ ...value, baseline })}
        />
        <NumberField
          id="tune-candidate"
          label="Candidate (s)"
          value={value.candidate}
          onChange={(candidate) => onChange({ ...value, candidate })}
        />
        <NumberField
          id="tune-threshold"
          label="Threshold (%)"
          value={value.thresholdPercent}
          onChange={(thresholdPercent) =>
            onChange({ ...value, thresholdPercent })
          }
        />
        <SelectField
          id="tune-direction"
          label="Goal"
          value={value.direction}
          options={["LOWER", "HIGHER"]}
          onChange={(direction) =>
            onChange({ ...value, direction: direction as ExperimentDirection })
          }
        />
        <SelectField
          id="tune-count"
          label="Changes"
          value={value.changeCount}
          options={["ONE", "MULTIPLE"]}
          onChange={(changeCount) =>
            onChange({ ...value, changeCount: changeCount as ChangeCount })
          }
        />
        <SelectField
          id="tune-evidence"
          label="Candidate evidence"
          value={value.evidence}
          options={["ELIGIBLE", "WRONG_WORKSPACE", "NOT_SIMULATION", "TOO_OLD"]}
          onChange={(evidence) =>
            onChange({ ...value, evidence: evidence as CandidateEvidence })
          }
        />
      </div>
      <ResultBox label="Experiment result" tone={result.classification}>
        <strong>{result.classification}</strong>
        <span>
          Goal improvement: {result.improvementPercent === null
            ? "not available"
            : `${result.improvementPercent.toFixed(1)}%`}
        </span>
      </ResultBox>
    </div>
  );
}

const NumberField = AcademyNumberControl;
const SelectField = AcademySelectControl;

function ResultBox({
  label,
  tone,
  children,
}: {
  label: string;
  tone: string;
  children: ReactNode;
}) {
  const safe = tone === "RUNNING" || tone === "IMPROVED";
  return (
    <div
      role="status"
      aria-label={label}
      aria-live="polite"
      aria-atomic="true"
      className={`mt-4 grid gap-2 rounded border p-4 text-sm leading-relaxed text-white ${
        safe
          ? "border-ares-cyan/50 bg-ares-cyan/10"
          : "border-ares-red/60 bg-ares-red/10"
      }`}
    >
      {children}
    </div>
  );
}
