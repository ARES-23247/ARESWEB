"use client";

import React, { useEffect, useState } from "react";
import { collection, doc, onSnapshot, setDoc, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { Plus, Trash2, Pencil, Shield, Activity, MapPin, Calendar, Clock, X } from "lucide-react";
import { useFocusTrap } from "@/lib/useFocusTrap";

interface TeamEvent {
  id: string;
  title: string;
  dateStart: string;
  dateEnd?: string;
  location?: string;
  description?: string;
  category: "internal" | "outreach";
}

const MOCK_EVENTS: TeamEvent[] = [
  {
    id: "event_1",
    title: "Spark! Goes WILD Exhibition",
    dateStart: "2026-05-24T09:30:00",
    dateEnd: "2026-05-24T14:30:00",
    location: "SPARK! WV Museum",
    description: "Team outreach, STEM workshops, and public science bridge exhibits.",
    category: "outreach"
  },
  {
    id: "event_2",
    title: "Sunday Night Driver Practice",
    dateStart: "2026-05-24T18:00:00",
    dateEnd: "2026-05-24T20:30:00",
    location: "MARS Laboratory",
    description: "Weekly telemetry calibrations and driver practice on standard field.",
    category: "internal"
  },
  {
    id: "event_3",
    title: "Overnight Scrimmage & Prep",
    dateStart: "2026-06-12T18:00:00",
    dateEnd: "2026-06-13T01:00:00",
    location: "Championship Scrimmage Field",
    description: "Extended overnight competition prep and match simulation.",
    category: "internal"
  }
];

export default function EventsManagementPage() {
  const { user, authorizedUser } = useAuth();
  const [events, setEvents] = useState<TeamEvent[]>(MOCK_EVENTS);
  const [isLive, setIsLive] = useState(false);

  // Editor State
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [formTitle, setFormTitle] = useState("");
  const [formDateStart, setFormDateStart] = useState("");
  const [formDateEnd, setFormDateEnd] = useState("");
  const [formLocation, setFormLocation] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formCategory, setFormCategory] = useState<"internal" | "outreach">("internal");
  const editorRef = useFocusTrap(isEditorOpen, () => setIsEditorOpen(false));

  const canEdit = !!(user && authorizedUser && authorizedUser.role !== "unverified");

  // 1. Listen for real-time calendar event updates
  useEffect(() => {
    try {
      const eventsRef = collection(db, "events");
      const unsubscribe = onSnapshot(
        eventsRef,
        (snapshot) => {
          if (snapshot.empty) {
            setEvents(MOCK_EVENTS);
            setIsLive(false);
            return;
          }
          const list = snapshot.docs.map((doc) => {
            const data = doc.data();
            return {
              id: doc.id,
              title: data.title || "Untitled Event",
              dateStart: data.dateStart || "",
              dateEnd: data.dateEnd || "",
              location: data.location || "",
              description: data.description || "",
              category: data.category || "internal"
            } as TeamEvent;
          });
          
          // Sort events by dateStart ASC
          list.sort((a, b) => new Date(a.dateStart).getTime() - new Date(b.dateStart).getTime());
          setEvents(list);
          setIsLive(true);
        },
        (err) => {
          console.warn("Firestore not connected, using fallback mock events.", err.message);
          setEvents(MOCK_EVENTS);
          setIsLive(false);
        }
      );
      return () => unsubscribe();
    } catch (e) {
      console.warn("Local sandbox mode, using static mock schedule.", e);
      setEvents(MOCK_EVENTS);
      setIsLive(false);
    }
  }, []);

  // Open editor for creating
  const handleOpenCreate = () => {
    setEditId(null);
    setFormTitle("");
    setFormDateStart(new Date().toISOString().slice(0, 16));
    setFormDateEnd(new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString().slice(0, 16)); // Default 2 hrs later
    setFormLocation("MARS Laboratory");
    setFormDescription("");
    setFormCategory("internal");
    setIsEditorOpen(true);
  };

  // Open editor for editing
  const handleOpenEdit = (evt: TeamEvent) => {
    setEditId(evt.id);
    setFormTitle(evt.title);
    setFormDateStart(evt.dateStart ? evt.dateStart.slice(0, 16) : "");
    setFormDateEnd(evt.dateEnd ? evt.dateEnd.slice(0, 16) : "");
    setFormLocation(evt.location || "");
    setFormDescription(evt.description || "");
    setFormCategory(evt.category);
    setIsEditorOpen(true);
  };

  // 2. Action: Save Event
  const handleSaveEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !formDateStart) return;
    if (!canEdit) return;

    const targetId = editId || `event_${Date.now()}`;
    const newEvent: TeamEvent = {
      id: targetId,
      title: formTitle.trim(),
      dateStart: formDateStart,
      dateEnd: formDateEnd || undefined,
      location: formLocation.trim() || undefined,
      description: formDescription.trim() || undefined,
      category: formCategory
    };

    try {
      await setDoc(doc(db, "events", targetId), newEvent);
      setIsEditorOpen(false);
    } catch (err) {
      console.warn("Unable to save event online, updating local array.", err);
      if (editId) {
        setEvents(events.map(ev => ev.id === editId ? newEvent : ev));
      } else {
        setEvents([...events, newEvent].sort((a, b) => new Date(a.dateStart).getTime() - new Date(b.dateStart).getTime()));
      }
      setIsEditorOpen(false);
    }
  };

  // 3. Action: Delete Event
  const handleDeleteEvent = async (id: string) => {
    if (!canEdit) return;
    if (!confirm("Are you sure you want to delete this event from the calendar?")) return;

    try {
      await deleteDoc(doc(db, "events", id));
    } catch (err) {
      console.warn("Firestore offline, deleting event locally.", err);
      setEvents(events.filter(ev => ev.id !== id));
    }
  };

  return (
    <div className="space-y-10 w-full">
      
      {/* Header */}
      <header className="border-b border-white/5 pb-8 flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6">
        <div>
          <p className="text-ares-gold font-bold uppercase tracking-widest text-xs mb-3 font-heading flex items-center gap-2">
            <Activity size={12} className="animate-pulse" /> Operational Timelines
          </p>
          <h1 className="text-4xl md:text-5xl font-black text-white uppercase tracking-tighter font-heading flex flex-wrap items-center gap-3">
            Manage Events
            {isLive ? (
              <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-400 ring-1 ring-inset ring-emerald-500/30 ml-2">
                ● Live Sync
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full bg-ares-gold/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-ares-gold ring-1 ring-inset ring-ares-gold/30 ml-2">
                ● Sandbox
              </span>
            )}
          </h1>
          <p className="text-marble/70 text-sm mt-2 max-w-2xl font-medium">
            Schedule upcoming driver practices, outreach events, machine shop slots, and scrimmages to keep the roster aligned.
          </p>
        </div>

        {canEdit && (
          <button
            onClick={handleOpenCreate}
            className="clipped-button bg-ares-red text-white hover:bg-ares-red-dark font-black text-xs uppercase tracking-widest py-3 px-5 inline-flex items-center gap-2 cursor-pointer shadow-xl"
          >
            <Plus size={16} /> New Event
          </button>
        )}
      </header>

      {/* Guest Lockscreen Warning */}
      {!canEdit && (
        <div className="glass-card ares-cut border border-ares-bronze/20 text-marble/80 px-6 py-5 rounded-xl text-center text-xs font-semibold max-w-lg mx-auto flex items-center gap-3 justify-center">
          <Shield size={16} className="text-ares-gold shrink-0" />
          <span>🔒 Read-only Guest Mode: Request authorization clearance to modify calendar events.</span>
        </div>
      )}

      {/* Schedule Index List */}
      <div className="glass-card border border-white/10 overflow-hidden rounded-2xl">
        <div className="p-6 border-b border-white/5 bg-black/20 flex justify-between items-center text-xs font-black uppercase text-ares-gold tracking-widest">
          <span>Active Team Operations Timeline</span>
          <span>{events.length} Scheduled</span>
        </div>

        <div className="divide-y divide-white/5 bg-black/10">
          {events.length === 0 ? (
            <div className="p-12 text-center text-marble/40 text-xs font-mono">
              No events scheduled in the system calendar.
            </div>
          ) : (
            events.map((evt) => {
              const startDate = new Date(evt.dateStart);
              const isOutreach = evt.category === "outreach";

              return (
                <div
                  key={evt.id}
                  className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 hover:bg-white/5 transition-colors"
                >
                  <div className="flex gap-4.5 items-start">
                    {/* Category specific color block */}
                    <div
                      className={`w-3.5 h-3.5 mt-1.5 rounded-full shrink-0 ${
                        isOutreach ? "bg-ares-gold shadow-[0_0_10px_rgba(212,175,55,0.4)]" : "bg-ares-red shadow-[0_0_10px_rgba(192,0,0,0.4)]"
                      }`}
                      title={isOutreach ? "Outreach" : "Internal Practice"}
                    />

                    <div className="space-y-1.5 max-w-2xl">
                      <span
                        className={`text-[9px] font-black uppercase px-2 py-0.5 border rounded ${
                          isOutreach
                            ? "bg-ares-gold/15 border-ares-gold/30 text-ares-gold"
                            : "bg-ares-red/15 border-ares-red/30 text-white"
                        }`}
                      >
                        {evt.category}
                      </span>
                      <h3 className="text-lg font-bold text-white font-heading uppercase tracking-tight">
                        {evt.title}
                      </h3>
                      {evt.description && (
                        <p className="text-marble/70 text-xs leading-relaxed">{evt.description}</p>
                      )}

                      <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1.5 text-[10px] font-bold text-marble/55 uppercase tracking-wide">
                        <span className="flex items-center gap-1">
                          <Calendar size={11} className="text-marble/40" />
                          {startDate.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock size={11} className="text-marble/40" />
                          {startDate.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                          {evt.dateEnd && ` - ${new Date(evt.dateEnd).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}`}
                        </span>
                        {evt.location && (
                          <span className="flex items-center gap-1">
                            <MapPin size={11} className="text-marble/40" />
                            {evt.location}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 self-end md:self-auto shrink-0">
                    {canEdit ? (
                      <>
                        <button
                          onClick={() => handleOpenEdit(evt)}
                          className="p-2 bg-white/5 hover:bg-ares-gold/20 text-white/70 hover:text-white border border-white/10 rounded transition-all cursor-pointer text-xs"
                          title="Edit Event"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={() => handleDeleteEvent(evt.id)}
                          className="p-2 bg-white/5 hover:bg-ares-red/20 text-white/70 hover:text-ares-danger-soft border border-white/10 rounded transition-all cursor-pointer text-xs"
                          title="Delete Event"
                        >
                          <Trash2 size={13} />
                        </button>
                      </>
                    ) : (
                      <span className="text-[9px] text-marble/40 uppercase font-black tracking-widest">🔒 Locked</span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Slide-out / Modal Event Editor Overlay */}
      {isEditorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-end">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/80 backdrop-blur-sm cursor-pointer"
            onClick={() => setIsEditorOpen(false)}
          />

          {/* Editor Drawer */}
          <div ref={editorRef} tabIndex={-1} className="relative z-10 w-full max-w-lg h-full bg-obsidian border-l border-white/10 flex flex-col justify-between animate-slide-in shadow-2xl focus:outline-none">
            <header className="px-6 py-4.5 border-b border-white/10 flex items-center justify-between bg-black/20">
              <div>
                <h3 className="text-white font-extrabold text-lg font-heading uppercase tracking-tight">
                  {editId ? "Edit Calendar Event" : "Schedule Team Operation"}
                </h3>
                <p className="text-[10px] text-marble/60 uppercase font-bold mt-0.5">
                  Synchronizes with public roster grids
                </p>
              </div>
              <button
                onClick={() => setIsEditorOpen(false)}
                className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 text-marble/60 hover:text-white flex items-center justify-center cursor-pointer transition-all active:scale-95"
              >
                <X size={16} />
              </button>
            </header>

            {/* Form Canvas */}
            <form onSubmit={handleSaveEvent} className="flex-1 overflow-y-auto p-6 space-y-6">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider mb-2 text-marble/60">Event Title</label>
                <input
                  type="text"
                  placeholder="e.g. Sunday Night EKF Odometry Calibrations"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full bg-black/60 border border-white/10 rounded px-4 py-2.5 text-xs text-white focus:outline-none focus:border-ares-red transition-colors"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider mb-2 text-marble/60">Start Date & Time</label>
                  <input
                    type="datetime-local"
                    value={formDateStart}
                    onChange={(e) => setFormDateStart(e.target.value)}
                    className="w-full bg-black/60 border border-white/10 text-marble/95 text-xs rounded px-3 py-2.5 focus:outline-none focus:border-ares-red cursor-pointer"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider mb-2 text-marble/60">End Date & Time</label>
                  <input
                    type="datetime-local"
                    value={formDateEnd}
                    onChange={(e) => setFormDateEnd(e.target.value)}
                    className="w-full bg-black/60 border border-white/10 text-marble/95 text-xs rounded px-3 py-2.5 focus:outline-none focus:border-ares-red cursor-pointer"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider mb-2 text-marble/60">Location / Venue</label>
                <input
                  type="text"
                  placeholder="e.g. MARS Laboratory / ARES Workshop"
                  value={formLocation}
                  onChange={(e) => setFormLocation(e.target.value)}
                  className="w-full bg-black/60 border border-white/10 rounded px-4 py-2.5 text-xs text-white focus:outline-none focus:border-ares-red transition-colors"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider mb-2 text-marble/60">Activity Category</label>
                <select
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value as any)}
                  className="w-full bg-black/60 border border-white/10 text-white text-xs font-bold uppercase rounded px-3 py-2.5 focus:outline-none focus:border-ares-red cursor-pointer appearance-none"
                >
                  <option value="internal">🛑 Internal Practice / Lab</option>
                  <option value="outreach">🏆 Public STEM Outreach</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider mb-2 text-marble/60">Brief Summary</label>
                <textarea
                  placeholder="Summarize target operational goals, tuning benchmarks, or logistics requirements..."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full bg-black/60 border border-white/10 rounded px-4 py-2.5 text-xs text-white focus:outline-none focus:border-ares-red h-24 transition-colors resize-none leading-relaxed"
                />
              </div>
            </form>

            <footer className="px-6 py-4 border-t border-white/10 flex justify-end gap-3 bg-black/20">
              <button
                type="button"
                onClick={() => setIsEditorOpen(false)}
                className="px-4 py-2 border border-white/10 text-white font-semibold text-xs rounded hover:bg-white/5 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEvent}
                className="clipped-button-sm bg-ares-cyan text-black font-black uppercase tracking-widest text-[11px] py-2 px-6 transition-all hover:scale-102 active:scale-98 cursor-pointer shadow-lg"
              >
                {editId ? "Update Schedule" : "Add to Calendar"}
              </button>
            </footer>
          </div>
        </div>
      )}

    </div>
  );
}
