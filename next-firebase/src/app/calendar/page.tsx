"use client";

import React, { useEffect, useState } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { 
  Calendar as CalendarIcon, 
  MapPin, 
  Info, 
  ChevronLeft, 
  ChevronRight, 
  Clock,
  Sparkles,
  Award
} from "lucide-react";
import { GreekMeander } from "@/components/GreekMeander";

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
    title: "Friday Night Hardware Lab",
    dateStart: "2026-05-29T18:00:00",
    dateEnd: "2026-05-29T20:00:00",
    location: "ARES Machine Shop",
    description: "Weekly hardware maintenance, linear slide adjustments, and intake tuning.",
    category: "internal"
  },
  {
    id: "event_4",
    title: "Sunday Night EKF Tuning",
    dateStart: "2026-05-31T18:00:00",
    dateEnd: "2026-05-31T20:30:00",
    location: "MARS Laboratory",
    description: "Main chassis odometry calibrations and autonomous state-slip test runs.",
    category: "internal"
  },
  {
    id: "event_5",
    title: "Overnight Scrimmage & Prep",
    dateStart: "2026-06-12T18:00:00",
    dateEnd: "2026-06-13T01:00:00",
    location: "Championship Scrimmage Field",
    description: "Extended overnight competition prep and match simulation.",
    category: "internal"
  },
  {
    id: "event_6",
    title: "FLL Robotics Mentorship Camp",
    dateStart: "2026-06-18T10:00:00",
    dateEnd: "2026-06-18T15:00:00",
    location: "Spark! Learning Space",
    description: "ARES mentors conducting visual block-coding tutorials for local FLL students.",
    category: "outreach"
  },
  {
    id: "event_7",
    title: "Into The Deep Finals Scrimmage",
    dateStart: "2026-06-21T13:00:00",
    dateEnd: "2026-06-21T18:00:00",
    location: "MARS Laboratory",
    description: "Final mock matches with regional alliance teams to optimize autonomous target routes.",
    category: "internal"
  }
];

