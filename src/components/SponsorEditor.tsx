import { useState, useRef } from "react";
import DashboardPageHeader from "./dashboard/DashboardPageHeader";
import DashboardEmptyState from "./dashboard/DashboardEmptyState";
import DashboardLoadingGrid from "./dashboard/DashboardLoadingGrid";
import { DashboardSubmitButton } from "./ui/forms/DashboardSubmitButton";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Globe, ShieldCheck, Award, Zap, Gem, CheckCircle2, XCircle, Edit2, Package, UploadCloud, Loader2, Star, TrendingUp, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { toastApiError } from "../api/honoClient";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";

import { useModal } from "../contexts/ModalContext";
import { useForm } from "@tanstack/react-form";
import { sponsorSchema } from "@shared/schemas/sponsorSchema";
import { AresField } from "./ui/forms/AresField";
import { AresSelect } from "./ui/forms/AresSelect";

import { useGetAdminSponsors, useSaveSponsor, useDeleteSponsor, type Sponsor } from "../api";

const TIERS = [
  { name: "Titanium", icon: <Gem className="text-ares-cyan" />, color: "text-ares-cyan", border: "border-ares-cyan/30" },
  { name: "Gold", icon: <Award className="text-ares-gold" />, color: "text-ares-gold", border: "border-ares-gold/30" },
  { name: "Silver", icon: <ShieldCheck className="text-marble/90" />, color: "text-marble/90", border: "border-marble/20" },
  { name: "Bronze", icon: <Zap className="text-ares-bronze" />, color: "text-ares-bronze", border: "border-ares-bronze/30" },
  { name: "In-Kind", icon: <Package className="text-marble/60" />, color: "text-marble/60", border: "border-marble/10" },
];

interface SponsorCardProps {
  sponsor: Sponsor;
  onEdit: (s: Sponsor) => void;
}

function SponsorCard({ sponsor: s, onEdit }: SponsorCardProps) {
  const saveMutation = useSaveSponsor();
  const deleteMutation = useDeleteSponsor();
  const modal = useModal();
  
  const isPending = saveMutation.isPending || deleteMutation.isPending;

  const handleDelete = async () => {
    const confirmed = await modal.confirm({
      title: "Delete Partner",
      description: `Are you sure you want to permanently remove ${s.name} from the ARES registry?`,
      confirmText: "Delete",
      destructive: true
    });
    if (confirmed) {
      deleteMutation.mutate(s.id, {
        onSuccess: () => toast.success(`${s.name} removed from registry.`)
      });
    }
  };

  const handleRestore = () => {
    saveMutation.mutate({ ...s, isActive: 1 } as Sponsor, {
      onSuccess: () => toast.success(`${s.name} restored to active status.`)
    });
  };

  const handleDeactivate = () => {
    saveMutation.mutate({ ...s, isActive: 0 } as Sponsor, {
      onSuccess: () => toast.success(`${s.name} deactivated.`)
    });
  };

  return (
    <div className={`bg-black/40 border ares-cut-lg p-10 relative group transition-all hover:border-ares-gold/20 shadow-2xl backdrop-blur-sm overflow-hidden ${!s.isActive ? 'border-ares-red/20 opacity-60' : 'border-white/5'}`}>
      <div className="absolute top-0 right-0 w-1 h-0 bg-ares-gold group-hover:h-full transition-all duration-700"></div>
      <div className="flex justify-between items-start mb-8 relative z-10">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-white/5 ares-cut-sm border border-white/10 group-hover:border-ares-gold/20 transition-all duration-500">
            {TIERS.find(t => t.name === s.tier)?.icon}
          </div>
          <span className={`text-[10px] font-black uppercase tracking-[0.4em] ${TIERS.find(t => t.name === s.tier)?.color}`}>
            {s.tier} // MISSION_PARTNER
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => onEdit(s)}
            disabled={isPending}
            aria-label={`Edit ${s.name}`}
            className="text-marble/20 hover:text-ares-cyan transition-all disabled:opacity-30 p-2 hover:bg-white/5 ares-cut-sm border border-transparent hover:border-white/10"
          >
            <Edit2 size={16} />
          </button>
          {!s.isActive ? (
            <button
              onClick={handleRestore}
              disabled={isPending}
              aria-label={`Restore ${s.name}`}
              className="text-marble/20 hover:text-ares-cyan transition-all disabled:opacity-30 p-2 hover:bg-white/5 ares-cut-sm border border-transparent hover:border-white/10"
              title="Restore to active status"
            >
              {saveMutation.isPending ? <RefreshCw size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
            </button>
          ) : (
            <button
              onClick={handleDeactivate}
              disabled={isPending}
              aria-label={`Deactivate ${s.name}`}
              className="text-marble/20 hover:text-ares-red transition-all disabled:opacity-30 p-2 hover:bg-white/5 ares-cut-sm border border-transparent hover:border-white/10"
              title="Deactivate partner"
            >
              {saveMutation.isPending ? <RefreshCw size={16} className="animate-spin" /> : <XCircle size={16} />}
            </button>
          )}
          <button
            onClick={handleDelete}
            disabled={isPending}
            aria-label={`Permanently delete ${s.name}`}
            className="text-marble/20 hover:text-ares-red transition-all disabled:opacity-30 p-2 hover:bg-white/5 ares-cut-sm border border-transparent hover:border-white/10"
            title="Permanently delete from database"
          >
            {deleteMutation.isPending ? <RefreshCw size={16} className="animate-spin" /> : <Trash2 size={16} />}
          </button>
        </div>
      </div>
      
      <div className="flex items-center gap-6 mb-8 relative z-10">
        {s.logoUrl && (
          <div className="w-16 h-16 bg-white/5 ares-cut-sm border border-white/10 flex items-center justify-center p-2 overflow-hidden group-hover:border-white/20 transition-all">
             <img src={s.logoUrl} alt={s.name} className="max-w-full max-h-full object-contain filter brightness-110" />
          </div>
        )}
        <h4 className="text-2xl font-black text-white uppercase tracking-tighter leading-none group-hover:text-ares-gold transition-colors">{s.name}</h4>
      </div>
      
      {!s.isActive && (
        <div className="text-[10px] font-black uppercase tracking-widest text-ares-red mb-6 relative z-10">
          STATUS // DEACTIVATED_LEGACY
        </div>
      )}
      
      <div className="flex items-center justify-between mt-auto pt-6 border-t border-white/5 relative z-10">
        <div className="flex items-center gap-4">
          {s.websiteUrl && (
            <a href={s.websiteUrl} target="_blank" rel="noreferrer" title={`Visit ${s.name} website`} className="text-marble/20 hover:text-ares-gold transition-all hover:scale-110">
              <Globe size={18} />
            </a>
          )}
        </div>
        {s.logoUrl && (
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-ares-gold/40 flex items-center gap-2">
            <CheckCircle2 size={12} /> ASSET_SYNC_OK
          </div>
        )}
      </div>
    </div>
  );
}

