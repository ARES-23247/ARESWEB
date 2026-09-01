import * as Dialog from "@radix-ui/react-dialog";
import { Printer, X } from "lucide-react";
import { formatDateOnly } from "@/lib/dateOnly";
import { summarizeTournamentMatches } from "@/lib/tournamentStats";
import type { TournamentMatch } from "@/types/tournament";

interface TournamentMatchPrintDialogProps {
  tournamentName: string;
  tournamentDate: string;
  tournamentLocation: string;
  seasonName?: string | null;
  challengeName?: string | null;
  matches: readonly TournamentMatch[];
}

export default function TournamentMatchPrintDialog({
  tournamentName,
  tournamentDate,
  tournamentLocation,
  seasonName,
  challengeName,
  matches,
}: TournamentMatchPrintDialogProps) {
  const summary = summarizeTournamentMatches(matches);
  const formattedDate = formatDateOnly(
    tournamentDate,
    { month: "long", day: "numeric", year: "numeric" },
    tournamentDate,
  );

  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <button
          type="button"
          className="flex items-center gap-1 rounded border border-white/15 bg-white/5 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-white transition-colors hover:border-ares-gold hover:text-ares-gold focus-visible:ring-2 focus-visible:ring-ares-cyan"
        >
          <Printer size={12} aria-hidden="true" />
          Print plan
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[80] bg-black/85 backdrop-blur-sm print:hidden" />
        <Dialog.Content className="tournament-match-print fixed left-1/2 top-1/2 z-[81] flex max-h-[92vh] w-[calc(100%-2rem)] max-w-5xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border border-white/15 bg-obsidian text-marble shadow-2xl focus:outline-none print:static print:max-h-none print:w-full print:max-w-none print:translate-x-0 print:translate-y-0 print:overflow-visible print:border-none print:bg-white print:text-black print:shadow-none">
          <header className="flex items-start justify-between gap-4 border-b border-white/10 bg-zinc-900/60 px-5 py-4 print:hidden">
            <div>
              <Dialog.Title className="font-heading text-lg font-black uppercase tracking-wide text-white">
                Event-day match plan
              </Dialog.Title>
              <Dialog.Description className="mt-1 max-w-2xl text-xs leading-relaxed text-marble/65">
                Review the complete saved checklist before printing or saving a
                PDF. Scouting notes remain in this local printout.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Close match plan"
                className="rounded-lg p-2 text-marble/70 transition-colors hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-ares-cyan"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </Dialog.Close>
          </header>

          <div className="flex-1 overflow-auto p-5 sm:p-7 print:overflow-visible print:p-0">
            <section
              aria-labelledby="match-plan-print-title"
              className="space-y-5"
            >
              <div className="border-b border-white/10 pb-4 print:border-black/25">
                <p className="text-xs font-extrabold uppercase tracking-widest text-ares-gold print:text-black">
                  FIRST® Tech Challenge Team 23247
                </p>
                <h2
                  id="match-plan-print-title"
                  className="mt-1 font-heading text-2xl font-black uppercase tracking-tight text-white print:text-black"
                >
                  {tournamentName}
                </h2>
                <p className="mt-1 text-sm text-marble/70 print:text-gray-700">
                  {formattedDate} · {tournamentLocation}
                </p>
                {(seasonName || challengeName) && (
                  <p className="mt-1 text-xs text-marble/55 print:text-gray-600">
                    {[seasonName, challengeName].filter(Boolean).join(" · ")}
                  </p>
                )}
              </div>

              <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4 print:grid-cols-4">
                {[
                  ["Checklist", `${summary.completed}/${summary.total}`],
                  ["Pending", summary.pending],
                  [
                    "Record",
                    summary.recordedOutcomes > 0
                      ? `${summary.wins}-${summary.losses}-${summary.ties}`
                      : "Not recorded",
                  ],
                  ["Average score", summary.averageScore ?? "Not recorded"],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="rounded-lg border border-white/10 bg-white/5 p-3 print:border-gray-300 print:bg-gray-50"
                  >
                    <dt className="text-[10px] font-bold uppercase tracking-wider text-marble/60 print:text-gray-600">
                      {label}
                    </dt>
                    <dd className="mt-1 text-lg font-black text-white print:text-black">
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>

              <div className="overflow-x-auto print:overflow-visible">
                <table className="w-full border-collapse text-left text-xs print:text-[9pt]">
                  <caption className="sr-only">
                    Complete saved match plan for {tournamentName}
                  </caption>
                  <thead>
                    <tr className="border-b border-white/20 text-[10px] uppercase tracking-wider text-marble/65 print:border-black print:text-black">
                      <th scope="col" className="px-2 py-2">
                        Match
                      </th>
                      <th scope="col" className="px-2 py-2">
                        Status
                      </th>
                      <th scope="col" className="px-2 py-2">
                        Alliance
                      </th>
                      <th scope="col" className="px-2 py-2">
                        Partner
                      </th>
                      <th scope="col" className="px-2 py-2">
                        Opponents
                      </th>
                      <th scope="col" className="px-2 py-2">
                        Result
                      </th>
                      <th scope="col" className="px-2 py-2">
                        Score
                      </th>
                      <th scope="col" className="px-2 py-2">
                        Notes
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {matches.map((match) => (
                      <tr
                        key={match.id}
                        className="break-inside-avoid border-b border-white/10 align-top print:border-gray-300"
                      >
                        <th
                          scope="row"
                          className="px-2 py-2 font-bold text-white print:text-black"
                        >
                          {match.matchNumber}
                        </th>
                        <td className="px-2 py-2 text-marble/70 print:text-black">
                          {match.completed ? "Complete" : "Pending"}
                        </td>
                        <td className="px-2 py-2 capitalize text-marble/70 print:text-black">
                          {match.alliance}
                        </td>
                        <td className="px-2 py-2 text-marble/70 print:text-black">
                          {match.partner}
                        </td>
                        <td className="px-2 py-2 text-marble/70 print:text-black">
                          {match.opponents.join(", ")}
                        </td>
                        <td className="px-2 py-2 capitalize text-marble/70 print:text-black">
                          {match.result}
                        </td>
                        <td className="whitespace-nowrap px-2 py-2 text-marble/70 print:text-black">
                          {typeof match.scoreSelf === "number" &&
                          typeof match.scoreOpponent === "number"
                            ? `${match.scoreSelf}–${match.scoreOpponent}`
                            : "—"}
                        </td>
                        <td className="max-w-xs whitespace-pre-wrap px-2 py-2 text-marble/70 print:text-black">
                          {match.notes || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>

          <footer className="flex items-center justify-between gap-3 border-t border-white/10 bg-zinc-900/60 px-5 py-3 print:hidden">
            <Dialog.Close asChild>
              <button
                type="button"
                className="rounded border border-white/15 bg-white/5 px-4 py-2 text-xs font-bold uppercase text-marble/80 transition-colors hover:bg-white/10 hover:text-white"
              >
                Close
              </button>
            </Dialog.Close>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 rounded border border-ares-gold/50 bg-ares-gold/20 px-5 py-2 text-xs font-bold uppercase text-ares-gold transition-colors hover:bg-ares-gold/30 focus-visible:ring-2 focus-visible:ring-ares-cyan"
            >
              <Printer size={14} aria-hidden="true" />
              Print / Save PDF
            </button>
          </footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