export default function CalendarPage() {
  const [events, setEvents] = useState<TeamEvent[]>(MOCK_EVENTS);
  const [filter, setFilter] = useState<"all" | "internal" | "outreach">("all");
  const [isLive, setIsLive] = useState(false);

  // Calendar navigation state (defaulting to June 2026 to showcase upcoming events)
  const [currentDate, setCurrentDate] = useState(new Date(2026, 5, 2)); // Month is 0-indexed (5 = June)
  const [selectedDate, setSelectedDate] = useState<Date>(new Date(2026, 5, 2));

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
          console.warn("Firestore empty or not connected, streaming mocks:", err.message);
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

  const getDaysInMonth = (year: number, month: number) => {
    const date = new Date(year, month, 1);
    const days = [];

    // Weekday of 1st day (0 = Sunday, 6 = Saturday)
    const startDay = date.getDay();

    // Previous month padding
    const prevMonthDate = new Date(year, month, 0);
    const prevMonthDaysCount = prevMonthDate.getDate();
    for (let i = startDay - 1; i >= 0; i--) {
      days.push({
        date: new Date(year, month - 1, prevMonthDaysCount - i),
        isCurrentMonth: false,
      });
    }

    // Current month
    const currentMonthDaysCount = new Date(year, month + 1, 0).getDate();
    for (let i = 1; i <= currentMonthDaysCount; i++) {
      days.push({
        date: new Date(year, month, i),
        isCurrentMonth: true,
      });
    }

    // Next month padding (standard 42 grid cells)
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      days.push({
        date: new Date(year, month + 1, i),
        isCurrentMonth: false,
      });
    }

    return days;
  };

  const activeYear = currentDate.getFullYear();
  const activeMonth = currentDate.getMonth(); // 0-indexed
  const calendarDays = getDaysInMonth(activeYear, activeMonth);

  const monthsList = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const handlePrevMonth = () => {
    setCurrentDate(new Date(activeYear, activeMonth - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(activeYear, activeMonth + 1, 1));
  };

  const isSameDay = (d1: Date, d2: Date) => {
    return (
      d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate()
    );
  };

  // Get events on a specific day, filtered by active category
  const getEventsForDay = (date: Date) => {
    return events.filter((event) => {
      if (!event.dateStart) return false;
      const eventDate = new Date(event.dateStart);
      const matchesDay = isSameDay(eventDate, date);
      const matchesFilter = filter === "all" || event.category === filter;
      return matchesDay && matchesFilter;
    });
  };

  // All events filtered by selected tab (for the summary view)
  const filteredEvents = events.filter(
    (e) => filter === "all" || e.category === filter
  );

  const selectedDayEvents = getEventsForDay(selectedDate);

  const formatEventTime = (isoString: string) => {
    if (!isoString) return "TBD";
    const d = new Date(isoString);
    return d.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  const formatFullDate = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric"
    });
  };

  return (
    <div className="w-full min-h-screen bg-obsidian text-marble py-8">
      <div className="w-full max-w-7xl mx-auto px-6 py-12 md:py-20">
        
        {/* Header */}
        <header className="mb-12 border-b border-ares-bronze/30 pb-8 flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6 relative">
          <GreekMeander variant="thin" opacity="opacity-10" className="absolute top-0 left-0 -mt-16 pointer-events-none" />
          <div className="relative z-10">
            <p className="text-ares-bronze uppercase tracking-[0.4em] text-[10px] font-black font-heading mb-4">
              Operational Schedule & Timelines
            </p>
            <h1 className="text-4xl md:text-7xl font-black text-white mb-6 uppercase tracking-tight font-heading flex flex-wrap items-center gap-4">
              Team <span className="bg-ares-red px-6 py-1 pb-3 ares-cut shadow-xl text-white font-bold">Calendar</span>
              {isLive ? (
                <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-3 py-1 text-[8px] font-bold uppercase tracking-wider text-emerald-400 ring-1 ring-inset ring-emerald-500/20">
                  ● Live Firestore Sync
                </span>
              ) : (
                <span className="inline-flex items-center rounded-full bg-ares-gold/10 px-3 py-1 text-[8px] font-bold uppercase tracking-wider text-ares-gold ring-1 ring-inset ring-ares-gold/20">
                  ● Offline Sandbox Mode
                </span>
              )}
            </h1>
            <p className="text-marble/85 text-base md:text-lg max-w-2xl leading-relaxed">
              Plan and coordinate lab practices, software calibration sprints, and Spark! museum exhibits. Click on days to inspect active event details.
            </p>
          </div>

          <div className="flex gap-1.5 bg-black/45 p-1 rounded-lg border border-white/5 shrink-0 relative z-10">
            {["all", "internal", "outreach"].map((cat) => (
              <button
                key={cat}
                onClick={() => setFilter(cat as any)}
                className={`px-4 py-2 text-[9px] font-black uppercase tracking-wider rounded transition-all cursor-pointer ${
                  filter === cat
                    ? "bg-ares-red text-white"
                    : "text-marble/55 hover:text-white hover:bg-white/5"
                }`}
              >
                {cat === "all" ? "All Events" : cat === "internal" ? "Practices" : "Outreach"}
              </button>
            ))}
          </div>
        </header>

        {/* ─── DUAL PANEL GRID & LIST ─── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* LEFT: MONTH VIEW CALENDAR GRID (8 Columns) */}
          <div className="lg:col-span-7 xl:col-span-8 flex flex-col">
            <div className="bg-black/20 border border-white/10 ares-cut-lg overflow-hidden flex-1 shadow-2xl flex flex-col min-h-[480px]">
              
              {/* Calendar Grid Controller Header */}
              <div className="flex items-center justify-between p-6 border-b border-white/10 bg-black/30">
                <h2 className="text-xl font-black text-white font-heading uppercase tracking-widest">
                  {monthsList[activeMonth]} <span className="text-ares-gold">{activeYear}</span>
                </h2>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handlePrevMonth}
                    aria-label="Previous Month"
                    className="w-8 h-8 rounded bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 hover:text-ares-gold transition-colors cursor-pointer"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    onClick={handleNextMonth}
                    aria-label="Next Month"
                    className="w-8 h-8 rounded bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 hover:text-ares-gold transition-colors cursor-pointer"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>

              {/* Day Headers (Sun-Sat) */}
              <div className="grid grid-cols-7 border-b border-white/5 bg-black/10 text-center py-2.5">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                  <span key={day} className="text-[9px] font-black uppercase tracking-widest text-ares-bronze">
                    {day}
                  </span>
                ))}
              </div>

              {/* Day Cells Grid (6 Rows x 7 Columns = 42 Cells) */}
              <div className="grid grid-cols-7 flex-grow divide-x divide-y divide-white/5 border-l border-t border-white/5">
                {calendarDays.map((dayCell, idx) => {
                  const dayEvents = getEventsForDay(dayCell.date);
                  const isSelected = isSameDay(dayCell.date, selectedDate);
                  const isToday = isSameDay(dayCell.date, new Date(2026, 5, 2)); // Sync to local current date 2026-06-02

                  return (
                    <button
                      key={idx}
                      onClick={() => setSelectedDate(dayCell.date)}
                      className={`relative min-h-[70px] sm:min-h-[85px] p-2 flex flex-col items-start justify-between text-left group transition-all duration-300 cursor-pointer ${
                        dayCell.isCurrentMonth ? "bg-black/10 text-marble" : "bg-black/40 text-marble/25"
                      } ${
                        isSelected 
                          ? "bg-ares-red/10 border-2 border-ares-red ring-1 ring-ares-red/20 z-10" 
                          : "hover:bg-white/5"
                      }`}
                    >
                      {/* Day Number */}
                      <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                        isToday 
                          ? "bg-ares-red text-white font-black" 
                          : isSelected 
                            ? "text-ares-gold" 
                            : "text-marble/80"
                      }`}>
                        {dayCell.date.getDate()}
                      </span>

                      {/* Event indicators */}
                      <div className="w-full space-y-1 mt-2">
                        {dayEvents.slice(0, 2).map((event) => (
                          <div
                            key={event.id}
                            className={`w-full text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded border truncate ${
                              event.category === "outreach"
                                ? "bg-ares-gold/10 text-ares-gold border-ares-gold/20"
                                : "bg-ares-red/10 text-white border-ares-red/20"
                            }`}
                          >
                            {event.title}
                          </div>
                        ))}
                        {dayEvents.length > 2 && (
                          <span className="text-[7px] font-mono text-ares-bronze font-bold block text-center bg-white/5 rounded">
                            + {dayEvents.length - 2} more
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

            </div>
          </div>

          {/* RIGHT: SELECTED DATE DETAIL SUMMARY & EVENT LOGS (4 Columns) */}
          <div className="lg:col-span-5 xl:col-span-4 flex flex-col gap-6">
            
            {/* Selected Date Summary Panel */}
            <div className="bg-black/20 border border-white/10 ares-cut p-6 shadow-2xl flex flex-col justify-between min-h-[220px]">
              <div>
                <span className="text-[9px] font-black uppercase tracking-widest text-ares-bronze flex items-center gap-1.5 mb-2">
                  <CalendarIcon size={10} className="text-ares-red" /> Target Schedule Details
                </span>
                <h3 className="text-xl font-black text-white font-heading uppercase leading-tight mt-1">
                  {formatFullDate(selectedDate)}
                </h3>
                <p className="text-[10px] text-marble/60 font-mono mt-2 border-t border-white/5 pt-2">
                  {selectedDayEvents.length === 0 
                    ? "No events or practices scheduled for this day." 
                    : `Active Operational Targets: ${selectedDayEvents.length} Event${selectedDayEvents.length === 1 ? "" : "s"}`
                  }
                </p>
              </div>

              <div className="mt-6 space-y-3">
                {selectedDayEvents.length === 0 ? (
                  <div className="p-4 bg-white/5 border border-white/5 text-center text-marble/45 text-xs font-bold uppercase tracking-wider ares-cut-sm flex items-center justify-center gap-2">
                    <Info size={12} className="text-ares-bronze" /> Ready for Booking
                  </div>
                ) : (
                  selectedDayEvents.map((event) => (
                    <div 
                      key={event.id}
                      className={`p-4 border ares-cut-sm space-y-2 text-left relative overflow-hidden ${
                        event.category === "outreach"
                          ? "bg-ares-gold/5 border-ares-gold/20"
                          : "bg-ares-red/5 border-ares-red/20"
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <span className={`px-2 py-0.5 rounded text-[7px] font-black uppercase tracking-widest ${
                          event.category === "outreach" ? "bg-ares-gold text-black" : "bg-ares-red text-white"
                        }`}>
                          {event.category}
                        </span>
                        <span className="text-[8px] font-mono text-marble/45 flex items-center gap-1">
                          <Clock size={8} /> {formatEventTime(event.dateStart)}
                        </span>
                      </div>
                      <h4 className="text-sm font-black text-white leading-tight uppercase font-heading">{event.title}</h4>
                      <p className="text-[10px] text-marble/85 leading-relaxed">{event.description}</p>
                      
                      {event.location && (
                        <p className="text-[8px] font-bold text-ares-bronze flex items-center gap-1 mt-1.5">
                          <MapPin size={8} className="text-ares-red" /> {event.location}
                        </p>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Sync Subscription Panel */}
            <div className="bg-black/20 border border-white/10 ares-cut p-6 shadow-xl flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-ares-cyan/10 flex items-center justify-center border border-ares-cyan/25 shrink-0">
                <Info size={20} className="text-ares-cyan" />
              </div>
              <div className="space-y-1">
                <h4 className="text-xs font-black text-white uppercase tracking-wider leading-none">Subscribe to iCal Feed</h4>
                <p className="text-[10px] text-marble/70 leading-relaxed pt-1">
                  Integrate ARES events directly into your device calendar. Contact the Software Lead to fetch your team's live calendar subscription credentials.
                </p>
              </div>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
}
