import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

interface EventItem {
  id: string;
  title: string;
  date_start: string;
  date_end: string | null;
  location: string | null;
  description: string;
  cover_image: string | null;
}

export default function Events() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/events")
      .then((res) => res.json())
      .then((data) => {
        if (data.events) {
          setEvents(data.events);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const now = new Date();

  // Separate events into upcoming and past based on date_start
  // We'll consider an event "past" if its date_start is before yesterday to give some buffer
  const bufferTime = now.getTime() - 24 * 60 * 60 * 1000;
  
  const sortedEvents = [...events].sort((a, b) => new Date(a.date_start).getTime() - new Date(b.date_start).getTime());
  
  const upcomingEvents = sortedEvents.filter((e) => new Date(e.date_start).getTime() >= bufferTime);
  const pastEvents = sortedEvents.filter((e) => new Date(e.date_start).getTime() < bufferTime).reverse(); // Newest past events first

  const EventCard = ({ event, isPast }: { event: EventItem; isPast: boolean }) => {
    const startDate = new Date(event.date_start);
    const timeStr = startDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

    return (
      <Link to={`/events/${event.id}`} className={`flex flex-col md:flex-row gap-6 bg-black/40 border ${isPast ? 'border-white/5 opacity-80' : 'border-ares-gold/30 shadow-lg shadow-ares-gold/10'} rounded-2xl overflow-hidden group hover:border-ares-gold/60 transition-all duration-300 block cursor-pointer`}>
        {/* Date / Image Block */}
        <div className="md:w-1/3 relative overflow-hidden bg-ares-red/20 min-h-[200px] flex-shrink-0">
          {event.cover_image ? (
            <img src={event.cover_image} alt={event.title} className={`absolute inset-0 w-full h-full object-cover transition-transform duration-500 ${isPast ? '' : 'group-hover:scale-105'}`} />
          ) : (
            <div className="absolute inset-0 w-full h-full bg-gradient-to-br from-ares-red to-black flex items-center justify-center opacity-80">
              <span className="text-white/20 font-black tracking-widest text-3xl transform -rotate-12">ARES</span>
            </div>
          )}
          <div className="absolute top-4 left-4 bg-black/80 backdrop-blur-md px-4 py-2 rounded-xl border border-white/10 text-center">
            <div className={`text-2xl font-black ${isPast ? 'text-white/80' : 'text-ares-gold'}`}>{startDate.getDate()}</div>
            <div className={`text-xs font-bold uppercase tracking-widest ${isPast ? 'text-white/80' : 'text-ares-red'}`}>{startDate.toLocaleDateString('en-US', { month: 'short' })}</div>
          </div>
        </div>

        {/* Content Block */}
        <div className="p-6 md:p-8 flex-1 flex flex-col justify-center">
          <div className="flex items-center gap-4 mb-3 text-sm font-semibold uppercase tracking-wider text-marble/60">
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-ares-red"></span> {timeStr}</span>
            {event.location && <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-ares-gold"></span> {event.location}</span>}
          </div>
          <h3 className={`text-2xl md:text-3xl font-black mb-4 ${isPast ? 'text-white/90' : 'text-white'} group-hover:text-ares-gold transition-colors`}>{event.title}</h3>
          <p className="text-marble/70 text-base leading-relaxed line-clamp-3">
            {event.description}
          </p>
          <div className="mt-6 text-ares-gold uppercase tracking-widest text-xs font-bold flex items-center gap-2 group-hover:translate-x-2 transition-transform w-fit">
            {isPast ? "Read Recap" : "View Details"} <span className="text-lg leading-none">&rarr;</span>
          </div>
        </div>
      </Link>
    );
  };

  return (
    <div className="w-full flex-grow flex flex-col bg-obsidian min-h-screen">
      {/* ─── HEADER ─── */}
      <section className="relative w-full py-24 px-6 overflow-hidden flex flex-col items-center text-center">
        <div className="absolute inset-0 w-full h-full">
          <div className="absolute inset-0 bg-ares-red/10 mix-blend-screen pointer-events-none"></div>
          <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-ares-red/20 to-transparent pointer-events-none blur-3xl"></div>
        </div>

        <div className="relative z-10 max-w-4xl mx-auto space-y-6">
          <h1 className="text-5xl md:text-7xl font-black text-white tracking-tight">
            Team <span className="text-ares-gold">Events</span>
          </h1>
          <p className="text-xl md:text-2xl text-ares-gray font-medium max-w-2xl mx-auto">
            Join us at our upcoming competitions, community outreach demos, and robotics workshops.
          </p>
        </div>
      </section>

      {/* ─── EVENTS CONTAINER ─── */}
      <section className="w-full max-w-5xl mx-auto px-6 pb-32 flex flex-col gap-16">
        {loading ? (
          <div className="flex justify-center items-center py-20">
            <div className="w-12 h-12 border-4 border-ares-gold/30 border-t-ares-gold rounded-full animate-spin"></div>
          </div>
        ) : (
          <>
            {/* Upcoming Events */}
            <div className="flex flex-col gap-8">
              <div className="flex items-center gap-4">
                <h2 className="text-3xl font-black text-white">Upcoming Events</h2>
                <div className="h-px flex-1 bg-gradient-to-r from-ares-gold/50 to-transparent"></div>
              </div>
              
              {upcomingEvents.length === 0 ? (
                <div className="bg-white/5 border border-white/10 rounded-2xl p-12 text-center">
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
                  <h2 className="text-3xl font-black text-white/80">Past Events</h2>
                  <div className="h-px flex-1 bg-gradient-to-r from-white/10 to-transparent"></div>
                </div>
                
                <div className="flex flex-col gap-6">
                  {pastEvents.map(evt => <EventCard key={evt.id} event={evt} isPast={true} />)}
                </div>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
