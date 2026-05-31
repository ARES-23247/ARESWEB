"use client";

import React, { useEffect, useState } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Calendar as CalendarIcon, MapPin, Users, Info } from "lucide-react";

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
    title: "Spark! Goes WILD",
    dateStart: "2026-05-24T09:30:00",
    dateEnd: "2026-05-24T14:30:00",
    location: "SPARK!",
    description: "Team outreach and public science demonstration.",
    category: "outreach"
  },
  {
    id: "event_2",
    title: "Sunday Night Practice",
    dateStart: "2026-05-24T18:00:00",
    dateEnd: "2026-05-24T20:30:00",
    location: "MARS Building",
    description: "Weekly telemetry calibrations and driver practice.",
    category: "internal"
  },
  {
    id: "event_3",
    title: "Friday Night Practice",
    dateStart: "2026-05-29T18:00:00",
    dateEnd: "2026-05-29T20:00:00",
    location: "TBD",
    description: "Weekly hardware maintenance and software EKF tuning.",
    category: "internal"
  },
  {
    id: "event_4",
    title: "Sunday Night Practice",
    dateStart: "2026-05-31T18:00:00",
    dateEnd: "2026-05-31T20:30:00",
    location: "MARS Building",
    description: "Main chassis tuning and autonomous test runs.",
    category: "internal"
  },
  {
    id: "event_5",
    title: "Friday Night Practice",
    dateStart: "2026-06-12T18:00:00",
    dateEnd: "2026-06-12T01:00:00",
    location: "TBD",
    description: "Extended overnight competition prep and scrimmage simulation.",
    category: "internal"
  }
];

export default function CalendarPage() {
  const [events, setEvents] = useState<TeamEvent[]>(MOCK_EVENTS);
  const [filter, setFilter] = useState<"all" | "internal" | "outreach">("all");
  const [isLive, setIsLive] = useState(false);

  useEffect(() => {
    try {
      const q = query(
        collection(db, "events"),
        where("isDeleted", "==", 0),
        where("status", "==", "published")
      );

      const unsubscribe = onSnapshot(
        q,
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
              location: data.location || "TBD",
              description: data.description || "",
              category: (data.category as "internal" | "outreach") || "internal"
            };
          });
          setEvents(list);
          setIsLive(true);
        },
        (err) => {
          console.warn("Firestore not connected or empty, streaming fallback seeds:", err.message);
          setEvents(MOCK_EVENTS);
          setIsLive(false);
        }
      );

      return () => unsubscribe();
    } catch (e) {
      console.warn("Firestore setup failed, running offline mock events.", e);
      setEvents(MOCK_EVENTS);
      setIsLive(false);
    }
  }, []);

  const filteredEvents = events.filter(
    (e) => filter === "all" || e.category === filter
  );

  const formatEventTime = (isoString: string) => {
    if (!isoString) return "TBD";
    const d = new Date(isoString);
    return d.toLocaleString("en-US", {
      weekday: "long",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  return (
    <div className="w-full min-h-screen bg-obsidian text-marble py-8">
      <div className="w-full max-w-7xl mx-auto px-6 py-12 md:py-20">
        
        {/* Header */}
        <header className="mb-12 border-b border-ares-bronze/30 pb-8 flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6">
          <div>
            <p className="text-ares-gold font-bold uppercase tracking-widest text-sm mb-4">
              Team schedule & outreach
            </p>
            <h1 className="text-5xl md:text-7xl font-black text-white mb-6 tracking-tighter flex flex-wrap items-center gap-3">
              Team <span className="bg-ares-red px-6 py-2 ares-cut shadow-xl text-white font-bold">Events</span>
              {isLive ? (
                <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400 ring-1 ring-inset ring-emerald-500/30 ml-2">
                  ● Live Sync
                </span>
              ) : (
                <span className="inline-flex items-center rounded-full bg-ares-gold/10 px-3 py-1 text-xs font-semibold text-ares-gold ring-1 ring-inset ring-ares-gold/30 ml-2">
                  ● Offline Mode
                </span>
              )}
            </h1>
            <p className="text-marble/85 text-lg font-medium max-w-2xl">
              Track upcoming practices, outreach workshops, and engineering milestones. Updates synchronize in real-time.
            </p>
          </div>

          <div className="flex gap-2 bg-black/40 p-1.5 rounded-lg border border-white/10 shrink-0">
            <button
              onClick={() => setFilter("all")}
              className={`px-4 py-2 text-xs uppercase tracking-wider font-bold rounded transition-all duration-200 ${
                filter === "all"
                  ? "bg-ares-red text-white shadow-md"
                  : "text-marble/75 hover:text-white"
              }`}
            >
              All Events
            </button>
            <button
              onClick={() => setFilter("internal")}
              className={`px-4 py-2 text-xs uppercase tracking-wider font-bold rounded transition-all duration-200 ${
                filter === "internal"
                  ? "bg-ares-red text-white shadow-md"
                  : "text-marble/75 hover:text-white"
              }`}
            >
              Practices
            </button>
            <button
              onClick={() => setFilter("outreach")}
              className={`px-4 py-2 text-xs uppercase tracking-wider font-bold rounded transition-all duration-200 ${
                filter === "outreach"
                  ? "bg-ares-red text-white shadow-md"
                  : "text-marble/75 hover:text-white"
              }`}
            >
              Outreach
            </button>
          </div>
        </header>

        {/* Event List */}
        <div className="space-y-6">
          {filteredEvents.length === 0 ? (
            <div className="text-center py-16 glass-card ares-cut border border-white/10">
              <p className="text-lg text-marble/60">No events found in this category.</p>
            </div>
          ) : (
            filteredEvents.map((event) => (
              <div key={event.id} className="glass-card hero-card p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border border-white/10">
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <span
                      className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-bold uppercase tracking-wider ${
                        event.category === "outreach"
                          ? "bg-ares-gold/20 text-ares-gold border border-ares-gold/30"
                          : "bg-ares-red/20 text-white border border-ares-red/30"
                      }`}
                    >
                      {event.category}
                    </span>
                    <span className="text-ares-bronze font-bold text-sm flex items-center gap-1">
                      <MapPin size={14} /> {event.location || "TBD"}
                    </span>
                  </div>
                  <h2 className="text-2xl font-bold text-white font-heading">{event.title}</h2>
                  <p className="text-marble/80 text-sm leading-relaxed max-w-2xl">{event.description}</p>
                </div>
                
                <div className="flex flex-col justify-center items-start md:items-end border-t md:border-t-0 md:border-l border-white/10 pt-4 md:pt-0 md:pl-8 min-w-[220px] w-full md:w-auto mt-4 md:mt-0">
                  <span className="text-ares-gold font-bold text-xs uppercase tracking-widest flex items-center gap-1">
                    <CalendarIcon size={12} /> Date & Time
                  </span>
                  <span className="text-white text-base font-semibold leading-relaxed text-left md:text-right mt-1 font-heading">
                    {formatEventTime(event.dateStart)}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Sync Subscription Banner */}
        <div className="mt-12 glass-card ares-cut p-6 border border-white/10 flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-ares-cyan/10 flex items-center justify-center border border-ares-cyan/25 shrink-0">
            <Info size={20} className="text-ares-cyan" />
          </div>
          <div>
            <p className="text-sm font-bold text-white">Subscribe to calendar feed</p>
            <p className="text-xs text-marble/70 mt-0.5">Contact team leads to retrieve the official iCal feed subscription link for Apple Calendar or Google Calendar.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
