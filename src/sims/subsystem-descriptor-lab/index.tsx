/** @sim {"name":"Subsystem Descriptor Independence Lab","requiresContext":false,"academyApproved":true,"fidelity":"conceptual"} */
import { useMemo, useState } from "react";
import { RotateCcw, ShieldCheck } from "lucide-react";
import { AcademyCheckboxControl, AcademyRangeControl } from "@/sims/shared/academy-interaction-ui";

export type IndicatorPreview = { leftApplied: number; rightApplied: number; decision: string };

export function calculateIndicatorPreview(leftTarget: number, rightTarget: number, enabled: boolean): IndicatorPreview {
  if (![leftTarget, rightTarget].every(Number.isFinite)) throw new Error("Targets must be finite.");
  if (leftTarget < 0 || leftTarget > 1 || rightTarget < 0 || rightTarget > 1) throw new Error("Targets must stay between zero and one.");
  if (!enabled) return { leftApplied: 0, rightApplied: 0, decision: "Safe off" };
  return { leftApplied: leftTarget, rightApplied: rightTarget, decision: "Independent targets" };
}

const DEFAULTS = { left: 0.472, right: 0.611, enabled: true } as const;

export default function SubsystemDescriptorLab() {
  const [left, setLeft] = useState<number>(DEFAULTS.left);
  const [right, setRight] = useState<number>(DEFAULTS.right);
  const [enabled, setEnabled] = useState<boolean>(DEFAULTS.enabled);
  const preview = useMemo(() => calculateIndicatorPreview(left, right, enabled), [left, right, enabled]);
  const reset = () => { setLeft(DEFAULTS.left); setRight(DEFAULTS.right); setEnabled(DEFAULTS.enabled); };

  return (
    <section aria-labelledby="descriptor-lab-title" className="my-8 rounded-xl border border-ares-cyan/30 bg-black/35 p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div><p className="text-xs font-bold uppercase tracking-widest text-ares-cyan">Concept preview</p><h3 id="descriptor-lab-title" className="mt-1 text-xl font-black text-white">Subsystem Descriptor Independence Lab</h3><p className="mt-2 max-w-3xl text-sm leading-relaxed text-marble/80">Change two target fields and check that each conceptual output stays independent.</p></div>
        <button type="button" onClick={reset} className="inline-flex min-h-11 items-center justify-center gap-2 rounded border border-white/20 px-4 py-2 text-sm font-bold text-white hover:border-ares-cyan focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"><RotateCcw aria-hidden="true" size={16} /> Reset</button>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <fieldset className="grid gap-5 rounded-lg border border-white/10 bg-white/5 p-4">
          <legend className="px-2 text-sm font-bold text-ares-gold">Invented target state</legend>
          <AcademyRangeControl label="Left target" value={left} min={0} max={1} step={0.001} decimals={3} onChange={setLeft} />
          <AcademyRangeControl label="Right target" value={right} min={0} max={1} step={0.001} decimals={3} onChange={setRight} />
          <AcademyCheckboxControl label="Outputs enabled in concept model" checked={enabled} onChange={setEnabled} />
        </fieldset>

        <div className="rounded-lg border border-white/10 bg-obsidian p-4">
          <h4 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-ares-gold"><ShieldCheck aria-hidden="true" size={18} /> Applied concept outputs</h4>
          <div className="mt-5 grid grid-cols-2 gap-4" aria-hidden="true">
            <Indicator label="Left" value={preview.leftApplied} />
            <Indicator label="Right" value={preview.rightApplied} />
          </div>
          <dl aria-live="polite" aria-atomic="true" className="mt-5 grid gap-3 sm:grid-cols-3">
            <Datum label="Decision" value={preview.decision} />
            <Datum label="Left output" value={preview.leftApplied.toFixed(3)} />
            <Datum label="Right output" value={preview.rightApplied.toFixed(3)} />
          </dl>
        </div>
      </div>

      <details className="mt-5 rounded border border-white/10 bg-white/5 p-3 text-sm text-white"><summary className="min-h-11 cursor-pointer font-bold text-ares-cyan">Open the descriptor-to-output trace</summary><ol className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4"><TraceStep title="Descriptor" text="Two hardware IDs, two target fields, two direct loops, and zero safe outputs." /><TraceStep title="State" text="Left and right targets remain separate values." /><TraceStep title="Controller" text="Each target feeds only its named conceptual channel." /><TraceStep title="Safe state" text="Turning outputs off sends both concept values to zero." /></ol></details>

      <p role="note" className="mt-5 border-l-4 border-ares-gold/60 bg-ares-gold/10 p-3 text-sm leading-relaxed text-white"><strong>Model limit:</strong> This invented preview does not load or validate an `.aressubsystem`, generate Kotlin, run Redux, call an FTC adapter, reproduce PWM color, detect a failed write, or prove physical wiring and safe-off behavior.</p>
    </section>
  );
}

function Indicator({ label, value }: { label: string; value: number }) {
  return <div className="grid justify-items-center gap-2"><div className="h-20 w-20 rounded-full border-4 border-white/20" style={{ backgroundColor: `hsl(${Math.round(value * 300)} 90% ${value === 0 ? 5 : 50}%)` }} /><span className="text-sm font-bold text-white">{label}</span></div>;
}

function Datum({ label, value }: { label: string; value: string }) {
  return <div className="rounded border border-white/10 p-3"><dt className="text-xs uppercase tracking-wide text-marble/70">{label}</dt><dd className="mt-1 font-mono font-bold text-white">{value}</dd></div>;
}

function TraceStep({ title, text }: { title: string; text: string }) {
  return <li className="rounded border border-white/10 p-3"><strong className="block text-ares-gold">{title}</strong><span className="mt-1 block leading-relaxed text-marble/80">{text}</span></li>;
}
