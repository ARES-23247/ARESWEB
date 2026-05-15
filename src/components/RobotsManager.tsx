import React, { useState } from "react";
import { useGetRobots, useCreateRobot, useDeleteRobot, type Robot } from "../api/robots";
import { useGetSeasons } from "../api/seasons";
import { Save, Trash2, Plus, Edit } from "lucide-react";
import { RichTextEditor } from "./RichTextEditor";
import AlbumPickerModal from "./AlbumPickerModal";

export default function RobotsManager() {
  const { data: robotsData, isLoading } = useGetRobots();
  const { data: seasonsData } = useGetSeasons();
  const createRobot = useCreateRobot();
  const deleteRobot = useDeleteRobot();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<Robot>>({});
  const [isAlbumPickerOpen, setIsAlbumPickerOpen] = useState(false);

  if (isLoading) return <div className="p-8 text-white">Loading...</div>;

  const robots = robotsData?.robots || [];
  const seasons = seasonsData?.seasons || [];

  const handleEdit = (robot: Robot) => {
    setEditingId(robot.id);
    setFormData(robot);
  };

  const handleCreate = () => {
    setEditingId("new");
    setFormData({ name: "New Robot", weightLbs: null });
  };

  const handleSave = async () => {
    if (editingId === "new") {
      await createRobot.mutateAsync(formData);
    } else if (editingId) {
      await fetch(`/api/robots/${editingId}`, {
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
    await deleteRobot.mutateAsync(id);
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8 text-slate-200">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Robots Manager</h1>
        <button onClick={handleCreate} className="bg-blue-600 px-4 py-2 rounded-md flex items-center hover:bg-blue-500">
          <Plus className="w-5 h-5 mr-2" /> Add Robot
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {robots.map((robot) => (
          <div key={robot.id} className="bg-slate-800 p-6 rounded-lg shadow-lg flex flex-col justify-between">
            <div>
              <h2 className="text-2xl font-bold">{robot.name}</h2>
              <p className="text-slate-400 mt-2">Season: {robot.seasonId || "None"}</p>
              <div className="mt-4 flex gap-4 text-sm">
                <span>Weight: {robot.weightLbs ? `${robot.weightLbs} lbs` : "N/A"}</span>
                <span>Type: {robot.drivetrainType || "N/A"}</span>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-4">
              <button onClick={() => handleEdit(robot)} className="text-blue-400 hover:text-blue-300 flex items-center">
                <Edit className="w-4 h-4 mr-1" /> Edit
              </button>
              <button onClick={() => handleDelete(robot.id)} className="text-red-400 hover:text-red-300 flex items-center">
                <Trash2 className="w-4 h-4 mr-1" /> Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {editingId && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700 p-8 rounded-xl w-full max-w-4xl shadow-2xl my-8">
            <h2 className="text-2xl font-bold mb-6">{editingId === "new" ? "New Robot" : "Edit Robot"}</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <div className="block text-sm font-medium mb-1">Name</div>
                <input type="text" value={formData.name || ""} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full bg-slate-800 border-slate-700 rounded-md p-2" />
              </div>
              <div>
                <div className="block text-sm font-medium mb-1">Season</div>
                <select value={formData.seasonId || ""} onChange={e => setFormData({ ...formData, seasonId: parseInt(e.target.value) })} className="w-full bg-slate-800 border-slate-700 rounded-md p-2">
                  <option value="">Select Season</option>
                  {seasons.map((s: { startYear: number; challengeName: string }) => <option key={s.startYear} value={s.startYear}>{s.startYear} - {s.challengeName}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 mb-6">
              <div>
                <div className="block text-sm font-medium mb-1">Weight (lbs)</div>
                <input type="number" step="0.1" value={formData.weightLbs || ""} onChange={e => setFormData({ ...formData, weightLbs: parseFloat(e.target.value) })} className="w-full bg-slate-800 border-slate-700 rounded-md p-2" />
              </div>
              <div>
                <div className="block text-sm font-medium mb-1">Drivetrain</div>
                <input type="text" value={formData.drivetrainType || ""} onChange={e => setFormData({ ...formData, drivetrainType: e.target.value })} className="w-full bg-slate-800 border-slate-700 rounded-md p-2" />
              </div>
              <div>
                <div className="block text-sm font-medium mb-1">Primary Mechanism</div>
                <input type="text" value={formData.primaryMechanism || ""} onChange={e => setFormData({ ...formData, primaryMechanism: e.target.value })} className="w-full bg-slate-800 border-slate-700 rounded-md p-2" />
              </div>
              <div>
                <div className="block text-sm font-medium mb-1">Language</div>
                <input type="text" value={formData.programmingLanguage || ""} onChange={e => setFormData({ ...formData, programmingLanguage: e.target.value })} className="w-full bg-slate-800 border-slate-700 rounded-md p-2" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <div className="block text-sm font-medium mb-1">Onshape URL / CAD Viewer URL</div>
                <input type="text" value={formData.onshapeUrl || ""} onChange={e => setFormData({ ...formData, onshapeUrl: e.target.value })} placeholder="Onshape Share URL" className="w-full bg-slate-800 border-slate-700 rounded-md p-2 mb-2" />
                <input type="text" value={formData.cadViewerUrl || ""} onChange={e => setFormData({ ...formData, cadViewerUrl: e.target.value })} placeholder="Embeddable Viewer URL" className="w-full bg-slate-800 border-slate-700 rounded-md p-2" />
              </div>
              <div>
                <div className="block text-sm font-medium mb-1">Reveal Video ID (YouTube)</div>
                <input type="text" value={formData.revealVideoId || ""} onChange={e => setFormData({ ...formData, revealVideoId: e.target.value })} className="w-full bg-slate-800 border-slate-700 rounded-md p-2" />
              </div>
            </div>

            <div className="mb-6">
              <div className="block text-sm font-medium mb-2">Robot Description (Rich Text)</div>
              <div className="border border-slate-700 rounded-lg overflow-hidden bg-slate-800">
                <RichTextEditor
                  key={editingId}
                  content={formData.ast ? JSON.parse(formData.ast as string) : ""}
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
                <Save className="w-5 h-5 mr-2" /> Save Robot
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
