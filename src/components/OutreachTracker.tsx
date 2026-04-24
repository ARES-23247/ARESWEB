import { useState, useMemo } from "react";
import DashboardPageHeader from "./dashboard/DashboardPageHeader";
import DashboardMetricsGrid from "./dashboard/DashboardMetricsGrid";
import DashboardEmptyState from "./dashboard/DashboardEmptyState";
import DashboardLoadingGrid from "./dashboard/DashboardLoadingGrid";
import { DashboardInput, DashboardTextarea, DashboardSubmitButton } from "./dashboard/DashboardFormInputs";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, MapPin, Users, Clock, Target, Calendar, CheckCircle, XCircle, Save } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "../api/client";
import SeasonPicker from "./SeasonPicker";
import { toast } from "sonner";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { outreachSchema } from "../schemas/contracts/outreachContract";
import { z } from "zod";

const outreachFormSchema = outreachSchema.omit({ id: true }).extend({
  id: z.string().optional(),
});

type OutreachFormValues = z.infer<typeof outreachFormSchema>;

interface OutreachLog {
  id: string;
  title: string;
  date: string;
  location: string | null;
  students_count: number;
  hours_logged: number;
  reach_count: number;
  description: string | null;
  season_id?: number | null;
  is_dynamic?: boolean;
}

