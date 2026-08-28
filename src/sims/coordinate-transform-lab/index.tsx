/** @sim {"name":"Coordinate Transform Lab","requiresContext":false,"academyApproved":true,"fidelity":"code-derived"} */
import { useMemo, useState } from "react";
import { RotateCcw } from "lucide-react";

const DEFAULTS = { forwardMeters: 1, leftMeters: 0, headingDegrees: 0 } as const;

export function robotToField(forwardMeters: number, leftMeters: number, headingDegrees: number) {
  const headingRadians = headingDegrees * Math.PI / 180;
  return {
    fieldXMeters: forwardMeters * Math.cos(headingRadians) - leftMeters * Math.sin(headingRadians),
    fieldYMeters: forwardMeters * Math.sin(headingRadians) + leftMeters * Math.cos(headingRadians),
  };
}

export default function CoordinateTransformLab() {
  const [forwardMeters, setForwardMeters] = useState<number>(DEFAULTS.forwardMeters);
  const [leftMeters, setLeftMeters] = useState<number>(DEFAULTS.leftMeters);
  const [headingDegrees, setHeadingDegrees] = useState<number>(DEFAULTS.headingDegrees);
  const result = useMemo(
    () => robotToField(forwardMeters, leftMeters, headingDegrees),
    [forwardMeters, leftMeters, headingDegrees],
  );

  const reset = () => {
    setForwardMeters(DEFAULTS.forwardMeters);
    setLeftMeters(DEFAULTS.leftMeters);
    setHeadingDegrees(DEFAULTS.headingDegrees);
  };

  return (
    <section aria-labelledby="coordinate-transform-title" className="my-8 rounded-xl border border-ares-cyan/30 bg-black/35 p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-ares-cyan">Code-derived math model</p>
          <h3 id="coordinate-transform-title" className="mt-1 text-xl font-black text-white">Robot-to-Field Coordinate Lab</h3>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-marble/80">
            Rotate one robot-local motion vector into the field frame. Positive robot Y is left, and positive heading turns counter-clockwise.
          </p>
        </div>
        <button type="button" onClick={reset} className="inline-flex min-h-11 items-center justify-center gap-2 rounded border border-white/20 px-4 py-2 text-sm font-bold text-white hover:border-ares-cyan focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan">
          <RotateCcw aria-hidden="true" size={16} /> Reset
        </button>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(17rem,0.8fr)]">
        <fieldset className="grid gap-5 rounded-lg border border-white/10 bg-white/5 p-4">
          <legend className="px-2 text-sm font-bold text-ares-gold">Choose local motion and heading</legend>
          <NumberControl label="Robot forward motion in meters" value={forwardMeters} min={-2} max={2} step={0.25} onChange={setForwardMeters} />
          <NumberControl label="Robot left motion in meters" value={leftMeters} min={-2} max={2} step={0.25} onChange={setLeftMeters} />
          <NumberControl label="Counter-clockwise heading in degrees" value={headingDegrees} min={-180} max={180} step={15} onChange={setHeadingDegrees} />
        </fieldset>

        <div className="rounded-lg border border-white/10 bg-obsidian p-4" aria-live="polite" aria-atomic="true">
          <h4 className="text-sm font-bold uppercase tracking-wider text-ares-gold">Field-frame result</h4>
          <dl className="mt-4 grid gap-4">
            <Result label="Field X change" value={`${clean(result.fieldXMeters).toFixed(2)} m`} />
            <Result label="Field Y change" value={`${clean(result.fieldYMeters).toFixed(2)} m`} />
            <Result label="Heading" value={`${headingDegrees}° (${(headingDegrees * Math.PI / 180).toFixed(2)} rad)`} />
          </dl>
          <p className="mt-5 text-sm leading-relaxed text-marble/80">
            A local vector of ({forwardMeters.toFixed(2)}, {leftMeters.toFixed(2)}) meters becomes ({clean(result.fieldXMeters).toFixed(2)}, {clean(result.fieldYMeters).toFixed(2)}) meters on the field.
          </p>
        </div>
      </div>

      <p role="note" className="mt-5 border-l-4 border-ares-gold/60 bg-ares-gold/10 p-3 text-sm leading-relaxed text-white">
        <strong>Fidelity limit:</strong> The axis and rotation rules match the ARES 11 coordinate contract. This activity transforms one ideal vector; it does not model sensor error, wheel slip, localization uncertainty, or physical motion.
      </p>
    </section>
  );
}

function clean(value: number) {
  return Math.abs(value) < 1e-10 ? 0 : value;
}

function NumberControl({ label, value, min, max, step, onChange }: { label: string; value: number; min: number; max: number; step: number; onChange: (value: number) => void }) {
  const id = label.toLowerCase().replace(/[^a-z0-9]+/gu, "-");
  return (
    <div className="grid gap-2">
      <label htmlFor={id} className="flex items-center justify-between gap-3 text-sm font-semibold text-white">
        <span>{label}</span><output htmlFor={id} className="font-mono text-ares-cyan">{value}</output>
      </label>
      <input id={id} aria-label={label} type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.currentTarget.value))} className="min-h-11 w-full cursor-pointer accent-ares-red" />
    </div>
  );
}

function Result({ label, value }: { label: string; value: string }) {
  return <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 border-b border-white/10 pb-2"><dt className="text-sm text-marble/70">{label}</dt><dd className="font-mono font-bold text-white">{value}</dd></div>;
}
