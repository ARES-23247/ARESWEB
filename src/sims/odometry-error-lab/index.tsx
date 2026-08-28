/** @sim {"name":"Odometry Error Lab","requiresContext":false,"academyApproved":true,"fidelity":"conceptual"} */
import { useMemo, useState } from "react";
import { RotateCcw } from "lucide-react";

export type OdometryTrial = {
  trueX: number;
  trueY: number;
  estimatedX: number;
  estimatedY: number;
  endpointError: number;
};

const DEFAULTS = { distance: 3, scaleErrorPercent: 0, headingBiasDegrees: 0 } as const;

export function calculateOdometryTrial(
  distance: number,
  scaleErrorPercent: number,
  headingBiasDegrees: number,
): OdometryTrial {
  if (![distance, scaleErrorPercent, headingBiasDegrees].every(Number.isFinite) || distance <= 0) {
    throw new Error("Odometry trial inputs must be finite and distance must be positive.");
  }
  const estimatedDistance = distance * (1 + scaleErrorPercent / 100);
  const headingRadians = headingBiasDegrees * Math.PI / 180;
  const estimatedX = estimatedDistance * Math.cos(headingRadians);
  const estimatedY = estimatedDistance * Math.sin(headingRadians);
  return {
    trueX: distance,
    trueY: 0,
    estimatedX,
    estimatedY,
    endpointError: Math.hypot(distance - estimatedX, estimatedY),
  };
}

