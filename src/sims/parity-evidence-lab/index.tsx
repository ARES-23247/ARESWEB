/** @sim {"name":"Adapter Parity Evidence Lab","requiresContext":false,"academyApproved":true,"fidelity":"conceptual"} */
import { useMemo, useState } from "react";
import { RotateCcw, Scale } from "lucide-react";

type Result = "matches" | "differs" | "untested";
type ScenarioId = "startup" | "invalid" | "write-fault" | "close";
type EvidenceStage = "compile" | "unit" | "simulation" | "physical";

const SCENARIOS: Record<ScenarioId, { label: string; expected: string }> = {
  startup: { label: "Safe startup", expected: "Neutral output; no motion request" },
  invalid: { label: "Invalid cached feedback", expected: "Reject motion and report invalid evidence" },
  "write-fault": { label: "Failed output write", expected: "Attempt neutral and latch the fault" },
  close: { label: "Close called twice", expected: "Neutral cleanup remains safe and repeatable" },
};

const EVIDENCE_STAGES: Record<EvidenceStage, { label: string; supports: string; missing: string }> = {
  compile: {
    label: "Compile check",
    supports: "The selected source and interfaces fit together.",
    missing: "Runtime behavior, simulated motion, wiring, and physical response are still unknown.",
  },
  unit: {
    label: "Unit or contract test",
    supports: "The tested code followed this rule for the recorded inputs.",
    missing: "Full OpMode timing, simulator physics, wiring, and physical response are still unknown.",
  },
  simulation: {
    label: "Desktop simulation",
    supports: "The real season logic and mock adapters completed this recorded simulator case.",
    missing: "Real wiring, radio traffic, friction, load, travel, and device timing are still unknown.",
  },
  physical: {
    label: "Restrained physical check",
    supports: "The robot showed this result under the recorded setup and limits.",
    missing: "Other loads, batteries, field conditions, code versions, and future runs are still unknown.",
  },
};

export function classifyParityEvidence(platform: Result, simulated: Result) {
  if (platform === "untested" || simulated === "untested") return { status: "Incomplete evidence", detail: "Run both adapter tests for this same case." };
  if (platform === "matches" && simulated === "matches") return { status: "Aligned with expected contract", detail: "Both tests support this one bounded behavior claim." };
  if (platform === "differs" && simulated === "differs") return { status: "Shared contract failure", detail: "Both adapters disagree with the expected safe result." };
  return { status: "Adapter mismatch", detail: "One adapter disagrees with the expected result. Investigate before wider testing." };
}

const DEFAULTS = {
  scenario: "startup" as ScenarioId,
  stage: "unit" as EvidenceStage,
  platform: "untested" as Result,
  simulated: "untested" as Result,
};

