"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { authenticatedFetch } from "@/lib/api";
import { 
  Sparkles, 
  Trash2, 
  Search, 
  AlertCircle, 
  RefreshCw,
  Plus,
  MapPin,
  Clock,
  Users,
  Edit2,
  X
} from "lucide-react";

interface OutreachLog {
  id: string;
  title: string;
  date: string;
  location?: string | null;
  hours: number;
  peopleReached: number;
  impactSummary?: string | null;
  createdAt?: string | null;
}

export default function OutreachManagerPage() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<OutreachLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  // Search and Filter states
  const [searchQuery, setSearchQuery] = useState("");

  // Form states
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [location, setLocation] = useState("");
  const [hours, setHours] = useState(0);
  const [peopleReached, setPeopleReached] = useState(0);
  const [impactSummary, setImpactSummary] = useState("");

  const fetchLogs = async () => {
    if (!user) return;
    setIsLoading(true);
    setError("");
    try {
      const res = await authenticatedFetch("/api/outreach/admin");
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to fetch outreach logs.");
      }
      setLogs(data.logs || []);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to load outreach logs.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [user]);

  const handleSaveLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !date.trim()) {
      alert("Title and Date are required.");
      return;
    }
    if (hours < 0 || peopleReached < 0) {
      alert("Hours and People Reached must be non-negative numbers.");
      return;
    }

    setIsSaving(true);
    try {
      const payload: Partial<OutreachLog> = {
        title: title.trim(),
        date: date.trim(),
        location: location.trim() || null,
        hours: Number(hours),
        peopleReached: Number(peopleReached),
        impactSummary: impactSummary.trim() || null,
      };

      if (editingId) {
        payload.id = editingId;
      }

      const res = await authenticatedFetch("/api/outreach/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to save outreach log.");
      }

      // Reset form
      resetForm();
      // Reload list
      await fetchLogs();
    } catch (err: any) {
      alert(err.message || "Failed to save outreach log.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditClick = (log: OutreachLog) => {
    setEditingId(log.id);
    setTitle(log.title);
    setDate(log.date);
    setLocation(log.location || "");
    setHours(log.hours);
    setPeopleReached(log.peopleReached);
    setImpactSummary(log.impactSummary || "");
  };

  const resetForm = () => {
    setEditingId(null);
    setTitle("");
    setDate("");
    setLocation("");
    setHours(0);
    setPeopleReached(0);
    setImpactSummary("");
  };

  const handleDeleteLog = async (id: string) => {
    if (!window.confirm("Are you sure you want to permanently delete this outreach log?")) return;

    try {
      const res = await authenticatedFetch(`/api/outreach/admin/${id}`, {
        method: "DELETE",
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to delete outreach log.");
      }

      setLogs((prev) => prev.filter((s) => s.id !== id));
    } catch (err: any) {
      alert(err.message || "Failed to delete outreach log.");
    }
  };

  // Filter logs based on search query
  const filteredLogs = logs.filter((log) => {
    const queryLower = searchQuery.toLowerCase();
    return log.title.toLowerCase().includes(queryLower) ||
      (log.location && log.location.toLowerCase().includes(queryLower)) ||
      (log.impactSummary && log.impactSummary.toLowerCase().includes(queryLower));
  });

  return (
    <div className="space-y-8">
      {/* ─── PAGE HEADER ─── */}
      <header className="border-b border-white/5 pb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <p className="text-ares-gold font-bold uppercase tracking-widest text-xs mb-3 font-heading flex items-center gap-2">
            <Sparkles size={12} className="text-ares-gold" /> STEM Service Demos
          </p>
          <h1 className="text-4xl md:text-5xl font-black text-white uppercase tracking-tighter font-heading">
            Outreach Manager
          </h1>
          <p className="text-marble/70 text-sm mt-2 font-medium">
            Review, add, and modify community volunteer events, student service hours, and estimated people reached.
          </p>
        </div>
        <button 
          onClick={fetchLogs}
          className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-black uppercase tracking-wider transition-colors cursor-pointer w-fit font-bold ares-cut-sm"
        >
          <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} /> Refresh
        </button>
      </header>

      {/* ─── MAIN WORKSPACE GRID ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* LEFT COLUMN: LIST OF LOGS */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Search bar */}
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-marble/40" size={16} />
            <input
              type="text"
              placeholder="Search outreach events by title, summary, or location..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-obsidian border border-white/10 ares-cut-sm pl-10 pr-4 py-2 text-xs text-white placeholder-marble/30 focus:outline-none focus:border-ares-red focus:ring-1 focus:ring-ares-red/10 transition-all font-semibold"
            />
          </div>

          {/* List display */}
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 bg-white/5 border border-white/5 ares-cut gap-4">
              <RefreshCw size={36} className="text-ares-red animate-spin" />
              <span className="text-xs font-bold uppercase tracking-widest text-marble/55">Loading impact logs...</span>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-16 bg-ares-red/10 border border-ares-red/20 ares-cut gap-4 text-center">
              <AlertCircle size={36} className="text-ares-red" />
              <span className="text-sm font-bold text-ares-red">{error}</span>
              <button onClick={fetchLogs} className="px-4 py-2 bg-ares-red text-white text-xs font-black uppercase tracking-wider ares-cut-sm shadow-md cursor-pointer font-bold">Retry</button>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 bg-white/5 border border-white/5 ares-cut gap-3 text-center">
              <Sparkles size={36} className="text-marble/30" />
              <span className="text-sm font-bold text-white/80 font-heading">No Events Recorded</span>
              <span className="text-xs text-marble/50 font-medium">Record a STEM service log using the panel on the right.</span>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredLogs.map((log) => (
                <div 
                  key={log.id} 
                  className="bg-white/5 border border-white/10 p-6 ares-cut flex flex-col md:flex-row justify-between gap-6 hover:border-white/20 transition-all shadow-xl"
                >
                  <div className="space-y-3 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[10px] text-marble/50 font-mono font-bold uppercase">
                      {log.location && (
                        <span className="flex items-center gap-1">
                          <MapPin size={10} className="text-ares-red" /> {log.location}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Clock size={10} className="text-ares-gold" /> {log.date}
                      </span>
                    </div>

                    <h3 className="font-extrabold text-white text-lg tracking-tight truncate leading-tight uppercase font-heading">
                      {log.title}
                    </h3>
                    
                    {log.impactSummary && (
                      <p className="text-xs text-marble/75 leading-relaxed">
                        {log.impactSummary}
                      </p>
                    )}

                    <div className="flex flex-wrap gap-4 text-[10px] font-black uppercase tracking-wider text-marble/60 pt-1">
                      <span className="flex items-center gap-1 border border-white/10 bg-white/5 px-2 py-0.5 ares-cut-sm">
                        Hours: <strong className="text-white">{log.hours}</strong>
                      </span>
                      <span className="flex items-center gap-1 border border-white/10 bg-white/5 px-2 py-0.5 ares-cut-sm">
                        Reach: <strong className="text-white">{log.peopleReached}</strong>
                      </span>
                    </div>
                  </div>

                  {/* Actions Drawer */}
                  <div className="flex items-center gap-3 shrink-0 self-end md:self-center border-t md:border-t-0 border-white/5 pt-3 md:pt-0 mt-3 md:mt-0 w-full md:w-auto justify-end">
                    <button
                      onClick={() => handleEditClick(log)}
                      className="p-2 bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 text-marble/85 hover:text-white ares-cut-sm transition-all cursor-pointer"
                      title="Edit Log Details"
                    >
                      <Edit2 size={12} />
                    </button>
                    <button
                      onClick={() => handleDeleteLog(log.id)}
                      className="p-2 bg-ares-red/10 border border-ares-red/30 hover:bg-ares-red/20 text-ares-red hover:text-white ares-cut-sm transition-all cursor-pointer"
                      title="Delete Log"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>

                </div>
              ))}
            </div>
          )}

        </div>

        {/* RIGHT COLUMN: CREATOR & EDITOR FORM */}
        <div className="lg:col-span-1">
          <div className="glass-card p-6 border border-white/10 ares-cut flex flex-col gap-6 sticky top-24 shadow-2xl">
            <h2 className="text-lg font-bold border-b border-white/5 pb-3 text-ares-gold flex items-center gap-2 font-heading uppercase tracking-tight">
              {editingId ? <Edit2 size={18} /> : <Plus size={18} />}
              {editingId ? "Edit Service Log" : "Add Service Log"}
            </h2>

            <form onSubmit={handleSaveLog} className="space-y-5">
              
              {/* Event Title */}
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold text-marble/55 tracking-widest block">Event Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Morgantown Library STEM Day"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-obsidian border border-white/10 ares-cut-sm px-3.5 py-2 text-xs text-white placeholder-marble/30 focus:outline-none focus:border-ares-red focus:ring-1 focus:ring-ares-red/10 transition-all font-semibold"
                />
              </div>

              {/* Event Date */}
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold text-marble/55 tracking-widest block">Event Date *</label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full bg-obsidian border border-white/10 ares-cut-sm px-3.5 py-2 text-xs text-white focus:outline-none focus:border-ares-red focus:ring-1 focus:ring-ares-red/10 transition-all font-bold"
                />
              </div>

              {/* Location */}
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold text-marble/55 tracking-widest block">Location</label>
                <input
                  type="text"
                  placeholder="e.g. Westover, WV"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full bg-obsidian border border-white/10 ares-cut-sm px-3.5 py-2 text-xs text-white placeholder-marble/30 focus:outline-none focus:border-ares-red focus:ring-1 focus:ring-ares-red/10 transition-all font-semibold"
                />
              </div>

              {/* Hours / Reach Grid */}
              <div className="grid grid-cols-2 gap-4">
                {/* Total Service Hours */}
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-marble/55 tracking-widest block">Service Hours</label>
                  <input
                    type="number"
                    min="0"
                    required
                    placeholder="0"
                    value={hours || ""}
                    onChange={(e) => setHours(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full bg-obsidian border border-white/10 ares-cut-sm px-3.5 py-2 text-xs text-white placeholder-marble/30 focus:outline-none focus:border-ares-red focus:ring-1 focus:ring-ares-red/10 transition-all font-semibold"
                  />
                </div>

                {/* People Reached */}
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-marble/55 tracking-widest block">Impact Reach</label>
                  <input
                    type="number"
                    min="0"
                    required
                    placeholder="0"
                    value={peopleReached || ""}
                    onChange={(e) => setPeopleReached(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full bg-obsidian border border-white/10 ares-cut-sm px-3.5 py-2 text-xs text-white placeholder-marble/30 focus:outline-none focus:border-ares-red focus:ring-1 focus:ring-ares-red/10 transition-all font-semibold"
                  />
                </div>
              </div>

              {/* Impact Summary */}
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold text-marble/55 tracking-widest block">Impact Summary</label>
                <textarea
                  placeholder="Provide a brief summary of the demonstrations performed and community impact..."
                  rows={4}
                  value={impactSummary}
                  onChange={(e) => setImpactSummary(e.target.value)}
                  className="w-full bg-obsidian border border-white/10 ares-cut-sm px-3.5 py-2 text-xs text-white placeholder-marble/30 focus:outline-none focus:border-ares-red focus:ring-1 focus:ring-ares-red/10 transition-all font-semibold resize-none"
                />
              </div>

              {/* Form Buttons */}
              <div className="flex gap-4 pt-2">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 clipped-button-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed text-xs font-bold py-2.5 shadow-md"
                >
                  {isSaving ? <RefreshCw size={14} className="animate-spin" /> : editingId ? "Update" : "Record"}
                </button>
                {editingId && (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs font-black uppercase tracking-wider ares-cut-sm shadow-md cursor-pointer font-bold text-center"
                  >
                    Cancel
                  </button>
                )}
              </div>

            </form>
          </div>
        </div>

      </div>
    </div>
  );
}
