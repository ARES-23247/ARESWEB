import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { format, isAfter, subDays } from "date-fns";
import { motion } from "framer-motion";
import SEO from "../components/SEO";

interface EventItem {
  id: string;
  title: string;
  date_start: string;
  date_end: string | null;
  location: string | null;
  description: string;
  cover_image: string | null;
}

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
  } catch (err) {
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

  const now = new Date();
  
  // Consider an event "past" if its date_start is before yesterday
  const bufferTime = subDays(now, 1);
  
  const sortedEvents = [...events].sort((a, b) => new Date(a.date_start).getTime() - new Date(b.date_start).getTime());
  
  const upcomingEvents = sortedEvents.filter((e) => isAfter(new Date(e.date_start), bufferTime));
  const pastEvents = sortedEvents.filter((e) => !isAfter(new Date(e.date_start), bufferTime)).reverse();

  const EventCard = ({ event, isPast }: { event: EventItem; isPast: boolean }) => {
    const startDate = new Date(event.date_start);

    return (
      <Link to={`/events/${event.id}`} className={`flex flex-col md:flex-row gap-6 bg-black/40 border ${isPast ? 'border-white/5 opacity-80' : 'border-ares-gold/30 shadow-lg shadow-ares-gold/10'} hero-card overflow-hidden group block cursor-pointer`}>
        {/* Date / Image Block */}
        <div className="md:w-1/3 relative overflow-hidden bg-ares-red/20 min-h-[200px] flex-shrink-0">
          {event.cover_image ? (
            <img src={event.cover_image} alt={event.title} className={`absolute inset-0 w-full h-full object-cover transition-transform duration-500 ${isPast ? '' : 'group-hover:scale-105'}`} />
          ) : (
            <div className="absolute inset-0 w-full h-full bg-gradient-to-br from-ares-red to-black flex items-center justify-center opacity-80">
              <span className="text-white/20 font-bold tracking-widest text-3xl transform -rotate-12">ARES</span>
            </div>
          )}
          <div className="absolute top-4 left-4 bg-black/80 backdrop-blur-md px-4 py-2 rounded-xl border border-white/10 text-center">
            <div className={`text-2xl font-bold ${isPast ? 'text-white/80' : 'text-ares-gold'}`}>{format(startDate, 'd')}</div>
            <div className={`text-xs font-bold uppercase tracking-widest ${isPast ? 'text-white/80' : 'text-ares-red'}`}>{format(startDate, 'MMM')}</div>
          </div>
        </div>

        {/* Content Block */}
        <div className="p-6 md:p-8 flex-1 flex flex-col justify-center">
          <div className="flex items-center gap-4 mb-3 text-sm font-semibold uppercase tracking-wider text-marble/60">
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-ares-red"></span> {format(startDate, 'h:mm a')}</span>
            {event.location && <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-ares-gold"></span> {event.location}</span>}
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
            {/* Upcoming Events */}
            <div className="flex flex-col gap-8">
              <div className="flex items-center gap-4">
                <h2 className="text-3xl font-bold text-white">Upcoming Events</h2>
                <div className="h-px flex-1 bg-gradient-to-r from-ares-gold/50 to-transparent"></div>
              </div>
              
              {upcomingEvents.length === 0 ? (
                <div className="bg-white/5 border border-white/10 hero-card p-12 text-center">
                  <p className="text-marble/70 text-lg">No upcoming events are currently scheduled. Check back soon!</p>
                </div>
              ) : (
                <div className="flex flex-col gap-6">
                  {upcomingEvents.map(evt => <EventCard key={evt.id} event={evt} isPast={false} />)}
                </div>
              )}
            </div>

            {/* Past Events */}
            {pastEvents.length > 0 && (
              <div className="flex flex-col gap-8 mt-8">
                <div className="flex items-center gap-4">
                  <h2 className="text-3xl font-bold text-white/80">Past Events</h2>
                  <div className="h-px flex-1 bg-gradient-to-r from-white/10 to-transparent"></div>
                </div>
                
                <div className="flex flex-col gap-6">
                  {pastEvents.map(evt => <EventCard key={evt.id} event={evt} isPast={true} />)}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </section>
    </motion.div>
  );
}
