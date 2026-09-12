import { useId, useState } from "react";
import { Calculator, Flower2, RotateCcw } from "lucide-react";
import SEO from "@/components/SEO";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  ALLIANCES, COUNT_FIELDS, STANDARD_THRESHOLDS, emptyMatch, scoreFlower,
  scoreMatch, validCount, validThresholds, validateMatch,
  type Alliance, type CountField, type Element, type Thresholds,
} from "@/lib/biobuzzScoring";

const control = "min-h-11 rounded-lg border border-marble/40 bg-obsidian px-3 py-2 text-marble focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-gold";
const button = `${control} font-semibold hover:bg-white/10 disabled:opacity-50`;
const panel = "min-w-0 rounded-2xl border border-white/20 bg-white/5 p-5 sm:p-6";
const names = { red: "Red", blue: "Blue", pollen: "Pollen" };
const elementStyle = { red: "border-ares-red-light text-ares-red-light", blue: "border-ares-cyan text-ares-cyan", pollen: "border-ares-gold text-ares-gold" };
const groups: { title: string; fields: CountField[]; note: string }[] = [
  { title: "AUTO", fields: ["leave", "autoPark", "autoTips"], note: "Assess LEAVE and PARK at the end of AUTO. Count tips completed before TELEOP here." },
  { title: "TELEOP & final field", fields: ["teleopTips", "cell", "garden", "teleopPark"], note: "Enter additional TELEOP tips. Count final elements after the field comes to rest." },
  { title: "Fouls committed", fields: ["minorFouls", "majorFouls"], note: "These points go to the opposing alliance." },
];

function NumberField({ label, value, max, onChange, hint }: { label: string; value: number; max: number; onChange: (value: number) => void; hint?: string }) {
  const id = useId();
  const valid = validCount(value, max);
  return <div className="flex flex-wrap items-center justify-between gap-3 py-2">
    <div className="min-w-0 flex-1">
      <label htmlFor={id} className="block text-sm font-semibold text-marble">{label}</label>
      {hint && <span id={`${id}-hint`} className="mt-1 block text-xs text-marble/80">{hint}</span>}
      {!valid && <span id={`${id}-error`} className="mt-1 block text-xs text-ares-red-light">Enter a whole number from 0 to {max}.</span>}
    </div>
    <input id={id} type="number" inputMode="numeric" min={0} max={max} step={1} required
      value={Number.isNaN(value) ? "" : value} onChange={event => onChange(event.target.valueAsNumber)}
      aria-invalid={!valid} aria-describedby={[hint && `${id}-hint`, !valid && `${id}-error`].filter(Boolean).join(" ") || undefined}
      className={`${control} w-24 shrink-0 text-center font-bold tabular-nums`} />
  </div>;
}

