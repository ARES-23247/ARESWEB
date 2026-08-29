/** @sim {"name":"Evidence Level Scenarios","requiresContext":false,"academyApproved":true,"fidelity":"conceptual"} */
import { useMemo, useState } from "react";
import { RotateCcw } from "lucide-react";

const LEVELS = [
  { id: "unit", label: "Unit test" },
  { id: "simulation", label: "Local simulation" },
  { id: "inspection", label: "Disabled physical inspection" },
  { id: "restrained", label: "Restrained physical test" },
  { id: "floor", label: "Limited floor test" },
] as const;

const SCENARIOS = [
  {
    id: "reducer",
    claim: "The reducer returns the stopped state after a stop action.",
    answer: "unit",
    explanation: "A unit test can call the reducer with known inputs and compare the returned state.",
  },
  {
    id: "path",
    claim: "The generated path stays inside the modeled field and reaches its waypoint.",
    answer: "simulation",
    explanation: "Local simulation can check the code and modeled field. It cannot prove the real robot follows the path.",
  },
  {
    id: "motor",
    claim: "The left-front motor on this robot turns in the expected physical direction.",
    answer: "restrained",
    explanation: "A short restrained test is needed because software cannot identify the real wiring and motor direction by itself.",
  },
] as const;

type ScenarioId = typeof SCENARIOS[number]["id"];
type LevelId = typeof LEVELS[number]["id"];
type Answers = Partial<Record<ScenarioId, LevelId>>;

export default function EvidenceLevelScenarios() {
  const [answers, setAnswers] = useState<Answers>({});
  const [checked, setChecked] = useState(false);
  const answeredCount = Object.keys(answers).length;
  const correctCount = useMemo(
    () => SCENARIOS.filter((scenario) => answers[scenario.id] === scenario.answer).length,
    [answers],
  );

  const reset = () => {
    setAnswers({});
    setChecked(false);
  };

  return (
    <section aria-labelledby="evidence-scenarios-title" className="my-8 rounded-xl border border-ares-cyan/30 bg-black/35 p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-ares-cyan">Concept model</p>
          <h3 id="evidence-scenarios-title" className="mt-1 text-xl font-black text-white">Choose the Lowest Useful Evidence Level</h3>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-marble/80">
            Match each claim to the first test level that can support it. A later level may add evidence, but it should not replace the earlier checks.
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

      <div className="mt-6 grid gap-4">
        {SCENARIOS.map((scenario, index) => {
          const isCorrect = answers[scenario.id] === scenario.answer;
          return (
            <fieldset key={scenario.id} className="rounded-lg border border-white/10 bg-white/5 p-4">
              <legend className="px-2 text-sm font-bold text-ares-gold">Claim {index + 1}</legend>
              <p className="text-sm leading-relaxed text-white">{scenario.claim}</p>
              <label htmlFor={`evidence-${scenario.id}`} className="mt-4 block text-sm font-semibold text-white">
                Lowest useful evidence level
              </label>
              <select
                id={`evidence-${scenario.id}`}
                value={answers[scenario.id] ?? ""}
                onChange={(event) => {
                  const selectedLevel = event.currentTarget.value as LevelId;
                  setAnswers((current) => ({ ...current, [scenario.id]: selectedLevel }));
                  setChecked(false);
                }}
                className="mt-2 min-h-11 w-full rounded border border-white/20 bg-obsidian px-3 py-2 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan sm:max-w-md"
              >
                <option value="">Choose a level</option>
                {LEVELS.map((level) => <option key={level.id} value={level.id}>{level.label}</option>)}
              </select>
              {checked && (
                <p className={`mt-3 text-sm leading-relaxed ${isCorrect ? "text-ares-success" : "text-ares-gold"}`}>
                  <strong>{isCorrect ? "Supported." : "Try another level."}</strong> {scenario.explanation}
                </p>
              )}
            </fieldset>
          );
        })}
      </div>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <button
          type="button"
          disabled={answeredCount !== SCENARIOS.length}
          onClick={() => setChecked(true)}
          className="min-h-11 rounded bg-ares-red px-5 py-2 text-sm font-black text-white hover:bg-mars-red-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan disabled:cursor-not-allowed disabled:opacity-50"
        >
          Check evidence choices
        </button>
        <p aria-live="polite" aria-atomic="true" className="text-sm text-marble/80">
          {checked ? `${correctCount} of ${SCENARIOS.length} choices supported.` : `${answeredCount} of ${SCENARIOS.length} claims answered.`}
        </p>
      </div>

      <p role="note" className="mt-5 border-l-4 border-ares-gold/60 bg-ares-gold/10 p-3 text-sm leading-relaxed text-white">
        <strong>Model limit:</strong> These scenarios teach evidence boundaries. They do not replace the team safety procedure, current competition rules, a physical test plan, or student review of the actual robot.
      </p>
    </section>
  );
}
