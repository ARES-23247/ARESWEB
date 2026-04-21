import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { format, isAfter, subDays, addDays, parseISO } from "date-fns";
import { motion } from "framer-motion";
import SEO from "../components/SEO";
import { DEFAULT_COVER_IMAGE } from "../utils/constants";

interface EventItem {
  id: string;
  title: string;
  date_start: string;
  date_end: string | null;
  location: string | null;
  description: string;
  cover_image: string | null;
  tba_event_key: string | null;
  category: "internal" | "outreach" | "external";
}
import CompetitionBanner from "../components/CompetitionBanner";

const extractPlainText = (jsonStr: string) => {
  try {
    const ast = JSON.parse(jsonStr);
    if (ast && ast.type === "doc") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const extract = (node: any): string => {
        if (node.text) return node.text;
        if (node.content) return node.content.map(extract).join(" ");
        return "";
      };
      return extract(ast);
    }
  } catch {
    // Ignore parse errors to return raw string
  }
  return jsonStr;
};

export default function Events() {
  const { data: events = [], isLoading } = useQuery<EventItem[]>({
    queryKey: ["events"],
    queryFn: async () => {
      const res = await fetch("/api/events");
      const data = await res.json();
      // @ts-expect-error -- D1 untyped response
      return data.events ?? [];
    },
  });

  const { data: calendarData = null } = useQuery({
    queryKey: ["calendar_config"],
    queryFn: async () => {
      const res = await fetch("/api/events/calendar");
      if (!res.ok) return {};
      return await res.json() as { calendarIdInternal?: string, calendarIdOutreach?: string, calendarIdExternal?: string };
    },
  });

  const calendars = calendarData 
    ? [
        { id: calendarData.calendarIdInternal, color: "%23A32929" },
        { id: calendarData.calendarIdOutreach, color: "%23BE6D00" },
        { id: calendarData.calendarIdExternal, color: "%2329527A" }
      ].filter(c => c.id)
    : [];

  const iframeSrc = calendars.length > 0 
    ? `https://calendar.google.com/calendar/embed?${calendars.map(c => `src=${encodeURIComponent(c.id as string)}&color=${c.color}`).join("&")}&ctz=${encodeURIComponent(Intl.DateTimeFormat().resolvedOptions().timeZone)}&bgcolor=%23ffffff&showPrint=0&showTabs=1&showCalendars=1` 
    : "";
  
  // Consider an event "past" if its date_start is before yesterday
  const now = new Date();
  const bufferTime = subDays(now, 1);
  
  // Filter into categories
  const outreachEvents = [...events]
    .filter((e) => e.category === "outreach")
    .sort((a, b) => parseISO(a.date_start).getTime() - parseISO(b.date_start).getTime());
  
  const internalPractices = [...events]
    .filter((e) => e.category === "internal")
    .sort((a, b) => parseISO(a.date_start).getTime() - parseISO(b.date_start).getTime());

  const externalEvents = [...events]
    .filter((e) => e.category === "external")
    .sort((a, b) => parseISO(a.date_start).getTime() - parseISO(b.date_start).getTime());
  
  const upcomingOutreach = outreachEvents.filter((e) => isAfter(parseISO(e.date_start), bufferTime));
  const upcomingPractices = internalPractices.filter((e) => isAfter(parseISO(e.date_start), bufferTime));
  const upcomingExternal = externalEvents.filter((e) => isAfter(parseISO(e.date_start), bufferTime));
  
  const pastOutreach = outreachEvents.filter((e) => !isAfter(parseISO(e.date_start), bufferTime)).reverse();
  const pastPractices = internalPractices.filter((e) => !isAfter(parseISO(e.date_start), bufferTime)).reverse();
  // External events are omitted from the archive.

  const activeCompetition = events.find(e => {
    if (!e.tba_event_key) return false;
    const start = parseISO(e.date_start);
    const end = e.date_end ? parseISO(e.date_end) : addDays(start, 3);
    return now >= start && now <= end;
  });

  const EventCard = ({ event, isPast }: { event: EventItem; isPast: boolean }) => {
    const startDate = parseISO(event.date_start);

    return (
      <Link to={`/events/${event.id}`} className={`flex flex-col md:flex-row gap-6 bg-black/40 border ${isPast ? 'border-white/5 opacity-80' : 'border-ares-gold/30 shadow-lg shadow-ares-gold/10'} hero-card overflow-hidden group block cursor-pointer`}>
        {/* Date / Image Block */}
        <div className="md:w-1/3 relative overflow-hidden bg-ares-red/20 min-h-[200px] flex-shrink-0">
          <img src={event.cover_image || DEFAULT_COVER_IMAGE} alt={event.title} className={`absolute inset-0 w-full h-full object-cover transition-transform duration-500 ${isPast ? '' : 'group-hover:scale-105'} ${!event.cover_image ? 'object-contain p-8 bg-black/80' : ''}`} />
          <div className="absolute top-4 left-4 bg-black/80 backdrop-blur-md px-4 py-2 ares-cut-sm border border-white/10 text-center">
            <div className={`text-2xl font-bold ${isPast ? 'text-white/80' : 'text-ares-gold'}`}>{format(startDate, 'd')}</div>
            <div className={`text-xs font-bold uppercase tracking-widest ${isPast ? 'text-white/80' : 'text-ares-red'}`}>{format(startDate, 'MMM')}</div>
          </div>
        </div>

        {/* Content Block */}
        <div className="p-6 md:p-8 flex-1 flex flex-col justify-center">
          <div className="flex items-center gap-4 mb-3 text-sm font-semibold uppercase tracking-wider text-marble/60">
            <span className="flex items-center gap-1.5">
              <span className={`w-2.5 h-2.5 rounded-full ${event.category === 'internal' ? 'bg-ares-red' : event.category === 'outreach' ? 'bg-ares-gold' : 'bg-ares-cyan'}`}></span> 
              {format(startDate, 'h:mm a')}
            </span>
            {event.location && (
              <span className="flex items-center gap-1.5">
                <span className={`w-2.5 h-2.5 rounded-full ${event.category === 'internal' ? 'bg-ares-red' : event.category === 'outreach' ? 'bg-ares-gold' : 'bg-ares-cyan'} opacity-50`}></span> 
                {event.location}
              </span>
            )}
          </div>
          <h3 className={`text-2xl md:text-3xl font-bold mb-4 ${isPast ? 'text-white/90' : 'text-white'} group-hover:text-ares-gold transition-colors`}>{event.title}</h3>
          <p className="text-marble/70 text-base leading-relaxed line-clamp-3">
            {extractPlainText(event.description)}
          </p>
          <div className="mt-6 text-ares-gold uppercase tracking-widest text-xs font-bold flex items-center gap-2 group-hover:translate-x-2 transition-transform w-fit">
            {isPast ? "Read Recap" : "View Details"} <span className="text-lg leading-none">&rarr;</span>
          </div>
        </div>
      </Link>
    );
  };

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
          className="relative z-10 max-w-4xl mx-auto space-y-6"
        >
          <h1 className="text-5xl md:text-7xl font-bold text-white tracking-tight">
            Team <span className="text-ares-gold">Events</span>
          </h1>
          <p className="text-xl md:text-2xl text-ares-gray font-medium max-w-2xl mx-auto">
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
                    className="w-full h-[600px] md:h-[700px] border-0"
                    style={{ filter: "invert(1) hue-rotate(180deg) opacity(0.85) contrast(1.05)" }}
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
                  <h3 className="text-sm font-black uppercase tracking-widest text-zinc-500 mb-4">Subscribe to Our Calendars</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {[
                      { id: calendarData?.calendarIdInternal, name: "ARES Practices", color: "ares-red" },
                      { id: calendarData?.calendarIdOutreach, name: "ARES Outreach & Volunteer", color: "ares-gold" },
                      { id: calendarData?.calendarIdExternal, name: "ARES Community Spotlight", color: "ares-cyan" },
                    ].filter(c => c.id).map((cal) => (
                      <div key={cal.name} className="flex flex-col gap-2 bg-zinc-900/50 ares-cut-sm p-4 border border-white/5">
                        <span className="text-xs font-bold text-white uppercase tracking-wider">{cal.name}</span>
                        <div className="flex gap-2">
                          <a
                            href={`https://calendar.google.com/calendar/r?cid=${encodeURIComponent(cal.id as string)}`}
                            target="_blank"
                            rel="noreferrer"
                            className={`flex-1 text-center px-3 py-2 bg-${cal.color}/20 hover:bg-${cal.color}/40 text-${cal.color} border border-${cal.color}/30 ares-cut-sm text-[10px] font-black uppercase tracking-widest transition-all`}
                          >
                            + Google
                          </a>
                          <a
                            href={`https://calendar.google.com/calendar/ical/${encodeURIComponent(cal.id as string)}/public/basic.ics`}
                            target="_blank"
                            rel="noreferrer"
                            className="flex-1 text-center px-3 py-2 bg-white/5 hover:bg-white/10 text-white border border-white/10 ares-cut-sm text-[10px] font-black uppercase tracking-widest transition-all"
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
                  <p className="text-marble/70 text-lg">No upcoming outreach events are currently scheduled.</p>
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
                  <h2 className="text-2xl font-bold text-white/90">External & Community Events</h2>
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
                  <h2 className="text-2xl font-bold text-white/90">Upcoming Practices</h2>
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
                <h2 className="text-4xl font-black text-white/80 tracking-tight mb-8">Event Archive</h2>
                
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
