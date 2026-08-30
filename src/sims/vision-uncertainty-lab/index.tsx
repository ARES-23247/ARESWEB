/** @sim {"name":"Vision Evidence Rejection Lab","requiresContext":false,"academyApproved":true,"fidelity":"code-derived"} */
import { useMemo, useState } from "react";
import { Camera, Clock3, RotateCcw } from "lucide-react";

export type VisionEvidence = {
  finite: boolean;
  knownTarget: boolean;
  ambiguityAccepted: boolean;
  captureTimeInHistory: boolean;
  insideField: boolean;
  innovationAccepted: boolean;
};

export type VisionDecision = {
  status: "Accepted by this checklist" | "Rejected";
  reason: string;
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
  reason: string;
};

const DEFAULTS: VisionEvidence = {
  finite: true,
  knownTarget: true,
  ambiguityAccepted: true,
  captureTimeInHistory: true,
  insideField: true,
  innovationAccepted: true,
};

const GATES: VisionGate[] = [
  {
    key: "finite",
    label: "Pose and uncertainty are finite",
    reason: "The pose or uncertainty is not finite",
  },
  {
    key: "knownTarget",
    label: "Target appears in the reviewed field layout",
    reason: "The target identity is not in the reviewed field layout",
  },
  {
    key: "ambiguityAccepted",
    label: "Target ambiguity passes the chosen policy",
    reason:
      "The reported target solution is too ambiguous for the chosen policy",
  },
  {
    key: "captureTimeInHistory",
    label: "Capture time is inside stored pose history",
    reason: "The capture time is outside the stored pose history",
  },
  {
    key: "insideField",
    label: "Reported pose is inside checked field bounds",
    reason: "The reported pose is outside the checked field bounds",
  },
  {
    key: "innovationAccepted",
    label: "Innovation passes the uncertainty-aware check",
    reason:
      "The measurement disagrees too much with prediction for its stated uncertainty",
  },
];

export function classifyVisionEvidence(
  evidence: VisionEvidence,
): VisionDecision {
  const firstFailedGate = GATES.find((gate) => !evidence[gate.key]);
  if (firstFailedGate) {
    return { status: "Rejected", reason: firstFailedGate.reason };
  }
  return {
    status: "Accepted by this checklist",
    reason:
      "Every represented gate passed; keep uncertainty and later residuals visible",
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
          <p className="text-xs font-bold uppercase tracking-widest text-ares-cyan">
            Visible rejection path
          </p>
          <h3
            id="vision-evidence-title"
            className="mt-1 text-xl font-black text-white"
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
          <RotateCcw aria-hidden="true" size={16} /> Reset
        </button>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <fieldset className="grid gap-3 rounded-lg border border-white/10 bg-white/5 p-4">
          <legend className="px-2 text-sm font-bold text-ares-gold">
            Learning scenario evidence
          </legend>
          {GATES.map((gate) => (
            <label
              key={gate.key}
              className="flex min-h-11 cursor-pointer items-center gap-3 rounded border border-white/10 p-3 text-sm font-bold text-white"
            >
              <input
                type="checkbox"
                checked={evidence[gate.key]}
                onChange={(event) =>
                  setEvidence({
                    ...evidence,
                    [gate.key]: event.currentTarget.checked,
                  })
                }
                className="h-5 w-5 accent-ares-red"
              />
              {gate.label}
            </label>
          ))}
        </fieldset>

        <div className="rounded-lg border border-white/10 bg-obsidian p-4">
          <h4 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-ares-gold">
            <Camera aria-hidden="true" size={18} /> Checklist decision
          </h4>
          <dl aria-live="polite" aria-atomic="true" className="mt-4 grid gap-3">
            <Datum label="Status" value={decision.status} />
            <Datum label="First reason" value={decision.reason} />
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
          <Clock3 aria-hidden="true" size={18} /> Why capture time matters
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
        stages and simple capture-time math. They do not process an image, solve
        an AprilTag pose, calculate covariance or Mahalanobis distance, run the
        estimator, connect to a camera, or prove field position.
      </p>
    </section>
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
