import { useState } from "react";
import DashboardPageHeader from "./dashboard/DashboardPageHeader";
import DashboardMetricsGrid from "./dashboard/DashboardMetricsGrid";
import DashboardEmptyState from "./dashboard/DashboardEmptyState";
import DashboardLoadingGrid from "./dashboard/DashboardLoadingGrid";
import { DashboardInput, DashboardTextarea, DashboardSubmitButton } from "./dashboard/DashboardFormInputs";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, MapPin, Users, Clock, Target, Calendar, CheckCircle, XCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { adminApi } from "../api/adminApi";
import SeasonPicker from "./SeasonPicker";

interface OutreachLog {
  id: string;
  title: string;
  date: string;
  location: string | null;
  students_count: number;
  hours_logged: number;
  reach_count: number;
  description: string | null;
  season_id?: string | null;
  is_dynamic?: boolean;
}

export default function OutreachTracker() {
  const queryCenter = useQueryClient();
  const [isAdding, setIsAdding] = useState(false);
  const [formData, setFormData] = useState<Partial<OutreachLog>>({
    id: "",
    title: "",
    date: new Date().toISOString().split('T')[0],
    location: "",
    students_count: 0,
    hours_logged: 0,
    reach_count: 0,
    description: "",
    season_id: ""
  });

  const { data: logs = [], isLoading } = useQuery<OutreachLog[]>({
    queryKey: ["admin-outreach"],
    queryFn: async () => {
      try {
        const d = await adminApi.get<{ logs?: OutreachLog[] }>("/api/admin/outreach");
        return d.logs || [];
      } catch {
        return [];
      }
    }
  });

  const saveMutation = useMutation({
    mutationFn: async (log: Partial<OutreachLog>) => {
      await adminApi.request("/api/admin/outreach", {
        method: "POST",
        body: JSON.stringify(log)
      });
    },
    onSuccess: () => {
      queryCenter.invalidateQueries({ queryKey: ["admin-outreach"] });
      setIsAdding(false);
      setFormData({ 
        id: "", title: "", date: new Date().toISOString().split('T')[0], 
        location: "", students_count: 0, hours_logged: 0, reach_count: 0, description: "", season_id: "" 
      });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await adminApi.request(`/api/admin/outreach/${id}`, { method: "DELETE" });
    },
    onSuccess: () => queryCenter.invalidateQueries({ queryKey: ["admin-outreach"] })
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.date) return;
    const finalId = formData.id || formData.title.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + formData.date;
    saveMutation.mutate({ ...formData, id: finalId });
  };

  const totals = logs.reduce((acc, l) => ({
    hours: acc.hours + (l.hours_logged || 0),
    reach: acc.reach + (l.reach_count || 0),
    students: acc.students + (l.students_count || 0),
    events: acc.events + 1
  }), { hours: 0, reach: 0, students: 0, events: 0 });

  return (
    <div className="space-y-8">
      {/* Metrics Summary */}
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
            onClick={() => setIsAdding(!isAdding)}
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
            onSubmit={handleSubmit}
            className="bg-obsidian border border-ares-red/30 ares-cut-lg p-8 space-y-6 shadow-2xl"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <DashboardInput
                id="outreach-title"
                label="Event Title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="e.g. Robot Demo at City Library"
                focusColor="ares-red"
                fullWidth
                required
              />
              <DashboardInput
                id="outreach-date"
                type="date"
                label="Date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                focusColor="ares-red"
                required
              />
              <DashboardInput
                id="outreach-reach"
                type="number"
                label="Reach Count (Estimated)"
                value={formData.reach_count || 0}
                onChange={(e) => setFormData({ ...formData, reach_count: parseInt(e.target.value) })}
                focusColor="ares-red"
              />
              <DashboardInput
                id="outreach-hours"
                type="number"
                step="0.5"
                label="Hours Logged"
                value={formData.hours_logged || 0}
                onChange={(e) => setFormData({ ...formData, hours_logged: parseFloat(e.target.value) })}
                focusColor="ares-red"
              />
              <DashboardInput
                id="outreach-students"
                type="number"
                label="Students Participating"
                value={formData.students_count || 0}
                onChange={(e) => setFormData({ ...formData, students_count: parseInt(e.target.value) })}
                focusColor="ares-red"
              />
              <DashboardTextarea
                id="outreach-desc"
                label="Description / Impact Summary"
                value={formData.description || ""}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Summarize the community impact..."
                focusColor="ares-red"
                fullWidth
              />
              <SeasonPicker value={formData.season_id || ""} onChange={(val) => setFormData({ ...formData, season_id: val })} />
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
                  onClick={() => { if(confirm("Purge this impact record?")) deleteMutation.mutate(log.id); }}
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

// Icon helper
function Save({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
      <polyline points="17 21 17 13 7 13 7 21" />
      <polyline points="7 3 7 8 15 8" />
    </svg>
  );
}
