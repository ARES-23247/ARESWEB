"use client";

import React, { useEffect, useState } from "react";
import { collection, doc, onSnapshot, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { 
  Plus, 
  Trash2, 
  Pencil, 
  Shield, 
  Activity, 
  MapPin, 
  Calendar, 
  Clock 
} from "lucide-react";
import { authenticatedFetch } from "@/lib/api";

import LocationManagerModal, { TeamLocation, MOCK_LOCATIONS } from "./components/LocationManagerModal";
import EventEditorDrawer, { TeamEvent } from "./components/EventEditorDrawer";

export default function EventsManagementPage({
  editorOnly = false,
  onEditorClose,
  prefilledDate,
  prefilledAction,
  prefilledEventId
}: {
  editorOnly?: boolean;
  onEditorClose?: () => void;
  prefilledDate?: Date;
  prefilledAction?: "create" | "edit" | null;
  prefilledEventId?: string | null;
} = {}) {
  const { user, authorizedUser } = useAuth();
  
  // Real-time Collections States
  const [events, setEvents] = useState<TeamEvent[]>([]);
  const [locations, setLocations] = useState<TeamLocation[]>([]);
  const [isLive, setIsLive] = useState(false);

  // Modal control states
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<TeamEvent | null>(null);
  const [isLocationManagerOpen, setIsLocationManagerOpen] = useState(false);
  const [formLocationId, setFormLocationId] = useState("mars-building");

  // Team Roster (for editor checking in members)
  const [teamMembers, setTeamMembers] = useState<{ uid: string; nickname: string; avatar: string; }[]>([]);

  const canEdit = !!(user && authorizedUser && authorizedUser.role !== "unverified");

  // Fetch team roster for quick check-ins
  useEffect(() => {
    const fetchRoster = async () => {
      try {
        const res = await authenticatedFetch("/api/profiles/team-roster");
        if (res.ok) {
          const data = await res.json();
          setTeamMembers(data.members || []);
        }
      } catch (err) {
        console.error("Failed to load team roster:", err);
      }
    };
    fetchRoster();
  }, []);

  // Listen for real-time calendar event updates
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
          const list = snapshot.docs.map((docSnap) => {
            const data = docSnap.data();
            return {
              id: docSnap.id,
              title: data.title || "Untitled Event",
              dateStart: data.dateStart || "",
              dateEnd: data.dateEnd || "",
              locationId: data.locationId || "mars-building",
              description: data.description || "",
              category: data.category || "internal",
              coverImage: data.coverImage || "",
              isPotluck: data.isPotluck || 0,
              isVolunteer: data.isVolunteer || 0
            } as TeamEvent;
          });
          
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

  // Listen for real-time location profile updates
  useEffect(() => {
    try {
      const locationsRef = collection(db, "locations");
      const unsubscribe = onSnapshot(
        locationsRef,
        async (snapshot) => {
          if (snapshot.empty) {
            setLocations(MOCK_LOCATIONS);
            return;
          }
          const list = snapshot.docs.map((docSnap) => {
            const data = docSnap.data();
            return {
              id: docSnap.id,
              name: data.name || "",
              address: data.address || "",
              description: data.description || undefined,
              gmapsUrl: data.gmapsUrl || undefined
            } as TeamLocation;
          });
          setLocations(list);
        },
        (err) => {
          console.warn("Locations stream error. Using defaults.", err.message);
          setLocations(MOCK_LOCATIONS);
        }
      );
      return () => unsubscribe();
    } catch (e) {
      setLocations(MOCK_LOCATIONS);
    }
  }, []);

  // Prefilled actions for calendar redirect links
  useEffect(() => {
    if (editorOnly) {
      if (prefilledAction === "create") {
        handleOpenCreate();
        if (prefilledDate) {
          // Note: dates are initialized inside drawer useEffect based on eventToEdit
        }
      } else if (prefilledAction === "edit" && prefilledEventId) {
        const evt = events.find((e) => e.id === prefilledEventId);
        if (evt) {
          handleOpenEdit(evt);
        }
      }
      return;
    }
    const params = new URLSearchParams(window.location.search);
    if (params.get("action") === "create") {
      handleOpenCreate();
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [editorOnly, prefilledAction, prefilledDate, prefilledEventId, events]);

  const handleCloseEditor = () => {
    setIsEditorOpen(false);
    setSelectedEvent(null);
    onEditorClose?.();
  };

  const handleOpenCreate = () => {
    setSelectedEvent(null);
    setFormLocationId("mars-building");
    setIsEditorOpen(true);
  };

  const handleOpenEdit = (evt: TeamEvent) => {
    setSelectedEvent(evt);
    setFormLocationId(evt.locationId || "mars-building");
    setIsEditorOpen(true);
  };

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
    <div className={editorOnly ? "" : "space-y-10 w-full text-left"}>
      {!editorOnly && (
        <>
          {/* Header */}
          <header className="border-b border-white/5 pb-8 flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6">
            <div>
              <p className="text-ares-gold font-bold uppercase tracking-widest text-xs mb-3 font-heading flex items-center gap-2">
                <Activity size={12} className="animate-pulse" /> Operational Timelines
              </p>
              <h1 className="text-4xl md:text-5xl font-black text-white uppercase tracking-tighter font-heading flex flex-wrap items-center gap-3">
                Manage Events
                {isLive ? (
                  <span className="inline-flex items-center rounded-full bg-ares-success/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-ares-success ring-1 ring-inset ring-ares-success/30 ml-2">
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
              <div className="flex gap-3">
                <button
                  onClick={() => setIsLocationManagerOpen(true)}
                  className="clipped-button bg-black/40 hover:bg-black/60 text-marble/80 border border-white/10 hover:border-white/20 font-black text-xs uppercase tracking-widest py-3 px-5 inline-flex items-center gap-2 cursor-pointer shadow-xl focus:ring-2 focus:ring-ares-cyan focus:outline-none"
                >
                  <MapPin size={16} className="text-ares-gold" /> Locations
                </button>
                <button
                  onClick={handleOpenCreate}
                  className="clipped-button bg-ares-red text-white hover:bg-ares-red-dark font-black text-xs uppercase tracking-widest py-3 px-5 inline-flex items-center gap-2 cursor-pointer shadow-xl focus:ring-2 focus:ring-ares-cyan focus:outline-none"
                >
                  <Plus size={16} /> New Event
                </button>
              </div>
            )}
          </header>

          {/* Guest Lockscreen Warning */}
          {!canEdit && (
            <div className="glass-card ares-cut border border-ares-bronze/20 text-marble/80 px-6 py-5 text-center text-xs font-semibold max-w-lg mx-auto flex items-center gap-3 justify-center">
              <Shield size={16} className="text-ares-gold shrink-0" />
              <span>🔒 Read-only Guest Mode: Request authorization clearance to modify calendar events.</span>
            </div>
          )}

          {/* Schedule Index List */}
          <div className="glass-card border border-white/10 overflow-hidden ares-cut-lg shadow-xl">
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
                  const resolvedLocation = locations.find(l => l.id === evt.locationId)?.name || (evt as any).location || "MARS Building";

                  return (
                    <div
                      key={evt.id}
                      className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 hover:bg-white/5 transition-colors"
                    >
                      <div className="flex gap-4.5 items-start">
                        <div
                          className={`w-3.5 h-3.5 mt-1.5 rounded-full shrink-0 ${
                            isOutreach ? "bg-ares-gold shadow-[0_0_10px_rgba(255,184,28,0.4)]" : "bg-ares-red shadow-[0_0_10px_rgba(192,0,0,0.4)]"
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
                            <span className="flex items-center gap-1">
                              <MapPin size={11} className="text-marble/40" />
                              {resolvedLocation}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2 self-end md:self-auto shrink-0">
                        {canEdit ? (
                          <>
                            <button
                              onClick={() => handleOpenEdit(evt)}
                              className="p-2 bg-white/5 hover:bg-ares-gold/20 text-white/70 hover:text-white border border-white/10 rounded transition-all cursor-pointer text-xs focus:ring-2 focus:ring-ares-cyan focus:outline-none"
                              title="Edit Event"
                              aria-label={`Edit event ${evt.title}`}
                            >
                              <Pencil size={13} />
                            </button>
                            <button
                              onClick={() => handleDeleteEvent(evt.id)}
                              className="p-2 bg-white/5 hover:bg-ares-red/20 text-white/70 hover:text-ares-red-light border border-white/10 rounded transition-all cursor-pointer text-xs focus:ring-2 focus:ring-ares-cyan focus:outline-none"
                              title="Delete Event"
                              aria-label={`Delete event ${evt.title}`}
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
        </>
      )}

      {/* Slide-out / Modal Event Editor Overlay */}
      <EventEditorDrawer
        isOpen={isEditorOpen}
        onClose={handleCloseEditor}
        eventToEdit={selectedEvent}
        locations={locations}
        setLocations={setLocations}
        teamMembers={teamMembers}
      />

      {/* Locations Manager Modal */}
      <LocationManagerModal
        isOpen={isLocationManagerOpen}
        onClose={() => setIsLocationManagerOpen(false)}
        locations={locations}
        setLocations={setLocations}
        formLocationId={formLocationId}
        setFormLocationId={setFormLocationId}
      />
    </div>
  );
}

const MOCK_EVENTS: TeamEvent[] = [
  {
    id: "event_1",
    title: "Spark! Goes WILD Exhibition",
    dateStart: "2026-05-24T09:30:00",
    dateEnd: "2026-05-24T14:30:00",
    locationId: "spark-museum",
    description: "Team outreach, STEM workshops, and public science bridge exhibits.",
    category: "outreach",
    isPotluck: 0,
    isVolunteer: 1
  },
  {
    id: "event_2",
    title: "Sunday Night Driver Practice",
    dateStart: "2026-05-24T18:00:00",
    dateEnd: "2026-05-24T20:30:00",
    locationId: "mars-building",
    description: "Weekly telemetry calibrations and driver practice on standard field.",
    category: "internal",
    isPotluck: 0,
    isVolunteer: 0
  },
  {
    id: "event_3",
    title: "Friday Night Hardware Lab",
    dateStart: "2026-05-29T18:00:00",
    dateEnd: "2026-05-29T20:00:00",
    locationId: "ares-shop",
    description: "Weekly hardware maintenance, linear slide adjustments, and intake tuning.",
    category: "internal",
    isPotluck: 0,
    isVolunteer: 0
  },
  {
    id: "event_4",
    title: "Sunday Night EKF Tuning",
    dateStart: "2026-05-31T18:00:00",
    dateEnd: "2026-05-31T20:30:00",
    locationId: "mars-building",
    description: "Main chassis odometry calibrations and autonomous state-slip test runs.",
    category: "internal",
    isPotluck: 0,
    isVolunteer: 0
  },
  {
    id: "event_5",
    title: "Overnight Scrimmage & Prep",
    dateStart: "2026-06-12T18:00:00",
    dateEnd: "2026-06-13T01:00:00",
    locationId: "mars-building",
    description: "Extended overnight competition prep and match simulation.",
    category: "internal",
    isPotluck: 0,
    isVolunteer: 1
  },
  {
    id: "event_6",
    title: "FLL Robotics Mentorship Camp",
    dateStart: "2026-06-18T10:00:00",
    dateEnd: "2026-06-18T15:00:00",
    locationId: "mars-building",
    description: "Mentoring middle school FLL teams on mechanical design and FIRST® Core Values.",
    category: "outreach",
    isPotluck: 1,
    isVolunteer: 1
  }
];
