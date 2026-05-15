import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useGetRobots, useCreateRobot, useDeleteRobot, type Robot } from "../api/robots";
import { useGetSeasons } from "../api/seasons";
import { Plus, Trash2, Edit2, XCircle, Bot, Cpu, Wrench, Code2, RefreshCw, Video, Link2, ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { RichTextEditor } from "./RichTextEditor";
import AlbumPickerModal from "./AlbumPickerModal";
import DashboardPageHeader from "./dashboard/DashboardPageHeader";
import DashboardEmptyState from "./dashboard/DashboardEmptyState";
import DashboardLoadingGrid from "./dashboard/DashboardLoadingGrid";
import { DashboardSubmitButton } from "./ui/forms/DashboardSubmitButton";
import { useModal } from "../contexts/ModalContext";

interface RobotCardProps {
  robot: Robot;
  onEdit: (r: Robot) => void;
}

function RobotCard({ robot, onEdit }: RobotCardProps) {
  const deleteRobot = useDeleteRobot();
  const modal = useModal();

  const handleDelete = async () => {
    const confirmed = await modal.confirm({
      title: "Decommission Robot",
      description: `Are you sure you want to permanently remove "${robot.name}" from the ARES fleet registry?`,
      confirmText: "Decommission",
      destructive: true
    });
    if (confirmed) {
      deleteRobot.mutate(robot.id, {
        onSuccess: () => toast.success(`${robot.name} removed from fleet registry.`)
      });
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-black/40 border border-white/5 ares-cut-lg p-6 relative group transition-all hover:border-white/20"
    >
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-2">
          <Bot className="text-ares-cyan" size={16} />
          <span className="text-[10px] font-black uppercase tracking-widest text-ares-cyan">
            {robot.drivetrainType || "UNCLASSIFIED"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onEdit(robot)}
            disabled={deleteRobot.isPending}
            aria-label={`Edit ${robot.name}`}
            className="text-white/60 hover:text-ares-cyan transition-colors disabled:opacity-30"
          >
            <Edit2 size={16} />
          </button>
          <button
            onClick={handleDelete}
            disabled={deleteRobot.isPending}
            aria-label={`Delete ${robot.name}`}
            className="text-white/60 hover:text-ares-red transition-colors disabled:opacity-30"
          >
            {deleteRobot.isPending ? <RefreshCw size={16} className="animate-spin" /> : <Trash2 size={16} />}
          </button>
        </div>
      </div>

      <h4 className="text-lg font-bold text-white mb-2">{robot.name}</h4>

      <div className="flex flex-wrap gap-3 text-[10px] font-black uppercase tracking-widest text-marble/40 mt-3">
        {robot.weightLbs && (
          <span className="flex items-center gap-1">
            <Wrench size={10} /> {robot.weightLbs} lbs
          </span>
        )}
        {robot.programmingLanguage && (
          <span className="flex items-center gap-1">
            <Code2 size={10} /> {robot.programmingLanguage}
          </span>
        )}
        {robot.primaryMechanism && (
          <span className="flex items-center gap-1">
            <Cpu size={10} /> {robot.primaryMechanism}
          </span>
        )}
      </div>

      <div className="flex items-center gap-3 mt-4 pt-3 border-t border-white/5">
        {robot.revealVideoId && (
          <div className="text-[10px] font-black uppercase tracking-widest text-ares-gold flex items-center gap-1">
            <Video size={12} /> Reveal Video
          </div>
        )}
        {robot.onshapeUrl && (
          <div className="text-[10px] font-black uppercase tracking-widest text-ares-cyan flex items-center gap-1">
            <Link2 size={12} /> CAD
          </div>
        )}
        {robot.albumId && (
          <div className="text-[10px] font-black uppercase tracking-widest text-green-400 flex items-center gap-1">
            <ImageIcon size={12} /> Album
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default function RobotsManager() {
  const queryClient = useQueryClient();
  const { data: robotsData, isLoading } = useGetRobots();
  const { data: seasonsData } = useGetSeasons();
  const createRobot = useCreateRobot();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<Robot>>({});
  const [isAlbumPickerOpen, setIsAlbumPickerOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const robots = robotsData?.robots || [];
  const seasons = seasonsData?.seasons || [];

  const handleEdit = (robot: Robot) => {
    setEditingId(robot.id);
    setFormData(robot);
    setIsFormOpen(true);
  };

  const handleCreate = () => {
    setEditingId("new");
    setFormData({ name: "", weightLbs: null });
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
        await createRobot.mutateAsync(formData);
        toast.success("Robot deployed to fleet registry.");
      } else if (editingId) {
        await fetch(`/api/robots/${editingId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        });
        queryClient.invalidateQueries({ queryKey: ["robots"] });
        toast.success("Robot record updated.");
      }
      handleCancel();
    } catch {
      toast.error("Failed to save robot record.");
    } finally {
      setIsSaving(false);
    }
  };

  const inputClass = "w-full bg-obsidian border border-white/10 ares-cut-sm px-4 py-3 text-white placeholder-white/40 focus:border-ares-red focus:outline-none focus:ring-1 focus:ring-ares-red transition-all";
  const labelClass = "block text-xs font-bold text-white/60 uppercase tracking-wider mb-2";

  return (
    <div className="space-y-8">
      <DashboardPageHeader
        title="Robot Fleet Registry"
        subtitle="Manage the ARES combat fleet — track specifications, CAD, and competition history."
        icon={<Bot className="text-ares-cyan" />}
        action={
          <button
            onClick={isFormOpen ? handleCancel : handleCreate}
            className={`flex items-center gap-2 px-4 py-2 font-bold ares-cut-sm transition-all shadow-lg ${isFormOpen ? 'bg-obsidian border border-white/10 text-white' : 'bg-ares-red text-white hover:bg-ares-danger shadow-ares-red/20'}`}
          >
            {isFormOpen ? <XCircle size={18} /> : <Plus size={18} />}
            {isFormOpen ? "Cancel" : "Deploy Robot"}
          </button>
        }
      />

      {/* Stats */}
      {!isFormOpen && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { label: "Fleet Size", val: robots.length, icon: <Bot size={16} /> },
            { label: "With CAD", val: robots.filter(r => r.onshapeUrl || r.cadViewerUrl).length, icon: <Link2 size={16} className="text-ares-cyan" /> },
            { label: "With Video", val: robots.filter(r => r.revealVideoId).length, icon: <Video size={16} className="text-ares-gold" /> }
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
              {editingId === "new" ? "Deploy New Robot" : "Edit Fleet Record"}
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="robot-name" className={labelClass}>Robot Name</label>
                <input id="robot-name" type="text" value={formData.name || ""} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="e.g. Phobos" className={inputClass} />
              </div>
              <div>
                <label htmlFor="robot-season" className={labelClass}>Season</label>
                <select id="robot-season" value={formData.seasonId || ""} onChange={e => setFormData({ ...formData, seasonId: parseInt(e.target.value) })} className={inputClass + " appearance-none"}>
                  <option value="">Select Season</option>
                  {seasons.map((s: { startYear: number; challengeName: string }) => <option key={s.startYear} value={s.startYear}>{s.startYear} — {s.challengeName}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label htmlFor="robot-weight" className={labelClass}>Weight (lbs)</label>
                <input id="robot-weight" type="number" step="0.1" value={formData.weightLbs || ""} onChange={e => setFormData({ ...formData, weightLbs: parseFloat(e.target.value) })} className={inputClass} />
              </div>
              <div>
                <label htmlFor="robot-drivetrain" className={labelClass}>Drivetrain</label>
                <input id="robot-drivetrain" type="text" value={formData.drivetrainType || ""} onChange={e => setFormData({ ...formData, drivetrainType: e.target.value })} placeholder="e.g. Mecanum" className={inputClass} />
              </div>
              <div>
                <label htmlFor="robot-mechanism" className={labelClass}>Primary Mechanism</label>
                <input id="robot-mechanism" type="text" value={formData.primaryMechanism || ""} onChange={e => setFormData({ ...formData, primaryMechanism: e.target.value })} placeholder="e.g. Dual Claw" className={inputClass} />
              </div>
              <div>
                <label htmlFor="robot-language" className={labelClass}>Language</label>
                <input id="robot-language" type="text" value={formData.programmingLanguage || ""} onChange={e => setFormData({ ...formData, programmingLanguage: e.target.value })} placeholder="e.g. Java" className={inputClass} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="robot-onshape" className={labelClass}>Onshape / CAD URLs</label>
                <input id="robot-onshape" type="text" value={formData.onshapeUrl || ""} onChange={e => setFormData({ ...formData, onshapeUrl: e.target.value })} placeholder="Onshape Share URL" className={inputClass + " mb-2"} />
                <input type="text" value={formData.cadViewerUrl || ""} onChange={e => setFormData({ ...formData, cadViewerUrl: e.target.value })} placeholder="Embeddable Viewer URL" className={inputClass} aria-label="CAD Viewer URL" />
              </div>
              <div>
                <label htmlFor="robot-video" className={labelClass}>Reveal Video ID (YouTube)</label>
                <input id="robot-video" type="text" value={formData.revealVideoId || ""} onChange={e => setFormData({ ...formData, revealVideoId: e.target.value })} placeholder="e.g. dQw4w9WgXcQ" className={inputClass} />
              </div>
            </div>

            <div>
              <div className={labelClass}>Robot Description</div>
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

            <DashboardSubmitButton
              isPending={isSaving}
              defaultText={editingId === "new" ? "Deploy to Fleet Registry" : "Update Fleet Record"}
              theme="cyan"
            />
            {/* Wrap in a form-like click handler since DashboardSubmitButton is type=submit */}
            <div className="hidden">
              <form onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
                <button type="submit" />
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Actually use a wrapping form */}
      {isFormOpen && (
        <div className="-mt-8">
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className={`w-full py-4 font-black ares-cut transition-all flex items-center justify-center gap-2 bg-ares-cyan text-black hover:shadow-[0_0_30px_rgba(0,255,255,0.3)] disabled:opacity-50`}
          >
            {isSaving ? "Syncing..." : editingId === "new" ? "Deploy to Fleet Registry" : "Update Fleet Record"}
          </button>
        </div>
      )}

      {/* Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoading ? (
          <DashboardLoadingGrid count={3} heightClass="h-40" gridClass="grid-cols-1 md:grid-cols-2 lg:grid-cols-3" />
        ) : robots.map((robot) => (
          <RobotCard key={robot.id} robot={robot} onEdit={handleEdit} />
        ))}
        {robots.length === 0 && !isLoading && !isFormOpen && (
          <DashboardEmptyState
            className="col-span-full py-12 text-center border-2 border-dashed border-white/10 ares-cut-lg"
            icon={<Bot size={48} />}
            message="No robots deployed. Start by adding your competition fleet."
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
