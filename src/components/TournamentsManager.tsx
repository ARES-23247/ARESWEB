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
import { RichTextEditor } from "./RichTextEditor";
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
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-black/40 border border-white/10 p-6 ares-cut mb-2">
        <div>
          <h2 className="text-2xl font-black text-white flex items-center gap-3">
            <Trophy className="text-ares-gold" /> {t?.name} — Details
          </h2>
          <p className="text-marble/50 text-sm mt-1">Match results, awards, and FTC Events API synchronization.</p>
        </div>
        <button
          onClick={onBack}
          className="mt-4 md:mt-0 flex items-center gap-2 px-4 py-2 font-bold ares-cut-sm bg-obsidian border border-white/10 text-white hover:border-white/30 transition-all"
        >
          <ArrowLeft size={16} /> Back to List
        </button>
      </div>

      {/* Matches */}
      <div className="bg-black/40 border border-white/10 ares-cut-lg p-6">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-black text-white flex items-center gap-2">
            <Swords size={18} className="text-ares-red" /> Match Results ({matches.length})
          </h3>
          <button
            onClick={() => syncMatches.mutateAsync().then(() => toast.success("Match data synchronized from FTC Events API."))}
            disabled={syncMatches.isPending}
            className="flex items-center gap-2 px-4 py-2 font-bold ares-cut-sm bg-ares-red text-white hover:bg-ares-danger shadow-ares-red/20 shadow-lg disabled:opacity-50 transition-all text-sm"
          >
            <RefreshCw size={14} className={syncMatches.isPending ? "animate-spin" : ""} />
            Sync from FTC Events
          </button>
        </div>

        {matches.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="p-3 text-[10px] font-black uppercase tracking-widest text-marble/40">Match</th>
                  <th className="p-3 text-[10px] font-black uppercase tracking-widest text-marble/40">Red Score</th>
                  <th className="p-3 text-[10px] font-black uppercase tracking-widest text-marble/40">Blue Score</th>
                  <th className="p-3 text-[10px] font-black uppercase tracking-widest text-marble/40">Video</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {matches.map(m => (
                  <tr key={m.id} className="hover:bg-white/5 transition-colors">
                    <td className="p-3 font-bold text-white">{m.matchType}</td>
                    <td className="p-3 text-ares-red font-bold">{m.redScore}</td>
                    <td className="p-3 text-ares-cyan font-bold">{m.blueScore}</td>
                    <td className="p-3">
                      {m.youtubeVideoId ? (
                        <a href={`https://youtube.com/watch?v=${m.youtubeVideoId}`} target="_blank" rel="noreferrer" className="text-ares-gold hover:text-ares-gold/80 flex items-center gap-1">
                          <Video size={14} /> Watch
                        </a>
                      ) : (
                        <span className="text-marble/30">—</span>
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
            className="py-8 text-center border-2 border-dashed border-white/5 ares-cut-lg"
          />
        )}
      </div>

      {/* Awards */}
      <div className="bg-black/40 border border-white/10 ares-cut-lg p-6">
        <h3 className="text-lg font-black text-white flex items-center gap-2 mb-4">
          <Award size={18} className="text-ares-gold" /> Awards ({awards.length})
        </h3>
        {awards.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {awards.map((a) => (
              <div key={a.id} className="bg-obsidian/50 border border-white/5 p-4 ares-cut-sm flex items-center gap-3">
                <Award size={16} className="text-ares-gold flex-shrink-0" />
                <div>
                  <div className="text-sm font-bold text-white">{a.name}</div>
                  {a.placement && <div className="text-[10px] text-marble/40 mt-1">{a.placement}</div>}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-marble/40 text-sm italic">No awards recorded for this tournament.</p>
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
      className="bg-black/40 border border-white/5 ares-cut-lg p-6 transition-all hover:border-white/20 group"
    >
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center gap-2">
          <Trophy className="text-ares-gold" size={16} />
          <span className="text-[10px] font-black uppercase tracking-widest text-ares-gold">
            {t.ftcEventCode || "NO EVENT CODE"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onEdit(t)}
            disabled={deleteTournament.isPending}
            aria-label={`Edit ${t.name}`}
            className="text-white/60 hover:text-ares-cyan transition-colors disabled:opacity-30"
          >
            <Edit2 size={16} />
          </button>
          <button
            onClick={handleDelete}
            disabled={deleteTournament.isPending}
            aria-label={`Delete ${t.name}`}
            className="text-white/60 hover:text-ares-red transition-colors disabled:opacity-30"
          >
            {deleteTournament.isPending ? <RefreshCw size={16} className="animate-spin" /> : <Trash2 size={16} />}
          </button>
        </div>
      </div>

      <h4 className="text-lg font-bold text-white mb-2">{t.name}</h4>

      <div className="flex flex-wrap gap-3 text-[10px] font-black uppercase tracking-widest text-marble/40">
        {t.rank && (
          <span className="flex items-center gap-1">
            <Hash size={10} /> Rank {t.rank}
          </span>
        )}
        {t.opr && (
          <span className="flex items-center gap-1">
            <BarChart3 size={10} /> OPR {t.opr}
          </span>
        )}
        {t.allianceRole && (
          <span className="flex items-center gap-1">
            <Swords size={10} /> {t.allianceRole}
          </span>
        )}
      </div>

      <div className="mt-4 pt-3 border-t border-white/5">
        <button
          onClick={() => onManage(t.id)}
          className="flex items-center gap-2 px-4 py-2 w-full justify-center bg-white/5 hover:bg-white/10 border border-white/10 ares-cut-sm text-white text-sm font-bold transition-colors"
        >
          <Swords size={14} /> Manage Matches & Awards
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

  const inputClass = "w-full bg-obsidian border border-white/10 ares-cut-sm px-4 py-3 text-white placeholder-white/40 focus:border-ares-red focus:outline-none focus:ring-1 focus:ring-ares-red transition-all";
  const labelClass = "block text-xs font-bold text-white/60 uppercase tracking-wider mb-2";

  return (
    <div className="space-y-8">
      <DashboardPageHeader
        title="Tournament Archive"
        subtitle="Track competition history, match results, and awards across all ARES seasons."
        icon={<Trophy className="text-ares-gold" />}
        action={
          <button
            onClick={isFormOpen ? handleCancel : handleCreate}
            className={`flex items-center gap-2 px-4 py-2 font-bold ares-cut-sm transition-all shadow-lg ${isFormOpen ? 'bg-obsidian border border-white/10 text-white' : 'bg-ares-red text-white hover:bg-ares-danger shadow-ares-red/20'}`}
          >
            {isFormOpen ? <XCircle size={18} /> : <Plus size={18} />}
            {isFormOpen ? "Cancel" : "Add Tournament"}
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
            <div key={i} className="bg-obsidian/50 border border-white/5 p-4 ares-cut-sm">
              <div className="flex items-center gap-2 text-marble/40 mb-1">
                {stat.icon}
                <span className="text-[10px] font-black uppercase tracking-widest">{stat.label}</span>
              </div>
              <div className="text-xl font-black text-white">{stat.val}</div>
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
              className="w-full py-4 font-black ares-cut transition-all flex items-center justify-center gap-2 bg-ares-gold text-black hover:shadow-[0_0_30px_rgba(255,191,0,0.3)] disabled:opacity-50"
            >
              {isSaving ? "Syncing..." : editingId === "new" ? "Archive to Event Registry" : "Update Tournament Record"}
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
