/** @sim {"name":"Wiring Plan Diagnostic Lab","requiresContext":false,"academyApproved":true,"fidelity":"conceptual"} */
import { useMemo, useState } from "react";
import { RotateCcw } from "lucide-react";

export type WiringReview = {
  sourceIsolated: boolean;
  identityMatches: boolean;
  polarityRecorded: boolean;
  connectionPlanRecorded: boolean;
  routingAndReliefRecorded: boolean;
  protectionSourceRecorded: boolean;
};

export type WiringReviewResult =
  | { ready: true; title: string; nextAction: string }
  | { ready: false; title: string; nextAction: string; missingKey: keyof WiringReview };

export const EMPTY_WIRING_REVIEW: WiringReview = {
  sourceIsolated: false,
  identityMatches: false,
  polarityRecorded: false,
  connectionPlanRecorded: false,
  routingAndReliefRecorded: false,
  protectionSourceRecorded: false,
};

const CHECKS: Array<{ key: keyof WiringReview; label: string; action: string }> = [
  { key: "sourceIsolated", label: "The plan begins with the energy source isolated.", action: "Record how the energy source stays isolated during the paper review." },
  { key: "identityMatches", label: "Device identity matches the canonical inventory.", action: "Match the device name, connection type, bus or parent, and address or channel." },
  { key: "polarityRecorded", label: "Polarity or direction-sensitive pins are recorded.", action: "Mark positive, negative, signal, and direction-sensitive pins from approved sources." },
  { key: "connectionPlanRecorded", label: "The connector and termination plan has a source.", action: "Record the exact connector or termination and the source that defines its use." },
  { key: "routingAndReliefRecorded", label: "Routing, movement, and strain-relief needs are recorded.", action: "Mark moving zones, pinch or sharp-edge risks, service loops, support, and strain relief." },
  { key: "protectionSourceRecorded", label: "Protection and current-limit choices point to current sources.", action: "Attach the current league and component sources before choosing protection or conductor ratings." },
];

export function reviewWiringPlan(review: WiringReview): WiringReviewResult {
  const firstMissing = CHECKS.find((check) => !review[check.key]);
  if (firstMissing) {
    return {
      ready: false,
      title: `Plan blocked at: ${firstMissing.label}`,
      nextAction: firstMissing.action,
      missingKey: firstMissing.key,
    };
  }
  return {
    ready: true,
    title: "The paper plan contains every lesson check.",
    nextAction: "Preserve the record for team review. It still needs authentic inspection and physical evidence.",
  };
}

export default function WiringDiagnosticLab() {
  const [review, setReview] = useState<WiringReview>({ ...EMPTY_WIRING_REVIEW });
  const result = useMemo(() => reviewWiringPlan(review), [review]);
  const reset = () => setReview({ ...EMPTY_WIRING_REVIEW });

  return (
    <section aria-labelledby="wiring-diagnostic-title" className="my-8 rounded-xl border border-ares-cyan/30 bg-black/35 p-4 sm:p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-ares-cyan">Paper-plan checklist</p>
          <h3 id="wiring-diagnostic-title" className="mt-1 text-xl font-black text-white">Wiring Plan Diagnostic Lab</h3>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-marble/80">
            Build an ordered evidence record for one invented connection. The first missing check becomes the next paper task.
          </p>
        </div>
        <button type="button" onClick={reset} className="mt-2 inline-flex min-h-11 items-center justify-center gap-2 rounded border border-white/20 px-4 py-2 text-sm font-bold text-white hover:border-ares-cyan focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan sm:mt-0">
          <RotateCcw aria-hidden="true" size={16} /> Reset
        </button>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(17rem,0.8fr)]">
        <fieldset className="grid gap-3 rounded-lg border border-white/10 bg-white/5 p-4">
          <legend className="px-2 text-sm font-bold text-ares-gold">Self-reported plan evidence</legend>
          {CHECKS.map((check) => (
            <label key={check.key} className="flex min-h-11 items-start gap-3 rounded border border-white/10 p-3 text-sm leading-relaxed text-white">
              <input
                type="checkbox"
                checked={review[check.key]}
                onChange={(event) => {
                  const checked = event.currentTarget.checked;
                  setReview((current) => ({ ...current, [check.key]: checked }));
                }}
                className="mt-0.5 size-5 shrink-0 accent-ares-red"
              />
              <span>{check.label}</span>
            </label>
          ))}
        </fieldset>

        <div aria-live="polite" aria-atomic="true" className="rounded-lg border border-white/10 bg-obsidian p-4">
          <h4 className="text-sm font-bold uppercase tracking-wider text-ares-gold">Next diagnostic step</h4>
          <p className={`mt-4 border-l-4 p-3 text-sm font-bold ${result.ready ? "border-emerald-400 bg-emerald-400/10 text-emerald-100" : "border-ares-red bg-ares-red/10 text-white"}`}>{result.title}</p>
          <p className="mt-4 text-sm leading-relaxed text-marble/80">{result.nextAction}</p>
        </div>
      </div>

      <p role="note" className="mt-5 border-l-4 border-ares-gold/60 bg-ares-gold/10 p-3 text-sm leading-relaxed text-white">
        <strong>Evidence limit:</strong> Every box is self-reported. This lab cannot inspect a wire, identify a connector, verify polarity, find damage, measure continuity, choose a conductor or protection rating, energize a circuit, or prove that a robot is wired correctly.
      </p>
    </section>
  );
}
