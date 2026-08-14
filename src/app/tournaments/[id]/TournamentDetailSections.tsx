import { useState, useMemo } from "react";
import {
  Activity,
  Calendar,
  Camera,
  Download,
  FileText,
  MapPin,
  Search,
  TrendingUp,
  X,
} from "lucide-react";
import { GreekMeander } from "@/components/GreekMeander";
import { PublicDataState } from "@/components/PublicDataState";
import { useFocusTrap } from "@/lib/useFocusTrap";
import type { Tournament } from "@/types/tournament";
import { formatDateOnly } from "@/lib/dateOnly";
import { tournamentScoutingCsvDataUrl } from "@/lib/tournamentScoutingCsv";

export interface TournamentPhoto {
  src: string;
  previewSrc?: string;
  caption: string;
}

export function TournamentHero({ tournament }: { tournament: Tournament }) {
  return (
    <header className="border border-white/10 bg-black/45 p-8 rounded-2xl mb-10 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full">
        <GreekMeander variant="thin" opacity="opacity-20" className="w-full" />
      </div>
      <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-4">
            <span
              className={`px-2.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider ${
                tournament.status === "upcoming"
                  ? "bg-ares-gold/20 text-ares-gold border border-ares-gold/30"
                  : "bg-ares-red text-white border border-ares-red"
              }`}
            >
              {tournament.status}
            </span>
            <span className="text-xs text-marble/55 flex items-center gap-1 font-semibold">
              <Calendar size={12} aria-hidden="true" />
              {formatDateOnly(tournament.date, {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </span>
            <span className="text-xs text-marble/55 flex items-center gap-1 font-semibold">
              <MapPin size={12} className="text-ares-gold" aria-hidden="true" />
              {tournament.location}
            </span>
          </div>
          {(tournament.seasonName || tournament.challengeName) && (
            <p className="mb-2 text-[10px] font-black uppercase tracking-[0.2em] text-ares-gold/85">
              {[tournament.seasonName, tournament.challengeName]
                .filter(Boolean)
                .join(" · ")}
            </p>
          )}
          <h1 className="text-3xl md:text-5xl font-black uppercase tracking-tight text-white font-heading mb-4">
            {tournament.name}
          </h1>
          <p className="text-sm text-marble/70 leading-relaxed max-w-3xl">
            {tournament.description}
          </p>
        </div>

        {(tournament.opr ?? 0) > 0 && (
          <div className="bg-white/5 border border-white/10 p-5 rounded-xl flex flex-col items-center justify-center min-w-[150px] shadow-lg shrink-0">
            <span className="text-[10px] font-black uppercase tracking-widest text-marble/55">
              Team OPR
            </span>
            <span className="text-4xl font-extrabold text-ares-gold mt-1 font-heading">
              {tournament.opr}
            </span>
            <span className="text-[9px] text-marble/40 uppercase mt-1 tracking-wider font-semibold">
              Offensive Power
            </span>
          </div>
        )}
      </div>
    </header>
  );
}

export function TournamentScoutingSection({
  tournament,
}: {
  tournament: Tournament;
}) {
  if (!tournament.scoutingDetails) return null;
  return (
    <section className="bg-white/5 border border-white/10 rounded-2xl p-6 relative overflow-hidden backdrop-blur-sm shadow-xl">
      <h2 className="text-lg font-bold text-white uppercase tracking-tight font-heading flex items-center gap-2 mb-6 border-b border-white/5 pb-4">
        <FileText className="text-ares-gold" size={18} aria-hidden="true" />
        Robot Scouting Details
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-black/35 p-4 rounded-xl border border-white/5">
          <span className="text-[10px] font-black uppercase tracking-widest text-ares-gold block mb-2">
            Autonomous Path Notes
          </span>
          <p className="text-xs text-marble/70 leading-relaxed">
            {tournament.scoutingDetails.autoPathNotes ||
              "No autonomous parameters logged."}
          </p>
        </div>
        <div className="bg-black/35 p-4 rounded-xl border border-white/5">
          <span className="inline-block rounded bg-ares-red px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-white mb-2">
            Driver Feedback
          </span>
          <p className="text-xs text-marble/70 leading-relaxed">
            {tournament.scoutingDetails.driverFeedback ||
              "No driver notes logged."}
          </p>
        </div>
        <div className="bg-black/35 p-4 rounded-xl border border-white/5">
          <span className="text-[10px] font-black uppercase tracking-widest text-marble/55 block mb-2">
            Robot Blueprint Specs
          </span>
          <p className="text-xs text-marble/70 leading-relaxed">
            {tournament.scoutingDetails.robotSpecs ||
              "No hardware details recorded."}
          </p>
        </div>
      </div>
    </section>
  );
}

interface TournamentPhotosSectionProps {
  hasAlbum: boolean;
  photos: TournamentPhoto[];
  isError: boolean;
  error: unknown;
  onRetry: () => void;
  onOpenPhoto: (photo: TournamentPhoto) => void;
}

export function TournamentPhotosSection({
  hasAlbum,
  photos,
  isError,
  error,
  onRetry,
  onOpenPhoto,
}: TournamentPhotosSectionProps) {
  if (!hasAlbum) return null;
  return (
    <>
      <section className="bg-white/5 border border-white/10 rounded-2xl p-6 relative overflow-hidden backdrop-blur-sm shadow-xl">
        <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-6">
          <h2 className="text-lg font-bold text-white uppercase tracking-tight font-heading flex items-center gap-2">
            <Camera className="text-ares-gold" size={18} aria-hidden="true" />
            Tournament Gallery
          </h2>
          <span className="text-xs font-mono text-marble/55">
            {photos.length} {photos.length === 1 ? "photo" : "photos"}
          </span>
        </div>

        {isError && (
          <PublicDataState
            title="Unable to load album photos"
            message={
              photos.length > 0
                ? "The previous album preview is still shown below, but its refresh failed."
                : "Photos recorded for this tournament could not be reached. Try again or return later."
            }
            diagnostic={error instanceof Error ? error.message : String(error)}
            onRetry={onRetry}
          />
        )}

        {photos.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {photos.map((photo, i) => (
              <button
                key={photo.src || i}
                type="button"
                onClick={() => onOpenPhoto(photo)}
                className="group aspect-video rounded-xl overflow-hidden relative border border-white/10 bg-black/40 hover:border-ares-gold/50 transition-all cursor-pointer text-left focus-visible:ring-2 focus-visible:ring-ares-cyan"
                aria-label={`Open photo: ${photo.caption}`}
              >
                <img
                  src={photo.previewSrc || photo.src}
                  alt={photo.caption}
                  loading="lazy"
                  decoding="async"
                  width={16}
                  height={9}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-2 flex items-end">
                  <span className="text-[10px] text-white font-medium truncate">
                    {photo.caption}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

export function TournamentAnalyticsSidebar({
  tournament,
}: {
  tournament: Tournament;
}) {
  const [teamSearchQuery, setTeamSearchQuery] = useState("");

  const oprList = useMemo(() => {
    return [...(tournament.oprList ?? [])].sort((a, b) => b.opr - a.opr);
  }, [tournament.oprList]);

  const filteredOprList = useMemo(() => {
    if (!teamSearchQuery.trim()) return oprList;
    const query = teamSearchQuery.toLowerCase().trim();
    return oprList.filter(
      (t) =>
        t.teamNumber.toLowerCase().includes(query) ||
        t.teamName.toLowerCase().includes(query)
    );
  }, [oprList, teamSearchQuery]);

  const averageOpr = useMemo(() => {
    if (oprList.length === 0) return 0;
    const sum = oprList.reduce((acc, curr) => acc + (Number(curr.opr) || 0), 0);
    return Math.round((sum / oprList.length) * 10) / 10;
  }, [oprList]);

  const csvDataUrl = useMemo(
    () => tournamentScoutingCsvDataUrl(tournament),
    [tournament]
  );

  return (
    <div className="space-y-8">
      {oprList.length > 0 && (
        <section className="bg-white/5 border border-white/10 rounded-2xl p-6 relative overflow-hidden backdrop-blur-sm shadow-xl">
          <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-4">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider font-heading flex items-center gap-2">
              <TrendingUp
                className="text-ares-gold"
                size={16}
                aria-hidden="true"
              />
              OPR Leaderboard
            </h2>

            <a
              href={csvDataUrl}
              download={`${tournament.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-scouting.csv`}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-white/5 hover:bg-white/10 text-[10px] font-bold uppercase tracking-wider text-marble/80 hover:text-ares-gold border border-white/10 transition-all"
              aria-label="Download scouting OPR records as CSV"
            >
              <Download size={12} />
              <span>CSV</span>
            </a>
          </div>

          {/* Quick Stats Banner */}
          <div className="grid grid-cols-2 gap-2 mb-4">
            <div className="bg-black/30 p-2.5 rounded-lg border border-white/5 text-center">
              <span className="text-[9px] font-black uppercase text-marble/50 block">
                Teams Scouted
              </span>
              <span className="text-base font-bold text-white font-mono">
                {oprList.length}
              </span>
            </div>
            <div className="bg-black/30 p-2.5 rounded-lg border border-white/5 text-center">
              <span className="text-[9px] font-black uppercase text-marble/50 block">
                Average OPR
              </span>
              <span className="text-base font-bold text-ares-gold font-mono">
                {averageOpr}
              </span>
            </div>
          </div>

          {/* Search Filter */}
          {oprList.length > 4 && (
            <div className="relative mb-3">
              <Search
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-marble/40"
                size={13}
              />
              <label htmlFor="opr-team-search" className="sr-only">
                Filter teams by number or name
              </label>
              <input
                id="opr-team-search"
                type="text"
                placeholder="Filter team # or name..."
                value={teamSearchQuery}
                onChange={(e) => setTeamSearchQuery(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded pl-8 pr-3 py-1.5 text-xs text-white placeholder-marble/40 focus:outline-none focus:border-ares-gold transition-all"
              />
            </div>
          )}

          <div className="overflow-hidden border border-white/5 rounded-xl bg-black/35 max-h-[380px] overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-white/5 text-marble/50 text-[10px] uppercase font-black tracking-widest border-b border-white/5 sticky top-0 bg-zinc-900/90 backdrop-blur-sm">
                  <th className="px-3 py-2 w-10">#</th>
                  <th className="px-3 py-2">Team</th>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2 text-right">OPR</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredOprList.map((team) => {
                  const isAres = team.teamNumber === "23247";
                  const overallRank =
                    oprList.findIndex((t) => t.teamNumber === team.teamNumber) +
                    1;

                  return (
                    <tr
                      key={team.teamNumber}
                      className={`transition-colors ${
                        isAres
                          ? "bg-ares-red/15 text-white font-bold"
                          : "text-marble/70 hover:bg-white/5"
                      }`}
                    >
                      <td className="px-3 py-2.5 font-mono text-[10px] text-marble/50">
                        {overallRank}
                      </td>
                      <td className="px-3 py-2.5 font-mono">
                        #{team.teamNumber}
                      </td>
                      <td className="px-3 py-2.5 truncate max-w-[110px]">
                        {team.teamName}
                      </td>
                      <td
                        className={`px-3 py-2.5 text-right font-bold font-mono ${
                          isAres ? "text-ares-gold" : "text-white"
                        }`}
                      >
                        {team.opr}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="bg-white/5 border border-white/10 rounded-2xl p-6 relative overflow-hidden backdrop-blur-sm shadow-xl text-center space-y-4">
        <h3 className="text-xs font-black uppercase text-ares-gold tracking-widest">
          Analytics Dashboard
        </h3>
        <p className="text-xs text-marble/60 leading-relaxed">
          OPR values and match outcomes shown here are the team records saved by
          an administrator or coach. Confirm official results with the event
          source before making strategy decisions.
        </p>
        <div className="p-4 bg-black/40 rounded-xl border border-white/5 text-left">
          <span className="text-[9px] font-black uppercase tracking-wider text-marble/55 block mb-1">
            Division System Status
          </span>
          <span className="text-[10px] text-ares-gold font-bold uppercase flex items-center gap-1.5">
            <Activity
              size={10}
              className="text-ares-gold animate-pulse"
              aria-hidden="true"
            />
            Showing recorded data
          </span>
        </div>
      </section>
    </div>
  );
}

interface TournamentPhotoLightboxProps {
  photo: TournamentPhoto | null;
  onClose: () => void;
}

export function TournamentPhotoLightbox({
  photo,
  onClose,
}: TournamentPhotoLightboxProps) {
  const dialogRef = useFocusTrap(Boolean(photo), onClose);
  if (!photo) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="tournament-photo-caption"
      onClick={onClose}
      className="fixed inset-0 bg-black/90 z-50 flex flex-col justify-center items-center p-6 cursor-zoom-out"
    >
      <div
        ref={dialogRef}
        onClick={(event) => event.stopPropagation()}
        className="relative max-w-4xl max-h-[80vh] overflow-hidden rounded-xl border border-white/15 bg-black"
      >
        <img
          src={photo.src}
          alt={photo.caption}
          className="max-w-full max-h-[75vh] object-contain"
        />
        <button
          type="button"
          onClick={onClose}
          aria-label="Close tournament photo"
          className="absolute top-3 right-3 bg-black/60 border border-white/20 hover:border-white p-2 rounded-full text-white cursor-pointer focus-visible:ring-2 focus-visible:ring-ares-cyan"
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>
      <p
        id="tournament-photo-caption"
        className="text-white text-xs uppercase tracking-widest font-black mt-4 bg-black/60 px-4 py-2 rounded-full border border-white/5 max-w-xl text-center"
      >
        {photo.caption}
      </p>
    </div>
  );
}
