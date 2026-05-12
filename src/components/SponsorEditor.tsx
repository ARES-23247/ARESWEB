
import { useState, useRef } from "react";
import DashboardPageHeader from "./dashboard/DashboardPageHeader";
import DashboardEmptyState from "./dashboard/DashboardEmptyState";
import DashboardLoadingGrid from "./dashboard/DashboardLoadingGrid";
import { DashboardSubmitButton } from "./ui/forms/DashboardSubmitButton";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Globe, ShieldCheck, Award, Zap, Gem, CheckCircle2, XCircle, Edit2, Package, UploadCloud, Loader2 } from "lucide-react";
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

export default function SponsorEditor() {
  const queryClient = useQueryClient();
  const modal = useModal();
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
          colors: ['#C00000', '#FFB81C', '#CD7F32']
        });
        
        toast.success("Partner synchronization successful.");
      } else {
        toastApiError("Sync failed");
      }
    },
    onError: (err: unknown) => {
      toastApiError(err, "Sponsor sync failed");
    }
  });

  const deleteMutation = useDeleteSponsor({
    onSuccess: () => {
      toast.success("Partner removed.");
      queryClient.invalidateQueries({ queryKey: ["admin_sponsors"] });
    },
    onError: (err: unknown) => {
      toastApiError(err, "Delete failed");
    }
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

  const handleDelete = async (s: { id: string; name: string }) => {
    // Prevent rapid-fire deletes while a mutation is in-flight
    if (deleteMutation.isPending) return;
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
                <label htmlFor="sponsor-logo" className="text-xs font-bold uppercase tracking-widest text-marble/60">Partner Logo</label>
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
                  disabled={deleteMutation.isPending}
                  aria-label={`Delete ${s.name}`}
                  className="text-white/60 hover:text-ares-red transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-red rounded disabled:opacity-30 disabled:cursor-not-allowed"
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
