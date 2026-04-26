/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from "react";
import DashboardPageHeader from "./dashboard/DashboardPageHeader";
import DashboardEmptyState from "./dashboard/DashboardEmptyState";
import DashboardLoadingGrid from "./dashboard/DashboardLoadingGrid";
import { DashboardInput, DashboardTextarea, DashboardSubmitButton } from "./dashboard/DashboardFormInputs";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Trophy, Star, Calendar, MapPin, XCircle, Save } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "../api/client";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import SeasonPicker from "./SeasonPicker";

const awardFormSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1, "Title is required"),
  year: z.coerce.number().min(2000).max(2100),
  event_name: z.string().optional().nullable(),
  image_url: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  season_id: z.string().optional().nullable(),
});



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
  const queryClient = useQueryClient();
  const [isAdding, setIsAdding] = useState(false);

  const { register, handleSubmit, reset, setValue, control, formState: { errors } } = useForm<any>({
    resolver: zodResolver(awardFormSchema),
    defaultValues: {
      year: new Date().getFullYear(),
      title: "",
      event_name: "",
      image_url: "",
      description: "",
      season_id: ""
    }
  });

  const seasonId = useWatch({ control, name: "season_id" });

  const { data: awardsData, isLoading, isError } = api.awards.getAwards.useQuery(["admin-awards"], {});
  const awards = (awardsData?.body?.awards || []) as Award[];

  const saveMutation = api.awards.saveAward.useMutation({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-awards"] });
      setIsAdding(false);
      reset();
    }
  });

  const deleteMutation = api.awards.deleteAward.useMutation({
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-awards"] })
  });

  const onFormSubmit = (data: any) => {
    const finalId = data.id || `${data.year}-${data.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
     
    saveMutation.mutate({ body: { ...data, id: finalId } as any });
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
            onClick={() => {
              if (isAdding) {
                setIsAdding(false);
                reset();
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
            onSubmit={handleSubmit(onFormSubmit)}
            className="bg-obsidian border border-ares-gold/30 ares-cut-lg p-8 space-y-6 shadow-2xl"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <DashboardInput
                id="award-title"
                label="Award Title"
                {...register("title")}
                error={(errors.title?.message as string)}
                placeholder="e.g. Excellence in Engineering"
                focusColor="ares-gold"
                fullWidth
              />
              <DashboardInput
                id="award-year"
                type="number"
                label="Year"
                {...register("year")}
                error={(errors.year?.message as string)}
                focusColor="ares-gold"
              />
              <DashboardInput
                id="award-eventName"
                label="Event Name"
                {...register("event_name")}
                placeholder="e.g. West Virginia State Championship"
                focusColor="ares-gold"
              />
              <SeasonPicker value={seasonId || ""} onChange={(val) => setValue("season_id", val)} />
              <DashboardInput
                id="award-image"
                label="Image URL (Optional)"
                {...register("image_url")}
                placeholder="https://..."
                focusColor="ares-gold"
                fullWidth
              />
              <DashboardTextarea
                id="award-desc"
                label="Description"
                {...register("description")}
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
          <div key={award.id} className="bg-black/40 border border-white/5 ares-cut p-8 group hover:border-ares-gold/30 transition-all flex flex-col md:flex-row gap-8 relative overflow-hidden">
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
              <h4 className="text-2xl font-black text-white mb-2 tracking-tighter">{award.title}</h4>
              <div className="flex items-center gap-2 text-ares-gray text-xs font-bold mb-4">
                 <MapPin size={10} /> {award.event_name}
              </div>
              <p className="text-ares-gray text-sm line-clamp-3 leading-relaxed">{award.description}</p>
            </div>

            <button
              title="Delete Award"
              aria-label="Delete Award"
              onClick={() => { if(confirm("Purge this achievement from history?")) deleteMutation.mutate({ params: { id: award.id }, body: {} }); }}
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
