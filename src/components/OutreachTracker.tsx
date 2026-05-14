import { useState, useMemo, useCallback } from "react";
import DashboardPageHeader from "./dashboard/DashboardPageHeader";
import DashboardMetricsGrid from "./dashboard/DashboardMetricsGrid";
import DashboardEmptyState from "./dashboard/DashboardEmptyState";
import DashboardLoadingGrid from "./dashboard/DashboardLoadingGrid";
import { DashboardSubmitButton } from "./ui/forms/DashboardSubmitButton";
import { Plus, Trash2, MapPin, Users, Clock, Target, Calendar, CheckCircle, XCircle, Save, Pencil } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import SeasonPicker from "./SeasonPicker";
import { toast } from "sonner";
import { useForm } from "@tanstack/react-form";
import { z } from "zod";
import { AresField } from "./ui/forms/AresField";
import { toastApiError } from "../api/honoClient";

// Schema for validation
const numericFieldSchema = z.union([z.string(), z.number()]).refine(val => val === "" || Number(val) >= 0, "Must be a positive number");

const outreachSchema = z.object({
  id: z.number().nullable().optional(),
  title: z.string().min(1, "Title is required"),
  date: z.string(),
  location: z.string().nullable().optional(),
  studentsCount: numericFieldSchema,
  hours: numericFieldSchema,
  peopleReached: numericFieldSchema,
  impactSummary: z.string().nullable().optional(),
  isMentoring: z.boolean().optional(),
  mentoredTeamNumber: z.string().nullable().optional(),
  seasonId: z.number().nullable().optional(),
  eventId: z.string().nullable().optional(),
  mentorCount: numericFieldSchema.optional(),
  mentorHours: numericFieldSchema.optional(),
});

interface OutreachLog {
  id: number;
  title: string;
  date: string;
  location: string | null;
  studentsCount: number | null;
  hours: number | null;
  peopleReached: number | null;
  impactSummary: string | null;
  isMentoring?: number | null;
  mentoredTeamNumber?: string | null;
  seasonId?: number | null;
  isDynamic?: boolean;
  eventId?: string | null;
  mentorCount?: number | null;
  mentorHours?: number | null;
}

import { useGetAdminOutreach, useSaveOutreach, useDeleteOutreach, useGetSeasons } from "../api";

