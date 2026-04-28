import { useMemo } from "react";
import { Link } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { DEFAULT_COVER_IMAGE } from "../../utils/constants";
import { downloadICS } from "../../utils/calendar";
import { Calendar } from "lucide-react";
import { extractAstText } from "../../utils/tiptap";

export interface EventItem {
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

export const EventCard = ({ event, isPast }: { event: EventItem; isPast: boolean }) => {
  // EFF-N01: Memoize expensive parsing/formatting
  const startDate = useMemo(() => parseISO(event.date_start), [event.date_start]);
  const endDate = useMemo(() => event.date_end ? parseISO(event.date_end) : null, [event.date_end]);
  const plainDescription = useMemo(() => extractAstText(event.description), [event.description]);
  
  const formattedDay = useMemo(() => format(startDate, 'd'), [startDate]);
  const formattedMonth = useMemo(() => format(startDate, 'MMM'), [startDate]);
  const formattedTime = useMemo(() => {
    const startStr = format(startDate, 'h:mm a');
    if (endDate) {
      return `${startStr} - ${format(endDate, 'h:mm a')}`;
    }
    return startStr;
  }, [startDate, endDate]);

  return (
    <div className={`relative flex flex-col md:flex-row gap-6 bg-black/40 border ${isPast ? 'border-white/5 opacity-80' : 'border-ares-gold/30 shadow-lg shadow-ares-gold/10'} hero-card overflow-hidden group transition-all duration-300`}>
      {/* Date / Image Block */}
      <div className="md:w-1/3 relative overflow-hidden bg-ares-red/20 min-h-[200px] flex-shrink-0">
        <img 
          src={event.cover_image || DEFAULT_COVER_IMAGE} 
          alt={event.title} 
          loading="lazy"
          className={`absolute inset-0 w-full h-full object-cover transition-transform duration-500 ${isPast ? '' : 'group-hover:scale-105'} ${!event.cover_image ? 'object-contain p-8 bg-black/80' : ''}`} 
        />
        <div className="absolute top-4 left-4 bg-black/80 backdrop-blur-md px-4 py-2 ares-cut-sm border border-white/10 text-center z-10">
          <div className={`text-2xl font-bold ${isPast ? 'text-white' : 'text-ares-gold'}`}>{formattedDay}</div>
          <div className={`text-xs font-bold uppercase tracking-widest ${isPast ? 'text-white' : 'text-ares-red'}`}>{formattedMonth}</div>
        </div>
      </div>

      {/* Content Block */}
      <div className="p-6 md:p-8 flex-1 flex flex-col justify-center relative">
        <div className="flex items-center gap-4 mb-3 text-sm font-semibold uppercase tracking-wider text-marble/90">
          <span className="flex items-center gap-1.5">
            <span className={`w-2.5 h-2.5 rounded-full ${event.category === 'internal' ? 'bg-ares-red' : event.category === 'outreach' ? 'bg-ares-gold' : 'bg-ares-cyan'}`}></span> 
            {formattedTime}
          </span>
          {event.location && (
            <a
              href={`https://maps.google.com/maps?q=${encodeURIComponent(event.location.includes('—') ? event.location.split('—').pop()!.trim() : event.location)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 relative z-20 pointer-events-auto hover:text-ares-gold transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              <span className={`w-2.5 h-2.5 rounded-full ${event.category === 'internal' ? 'bg-ares-red' : event.category === 'outreach' ? 'bg-ares-gold' : 'bg-ares-cyan'} opacity-50`}></span>
              {event.location} ↗
            </a>
          )}
        </div>
        
        {/* ACC-F01: Use pseudo-element link to make card clickable without nesting interactive elements */}
        <h3 className={`text-2xl md:text-3xl font-bold mb-4 ${isPast ? 'text-white' : 'text-white'} group-hover:text-ares-gold transition-colors`}>
          <Link to={`/events/${event.id}`} className="after:absolute after:inset-0 focus:outline-none">
            {event.title}
          </Link>
        </h3>
        
        <p className="text-marble text-base leading-relaxed line-clamp-3 relative z-10 pointer-events-none">
          {plainDescription}
        </p>
        
        <div className="mt-6 flex items-center justify-between relative z-10 pointer-events-none">
          <div className="text-ares-gold uppercase tracking-widest text-xs font-bold flex items-center gap-2 group-hover:translate-x-2 transition-transform w-fit">
            {isPast ? "Read Recap" : "View Details"} <span className="text-lg leading-none">&rarr;</span>
          </div>
          
          {!isPast && (
            <button 
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                downloadICS(event);
              }}
              className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-sm text-xs font-bold uppercase tracking-widest bg-ares-gold/10 hover:bg-ares-gold text-ares-gold hover:text-black border border-ares-gold/30 hover:border-ares-gold transition-all relative z-20 pointer-events-auto"
              aria-label={`Add ${event.title} to calendar`}
            >
              <Calendar size={12} aria-hidden="true" /> Add to Calendar
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