export default function SponsorEditor() {
  const queryClient = useQueryClient();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm({
    defaultValues: {
      name: "",
      tier: "Gold" as "Titanium" | "Gold" | "Silver" | "Bronze" | "In-Kind",
      logoUrl: "",
      websiteUrl: "",
      isActive: 1,
      id: ""
    },
    onSubmit: async ({ value }) => {
      const finalId = editingId || value.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      saveMutation.mutate({ ...value, id: finalId });
    }
  });

  const { data: res, isLoading, isError } = useGetAdminSponsors();
  const sponsors = res?.sponsors || [];

  const saveMutation = useSaveSponsor({
    onSuccess: (res) => {
      if (res.success) {
        queryClient.invalidateQueries({ queryKey: ["admin_sponsors"] });
        setIsFormOpen(false);
        setEditingId(null);
        form.reset();

        confetti({
          particleCount: 150,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#00F0FF', '#FF003C', '#FFFFFF']
        });
        
        toast.success("Partner record synchronized successfully.");
      } else {
        toastApiError("Synchronization failed");
      }
    },
    onError: (err: unknown) => {
      toastApiError(err, "Partner sync failed");
    }
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("folder", "Sponsors");

    try {
      const res = await fetch("/api/media/upload", {
        method: "POST",
        body: formData,
      });
      const data = (await res.json()) as { success?: boolean; url?: string; error?: string };
      
      if (res.ok && data.success) {
        form.setFieldValue("logoUrl", data.url || "");
        toast.success("Logo uploaded securely.");
      } else {
        toastApiError(data.error || "Upload failed");
      }
    } catch (err: unknown) {
      toastApiError(err, "Failed to upload logo");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleEdit = (s: Sponsor) => {
    setEditingId(s.id);
    form.reset({
      id: s.id,
      name: s.name,
      tier: s.tier as "Titanium" | "Gold" | "Silver" | "Bronze" | "In-Kind",
      logoUrl: s.logoUrl || "",
      websiteUrl: s.websiteUrl || "",
      isActive: s.isActive ?? 1
    });
    setIsFormOpen(true);
  };

  return (
    <div className="space-y-8">
      <DashboardPageHeader
        title="Partner Registry"
        subtitle="Recognize the organizations and donors fueling ARES operations."
        icon={<Gem className="text-ares-cyan" />}
        action={
          <button
            onClick={() => {
              if (isFormOpen) {
                setIsFormOpen(false);
                setEditingId(null);
                form.reset();
              } else {
                setIsFormOpen(true);
              }
            }}
            className={`flex items-center gap-3 px-6 py-3 font-black text-[10px] uppercase tracking-[0.2em] ares-cut-sm transition-all shadow-xl ${isFormOpen ? 'bg-white/5 border border-white/10 text-marble' : 'bg-ares-red text-white hover:bg-ares-danger shadow-ares-red/20 hover:scale-105 active:scale-95'}`}
          >
            {isFormOpen ? <XCircle size={18} /> : <Plus size={18} />}
            {isFormOpen ? "ABORT_MISSION" : "REGISTER_NEW_PARTNER"}
          </button>
        }
      />

      {isError && (
        <div className="bg-ares-red/10 border border-ares-red/30 p-4 ares-cut-sm text-ares-red text-xs font-bold mb-6 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-ares-red animate-pulse" />
          TELEMETRY FAULT: Failed to synchronize partner data.
        </div>
      )}

      {/* Stats Summary */}
      {!isFormOpen && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[
            { label: "Total Partners", val: sponsors.length, icon: <Globe size={16} /> },
            { label: "Titanium", val: sponsors.filter(s => s.tier === "Titanium").length, icon: <Star size={16} className="text-ares-cyan" /> },
            { label: "Gold", val: sponsors.filter(s => s.tier === "Gold").length, icon: <Star size={16} className="text-ares-gold" /> },
            { label: "Active Registry", val: sponsors.filter(s => s.isActive).length, icon: <TrendingUp size={16} className="text-green-400" /> }
          ].map((stat, i) => (
            <div key={i} className="bg-black/40 border border-white/5 p-8 ares-cut-lg shadow-xl backdrop-blur-sm relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-1 h-0 bg-ares-red/20 group-hover:h-full transition-all duration-500"></div>
              <div className="flex items-center gap-3 text-marble/20 mb-4">
                {stat.icon}
                <span className="text-[10px] font-black uppercase tracking-[0.4em]">{stat.label} //</span>
              </div>
              <div className="text-4xl font-black text-white uppercase tracking-tighter leading-none">{stat.val}</div>
            </div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {isFormOpen && (
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            onSubmit={(e) => {
              e.preventDefault();
              e.stopPropagation();
              form.handleSubmit();
            }}
            className="bg-black/40 border border-white/10 ares-cut-lg p-6 space-y-4 overflow-hidden"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <form.Field
                name="name"
                validators={{
                  onChange: sponsorSchema.shape.name,
                }}
              >
                {(field) => (
                  <AresField
                    field={field}
                    label="Partner Name"
                    placeholder="e.g. Google DeepMind"
                  />
                )}
              </form.Field>

              <form.Field name="tier">
                {(field) => (
                  <AresSelect
                    field={field}
                    label="Tier"
                    options={TIERS.map(t => ({ value: t.name, label: t.name }))}
                  />
                )}
              </form.Field>

              <div className="space-y-1">
                <label htmlFor="sponsor-logo" className="text-xs font-bold uppercase tracking-widest text-marble/60 ml-1">Partner Logo Asset</label>
                <div className="flex gap-2">
                  <form.Field
                    name="logoUrl"
                    validators={{
                      onChange: sponsorSchema.shape.logoUrl,
                    }}
                  >
                    {(field) => (
                      <div className="flex-1">
                        <AresField
                          field={field}
                          label=""
                          placeholder="https://... or upload"
                        />
                      </div>
                    )}
                  </form.Field>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    aria-label="Logo"
                    id="sponsor-logo"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="mt-1 flex items-center justify-center h-12 w-12 bg-white/5 hover:bg-white/10 border border-white/10 text-white transition-colors disabled:opacity-50"
                  >
                    {isUploading ? <Loader2 size={18} className="animate-spin text-ares-gold" /> : <UploadCloud size={18} />}
                  </button>
                </div>
              </div>

              <form.Field
                name="websiteUrl"
                validators={{
                  onChange: sponsorSchema.shape.websiteUrl,
                }}
              >
                {(field) => (
                  <AresField
                    field={field}
                    label="Website URL"
                    placeholder="https://..."
                  />
                )}
              </form.Field>
            </div>
            <DashboardSubmitButton 
              isPending={saveMutation.isPending} 
              defaultText={editingId ? "Update Partner Registry" : "Commit to Global Registry"} 
              theme="red" 
            />
          </motion.form>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoading ? (
           <DashboardLoadingGrid count={3} heightClass="h-32" gridClass="grid-cols-1 md:grid-cols-2 lg:grid-cols-3" />
        ) : sponsors.map((s) => (
          <SponsorCard key={s.id} sponsor={s} onEdit={handleEdit} />
        ))}
        {sponsors.length === 0 && !isLoading && !isFormOpen && (
          <DashboardEmptyState
            className="col-span-full py-12 text-center border-2 border-dashed border-white/10 ares-cut-lg"
            icon={<Package size={48} />}
            message="No partners logged. Start by adding your mission-critical sponsors."
          />
        )}
      </div>
    </div>
  );
}