export default function ParityEvidenceLab() {
  const [scenario, setScenario] = useState<ScenarioId>(DEFAULTS.scenario);
  const [stage, setStage] = useState<EvidenceStage>(DEFAULTS.stage);
  const [platform, setPlatform] = useState<Result>(DEFAULTS.platform);
  const [simulated, setSimulated] = useState<Result>(DEFAULTS.simulated);
  const classification = useMemo(() => classifyParityEvidence(platform, simulated), [platform, simulated]);
  const reset = () => {
    setScenario(DEFAULTS.scenario);
    setStage(DEFAULTS.stage);
    setPlatform(DEFAULTS.platform);
    setSimulated(DEFAULTS.simulated);
  };

  return (
    <section aria-labelledby="parity-lab-title" className="my-8 rounded-xl border border-ares-cyan/30 bg-black/35 p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div><p className="text-xs font-bold uppercase tracking-widest text-ares-cyan">Evidence comparison</p><h3 id="parity-lab-title" className="mt-1 text-xl font-black text-white">Adapter Parity Evidence Lab</h3><p className="mt-2 max-w-3xl text-sm leading-relaxed text-marble/80">Compare one platform-adapter test with one simulated-adapter test against the same expected result.</p></div>
        <button type="button" onClick={reset} className="inline-flex min-h-11 items-center justify-center gap-2 rounded border border-white/20 px-4 py-2 text-sm font-bold text-white hover:border-ares-cyan focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"><RotateCcw aria-hidden="true" size={16} /> Reset</button>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <fieldset className="grid gap-4 rounded-lg border border-white/10 bg-white/5 p-4">
          <legend className="px-2 text-sm font-bold text-ares-gold">Recorded test evidence</legend>
          <SelectControl id="parity-scenario" label="Contract case" value={scenario} onChange={(value) => setScenario(value as ScenarioId)} options={Object.entries(SCENARIOS).map(([value, item]) => ({ value, label: item.label }))} />
          <SelectControl id="evidence-stage" label="Evidence stage" value={stage} onChange={(value) => setStage(value as EvidenceStage)} options={Object.entries(EVIDENCE_STAGES).map(([value, item]) => ({ value, label: item.label }))} />
          <SelectControl id="platform-result" label="Platform adapter test" value={platform} onChange={(value) => setPlatform(value as Result)} options={resultOptions} />
          <SelectControl id="simulated-result" label="Simulated adapter test" value={simulated} onChange={(value) => setSimulated(value as Result)} options={resultOptions} />
        </fieldset>

        <div className="rounded-lg border border-white/10 bg-obsidian p-4">
          <h4 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-ares-gold"><Scale aria-hidden="true" size={18} /> Bounded finding</h4>
          <dl aria-live="polite" aria-atomic="true" className="mt-4 grid gap-3">
            <Datum label="Expected result" value={SCENARIOS[scenario].expected} />
            <Datum label="Classification" value={classification.status} />
            <Datum label="Next step" value={classification.detail} />
            <Datum label="This evidence can support" value={EVIDENCE_STAGES[stage].supports} />
            <Datum label="This evidence does not prove" value={EVIDENCE_STAGES[stage].missing} />
          </dl>
        </div>
      </div>

      <details className="mt-5 rounded border border-white/10 bg-white/5 p-3 text-sm text-white"><summary className="min-h-11 cursor-pointer font-bold text-ares-cyan">Open the parity evidence rules</summary><ul className="mt-3 list-disc space-y-2 pl-6 text-marble/80"><li>Use the same input, units, clock, and expected result on both sides.</li><li>A compile check proves a shared interface, not matching runtime behavior.</li><li>A mock result cannot prove wiring, device response, friction, load, or travel.</li><li>A mismatch is useful evidence. Keep it visible until its cause is tested.</li></ul></details>

      <p role="note" className="mt-5 border-l-4 border-ares-gold/60 bg-ares-gold/10 p-3 text-sm leading-relaxed text-white"><strong>Model limit:</strong> This planning form uses the choices you enter. It does not run Gradle, load an adapter, inspect test XML, control time, inject faults, compare real outputs, connect to a robot, or prove physical behavior.</p>
    </section>
  );
}

const resultOptions = [
  { value: "untested", label: "Not tested" },
  { value: "matches", label: "Matches expected result" },
  { value: "differs", label: "Differs from expected result" },
];

function SelectControl({ id, label, value, onChange, options }: { id: string; label: string; value: string; onChange: (value: string) => void; options: Array<{ value: string; label: string }> }) {
  return <label htmlFor={id} className="grid gap-2 text-sm font-bold text-white"><span>{label}</span><select id={id} value={value} onChange={(event) => onChange(event.currentTarget.value)} className="min-h-11 rounded border border-white/20 bg-black px-3 py-2 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan">{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>;
}

function Datum({ label, value }: { label: string; value: string }) {
  return <div className="rounded border border-white/10 p-3"><dt className="text-xs uppercase tracking-wide text-marble/70">{label}</dt><dd className="mt-1 font-semibold leading-relaxed text-white">{value}</dd></div>;
}
