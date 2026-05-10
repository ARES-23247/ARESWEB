
import { useState, useRef } from "react";
import DashboardPageHeader from "./dashboard/DashboardPageHeader";
import DashboardEmptyState from "./dashboard/DashboardEmptyState";
import DashboardLoadingGrid from "./dashboard/DashboardLoadingGrid";
import { DashboardInput, DashboardSubmitButton } from "./dashboard/DashboardFormInputs";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Globe, ShieldCheck, Award, Zap, Gem, CheckCircle2, XCircle, Edit2, Package, UploadCloud, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";

import { useModal } from "../contexts/ModalContext";
import { useForm } from "@tanstack/react-form";
import { zodValidator } from "@tanstack/zod-form-adapter";
import { sponsorSchema } from "@shared/schemas/sponsorSchema";

import { useGetAdminSponsors, useSaveSponsor, useDeleteSponsor, type Sponsor } from "../api";

const TIERS = [
  { name: "Titanium", icon: <Gem className="text-ares-cyan" />, color: "text-ares-cyan", border: "border-ares-cyan/30" },
  { name: "Gold", icon: <Award className="text-ares-gold" />, color: "text-ares-gold", border: "border-ares-gold/30" },
  { name: "Silver", icon: <ShieldCheck className="text-marble/90" />, color: "text-marble/90", border: "border-marble/20" },
  { name: "Bronze", icon: <Zap className="text-ares-bronze" />, color: "text-ares-bronze", border: "border-ares-bronze/30" },
  { name: "In-Kind", icon: <Package className="text-marble/60" />, color: "text-marble/60", border: "border-marble/10" },
];

export default function SponsorEditor() {
  const queryClient = useQueryClient();
  const modal = useModal();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm({
    // @ts-expect-error - Type definitions are outdated
    validatorAdapter: zodValidator(),
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
          colors: ['#C00000', '#FFB81C', '#CD7F32']
        });
        
        toast.success("Partner synchronization successful.");
      } else {
        toast.error("Sync failed");
      }
    },
    onError: (err: Error) => {
      toast.error(`[Failure Exposure] Sponsor sync failed: \n${err.message}`);
    }
  });

  const deleteMutation = useDeleteSponsor({
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin_sponsors"] })
  });

  // Handlers moved to form onSubmit

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
        toast.error(data.error || "Upload failed");
      }
    } catch (_err) {
      toast.error("Failed to upload logo.");
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

  const handleDelete = async (s: { id: string; name: string }) => {
    const confirmed = await modal.confirm({
      title: "Delete Partner",
      description: `Are you sure you want to permanently remove ${s.name} from the ARES registry?`,
      confirmText: "Delete",
      destructive: true
    });
    if (confirmed) {
      deleteMutation.mutate(s.id);
    }
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
              if (isFormOpen) {
                setIsFormOpen(false);
                setEditingId(null);
                form.reset();
              } else {
                setIsFormOpen(true);
              }
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
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  onChange: (sponsorSchema as any).shape.name,
                }}
              >
                {(field) => (
                  <DashboardInput
                    id="sponsor-name"
                    label="Partner Name"
                    name={field.name}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    error={field.state.meta.errors?.[0] as string | undefined}
                    placeholder="e.g. Google DeepMind"
                    focusColor="ares-red"
                  />
                )}
              </form.Field>

              <form.Field name="tier">
                {(field) => (
                  <div className="space-y-1">
                    <label htmlFor="sponsor-tier" className="text-xs font-bold uppercase tracking-widest text-marble/60">Tier</label>
                    <select
                      id="sponsor-tier"
                      name={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value as "Titanium" | "Gold" | "Silver" | "Bronze" | "In-Kind")}
                      className="w-full bg-white/5 border border-white/10 ares-cut-sm px-4 py-3 text-white focus:border-ares-red outline-none transition-colors"
                    >
                      {TIERS.map(t => <option key={t.name} value={t.name} className="bg-obsidian">{t.name}</option>)}
                    </select>
                    {field.state.meta.errors?.[0] && <p className="text-[10px] font-black uppercase tracking-tighter text-ares-red">{field.state.meta.errors[0] as string}</p>}
                  </div>
                )}
              </form.Field>

              <div className="space-y-1">
                <label htmlFor="sponsor-logo" className="text-xs font-bold uppercase tracking-widest text-marble/60">Partner Logo</label>
                <div className="flex gap-2">
                  <form.Field
                    name="logoUrl"
                    validators={{
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      onChange: (sponsorSchema as any).shape.logoUrl,
                    }}
                  >
                    {(field) => (
                      <DashboardInput
                        id="sponsor-logo"
                        label=""
                        name={field.name}
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                        error={field.state.meta.errors?.[0] as string | undefined}
                        placeholder="https://... or upload"
                        focusColor="ares-red"
                        className="flex-1"
                      />
                    )}
                  </form.Field>
                  <input 
                    type="file" 
                    accept="image/*" 
                    className="hidden" 
                    ref={fileInputRef} 
                    onChange={handleFileUpload} 
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
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  onChange: (sponsorSchema as any).shape.websiteUrl,
                }}
              >
                {(field) => (
                  <DashboardInput
                    id="sponsor-link"
                    label="Website URL"
                    name={field.name}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    error={field.state.meta.errors?.[0] as string | undefined}
                    placeholder="https://..."
                    focusColor="ares-red"
                  />
                )}
              </form.Field>
            </div>
            <DashboardSubmitButton 
              isPending={saveMutation.isPending} 
              defaultText={editingId ? "Update Partner in D1" : "Commit Partner to D1"} 
              theme="red" 
            />
          </motion.form>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoading ? (
           <DashboardLoadingGrid count={3} heightClass="h-32" gridClass="grid-cols-1 md:grid-cols-2 lg:grid-cols-3" />
        ) : (sponsors as Sponsor[]).map((s) => (
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
                  onClick={() => handleEdit(s)}
                  aria-label={`Edit ${s.name}`}
                  className="text-white/60 hover:text-ares-cyan transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan rounded"
                >
                  <Edit2 size={16} />
                </button>
                <button
                  onClick={() => handleDelete(s)}
                  aria-label={`Delete ${s.name}`}
                  className="text-white/60 hover:text-ares-red transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-red rounded"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
            
            <h4 className="text-lg font-bold text-white mb-1">{s.name}</h4>
            
            <div className="flex items-center gap-3 mt-4">
              {s.websiteUrl && (
                <a href={s.websiteUrl} target="_blank" rel="noreferrer" title={`Visit ${s.name} website`} className="text-marble/60 hover:text-ares-gold transition-colors">
                  <Globe size={16} />
                </a>
              )}
              {s.logoUrl && (
                <div className="h-6 w-px bg-white/5" />
              )}
              {s.logoUrl && (
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
