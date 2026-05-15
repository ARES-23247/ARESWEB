import React, { useState } from "react";
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
import { Save, Trash2, Plus, Edit, RefreshCw } from "lucide-react";
import { RichTextEditor } from "./RichTextEditor";
import AlbumPickerModal from "./AlbumPickerModal";

function TournamentDetailEditor({ tournamentId, onBack }: { tournamentId: string, onBack: () => void }) {
  const { data, isLoading } = useGetTournament(tournamentId);
  const syncMatches = useSyncTournamentMatches(tournamentId);

  if (isLoading) return <div>Loading details...</div>;

  const t = data?.tournament;
  const matches = data?.matches || [];
  const awards = data?.awards || [];

  return (
    <div className="bg-slate-900 border border-slate-700 p-8 rounded-xl w-full">
      <div className="flex justify-between mb-6 border-b border-slate-700 pb-4">
        <h2 className="text-2xl font-bold">{t?.name} - Details</h2>
        <button onClick={onBack} className="text-slate-400 hover:text-white">Back to List</button>
      </div>

      <div className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-semibold">Match Results ({matches.length})</h3>
          <button 
            onClick={() => syncMatches.mutateAsync()} 
            disabled={syncMatches.isPending}
            className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded text-sm flex items-center disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${syncMatches.isPending ? "animate-spin" : ""}`} />
            Sync from FTC Events
          </button>
        </div>
        
        {matches.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-800 text-slate-400">
                <tr>
                  <th className="p-3 rounded-tl-lg">Match</th>
                  <th className="p-3">Red Score</th>
                  <th className="p-3">Blue Score</th>
                  <th className="p-3 rounded-tr-lg">YouTube ID</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {matches.map(m => (
                  <tr key={m.id} className="hover:bg-slate-800/50">
                    <td className="p-3 font-medium">{m.matchType}</td>
                    <td className="p-3 text-red-400">{m.redScore}</td>
                    <td className="p-3 text-blue-400">{m.blueScore}</td>
                    <td className="p-3 text-slate-400">{m.youtubeVideoId || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-slate-500 italic p-4 bg-slate-800/30 rounded border border-slate-800">
            No matches found. Ensure the FTC Event Code is correct and click Sync.
          </div>
        )}
      </div>

      <div>
        <h3 className="text-xl font-semibold mb-4">Awards ({awards.length})</h3>
        {/* We would have a sub-form here for awards, keeping it simple for the MVP */}
        <p className="text-slate-400 text-sm">Award management can be added here.</p>
      </div>
    </div>
  );
}

export default function TournamentsManager() {
  const { data: tournamentsData, isLoading } = useGetTournaments();
  const { data: seasonsData } = useGetSeasons();
  const { data: robotsData } = useGetRobots();
  
  const createTournament = useCreateTournament();
  const deleteTournament = useDeleteTournament();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [managingId, setManagingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<Tournament>>({});
  const [isAlbumPickerOpen, setIsAlbumPickerOpen] = useState(false);

  if (isLoading) return <div className="p-8 text-white">Loading...</div>;

  const tournaments = tournamentsData?.tournaments || [];
  const seasons = seasonsData?.seasons || [];
  const robots = robotsData?.robots || [];

  const handleEdit = (tournament: Tournament) => {
    setEditingId(tournament.id);
    setFormData(tournament);
  };

  const handleCreate = () => {
    setEditingId("new");
    setFormData({ name: "New Tournament" });
  };

  const handleSave = async () => {
    if (editingId === "new") {
      await createTournament.mutateAsync(formData);
    } else if (editingId) {
      await fetch(`/api/tournaments/${editingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      window.location.reload();
    }
    setEditingId(null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure?")) return;
    await deleteTournament.mutateAsync(id);
  };

  if (managingId) {
    return (
      <div className="p-8 max-w-6xl mx-auto text-slate-200">
        <TournamentDetailEditor tournamentId={managingId} onBack={() => setManagingId(null)} />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8 text-slate-200">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Tournaments Manager</h1>
        <button onClick={handleCreate} className="bg-blue-600 px-4 py-2 rounded-md flex items-center hover:bg-blue-500">
          <Plus className="w-5 h-5 mr-2" /> Add Tournament
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {tournaments.map((tournament) => (
          <div key={tournament.id} className="bg-slate-800 p-6 rounded-lg shadow-lg flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold">{tournament.name}</h2>
              <div className="mt-2 flex gap-4 text-sm text-slate-400">
                <span>FTC Code: {tournament.ftcEventCode || "None"}</span>
                <span>Season: {tournament.seasonId || "None"}</span>
                <span>Rank: {tournament.rank || "-"}</span>
              </div>
            </div>
            <div className="flex gap-4">
              <button onClick={() => setManagingId(tournament.id)} className="bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded">
                Manage Matches
              </button>
              <button onClick={() => handleEdit(tournament)} className="text-blue-400 hover:text-blue-300 flex items-center">
                <Edit className="w-4 h-4 mr-1" /> Edit
              </button>
              <button onClick={() => handleDelete(tournament.id)} className="text-red-400 hover:text-red-300 flex items-center">
                <Trash2 className="w-4 h-4 mr-1" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {editingId && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700 p-8 rounded-xl w-full max-w-4xl shadow-2xl my-8">
            <h2 className="text-2xl font-bold mb-6">{editingId === "new" ? "New Tournament" : "Edit Tournament"}</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <div className="block text-sm font-medium mb-1">Name</div>
                <input type="text" value={formData.name || ""} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full bg-slate-800 border-slate-700 rounded-md p-2" />
              </div>
              <div>
                <div className="block text-sm font-medium mb-1">FTC Event Code (for API sync)</div>
                <input type="text" value={formData.ftcEventCode || ""} onChange={e => setFormData({ ...formData, ftcEventCode: e.target.value })} placeholder="e.g. USMIPRO" className="w-full bg-slate-800 border-slate-700 rounded-md p-2" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
              <div>
                <div className="block text-sm font-medium mb-1">Season</div>
                <select value={formData.seasonId || ""} onChange={e => setFormData({ ...formData, seasonId: parseInt(e.target.value) })} className="w-full bg-slate-800 border-slate-700 rounded-md p-2">
                  <option value="">Select Season</option>
                  {seasons.map((s: { startYear: number; challengeName: string }) => <option key={s.startYear} value={s.startYear}>{s.startYear} - {s.challengeName}</option>)}
                </select>
              </div>
              <div>
                <div className="block text-sm font-medium mb-1">Robot</div>
                <select value={formData.robotId || ""} onChange={e => setFormData({ ...formData, robotId: e.target.value })} className="w-full bg-slate-800 border-slate-700 rounded-md p-2">
                  <option value="">Select Robot</option>
                  {robots.map((r: { id: string; name: string }) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-6">
              <div>
                <div className="block text-sm font-medium mb-1">Rank</div>
                <input type="number" value={formData.rank || ""} onChange={e => setFormData({ ...formData, rank: parseInt(e.target.value) })} className="w-full bg-slate-800 border-slate-700 rounded-md p-2" />
              </div>
              <div>
                <div className="block text-sm font-medium mb-1">OPR</div>
                <input type="number" step="0.1" value={formData.opr || ""} onChange={e => setFormData({ ...formData, opr: parseFloat(e.target.value) })} className="w-full bg-slate-800 border-slate-700 rounded-md p-2" />
              </div>
              <div>
                <div className="block text-sm font-medium mb-1">Alliance Role</div>
                <input type="text" value={formData.allianceRole || ""} onChange={e => setFormData({ ...formData, allianceRole: e.target.value })} placeholder="Captain, Pick 1, etc." className="w-full bg-slate-800 border-slate-700 rounded-md p-2" />
              </div>
            </div>

            <div className="mb-6">
              <div className="block text-sm font-medium mb-2">Tournament Recap (Rich Text)</div>
              <div className="border border-slate-700 rounded-lg overflow-hidden bg-slate-800">
                <RichTextEditor
                  key={editingId}
                  content={formData.ast ? JSON.parse(formData.ast) : ""}
                  onChange={(ast: Record<string, unknown>) => setFormData({ ...formData, ast: JSON.stringify(ast) })}
                  editable={true}
                />
              </div>
            </div>

            <div className="mb-8">
              <div className="block text-sm font-medium mb-2">Attached Album</div>
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => setIsAlbumPickerOpen(true)}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded text-sm"
                >
                  {formData.albumId ? "Change Album" : "Select Album"}
                </button>
                {formData.albumId && (
                  <span className="text-sm text-slate-400">Selected ID: {formData.albumId}</span>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-4 mt-8 pt-6 border-t border-slate-700">
              <button onClick={() => setEditingId(null)} className="px-6 py-2 text-slate-400 hover:text-white transition-colors">
                Cancel
              </button>
              <button onClick={handleSave} className="bg-green-600 hover:bg-green-500 px-6 py-2 rounded-md flex items-center transition-colors">
                <Save className="w-5 h-5 mr-2" /> Save
              </button>
            </div>
          </div>
        </div>
      )}

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
