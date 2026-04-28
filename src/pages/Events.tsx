import { useMemo, useState } from "react";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { addMonths, subMonths, format, addHours } from "date-fns";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, List } from "lucide-react";
import SEO from "../components/SEO";
import { api } from "../api/client";

import { EventCard, EventItem } from "../components/events/EventCard";
import CompetitionBanner from "../components/CompetitionBanner";
import { useEventFilters } from "../hooks/useEventFilters";
import { MonthViewGrid } from "../components/calendar/MonthViewGrid";
import { AgendaViewList } from "../components/calendar/AgendaViewList";
import { CalendarEvent } from "../components/calendar/EventMockData";
import { CalendarSubscriptionBanner } from "../components/calendar/CalendarSubscriptionBanner";

export default function Events() {
  const [view, setView] = useState<"month" | "agenda">("month");
  const [currentDate, setCurrentDate] = useState(new Date());

  const { data: eventsRes, isLoading } = api.events.getEvents.useQuery(["events"], {});

  const events = useMemo(() => {
    const body = eventsRes?.status === 200 ? eventsRes.body : null;
    if (!body) return [];
    if (Array.isArray(body)) return body as unknown as EventItem[];
    if (typeof body === 'object' && body !== null && 'events' in body) {
      const e = (body as { events: unknown }).events;
      if (Array.isArray(e)) return e as unknown as EventItem[];
    }
    return [];
  }, [eventsRes]);


  
  // Transform backend events to CalendarEvent format
  const mappedEvents: CalendarEvent[] = useMemo(() => {
    return events.map((e) => {
      const start = new Date(e.date_start);
      // If no end date is provided, default to 1 hour after start
      const end = e.date_end ? new Date(e.date_end) : addHours(start, 1);
      
      let type: "internal" | "outreach" | "external" = "internal";
      if (e.category === "outreach" || e.category === "external") {
        type = e.category;
      }

      return {
        id: e.id,
        title: e.title,
        start,
        end,
        description: e.description || "",
        location: e.location || "",
        type
      };
    });
  }, [events]);

  // REF-F01: Extracted event filtering into custom hook
  const { 
    upcomingOutreach, 
    upcomingPractices, 
    upcomingExternal, 
    pastOutreach, 
    pastPractices,
    activeCompetition
  } = useEventFilters(events);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="w-full flex-grow flex flex-col bg-obsidian min-h-screen"
    >
      <SEO title="Event Schedule" description="Upcoming competitions, outreach demos, and build sessions for ARES 23247." />
      {/* ─── HEADER ─── */}
      <section className="relative w-full py-24 px-6 overflow-hidden flex flex-col items-center text-center">
        <div className="absolute inset-0 w-full h-full">
          <div className="absolute inset-0 bg-ares-red/10 mix-blend-screen pointer-events-none"></div>
          <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-ares-red/20 to-transparent pointer-events-none blur-3xl"></div>
        </div>

        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="relative z-10 max-w-4xl mx-auto space-y-6 bg-obsidian p-8 ares-cut-lg border border-white/10 shadow-2xl"
        >
          {/* ACC-F01: Fixed H1 for screen readers while maintaining visual style */}
          <h1 className="text-5xl md:text-7xl font-bold text-white tracking-tight">
            Team <span className="text-ares-gold">Events</span>
          </h1>
          <p className="text-xl md:text-2xl text-marble font-medium max-w-2xl mx-auto">
            Join us at our upcoming competitions, community outreach demos, and robotics workshops.
          </p>
        </motion.div>
      </section>

      {/* ─── EVENTS CONTAINER ─── */}
      <section className="w-full max-w-5xl mx-auto px-6 pb-32 flex flex-col gap-16">
        {isLoading ? (
          <div className="flex justify-center items-center py-20">
            <div className="w-12 h-12 border-4 border-ares-gold/30 border-t-ares-gold rounded-full animate-spin"></div>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            {/* Custom ARESWEB Calendar UI */}
            <div className="flex flex-col gap-8 mb-16">
              <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <h2 className="text-3xl font-bold text-white">Full Calendar</h2>
                  <div className="h-px flex-1 bg-gradient-to-r from-ares-gold/50 to-transparent hidden md:block w-32"></div>
                </div>
                
                {/* View Toggles & Navigation */}
                <div className="flex items-center gap-4 bg-black/40 border border-white/10 ares-cut-sm p-1">
                  <div className="flex items-center">
                    <button 
                      onClick={() => setCurrentDate(prev => subMonths(prev, 1))}
                      className="p-2 hover:bg-white/10 text-marble transition-colors"
                      aria-label="Previous Month"
                      title="Previous Month"
                    >
                      <ChevronLeft size={20} />
                    </button>
                    <span className="w-32 text-center font-bold text-white tracking-widest uppercase text-sm">
                      {format(currentDate, "MMMM yyyy")}
                    </span>
                    <button 
                      onClick={() => setCurrentDate(prev => addMonths(prev, 1))}
                      className="p-2 hover:bg-white/10 text-marble transition-colors"
                      aria-label="Next Month"
                      title="Next Month"
                    >
                      <ChevronRight size={20} />
                    </button>
                  </div>
                  <div className="w-px h-6 bg-white/20"></div>
                  <div className="flex items-center">
                    <button 
                      onClick={() => setView("month")}
                      className={`p-2 transition-colors ${view === "month" ? "bg-ares-red text-white" : "text-marble hover:bg-white/10"}`}
                      title="Month View"
                    >
                      <CalendarIcon size={18} />
                    </button>
                    <button 
                      onClick={() => setView("agenda")}
                      className={`p-2 transition-colors ${view === "agenda" ? "bg-ares-red text-white" : "text-marble hover:bg-white/10"}`}
                      title="Agenda View"
                    >
                      <List size={18} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Calendar Grid / List */}
              <div className="w-full relative z-10">
                {view === "month" ? (
                  <MonthViewGrid currentDate={currentDate} events={mappedEvents} />
                ) : (
                  <AgendaViewList events={mappedEvents} />
                )}
              </div>

              {/* Subscription CTA */}
              <CalendarSubscriptionBanner />
            </div>

            {/* Upcoming Outreach Events */}
            <div className="flex flex-col gap-8">
              <div className="flex items-center gap-4">
                <h2 className="text-3xl font-bold text-white">Upcoming Outreach</h2>
                <div className="h-px flex-1 bg-gradient-to-r from-ares-gold/50 to-transparent"></div>
              </div>
              
              {upcomingOutreach.length === 0 ? (
                <div className="bg-white/5 border border-white/10 hero-card p-12 text-center">
                  <p className="text-marble text-lg">No upcoming outreach events are currently scheduled.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-6">
                  {upcomingOutreach.map(evt => <EventCard key={evt.id} event={evt} isPast={false} />)}
                </div>
              )}
            </div>

            {/* Upcoming External / Community Events */}
            {upcomingExternal.length > 0 && (
              <div className="flex flex-col gap-8 mt-12">
                <div className="flex items-center gap-4">
                  <h2 className="text-2xl font-bold text-white">External & Community Events</h2>
                  <div className="h-px flex-1 bg-gradient-to-r from-ares-cyan/50 to-transparent"></div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {upcomingExternal.map(evt => <EventCard key={evt.id} event={evt} isPast={false} />)}
                </div>
              </div>
            )}

            {/* Upcoming Practices */}
            {upcomingPractices.length > 0 && (
              <div className="flex flex-col gap-8 mt-12">
                <div className="flex items-center gap-4">
                  <h2 className="text-2xl font-bold text-white">Upcoming Practices</h2>
                  <div className="h-px flex-1 bg-gradient-to-r from-ares-red/50 to-transparent"></div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {upcomingPractices.map(evt => <EventCard key={evt.id} event={evt} isPast={false} />)}
                </div>
              </div>
            )}

            {/* Archival - Past Events */}
            {(pastOutreach.length > 0 || pastPractices.length > 0) && (
              <div className="mt-16 bg-white/5 border border-white/10 ares-cut p-8 backdrop-blur-sm">
                <h2 className="text-4xl font-black text-white tracking-tight mb-8">Event Archive</h2>
                
                {pastOutreach.length > 0 && (
                  <div className="flex flex-col gap-6 mb-12">
                    <div className="flex items-center gap-4">
                      <h3 className="text-xl font-bold text-ares-gold uppercase tracking-widest">Past Outreach</h3>
                      <div className="h-px flex-1 bg-gradient-to-r from-ares-gold/30 to-transparent"></div>
                    </div>
                    <div className="flex flex-col gap-4">
                      {pastOutreach.map(evt => <EventCard key={evt.id} event={evt} isPast={true} />)}
                    </div>
                  </div>
                )}

                {pastPractices.length > 0 && (
                  <div className="flex flex-col gap-6">
                    <div className="flex items-center gap-4">
                      <h3 className="text-xl font-bold text-ares-red-light uppercase tracking-widest">Past Practices</h3>
                      <div className="h-px flex-1 bg-gradient-to-r from-ares-red/30 to-transparent"></div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {pastPractices.map(evt => <EventCard key={evt.id} event={evt} isPast={true} />)}
                    </div>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        )}
      </section>

      {activeCompetition?.tba_event_key && (
        <CompetitionBanner eventKey={activeCompetition.tba_event_key} />
      )}
    </motion.div>
  );
}
