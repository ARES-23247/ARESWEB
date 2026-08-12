import { Activity, Calendar, Camera, FileText, MapPin, TrendingUp, X } from "lucide-react";
import { GreekMeander } from "@/components/GreekMeander";
import { PublicDataState } from "@/components/PublicDataState";
import { useFocusTrap } from "@/lib/useFocusTrap";
import type { Tournament } from "@/types/tournament";

export interface TournamentPhoto {
  src: string;
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
            <span className={`px-2.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider ${
              tournament.status === "upcoming"
                ? "bg-ares-gold/20 text-ares-gold border border-ares-gold/30"
                : "bg-ares-red text-white border border-ares-red"
            }`}>
              {tournament.status}
            </span>
            <span className="text-xs text-marble/55 flex items-center gap-1 font-semibold">
              <Calendar size={12} aria-hidden="true" />
              {new Date(tournament.date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
            </span>
            <span className="text-xs text-marble/55 flex items-center gap-1 font-semibold">
              <MapPin size={12} className="text-ares-gold" aria-hidden="true" />
              {tournament.location}
            </span>
          </div>
          <h1 className="text-3xl md:text-5xl font-black uppercase tracking-tight text-white font-heading mb-4">{tournament.name}</h1>
          <p className="text-sm text-marble/70 leading-relaxed max-w-3xl">{tournament.description}</p>
        </div>

        {tournament.status === "past" && (tournament.opr ?? 0) > 0 && (
          <div className="bg-white/5 border border-white/10 p-5 rounded-xl flex flex-col items-center justify-center min-w-[150px] shadow-lg shrink-0">
            <span className="text-[10px] font-black uppercase tracking-widest text-marble/55">Team OPR</span>
            <span className="text-4xl font-extrabold text-ares-gold mt-1 font-heading">{tournament.opr}</span>
            <span className="text-[9px] text-marble/40 uppercase mt-1 tracking-wider font-semibold">Offensive Power</span>
          </div>
        )}
      </div>
    </header>
  );
}

export function TournamentScoutingSection({ tournament }: { tournament: Tournament }) {
  if (!tournament.scoutingDetails) return null;
  return (
    <section className="bg-white/5 border border-white/10 rounded-2xl p-6 relative overflow-hidden backdrop-blur-sm shadow-xl">
      <h2 className="text-lg font-bold text-white uppercase tracking-tight font-heading flex items-center gap-2 mb-6 border-b border-white/5 pb-4">
        <FileText className="text-ares-gold" size={18} aria-hidden="true" />
        Robot Scouting Details
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-black/35 p-4 rounded-xl border border-white/5">
          <span className="text-[10px] font-black uppercase tracking-widest text-ares-gold block mb-2">Autonomous Path Notes</span>
          <p className="text-xs text-marble/70 leading-relaxed">{tournament.scoutingDetails.autoPathNotes || "No autonomous parameters logged."}</p>
        </div>
        <div className="bg-black/35 p-4 rounded-xl border border-white/5">
          <span className="inline-block rounded bg-ares-red px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-white mb-2">Driver Feedback</span>
          <p className="text-xs text-marble/70 leading-relaxed">{tournament.scoutingDetails.driverFeedback || "No driver notes logged."}</p>
        </div>
        <div className="bg-black/35 p-4 rounded-xl border border-white/5">
          <span className="text-[10px] font-black uppercase tracking-widest text-marble/55 block mb-2">Robot Blueprint Specs</span>
          <p className="text-xs text-marble/70 leading-relaxed">{tournament.scoutingDetails.robotSpecs || "No hardware details recorded."}</p>
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

export function TournamentPhotosSection({ hasAlbum, photos, isError, error, onRetry, onOpenPhoto }: TournamentPhotosSectionProps) {
  if (!hasAlbum) return null;
  return (
    <>
      {isError && (
        <PublicDataState
          title="Unable to load tournament photos"
          message="The tournament record is available, but its photo album could not be reached."
          diagnostic={error instanceof Error ? error.message : String(error)}
          onRetry={onRetry}
        />
      )}
      {photos.length > 0 && (
        <section className="bg-white/5 border border-white/10 rounded-2xl p-6 relative overflow-hidden backdrop-blur-sm shadow-xl">
          <h2 className="text-lg font-bold text-white uppercase tracking-tight font-heading flex items-center gap-2 mb-6 border-b border-white/5 pb-4">
            <Camera className="text-ares-gold" size={18} aria-hidden="true" />
            Action Photo Album
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {photos.map((photo, index) => (
              <button type="button" key={`${photo.src}-${index}`} onClick={() => onOpenPhoto(photo)} aria-label={`Open photo: ${photo.caption}`} className="group cursor-pointer aspect-video relative overflow-hidden border border-white/10 rounded-xl bg-black/60 focus-visible:ring-2 focus-visible:ring-ares-cyan">
                <img src={photo.src} alt={photo.caption} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-80 group-hover:opacity-100" />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-3 flex items-end">
                  <p className="text-[9px] text-white uppercase font-black tracking-wider truncate w-full">{photo.caption}</p>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

export function TournamentAnalyticsSidebar({ tournament }: { tournament: Tournament }) {
  return (
    <div className="space-y-8">
      {tournament.status === "past" && tournament.oprList && tournament.oprList.length > 0 && (
        <section className="bg-white/5 border border-white/10 rounded-2xl p-6 relative overflow-hidden backdrop-blur-sm shadow-xl">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider font-heading flex items-center gap-2 mb-6 border-b border-white/5 pb-4">
            <TrendingUp className="text-ares-gold" size={16} aria-hidden="true" />
            OPR Leaderboard
          </h2>
          <div className="overflow-hidden border border-white/5 rounded-xl bg-black/35">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-white/5 text-marble/50 text-[10px] uppercase font-black tracking-widest border-b border-white/5">
                  <th className="px-4 py-3">Team</th>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3 text-right">OPR</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {[...tournament.oprList].sort((a, b) => b.opr - a.opr).map((team) => {
                  const isAres = team.teamNumber === "23247";
                  return (
                    <tr key={team.teamNumber} className={`transition-colors ${isAres ? "bg-ares-red/10 text-white font-bold" : "text-marble/70 hover:bg-white/5"}`}>
                      <td className="px-4 py-3 font-mono">#{team.teamNumber}</td>
                      <td className="px-4 py-3 truncate max-w-[120px]">{team.teamName}</td>
                      <td className={`px-4 py-3 text-right font-bold ${isAres ? "text-ares-gold" : "text-white"}`}>{team.opr}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="bg-white/5 border border-white/10 rounded-2xl p-6 relative overflow-hidden backdrop-blur-sm shadow-xl text-center space-y-4">
        <h3 className="text-xs font-black uppercase text-ares-gold tracking-widest">Analytics Dashboard</h3>
        <p className="text-xs text-marble/60 leading-relaxed">OPRs are automatically computed based on match score differentials and team partner variables using standardized ridge regression matrices.</p>
        <div className="p-4 bg-black/40 rounded-xl border border-white/5 text-left">
          <span className="text-[9px] font-black uppercase tracking-wider text-marble/55 block mb-1">Division System Status</span>
          <span className="text-[10px] text-ares-gold font-bold uppercase flex items-center gap-1.5">
            <Activity size={10} className="text-ares-gold animate-pulse" aria-hidden="true" />
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

export function TournamentPhotoLightbox({ photo, onClose }: TournamentPhotoLightboxProps) {
  const dialogRef = useFocusTrap(Boolean(photo), onClose);
  if (!photo) return null;
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="tournament-photo-caption" onClick={onClose} className="fixed inset-0 bg-black/90 z-50 flex flex-col justify-center items-center p-6 cursor-zoom-out">
      <div ref={dialogRef} onClick={(event) => event.stopPropagation()} className="relative max-w-4xl max-h-[80vh] overflow-hidden rounded-xl border border-white/15 bg-black">
        <img src={photo.src} alt={photo.caption} className="max-w-full max-h-[75vh] object-contain" />
        <button type="button" onClick={onClose} aria-label="Close tournament photo" className="absolute top-3 right-3 bg-black/60 border border-white/20 hover:border-white p-2 rounded-full text-white cursor-pointer focus-visible:ring-2 focus-visible:ring-ares-cyan">
          <X size={16} aria-hidden="true" />
        </button>
      </div>
      <p id="tournament-photo-caption" className="text-white text-xs uppercase tracking-widest font-black mt-4 bg-black/60 px-4 py-2 rounded-full border border-white/5 max-w-xl text-center">{photo.caption}</p>
    </div>
  );
}
