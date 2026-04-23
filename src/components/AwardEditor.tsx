import { useState } from "react";
import DashboardPageHeader from "./dashboard/DashboardPageHeader";
import DashboardEmptyState from "./dashboard/DashboardEmptyState";
import DashboardLoadingGrid from "./dashboard/DashboardLoadingGrid";
import { DashboardInput, DashboardTextarea, DashboardSubmitButton } from "./dashboard/DashboardFormInputs";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Trophy, Star, Calendar, MapPin, XCircle, Save } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { adminApi } from "../api/adminApi";

import SeasonPicker from "./SeasonPicker";

interface Award {
  id: string;
  title: string;
  year: number;
  event_name: string | null;
  image_url: string | null;
  description: string | null;
  season_id?: string;
}

export default function AwardEditor() {
  const queryCenter = useQueryClient();
  const [isAdding, setIsAdding] = useState(false);
  const [formData, setFormData] = useState<Partial<Award>>({
    id: "",
    title: "",
    year: new Date().getFullYear(),
    event_name: "",
    image_url: "",
    description: "",
    season_id: ""
  });

  const { data: awards = [], isLoading, isError } = useQuery<Award[]>({
    queryKey: ["admin-awards"],
    queryFn: async () => {
      const d = await adminApi.get<{ awards: Award[] }>("/api/admin/awards");
      return d.awards || [];
    }
  });

  const saveMutation = useMutation({
    mutationFn: async (award: Partial<Award>) => {
      await adminApi.request("/api/admin/awards", {
        method: "POST",
        body: JSON.stringify(award)
      });
    },
    onSuccess: () => {
      queryCenter.invalidateQueries({ queryKey: ["admin-awards"] });
      setIsAdding(false);
      setFormData({ 
        id: "", title: "", year: new Date().getFullYear(), 
        event_name: "", image_url: "", description: "" 
      });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await adminApi.request(`/api/admin/awards/${id}`, { method: "DELETE" });
    },
    onSuccess: () => queryCenter.invalidateQueries({ queryKey: ["admin-awards"] })
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.year) return;
    const finalId = formData.id || `${formData.year}-${formData.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
    saveMutation.mutate({ ...formData, id: finalId });
  };

  return (
    <div className="space-y-8">
      <DashboardPageHeader
        title="Trophy Case Management"
        subtitle="Archiving the milestones of ARES 23247."
        icon={<Trophy className="text-ares-gold" />}
        italicTitle={true}
        action={
          <button
            onClick={() => setIsAdding(!isAdding)}
            className="flex items-center gap-2 px-4 py-2 bg-ares-red text-white font-bold ares-cut-sm hover:bg-ares-danger transition-colors shadow-lg shadow-ares-red/20"
          >
            {isAdding ? <XCircle size={18} /> : <Plus size={18} />}
            {isAdding ? "Cancel" : "Add Award"}
          </button>
        }
      />

      {isError && (
        <div className="bg-ares-red/10 border border-ares-red/30 p-4 ares-cut-sm text-ares-red text-xs font-bold mb-6 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-ares-red animate-pulse" />
          TELEMETRY FAULT: Failed to synchronize achievement records.
        </div>
      )}

      <AnimatePresence>
        {isAdding && (
          <motion.form
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            onSubmit={handleSubmit}
            className="bg-obsidian border border-ares-gold/30 ares-cut-lg p-8 space-y-6 shadow-2xl"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <DashboardInput
                id="award-title"
                label="Award Title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="e.g. Excellence in Engineering"
                focusColor="ares-gold"
                fullWidth
                required
              />
              <DashboardInput
                id="award-year"
                type="number"
                label="Year"
                value={formData.year}
                onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value) })}
                focusColor="ares-gold"
                required
              />
              <DashboardInput
                id="award-eventName"
                label="Event Name"
                value={formData.event_name || ""}
                onChange={(e) => setFormData({ ...formData, event_name: e.target.value })}
                placeholder="e.g. West Virginia State Championship"
                focusColor="ares-gold"
              />
              <SeasonPicker value={formData.season_id} onChange={(val) => setFormData({ ...formData, season_id: val })} />
              <DashboardInput
                id="award-image"
                label="Image URL (Optional)"
                value={formData.image_url || ""}
                onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                placeholder="https://..."
                focusColor="ares-gold"
                fullWidth
              />
              <DashboardTextarea
                id="award-desc"
                label="Description"
                value={formData.description || ""}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Tell the story of how we won..."
                focusColor="ares-gold"
                fullWidth
              />
            </div>
            <DashboardSubmitButton 
              isPending={saveMutation.isPending} 
              defaultText="Commemorate Achievement" 
              icon={<Save size={20} />} 
              theme="gold" 
            />
          </motion.form>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {isLoading ? (
          <DashboardLoadingGrid count={2} heightClass="h-48" gridClass="grid-cols-1 lg:grid-cols-2" />
        ) : awards.map((award) => (
          <div key={award.id} className="bg-black/40 border border-white/5 rounded-[2.5rem] p-8 group hover:border-ares-gold/30 transition-all flex flex-col md:flex-row gap-8 relative overflow-hidden">
            {/* Background Glow */}
            <div className="absolute -top-12 -right-12 w-32 h-32 bg-ares-gold/5 blur-3xl rounded-full pointer-events-none" />
            
            {award.image_url ? (
              <div className="w-full md:w-32 h-32 bg-white/5 ares-cut overflow-hidden flex-shrink-0 border border-white/10">
                <img src={award.image_url} alt={award.title} className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className="w-full md:w-32 h-32 bg-white/5 ares-cut flex items-center justify-center flex-shrink-0 border border-white/10">
                <Trophy size={48} className="text-ares-gold/20" />
              </div>
            )}

            <div className="flex-1">
              <div className="flex items-center gap-3 text-ares-gold text-xs font-black uppercase tracking-widest mb-2">
                 <span className="flex items-center gap-1"><Calendar size={12} /> {award.year}</span>
                 <span className="flex items-center gap-1">&middot; <Star size={12} className="fill-ares-gold" /> Blue Banner</span>
              </div>
              <h4 className="text-2xl font-black text-white mb-2 italic tracking-tighter">{award.title}</h4>
              <div className="flex items-center gap-2 text-ares-gray text-xs font-bold mb-4">
                 <MapPin size={10} /> {award.event_name}
              </div>
              <p className="text-ares-gray text-sm line-clamp-3 leading-relaxed">{award.description}</p>
            </div>

            <button
              onClick={() => { if(confirm("Purge this achievement from history?")) deleteMutation.mutate(award.id); }}
              className="absolute top-4 right-4 p-3 text-ares-gray hover:text-ares-red transition-colors bg-white/5 ares-cut opacity-0 group-hover:opacity-100"
            >
              <Trash2 size={18} />
            </button>
          </div>
        ))}
        {awards.length === 0 && !isLoading && !isAdding && (
          <DashboardEmptyState
            className="col-span-full py-20 text-center border-2 border-dashed border-white/5 ares-cut-lg"
            icon={<Trophy size={48} />}
            message="The trophy case is currently empty. Go win some banners!"
          />
        )}
      </div>
    </div>
  );
}