export default function OutreachTracker() {
  const [isAdding, setIsAdding] = useState(false);
  const [_editingId, setEditingId] = useState<string | null>(null);
  const [activeSeasonTab, setActiveSeasonTab] = useState<string>("all");

  const form = useForm({
    defaultValues: {
      id: null as number | null,
      title: "",
      date: new Date().toISOString().split('T')[0],
      location: "",
      studentsCount: "" as number | string,
      hours: "" as number | string,
      peopleReached: "" as number | string,
      impactSummary: "",
      isMentoring: false,
      mentoredTeamNumber: "",
      seasonId: null as number | null,
      eventId: null as string | null,
      mentorCount: "" as number | string,
      mentorHours: "" as number | string
    },
    onSubmit: async ({ value }) => {
      const submitData: Record<string, unknown> = {
        ...value,
        studentsCount: Number(value.studentsCount) || 0,
        hours: Number(value.hours) || 0,
        peopleReached: Number(value.peopleReached) || 0,
        mentorCount: Number(value.mentorCount) || 0,
        mentorHours: Number(value.mentorHours) || 0,
        impactSummary: value.impactSummary === "" ? null : value.impactSummary,
        location: value.location === "" ? null : value.location,
        mentoredTeamNumber: value.mentoredTeamNumber === "" ? null : value.mentoredTeamNumber,
      };

      // Properly handle id: must be string for updates, undefined (not null) for new records
      if (value.id) {
        submitData.id = String(value.id);
      } else {
        delete submitData.id;
      }

      saveMutation.mutate(submitData, {
        onSuccess: () => {
          toast.success("Impact record synchronized.");
          setIsAdding(false);
          setEditingId(null);
          form.reset();
        },
        onError: (err) => toastApiError(err, "Failed to save impact record")
      });
    }
  });
  const { data: rawOutreachData, isLoading } = useGetAdminOutreach();

  const { data: rawSeasonsData } = useGetSeasons();

  const allLogs: OutreachLog[] = useMemo(() => (rawOutreachData?.logs || []) as unknown as OutreachLog[], [rawOutreachData]);

  interface SeasonInfo { startYear: number; endYear: number; challengeName: string; }
  const seasons: SeasonInfo[] = useMemo(() => (rawSeasonsData?.seasons || []) as unknown as SeasonInfo[], [rawSeasonsData]);
  
  const seasonTabs = useMemo(() => {
    const usedSeasons = new Set(allLogs.map(l => l.seasonId).filter(Boolean));
    return seasons.filter(s => usedSeasons.has(s.startYear)).sort((a, b) => b.startYear - a.startYear);
  }, [allLogs, seasons]);

  const logs = useMemo(() => {
    if (activeSeasonTab === "all") return allLogs;
    if (activeSeasonTab === "unlinked") return allLogs.filter(l => !l.seasonId);
    const yr = parseInt(activeSeasonTab);
    return allLogs.filter(l => l.seasonId === yr);
  }, [allLogs, activeSeasonTab]);

  const handleTabChange = useCallback((tab: string) => setActiveSeasonTab(tab), []);

  const saveMutation = useSaveOutreach();

  const deleteMutation = useDeleteOutreach();

  const handleDelete = (id: string) => {
    if(confirm("Purge this impact record?")) {
      deleteMutation.mutate(id, {
        onSuccess: () => toast.success("Impact record purged."),
        onError: (err) => toastApiError(err, "Failed to delete impact record")
      });
    }
  };

  const totals = useMemo(() => logs.reduce((acc, l) => ({
    hours: acc.hours + (Number(l.hours) || 0),
    mentoringHours: acc.mentoringHours + (l.isMentoring ? (Number(l.hours) || 0) : 0),
    mentorHours: acc.mentorHours + (Number(l.mentorHours) || 0),
    reach: acc.reach + (Number(l.peopleReached) || 0),
    students: acc.students + (Number(l.studentsCount) || 0),
    mentors: acc.mentors + (Number(l.mentorCount) || 0),
    events: acc.events + 1
  }), { hours: 0, mentoringHours: 0, mentorHours: 0, reach: 0, students: 0, mentors: 0, events: 0 }), [logs]);

  return (
    <div className="space-y-8">
      <DashboardMetricsGrid
        metrics={[
          { label: "Community Reach", value: totals.reach.toLocaleString(), icon: <Target className="text-ares-red" /> },
          { label: "Service Hours", value: totals.hours.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 }), icon: <Clock className="text-ares-gold" /> },
          { label: "Mentoring Hours", value: totals.mentoringHours.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 }), icon: <Users className="text-ares-cyan" /> },
          { label: "Mentor Hours", value: totals.mentorHours.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 }), icon: <Users className="text-ares-bronze" /> },
          { label: "Total Events", value: totals.events.toLocaleString(), icon: <CheckCircle className="text-ares-gold" /> },
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
                form.reset();
                setEditingId(null);
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
          <form
            onSubmit={(e) => {
              e.preventDefault();
              form.handleSubmit();
            }}
            className="bg-obsidian border border-ares-red/30 ares-cut-lg p-8 space-y-6 shadow-2xl"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <form.Field
                name="title"
                validators={{
                  onChange: outreachSchema.shape.title,
                }}
              >
                {(field) => (
                  <AresField
                    field={field}
                    label="Event Title"
                    placeholder="e.g. Robot Demo at City Library"
                  />
                )}
              </form.Field>

              <form.Field
                name="date"
                validators={{
                  onChange: outreachSchema.shape.date,
                }}
              >
                {(field) => (
                  <AresField
                    field={field}
                    type="date"
                    label="Date"
                  />
                )}
              </form.Field>

              <form.Field
                name="peopleReached"
                validators={{
                  onChange: outreachSchema.shape.peopleReached,
                }}
              >
                {(field) => (
                  <AresField
                    field={field}
                    type="number"
                    step="1"
                    label="Reach Count (Estimated)"
                  />
                )}
              </form.Field>

              <form.Field
                name="hours"
                validators={{
                  onChange: outreachSchema.shape.hours,
                }}
              >
                {(field) => (
                  <AresField
                    field={field}
                    type="number"
                    step="0.5"
                    label="Hours Logged"
                  />
                )}
              </form.Field>

              <form.Field
                name="studentsCount"
                validators={{
                  onChange: outreachSchema.shape.studentsCount,
                }}
              >
                {(field) => (
                  <AresField
                    field={field}
                    type="number"
                    step="1"
                    label="Students Participating"
                  />
                )}
              </form.Field>

              <form.Field name="mentorCount">
                {(field) => (
                  <AresField
                    field={field}
                    type="number"
                    step="1"
                    label="Mentors Participating"
                  />
                )}
              </form.Field>

              <form.Field name="mentorHours">
                {(field) => (
                  <AresField
                    field={field}
                    type="number"
                    step="0.5"
                    label="Mentor Hours"
                  />
                )}
              </form.Field>

              <form.Field name="impactSummary">
                {(field) => (
                  <AresField
                    field={field}
                    type="textarea"
                    label="Description / Impact Summary"
                    placeholder="Summarize the community impact..."
                  />
                )}
              </form.Field>

              <form.Field name="isMentoring">
                {(field) => (
                  <div className="flex flex-col gap-4">
                    <label className="flex items-center gap-2 cursor-pointer group">
                      <div className={`w-10 h-6 ares-cut-sm transition-colors flex items-center px-1 ${field.state.value ? 'bg-ares-cyan' : 'bg-white/10'}`}>
                        <motion.div
                          animate={{ x: field.state.value ? 16 : 0 }}
                          className="w-4 h-4 bg-white ares-cut-sm shadow-sm"
                        />
                      </div>
                      <input
                        type="checkbox"
                        className="hidden"
                        name={field.name}
                        checked={field.state.value}
                        onChange={(e) => field.handleChange(e.target.checked)}
                      />
                      <span className="text-xs font-bold text-marble/60 group-hover:text-white transition-colors">Mentoring Session</span>
                    </label>

                    {field.state.value && (
                      <form.Field name="mentoredTeamNumber">
                        {(teamField) => (
                          <AresField
                            field={teamField}
                            label="Mentored Team #"
                            placeholder="e.g. 23247"
                          />
                        )}
                      </form.Field>
                    )}
                  </div>
                )}
              </form.Field>

              <form.Field name="seasonId">
                {(field) => (
                  <SeasonPicker
                    value={field.state.value ? String(field.state.value) : ""}
                    onChange={(val) => field.handleChange(val ? parseInt(val) : null)}
                  />
                )}
              </form.Field>
            </div>
            <DashboardSubmitButton
              isPending={saveMutation.isPending}
              defaultText="Finalize Impact Entry"
              icon={<Save size={20} />}
              theme="red"
            />
          </form>
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
              key={s.startYear}
              onClick={() => handleTabChange(s.startYear.toString())}
              className={`px-4 py-2 text-xs font-black uppercase tracking-widest ares-cut-sm transition-all whitespace-nowrap ${
                activeSeasonTab === s.startYear.toString()
                  ? "bg-ares-gold text-obsidian shadow-lg shadow-ares-gold/20"
                  : "bg-white/5 text-marble/60 hover:text-white hover:bg-white/10 border border-white/5"
              }`}
            >
              {s.challengeName} {s.startYear}-{s.endYear}
            </button>
          ))}
          {allLogs.some(l => !l.seasonId) && (
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
                {log.isMentoring && (
                  <span className="px-2 py-0.5 bg-ares-cyan/10 border border-ares-cyan/30 text-[10px] font-black text-ares-cyan uppercase tracking-tighter ares-cut-sm">
                    Mentoring {log.mentoredTeamNumber ? `#${log.mentoredTeamNumber}` : ""}
                  </span>
                )}
              </div>
              <p className="text-marble/50 text-sm line-clamp-2">
                {(() => {
                  try {
                    const ast = JSON.parse(log.impactSummary || "");
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
                  return log.impactSummary;
                })()}
              </p>
            </div>
            
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex flex-col items-center px-4 py-2 bg-white/5 ares-cut min-w-[70px]">
                <span className="text-[10px] font-black text-ares-gold uppercase tracking-tighter">Reach</span>
                <span className="text-lg font-black text-white">{Number(log.peopleReached) || 0}</span>
              </div>
              <div className="flex flex-col items-center px-4 py-2 bg-white/5 ares-cut min-w-[70px]">
                <span className="text-[10px] font-black text-ares-cyan uppercase tracking-tighter">Hours</span>
                <span className="text-lg font-black text-white">{(Number(log.hours) || 0).toFixed(1)}</span>
              </div>
              <div className="flex flex-col items-center px-4 py-2 bg-white/5 ares-cut min-w-[70px]">
                <span className="text-[10px] font-black text-ares-red uppercase tracking-tighter">Students</span>
                <span className="text-lg font-black text-white">{Number(log.studentsCount) || 0}</span>
              </div>
              <div className="flex flex-col items-center px-4 py-2 bg-white/5 ares-cut min-w-[70px]">
                <span className="text-[10px] font-black text-ares-bronze uppercase tracking-tighter">Mentors</span>
                <span className="text-lg font-black text-white">{Number(log.mentorCount) || 0}</span>
              </div>
              <div className="flex flex-col items-center px-4 py-2 bg-white/5 ares-cut min-w-[70px]">
                <span className="text-[10px] font-black text-ares-bronze uppercase tracking-tighter">Mnt Hrs</span>
                <span className="text-lg font-black text-white">{(Number(log.mentorHours) || 0).toFixed(1)}</span>
              </div>
              
              {log.isDynamic && !log.eventId && (
                <div className="flex items-center px-3 py-1 bg-ares-gold/10 border border-ares-gold/20 ares-cut-sm">
                  <span className="text-xs font-bold text-ares-gold uppercase tracking-widest text-center leading-tight">Synced<br/>Event</span>
                </div>
              )}
              {log.isDynamic && log.eventId && (
                <div className="flex items-center px-3 py-1 bg-ares-cyan/10 border border-ares-cyan/20 ares-cut-sm">
                  <span className="text-xs font-bold text-ares-cyan uppercase tracking-widest text-center leading-tight">Synced<br/>& Edited</span>
                </div>
              )}
              <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => {
                    setEditingId(log.id.toString());
                    setIsAdding(true);
                    form.setFieldValue("id", (log.isDynamic && !log.eventId) ? null : log.id);
                    form.setFieldValue("title", log.title);
                    form.setFieldValue("date", log.date.split('T')[0]);
                    form.setFieldValue("location", log.location || "");
                    form.setFieldValue("studentsCount", log.studentsCount || "");
                    form.setFieldValue("hours", log.hours || "");
                    form.setFieldValue("peopleReached", log.peopleReached || "");
                    form.setFieldValue("impactSummary", log.impactSummary || "");
                    form.setFieldValue("isMentoring", !!log.isMentoring);
                    form.setFieldValue("mentoredTeamNumber", log.mentoredTeamNumber || "");
                    form.setFieldValue("seasonId", log.seasonId || null);
                    form.setFieldValue("mentorCount", log.mentorCount || "");
                    form.setFieldValue("mentorHours", log.mentorHours || "");
                    form.setFieldValue("eventId", log.isDynamic ? (log.eventId || log.id.toString()) : null);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  title="Edit this impact record"
                  className="p-3 text-marble/60 hover:text-ares-cyan transition-colors bg-white/5 ares-cut"
                >
                  <Pencil size={18} />
                </button>
                {(!log.isDynamic || log.eventId) && (
                  <button
                    onClick={() => handleDelete(log.id.toString())}
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
