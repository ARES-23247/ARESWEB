import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, MapPin, Users, Clock, Target, Calendar, CheckCircle, XCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface OutreachLog {
  id: string;
  title: string;
  date: string;
  location: string | null;
  students_count: number;
  hours_logged: number;
  reach_count: number;
  description: string | null;
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
    description: ""
  });

  const { data: logs = [], isLoading } = useQuery<OutreachLog[]>({
    queryKey: ["admin-outreach"],
    queryFn: async () => {
      const r = await fetch("/api/admin/outreach");
      const d = await r.json() as { logs?: OutreachLog[] };
      return d.logs || [];
    }
  });

  const saveMutation = useMutation({
    mutationFn: async (log: Partial<OutreachLog>) => {
      const r = await fetch("/api/admin/outreach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(log)
      });
      if (!r.ok) throw new Error("Failed to save outreach log");
    },
    onSuccess: () => {
      queryCenter.invalidateQueries({ queryKey: ["admin-outreach"] });
      setIsAdding(false);
      setFormData({ 
        id: "", title: "", date: new Date().toISOString().split('T')[0], 
        location: "", students_count: 0, hours_logged: 0, reach_count: 0, description: "" 
      });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/admin/outreach/${id}`, { method: "DELETE" });
      if (!r.ok) throw new Error("Failed to delete log");
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
    hours: acc.hours + l.hours_logged,
    reach: acc.reach + l.reach_count,
    students: acc.students + l.students_count,
    events: acc.events + 1
  }), { hours: 0, reach: 0, students: 0, events: 0 });

  return (
    <div className="space-y-8">
      {/* Metrics Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Community Reach", val: totals.reach.toLocaleString(), icon: <Target className="text-ares-red" /> },
          { label: "Service Hours", val: totals.hours.toLocaleString(), icon: <Clock className="text-ares-gold" /> },
          { label: "Student Leads", val: totals.students.toLocaleString(), icon: <Users className="text-ares-cyan" /> },
          { label: "Total Events", val: totals.events, icon: <CheckCircle className="text-emerald-500" /> },
        ].map(m => (
          <div key={m.label} className="bg-white/5 border border-white/5 p-6 rounded-3xl">
            <div className="flex items-center gap-2 mb-2 opacity-50 uppercase text-[10px] font-bold tracking-widest text-zinc-400">
              {m.icon} {m.label}
            </div>
            <div className="text-3xl font-black text-white">{m.val}</div>
          </div>
        ))}
      </div>

      <div className="flex justify-between items-center bg-black/40 border border-white/10 p-6 rounded-[2.5rem]">
        <div>
          <h2 className="text-2xl font-black text-white flex items-center gap-3 italic">
            <Target className="text-ares-red" /> Impact Logging
          </h2>
          <p className="text-zinc-500 text-sm">Document every interaction for the FIRST Impact Award.</p>
        </div>
        <button
          onClick={() => setIsAdding(!isAdding)}
          className="flex items-center gap-2 px-4 py-2 bg-ares-red text-white font-bold rounded-xl hover:bg-red-700 transition-colors shadow-lg shadow-ares-red/20"
        >
          {isAdding ? <XCircle size={18} /> : <Plus size={18} />}
          {isAdding ? "Cancel" : "Log Outreach"}
        </button>
      </div>

      <AnimatePresence>
        {isAdding && (
          <motion.form
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            onSubmit={handleSubmit}
            className="bg-zinc-900 border border-ares-red/30 rounded-3xl p-8 space-y-6 shadow-2xl"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="md:col-span-2 space-y-1">
                <label htmlFor="outreach-title" className="text-xs font-bold uppercase tracking-widest text-zinc-500">Event Title</label>
                <input
                  id="outreach-title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-ares-red outline-none transition-colors"
                  placeholder="e.g. Robot Demo at City Library"
                  required
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="outreach-date" className="text-xs font-bold uppercase tracking-widest text-zinc-500">Date</label>
                <input
                  id="outreach-date"
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-ares-red outline-none transition-colors"
                  required
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="outreach-reach" className="text-xs font-bold uppercase tracking-widest text-zinc-500">Reach Count (Estimated)</label>
                <input
                  id="outreach-reach"
                  type="number"
                  value={formData.reach_count || 0}
                  onChange={(e) => setFormData({ ...formData, reach_count: parseInt(e.target.value) })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-ares-red outline-none transition-colors"
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="outreach-hours" className="text-xs font-bold uppercase tracking-widest text-zinc-500">Hours Logged</label>
                <input
                  id="outreach-hours"
                  type="number"
                  step="0.5"
                  value={formData.hours_logged || 0}
                  onChange={(e) => setFormData({ ...formData, hours_logged: parseFloat(e.target.value) })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-ares-red outline-none transition-colors"
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="outreach-students" className="text-xs font-bold uppercase tracking-widest text-zinc-500">Students Participating</label>
                <input
                  id="outreach-students"
                  type="number"
                  value={formData.students_count || 0}
                  onChange={(e) => setFormData({ ...formData, students_count: parseInt(e.target.value) })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-ares-red outline-none transition-colors"
                />
              </div>
              <div className="lg:col-span-3 space-y-1">
                <label htmlFor="outreach-desc" className="text-xs font-bold uppercase tracking-widest text-zinc-500">Description / Impact Summary</label>
                <textarea
                  id="outreach-desc"
                  value={formData.description || ""}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-ares-red outline-none transition-colors min-h-[100px]"
                  placeholder="Summarize the community impact..."
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={saveMutation.isPending}
              className="w-full py-4 bg-ares-red text-white font-black rounded-2xl hover:shadow-[0_0_30px_rgba(220,38,38,0.3)] transition-all flex items-center justify-center gap-2"
            >
              {saveMutation.isPending ? "Syncing..." : <><Save size={20} /> Finalize Impact Entry</>}
            </button>
          </motion.form>
        )}
      </AnimatePresence>

      <div className="space-y-4">
        {isLoading ? (
          <div className="h-48 bg-white/5 rounded-3xl animate-pulse" />
        ) : logs.map((log) => (
          <div key={log.id} className="bg-black/40 border border-white/5 rounded-3xl p-6 group hover:border-white/20 transition-all flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div className="flex-1">
              <div className="flex items-center gap-3 text-zinc-500 text-[10px] font-bold uppercase tracking-widest mb-2">
                 <span className="flex items-center gap-1"><Calendar size={12} /> {log.date}</span>
                 {log.location && <span className="flex items-center gap-1">&middot; <MapPin size={12} /> {log.location}</span>}
              </div>
              <h4 className="text-xl font-bold text-white mb-2">{log.title}</h4>
              <p className="text-zinc-500 text-sm line-clamp-2">{log.description}</p>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="flex flex-col items-center px-4 py-2 bg-white/5 rounded-2xl min-w-[80px]">
                <span className="text-[10px] font-black text-ares-gold uppercase tracking-tighter">Reach</span>
                <span className="text-lg font-black text-white">{log.reach_count}</span>
              </div>
              <div className="flex flex-col items-center px-4 py-2 bg-white/5 rounded-2xl min-w-[80px]">
                <span className="text-[10px] font-black text-ares-cyan uppercase tracking-tighter">Hours</span>
                <span className="text-lg font-black text-white">{log.hours_logged.toFixed(1)}</span>
              </div>
              
              {log.is_dynamic ? (
                <div className="flex items-center px-3 py-1 bg-ares-gold/10 border border-ares-gold/20 rounded-xl">
                  <span className="text-[10px] font-bold text-ares-gold uppercase tracking-widest text-center leading-tight">Synced<br/>Event</span>
                </div>
              ) : (
                <button
                  onClick={() => { if(confirm("Purge this impact record?")) deleteMutation.mutate(log.id); }}
                  className="p-3 text-zinc-600 hover:text-ares-red transition-colors bg-white/5 rounded-2xl opacity-0 group-hover:opacity-100"
                >
                  <Trash2 size={18} />
                </button>
              )}
            </div>
          </div>
        ))}
        {logs.length === 0 && !isLoading && !isAdding && (
          <div className="py-20 text-center border-2 border-dashed border-white/5 rounded-[3rem]">
             <p className="text-zinc-600 font-medium italic">No outreach records found. Start logging your team&apos;s impact.</p>
          </div>
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
