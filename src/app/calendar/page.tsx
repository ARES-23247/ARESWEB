"use client";

import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { collection, query, where, onSnapshot, doc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { 
  Calendar as CalendarIcon, 
  MapPin, 
  Info, 
  ChevronLeft, 
  ChevronRight, 
  Clock,
  Sparkles,
  Award,
  LayoutGrid,
  List,
  Plus,
  X,
  Loader2,
  Pencil,
  Copy,
  Check
} from "lucide-react";
import { GreekMeander } from "@/components/GreekMeander";
import EventsManagementPage from "@/app/dashboard/events/page";

interface TeamEvent {
  id: string;
  title: string;
  dateStart: string;
  dateEnd?: string;
  location?: string;
  locationId?: string;
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
  const { user, authorizedUser } = useAuth();
  const canEdit = !!(user && authorizedUser && authorizedUser.role !== "unverified");
  const [events, setEvents] = useState<TeamEvent[]>(MOCK_EVENTS);
  const [filter, setFilter] = useState<"all" | "internal" | "outreach">("all");
  const [isLive, setIsLive] = useState(false);

  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [copiedFeedUrl, setCopiedFeedUrl] = useState(false);

  const feedUrl = typeof window !== "undefined" ? `${window.location.origin}/api/calendar/feed` : "";
  const webcalUrl = feedUrl.replace(/^https?:/, "webcal:");
  const gcalUrl = `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(feedUrl)}`;

  const handleCopyFeedUrl = () => {
    if (!feedUrl) return;
    navigator.clipboard.writeText(feedUrl);
    setCopiedFeedUrl(true);
    setTimeout(() => setCopiedFeedUrl(false), 2000);
  };

  // Full Drawer Editor States
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editorAction, setEditorAction] = useState<"create" | "edit" | null>(null);
  const [editorDate, setEditorDate] = useState<Date | undefined>(undefined);
  const [editorEventId, setEditorEventId] = useState<string | null>(null);

  const handleOpenInlineCreate = (date?: Date) => {
    setEditorAction("create");
    setEditorDate(date || selectedDate || new Date());
    setEditorEventId(null);
    setIsEditorOpen(true);
  };

  const handleOpenInlineEdit = (eventId: string) => {
    setEditorAction("edit");
    setEditorDate(undefined);
    setEditorEventId(eventId);
    setIsEditorOpen(true);
  };

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
              locationId: data.locationId || "",
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

  // Group events into upcoming and past relative to the current date (start of today)
  const localToday = new Date();
  localToday.setHours(0, 0, 0, 0);
  const upcomingEvents = filteredEvents
    .filter((event) => {
      if (!event.dateStart) return false;
      const eventDate = new Date(event.dateStart);
      return eventDate >= localToday;
    })
    .sort((a, b) => new Date(a.dateStart).getTime() - new Date(b.dateStart).getTime());

  const pastEvents = filteredEvents
    .filter((event) => {
      if (!event.dateStart) return false;
      const eventDate = new Date(event.dateStart);
      return eventDate < localToday;
    })
    .sort((a, b) => new Date(b.dateStart).getTime() - new Date(a.dateStart).getTime());

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
                <span className="inline-flex items-center rounded-full bg-ares-success/10 px-3 py-1 text-[8px] font-bold uppercase tracking-wider text-ares-success ring-1 ring-inset ring-ares-success/20">
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

          <div className="flex flex-wrap items-center gap-3 shrink-0 relative z-10">
            {canEdit && (
              <button
                type="button"
                onClick={() => handleOpenInlineCreate(selectedDate)}
                className="px-4 py-2 bg-ares-red hover:bg-ares-red-dark text-white text-[9px] font-black uppercase tracking-wider rounded transition-all cursor-pointer shadow-lg flex items-center gap-1.5"
              >
                <Plus size={11} /> New Event
              </button>
            )}

            <div className="flex gap-1.5 bg-black/45 p-1 rounded-lg border border-white/5">
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
          </div>
        </header>

        {/* ─── INTERACTIVE MONTH-GRID CALENDAR (Top Dashboard Section) ─── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-16">
          
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
                  const isToday = isSameDay(dayCell.date, new Date());

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
                    <Link 
                      to={`/events/${event.id}`}
                      key={event.id}
                      className={`block p-4 border ares-cut-sm space-y-2 text-left relative overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/20 hover:border-white/20 ${
                        event.category === "outreach"
                          ? "bg-ares-gold/5 border-ares-gold/20 hover:bg-ares-gold/10"
                          : "bg-ares-red/5 border-ares-red/20 hover:bg-ares-red/10"
                      }`}
                    >
                      <div className="flex justify-between items-center relative z-10">
                        <span className={`px-2 py-0.5 rounded text-[7px] font-black uppercase tracking-widest ${
                          event.category === "outreach" ? "bg-ares-gold text-black" : "bg-ares-red text-white"
                        }`}>
                          {event.category}
                        </span>
                        
                        <div className="flex items-center gap-2">
                          {canEdit && (
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                handleOpenInlineEdit(event.id);
                              }}
                              className="p-1 bg-white/5 hover:bg-ares-gold/25 border border-white/10 rounded transition-colors text-white cursor-pointer"
                              title="Edit Event"
                            >
                              <Pencil size={8} />
                            </button>
                          )}
                          <span className="text-[8px] font-mono text-marble/45 flex items-center gap-1">
                            <Clock size={8} /> {formatEventTime(event.dateStart)}
                          </span>
                        </div>
                      </div>
                      <h4 className="text-sm font-black text-white leading-tight uppercase font-heading">{event.title}</h4>
                      <p className="text-[10px] text-marble/85 leading-relaxed">{event.description}</p>
                      
                      {event.location && (
                        <p className="text-[8px] font-bold text-ares-bronze flex items-center gap-1 mt-1.5">
                          <MapPin size={8} className="text-ares-red" /> {event.location}
                        </p>
                      )}
                    </Link>
                  ))
                )}
              </div>
              
              {canEdit && (
                <div className="mt-4 pt-4 border-t border-white/5">
                  <button
                    type="button"
                    onClick={() => handleOpenInlineCreate(selectedDate)}
                    className="w-full py-2 bg-ares-red/10 hover:bg-ares-red/20 border border-ares-red/30 text-white hover:text-ares-gold text-[10px] font-black uppercase tracking-wider ares-cut-sm flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow active:scale-98"
                  >
                    <Plus size={11} /> Schedule Event
                  </button>
                </div>
              )}
            </div>

            {/* Sync Subscription Panel */}
            <div className="bg-black/20 border border-white/10 ares-cut p-6 shadow-xl flex flex-col gap-4">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-ares-cyan/10 flex items-center justify-center border border-ares-cyan/25 shrink-0">
                  <CalendarIcon size={20} className="text-ares-cyan" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-xs font-black text-white uppercase tracking-wider leading-none">Subscribe to Feed</h4>
                  <p className="text-[10px] text-marble/70 leading-relaxed pt-1">
                    Sync ARES events directly into your personal calendar (Google, Apple, or Outlook) to stay updated in real-time.
                  </p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-2 mt-2">
                <a
                  href={webcalUrl}
                  className="px-3 py-2 bg-ares-cyan/10 hover:bg-ares-cyan/20 border border-ares-cyan/35 text-ares-cyan hover:text-white text-[9px] font-black uppercase tracking-wider rounded text-center transition-all cursor-pointer shadow flex items-center justify-center gap-1"
                >
                  Subscribe (iCal)
                </a>
                <a
                  href={gcalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-2 bg-ares-gold/10 hover:bg-ares-gold/20 border border-ares-gold/35 text-ares-gold hover:text-white text-[9px] font-black uppercase tracking-wider rounded text-center transition-all cursor-pointer shadow flex items-center justify-center gap-1"
                >
                  Google Calendar
                </a>
              </div>

              <button
                type="button"
                onClick={handleCopyFeedUrl}
                className="w-full py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-marble hover:text-white text-[9px] font-black uppercase tracking-wider rounded transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                {copiedFeedUrl ? (
                  <>
                    <Check size={11} className="text-ares-success" /> Copied Feed URL!
                  </>
                ) : (
                  <>
                    <Copy size={11} /> Copy Feed URL
                  </>
                )}
              </button>
            </div>

          </div>

        </div>

        {/* Elegant Section Divider */}
        <div className="relative py-12 flex items-center">
          <div className="flex-grow border-t border-white/10"></div>
          <span className="flex-shrink mx-4 text-ares-bronze uppercase tracking-[0.3em] text-[9px] font-black font-heading flex items-center gap-2">
            <Sparkles size={10} className="text-ares-gold" /> Detailed Timelines & Archive
          </span>
          <div className="flex-grow border-t border-white/10"></div>
        </div>

        {/* ─── CHRONOLOGICAL EVENT LOGS & ARCHIVE (Bottom Timeline Section) ─── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* LEFT COLUMN: UPCOMING EVENTS (8 Columns) */}
          <div className="lg:col-span-7 xl:col-span-8 space-y-6">
            <h2 className="text-xl font-black text-white font-heading uppercase tracking-widest flex items-center gap-2 mb-4">
              <CalendarIcon size={16} className="text-ares-red" />
              Upcoming Schedule
            </h2>
            
            {upcomingEvents.length === 0 ? (
              <div className="bg-black/20 border border-white/10 ares-cut-lg p-12 text-center text-marble/50 text-sm font-bold uppercase tracking-wider flex items-center justify-center gap-2">
                <Info size={16} className="text-ares-bronze" /> No upcoming events scheduled.
              </div>
            ) : (
              <div className="space-y-6">
                {upcomingEvents.map((event) => (
                  <Link 
                    to={`/events/${event.id}`}
                    key={event.id} 
                    className={`block bg-black/25 border transition-all duration-300 relative overflow-hidden group hover:bg-black/45 hover:border-white/40 hover:-translate-y-0.5 p-6 ares-cut-lg ${
                      event.category === "outreach"
                        ? "border-ares-gold/20 hover:shadow-[0_15px_30px_rgba(212,175,55,0.08)]"
                        : "border-ares-red/20 hover:shadow-[0_15px_30px_rgba(192,0,0,0.08)]"
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-white/5 pb-4 mb-4 relative z-10">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${
                          event.category === "outreach" ? "bg-ares-gold text-black" : "bg-ares-red text-white"
                        }`}>
                          {event.category}
                        </span>
                        <span className="text-[10px] font-mono text-ares-bronze font-bold flex items-center gap-1">
                          <CalendarIcon size={10} />
                          {new Date(event.dateStart).toLocaleDateString("en-US", {
                            month: "long",
                            day: "numeric",
                            year: "numeric"
                          })}
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-marble/60 flex items-center gap-1.5 bg-black/30 px-3 py-1 rounded border border-white/5">
                        <Clock size={10} className="text-ares-red" />
                        {formatEventTime(event.dateStart)}
                        {event.dateEnd && ` - ${formatEventTime(event.dateEnd)}`}
                      </span>
                    </div>

                    <h3 className="text-lg font-black text-white leading-tight uppercase font-heading relative z-10 group-hover:text-ares-gold transition-colors">{event.title}</h3>
                    <p className="text-xs text-marble/85 leading-relaxed mt-2 max-w-3xl relative z-10">{event.description}</p>
                    
                    {event.location && (
                      <div className="flex items-center gap-1.5 mt-4 text-[10px] font-bold text-ares-bronze bg-white/5 w-fit px-3 py-1 rounded border border-white/5 relative z-10">
                        <MapPin size={10} className="text-ares-red" />
                        {event.location}
                      </div>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* RIGHT COLUMN: PAST ARCHIVE (4 Columns) */}
          <div className="lg:col-span-5 xl:col-span-4 space-y-6">
            <h2 className="text-xl font-black text-white font-heading uppercase tracking-widest flex items-center gap-2 mb-4">
              <Award size={16} className="text-ares-gold" />
              Past Milestones & History
            </h2>

            <div className="bg-black/20 border border-white/10 ares-cut p-6 shadow-2xl space-y-6">
              {pastEvents.length === 0 ? (
                <div className="p-8 text-center text-marble/30 text-xs font-bold uppercase tracking-wider border border-dashed border-white/5 rounded">
                  No past events recorded.
                </div>
              ) : (
                <div className="relative border-l border-white/10 pl-4 ml-1 space-y-6">
                  {pastEvents.map((event) => (
                    <div key={event.id} className="relative group animate-fadeIn">
                      {/* Timeline Dot */}
                      <div className={`absolute -left-[21px] top-1 w-2 h-2 rounded-full border bg-obsidian transition-colors group-hover:bg-white ${
                        event.category === "outreach" ? "border-ares-gold/50" : "border-ares-red/50"
                      }`} />
                      
                      <Link to={`/events/${event.id}`} className="block space-y-1 cursor-pointer">
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] font-mono text-marble/40">
                            {new Date(event.dateStart).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric"
                            })}
                          </span>
                          <span className={`px-1 rounded text-[5px] font-black uppercase tracking-widest opacity-60 ${
                            event.category === "outreach" ? "bg-ares-gold/20 text-ares-gold" : "bg-ares-red/20 text-white"
                          }`}>
                            {event.category}
                          </span>
                        </div>
                        
                        <h4 className="text-xs font-black text-marble/85 leading-tight uppercase font-heading group-hover:text-white transition-colors">{event.title}</h4>
                        <p className="text-[10px] text-marble/55 leading-relaxed">{event.description}</p>
                        
                        {event.location && (
                          <p className="text-[8px] text-ares-bronze flex items-center gap-1 mt-1">
                            <MapPin size={8} className="text-ares-red" /> {event.location}
                          </p>
                        )}
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

        </div>

      </div>

      {/* ─── UPGRADED FULL EVENT EDITOR DRAWER ─── */}
      {isEditorOpen && (
        <EventsManagementPage
          editorOnly={true}
          prefilledAction={editorAction}
          prefilledDate={editorDate}
          prefilledEventId={editorEventId}
          onEditorClose={() => {
            setIsEditorOpen(false);
            setEditorAction(null);
            setEditorDate(undefined);
            setEditorEventId(null);
          }}
        />
      )}

    </div>
  );
}
