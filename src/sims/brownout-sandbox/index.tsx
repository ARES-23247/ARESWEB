/** @sim {"name":"Brownout State Sandbox","requiresContext":false,"academyApproved":true,"fidelity":"conceptual"} */
import { useMemo, useState } from "react";
import { RotateCcw } from "lucide-react";

export type BrownoutState = "HEALTHY" | "WARNING" | "CRITICAL";

export type BrownoutConfig = {
  warningVoltage: number;
  criticalVoltage: number;
  minimumScale: number;
  hysteresisVoltage: number;
};

export type BrownoutResult =
  | { valid: false; state: "CRITICAL"; powerScale: 0; reason: string }
  | { valid: true; state: BrownoutState; powerScale: number; reason: string };

export const LESSON_PROFILE: BrownoutConfig = {
  warningVoltage: 10,
  criticalVoltage: 8.2,
  minimumScale: 0.3,
  hysteresisVoltage: 0.4,
};

export function evaluateBrownout(
  previousState: BrownoutState,
  voltage: number,
  config: BrownoutConfig = LESSON_PROFILE,
): BrownoutResult {
  const values = [voltage, config.warningVoltage, config.criticalVoltage, config.minimumScale, config.hysteresisVoltage];
  if (!values.every(Number.isFinite) || voltage < 0) {
    return { valid: false, state: "CRITICAL", powerScale: 0, reason: "Invalid voltage fails closed." };
  }
  if (
    config.criticalVoltage < 0
    || config.warningVoltage <= config.criticalVoltage
    || config.minimumScale < 0
    || config.minimumScale > 1
    || config.hysteresisVoltage < 0
  ) {
    return { valid: false, state: "CRITICAL", powerScale: 0, reason: "Invalid profile fails closed." };
  }

  let state: BrownoutState;
  if (previousState === "HEALTHY") {
    state = voltage <= config.criticalVoltage ? "CRITICAL" : voltage < config.warningVoltage ? "WARNING" : "HEALTHY";
  } else if (previousState === "WARNING") {
    state = voltage <= config.criticalVoltage ? "CRITICAL" : voltage > config.warningVoltage + config.hysteresisVoltage ? "HEALTHY" : "WARNING";
  } else {
    state = voltage > config.criticalVoltage + config.hysteresisVoltage ? "WARNING" : "CRITICAL";
  }

  if (state === "HEALTHY") {
    return { valid: true, state, powerScale: 1, reason: "Voltage is in the healthy zone for this step." };
  }
  if (state === "CRITICAL") {
    return { valid: true, state, powerScale: 0, reason: "The example guard blocks motor output in the critical zone." };
  }

  const ratio = Math.min(1, Math.max(0, (voltage - config.criticalVoltage) / (config.warningVoltage - config.criticalVoltage)));
  const powerScale = config.minimumScale + ratio * (1 - config.minimumScale);
  return { valid: true, state, powerScale, reason: "The example guard scales motor output in the warning zone." };
}

export default function BrownoutSandbox() {
  const [previousState, setPreviousState] = useState<BrownoutState>("HEALTHY");
  const [voltage, setVoltage] = useState(10.5);
  const result = useMemo(() => evaluateBrownout(previousState, voltage), [previousState, voltage]);
  const reset = () => {
    setPreviousState("HEALTHY");
    setVoltage(10.5);
  };

  return (
    <section aria-labelledby="brownout-sandbox-title" className="my-8 rounded-xl border border-ares-cyan/30 bg-black/35 p-4 sm:p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-ares-cyan">Source-pinned concept model</p>
          <h3 id="brownout-sandbox-title" className="mt-1 text-xl font-black text-white">Brownout State Sandbox</h3>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-marble/80">
            Step one voltage sample through the ARES guard pattern. Change the prior state to see why recovery uses hysteresis.
          </p>
        </div>
        <button type="button" onClick={reset} className="mt-2 inline-flex min-h-11 items-center justify-center gap-2 rounded border border-white/20 px-4 py-2 text-sm font-bold text-white hover:border-ares-cyan focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan sm:mt-0">
          <RotateCcw aria-hidden="true" size={16} /> Reset
        </button>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(17rem,0.8fr)]">
        <fieldset className="grid gap-5 rounded-lg border border-white/10 bg-white/5 p-4">
          <legend className="px-2 text-sm font-bold text-ares-gold">Choose one state-machine step</legend>
          <label className="grid gap-2 text-sm font-semibold text-white">
            Previous guard state
            <select value={previousState} onChange={(event) => setPreviousState(event.currentTarget.value as BrownoutState)} className="min-h-11 rounded border border-white/20 bg-obsidian px-3 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan">
              <option value="HEALTHY">Healthy</option>
              <option value="WARNING">Warning</option>
              <option value="CRITICAL">Critical</option>
            </select>
          </label>
          <label htmlFor="brownout-voltage" className="grid gap-2 text-sm font-semibold text-white">
            Example voltage
            <span className="flex items-center gap-2">
              <input id="brownout-voltage" type="number" inputMode="decimal" min={0} max={14} step={0.1} value={voltage} onChange={(event) => setVoltage(event.currentTarget.valueAsNumber)} className="min-h-11 min-w-0 flex-1 rounded border border-white/20 bg-obsidian px-3 font-mono text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan" />
              <span aria-hidden="true" className="text-xs text-marble/70">V</span>
            </span>
          </label>
          <dl className="grid gap-2 rounded border border-white/10 p-3 text-sm">
            <Result label="Warning threshold" value={`${LESSON_PROFILE.warningVoltage.toFixed(1)} V`} />
            <Result label="Critical threshold" value={`${LESSON_PROFILE.criticalVoltage.toFixed(1)} V`} />
            <Result label="Recovery band" value={`${LESSON_PROFILE.hysteresisVoltage.toFixed(1)} V`} />
          </dl>
        </fieldset>

        <div aria-live="polite" aria-atomic="true" className="rounded-lg border border-white/10 bg-obsidian p-4">
          <h4 className="text-sm font-bold uppercase tracking-wider text-ares-gold">One-step result</h4>
          <dl className="mt-4 grid gap-4">
            <Result label="Next guard state" value={result.state} />
            <Result label="Example motor power scale" value={`${(result.powerScale * 100).toFixed(0)}%`} />
          </dl>
          <p className={`mt-5 border-l-4 p-3 text-sm ${result.valid ? "border-ares-cyan bg-ares-cyan/10 text-white" : "border-ares-red bg-ares-red/10 text-white"}`}>{result.reason}</p>
        </div>
      </div>

      <p role="note" className="mt-5 border-l-4 border-ares-gold/60 bg-ares-gold/10 p-3 text-sm leading-relaxed text-white">
        <strong>Model limit:</strong> The displayed thresholds are a source-pinned ARES example profile, not current league rules or component ratings. This one-step model does not read a battery, estimate current, simulate internal resistance, size a breaker or fuse, command motors, or prove protection on a robot.
      </p>
    </section>
  );
}

function Result({ label, value }: { label: string; value: string }) {
  return <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-3 border-b border-white/10 pb-2"><dt className="text-sm text-marble/70">{label}</dt><dd className="text-right font-mono font-bold text-white">{value}</dd></div>;
}
