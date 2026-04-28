import { format, isPast } from "date-fns";
import { CalendarEvent } from "./EventMockData";
import { MapPin, Clock } from "lucide-react";

interface AgendaViewListProps {
  events: CalendarEvent[];
}

export const AgendaViewList = ({ events }: AgendaViewListProps) => {
  // Sort events chronologically
  const sortedEvents = [...events].sort((a, b) => a.start.getTime() - b.start.getTime());

  if (sortedEvents.length === 0) {
    return (
      <div className="bg-obsidian border border-white/10 hero-card p-12 text-center flex flex-col items-center gap-4">
        <h3 className="text-2xl font-bold text-white">No Events Scheduled</h3>
        <p className="text-marble/70">There are no events for this timeframe.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {sortedEvents.map((event) => {
        const past = isPast(event.end || event.start);
        
        return (
          <div
            key={event.id}
            className={`flex flex-col md:flex-row gap-6 p-6 border transition-all hero-card ${
              past 
                ? "bg-black/60 border-white/5 opacity-70" 
                : "bg-obsidian border-white/10 hover:border-ares-gold/30 hover:shadow-lg"
            }`}
          >
            {/* Date Block */}
            <div className="flex flex-row md:flex-col items-center md:items-start gap-4 md:w-48 shrink-0">
              <div className="flex flex-col items-center md:items-start">
                <span className={`text-3xl font-black ${past ? "text-marble" : "text-ares-red"}`}>
                  {format(event.start, "MMM d")}
                </span>
                <span className="text-sm font-bold uppercase tracking-widest text-marble/60">
                  {format(event.start, "EEEE")}
                </span>
              </div>
            </div>

            {/* Details Block */}
            <div className="flex flex-col gap-3 flex-1 border-t md:border-t-0 md:border-l border-white/10 pt-4 md:pt-0 md:pl-6">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${
                  event.type === 'internal' ? 'bg-ares-red' : 
                  event.type === 'outreach' ? 'bg-ares-gold' : 'bg-ares-cyan'
                }`} />
                <h4 className="text-xl font-bold text-white leading-tight">
                  {event.title}
                </h4>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-6 text-sm font-semibold uppercase tracking-wider text-marble/80">
                <div className="flex items-center gap-1.5">
                  <Clock size={14} className="text-ares-gold" />
                  {format(event.start, "h:mm a")} - {format(event.end, "h:mm a")}
                </div>
                {event.location && (
                  <div className="flex items-center gap-1.5">
                    <MapPin size={14} className="text-ares-cyan" />
                    {event.location}
                  </div>
                )}
              </div>
              
              <p className="text-marble/90 text-base leading-relaxed mt-1">
                {event.description}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
};
