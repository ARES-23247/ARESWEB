/** @sim {"name":"Subsystem Ownership Decision Lab","requiresContext":false,"academyApproved":true,"fidelity":"conceptual"} */
import { useMemo, useState } from "react";
import { RotateCcw, Route } from "lucide-react";

export type SubsystemPath = {
  choice: "Generated starter" | "Hybrid registration" | "Hand-authored subsystem";
  reason: string;
  firstStep: string;
};

export function chooseSubsystemPath(hasProvenKotlin: boolean, fitsCommonTemplate: boolean): SubsystemPath {
  if (hasProvenKotlin) {
    return {
      choice: "Hybrid registration",
      reason: "Keep the proven Kotlin user-owned and describe it with a reviewed subsystem document.",
      firstStep: "Inventory the existing classes, actions, simulation support, safety rules, and tests.",
    };
  }
  if (fitsCommonTemplate) {
    return {
      choice: "Generated starter",
      reason: "Start from the narrowest capability template, then review and own the editable starter files.",
      firstStep: "Complete the capability and safety worksheet before previewing generated changes.",
    };
  }
  return {
    choice: "Hand-authored subsystem",
    reason: "The mechanism needs an explicit custom design while preserving the same ARES boundaries.",
    firstStep: "Write the hazard, units, cached-input, safe-output, ownership, and verification plan first.",
  };
}

const DEFAULTS = { hasProvenKotlin: false, fitsCommonTemplate: true } as const;

export default function SubsystemOwnershipLab() {
  const [hasProvenKotlin, setHasProvenKotlin] = useState<boolean>(DEFAULTS.hasProvenKotlin);
  const [fitsCommonTemplate, setFitsCommonTemplate] = useState<boolean>(DEFAULTS.fitsCommonTemplate);
  const result = useMemo(
    () => chooseSubsystemPath(hasProvenKotlin, fitsCommonTemplate),
    [hasProvenKotlin, fitsCommonTemplate],
  );
  const reset = () => {
    setHasProvenKotlin(DEFAULTS.hasProvenKotlin);
    setFitsCommonTemplate(DEFAULTS.fitsCommonTemplate);
  };

  return (
    <section aria-labelledby="ownership-lab-title" className="my-8 rounded-xl border border-ares-cyan/30 bg-black/35 p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-ares-cyan">Workflow model</p>
          <h3 id="ownership-lab-title" className="mt-1 text-xl font-black text-white">Subsystem Ownership Decision Lab</h3>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-marble/80">Describe a mechanism starting point and compare the three supported authoring paths.</p>
        </div>
        <button type="button" onClick={reset} className="inline-flex min-h-11 items-center justify-center gap-2 rounded border border-white/20 px-4 py-2 text-sm font-bold text-white hover:border-ares-cyan focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"><RotateCcw aria-hidden="true" size={16} /> Reset</button>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <fieldset className="grid gap-4 rounded-lg border border-white/10 bg-white/5 p-4">
          <legend className="px-2 text-sm font-bold text-ares-gold">Starting evidence</legend>
          <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded border border-white/10 p-3 text-sm text-white">
            <input type="checkbox" checked={hasProvenKotlin} onChange={(event) => setHasProvenKotlin(event.currentTarget.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-ares-red" />
            <span><strong className="block">Proven Kotlin already exists</strong><span className="mt-1 block text-marble/70">The team has reviewed source, actions, tests, and ownership to preserve.</span></span>
          </label>
          <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded border border-white/10 p-3 text-sm text-white">
            <input type="checkbox" checked={fitsCommonTemplate} onChange={(event) => setFitsCommonTemplate(event.currentTarget.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-ares-red" />
            <span><strong className="block">A common capability template fits</strong><span className="mt-1 block text-marble/70">Simple actuator, position, velocity, sensor, homed, or composite behavior describes the need.</span></span>
          </label>
        </fieldset>

        <div className="rounded-lg border border-white/10 bg-obsidian p-4">
          <h4 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-ares-gold"><Route aria-hidden="true" size={18} /> Suggested starting path</h4>
          <dl aria-live="polite" aria-atomic="true" className="mt-4 grid gap-3">
            <Datum label="Choice" value={result.choice} />
            <Datum label="Why" value={result.reason} />
            <Datum label="First evidence step" value={result.firstStep} />
          </dl>
        </div>
      </div>

      <details className="mt-5 rounded border border-white/10 bg-white/5 p-3 text-sm text-white">
        <summary className="min-h-11 cursor-pointer font-bold text-ares-cyan">Compare artifact ownership</summary>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[38rem] border-collapse text-left text-sm">
            <thead><tr><th className="border border-white/15 p-2 text-ares-gold">Artifact</th><th className="border border-white/15 p-2 text-ares-gold">Normal owner</th><th className="border border-white/15 p-2 text-ares-gold">Regeneration rule</th></tr></thead>
            <tbody><OwnershipRow artifact="Editable Kotlin starter" owner="Generated starter, then student/team" rule="Preview a diff; never replace silently." /><OwnershipRow artifact="Existing custom Kotlin" owner="User-owned" rule="Registration must never replace it." /><OwnershipRow artifact="Build registry and contract plumbing" owner="Generated; do not edit" rule="Recreate from the reviewed subsystem document." /></tbody>
          </table>
        </div>
      </details>

      <p role="note" className="mt-5 border-l-4 border-ares-gold/60 bg-ares-gold/10 p-3 text-sm leading-relaxed text-white"><strong>Model limit:</strong> This two-question guide does not inspect Kotlin, validate an `.aressubsystem`, identify real hazards, generate files, run tests, prove simulation parity, or approve physical operation. A student must compare the recommendation with the pinned source and the mechanism design.</p>
    </section>
  );
}

function Datum({ label, value }: { label: string; value: string }) {
  return <div className="rounded border border-white/10 p-3"><dt className="text-xs uppercase tracking-wide text-marble/70">{label}</dt><dd className="mt-1 leading-relaxed font-semibold text-white">{value}</dd></div>;
}

function OwnershipRow({ artifact, owner, rule }: { artifact: string; owner: string; rule: string }) {
  return <tr><th scope="row" className="border border-white/15 p-2 font-semibold text-white">{artifact}</th><td className="border border-white/15 p-2 text-marble/80">{owner}</td><td className="border border-white/15 p-2 text-marble/80">{rule}</td></tr>;
}
