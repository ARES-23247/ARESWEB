import { useMemo } from "react";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { useQuery } from "@tanstack/react-query";
import { isAfter, subDays, addDays, parseISO } from "date-fns";
import { motion } from "framer-motion";
import SEO from "../components/SEO";
import { api } from "../api/client";

import { EventCard, EventItem } from "../components/events/EventCard";
import CompetitionBanner from "../components/CompetitionBanner";

export default function Events() {
  const { data: eventsRes, isLoading } = api.events.getEvents.useQuery(["events"], {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const rawBody = (eventsRes as any)?.body;
  const events = eventsRes?.status === 200 ? (Array.isArray(rawBody) ? rawBody : (Array.isArray(rawBody?.events) ? rawBody.events : [])) as unknown as EventItem[] : [];

  const { data: calendarRes } = api.events.getCalendarSettings.useQuery(["calendar_config"], {});
  const calendarData = calendarRes?.status === 200 ? calendarRes.body : null;

  // EFF-N01: Memoize calendar configuration mapping
  const calendars = useMemo(() => {
    if (!calendarData) return [];
    return [
      { id: calendarData.calendarIdInternal, color: "%23A32929" },
      { id: calendarData.calendarIdOutreach, color: "%23BE6D00" },
      { id: calendarData.calendarIdExternal, color: "%2329527A" }
    ].filter(c => c.id);
  }, [calendarData]);

  const iframeSrc = useMemo(() => {
    if (calendars.length === 0) return "";
    return `https://calendar.google.com/calendar/embed?${calendars.map(c => `src=${encodeURIComponent(c.id as string)}&color=${c.color}`).join("&")}&ctz=${encodeURIComponent(Intl.DateTimeFormat().resolvedOptions().timeZone)}&bgcolor=%23ffffff&showPrint=0&showTabs=1&showCalendars=1`;
  }, [calendars]);
  
  // EFF-N02: Memoize complex filtering and sorting
  const { 
    upcomingOutreach, 
    upcomingPractices, 
    upcomingExternal, 
    pastOutreach, 
    pastPractices,
    activeCompetition
  } = useMemo(() => {
    const now = new Date();
    const bufferTime = subDays(now, 1);

    const outreach = events.filter(e => e.category === "outreach");
    const internal = events.filter(e => e.category === "internal");
    const external = events.filter(e => e.category === "external");

    const sortAsc = (a: EventItem, b: EventItem) => parseISO(a.date_start).getTime() - parseISO(b.date_start).getTime();

    return {
      upcomingOutreach: outreach.filter(e => isAfter(parseISO(e.date_start), bufferTime)).sort(sortAsc),
      upcomingPractices: internal.filter(e => isAfter(parseISO(e.date_start), bufferTime)).sort(sortAsc),
      upcomingExternal: external.filter(e => isAfter(parseISO(e.date_start), bufferTime)).sort(sortAsc),
      pastOutreach: outreach.filter(e => !isAfter(parseISO(e.date_start), bufferTime)).sort(sortAsc).reverse(),
      pastPractices: internal.filter(e => !isAfter(parseISO(e.date_start), bufferTime)).sort(sortAsc).reverse(),
      activeCompetition: events.find(e => {
        if (!e.tba_event_key) return false;
        const start = parseISO(e.date_start);
        const end = e.date_end ? parseISO(e.date_end) : addDays(start, 3);
        return now >= start && now <= end;
      })
    };
  }, [events]);

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
          className="relative z-10 max-w-4xl mx-auto space-y-6 bg-obsidian p-8 rounded-2xl border border-white/10 shadow-2xl"
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
            {/* Google Calendar Native IFrame */}
            <div className="flex flex-col gap-8 mb-16">
              <div className="flex items-center gap-4">
                <h2 className="text-3xl font-bold text-white">Full Calendar</h2>
                <div className="h-px flex-1 bg-gradient-to-r from-ares-gold/50 to-transparent"></div>
              </div>
              {calendars.length > 0 ? (
                <div className="w-full bg-black/40 border border-white/10 ares-cut-sm overflow-hidden shadow-lg">
                  <iframe 
                    title="Google Calendar"
                    src={iframeSrc} 
                    className="w-full h-[600px] md:h-[700px] border-0 invert hue-rotate-180 opacity-85 contrast-105"
                    allowFullScreen
                  />
                </div>
              ) : (
                <div className="w-full h-[600px] bg-black/40 border border-white/10 ares-cut-sm flex items-center justify-center text-marble/50">
                  <div className="w-8 h-8 border-2 border-ares-gold/30 border-t-ares-gold rounded-full animate-spin"></div>
                </div>
              )}

              {/* Subscribe Buttons */}
              {calendars.length > 0 && (
                <div className="bg-black/40 border border-white/10 ares-cut-sm p-6">
                  <h3 className="text-sm font-black uppercase tracking-widest text-marble/50 mb-4">Subscribe to Our Calendars</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {[
                      { id: calendarData?.calendarIdInternal, name: "ARES Practices", color: "ares-red" },
                      { id: calendarData?.calendarIdOutreach, name: "ARES Outreach & Volunteer", color: "ares-gold" },
                      { id: calendarData?.calendarIdExternal, name: "ARES Community Spotlight", color: "ares-cyan" },
                    ].filter(c => c.id).map((cal) => (
                      <div key={cal.name} className="flex flex-col gap-2 bg-black/40 ares-cut-sm p-4 border border-white/5">
                        <span className="text-xs font-bold text-white uppercase tracking-wider">{cal.name}</span>
                        <div className="flex gap-2">
                          <a
                            href={`https://calendar.google.com/calendar/r?cid=${encodeURIComponent(cal.id as string)}`}
                            target="_blank"
                            rel="noreferrer"
                            className={`flex-1 text-center px-3 py-2 bg-${cal.color}/20 hover:bg-${cal.color}/40 text-${cal.color} border border-${cal.color}/30 ares-cut-sm text-xs font-black uppercase tracking-widest transition-all`}
                          >
                            + Google
                          </a>
                          <a
                            href={`https://calendar.google.com/calendar/ical/${encodeURIComponent(cal.id as string)}/public/basic.ics`}
                            target="_blank"
                            rel="noreferrer"
                            className="flex-1 text-center px-3 py-2 bg-white/5 hover:bg-white/10 text-white border border-white/10 ares-cut-sm text-xs font-black uppercase tracking-widest transition-all"
                          >
                            + iCal
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
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
                      <h3 className="text-xl font-bold text-ares-red uppercase tracking-widest">Past Practices</h3>
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
