/** @sim {"name":"ARES Workspace Ownership Lab","requiresContext":false,"academyApproved":true,"fidelity":"code-derived"} */
import { useState } from "react";

export type WorkspaceOwner =
  | "library"
  | "ftc"
  | "frc"
  | "studio"
  | "starter"
  | "release";

const OWNERS: Record<WorkspaceOwner, string> = {
  library: "ARESLib-Kotlin/",
  ftc: "ARES-FTC/",
  frc: "ARES-FRC/",
  studio: "ARES-Analytics/",
  starter: "ARES-FTC-Starter/ or ARES-FRC-Starter/",
  release: "release/ or build-logic/",
};

const SCENARIOS = [
  ["shared-math", "Shared FTC and FRC pose math", "library", "Retest both league consumers."],
  ["ftc-binding", "Lightbot Control Hub device binding", "ftc", "Retest FTC and its simulator."],
  ["frc-lifecycle", "Marvin roboRIO season lifecycle", "frc", "Retest FRC and WPILib simulation."],
  ["studio-screen", "Studio workspace screen behavior", "studio", "Retest the desktop app."],
  ["starter-default", "Clean starter project default", "starter", "Verify its exported public mirror."],
  ["release-version", "Shared ARES release identity", "release", "Run the dependency-ordered release matrix."],
] as const;

export type WorkspaceScenarioId = (typeof SCENARIOS)[number][0];

export function evaluateWorkspaceChoice(
  scenarioId: WorkspaceScenarioId,
  proposedOwner: WorkspaceOwner,
) {
  const scenario = SCENARIOS.find(([id]) => id === scenarioId) ?? SCENARIOS[0];
  const expectedOwner = scenario[2] as WorkspaceOwner;
  return {
    correct: expectedOwner === proposedOwner,
    expectedOwner: OWNERS[expectedOwner],
    consumerCheck: scenario[3],
  };
}

export default function WorkspaceOwnershipLab() {
  const [scenarioId, setScenarioId] = useState<WorkspaceScenarioId>("shared-math");
  const [owner, setOwner] = useState<WorkspaceOwner>("library");
  const [checked, setChecked] = useState(false);
  const result = evaluateWorkspaceChoice(scenarioId, owner);

  const reset = () => {
    setScenarioId("shared-math");
    setOwner("library");
    setChecked(false);
  };

  return (
    <section aria-labelledby="workspace-owner-title" className="my-6 rounded-lg border border-white/10 bg-charcoal p-4 sm:p-5">
      <h3 id="workspace-owner-title" className="text-xl font-black text-white">ARES Workspace Ownership Lab</h3>
      <p className="mt-2 text-sm leading-relaxed text-marble/80">Choose the source owner before you plan a change.</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-bold text-white">
          Change to place
          <select value={scenarioId} onChange={(event) => { setScenarioId(event.currentTarget.value as WorkspaceScenarioId); setChecked(false); }} className={controlClass}>
            {SCENARIOS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </select>
        </label>
        <label className="text-sm font-bold text-white">
          Proposed source owner
          <select value={owner} onChange={(event) => { setOwner(event.currentTarget.value as WorkspaceOwner); setChecked(false); }} className={controlClass}>
            {(Object.entries(OWNERS) as [WorkspaceOwner, string][]).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </select>
        </label>
      </div>
      <div className="mt-4 flex flex-wrap gap-3">
        <button type="button" onClick={() => setChecked(true)} className="min-h-11 rounded bg-ares-red px-4 text-sm font-black text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan">Check owner</button>
        <button type="button" onClick={reset} className="min-h-11 rounded border border-white/20 px-4 text-sm font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan">Reset</button>
      </div>
      <div role="status" aria-live="polite" className="mt-4 rounded border border-white/10 bg-obsidian p-4 text-sm leading-relaxed text-white">
        {checked ? (
          <><strong>{result.correct ? "Owner matches." : "Choose a different owner."}</strong> Canonical source: {result.expectedOwner} {result.consumerCheck}</>
        ) : "Choose a change and owner, then check your reasoning."}
      </div>
      <p role="note" className="mt-4 border-l-4 border-ares-gold/60 bg-ares-gold/10 p-3 text-sm leading-relaxed text-white"><strong>Model limit:</strong> This lab uses the reviewed monorepo ownership map. It does not inspect a branch, find every affected file, run a build, or prove a change is correct.</p>
    </section>
  );
}

const controlClass = "mt-2 min-h-11 w-full rounded border border-white/20 bg-obsidian px-3 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan";
