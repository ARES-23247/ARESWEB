import { Link } from "react-router-dom";
import { ArrowRight, BookOpen, Gamepad2 } from "lucide-react";
import SEO from "@/components/SEO";
import { PageHeader } from "@/components/ui/PageHeader";
import { ARCADE_GAMES } from "@/components/navigation/navItems";
import { GamePrintablesLink } from "@/components/games/GamePrintablesLink";

export default function ArcadePage() {
  return (
    <main className="mx-auto w-full max-w-7xl px-5 py-10 sm:px-8 sm:py-16">
      <SEO title="ARES Arcade" description="Play BUZZLE, BUZZELLO, and Pollenator Pile-Up. Explore word games, hexagonal strategy, and physics challenges from ARES 23247." />
      <PageHeader
        eyebrow={<><Gamepad2 aria-hidden="true" size={18} /> Play, think, try again</>}
        title="ARES Arcade"
        description="A word challenge, a battle for the board, or one more critter on the flower. Pick a game and make your next move."
      />
      <section aria-label="Games" className="my-8 grid gap-5 lg:grid-cols-3">
        {ARCADE_GAMES.map(({ label, to, icon: Icon, iconColor, description, modes }) => (
          <article key={to} className="flex min-w-0 flex-col rounded-2xl border border-ares-bronze/30 bg-white/5 p-6 sm:p-8">
            <Icon aria-hidden="true" size={44} className={`${iconColor} mb-6`} />
            <p className="mb-3 text-xs font-semibold leading-relaxed text-ares-gold">{modes}</p>
            <h2 className="font-heading text-2xl font-black text-white">{label}</h2>
            <p className="mb-8 mt-3 text-sm leading-relaxed text-marble/80">{description}</p>
            <div className="mt-auto flex flex-col gap-3 lg:min-h-28">
              <Link to={to} className="inline-flex min-h-11 items-center justify-between gap-3 rounded-lg bg-ares-red px-4 py-3 font-bold text-white transition-colors hover:bg-ares-red/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan focus-visible:ring-offset-4 focus-visible:ring-offset-obsidian">
                Play {label}<ArrowRight aria-hidden="true" size={18} />
              </Link>
              {(label === "BUZZLE" || label === "BUZZELLO") && (
                <GamePrintablesLink game={label} />
              )}
            </div>
          </article>
        ))}
      </section>
      <section aria-labelledby="physical-play-heading" className="flex flex-col gap-5 rounded-2xl border border-ares-gold/30 p-6 sm:p-8 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 id="physical-play-heading" className="flex items-center gap-3 font-heading text-xl font-bold text-white"><BookOpen aria-hidden="true" className="shrink-0 text-ares-gold" size={24} /> Playing BUZZLE on a table?</h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-marble/80">Check legal words, browse the two-letter list, and look up definitions without starting a digital game.</p>
        </div>
        <Link to="/buzzle/word-tools" className="inline-flex min-h-11 shrink-0 items-center justify-center gap-3 rounded-lg border border-ares-gold/50 px-4 py-3 font-bold text-ares-gold hover:bg-ares-gold/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan">BUZZLE Word Tools<ArrowRight aria-hidden="true" size={18} /></Link>
      </section>
    </main>
  );
}
