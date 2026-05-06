import { useState, useMemo, useCallback } from "react";
import DashboardPageHeader from "./dashboard/DashboardPageHeader";
import DashboardMetricsGrid from "./dashboard/DashboardMetricsGrid";
import DashboardEmptyState from "./dashboard/DashboardEmptyState";
import DashboardLoadingGrid from "./dashboard/DashboardLoadingGrid";
import { DashboardInput, DashboardTextarea, DashboardSubmitButton } from "./dashboard/DashboardFormInputs";
// import { useQuery } from "@tanstack/react-query";
import { Plus, Trash2, MapPin, Users, Clock, Target, Calendar, CheckCircle, XCircle, Save, Pencil } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import SeasonPicker from "./SeasonPicker";
import { toast } from "sonner";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

// We define the schema locally or use a standard one from shared if available
// Since the user is moving away from shared/schemas/contracts, we should probably check where outreachSchema is now.
const outreachSchema = z.object({
  id: z.string(),
  title: z.string().min(1, "Title is required"),
  date: z.string(),
  location: z.string().nullable().optional(),
  students_count: z.number().min(0),
  hours_logged: z.number().min(0),
  reach_count: z.number().min(0),
  description: z.string().nullable().optional(),
  is_mentoring: z.boolean().optional(),
  mentored_team_number: z.string().nullable().optional(),
  season_id: z.number().nullable().optional(),
  event_id: z.string().nullable().optional(),
  mentor_count: z.number().optional(),
  mentor_hours: z.number().optional(),
});

