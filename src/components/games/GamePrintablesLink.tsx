import { ExternalLink } from "lucide-react";

const PRINTABLES_URLS = {
  BUZZLE: "https://www.printables.com/model/1834054-buzzle-biobuzz-hex-word-game-board-individual-tile",
  BUZZELLO: "https://www.printables.com/model/1834053-buzzello-biobuzz-hex-strategy-board-reversible-pie",
} as const;

export function GamePrintablesLink({ game }: { game: keyof typeof PRINTABLES_URLS }) {
  return (
    <a
      href={PRINTABLES_URLS[game]}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex min-h-11 items-center gap-2 rounded-md px-1 py-2 text-sm font-semibold text-ares-gold underline decoration-ares-gold/50 underline-offset-4 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
    >
      3D print {game} on Printables
      <ExternalLink aria-hidden="true" size={16} className="shrink-0" />
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}
