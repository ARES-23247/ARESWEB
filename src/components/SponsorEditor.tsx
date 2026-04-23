import { useState } from "react";
import DashboardPageHeader from "./dashboard/DashboardPageHeader";
import DashboardEmptyState from "./dashboard/DashboardEmptyState";
import DashboardLoadingGrid from "./dashboard/DashboardLoadingGrid";
import { DashboardInput, DashboardSubmitButton } from "./dashboard/DashboardFormInputs";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Globe, ShieldCheck, Award, Zap, Gem, CheckCircle2, XCircle, Edit2, Package } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { adminApi } from "../api/adminApi";
import { useModal } from "../contexts/ModalContext";

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
  { name: "Silver", icon: <ShieldCheck className="text-marble/90" />, color: "text-marble/90", border: "border-marble/20" },
  { name: "Bronze", icon: <Zap className="text-ares-bronze" />, color: "text-ares-bronze", border: "border-ares-bronze/30" },
  { name: "In-Kind", icon: <Package className="text-marble/40" />, color: "text-marble/40", border: "border-marble/10" },
];

export default function SponsorEditor() {
  const queryClient = useQueryClient();
  const modal = useModal();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formData, setFormData] = useState<Partial<Sponsor>>({
    id: "",
    name: "",
    tier: "Gold",
    logo_url: "",
    website_url: "",
    is_active: 1
  });

  const { data: sponsors = [], isLoading, isError } = useQuery<Sponsor[]>({
    queryKey: ["admin-sponsors"],
    queryFn: async () => {
      const d = await adminApi.get<{ sponsors?: Sponsor[] }>("/api/sponsors/admin", { cache: "no-store" });
      return d.sponsors || [];
    }
  });

  const saveMutation = useMutation({
    mutationFn: async (sponsor: Partial<Sponsor>) => {
      // @ts-expect-error - partial sponsor matches schema
      return adminApi.createSponsor(sponsor);
    },
    onError: (err: Error) => {
      toast.error(`[Failure Exposure] Sponsor sync failed: \n${err.message}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-sponsors"] });
      setIsFormOpen(false);
      setFormData({ id: "", name: "", tier: "Gold", logo_url: "", website_url: "", is_active: 1 });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => adminApi.deleteSponsor(id),
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
      <DashboardPageHeader
        title="Sponsor Management"
        subtitle="Recognize the partners who make ARES possible."
        icon={<Gem className="text-ares-cyan" />}
        action={
          <button
            onClick={() => {
              if (!isFormOpen) setFormData({ id: "", name: "", tier: "Gold", logo_url: "", website_url: "", is_active: 1 });
              setIsFormOpen(!isFormOpen);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-ares-red text-white font-bold ares-cut-sm hover:bg-ares-danger transition-colors shadow-lg shadow-ares-red/20"
          >
            {isFormOpen ? <XCircle size={18} /> : <Plus size={18} />}
            {isFormOpen ? "Cancel" : "Add Partner"}
          </button>
        }
      />

      {isError && (
        <div className="bg-ares-red/10 border border-ares-red/30 p-4 ares-cut-sm text-ares-red text-xs font-bold mb-6 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-ares-red animate-pulse" />
          TELEMETRY FAULT: Failed to synchronize partner registry.
        </div>
      )}

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
              <DashboardInput
                id="sponsor-name"
                label="Partner Name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Google DeepMind"
                focusColor="ares-red"
                required
              />
              <div className="space-y-1">
                <label htmlFor="sponsor-tier" className="text-xs font-bold uppercase tracking-widest text-marble/40">Tier</label>
                <select
                  id="sponsor-tier"
                  value={formData.tier}
                  onChange={(e) => setFormData({ ...formData, tier: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 ares-cut-sm px-4 py-3 text-white focus:border-ares-red outline-none transition-colors"
                >
                  {TIERS.map(t => <option key={t.name} value={t.name} className="bg-obsidian">{t.name}</option>)}
                </select>
              </div>
              <DashboardInput
                id="sponsor-logo"
                label="Logo URL"
                value={formData.logo_url || ""}
                onChange={(e) => setFormData({ ...formData, logo_url: e.target.value })}
                placeholder="https://..."
                focusColor="ares-red"
              />
              <DashboardInput
                id="sponsor-link"
                label="Website URL"
                value={formData.website_url || ""}
                onChange={(e) => setFormData({ ...formData, website_url: e.target.value })}
                placeholder="https://..."
                focusColor="ares-red"
              />
            </div>
            <DashboardSubmitButton 
              isPending={saveMutation.isPending} 
              defaultText={formData.id ? "Update Partner in D1" : "Commit Partner to D1"} 
              theme="red" 
            />
          </motion.form>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoading ? (
           <DashboardLoadingGrid count={3} heightClass="h-32" gridClass="grid-cols-1 md:grid-cols-2 lg:grid-cols-3" />
        ) : sponsors.map((s) => (
          <div key={s.id} className="bg-black/40 border border-white/5 ares-cut-lg p-6 relative group transition-all hover:border-white/20">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-2">
                {TIERS.find(t => t.name === s.tier)?.icon}
                <span className={`text-xs font-bold uppercase tracking-widest ${TIERS.find(t => t.name === s.tier)?.color}`}>
                  {s.tier}
                </span>
              </div>
              <div className="flex items-center gap-2 transition-opacity">
                <button
                  onClick={() => {
                    setFormData(s);
                    setIsFormOpen(true);
                  }}
                  aria-label={`Edit ${s.name}`}
                  className="text-white/60 hover:text-ares-cyan transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan rounded"
                >
                  <Edit2 size={16} />
                </button>
                <button
                  onClick={async () => { 
                    const confirmed = await modal.confirm({
                      title: "Delete Partner",
                      description: `Are you sure you want to permanently remove ${s.name} from the ARES registry?`,
                      confirmText: "Delete",
                      destructive: true
                    });
                    if (confirmed) deleteMutation.mutate(s.id); 
                  }}
                  aria-label={`Delete ${s.name}`}
                  className="text-white/60 hover:text-ares-red transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-red rounded"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
            
            <h4 className="text-lg font-bold text-white mb-1">{s.name}</h4>
            
            <div className="flex items-center gap-3 mt-4">
              {s.website_url && (
                <a href={s.website_url} target="_blank" rel="noreferrer" className="text-marble/40 hover:text-ares-gold transition-colors">
                  <Globe size={16} />
                </a>
              )}
              {s.logo_url && (
                <div className="h-6 w-px bg-white/5" />
              )}
              {s.logo_url && (
                <div className="text-xs font-bold uppercase tracking-widest text-ares-gold flex items-center gap-1">
                  <CheckCircle2 size={12} /> Logo Linked
                </div>
              )}
            </div>
          </div>
        ))}
        {sponsors.length === 0 && !isLoading && !isFormOpen && (
          <DashboardEmptyState
            className="col-span-full py-12 text-center border-2 border-dashed border-white/10 ares-cut-lg"
            icon={<Package size={48} />}
            message="No sponsors logged. Start by adding your titanium partners."
          />
        )}
      </div>
    </div>
  );
}