const outreachFormSchema = outreachSchema.omit({ id: true }).extend({
  id: z.string().optional(),
  event_id: z.string().nullable().optional(),
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
  is_mentoring?: boolean;
  mentored_team_number?: string | null;
  season_id?: number | null;
  is_dynamic?: boolean;
  event_id?: string | null;
  mentor_count?: number;
  mentor_hours?: number;
}

import { useGetAdminOutreach, useSaveOutreach, useDeleteOutreach, useGetSeasons } from "../api";

export default function OutreachTracker() {
  const [isAdding, setIsAdding] = useState(false);

  const { register, handleSubmit, reset, setValue, control, formState: { errors } } = useForm<OutreachFormValues>({
    resolver: zodResolver(outreachFormSchema) as unknown as import("react-hook-form").Resolver<OutreachFormValues>,
    defaultValues: {
      title: "",
      date: new Date().toISOString().split('T')[0],
      location: "",
      students_count: 0,
      hours_logged: 0,
      reach_count: 0,
      description: "",
      is_mentoring: false,
      mentored_team_number: "",
      season_id: null,
      event_id: null,
      mentor_count: 0,
      mentor_hours: 0
    }
  });

  const seasonId = useWatch({ control, name: "season_id" });
  const isMentoring = useWatch({ control, name: "is_mentoring" });
  const [activeSeasonTab, setActiveSeasonTab] = useState<string>("all");
  const { data: rawOutreachData, isLoading } = useGetAdminOutreach();

  const { data: rawSeasonsData } = useGetSeasons();

  const allLogs: OutreachLog[] = useMemo(() => rawOutreachData?.logs || [], [rawOutreachData]);

  interface SeasonInfo { start_year: number; end_year: number; challenge_name: string; }
  const seasons: SeasonInfo[] = useMemo(() => rawSeasonsData?.seasons || [], [rawSeasonsData]);

  const seasonTabs = useMemo(() => {
    const usedSeasons = new Set(allLogs.map(l => l.season_id).filter(Boolean));
    return seasons.filter(s => usedSeasons.has(s.start_year)).sort((a, b) => b.start_year - a.start_year);
  }, [allLogs, seasons]);

  const logs = useMemo(() => {
    if (activeSeasonTab === "all") return allLogs;
    if (activeSeasonTab === "unlinked") return allLogs.filter(l => !l.season_id);
    const yr = parseInt(activeSeasonTab);
    return allLogs.filter(l => l.season_id === yr);
  }, [allLogs, activeSeasonTab]);

  const handleTabChange = useCallback((tab: string) => setActiveSeasonTab(tab), []);

  const saveMutation = useSaveOutreach();

  const deleteMutation = useDeleteOutreach();

  const onFormSubmit = (data: z.infer<typeof outreachFormSchema>) => {
    const cleanData = {
      ...data,
      students_count: data.students_count || 0,
      hours_logged: data.hours_logged || 0,
      reach_count: data.reach_count || 0,
      description: data.description === "" ? null : data.description,
      location: data.location === "" ? null : data.location,
      mentored_team_number: data.mentored_team_number === "" ? null : data.mentored_team_number,
    };
    saveMutation.mutate(cleanData, {
      onSuccess: () => {
        toast.success("Impact record synchronized.");
        setIsAdding(false);
        reset({
          title: "",
          date: new Date().toISOString().split('T')[0],
          location: "",
          students_count: 0,
          hours_logged: 0,
          reach_count: 0,
          description: "",
          is_mentoring: false,
          mentored_team_number: "",
          season_id: null,
          id: undefined,
          event_id: null,
          mentor_count: 0,
          mentor_hours: 0
        });
      },
      onError: () => toast.error("Failed to save impact record.")
    });
  };

  const handleDelete = (id: string) => {
    if(confirm("Purge this impact record?")) {
      deleteMutation.mutate(id, {
        onSuccess: () => toast.success("Impact record purged."),
        onError: () => toast.error("Failed to delete impact record.")
      });
    }
  };

  const totals = useMemo(() => logs.reduce((acc, l) => ({
    hours: acc.hours + (l.hours_logged || 0),
    mentoringHours: acc.mentoringHours + (l.is_mentoring ? (l.hours_logged || 0) : 0),
    mentorHours: acc.mentorHours + (l.mentor_hours || 0),
    reach: acc.reach + (l.reach_count || 0),
    students: acc.students + (l.students_count || 0),
    mentors: acc.mentors + (l.mentor_count || 0),
    events: acc.events + 1
  }), { hours: 0, mentoringHours: 0, mentorHours: 0, reach: 0, students: 0, mentors: 0, events: 0 }), [logs]);

  return (
    <div className="space-y-8">
      <DashboardMetricsGrid
        metrics={[
          { label: "Community Reach", value: totals.reach.toLocaleString(), icon: <Target className="text-ares-red" /> },
          { label: "Service Hours", value: totals.hours.toLocaleString(), icon: <Clock className="text-ares-gold" /> },
          { label: "Mentoring Hours", value: totals.mentoringHours.toLocaleString(), icon: <Users className="text-ares-cyan" /> },
          { label: "Mentor Hours", value: totals.mentorHours.toLocaleString(), icon: <Users className="text-ares-bronze" /> },
          { label: "Total Events", value: totals.events, icon: <CheckCircle className="text-ares-gold" /> },
        ]}
      />

      <DashboardPageHeader
        title="Impact Logging"
        subtitle="Document every interaction for the FIRST Impact Award."
        icon={<Target className="text-ares-red" />}
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
            onSubmit={handleSubmit(onFormSubmit)}
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
              <DashboardInput
                id="outreach-mentors"
                type="number"
                label="Mentors Participating"
                {...register("mentor_count", { valueAsNumber: true })}
                error={errors.mentor_count?.message}
                focusColor="ares-bronze"
              />
              <DashboardInput
                id="outreach-mentor-hours"
                type="number"
                step="0.5"
                label="Mentor Hours"
                {...register("mentor_hours", { valueAsNumber: true })}
                error={errors.mentor_hours?.message}
                focusColor="ares-bronze"
              />
              <DashboardTextarea
                id="outreach-desc"
                label="Description / Impact Summary"
                {...register("description")}
                placeholder="Summarize the community impact..."
                focusColor="ares-red"
                fullWidth
              />
              <div className="flex flex-col gap-4">
                <label className="flex items-center gap-2 cursor-pointer group">
                  <div className={`w-10 h-6 ares-cut-sm transition-colors flex items-center px-1 ${isMentoring ? 'bg-ares-cyan' : 'bg-white/10'}`}>
                    <motion.div 
                      animate={{ x: isMentoring ? 16 : 0 }}
                      className="w-4 h-4 bg-white ares-cut-sm shadow-sm"
                    />
                  </div>
                  <input type="checkbox" className="hidden" {...register("is_mentoring")} />
                  <span className="text-xs font-bold text-marble/60 group-hover:text-white transition-colors">Mentoring Session</span>
                </label>

                {isMentoring && (
                  <DashboardInput
                    id="outreach-mentored-team"
                    label="Mentored Team #"
                    {...register("mentored_team_number")}
                    error={errors.mentored_team_number?.message}
                    placeholder="e.g. 23247"
                    focusColor="ares-cyan"
                  />
                )}
              </div>
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

      {/* Season Tabs */}
      {seasonTabs.length > 0 && (
        <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-thin">
          <button
            onClick={() => handleTabChange("all")}
            className={`px-4 py-2 text-xs font-black uppercase tracking-widest ares-cut-sm transition-all whitespace-nowrap ${
              activeSeasonTab === "all"
                ? "bg-ares-red text-white shadow-lg shadow-ares-red/20"
                : "bg-white/5 text-marble/60 hover:text-white hover:bg-white/10 border border-white/5"
            }`}
          >
            All Seasons
          </button>
          {seasonTabs.map(s => (
            <button
              key={s.start_year}
              onClick={() => handleTabChange(s.start_year.toString())}
              className={`px-4 py-2 text-xs font-black uppercase tracking-widest ares-cut-sm transition-all whitespace-nowrap ${
                activeSeasonTab === s.start_year.toString()
                  ? "bg-ares-gold text-obsidian shadow-lg shadow-ares-gold/20"
                  : "bg-white/5 text-marble/60 hover:text-white hover:bg-white/10 border border-white/5"
              }`}
            >
              {s.challenge_name} {s.start_year}-{s.end_year}
            </button>
          ))}
          {allLogs.some(l => !l.season_id) && (
            <button
              onClick={() => handleTabChange("unlinked")}
              className={`px-4 py-2 text-xs font-black uppercase tracking-widest ares-cut-sm transition-all whitespace-nowrap ${
                activeSeasonTab === "unlinked"
                  ? "bg-marble/30 text-white"
                  : "bg-white/5 text-marble/60 hover:text-marble/80 hover:bg-white/10 border border-white/5"
              }`}
            >
              Unlinked
            </button>
          )}
        </div>
      )}

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
              <div className="flex items-center gap-2 mb-2">
                {log.is_mentoring && (
                  <span className="px-2 py-0.5 bg-ares-cyan/10 border border-ares-cyan/30 text-[10px] font-black text-ares-cyan uppercase tracking-tighter ares-cut-sm">
                    Mentoring {log.mentored_team_number ? `#${log.mentored_team_number}` : ""}
                  </span>
                )}
              </div>
              <p className="text-marble/50 text-sm line-clamp-2">
                {(() => {
                  try {
                    const ast = JSON.parse(log.description || "");
                    if (ast && ast.type === "doc") {
                      const extract = (node: unknown): string => {
                        if (typeof node !== "object" || !node) return "";
                        const n = node as { text?: string; content?: unknown[] };
                        if (n.text) return String(n.text);
                        if (Array.isArray(n.content)) return n.content.map(extract).join(" ");
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
            
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex flex-col items-center px-4 py-2 bg-white/5 ares-cut min-w-[70px]">
                <span className="text-[10px] font-black text-ares-gold uppercase tracking-tighter">Reach</span>
                <span className="text-lg font-black text-white">{log.reach_count || 0}</span>
              </div>
              <div className="flex flex-col items-center px-4 py-2 bg-white/5 ares-cut min-w-[70px]">
                <span className="text-[10px] font-black text-ares-cyan uppercase tracking-tighter">Hours</span>
                <span className="text-lg font-black text-white">{(log.hours_logged || 0).toFixed(1)}</span>
              </div>
              <div className="flex flex-col items-center px-4 py-2 bg-white/5 ares-cut min-w-[70px]">
                <span className="text-[10px] font-black text-ares-red uppercase tracking-tighter">Students</span>
                <span className="text-lg font-black text-white">{log.students_count || 0}</span>
              </div>
              <div className="flex flex-col items-center px-4 py-2 bg-white/5 ares-cut min-w-[70px]">
                <span className="text-[10px] font-black text-ares-bronze uppercase tracking-tighter">Mentors</span>
                <span className="text-lg font-black text-white">{log.mentor_count || 0}</span>
              </div>
              <div className="flex flex-col items-center px-4 py-2 bg-white/5 ares-cut min-w-[70px]">
                <span className="text-[10px] font-black text-ares-bronze uppercase tracking-tighter">Mnt Hrs</span>
                <span className="text-lg font-black text-white">{(log.mentor_hours || 0).toFixed(1)}</span>
              </div>
              
              {log.is_dynamic && !log.event_id && (
                <div className="flex items-center px-3 py-1 bg-ares-gold/10 border border-ares-gold/20 ares-cut-sm">
                  <span className="text-xs font-bold text-ares-gold uppercase tracking-widest text-center leading-tight">Synced<br/>Event</span>
                </div>
              )}
              {log.is_dynamic && log.event_id && (
                <div className="flex items-center px-3 py-1 bg-ares-cyan/10 border border-ares-cyan/20 ares-cut-sm">
                  <span className="text-xs font-bold text-ares-cyan uppercase tracking-widest text-center leading-tight">Synced<br/>& Edited</span>
                </div>
              )}
              <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => {
                    setIsAdding(true);
                    reset({
                      id: (log.is_dynamic && !log.event_id) ? undefined : log.id,
                      event_id: log.is_dynamic ? (log.event_id || log.id) : null,
                      title: log.title,
                      date: log.date.split('T')[0],
                      location: log.location || "",
                      students_count: log.students_count || 0,
                      hours_logged: log.hours_logged || 0,
                      reach_count: log.reach_count || 0,
                      description: log.description || "",
                      is_mentoring: !!log.is_mentoring,
                      mentored_team_number: log.mentored_team_number || "",
                      season_id: log.season_id || null,
                      mentor_count: log.mentor_count || 0,
                      mentor_hours: log.mentor_hours || 0
                    });
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  title="Edit this impact record"
                  className="p-3 text-marble/60 hover:text-ares-cyan transition-colors bg-white/5 ares-cut"
                >
                  <Pencil size={18} />
                </button>
                {(!log.is_dynamic || log.event_id) && (
                  <button
                    onClick={() => handleDelete(log.id)}
                    title="Purge this impact record"
                    className="p-3 text-marble/60 hover:text-ares-red transition-colors bg-white/5 ares-cut"
                  >
                    <Trash2 size={18} />
                  </button>
                )}
              </div>
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
