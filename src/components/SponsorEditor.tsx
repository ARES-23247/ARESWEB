
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
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { sponsorSchema, SponsorPayload } from "@shared/schemas/sponsorSchema";

import { api } from "../api/client";

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
  const [editingId, setEditingId] = useState<string | null>(null);

  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<SponsorPayload>({
    resolver: zodResolver(sponsorSchema),
    defaultValues: {
      tier: "Gold",
      is_active: 1
    }
  });

  const { data, isLoading, isError } = api.sponsors.adminList.useQuery(["admin-sponsors"], {});
  const rawBody = (data as unknown as { body?: { sponsors?: unknown[] } | unknown[] })?.body;
  const sponsors = data?.status === 200 ? (Array.isArray(rawBody) ? rawBody : (rawBody && !Array.isArray(rawBody) && Array.isArray(rawBody.sponsors) ? rawBody.sponsors : [])) : [];

  const saveMutation = api.sponsors.saveSponsor.useMutation({
    onSuccess: (res: { status: number; body: { success?: boolean } }) => {
      if (res.status === 200 && res.body.success) {
        queryClient.invalidateQueries({ queryKey: ["admin-sponsors"] });
        setIsFormOpen(false);
        setEditingId(null);
        reset();

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

  const deleteMutation = api.sponsors.deleteSponsor.useMutation({
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-sponsors"] })
  });

  const onFormSubmit = (data: SponsorPayload) => {
    const finalId = editingId || data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    saveMutation.mutate({ body: { ...data, id: finalId } });
  };

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
      const data = await res.json();
      
      if (res.ok && data.success) {
        setValue("logo_url", data.url, { shouldValidate: true });
        toast.success("Logo uploaded securely.");
      } else {
        toast.error(data.error || "Upload failed");
      }
    } catch (err) {
      toast.error("Failed to upload logo.");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleEdit = (s: { id: string; name: string; tier: string; logo_url?: string | null; website_url?: string | null; is_active?: number }) => {
    setEditingId(s.id);
    reset({
      id: s.id,
      name: s.name,
       
      tier: s.tier as "Titanium" | "Gold" | "Silver" | "Bronze" | "In-Kind",
      logo_url: s.logo_url || "",
      website_url: s.website_url || "",
      is_active: s.is_active ?? 1
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
      deleteMutation.mutate({ params: { id: s.id }, body: {} });
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
                reset();
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
             
            onSubmit={handleSubmit(onFormSubmit)}
            className="bg-black/40 border border-white/10 ares-cut-lg p-6 space-y-4 overflow-hidden"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <DashboardInput
                id="sponsor-name"
                label="Partner Name"
                {...register("name")}
                error={errors.name?.message as string}
                placeholder="e.g. Google DeepMind"
                focusColor="ares-red"
              />
              <div className="space-y-1">
                <label htmlFor="sponsor-tier" className="text-xs font-bold uppercase tracking-widest text-marble/40">Tier</label>
                <select
                  id="sponsor-tier"
                  {...register("tier")}
                  className="w-full bg-white/5 border border-white/10 ares-cut-sm px-4 py-3 text-white focus:border-ares-red outline-none transition-colors"
                >
                  {TIERS.map(t => <option key={t.name} value={t.name} className="bg-obsidian">{t.name}</option>)}
                </select>
                {errors.tier && <p className="text-[10px] font-black uppercase tracking-tighter text-ares-red">{errors.tier.message as string}</p>}
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-widest text-marble/40">Partner Logo</label>
                <div className="flex gap-2">
                  <DashboardInput
                    id="sponsor-logo"
                    label=""
                    {...register("logo_url")}
                    error={errors.logo_url?.message as string}
                    placeholder="https://... or upload"
                    focusColor="ares-red"
                    className="flex-1"
                  />
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
              <DashboardInput
                id="sponsor-link"
                label="Website URL"
                {...register("website_url")}
                error={errors.website_url?.message as string}
                placeholder="https://..."
                focusColor="ares-red"
              />
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
        ) : (sponsors as { id: string; name: string; tier: string; logo_url?: string | null; website_url?: string | null }[]).map((s) => (
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
              {s.website_url && (
                <a href={s.website_url} target="_blank" rel="noreferrer" title={`Visit ${s.name} website`} className="text-marble/40 hover:text-ares-gold transition-colors">
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
