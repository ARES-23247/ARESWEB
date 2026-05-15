import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetTournaments,
  useCreateTournament,
  useDeleteTournament,
  useSyncTournamentMatches,
  useGetTournament,
  type Tournament
} from "../api/tournaments";
import { useGetSeasons } from "../api/seasons";
import { useGetRobots } from "../api/robots";
import { Plus, Trash2, Edit2, XCircle, Trophy, RefreshCw, Award, ArrowLeft, Swords, BarChart3, ImageIcon, Hash, Video } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { RichTextEditor } from "@/components/RichTextEditor";
import AlbumPickerModal from "./AlbumPickerModal";
import DashboardPageHeader from "./dashboard/DashboardPageHeader";
import DashboardEmptyState from "./dashboard/DashboardEmptyState";
import DashboardLoadingGrid from "./dashboard/DashboardLoadingGrid";
import { useModal } from "../contexts/ModalContext";

/* ─── Match Detail Sub-view ─────────────────────────────────── */

function TournamentDetailEditor({ tournamentId, onBack }: { tournamentId: string; onBack: () => void }) {
  const { data, isLoading } = useGetTournament(tournamentId);
  const syncMatches = useSyncTournamentMatches(tournamentId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw className="animate-spin text-ares-red" size={32} />
      </div>
    );
  }

  const t = data?.tournament;
  const matches = data?.matches || [];
  const awards = data?.awards || [];

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-black/40 border border-white/5 p-10 ares-cut-lg mb-10 shadow-2xl backdrop-blur-sm relative overflow-hidden group">
        <div className="absolute top-0 left-0 w-1 h-0 bg-ares-gold group-hover:h-full transition-all duration-700"></div>
        <div className="relative z-10">
          <h2 className="text-3xl font-black text-white flex items-center gap-6 uppercase tracking-tighter leading-none">
            <div className="p-3 bg-white/5 ares-cut-sm border border-white/10 group-hover:border-white/20 transition-all">
              <Trophy className="text-ares-gold" />
            </div>
            {t?.name} <span className="text-marble/20">{`// DETAIL_RECORDS`}</span>
          </h2>
          <p className="text-marble/40 text-[10px] mt-4 uppercase tracking-[0.4em] font-black flex items-center gap-2">
            <span className="w-8 h-px bg-white/10"></span>
            Match results, awards, and FTC Events API synchronization protocol.
          </p>
        </div>
        <button
          onClick={onBack}
          className="mt-8 md:mt-0 flex items-center gap-3 px-6 py-3 font-black text-[10px] uppercase tracking-[0.2em] ares-cut-sm bg-white/5 border border-white/10 text-marble hover:text-white hover:bg-white/10 hover:border-white/30 transition-all relative z-10"
        >
          <ArrowLeft size={16} /> RETURN TO REGISTRY
        </button>
      </div>

      {/* Matches */}
      <div className="bg-black/40 border border-white/5 ares-cut-lg p-10 shadow-2xl backdrop-blur-sm relative overflow-hidden group/matches">
        <div className="absolute top-0 left-0 w-1 h-0 bg-ares-red group-hover/matches:h-full transition-all duration-700"></div>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10 relative z-10">
          <div>
            <h3 className="text-[10px] font-black text-white flex items-center gap-3 uppercase tracking-[0.4em]">
              <Swords size={16} className="text-ares-red" /> Operational // Match Logs ({matches.length})
            </h3>
            <div className="mt-2 text-marble/20 text-[8px] font-black uppercase tracking-[0.3em]">SECURE_FEED // SYNC_ACTIVE</div>
          </div>
          <button
            onClick={() => syncMatches.mutateAsync().then(() => toast.success("Match data synchronized from FTC Events API."))}
            disabled={syncMatches.isPending}
            className="flex items-center gap-3 px-6 py-3 font-black text-[10px] uppercase tracking-[0.2em] ares-cut-sm bg-ares-red text-white hover:bg-ares-danger shadow-lg shadow-ares-red/20 disabled:opacity-50 transition-all"
          >
            <RefreshCw size={14} className={syncMatches.isPending ? "animate-spin" : ""} />
            {syncMatches.isPending ? "SYNCHRONIZING..." : "SYNC FROM FTC EVENTS"}
          </button>
        </div>

        {matches.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.3em] text-marble/20">Match // Protocol</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.3em] text-ares-red/40">Red // Alliance</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.3em] text-ares-cyan/40">Blue // Alliance</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.3em] text-marble/20 text-right">Data // Link</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {matches.map(m => (
                  <tr key={m.id} className="hover:bg-white/[0.02] transition-colors group">
                    <td className="p-6 font-black text-white uppercase tracking-tighter text-base">{m.matchType}</td>
                    <td className="p-6 text-ares-red font-black text-xl tracking-tighter">{m.redScore}</td>
                    <td className="p-6 text-ares-cyan font-black text-xl tracking-tighter">{m.blueScore}</td>
                    <td className="p-6 text-right">
                      {m.youtubeVideoId ? (
                        <a href={`https://youtube.com/watch?v=${m.youtubeVideoId}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-3 px-4 py-2 ares-cut-sm bg-ares-gold/10 text-ares-gold text-[10px] font-black uppercase tracking-widest border border-ares-gold/20 hover:bg-ares-gold/20 transition-all">
                          <Video size={14} /> Playback
                        </a>
                      ) : (
                        <span className="text-marble/10 text-[10px] font-black uppercase tracking-widest">N/A</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <DashboardEmptyState
            icon={<Swords size={36} />}
            message="No matches found. Ensure the FTC Event Code is correct and click Sync."
            className="py-16 text-center border-2 border-dashed border-white/5 ares-cut-lg bg-black/20"
          />
        )}
      </div>

      {/* Awards */}
      <div className="bg-black/40 border border-white/5 ares-cut-lg p-10 shadow-2xl backdrop-blur-sm">
        <h3 className="text-[10px] font-black text-white flex items-center gap-3 mb-10 uppercase tracking-[0.4em]">
          <Award size={16} className="text-ares-gold" /> Achievement // Awards ({awards.length})
        </h3>
        {awards.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {awards.map((a) => (
              <div key={a.id} className="bg-black/40 border border-white/5 p-6 ares-cut-sm flex items-center gap-4 group hover:border-ares-gold/40 transition-all duration-500">
                <div className="p-3 ares-cut-sm bg-ares-gold/10 border border-ares-gold/20 group-hover:bg-ares-gold/20 transition-all">
                  <Award size={18} className="text-ares-gold" />
                </div>
                <div>
                  <div className="text-sm font-black text-white uppercase tracking-tighter leading-tight">{a.name}</div>
                  {a.placement && <div className="text-[9px] font-black text-marble/20 uppercase tracking-[0.2em] mt-1 italic">{a.placement}</div>}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-marble/20 text-[10px] font-black uppercase tracking-[0.3em] italic">No achievement data recorded.</p>
        )}
      </div>
    </div>
  );
}

/* ─── Tournament Card ───────────────────────────────────────── */

interface TournamentCardProps {
  tournament: Tournament;
  onEdit: (t: Tournament) => void;
  onManage: (id: string) => void;
}

function TournamentCard({ tournament: t, onEdit, onManage }: TournamentCardProps) {
  const deleteTournament = useDeleteTournament();
  const modal = useModal();

  const handleDelete = async () => {
    const confirmed = await modal.confirm({
      title: "Delete Tournament",
      description: `Are you sure you want to permanently remove "${t.name}" from the archive?`,
      confirmText: "Delete",
      destructive: true
    });
    if (confirmed) {
      deleteTournament.mutate(t.id, {
        onSuccess: () => toast.success(`${t.name} removed from tournament archive.`)
      });
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-black/40 border border-white/5 ares-cut-lg p-10 transition-all hover:border-ares-gold/20 group shadow-2xl backdrop-blur-sm relative overflow-hidden"
    >
      <div className="absolute top-0 right-0 w-1 h-0 bg-ares-gold group-hover:h-full transition-all duration-700"></div>
      <div className="flex justify-between items-start mb-8 relative z-10">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-white/5 ares-cut-sm border border-white/10 group-hover:border-ares-gold/20 transition-all duration-500">
            <Trophy className="text-ares-gold" size={18} />
          </div>
          <span className="text-[10px] font-black uppercase tracking-[0.4em] text-marble/20 group-hover:text-ares-gold transition-colors">
            {t.ftcEventCode || "EXTERNAL_EVENT"}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => onEdit(t)}
            disabled={deleteTournament.isPending}
            aria-label={`Edit ${t.name}`}
            className="text-marble/20 hover:text-ares-cyan transition-all disabled:opacity-30 p-2 hover:bg-white/5 ares-cut-sm border border-transparent hover:border-white/10"
          >
            <Edit2 size={16} />
          </button>
          <button
            onClick={handleDelete}
            disabled={deleteTournament.isPending}
            aria-label={`Delete ${t.name}`}
            className="text-marble/20 hover:text-ares-red transition-all disabled:opacity-30 p-2 hover:bg-white/5 ares-cut-sm border border-transparent hover:border-white/10"
          >
            {deleteTournament.isPending ? <RefreshCw size={16} className="animate-spin" /> : <Trash2 size={16} />}
          </button>
        </div>
      </div>

      <h4 className="text-3xl font-black text-white mb-8 uppercase tracking-tighter leading-none group-hover:text-ares-gold transition-colors relative z-10">{t.name}</h4>

      <div className="flex flex-wrap gap-4 text-[10px] font-black uppercase tracking-[0.2em] text-marble/20 mb-10 relative z-10">
        {t.rank && (
          <span className="flex items-center gap-3 px-4 py-2 ares-cut-sm bg-white/5 border border-white/10 text-white">
            <Hash size={12} className="text-ares-red" /> RANK_{t.rank}
          </span>
        )}
        {t.opr && (
          <span className="flex items-center gap-3 px-4 py-2 ares-cut-sm bg-white/5 border border-white/10 text-ares-cyan">
            <BarChart3 size={12} className="text-ares-cyan" /> OPR_{t.opr}
          </span>
        )}
        {t.allianceRole && (
          <span className="flex items-center gap-3 px-4 py-2 ares-cut-sm bg-white/5 border border-white/10 text-ares-gold">
            <Swords size={12} className="text-ares-gold" /> {t.allianceRole}
          </span>
        )}
      </div>

      <div className="pt-8 border-t border-white/5 relative z-10">
        <button
          onClick={() => onManage(t.id)}
          className="flex items-center gap-4 px-6 py-5 w-full justify-center bg-white/5 hover:bg-white/10 border border-white/10 ares-cut-sm text-white text-[10px] font-black uppercase tracking-[0.4em] transition-all duration-500 hover:shadow-2xl group/btn"
        >
          <Swords size={16} className="text-ares-red group-hover/btn:rotate-12 transition-transform" /> MANAGE_OPERATIONAL_DATA
        </button>
      </div>
    </motion.div>
  );
}

/* ─── Main Manager ──────────────────────────────────────────── */

export default function TournamentsManager() {
  const queryClient = useQueryClient();
  const { data: tournamentsData, isLoading } = useGetTournaments();
  const { data: seasonsData } = useGetSeasons();
  const { data: robotsData } = useGetRobots();

  const createTournament = useCreateTournament();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [managingId, setManagingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<Tournament>>({});
  const [isAlbumPickerOpen, setIsAlbumPickerOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const tournaments = tournamentsData?.tournaments || [];
  const seasons = seasonsData?.seasons || [];
  const robots = robotsData?.robots || [];

  const handleEdit = (tournament: Tournament) => {
    setEditingId(tournament.id);
    setFormData(tournament);
    setIsFormOpen(true);
  };

  const handleCreate = () => {
    setEditingId("new");
    setFormData({ name: "" });
    setIsFormOpen(true);
  };

  const handleCancel = () => {
    setIsFormOpen(false);
    setEditingId(null);
    setFormData({});
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      if (editingId === "new") {
        await createTournament.mutateAsync(formData);
        toast.success("Tournament archived to event registry.");
      } else if (editingId) {
        await fetch(`/api/tournaments/${editingId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        });
        queryClient.invalidateQueries({ queryKey: ["tournaments"] });
        toast.success("Tournament record updated.");
      }
      handleCancel();
    } catch {
      toast.error("Failed to save tournament record.");
    } finally {
      setIsSaving(false);
    }
  };

  // Detail view
  if (managingId) {
    return <TournamentDetailEditor tournamentId={managingId} onBack={() => setManagingId(null)} />;
  }

  const inputClass = "w-full bg-black/40 border border-white/5 ares-cut-sm px-6 py-4 text-white placeholder-white/10 focus:border-ares-red/40 focus:bg-black/60 focus:outline-none transition-all duration-300 text-sm font-bold uppercase tracking-widest";
  const labelClass = "block text-[10px] font-black text-marble/20 uppercase tracking-[0.3em] mb-3";

  return (
    <div className="space-y-8">
      <DashboardPageHeader
        title="Tournament Archive"
        subtitle="Track competition history, match results, and awards across all ARES seasons."
        icon={<Trophy className="text-ares-gold" />}
        action={
          <button
            onClick={isFormOpen ? handleCancel : handleCreate}
            className={`flex items-center gap-3 px-6 py-3 font-black text-[10px] uppercase tracking-[0.2em] ares-cut-sm transition-all shadow-xl ${isFormOpen ? 'bg-white/5 border border-white/10 text-marble' : 'bg-ares-red text-white hover:bg-ares-danger shadow-ares-red/20 hover:scale-105 active:scale-95'}`}
          >
            {isFormOpen ? <XCircle size={18} /> : <Plus size={18} />}
            {isFormOpen ? "ABORT_MISSION" : "ARCHIVE_NEW_TOURNAMENT"}
          </button>
        }
      />

      {/* Stats */}
      {!isFormOpen && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { label: "Tournaments", val: tournaments.length, icon: <Trophy size={16} /> },
            { label: "With FTC Code", val: tournaments.filter(t => t.ftcEventCode).length, icon: <Hash size={16} className="text-ares-cyan" /> },
            { label: "Ranked Events", val: tournaments.filter(t => t.rank).length, icon: <BarChart3 size={16} className="text-ares-gold" /> }
          ].map((stat, i) => (
            <div key={i} className="bg-black/40 border border-white/5 p-8 ares-cut-lg shadow-xl backdrop-blur-sm relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-1 h-0 bg-ares-gold/20 group-hover:h-full transition-all duration-500"></div>
              <div className="flex items-center gap-3 text-marble/20 mb-4">
                {stat.icon}
                <span className="text-[10px] font-black uppercase tracking-[0.4em]">{`${stat.label} //`}</span>
              </div>
              <div className="text-4xl font-black text-white uppercase tracking-tighter leading-none">{stat.val}</div>
            </div>
          ))}
        </div>
      )}

      {/* Form */}
      <AnimatePresence>
        {isFormOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-black/40 border border-white/10 ares-cut-lg p-6 space-y-6 overflow-hidden"
          >
            <h3 className="text-lg font-black text-white tracking-tight">
              {editingId === "new" ? "Archive New Tournament" : "Edit Tournament Record"}
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="tournament-name" className={labelClass}>Tournament Name</label>
                <input id="tournament-name" type="text" value={formData.name || ""} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="e.g. Michigan State Championship" className={inputClass} />
              </div>
              <div>
                <label htmlFor="tournament-ftc" className={labelClass}>FTC Event Code (for API Sync)</label>
                <input id="tournament-ftc" type="text" value={formData.ftcEventCode || ""} onChange={e => setFormData({ ...formData, ftcEventCode: e.target.value })} placeholder="e.g. USMIPRO" className={inputClass} />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="tournament-season" className={labelClass}>Season</label>
                <select id="tournament-season" value={formData.seasonId || ""} onChange={e => setFormData({ ...formData, seasonId: parseInt(e.target.value) })} className={inputClass + " appearance-none"}>
                  <option value="">Select Season</option>
                  {seasons.map((s: { startYear: number; challengeName: string }) => <option key={s.startYear} value={s.startYear}>{s.startYear} — {s.challengeName}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="tournament-robot" className={labelClass}>Robot</label>
                <select id="tournament-robot" value={formData.robotId || ""} onChange={e => setFormData({ ...formData, robotId: e.target.value })} className={inputClass + " appearance-none"}>
                  <option value="">Select Robot</option>
                  {robots.map((r: { id: string; name: string }) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label htmlFor="tournament-rank" className={labelClass}>Rank</label>
                <input id="tournament-rank" type="number" value={formData.rank || ""} onChange={e => setFormData({ ...formData, rank: parseInt(e.target.value) })} className={inputClass} />
              </div>
              <div>
                <label htmlFor="tournament-opr" className={labelClass}>OPR</label>
                <input id="tournament-opr" type="number" step="0.1" value={formData.opr || ""} onChange={e => setFormData({ ...formData, opr: parseFloat(e.target.value) })} className={inputClass} />
              </div>
              <div>
                <label htmlFor="tournament-alliance" className={labelClass}>Alliance Role</label>
                <input id="tournament-alliance" type="text" value={formData.allianceRole || ""} onChange={e => setFormData({ ...formData, allianceRole: e.target.value })} placeholder="Captain, Pick 1, etc." className={inputClass} />
              </div>
            </div>

            <div>
              <div className={labelClass}>Tournament Recap</div>
              <div className="border border-white/10 ares-cut overflow-hidden bg-obsidian">
                <RichTextEditor
                  key={editingId}
                  content={formData.ast ? JSON.parse(formData.ast as string) : ""}
                  onChange={(ast: Record<string, unknown>) => setFormData({ ...formData, ast: JSON.stringify(ast) })}
                  editable={true}
                />
              </div>
            </div>

            <div>
              <div className={labelClass}>Photo Album</div>
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => setIsAlbumPickerOpen(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 ares-cut-sm text-white text-sm font-bold transition-colors"
                >
                  <ImageIcon size={16} />
                  {formData.albumId ? "Change Album" : "Select Album"}
                </button>
                {formData.albumId && (
                  <span className="text-[10px] font-black uppercase tracking-widest text-ares-cyan flex items-center gap-1">
                    <ImageIcon size={12} /> Album Linked
                  </span>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="w-full py-5 font-black ares-cut-sm transition-all flex items-center justify-center gap-4 bg-ares-gold text-black hover:shadow-2xl hover:bg-white disabled:opacity-50 uppercase tracking-[0.3em] text-xs"
            >
              {isSaving ? "SYNCHRONIZING_BUFFER..." : editingId === "new" ? "COMMIT_TO_EVENT_REGISTRY" : "UPDATE_TOURNAMENT_RECORD"}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoading ? (
          <DashboardLoadingGrid count={3} heightClass="h-40" gridClass="grid-cols-1 md:grid-cols-2 lg:grid-cols-3" />
        ) : tournaments.map((tournament) => (
          <TournamentCard key={tournament.id} tournament={tournament} onEdit={handleEdit} onManage={setManagingId} />
        ))}
        {tournaments.length === 0 && !isLoading && !isFormOpen && (
          <DashboardEmptyState
            className="col-span-full py-12 text-center border-2 border-dashed border-white/10 ares-cut-lg"
            icon={<Trophy size={48} />}
            message="No tournaments archived. Start by adding your competition events."
          />
        )}
      </div>

      {isAlbumPickerOpen && (
        <AlbumPickerModal
          isOpen={true}
          onClose={() => setIsAlbumPickerOpen(false)}
          onSelect={(albumId: string) => {
            setFormData({ ...formData, albumId });
            setIsAlbumPickerOpen(false);
          }}
        />
      )}
    </div>
  );
}
