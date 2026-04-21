import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Globe, ShieldCheck, Award, Zap, Gem, CheckCircle2, XCircle, Edit2, Package } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface Sponsor {
  id: string;
  name: string;
  tier: string;
  logo_url: string | null;
  website_url: string | null;
  is_active: number;
}

const TIERS = [
  { name: "Titanium", icon: <Gem className="text-ares-cyan" />, color: "text-ares-cyan", border: "border-ares-cyan/30" },
  { name: "Gold", icon: <Award className="text-ares-gold" />, color: "text-ares-gold", border: "border-ares-gold/30" },
  { name: "Silver", icon: <ShieldCheck className="text-zinc-400" />, color: "text-zinc-400", border: "border-zinc-400/30" },
  { name: "Bronze", icon: <Zap className="text-ares-bronze" />, color: "text-ares-bronze", border: "border-ares-bronze/30" },
  { name: "In-Kind", icon: <Package className="text-emerald-500" />, color: "text-emerald-500", border: "border-emerald-500/30" },
];

export default function SponsorEditor() {
  const queryClient = useQueryClient();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formData, setFormData] = useState<Partial<Sponsor>>({
    id: "",
    name: "",
    tier: "Gold",
    logo_url: "",
    website_url: "",
    is_active: 1
  });

  const { data: sponsors = [], isLoading } = useQuery<Sponsor[]>({
    queryKey: ["admin-sponsors"],
    queryFn: async () => {
      const r = await fetch("/api/admin/sponsors", { cache: "no-store" });
      const d = await r.json() as { sponsors?: Sponsor[] };
      return d.sponsors || [];
    }
  });

  const saveMutation = useMutation({
    mutationFn: async (sponsor: Partial<Sponsor>) => {
      const r = await fetch("/api/admin/sponsors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sponsor)
      });
      if (!r.ok) throw new Error("Failed to save sponsor");
    },
    onError: (err: Error) => {
      alert(`[Failure Exposure] Sponsor sync failed: \n${err.message}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-sponsors"] });
      setIsFormOpen(false);
      setFormData({ id: "", name: "", tier: "Gold", logo_url: "", website_url: "", is_active: 1 });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/admin/sponsors/${id}`, { method: "DELETE" });
      if (!r.ok) throw new Error("Failed to delete sponsor");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-sponsors"] })
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.tier) return;
    const finalId = formData.id || formData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    saveMutation.mutate({ ...formData, id: finalId });
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-black text-white flex items-center gap-3">
            <Gem className="text-ares-cyan" />
            Sponsor Management
          </h2>
          <p className="text-zinc-500 text-sm">Recognize the partners who make ARES possible.</p>
        </div>
        <button
          onClick={() => {
            if (!isFormOpen) setFormData({ id: "", name: "", tier: "Gold", logo_url: "", website_url: "", is_active: 1 });
            setIsFormOpen(!isFormOpen);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-ares-red text-white font-bold ares-cut-sm hover:bg-red-700 transition-colors shadow-lg shadow-ares-red/20"
        >
          {isFormOpen ? <XCircle size={18} /> : <Plus size={18} />}
          {isFormOpen ? "Cancel" : "Add Partner"}
        </button>
      </div>

      <AnimatePresence>
        {isFormOpen && (
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            onSubmit={handleSubmit}
            className="bg-black/40 border border-white/10 ares-cut-lg p-6 space-y-4 overflow-hidden"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label htmlFor="sponsor-name" className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Partner Name</label>
                <input
                  id="sponsor-name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 ares-cut-sm px-4 py-2.5 text-white focus:border-ares-red outline-none transition-colors"
                  placeholder="e.g. Google DeepMind"
                  required
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="sponsor-tier" className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Tier</label>
                <select
                  id="sponsor-tier"
                  value={formData.tier}
                  onChange={(e) => setFormData({ ...formData, tier: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 ares-cut-sm px-4 py-2.5 text-white focus:border-ares-red outline-none transition-colors"
                >
                  {TIERS.map(t => <option key={t.name} value={t.name} className="bg-zinc-900">{t.name}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label htmlFor="sponsor-logo" className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Logo URL</label>
                <input
                  id="sponsor-logo"
                  value={formData.logo_url || ""}
                  onChange={(e) => setFormData({ ...formData, logo_url: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 ares-cut-sm px-4 py-2.5 text-white focus:border-ares-red outline-none transition-colors"
                  placeholder="https://..."
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="sponsor-link" className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Website URL</label>
                <input
                  id="sponsor-link"
                  value={formData.website_url || ""}
                  onChange={(e) => setFormData({ ...formData, website_url: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 ares-cut-sm px-4 py-2.5 text-white focus:border-ares-red outline-none transition-colors"
                  placeholder="https://..."
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={saveMutation.isPending}
              className="w-full py-3 bg-gradient-to-r from-ares-red to-red-800 text-white font-bold ares-cut-sm hover:shadow-[0_0_20px_rgba(220,38,38,0.3)] transition-all disabled:opacity-50"
            >
              {saveMutation.isPending ? "Syncing..." : formData.id ? "Update Partner in D1" : "Commit Partner to D1"}
            </button>
          </motion.form>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoading ? (
           [1,2,3].map(i => <div key={i} className="h-32 bg-white/5 ares-cut-lg animate-pulse" />)
        ) : sponsors.map((s) => (
          <div key={s.id} className="bg-black/40 border border-white/5 ares-cut-lg p-6 relative group transition-all hover:border-white/20">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-2">
                {TIERS.find(t => t.name === s.tier)?.icon}
                <span className={`text-[10px] font-bold uppercase tracking-widest ${TIERS.find(t => t.name === s.tier)?.color}`}>
                  {s.tier}
                </span>
              </div>
              <div className="flex items-center gap-2 transition-opacity">
                <button
                  onClick={() => {
                    setFormData(s);
                    setIsFormOpen(true);
                  }}
                  className="text-zinc-600 hover:text-ares-cyan transition-colors"
                >
                  <Edit2 size={16} />
                </button>
                <button
                  onClick={() => { if(confirm("Purge this partner from database?")) deleteMutation.mutate(s.id); }}
                  className="text-zinc-600 hover:text-ares-red transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
            
            <h4 className="text-lg font-bold text-white mb-1">{s.name}</h4>
            
            <div className="flex items-center gap-3 mt-4">
              {s.website_url && (
                <a href={s.website_url} target="_blank" rel="noreferrer" className="text-zinc-500 hover:text-ares-gold transition-colors">
                  <Globe size={16} />
                </a>
              )}
              {s.logo_url && (
                <div className="h-6 w-px bg-white/5" />
              )}
              {s.logo_url && (
                <div className="text-[10px] font-bold uppercase tracking-widest text-emerald-500 flex items-center gap-1">
                  <CheckCircle2 size={12} /> Logo Linked
                </div>
              )}
            </div>
          </div>
        ))}
        {sponsors.length === 0 && !isLoading && !isFormOpen && (
          <div className="col-span-full py-12 text-center border-2 border-dashed border-white/5 ares-cut-lg outline-none">
            <p className="text-zinc-600 font-medium italic">No sponsors logged. Start by adding your titanium partners.</p>
          </div>
        )}
      </div>
    </div>
  );
}
