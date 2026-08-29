/** @sim {"name":"FTC Driver Input Curve Lab","requiresContext":false,"academyApproved":true,"fidelity":"code-derived"} */
import { useMemo, useState } from "react";
import { Gamepad2, RotateCcw } from "lucide-react";

type Alliance = "RED" | "BLUE";
type Frame = "FIELD_RELATIVE" | "ROBOT_RELATIVE";
export type DriverAxisResult = { bounded: number; afterDeadband: number; shaped: number; smoothed: number; final: number };

export function shapeDriverAxis(input: number, exponent: number, previous: number, alliance: Alliance, frame: Frame): DriverAxisResult {
  const bounded = Number.isFinite(input) ? Math.max(-1, Math.min(1, input)) : 0;
  const safeExponent = Number.isFinite(exponent) && exponent > 0 ? exponent : 3;
  const safePrevious = Number.isFinite(previous) ? Math.max(-1, Math.min(1, previous)) : 0;
  const magnitude = Math.abs(bounded);
  const afterDeadband = magnitude < 0.05 ? 0 : Math.sign(bounded) * ((magnitude - 0.05) / 0.95);
  const shaped = Math.sign(afterDeadband) * Math.abs(afterDeadband) ** safeExponent;
  const smoothed = safePrevious * 0.6 + shaped * 0.4;
  const final = alliance === "BLUE" && frame === "FIELD_RELATIVE" ? -smoothed : smoothed;
  return { bounded, afterDeadband, shaped, smoothed, final };
}

const DEFAULTS = { input: 0.5, exponent: 3, previous: 0, alliance: "RED" as Alliance, frame: "FIELD_RELATIVE" as Frame };

export default function DriverInputCurveLab() {
  const [input, setInput] = useState(DEFAULTS.input);
  const [exponent, setExponent] = useState(DEFAULTS.exponent);
  const [previous, setPrevious] = useState(DEFAULTS.previous);
  const [alliance, setAlliance] = useState<Alliance>(DEFAULTS.alliance);
  const [frame, setFrame] = useState<Frame>(DEFAULTS.frame);
  const result = useMemo(() => shapeDriverAxis(input, exponent, previous, alliance, frame), [input, exponent, previous, alliance, frame]);
  const reset = () => { setInput(DEFAULTS.input); setExponent(DEFAULTS.exponent); setPrevious(DEFAULTS.previous); setAlliance(DEFAULTS.alliance); setFrame(DEFAULTS.frame); };
  return <section aria-labelledby="driver-curve-title" className="my-8 rounded-xl border border-ares-cyan/30 bg-black/35 p-4 sm:p-6"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-widest text-ares-cyan">One translation axis</p><h3 id="driver-curve-title" className="mt-1 text-xl font-black text-white">FTC Driver Input Curve Lab</h3><p className="mt-2 max-w-3xl text-sm leading-relaxed text-marble/80">Trace one invented axis through the current ARES deadband, exponent, first-order smoothing, and frame rule.</p></div><button type="button" onClick={reset} className="inline-flex min-h-11 items-center justify-center gap-2 rounded border border-white/20 px-4 py-2 text-sm font-bold text-white hover:border-ares-cyan focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"><RotateCcw aria-hidden="true" size={16} /> Reset</button></div><div className="mt-6 grid gap-5 lg:grid-cols-2"><fieldset className="grid gap-4 rounded-lg border border-white/10 bg-white/5 p-4"><legend className="px-2 text-sm font-bold text-ares-gold">Input and context</legend><RangeField id="driver-input" label="Joystick axis" value={input} min={-1} max={1} step={0.01} onChange={setInput} /><RangeField id="curve-exponent" label="Positive exponent" value={exponent} min={1} max={5} step={0.25} onChange={setExponent} /><RangeField id="previous-output" label="Previous smooth value" value={previous} min={-1} max={1} step={0.01} onChange={setPrevious} /><SelectField id="driver-alliance" label="Alliance" value={alliance} options={["RED", "BLUE"]} onChange={(value) => setAlliance(value as Alliance)} /><SelectField id="drive-frame" label="Drive frame" value={frame} options={["FIELD_RELATIVE", "ROBOT_RELATIVE"]} onChange={(value) => setFrame(value as Frame)} /></fieldset><div className="rounded-lg border border-white/10 bg-obsidian p-4"><h4 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-ares-gold"><Gamepad2 aria-hidden="true" size={18} /> Axis trace</h4><dl aria-live="polite" aria-atomic="true" className="mt-4 grid gap-3 sm:grid-cols-2"><Datum label="Bounded input" value={result.bounded.toFixed(4)} /><Datum label="After deadband" value={result.afterDeadband.toFixed(4)} /><Datum label="After exponent" value={result.shaped.toFixed(4)} /><Datum label="After smoothing" value={result.smoothed.toFixed(4)} /><Datum label="Final translation" value={result.final.toFixed(4)} /></dl></div></div><p role="note" className="mt-5 border-l-4 border-ares-gold/60 bg-ares-gold/10 p-3 text-sm leading-relaxed text-white"><strong>Model limit:</strong> This one-axis calculation mirrors the pinned controller math. It does not read a gamepad, advance repeated timed loops, shape rotation separately, use robot heading, run drivetrain kinematics, connect to a robot, or prove driving behavior.</p></section>;
}

function RangeField({ id, label, value, min, max, step, onChange }: { id: string; label: string; value: number; min: number; max: number; step: number; onChange: (value: number) => void }) { return <label htmlFor={id} className="grid gap-2 text-sm font-bold text-white"><span>{label}: <output className="font-mono text-ares-cyan">{value.toFixed(2)}</output></span><input id={id} type="range" value={value} min={min} max={max} step={step} onChange={(event) => onChange(Number(event.currentTarget.value))} className="min-h-11 w-full accent-ares-red focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan" /></label>; }
function SelectField({ id, label, value, options, onChange }: { id: string; label: string; value: string; options: string[]; onChange: (value: string) => void }) { return <label htmlFor={id} className="grid gap-2 text-sm font-bold text-white"><span>{label}</span><select id={id} value={value} onChange={(event) => onChange(event.currentTarget.value)} className="min-h-11 rounded border border-white/20 bg-black px-3 py-2 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan">{options.map((option) => <option key={option} value={option}>{option.replaceAll("_", " ").toLowerCase()}</option>)}</select></label>; }
function Datum({ label, value }: { label: string; value: string }) { return <div className="rounded border border-white/10 p-3"><dt className="text-xs uppercase tracking-wide text-marble/70">{label}</dt><dd className="mt-1 font-mono font-semibold text-white">{value}</dd></div>; }
