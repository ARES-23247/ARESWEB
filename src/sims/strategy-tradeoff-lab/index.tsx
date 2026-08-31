/** @sim {"name":"Strategy Tradeoff Lab","requiresContext":false,"academyApproved":true,"fidelity":"conceptual"} */
import { useMemo, useState } from "react";
import { AcademyLabShell, AcademyModelLimit } from "@/sims/shared/academy-interaction-ui";

export type StrategyRatings = {
  evidence: number;
  contribution: number;
  recovery: number;
};

export type StrategyWeights = StrategyRatings;

export type StrategyTradeoffResult =
  | { valid: false; reason: string }
  | { valid: true; planAScore: number; planBScore: number; lead: "A" | "B" | "tie"; explanation: string };

export const DEFAULT_WEIGHTS: StrategyWeights = { evidence: 3, contribution: 2, recovery: 2 };
export const DEFAULT_PLAN_A: StrategyRatings = { evidence: 3, contribution: 2, recovery: 3 };
export const DEFAULT_PLAN_B: StrategyRatings = { evidence: 1, contribution: 3, recovery: 1 };

export function compareStrategyTradeoffs(
  weights: StrategyWeights,
  planA: StrategyRatings,
  planB: StrategyRatings,
): StrategyTradeoffResult {
  const values = [...Object.values(weights), ...Object.values(planA), ...Object.values(planB)];
  if (!values.every((value) => Number.isInteger(value) && value >= 0 && value <= 3)) {
    return { valid: false, reason: "Every lesson rating and weight must be a whole number from 0 to 3." };
  }
  if (Object.values(weights).every((value) => value === 0)) {
    return { valid: false, reason: "Give at least one criterion a weight above zero." };
  }

  const score = (plan: StrategyRatings) => (
    weights.evidence * plan.evidence
    + weights.contribution * plan.contribution
    + weights.recovery * plan.recovery
  );
  const planAScore = score(planA);
  const planBScore = score(planB);
  const lead = planAScore === planBScore ? "tie" : planAScore > planBScore ? "A" : "B";
  return {
    valid: true,
    planAScore,
    planBScore,
    lead,
    explanation: lead === "tie"
      ? "The invented plans tie under these visible weights. Discuss missing evidence and change one assumption at a time."
      : `Invented Plan ${lead} leads under these visible weights. Treat that result as a discussion prompt, not a match decision.`,
  };
}

export default function StrategyTradeoffLab() {
  const [weights, setWeights] = useState<StrategyWeights>({ ...DEFAULT_WEIGHTS });
  const [planA, setPlanA] = useState<StrategyRatings>({ ...DEFAULT_PLAN_A });
  const [planB, setPlanB] = useState<StrategyRatings>({ ...DEFAULT_PLAN_B });
  const result = useMemo(() => compareStrategyTradeoffs(weights, planA, planB), [weights, planA, planB]);
  const reset = () => {
    setWeights({ ...DEFAULT_WEIGHTS });
    setPlanA({ ...DEFAULT_PLAN_A });
    setPlanB({ ...DEFAULT_PLAN_B });
  };

  return (
    <AcademyLabShell
      titleId="strategy-tradeoff-title"
      title="Strategy Tradeoff Lab"
      eyebrow="Transparent comparison"
      description="Rate two invented plans with one visible matrix. Change a weight to see why priorities and assumptions must stay visible."
      onReset={reset}
    >

      <div className="mt-6 overflow-x-auto rounded-lg border border-white/10">
        <table className="w-full min-w-[42rem] border-collapse text-left text-sm text-white">
          <caption className="sr-only">Weights and ratings for two invented strategy plans</caption>
          <thead className="bg-white/10 text-xs uppercase tracking-wider text-ares-gold">
            <tr>
              <th scope="col" className="p-3">Criterion</th>
              <th scope="col" className="p-3">Weight</th>
              <th scope="col" className="p-3">Plan A rating</th>
              <th scope="col" className="p-3">Plan B rating</th>
            </tr>
          </thead>
          <tbody>
            <RatingRow label="Evidence strength" field="evidence" weights={weights} planA={planA} planB={planB} setWeights={setWeights} setPlanA={setPlanA} setPlanB={setPlanB} />
            <RatingRow label="Expected task contribution" field="contribution" weights={weights} planA={planA} planB={planB} setWeights={setWeights} setPlanA={setPlanA} setPlanB={setPlanB} />
            <RatingRow label="Recovery margin" field="recovery" weights={weights} planA={planA} planB={planB} setWeights={setWeights} setPlanA={setPlanA} setPlanB={setPlanB} />
          </tbody>
        </table>
      </div>

      <div aria-live="polite" aria-atomic="true" className="mt-6 rounded-lg border border-white/10 bg-obsidian p-4">
        <h4 className="text-sm font-bold uppercase tracking-wider text-ares-gold">Discussion result</h4>
        {result.valid ? (
          <>
            <dl className="mt-4 grid gap-3 sm:grid-cols-2">
              <Score label="Invented Plan A" value={result.planAScore} />
              <Score label="Invented Plan B" value={result.planBScore} />
            </dl>
            <p className="mt-4 border-l-4 border-ares-cyan bg-ares-cyan/10 p-3 text-sm leading-relaxed text-white">{result.explanation}</p>
          </>
        ) : (
          <p role="alert" className="mt-4 border-l-4 border-ares-red bg-ares-red/10 p-3 text-sm text-white">{result.reason}</p>
        )}
      </div>

      <AcademyModelLimit>Ratings and weights are student-entered lesson values. The matrix cannot read scouting or robot data, model game rules, alliance partners, opponents, timing, defense, failure, or uncertainty, optimize a plan, or make a match decision.</AcademyModelLimit>
    </AcademyLabShell>
  );
}

function RatingRow({
  label,
  field,
  weights,
  planA,
  planB,
  setWeights,
  setPlanA,
  setPlanB,
}: {
  label: string;
  field: keyof StrategyRatings;
  weights: StrategyWeights;
  planA: StrategyRatings;
  planB: StrategyRatings;
  setWeights: React.Dispatch<React.SetStateAction<StrategyWeights>>;
  setPlanA: React.Dispatch<React.SetStateAction<StrategyRatings>>;
  setPlanB: React.Dispatch<React.SetStateAction<StrategyRatings>>;
}) {
  return (
    <tr className="border-t border-white/10">
      <th scope="row" className="p-3 font-semibold">{label}</th>
      <td className="p-3"><RatingSelect label={`${label} weight`} value={weights[field]} onChange={(value) => setWeights((current) => ({ ...current, [field]: value }))} /></td>
      <td className="p-3"><RatingSelect label={`${label} Plan A rating`} value={planA[field]} onChange={(value) => setPlanA((current) => ({ ...current, [field]: value }))} /></td>
      <td className="p-3"><RatingSelect label={`${label} Plan B rating`} value={planB[field]} onChange={(value) => setPlanB((current) => ({ ...current, [field]: value }))} /></td>
    </tr>
  );
}

function RatingSelect({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <select aria-label={label} value={value} onChange={(event) => onChange(Number(event.currentTarget.value))} className="min-h-11 min-w-24 rounded border border-white/20 bg-obsidian px-3 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan">
      <option value={0}>0 — none</option>
      <option value={1}>1 — low</option>
      <option value={2}>2 — medium</option>
      <option value={3}>3 — high</option>
    </select>
  );
}

function Score({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-white/10 pb-2">
      <dt className="text-marble/70">{label}</dt>
      <dd className="font-mono text-lg font-bold text-white">{value}</dd>
    </div>
  );
}
