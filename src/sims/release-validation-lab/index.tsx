/** @sim {"name":"ARES Release Validation Lab","requiresContext":false,"academyApproved":true,"fidelity":"code-derived"} */
import { useState } from "react";

export type ValidationScenario =
  | "public-library-api"
  | "shared-library-behavior"
  | "ftc-season-only"
  | "documentation-only"
  | "clean-student-consumer";

export type ValidationPlan =
  | "docs-check"
  | "ftc-check"
  | "library-only"
  | "candidate-matrix"
  | "candidate-matrix-api"
  | "clean-remote-resolve";

const SCENARIOS: Record<ValidationScenario, { label: string; expected: ValidationPlan }> = {
  "public-library-api": {
    label: "Change a public ARESLib API used by robot projects",
    expected: "candidate-matrix-api",
  },
  "shared-library-behavior": {
    label: "Change shared ARESLib behavior without changing its public API",
    expected: "candidate-matrix",
  },
  "ftc-season-only": {
    label: "Change only the current FTC season project",
    expected: "ftc-check",
  },
  "documentation-only": {
    label: "Fix wording and links in ARESLib documentation only",
    expected: "docs-check",
  },
  "clean-student-consumer": {
    label: "Confirm a released version works for a student project",
    expected: "clean-remote-resolve",
  },
};

const PLANS: Record<ValidationPlan, { label: string; evidence: string }> = {
  "docs-check": {
    label: "Run documentation link and policy checks",
    evidence: "This fits a documentation-only change. It does not publish a library candidate.",
  },
  "ftc-check": {
    label: "Run FTC unit, simulator, and APK checks",
    evidence: "This fits an FTC-owned change when ARESLib source is unchanged.",
  },
  "library-only": {
    label: "Run only the focused ARESLib test and affected module tests",
    evidence: "These checks help while coding, but they do not test the changed library through every consumer.",
  },
  "candidate-matrix": {
    label: "Build a unique candidate and test every affected consumer",
    evidence: "This fits a shared behavior change when the public API baseline is unchanged.",
  },
  "candidate-matrix-api": {
    label: "Review the API baseline, build a unique candidate, and test every consumer",
    evidence: "This fits an intentional public API change before any final release identity is assigned.",
  },
  "clean-remote-resolve": {
    label: "Resolve the released BOM and modules from the remote repository in a clean build",
    evidence: "This checks what a normal student project receives without sibling source substitution.",
  },
};

export function evaluateValidationPlan(
  scenario: ValidationScenario,
  plan: ValidationPlan,
) {
  const expected = SCENARIOS[scenario].expected;
  return {
    correct: expected === plan,
    expectedPlan: PLANS[expected].label,
    evidence: PLANS[plan].evidence,
  };
}

export default function ReleaseValidationLab() {
  const [scenario, setScenario] = useState<ValidationScenario>("public-library-api");
  const [plan, setPlan] = useState<ValidationPlan>("library-only");
  const [checked, setChecked] = useState(false);
  const result = evaluateValidationPlan(scenario, plan);

  const reset = () => {
    setScenario("public-library-api");
    setPlan("library-only");
    setChecked(false);
  };

  return (
    <section
      aria-labelledby="release-validation-title"
      className="my-6 rounded-lg border border-white/10 bg-charcoal p-4 sm:p-5"
    >
      <h3 id="release-validation-title" className="text-xl font-black text-white">
        ARES Release Validation Lab
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-marble/80">
        Match one change to the smallest plan that still tests the right boundary.
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-bold text-white">
          Change scenario
          <select
            value={scenario}
            onChange={(event) => {
              setScenario(event.currentTarget.value as ValidationScenario);
              setChecked(false);
            }}
            className={controlClass}
          >
            {(Object.entries(SCENARIOS) as [ValidationScenario, (typeof SCENARIOS)[ValidationScenario]][])
              .map(([id, item]) => <option key={id} value={id}>{item.label}</option>)}
          </select>
        </label>

        <label className="text-sm font-bold text-white">
          Proposed validation plan
          <select
            value={plan}
            onChange={(event) => {
              setPlan(event.currentTarget.value as ValidationPlan);
              setChecked(false);
            }}
            className={controlClass}
          >
            {(Object.entries(PLANS) as [ValidationPlan, (typeof PLANS)[ValidationPlan]][])
              .map(([id, item]) => <option key={id} value={id}>{item.label}</option>)}
          </select>
        </label>
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => setChecked(true)}
          className="min-h-11 rounded bg-ares-red px-4 text-sm font-black text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
        >
          Check plan
        </button>
        <button
          type="button"
          onClick={reset}
          className="min-h-11 rounded border border-white/20 px-4 text-sm font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
        >
          Reset
        </button>
      </div>

      <div
        role="status"
        aria-live="polite"
        className="mt-4 rounded border border-white/10 bg-obsidian p-4 text-sm leading-relaxed text-white"
      >
        {checked ? (
          <>
            <strong>{result.correct ? "Plan matches." : "Plan leaves a gap."}</strong>{" "}
            {result.evidence}{result.correct ? "" : ` Use: ${result.expectedPlan}.`}
          </>
        ) : "Choose a scenario and plan, then check the boundary."}
      </div>

      <p
        role="note"
        className="mt-4 border-l-4 border-ares-gold/60 bg-ares-gold/10 p-3 text-sm leading-relaxed text-white"
      >
        <strong>Model limit:</strong> This lab follows the pinned ARES 12.0.0 development and release
        contracts. It does not inspect a branch, run Gradle, publish a candidate, approve a pull
        request, or prove that a release is correct.
      </p>
    </section>
  );
}

const controlClass = "mt-2 min-h-11 w-full rounded border border-white/20 bg-obsidian px-3 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan";
