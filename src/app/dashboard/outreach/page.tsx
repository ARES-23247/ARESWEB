"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { authenticatedFetch } from "@/lib/api";
import { Sparkles, RefreshCw } from "lucide-react";
import { collection, onSnapshot, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";

import PendingVolunteerEvents, { TeamEvent } from "./components/PendingVolunteerEvents";
import OutreachLogsList, { OutreachLog } from "./components/OutreachLogsList";
import OutreachForm from "./components/OutreachForm";

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

      resetForm();
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
      const loc = locations.find((l) => l.id === event.locationId);
      const locationStr = loc ? `${loc.name}, ${loc.address}` : (event.location || "");

      setEditingId(null);
      setTitle(event.title);
      const dateStr = event.dateStart ? event.dateStart.split("T")[0] : "";
      setDate(dateStr);
      setLocation(locationStr);
      setFormEventId(event.id);

      if (event.description) {
        setImpactSummary(`Volunteer team conducted community STEM demo: ${event.description}`);
      }

      const signupsRef = collection(db, "events", event.id, "signups");
      const signupsSnap = await getDocs(signupsRef);
      const signupList = signupsSnap.docs.map((docSnap) => docSnap.data());

      let durationHours = 0;
      if (event.dateStart && event.dateEnd) {
        const start = new Date(event.dateStart).getTime();
        const end = new Date(event.dateEnd).getTime();
        if (end > start) {
          durationHours = (end - start) / (1000 * 60 * 60);
        }
      }

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
          
          <PendingVolunteerEvents
            pendingEvents={pendingEvents}
            formEventId={formEventId}
            isCalculatingHours={isCalculatingHours}
            onLogEvent={handleLogPendingEvent}
          />

          <OutreachLogsList
            logs={logs}
            isLoading={isLoading}
            error={error}
            searchQuery={searchQuery}
            onSearchQueryChange={setSearchQuery}
            onEdit={handleEditClick}
            onDelete={handleDeleteLog}
            onFetchLogs={fetchLogs}
          />

        </div>

        {/* RIGHT COLUMN: CREATOR & EDITOR FORM */}
        <div className="lg:col-span-1">
          <OutreachForm
            editingId={editingId}
            title={title}
            setTitle={setTitle}
            date={date}
            setDate={setDate}
            location={location}
            setLocation={setLocation}
            hours={hours}
            setHours={setHours}
            peopleReached={peopleReached}
            setPeopleReached={setPeopleReached}
            impactSummary={impactSummary}
            setImpactSummary={setImpactSummary}
            formEventId={formEventId}
            setFormEventId={setFormEventId}
            calcLogMessage={calcLogMessage}
            setCalcLogMessage={setCalcLogMessage}
            isSaving={isSaving}
            onSave={handleSaveLog}
            onReset={resetForm}
          />
        </div>

      </div>
    </div>
  );
}
