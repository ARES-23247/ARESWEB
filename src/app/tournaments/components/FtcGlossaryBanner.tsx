import { useState } from "react";
import { ChevronDown, ChevronUp, HelpCircle } from "lucide-react";

const GLOSSARY_ITEMS = [
  {
    term: "2v2 Alliances",
    definition:
      "Each match pairs two teams on the Red Alliance against two teams on the Blue Alliance. Qualification partners rotate randomly; Playoff alliances are drafted by top-seeded captains.",
  },
  {
    term: "Match Phases (2:30)",
    definition:
      "Every match begins with a 30-second Autonomous period (100% pre-programmed code & sensors), followed by a 2-minute driver-controlled TeleOp period that concludes with Endgame tasks.",
  },
  {
    term: "RP (Ranking Points)",
    definition:
      "Earned during Qualification matches for match wins/ties and achieving season-specific alliance bonus thresholds. Total RP determines tournament rankings.",
  },
  {
    term: "OPR (Offensive Power Rating)",
    definition:
      "A linear-algebra statistic estimating how many points an individual robot contributes on average to its 2-team alliance score per match.",
  },
] as const;

export default function FtcGlossaryBanner() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <section
      aria-labelledby="ftc-glossary-heading"
      className="my-6 rounded-xl border border-ares-gold/30 bg-black/40 p-4 sm:p-5 text-left"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <HelpCircle
            size={18}
            className="text-ares-gold shrink-0"
            aria-hidden="true"
          />
          <div>
            <h2
              id="ftc-glossary-heading"
              className="font-heading text-sm font-black uppercase tracking-tight text-white"
            >
              New to FIRST Tech Challenge? Match &amp; Scoring Guide
            </h2>
            <p className="text-xs text-marble/70">
              Plain-English explanations of alliances, match phases, Ranking Points (RP), and OPR.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          aria-expanded={isOpen}
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-ares-gold transition-colors hover:border-ares-gold/40 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan cursor-pointer"
        >
          {isOpen ? (
            <>
              Hide guide <ChevronUp size={14} aria-hidden="true" />
            </>
          ) : (
            <>
              Explain terms <ChevronDown size={14} aria-hidden="true" />
            </>
          )}
        </button>
      </div>

      {isOpen && (
        <dl className="mt-4 grid grid-cols-1 gap-3 border-t border-white/10 pt-4 sm:grid-cols-2 lg:grid-cols-4">
          {GLOSSARY_ITEMS.map(({ term, definition }) => (
            <div
              key={term}
              className="rounded-lg border border-white/10 bg-white/5 p-3.5"
            >
              <dt className="font-heading text-xs font-black uppercase tracking-wider text-ares-gold">
                {term}
              </dt>
              <dd className="mt-1.5 text-xs leading-relaxed text-marble/80">
                {definition}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}
