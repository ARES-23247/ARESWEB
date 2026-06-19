"use client";

import React, { useEffect, useState, useMemo } from "react";
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
import { collection, onSnapshot, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface OutreachLog {
  id: string;
  title: string;
  date: string;
  location?: string | null;
  hours: number;
  peopleReached: number;
  impactSummary?: string | null;
  eventId?: string | null;
  createdAt?: string | null;
}

interface TeamEvent {
  id: string;
  title: string;
  dateStart: string;
  dateEnd: string;
  location?: string | null;
  locationId: string;
  description: string;
  category: string;
  isVolunteer: number;
  isDeleted: number;
  status: string;
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
  const [formEventId, setFormEventId] = useState<string | null>(null);

  // Calendar Event states
  const [events, setEvents] = useState<TeamEvent[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [isCalculatingHours, setIsCalculatingHours] = useState<string | null>(null);
  const [calcLogMessage, setCalcLogMessage] = useState<string | null>(null);

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

  // Listen for locations
  useEffect(() => {
    try {
      const locationsRef = collection(db, "locations");
      const unsubscribe = onSnapshot(locationsRef, (snapshot) => {
        const list = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }));
        setLocations(list);
      });
      return () => unsubscribe();
    } catch (e) {
      console.warn("Error listening to locations:", e);
    }
  }, []);

  // Listen for calendar events
  useEffect(() => {
    try {
      const eventsRef = collection(db, "events");
      const unsubscribe = onSnapshot(eventsRef, (snapshot) => {
        const list = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            title: data.title || "Untitled Event",
            dateStart: data.dateStart || "",
            dateEnd: data.dateEnd || "",
            location: data.location || null,
            locationId: data.locationId || "",
            description: data.description || "",
            category: data.category || "",
            isVolunteer: Number(data.isVolunteer || 0),
            isDeleted: Number(data.isDeleted || 0),
            status: data.status || "published"
          } as TeamEvent;
        });
        setEvents(list);
      });
      return () => unsubscribe();
    } catch (e) {
      console.warn("Error listening to calendar events:", e);
    }
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [user]);

  // Derived memo states
  const loggedEventIds = useMemo(() => {
    return new Set(logs.map((l) => l.eventId).filter(Boolean) as string[]);
  }, [logs]);

  const pendingEvents = useMemo(() => {
    return events.filter(
      (e) =>
        e.isVolunteer === 1 &&
        e.isDeleted !== 1 &&
        e.status === "published" &&
        !loggedEventIds.has(e.id)
    );
  }, [events, loggedEventIds]);

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
        eventId: formEventId || null,
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
    setFormEventId(log.eventId || null);
    setCalcLogMessage(null);
  };

  const resetForm = () => {
    setEditingId(null);
    setTitle("");
    setDate("");
    setLocation("");
    setHours(0);
    setPeopleReached(0);
    setImpactSummary("");
    setFormEventId(null);
    setCalcLogMessage(null);
  };

  const handleLogPendingEvent = async (event: TeamEvent) => {
    setIsCalculatingHours(event.id);
    setCalcLogMessage(null);
    try {
      // Find location name/address if locationId matches
      const loc = locations.find((l) => l.id === event.locationId);
      const locationStr = loc ? `${loc.name}, ${loc.address}` : (event.location || "");

      // Pre-fill standard fields
      setEditingId(null);
      setTitle(event.title);
      const dateStr = event.dateStart ? event.dateStart.split("T")[0] : "";
      setDate(dateStr);
      setLocation(locationStr);
      setFormEventId(event.id);

      if (event.description) {
        setImpactSummary(`Volunteer team conducted community STEM demo: ${event.description}`);
      }

      // Query signups to calculate hours
      const signupsRef = collection(db, "events", event.id, "signups");
      const signupsSnap = await getDocs(signupsRef);
      const signupList = signupsSnap.docs.map((docSnap) => docSnap.data());

      // Calculate duration
      let durationHours = 0;
      if (event.dateStart && event.dateEnd) {
        const start = new Date(event.dateStart).getTime();
        const end = new Date(event.dateEnd).getTime();
        if (end > start) {
          durationHours = (end - start) / (1000 * 60 * 60);
        }
      }

      // Count checked-in attendees
      const checkedIn = signupList.filter((s) => s.attended === true);
      const attendeeCount = checkedIn.length;
      const prepHoursSum = signupList.reduce((acc, s) => acc + Number(s.prepHours || 0), 0);

      let calculatedHours = 0;
      let explanation = "";

      if (attendeeCount > 0) {
        calculatedHours = (durationHours * attendeeCount) + prepHoursSum;
        explanation = `Auto-calculated: (${durationHours} hrs duration × ${attendeeCount} present) + ${prepHoursSum} hrs prep = ${calculatedHours.toFixed(2)} hrs`;
      } else {
        const rsvpCount = signupList.length;
        if (rsvpCount > 0) {
          calculatedHours = (durationHours * rsvpCount) + prepHoursSum;
          explanation = `Note: No check-ins. Estimated from RSVPs: (${durationHours} hrs duration × ${rsvpCount} RSVPs) + ${prepHoursSum} hrs prep = ${calculatedHours.toFixed(2)} hrs`;
        } else {
          calculatedHours = durationHours;
          explanation = `Note: No attendance registered. Set to event duration: ${durationHours.toFixed(2)} hrs`;
        }
      }

      setHours(Math.max(0, Math.round(calculatedHours * 100) / 100));
      setCalcLogMessage(explanation);
    } catch (err: any) {
      console.error("Error calculating hours:", err);
      alert("Failed to load signups for calculating volunteer hours. Standard fields are pre-filled.");
    } finally {
      setIsCalculatingHours(null);
    }
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
          
          {/* Pending Volunteer Events Panel */}
          {pendingEvents.length > 0 && (
            <div className="bg-white/5 border border-ares-gold/20 p-6 ares-cut space-y-4 mb-6 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-ares-gold/5 blur-2xl pointer-events-none rounded-full"></div>
              <div className="flex items-center justify-between border-b border-white/5 pb-3">
                <h2 className="text-sm font-bold uppercase tracking-wider text-ares-gold flex items-center gap-2 font-heading">
                  <Clock size={14} className="text-ares-gold animate-pulse" />
                  Unlogged Volunteer Calendar Events ({pendingEvents.length})
                </h2>
                <span className="text-[10px] bg-ares-gold/15 text-ares-gold px-2 py-0.5 font-mono font-bold ares-cut-sm">
                  Awaiting Report
                </span>
              </div>
              <p className="text-xs text-marble/60">
                These events were marked as volunteer demos but haven't been logged in your outreach stats. Click <strong>Log Impact</strong> to auto-calculate service hours and prep the entry.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                {pendingEvents.map((evt) => {
                  const isSelected = formEventId === evt.id;
                  return (
                    <div 
                      key={evt.id} 
                      className={`border p-4 ares-cut flex flex-col justify-between gap-3 transition-all ${
                        isSelected 
                          ? "bg-ares-red/10 border-ares-red/40" 
                          : "bg-white/5 border-white/10 hover:border-white/20"
                      }`}
                    >
                      <div className="space-y-1">
                        <h3 className="font-bold text-white text-sm uppercase tracking-tight font-heading truncate" title={evt.title}>
                          {evt.title}
                        </h3>
                        <p className="text-[10px] text-marble/55 font-mono">
                          {evt.dateStart ? evt.dateStart.split("T")[0] : ""}
                        </p>
                      </div>
                      <button
                        onClick={() => handleLogPendingEvent(evt)}
                        disabled={isCalculatingHours === evt.id}
                        className="w-full text-center py-1.5 px-3 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-ares-gold/45 text-[10px] font-black uppercase tracking-wider text-marble hover:text-ares-gold transition-all ares-cut-sm disabled:opacity-50 cursor-pointer font-bold"
                      >
                        {isCalculatingHours === evt.id ? "Analyzing Attendance..." : "Log Impact"}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

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
              
              {/* Linked Calendar Event Notice */}
              {formEventId && (
                <div className="flex items-center justify-between text-[10px] bg-ares-gold/15 text-ares-gold border border-ares-gold/25 px-3 py-2 ares-cut-sm font-black uppercase tracking-wider">
                  <span className="flex items-center gap-1.5">
                    <Clock size={12} /> Linked to Calendar Event
                  </span>
                  <button 
                    type="button" 
                    onClick={() => {
                      setFormEventId(null);
                      setCalcLogMessage(null);
                    }}
                    className="text-ares-gold hover:text-white transition-colors cursor-pointer"
                    title="Unlink from Calendar"
                  >
                    <X size={12} />
                  </button>
                </div>
              )}

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
                    step="any"
                    required
                    placeholder="0"
                    value={hours || ""}
                    onChange={(e) => setHours(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-full bg-obsidian border border-white/10 ares-cut-sm px-3.5 py-2 text-xs text-white placeholder-marble/30 focus:outline-none focus:border-ares-red focus:ring-1 focus:ring-ares-red/10 transition-all font-semibold"
                  />
                  {calcLogMessage && (
                    <p className="text-[9px] text-ares-gold/90 font-medium leading-normal bg-ares-gold/5 border border-ares-gold/10 p-1.5 ares-cut-sm mt-1 font-mono">
                      {calcLogMessage}
                    </p>
                  )}
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
