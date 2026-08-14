import { Link } from "react-router-dom";
import {
  Activity,
  Calendar,
  ExternalLink,
  MapPin,
  Pencil,
  Trash2,
  Trophy,
} from "lucide-react";
import { PublicDataState } from "@/components/PublicDataState";
import type { Tournament } from "@/types/tournament";
import { formatDateOnly } from "@/lib/dateOnly";

interface TournamentListProps {
  tournaments: Tournament[];
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  pendingArchiveId: string | null;
  isArchiving: boolean;
  archiveError: Error | null;
  onRetry: () => void;
  onEdit: (tournament: Tournament) => void;
  onRequestArchive: (id: string) => void;
  onCancelArchive: () => void;
  onArchive: (id: string) => void;
}

export function TournamentList({
  tournaments,
  isLoading,
  isError,
  error,
  pendingArchiveId,
  isArchiving,
  archiveError,
  onRetry,
  onEdit,
  onRequestArchive,
  onCancelArchive,
  onArchive,
}: TournamentListProps) {
  return (
    <>
      {isError && (
        <PublicDataState
          title="Unable to refresh tournament records"
          message={
            tournaments.length > 0
              ? "The last confirmed records remain visible below. Retry before making decisions from this list."
              : "Tournament records could not be reached. Check your connection or session, then retry."
          }
          diagnostic={error instanceof Error ? error.message : String(error)}
          onRetry={onRetry}
        />
      )}

      {isLoading ? (
        <div className="flex justify-center items-center py-20 text-marble/55">
          <div className="w-6 h-6 border-2 border-ares-red/35 border-t-ares-red rounded-full animate-spin mr-3" />
          <span className="text-xs uppercase tracking-wider">
            Retrieving Tournaments...
          </span>
        </div>
      ) : isError && tournaments.length === 0 ? null : tournaments.length ===
        0 ? (
        <div className="text-center py-20 border border-dashed border-white/10 rounded-2xl bg-white/5">
          <Trophy
            size={48}
            className="mx-auto text-marble/25 mb-4 animate-pulse"
            aria-hidden="true"
          />
          <h3 className="text-sm font-bold text-white uppercase">
            No Active Tournaments
          </h3>
          <p className="text-xs text-marble/50 mt-1">
            Add your first tournament log using the action button above.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {tournaments.map((tournament) => (
            <div
              key={tournament.id}
              className="bg-white/5 border border-white/10 p-5 rounded-xl flex flex-col md:flex-row md:flex-wrap md:items-center justify-between gap-4 hover:border-ares-red/30 transition-all duration-300"
            >
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-sm font-bold text-white font-heading">
                    {tournament.name}
                  </span>
                  <span
                    className={`text-[8px] px-1.5 py-0.5 rounded font-black uppercase tracking-wider ${
                      tournament.status === "upcoming"
                        ? "bg-ares-gold/15 text-ares-gold border border-ares-gold/35"
                        : "bg-ares-red text-white border border-ares-red"
                    }`}
                  >
                    {tournament.status}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-[10px] text-marble/55 font-semibold">
                  <span className="flex items-center gap-1">
                    <Calendar size={11} aria-hidden="true" />
                    {formatDateOnly(tournament.date, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                  <span className="flex items-center gap-1">
                    <MapPin size={11} aria-hidden="true" />
                    {tournament.location}
                  </span>
                  {(tournament.opr ?? 0) > 0 && (
                    <span className="flex items-center gap-1 text-ares-gold font-bold">
                      <Activity size={11} aria-hidden="true" />
                      OPR: {tournament.opr}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3 self-start md:self-auto border-t md:border-t-0 border-white/5 pt-2.5 md:pt-0">
                <Link
                  to={`/tournaments/${tournament.id}`}
                  target="_blank"
                  className="bg-white/5 border border-white/10 text-marble/70 hover:text-white p-2 rounded transition-colors flex items-center justify-center cursor-pointer"
                  title="View scouting board in new window"
                  aria-label={`View ${tournament.name} scouting board in a new window`}
                >
                  <ExternalLink size={14} aria-hidden="true" />
                </Link>
                <button
                  type="button"
                  onClick={() => onEdit(tournament)}
                  className="bg-white/5 border border-white/10 text-marble/70 hover:text-ares-gold p-2 rounded transition-colors flex items-center justify-center cursor-pointer"
                  title="Edit details"
                  aria-label={`Edit ${tournament.name}`}
                >
                  <Pencil size={14} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => onRequestArchive(tournament.id)}
                  className="bg-white/5 border border-white/10 text-marble/70 hover:text-ares-gold p-2 rounded transition-colors flex items-center justify-center cursor-pointer"
                  title="Archive record"
                  aria-label={`Archive ${tournament.name}`}
                >
                  <Trash2 size={14} aria-hidden="true" />
                </button>
              </div>

              {pendingArchiveId === tournament.id && (
                <div
                  role="alertdialog"
                  aria-labelledby={`archive-tournament-${tournament.id}`}
                  className="basis-full rounded-lg border border-ares-red/40 bg-ares-red/10 p-3"
                >
                  <p
                    id={`archive-tournament-${tournament.id}`}
                    className="text-xs font-bold text-white"
                  >
                    Archive {tournament.name}? It will disappear from active
                    lists but remain stored.
                  </p>
                  {archiveError && (
                    <p className="mt-1 font-mono text-[11px] text-marble/80">
                      {archiveError.message}
                    </p>
                  )}
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={onCancelArchive}
                      className="rounded border border-white/20 px-3 py-1 text-[10px] font-bold uppercase text-white focus-visible:ring-2 focus-visible:ring-ares-cyan"
                    >
                      Keep Tournament
                    </button>
                    <button
                      type="button"
                      onClick={() => onArchive(tournament.id)}
                      disabled={isArchiving}
                      className="rounded bg-ares-red px-3 py-1 text-[10px] font-bold uppercase text-white disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-ares-cyan"
                    >
                      {isArchiving ? "Archiving…" : "Archive Tournament"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
