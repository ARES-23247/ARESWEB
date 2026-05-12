import { useState } from "react";
import { toast } from "sonner";
import { toastApiError } from "../api/honoClient";
import DashboardPageHeader from "./dashboard/DashboardPageHeader";
import DashboardEmptyState from "./dashboard/DashboardEmptyState";
import DashboardLoadingGrid from "./dashboard/DashboardLoadingGrid";
import { DashboardSubmitButton } from "./ui/forms/DashboardSubmitButton";
import { useGetAwards, useSaveAward, useDeleteAward } from "../api";
import { Plus, Trash2, Trophy, Star, Calendar, MapPin, XCircle, Save } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useForm } from "@tanstack/react-form";
import { awardFormSchema, type AwardFormPayload } from "@shared/routes/awards";
import { AresField } from "./ui/forms/AresField";

import SeasonPicker from "./SeasonPicker";
interface Award {
  id: string;
  title: string;
  year: number;
  eventName: string | null;
  imageUrl: string | null;
  description: string | null;
  seasonId?: number | null;
}

export default function AwardEditor() {
  // const queryClient = useQueryClient(); // Reserved for future query invalidation
  const [isAdding, setIsAdding] = useState(false);

  const form = useForm({
    defaultValues: {
      year: new Date().getFullYear(),
      title: "",
      eventName: "",
      imageUrl: "",
      description: "",
      seasonId: null as number | null
    } as AwardFormPayload,
    onSubmit: async ({ value }) => {
      const payload: AwardFormPayload = {
        ...value,
        year: typeof value.year === "number" ? value.year : Number(value.year) || new Date().getFullYear(),
        seasonId: value.seasonId === null ? null : (typeof value.seasonId === "number" ? value.seasonId : Number(value.seasonId) || null)
      };
      saveMutation.mutate(payload, {
        onSuccess: () => {
          toast.success("Award saved successfully");
          setIsAdding(false);
          form.reset();
        },
        onError: (err) => {
          toastApiError(err, "Failed to save award");
        }
      });
    }
  });

  // Season ID handled via form.Subscribe

  const { data: awardsRes, isLoading, isError } = useGetAwards();
  
  const awards = (awardsRes?.awards || []) as Award[];
  const saveMutation = useSaveAward();
  const deleteMutation = useDeleteAward();

  // Submission integrated into form definition

  return (
    <div className="space-y-8">
      <DashboardPageHeader
        title="Trophy Case Management"
        subtitle="Archiving the milestones of ARES 23247."
        icon={<Trophy className="text-ares-gold" />}
        action={
          <button
            onClick={() => {
              if (isAdding) {
                setIsAdding(false);
                form.reset();
              } else {
                setIsAdding(true);
              }
            }}
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
            onSubmit={(e) => {
              e.preventDefault();
              e.stopPropagation();
              form.handleSubmit();
            }}
            className="bg-obsidian border border-ares-gold/30 ares-cut-lg p-8 space-y-6 shadow-2xl"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <form.Field
                name="title"
                validators={{
                  onChange: awardFormSchema.shape.title,
                }}
              >
                {(field) => (
                  <AresField
                    field={field}
                    label="Award Title"
                    placeholder="e.g. Excellence in Engineering"
                  />
                )}
              </form.Field>

              <form.Field
                name="year"
                validators={{
                  onChange: awardFormSchema.shape.year,
                }}
              >
                {(field) => (
                  <AresField
                    field={field}
                    type="number"
                    label="Year"
                  />
                )}
              </form.Field>

              <form.Field
                name="eventName"
                validators={{
                  onChange: awardFormSchema.shape.eventName,
                }}
              >
                {(field) => (
                  <AresField
                    field={field}
                    label="Event Name"
                    placeholder="e.g. West Virginia State Championship"
                  />
                )}
              </form.Field>

              <form.Field name="seasonId">
                {(field) => (
                  <SeasonPicker 
                    value={field.state.value || ""} 
                    onChange={(val) => field.handleChange(val === "" ? null : Number(val))} 
                  />
                )}
              </form.Field>

              <form.Field name="imageUrl">
                {(field) => (
                  <AresField
                    field={field}
                    label="Image URL (Optional)"
                    placeholder="https://..."
                  />
                )}
              </form.Field>

              <form.Field name="description">
                {(field) => (
                  <AresField
                    field={field}
                    type="textarea"
                    label="Description"
                    placeholder="Tell the story of how we won..."
                  />
                )}
              </form.Field>
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
          <div key={award.id} className="bg-black/40 border border-white/5 ares-cut p-8 group hover:border-ares-gold/30 transition-all flex flex-col md:flex-row gap-8 relative overflow-hidden">
            {/* Background Glow */}
            <div className="absolute -top-12 -right-12 w-32 h-32 bg-ares-gold/5 blur-3xl rounded-full pointer-events-none" />
            
            {award.imageUrl ? (
              <div className="w-full md:w-32 h-32 bg-white/5 ares-cut overflow-hidden flex-shrink-0 border border-white/10">
                <img src={award.imageUrl} alt={award.title} className="w-full h-full object-cover" />
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
              <h4 className="text-2xl font-black text-white mb-2 tracking-tighter">{award.title}</h4>
              <div className="flex items-center gap-2 text-ares-gray text-xs font-bold mb-4">
                 <MapPin size={10} /> {award.eventName}
              </div>
              <p className="text-ares-gray text-sm line-clamp-3 leading-relaxed">{award.description}</p>
            </div>

            <button
              title="Delete Award"
              aria-label="Delete Award"
              onClick={() => { 
                if(confirm("Purge this achievement from history?")) {
                  deleteMutation.mutate(award.id, {
                    onSuccess: () => toast.success("Award deleted"),
                    onError: (err) => toastApiError(err, "Delete failed")
                  }); 
                }
              }}
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

