/** @sim {"name":"Superstructure State Coordination Lab","requiresContext":false,"academyApproved":true,"fidelity":"conceptual"} */
import { useMemo, useState } from "react";
import { RotateCcw, StepForward } from "lucide-react";
import { AcademyDatum } from "@/sims/shared/academy-interaction-ui";

export type Posture = "STOWED" | "CLEARANCE" | "SCORE";
export type RequestedPosture = "STOWED" | "SCORE";
export type SuperstructureTick = { next: Posture; reason: string; targets: string };

export function evaluateSuperstructureTick(
  current: Posture,
  requested: RequestedPosture,
  robotDisabled: boolean,
  portsHealthy: boolean,
  clearanceReady: boolean,
): SuperstructureTick {
  if (robotDisabled) return { next: "STOWED", reason: "Disabled policy runs first", targets: "Elevator 0; pivot 0" };
  if (!portsHealthy) return { next: "STOWED", reason: "Cached-port health fallback runs before motion", targets: "Elevator 0; pivot 0" };
  if (requested === "STOWED") return { next: "STOWED", reason: "Explicit stow request", targets: "Elevator 0; pivot 0" };
  if (current === "STOWED") return { next: "CLEARANCE", reason: "Enter a transient clearance posture", targets: "Elevator 0; pivot 0.25" };
  if (current === "CLEARANCE" && !clearanceReady) return { next: "CLEARANCE", reason: "Measured guard is not ready", targets: "Elevator 0; pivot 0.25" };
  return { next: "SCORE", reason: "Healthy measured guard allows the score posture", targets: "Elevator 0.8; pivot 0.75" };
}

const DEFAULTS = { posture: "STOWED" as Posture, request: "SCORE" as RequestedPosture, disabled: false, healthy: true, clearance: false };

export default function SuperstructureStateLab() {
  const [posture, setPosture] = useState<Posture>(DEFAULTS.posture);
  const [request, setRequest] = useState<RequestedPosture>(DEFAULTS.request);
  const [disabled, setDisabled] = useState(DEFAULTS.disabled);
  const [healthy, setHealthy] = useState(DEFAULTS.healthy);
  const [clearance, setClearance] = useState(DEFAULTS.clearance);
  const decision = useMemo(
    () => evaluateSuperstructureTick(posture, request, disabled, healthy, clearance),
    [posture, request, disabled, healthy, clearance],
  );
  const reset = () => {
    setPosture(DEFAULTS.posture);
    setRequest(DEFAULTS.request);
    setDisabled(DEFAULTS.disabled);
    setHealthy(DEFAULTS.healthy);
    setClearance(DEFAULTS.clearance);
  };

  return (
    <section aria-labelledby="superstructure-lab-title" className="my-8 rounded-xl border border-ares-cyan/30 bg-black/35 p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div><p className="text-xs font-bold uppercase tracking-widest text-ares-cyan">Ordered state model</p><h3 id="superstructure-lab-title" className="mt-1 text-xl font-black text-white">Superstructure State Coordination Lab</h3><p className="mt-2 max-w-3xl text-sm leading-relaxed text-marble/80">Evaluate one invented coordinator tick at a time and observe which guard wins.</p></div>
        <button type="button" onClick={reset} className="inline-flex min-h-11 items-center justify-center gap-2 rounded border border-white/20 px-4 py-2 text-sm font-bold text-white hover:border-ares-cyan focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"><RotateCcw aria-hidden="true" size={16} /> Reset</button>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <fieldset className="grid gap-4 rounded-lg border border-white/10 bg-white/5 p-4">
          <legend className="px-2 text-sm font-bold text-ares-gold">One cached frame</legend>
          <label className="grid gap-2 text-sm font-bold text-white" htmlFor="posture-request"><span>Requested posture</span><select id="posture-request" value={request} onChange={(event) => setRequest(event.currentTarget.value as RequestedPosture)} className="min-h-11 rounded border border-white/20 bg-black px-3 py-2 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"><option value="SCORE">Score</option><option value="STOWED">Stow</option></select></label>
          <Toggle label="Robot is disabled" checked={disabled} onChange={setDisabled} />
          <Toggle label="Cached ports are healthy" checked={healthy} onChange={setHealthy} />
          <Toggle label="Measured clearance guard is ready" checked={clearance} onChange={setClearance} />
          <button type="button" onClick={() => setPosture(decision.next)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded bg-ares-red px-4 py-2 text-sm font-black text-white hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"><StepForward aria-hidden="true" size={18} /> Evaluate next tick</button>
        </fieldset>

        <div className="rounded-lg border border-white/10 bg-obsidian p-4">
          <h4 className="text-sm font-bold uppercase tracking-wider text-ares-gold">Next decision</h4>
          <dl aria-live="polite" aria-atomic="true" className="mt-4 grid gap-3 sm:grid-cols-2">
            <Datum label="Current posture" value={posture} />
            <Datum label="Next posture" value={decision.next} />
            <Datum label="Reason" value={decision.reason} wide />
            <Datum label="Complete target preset" value={decision.targets} wide />
          </dl>
        </div>
      </div>

      <details className="mt-5 rounded border border-white/10 bg-white/5 p-3 text-sm text-white"><summary className="min-h-11 cursor-pointer font-bold text-ares-cyan">Open the simplified evaluation order</summary><ol className="mt-3 list-decimal space-y-2 pl-6 text-marble/80"><li>Apply the disabled policy.</li><li>Check cached-port health.</li><li>Read one pending request.</li><li>Wait for the measured clearance guard.</li><li>Resolve a complete target preset.</li></ol></details>

      <p role="note" className="mt-5 border-l-4 border-ares-gold/60 bg-ares-gold/10 p-3 text-sm leading-relaxed text-white"><strong>Model limit:</strong> This invented three-posture model is not an ARES document parser or runtime. It does not bind real subsystem fields, preflight tasks, dispatch actions, model time or debounce, check physical clearance, run hardware, or prove safe motion.</p>
    </section>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded border border-white/10 p-3 text-sm font-bold text-white"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.currentTarget.checked)} className="h-5 w-5 accent-ares-red" /> {label}</label>;
}

const Datum = AcademyDatum;
