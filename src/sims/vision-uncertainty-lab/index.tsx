/** @sim {"name":"Vision Evidence Rejection Lab","requiresContext":false,"academyApproved":true,"fidelity":"code-derived"} */
import { useMemo, useState } from "react";
import { AcademyCheckboxControl, AcademyDatum } from "@/sims/shared/academy-interaction-ui";

export type VisionEvidence = {
  finite: boolean;
  knownTarget: boolean;
  ambiguityAccepted: boolean;
  insideField: boolean;
  motionAccepted: boolean;
  captureTimeInHistory: boolean;
  innovationAccepted: boolean;
};

export type VisionDecision = {
  status: "Accepted by this checklist" | "Rejected";
  learningReason: string;
  runtimeReason: string | null;
};

export type VisionLatencyExample = {
  distanceTraveledMeters: number;
  captureEstimateMeters: number;
  receiptEstimateMeters: number;
  visionMeasurementMeters: number;
  captureTimeResidualMeters: number;
  receiptTimeResidualMeters: number;
};

type VisionGate = {
  key: keyof VisionEvidence;
  label: string;
  learningReason: string;
  runtimeReason: string;
};

const DEFAULTS: VisionEvidence = {
  finite: true,
  knownTarget: true,
  ambiguityAccepted: true,
  insideField: true,
  motionAccepted: true,
  captureTimeInHistory: true,
  innovationAccepted: true,
};

const GATES: VisionGate[] = [
  {
    key: "finite",
    label: "Pose and motion inputs are finite",
    learningReason: "A pose or motion input is not finite",
    runtimeReason: "prefilter_rejected",
  },
  {
    key: "knownTarget",
    label: "Target passes the configured ID allowlist",
    learningReason: "The target ID is not allowed by this configuration",
    runtimeReason: "prefilter_rejected",
  },
  {
    key: "ambiguityAccepted",
    label: "Available ambiguity passes the policy",
    learningReason: "Available ambiguity is above the policy limit",
    runtimeReason: "prefilter_rejected",
  },
  {
    key: "insideField",
    label: "Distance, pose, and robot footprint pass",
    learningReason: "Distance or checked robot geometry is out of bounds",
    runtimeReason: "prefilter_rejected",
  },
  {
    key: "motionAccepted",
    label: "Turn rate and shock guards pass",
    learningReason: "Fast turning or a shock blocks this frame",
    runtimeReason: "prefilter_rejected",
  },
  {
    key: "captureTimeInHistory",
    label: "Capture time is inside pose history",
    learningReason: "The capture time is older than stored pose history",
    runtimeReason: "vision_too_old",
  },
  {
    key: "innovationAccepted",
    label: "NIS passes the uncertainty-aware check",
    learningReason:
      "The measurement disagrees too much with prediction for its stated uncertainty",
    runtimeReason: "mahalanobis_rejected",
  },
];

export function classifyVisionEvidence(
  evidence: VisionEvidence,
): VisionDecision {
  const firstFailedGate = GATES.find((gate) => !evidence[gate.key]);
  if (firstFailedGate) {
    return {
      status: "Rejected",
      learningReason: firstFailedGate.learningReason,
      runtimeReason: firstFailedGate.runtimeReason,
    };
  }
  return {
    status: "Accepted by this checklist",
    learningReason:
      "Every represented gate passed; keep uncertainty and later residuals visible",
    runtimeReason: null,
  };
}

export function getFailedVisionGateLabels(evidence: VisionEvidence): string[] {
  return GATES.filter((gate) => !evidence[gate.key]).map((gate) => gate.label);
}

export function buildVisionLatencyExample(
  speedMetersPerSecond: number,
  latencyMilliseconds: number,
): VisionLatencyExample {
  const captureEstimateMeters = 2.8;
  const visionMeasurementMeters = 2.9;
  const distanceTraveledMeters =
    speedMetersPerSecond * (latencyMilliseconds / 1000);
  const receiptEstimateMeters = captureEstimateMeters + distanceTraveledMeters;

  return {
    distanceTraveledMeters,
    captureEstimateMeters,
    receiptEstimateMeters,
    visionMeasurementMeters,
    captureTimeResidualMeters: visionMeasurementMeters - captureEstimateMeters,
    receiptTimeResidualMeters: visionMeasurementMeters - receiptEstimateMeters,
  };
}

