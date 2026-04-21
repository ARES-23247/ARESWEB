import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Trophy, Star, Calendar, MapPin, XCircle, Save } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface Award {
  id: string;
  title: string;
  year: number;
  event_name: string | null;
  image_url: string | null;
  description: string | null;
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
    description: ""
  });

  const { data: awards = [], isLoading } = useQuery<Award[]>({
    queryKey: ["admin-awards"],
    queryFn: async () => {
      const r = await fetch("/api/admin/awards");
      const d = await r.json() as { awards: Award[] };
      return d.awards || [];
    }
  });

  const saveMutation = useMutation({
    mutationFn: async (award: Partial<Award>) => {
      const r = await fetch("/api/admin/awards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(award)
      });
      if (!r.ok) throw new Error("Failed to save award");
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
      const r = await fetch(`/api/admin/awards/${id}`, { method: "DELETE" });
      if (!r.ok) throw new Error("Failed to delete award");
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
      <div className="flex justify-between items-center bg-black/40 border border-white/10 p-6 rounded-[2.5rem]">
        <div>
          <h2 className="text-2xl font-black text-white flex items-center gap-3 italic">
            <Trophy className="text-ares-gold" /> Trophy Case Management
          </h2>
          <p className="text-zinc-500 text-sm">Archiving the milestones of ARES 23247.</p>
        </div>
        <button
          onClick={() => setIsAdding(!isAdding)}
          className="flex items-center gap-2 px-4 py-2 bg-ares-red text-white font-bold ares-cut-sm hover:bg-ares-danger transition-colors shadow-lg shadow-ares-red/20"
        >
          {isAdding ? <XCircle size={18} /> : <Plus size={18} />}
          {isAdding ? "Cancel" : "Add Award"}
        </button>
      </div>

      <AnimatePresence>
        {isAdding && (
          <motion.form
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            onSubmit={handleSubmit}
            className="bg-zinc-900 border border-ares-gold/30 ares-cut-lg p-8 space-y-6 shadow-2xl"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="md:col-span-2 space-y-1">
                <label htmlFor="award-title" className="text-xs font-bold uppercase tracking-widest text-zinc-500">Award Title</label>
                <input
                  id="award-title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 ares-cut-sm px-4 py-3 text-white focus:border-ares-gold outline-none transition-colors"
                  placeholder="e.g. Excellence in Engineering"
                  required
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="award-year" className="text-xs font-bold uppercase tracking-widest text-zinc-500">Year</label>
                <input
                  id="award-year"
                  type="number"
                  value={formData.year}
                  onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value) })}
                  className="w-full bg-white/5 border border-white/10 ares-cut-sm px-4 py-3 text-white focus:border-ares-gold outline-none transition-colors"
                  required
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="award-eventName" className="text-xs font-bold uppercase tracking-widest text-zinc-500">Event Name</label>
                <input
                  id="award-eventName"
                  value={formData.event_name || ""}
                  onChange={(e) => setFormData({ ...formData, event_name: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 ares-cut-sm px-4 py-3 text-white focus:border-ares-gold outline-none transition-colors"
                  placeholder="e.g. West Virginia State Championship"
                />
              </div>
              <div className="md:col-span-2 space-y-1">
                <label htmlFor="award-image" className="text-xs font-bold uppercase tracking-widest text-zinc-500">Image URL (Optional)</label>
                <input
                  id="award-image"
                  value={formData.image_url || ""}
                  onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 ares-cut-sm px-4 py-3 text-white focus:border-ares-gold outline-none transition-colors"
                  placeholder="https://..."
                />
              </div>
              <div className="lg:col-span-3 space-y-1">
                <label htmlFor="award-desc" className="text-xs font-bold uppercase tracking-widest text-zinc-500">Description</label>
                <textarea
                  id="award-desc"
                  value={formData.description || ""}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 ares-cut-sm px-4 py-3 text-white focus:border-ares-gold outline-none transition-colors min-h-[100px]"
                  placeholder="Tell the story of how we won..."
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={saveMutation.isPending}
              className="w-full py-4 bg-gradient-to-r from-ares-gold to-yellow-600 text-black font-black ares-cut hover:shadow-[0_0_30px_rgba(255,191,0,0.3)] transition-all flex items-center justify-center gap-2"
            >
              {saveMutation.isPending ? "Syncing..." : <><Save size={20} /> Commemorate Achievement</>}
            </button>
          </motion.form>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {isLoading ? (
          <div className="h-48 bg-white/5 ares-cut-lg animate-pulse" />
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
              <div className="flex items-center gap-3 text-ares-gold text-[10px] font-black uppercase tracking-widest mb-2">
                 <span className="flex items-center gap-1"><Calendar size={12} /> {award.year}</span>
                 <span className="flex items-center gap-1">&middot; <Star size={12} className="fill-ares-gold" /> Blue Banner</span>
              </div>
              <h4 className="text-2xl font-black text-white mb-2 italic tracking-tighter">{award.title}</h4>
              <div className="flex items-center gap-2 text-zinc-500 text-xs font-bold mb-4">
                 <MapPin size={10} /> {award.event_name}
              </div>
              <p className="text-zinc-500 text-sm line-clamp-3 leading-relaxed">{award.description}</p>
            </div>

            <button
              onClick={() => { if(confirm("Purge this achievement from history?")) deleteMutation.mutate(award.id); }}
              className="absolute top-4 right-4 p-3 text-zinc-600 hover:text-ares-red transition-colors bg-white/5 ares-cut opacity-0 group-hover:opacity-100"
            >
              <Trash2 size={18} />
            </button>
          </div>
        ))}
        {awards.length === 0 && !isLoading && !isAdding && (
          <div className="col-span-full py-20 text-center border-2 border-dashed border-white/5 ares-cut-lg">
             <p className="text-zinc-600 font-medium italic">The trophy case is currently empty. Go win some banners!</p>
          </div>
        )}
      </div>
    </div>
  );
}