export default function BiobuzzScoreCalculatorPage() {
  const [match, setMatch] = useState(emptyMatch);
  const [previousMatch, setPreviousMatch] = useState<ReturnType<typeof emptyMatch> | null>(null);
  const [eventType, setEventType] = useState("standard");
  const [matchType, setMatchType] = useState("qualification");
  const [custom, setCustom] = useState<Thresholds>({ swarm: NaN, pollinator1: NaN, pollinator2: NaN });
  const errors = validateMatch(match);
  const thresholds = eventType === "standard" ? STANDARD_THRESHOLDS : eventType === "custom" && validThresholds(custom) ? custom : null;
  const score = errors.length ? null : scoreMatch(match, thresholds);
  const showRP = matchType === "qualification";

  function updateCount(color: Alliance, field: CountField, value: number) {
    setMatch(current => ({ ...current, [color]: { ...current[color], [field]: value } }));
  }
  function updateFlower(index: number, elements: Element[]) {
    setMatch(current => ({ ...current, flowers: current.flowers.map((stack, i) => i === index ? elements : stack) }));
  }

  return <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-8 sm:py-14">
    <SEO title="BIOBUZZ Score Calculator" description="Calculate BIOBUZZ alliance scores, FLOWER ownership, penalties, and ranking points using the 2026–2027 Competition Manual V1." url="/biobuzz/score-calculator" />
    <PageHeader eyebrow={<><Calculator size={18} aria-hidden="true" /> 2026–2027 · Manual V1</>}
      title={<>BIOBUZZ<br /><span className="text-ares-gold">Score calculator</span></>}
      description="Build a practice match, place the final FLOWER stacks, and see both alliances’ scores update as you go."
      actions={<>
        {previousMatch && <button type="button" className={button} onClick={() => { setMatch(previousMatch); setPreviousMatch(null); }}>Undo reset</button>}
        <button type="button" className={`${button} inline-flex items-center gap-2`} onClick={() => { setPreviousMatch(match); setMatch(emptyMatch()); }}><RotateCcw size={16} aria-hidden="true" />Reset match</button>
      </>} />

    <section aria-label="Match score" className="my-7">
      <div className="grid grid-cols-2 gap-3 sm:gap-5" aria-live="polite" aria-atomic="true">
        {ALLIANCES.map(color => <div key={color} className={`${panel} border-t-4 ${color === "red" ? "border-t-ares-red-light" : "border-t-ares-cyan"}`}>
          <h2 className={`font-heading text-lg font-bold ${color === "red" ? "text-ares-red-light" : "text-ares-cyan"}`}>{names[color]} alliance</h2>
          <p className={`my-2 font-heading font-black tabular-nums text-white ${score && score[color].total > 999 ? "text-2xl sm:text-5xl" : "text-5xl sm:text-7xl"}`} aria-label={`${names[color]} score: ${score ? score[color].total : "incomplete"}`}>{score ? score[color].total : "—"}</p>
          <p className="text-xs text-marble/80">MATCH POINTS</p>
          {showRP && <p className="mt-3 text-sm font-semibold text-ares-gold">{score?.[color].totalRP ?? "—"} / 6 RP{!thresholds && " · thresholds needed"}</p>}
        </div>)}
      </div>
      <p className="mt-3 text-center text-sm text-marble/80">{score ? score.winner === "tie" ? "Scores are tied." : `${names[score.winner]} leads by ${Math.abs(score.red.total - score.blue.total)} points.` : "Complete the highlighted fields to calculate the match."}</p>
    </section>

    <div className="mb-7 flex flex-wrap gap-5">
      <div className="flex flex-col gap-2 text-sm font-semibold text-marble"><label htmlFor="biobuzz-match-type">Match type</label>
        <select id="biobuzz-match-type" className={control} value={matchType} onChange={event => setMatchType(event.target.value)}>
          <option value="qualification">Qualification · includes RP</option><option value="playoff">Playoff · points only</option>
        </select>
      </div>
      {showRP && <div className="flex min-w-0 flex-col gap-2 text-sm font-semibold text-marble"><label htmlFor="biobuzz-event-type">RP thresholds</label>
        <select id="biobuzz-event-type" className={`${control} max-w-full`} value={eventType} onChange={event => setEventType(event.target.value)}>
          <option value="standard">V1 · all other events</option><option value="championship">Championship · TBA in V1</option><option value="custom">Custom / Premier event</option>
        </select>
      </div>}
    </div>
    {showRP && eventType === "championship" && <p className="mb-6 rounded-lg border border-ares-gold/50 p-4 text-sm text-ares-gold">Regional and FIRST Championship thresholds are TBA in V1. Select Custom and enter your event’s announced values to calculate bonus RP.</p>}
    {showRP && eventType === "custom" && <fieldset className={`${panel} mb-6`}>
      <legend className="px-2 font-bold text-marble">Event thresholds</legend>
      <div className="grid gap-5 md:grid-cols-3">
        {([ ["swarm", "SWARM points"], ["pollinator1", "POLLINATOR 1 tips"], ["pollinator2", "POLLINATOR 2 tips"] ] as const).map(([key, label]) =>
          <NumberField key={key} label={label} value={custom[key]} max={9999} onChange={value => setCustom(current => ({ ...current, [key]: value }))} />)}
      </div>
      {!validThresholds(custom) && <p className="mt-3 text-sm text-ares-gold">Use positive whole numbers. POLLINATOR 2 must be at least POLLINATOR 1. RP remains unavailable until these values are complete.</p>}
    </fieldset>}

    {errors.length > 0 && <div role="alert" className="mb-6 rounded-xl border border-ares-red-light p-4 text-sm text-ares-red-light"><p className="font-bold">Check the match entries</p><ul className="mt-2 list-disc space-y-1 pl-5">{errors.map(error => <li key={error}>{error}</li>)}</ul></div>}

    <div className="grid gap-5 lg:grid-cols-2">
      {ALLIANCES.map(color => <section key={color} aria-label={`${names[color]} scoring`} className={panel}>
        <h2 className={`mb-5 font-heading text-2xl font-bold ${color === "red" ? "text-ares-red-light" : "text-ares-cyan"}`}>{names[color]} alliance entries</h2>
        {groups.map(group => <fieldset key={group.title} className="mb-5 border-t border-white/20 pt-3 last:mb-0">
          <legend className="pr-3 text-xs font-bold uppercase tracking-widest text-ares-gold">{group.title}</legend>
          <p className="mb-2 text-xs leading-relaxed text-marble/80">{group.note}</p>
          {group.fields.map(field => <NumberField key={field} label={COUNT_FIELDS[field].label} value={match[color][field]} max={COUNT_FIELDS[field].max}
            hint={`${COUNT_FIELDS[field].points} points each${field.endsWith("Fouls") ? " → opponent" : ""}`} onChange={value => updateCount(color, field, value)} />)}
        </fieldset>)}
      </section>)}
    </div>

    <section aria-labelledby="flowers-heading" className="mt-8">
      <h2 id="flowers-heading" className="flex items-center gap-3 font-heading text-2xl font-bold text-white"><Flower2 className="text-ares-gold" aria-hidden="true" /> Shared FLOWERS</h2>
      <p className="mb-5 mt-2 max-w-3xl text-sm leading-relaxed text-marble/80">Add only elements at least partially between the top and middle rings, in order from bottom to top. The top-most NECTAR owns all elements (2 points each); the bottom-most NECTAR earns a separate 5-point bonus. POLLEN alone has no owner.</p>
      <div className="grid gap-5 md:grid-cols-2">
        {match.flowers.map((stack, index) => {
          const flower = scoreFlower(stack);
          return <section key={index} aria-label={`Flower ${index + 1}`} className={panel}>
            <div className="mb-4 flex items-center justify-between gap-3"><h3 className="font-heading text-lg font-bold text-white">FLOWER {index + 1}</h3><span className="text-xs text-marble/80">{stack.length} elements</span></div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-marble/80">Bottom → top</p>
            {stack.length ? <ol className="mb-4 flex flex-wrap gap-2" aria-label="Scoring elements, bottom to top">
              {stack.map((element, position) => <li key={position}><button type="button" className={`${button} ${elementStyle[element]} text-sm`} aria-label={`Remove ${names[element]} at position ${position + 1}`} onClick={() => updateFlower(index, stack.filter((_, i) => i !== position))}>{position + 1}. {names[element]} <span aria-hidden="true">×</span></button></li>)}
            </ol> : <p className="mb-4 rounded-lg border border-dashed border-white/30 p-4 text-sm text-marble/80">No scoring elements entered.</p>}
            <div className="flex flex-wrap gap-2">
              {(["pollen", "red", "blue"] as const).map(element => <button type="button" key={element} className={`${button} text-sm ${elementStyle[element]}`} disabled={stack.length >= 56} onClick={() => updateFlower(index, [...stack, element])}>+ {names[element]}{element !== "pollen" && " nectar"}</button>)}
            </div>
            <p className="mt-4 text-sm leading-relaxed text-marble" aria-live="polite">Owner: <strong>{flower.owner ? names[flower.owner] : "None"}</strong> · {flower.points} points<br />Bottom bonus: <strong>{flower.bottom ? `${names[flower.bottom]} +5` : "None"}</strong></p>
          </section>;
        })}
      </div>
    </section>

    <section aria-labelledby="breakdown-heading" className={`${panel} mt-8`}>
      <h2 id="breakdown-heading" className="mb-4 font-heading text-2xl font-bold text-white">Score breakdown</h2>
      <div className="overflow-x-auto"><table className="w-full text-left text-sm text-marble">
        <caption className="sr-only">Match points and ranking points by alliance</caption>
        <thead><tr className="border-b border-white/20"><th scope="col" className="py-3">Achievement</th><th scope="col" className="px-3 py-3 text-right text-ares-red-light">Red</th><th scope="col" className="py-3 text-right text-ares-cyan">Blue</th></tr></thead>
        <tbody>
          {([ ["AUTO", "auto"], ["TELEOP & final field", "teleop"], ["↳ Owned FLOWER elements", "flowerElements"], ["↳ Bottom NECTAR bonuses", "flowerBonus"], ["Points from opponent fouls", "penalties"], ["Total match points", "total"] ] as const).map(([label, key]) =>
            <tr key={key} className="border-b border-white/10"><th scope="row" className="py-3 font-normal">{label}</th>{ALLIANCES.map(color => <td key={color} className="px-1 py-3 text-right tabular-nums sm:px-3">{score?.[color][key] ?? "—"}</td>)}</tr>)}
          {showRP && <>
            {([ ["swarm", "SWARM", thresholds?.swarm, "movement", "points"], ["pollinator1", "POLLINATOR 1", thresholds?.pollinator1, "tips", "tips"], ["pollinator2", "POLLINATOR 2", thresholds?.pollinator2, "tips", "tips"] ] as const).map(([key, label, target, metric, unit]) => <tr key={key} className="border-b border-white/10"><th scope="row" className="py-3 font-normal">{label}<span className="block text-xs text-marble/80">{target ?? "TBA"} {unit} · 1 RP</span></th>{ALLIANCES.map(color => <td key={color} className="px-1 py-3 text-right text-xs sm:px-3">{score?.[color].achievements ? `${score[color].achievements[key] ? "Earned" : "Not earned"} (${score[color][metric]}/${target})` : "—"}</td>)}</tr>)}
            <tr className="border-b border-white/10"><th scope="row" className="py-3 font-normal">Result RP <span className="block text-xs text-marble/80">Win 3 · Tie 1 · Loss 0</span></th>{ALLIANCES.map(color => <td key={color} className="px-3 text-right">{score?.[color].resultRP ?? "—"}</td>)}</tr>
            <tr><th scope="row" className="py-3">Total RP</th>{ALLIANCES.map(color => <td key={color} className="px-3 text-right font-bold text-ares-gold">{score?.[color].totalRP ?? "—"}</td>)}</tr>
          </>}
        </tbody>
      </table></div>
    </section>
    <details className={`${panel} mt-6 text-sm leading-relaxed text-marble/80`}>
      <summary className="min-h-11 cursor-pointer py-3 font-bold text-marble focus-visible:outline-2 focus-visible:outline-ares-gold">Scoring notes & manual reference</summary>
      <ul className="list-disc space-y-2 pl-5">
        <li>Based on BIOBUZZ Competition Manual V1, sections 10.5–10.6, pages 86–93; point values and RP thresholds are on page 91.</li>
        <li>LEAVE means no longer touching the perimeter wall. PARK means at least partly in the LOADING ZONE. AUTO and TELEOP PARK score separately and both count toward SWARM.</li>
        <li>Count HIVE elements only in the upward-facing CELL. GARDEN elements score for the GARDEN’s alliance regardless of element color.</li>
        <li>Enter the final FLOWER scoring volume, not its entire physical stack. FLOWER timing violations require referee-assessed fouls; this calculator does not infer them.</li>
        <li>V1 provides 40 POLLEN and 8 NECTAR per alliance. Elements outside scoring locations need not be entered. Do not count an element twice.</li>
        <li>Practice estimate, not an official result. Cards, disqualifications, and referee adjustments are not modeled. RP applies to eligible qualification teams; it does not apply in playoffs.</li>
        <li>Entries stay on this page and reset when you reload or leave. Check Team Updates for changes after V1.</li>
      </ul>
    </details>
  </div>;
}