export default function VisionUncertaintyLab() {
  const [evidence, setEvidence] = useState(DEFAULTS);
  const [speedMetersPerSecond, setSpeedMetersPerSecond] = useState(1.2);
  const [latencyMilliseconds, setLatencyMilliseconds] = useState(250);
  const decision = useMemo(() => classifyVisionEvidence(evidence), [evidence]);
  const failedGateLabels = useMemo(
    () => getFailedVisionGateLabels(evidence),
    [evidence],
  );
  const latencyExample = useMemo(
    () => buildVisionLatencyExample(speedMetersPerSecond, latencyMilliseconds),
    [latencyMilliseconds, speedMetersPerSecond],
  );

  const reset = () => {
    setEvidence(DEFAULTS);
    setSpeedMetersPerSecond(1.2);
    setLatencyMilliseconds(250);
  };

  return (
    <section
      aria-labelledby="vision-evidence-title"
      className="my-8 rounded-xl border border-ares-cyan/30 bg-black/35 p-4 sm:p-6"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3
            id="vision-evidence-title"
            className="text-xl font-black text-white"
          >
            Vision Evidence Rejection Lab
          </h3>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-marble/80">
            Change one evidence gate at a time. The lab shows the first failed
            gate and keeps every other failed check visible.
          </p>
        </div>
        <button
          type="button"
          onClick={reset}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded border border-white/20 px-4 py-2 text-sm font-bold text-white hover:border-ares-cyan focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
        >
          Reset
        </button>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <fieldset className="grid gap-3 rounded-lg border border-white/10 bg-white/5 p-4">
          <legend className="px-2 text-sm font-bold text-ares-gold">
            Learning scenario evidence
          </legend>
          {GATES.map((gate) => (
            <AcademyCheckboxControl
              key={gate.key}
              label={gate.label}
              checked={evidence[gate.key]}
              onChange={(checked) => setEvidence((current) => ({
                ...current,
                [gate.key]: checked,
              }))}
            />
          ))}
        </fieldset>

        <div className="rounded-lg border border-white/10 bg-obsidian p-4">
          <h4 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-ares-gold">
            Checklist decision
          </h4>
          <dl aria-live="polite" aria-atomic="true" className="mt-4 grid gap-3">
            <Datum label="Status" value={decision.status} />
            <Datum label="Learning explanation" value={decision.learningReason} />
            <Datum
              label="Current ARES runtime reason"
              value={decision.runtimeReason ?? "none"}
            />
          </dl>
          {failedGateLabels.length > 1 ? (
            <div className="mt-3 rounded border border-ares-gold/30 bg-ares-gold/10 p-3 text-sm text-white">
              <p className="font-bold">Other failed checks stay visible:</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {failedGateLabels.slice(1).map((label) => (
                  <li key={label}>{label}</li>
                ))}
              </ul>
            </div>
          ) : null}
          <p className="mt-4 text-sm leading-relaxed text-marble/75">
            A rejected row is still useful evidence. Keep its target, capture
            time, residual, uncertainty, and reason when privacy rules allow.
          </p>
        </div>
      </div>

      <div className="mt-6 rounded-lg border border-white/10 bg-white/5 p-4">
        <h4 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-ares-gold">
          Why capture time matters
        </h4>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-marble/80">
          This straight-line example keeps the predicted capture position at
          2.80 m and the camera result at 2.90 m. Change speed and delay to see
          why comparing the image with receipt time can create the wrong
          residual.
        </p>
        <div className="mt-4 grid gap-5 md:grid-cols-2">
          <label className="grid gap-2 text-sm font-bold text-white">
            Robot speed: {speedMetersPerSecond.toFixed(1)} m/s
            <input
              type="range"
              min="0"
              max="3"
              step="0.1"
              value={speedMetersPerSecond}
              onChange={(event) =>
                setSpeedMetersPerSecond(Number(event.currentTarget.value))
              }
              className="min-h-11 w-full accent-ares-red"
            />
          </label>
          <label className="grid gap-2 text-sm font-bold text-white">
            Camera delay: {latencyMilliseconds} ms
            <input
              type="range"
              min="0"
              max="500"
              step="25"
              value={latencyMilliseconds}
              onChange={(event) =>
                setLatencyMilliseconds(Number(event.currentTarget.value))
              }
              className="min-h-11 w-full accent-ares-red"
            />
          </label>
        </div>
        <dl
          aria-live="polite"
          aria-atomic="true"
          className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
        >
          <Datum
            label="Travel during delay"
            value={`${latencyExample.distanceTraveledMeters.toFixed(2)} m`}
          />
          <Datum
            label="Predicted pose at capture"
            value={`${latencyExample.captureEstimateMeters.toFixed(2)} m`}
          />
          <Datum
            label="Predicted pose at receipt"
            value={`${latencyExample.receiptEstimateMeters.toFixed(2)} m`}
          />
          <Datum
            label="Camera pose from capture"
            value={`${latencyExample.visionMeasurementMeters.toFixed(2)} m`}
          />
          <Datum
            label="Correct capture-time residual"
            value={`${latencyExample.captureTimeResidualMeters.toFixed(2)} m`}
          />
          <Datum
            label="Wrong receipt-time residual"
            value={`${latencyExample.receiptTimeResidualMeters.toFixed(2)} m`}
          />
        </dl>
      </div>

      <p
        role="note"
        className="mt-5 border-l-4 border-ares-gold/60 bg-ares-gold/10 p-3 text-sm leading-relaxed text-white"
      >
        <strong>Model limit:</strong> These controls mirror named ARES review
        stages and simple capture-time math. Checklist explanations are teaching
        text; the current prefilter reports only `prefilter_rejected`. The lab
        does not process an image, calculate NIS, run the estimator, connect to
        a camera, or prove field position.
      </p>
    </section>
  );
}

const Datum = AcademyDatum;
