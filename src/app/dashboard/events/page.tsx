"use client";

import React, { useEffect, useState, useMemo } from "react";
import { collection, doc, onSnapshot, deleteDoc, setDoc, query, where, limit, orderBy } from "firebase/firestore";
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
  Clock,
  Check,
  RotateCcw
} from "lucide-react";
import { cleanUndefined } from "@/lib/utils";
import { authenticatedFetch } from "@/lib/api";

import LocationManagerModal, { TeamLocation, MOCK_LOCATIONS } from "./components/LocationManagerModal";
import EventEditorDrawer, { TeamEvent } from "./components/EventEditorDrawer";
import EventsCalendarView from "./components/EventsCalendarView";
import EventsFilterPanel from "./components/EventsFilterPanel";
import { MOCK_EVENTS } from "../../calendar/components/mockEvents";

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

  // Filter States
  const [filterSearch, setFilterSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "published" | "pending" | "draft" | "deleted">("all");
  const [filterCategory, setFilterCategory] = useState<"all" | "internal" | "outreach">("all");
  const [filterMonth, setFilterMonth] = useState<string>("all");
  const [filterYear, setFilterYear] = useState<string>("all");

  // Team Roster (for editor checking in members)
  const [teamMembers, setTeamMembers] = useState<{ uid: string; nickname: string; avatar: string; }[]>([]);

  const canEdit = !!(user && authorizedUser && authorizedUser.role !== "unverified");
  const canPublishDirectly = useMemo(() => {
    return !!(user && authorizedUser && ["admin", "coach", "mentor"].includes(authorizedUser.role));
  }, [user, authorizedUser]);

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
      const q = query(eventsRef, where("isDeleted", "==", 0), orderBy("dateStart", "asc"), limit(100));
      const unsubscribe = onSnapshot(
        q,
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
              isVolunteer: data.isVolunteer || 0,
              isDeleted: data.isDeleted || 0,
              status: data.status || "published"
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

  const handleDeleteEvent = async (evt: TeamEvent) => {
    if (!canEdit) return;
    if (!confirm(`Are you sure you want to move "${evt.title}" to the Trash? (It will be hidden from the calendar, but visible to managers)`)) return;

    try {
      await setDoc(doc(db, "events", evt.id), cleanUndefined({
        ...evt,
        isDeleted: 1
      }));
    } catch (err) {
      console.warn("Firestore offline, soft-deleting event locally.", err);
      setEvents(events.map(ev => ev.id === evt.id ? { ...ev, isDeleted: 1 } : ev));
    }
  };

  const handleRestoreEvent = async (evt: TeamEvent) => {
    if (!canEdit) return;
    if (!confirm(`Are you sure you want to restore "${evt.title}"?`)) return;

    try {
      await setDoc(doc(db, "events", evt.id), cleanUndefined({
        ...evt,
        isDeleted: 0
      }));
    } catch (err) {
      console.warn("Firestore offline, restoring event locally.", err);
      setEvents(events.map(ev => ev.id === evt.id ? { ...ev, isDeleted: 0 } : ev));
    }
  };

  const handlePermanentDeleteEvent = async (id: string) => {
    if (!canPublishDirectly) return;
    if (!confirm("WARNING: Are you sure you want to PERMANENTLY delete this event? This action cannot be undone and will delete all RSVPs and photos!")) return;

    try {
      await deleteDoc(doc(db, "events", id));
    } catch (err) {
      console.warn("Firestore offline, deleting event locally.", err);
      setEvents(events.filter(ev => ev.id !== id));
    }
  };

  const handleApproveEvent = async (evt: TeamEvent) => {
    if (!canPublishDirectly) return;
    try {
      const docRef = doc(db, "events", evt.id);
      await setDoc(docRef, cleanUndefined({ ...evt, status: "published" }));
    } catch (err: any) {
      console.error("Error approving event:", err);
      alert("Failed to approve event: " + err.message);
    }
  };

  const handleClearFilters = () => {
    setFilterSearch("");
    setFilterStatus("all");
    setFilterCategory("all");
    setFilterMonth("all");
    setFilterYear("all");
  };

  // Dynamic years options computed from events data
  const yearOptions = useMemo(() => {
    const years = new Set<string>();
    events.forEach((evt) => {
      if (evt.dateStart) {
        try {
          const yr = new Date(evt.dateStart).getFullYear().toString();
          years.add(yr);
        } catch (e) {
          // invalid date
        }
      }
    });
    return Array.from(years).sort((a, b) => b.localeCompare(a));
  }, [events]);

  const counts = useMemo(() => {
    let all = 0;
    let published = 0;
    let pending = 0;
    let draft = 0;
    let deleted = 0;

    events.forEach((evt) => {
      if (evt.isDeleted === 1) {
        deleted++;
      } else {
        all++;
        if (evt.status === "published" || !evt.status) published++;
        else if (evt.status === "pending") pending++;
        else if (evt.status === "draft") draft++;
      }
    });

    return { all, published, pending, draft, deleted };
  }, [events]);

  const filteredEvents = useMemo(() => {
    return events.filter((evt) => {
      // 1. Status/Trash Filter
      if (filterStatus === "deleted") {
        if (evt.isDeleted !== 1) return false;
      } else {
        if (evt.isDeleted === 1) return false;
        if (filterStatus !== "all") {
          const status = evt.status || "published";
          if (status !== filterStatus) return false;
        }
      }

      // 2. Category Filter
      if (filterCategory !== "all" && evt.category !== filterCategory) return false;

      // 3. Search Filter (title or description)
      if (filterSearch.trim()) {
        const query = filterSearch.toLowerCase();
        const matchesTitle = evt.title?.toLowerCase().includes(query);
        const matchesDesc = evt.description?.toLowerCase().includes(query);
        if (!matchesTitle && !matchesDesc) return false;
      }

      // 4. Month Filter
      if (filterMonth !== "all") {
        if (!evt.dateStart) return false;
        try {
          const m = new Date(evt.dateStart).getMonth().toString();
          if (m !== filterMonth) return false;
        } catch (e) {
          return false;
        }
      }

      // 5. Year Filter
      if (filterYear !== "all") {
        if (!evt.dateStart) return false;
        try {
          const y = new Date(evt.dateStart).getFullYear().toString();
          if (y !== filterYear) return false;
        } catch (e) {
          return false;
        }
      }

      return true;
    });
  }, [events, filterStatus, filterCategory, filterSearch, filterMonth, filterYear]);

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

          {/* Advanced Filter controls */}
          <EventsFilterPanel
            filterStatus={filterStatus}
            setFilterStatus={setFilterStatus}
            filterCategory={filterCategory}
            setFilterCategory={setFilterCategory}
            filterSearch={filterSearch}
            setFilterSearch={setFilterSearch}
            filterMonth={filterMonth}
            setFilterMonth={setFilterMonth}
            filterYear={filterYear}
            setFilterYear={setFilterYear}
            counts={counts}
            yearOptions={yearOptions}
            handleClearFilters={handleClearFilters}
          />

          {/* Schedule Index List */}
          <EventsCalendarView
            filteredEvents={filteredEvents}
            totalEventsCount={events.length}
            locations={locations}
            canEdit={canEdit}
            canPublishDirectly={canPublishDirectly}
            onRestore={handleRestoreEvent}
            onPermanentDelete={handlePermanentDeleteEvent}
            onApprove={handleApproveEvent}
            onEdit={handleOpenEdit}
            onDelete={handleDeleteEvent}
            onClearFilters={handleClearFilters}
            hasActiveFilters={
              !!(filterSearch || filterStatus !== "all" || filterCategory !== "all" || filterMonth !== "all" || filterYear !== "all")
            }
          />
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