export default function OutreachTracker() {
  const queryClient = useQueryClient();
  const [isAdding, setIsAdding] = useState(false);

  const { register, handleSubmit, reset, setValue, control, formState: { errors } } = useForm<OutreachFormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(outreachFormSchema) as any,
    defaultValues: {
      title: "",
      date: new Date().toISOString().split('T')[0],
      location: "",
      students_count: 0,
      hours_logged: 0,
      reach_count: 0,
      description: "",
      season_id: null
    }
  });

  const seasonId = useWatch({ control, name: "season_id" });

  const { data: outreachData, isLoading } = api.outreach.adminList.useQuery(["admin-outreach"], {});

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const logs: OutreachLog[] = useMemo(() => (outreachData?.body as any)?.logs || [], [outreachData]);

  const saveMutation = api.outreach.save.useMutation({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onSuccess: (res: any) => {
      if (res.status === 200) {
        toast.success("Impact record synchronized.");
        queryClient.invalidateQueries({ queryKey: ["admin-outreach"] });
        setIsAdding(false);
        reset();
      } else {
        toast.error("Failed to save impact record.");
      }
    }
  });

  const deleteMutation = api.outreach.delete.useMutation({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onSuccess: (res: any) => {
      if (res.status === 200) {
        toast.success("Impact record purged.");
        queryClient.invalidateQueries({ queryKey: ["admin-outreach"] });
      }
    }
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onFormSubmit = (data: any) => {
    const finalId = data.id || data.title.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + data.date;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    saveMutation.mutate({ body: { ...data, id: finalId } as any });
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const totals = useMemo(() => logs.reduce((acc: any, l: any) => ({
    hours: acc.hours + (l.hours_logged || 0),
    reach: acc.reach + (l.reach_count || 0),
    students: acc.students + (l.students_count || 0),
    events: acc.events + 1
  }), { hours: 0, reach: 0, students: 0, events: 0 }), [logs]);

  return (
    <div className="space-y-8">
      <DashboardMetricsGrid 
        metrics={[
          { label: "Community Reach", value: totals.reach.toLocaleString(), icon: <Target className="text-ares-red" /> },
          { label: "Service Hours", value: totals.hours.toLocaleString(), icon: <Clock className="text-ares-gold" /> },
          { label: "Student Leads", value: totals.students.toLocaleString(), icon: <Users className="text-ares-cyan" /> },
          { label: "Total Events", value: totals.events, icon: <CheckCircle className="text-ares-gold" /> },
        ]}
      />

      <DashboardPageHeader
        title="Impact Logging"
        subtitle="Document every interaction for the FIRST Impact Award."
        icon={<Target className="text-ares-red" />}
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
            {isAdding ? "Cancel" : "Log Outreach"}
          </button>
        }
      />

      <AnimatePresence>
        {isAdding && (
          <motion.form
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            onSubmit={handleSubmit(onFormSubmit as any)}
            className="bg-obsidian border border-ares-red/30 ares-cut-lg p-8 space-y-6 shadow-2xl"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <DashboardInput
                id="outreach-title"
                label="Event Title"
                {...register("title")}
                error={errors.title?.message}
                placeholder="e.g. Robot Demo at City Library"
                focusColor="ares-red"
                fullWidth
              />
              <DashboardInput
                id="outreach-date"
                type="date"
                label="Date"
                {...register("date")}
                error={errors.date?.message}
                focusColor="ares-red"
              />
              <DashboardInput
                id="outreach-reach"
                type="number"
                label="Reach Count (Estimated)"
                {...register("reach_count", { valueAsNumber: true })}
                error={errors.reach_count?.message}
                focusColor="ares-red"
              />
              <DashboardInput
                id="outreach-hours"
                type="number"
                step="0.5"
                label="Hours Logged"
                {...register("hours_logged", { valueAsNumber: true })}
                error={errors.hours_logged?.message}
                focusColor="ares-red"
              />
              <DashboardInput
                id="outreach-students"
                type="number"
                label="Students Participating"
                {...register("students_count", { valueAsNumber: true })}
                error={errors.students_count?.message}
                focusColor="ares-red"
              />
              <DashboardTextarea
                id="outreach-desc"
                label="Description / Impact Summary"
                {...register("description")}
                placeholder="Summarize the community impact..."
                focusColor="ares-red"
                fullWidth
              />
              <SeasonPicker value={seasonId || ""} onChange={(val) => setValue("season_id", val ? parseInt(val) : null)} />
            </div>
            <DashboardSubmitButton 
              isPending={saveMutation.isPending} 
              defaultText="Finalize Impact Entry" 
              icon={<Save size={20} />} 
              theme="red" 
            />
          </motion.form>
        )}
      </AnimatePresence>

      <div className="space-y-4">
        {isLoading ? (
          <DashboardLoadingGrid count={2} heightClass="h-48" gridClass="grid-cols-1 lg:grid-cols-2" />
        ) : logs.map((log) => (
          <div key={log.id} className="bg-black/40 border border-white/5 ares-cut-lg p-6 group hover:border-white/20 transition-all flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div className="flex-1">
              <div className="flex items-center gap-3 text-marble/50 text-xs font-bold uppercase tracking-widest mb-2">
                 <span className="flex items-center gap-1"><Calendar size={12} /> {log.date}</span>
                 {log.location && <span className="flex items-center gap-1">&middot; <MapPin size={12} /> {log.location}</span>}
              </div>
              <h4 className="text-xl font-bold text-white mb-2">{log.title}</h4>
              <p className="text-marble/50 text-sm line-clamp-2">
                {(() => {
                  try {
                    const ast = JSON.parse(log.description || "");
                    if (ast && ast.type === "doc") {
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      const extract = (node: any): string => {
                        if (node.text) return node.text;
                        if (node.content) return node.content.map(extract).join(" ");
                        return "";
                      };
                      return extract(ast);
                    }
                  } catch {
                    // Ignore parse errors to return raw string
                  }
                  return log.description;
                })()}
              </p>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="flex flex-col items-center px-4 py-2 bg-white/5 ares-cut min-w-[80px]">
                <span className="text-xs font-black text-ares-gold uppercase tracking-tighter">Reach</span>
                <span className="text-lg font-black text-white">{log.reach_count || 0}</span>
              </div>
              <div className="flex flex-col items-center px-4 py-2 bg-white/5 ares-cut min-w-[80px]">
                <span className="text-xs font-black text-ares-cyan uppercase tracking-tighter">Hours</span>
                <span className="text-lg font-black text-white">{(log.hours_logged || 0).toFixed(1)}</span>
              </div>
              
              {log.is_dynamic ? (
                <div className="flex items-center px-3 py-1 bg-ares-gold/10 border border-ares-gold/20 ares-cut-sm">
                  <span className="text-xs font-bold text-ares-gold uppercase tracking-widest text-center leading-tight">Synced<br/>Event</span>
                </div>
              ) : (
                <button
                  onClick={() => { if(confirm("Purge this impact record?")) deleteMutation.mutate({ params: { id: log.id }, body: null }); }}
                  title="Purge this impact record"
                  className="p-3 text-marble/40 hover:text-ares-red transition-colors bg-white/5 ares-cut opacity-0 group-hover:opacity-100"
                >
                  <Trash2 size={18} />
                </button>
              )}
            </div>
          </div>
        ))}
        {logs.length === 0 && !isLoading && !isAdding && (
          <DashboardEmptyState
            icon={<Target size={48} />}
            message="No outreach records found. Start logging your team's impact."
          />
        )}
      </div>
    </div>
  );
}