export default function OdometryErrorLab() {
  const [distance, setDistance] = useState<number>(DEFAULTS.distance);
  const [scaleErrorPercent, setScaleErrorPercent] = useState<number>(DEFAULTS.scaleErrorPercent);
  const [headingBiasDegrees, setHeadingBiasDegrees] = useState<number>(DEFAULTS.headingBiasDegrees);
  const result = useMemo(
    () => calculateOdometryTrial(distance, scaleErrorPercent, headingBiasDegrees),
    [distance, scaleErrorPercent, headingBiasDegrees],
  );
  const scale = 240 / 6;
  const originX = 65;
  const originY = 170;
  const point = (x: number, y: number) => `${originX + x * scale},${originY - y * scale}`;
  const reset = () => {
    setDistance(DEFAULTS.distance);
    setScaleErrorPercent(DEFAULTS.scaleErrorPercent);
    setHeadingBiasDegrees(DEFAULTS.headingBiasDegrees);
  };

  return (
    <section aria-labelledby="odometry-error-title" className="my-8 rounded-xl border border-ares-cyan/30 bg-black/35 p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-ares-cyan">Concept model</p>
          <h3 id="odometry-error-title" className="mt-1 text-xl font-black text-white">Odometry Calibration Error Lab</h3>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-marble/80">Compare a surveyed straight endpoint with an estimate affected by distance scale and heading bias.</p>
        </div>
        <button type="button" onClick={reset} className="inline-flex min-h-11 items-center justify-center gap-2 rounded border border-white/20 px-4 py-2 text-sm font-bold text-white hover:border-ares-cyan focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"><RotateCcw aria-hidden="true" size={16} /> Reset</button>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(16rem,0.8fr)_minmax(0,1.2fr)]">
        <fieldset className="grid gap-5 rounded-lg border border-white/10 bg-white/5 p-4">
          <legend className="px-2 text-sm font-bold text-ares-gold">Choose one calibration trial</legend>
          <NumberControl label="Surveyed distance" unit="m" value={distance} min={1} max={6} step={0.1} onChange={setDistance} />
          <NumberControl label="Distance scale error" unit="%" value={scaleErrorPercent} min={-10} max={10} step={0.5} onChange={setScaleErrorPercent} />
          <NumberControl label="Heading bias" unit="°" value={headingBiasDegrees} min={-15} max={15} step={1} onChange={setHeadingBiasDegrees} />
        </fieldset>

        <div className="rounded-lg border border-white/10 bg-obsidian p-4">
          <h4 className="text-sm font-bold uppercase tracking-wider text-ares-gold">Top-down endpoint comparison</h4>
          <svg viewBox="0 0 360 210" className="mt-3 h-auto w-full" role="img" aria-label={`True endpoint X ${result.trueX.toFixed(2)}, Y zero meters. Estimated endpoint X ${result.estimatedX.toFixed(2)}, Y ${result.estimatedY.toFixed(2)} meters. Endpoint error ${result.endpointError.toFixed(2)} meters.`}>
            <line x1={originX} y1={originY} x2="325" y2={originY} stroke="currentColor" className="text-white/30" />
            <line x1={originX} y1="25" x2={originX} y2="190" stroke="currentColor" className="text-white/30" />
            <line x1={originX} y1={originY} x2={originX + result.trueX * scale} y2={originY} stroke="currentColor" className="text-ares-gold" strokeWidth="5" />
            <line x1={originX} y1={originY} x2={originX + result.estimatedX * scale} y2={originY - result.estimatedY * scale} stroke="currentColor" className="text-ares-cyan" strokeWidth="5" />
            <circle cx={point(result.trueX, result.trueY).split(",")[0]} cy={point(result.trueX, result.trueY).split(",")[1]} r="6" fill="currentColor" className="text-ares-gold" />
            <circle cx={point(result.estimatedX, result.estimatedY).split(",")[0]} cy={point(result.estimatedX, result.estimatedY).split(",")[1]} r="6" fill="currentColor" className="text-ares-cyan" />
            <text x="72" y="198" fill="currentColor" className="text-[11px] text-white">field +X</text>
            <text x="8" y="35" fill="currentColor" className="text-[11px] text-white">field +Y</text>
          </svg>
          <dl aria-live="polite" aria-atomic="true" className="mt-4 grid gap-3 sm:grid-cols-3">
            <Result label="Estimated X" value={`${result.estimatedX.toFixed(2)} m`} />
            <Result label="Estimated Y" value={`${result.estimatedY.toFixed(2)} m`} />
            <Result label="Endpoint error" value={`${result.endpointError.toFixed(2)} m`} />
          </dl>
        </div>
      </div>

      <details className="mt-5 rounded border border-white/10 bg-white/5 p-3 text-sm text-white">
        <summary className="min-h-11 cursor-pointer font-bold text-ares-cyan">Open the endpoint data table</summary>
        <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[28rem] text-left"><thead><tr><th className="p-2">Endpoint</th><th className="p-2">Field X</th><th className="p-2">Field Y</th></tr></thead><tbody><tr className="border-t border-white/10"><td className="p-2">Surveyed truth</td><td className="p-2">{result.trueX.toFixed(2)} m</td><td className="p-2">0.00 m</td></tr><tr className="border-t border-white/10"><td className="p-2">Odometry estimate</td><td className="p-2">{result.estimatedX.toFixed(2)} m</td><td className="p-2">{result.estimatedY.toFixed(2)} m</td></tr></tbody></table></div>
      </details>

      <p role="note" className="mt-5 border-l-4 border-ares-gold/60 bg-ares-gold/10 p-3 text-sm leading-relaxed text-white"><strong>Model limit:</strong> This invented straight-route model demonstrates two calibration errors only. It is not the ARES pose estimator and omits wheel slip, curved motion, covariance, timestamps, delayed vision, sensor noise, and physical robot behavior.</p>
    </section>
  );
}

function NumberControl({ label, unit, value, min, max, step, onChange }: { label: string; unit: string; value: number; min: number; max: number; step: number; onChange: (value: number) => void }) {
  const id = label.toLowerCase().replace(/[^a-z0-9]+/gu, "-");
  return <div className="grid gap-2"><label htmlFor={id} className="flex items-center justify-between gap-3 text-sm font-semibold text-white"><span>{label}</span><output htmlFor={id} className="font-mono text-ares-cyan">{value.toFixed(1)} {unit}</output></label><input id={id} aria-label={label} type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.currentTarget.value))} className="min-h-11 w-full cursor-pointer accent-ares-red" /></div>;
}

function Result({ label, value }: { label: string; value: string }) {
  return <div className="rounded border border-white/10 p-3"><dt className="text-xs uppercase tracking-wide text-marble/70">{label}</dt><dd className="mt-1 font-mono text-lg font-bold text-white">{value}</dd></div>;
}
