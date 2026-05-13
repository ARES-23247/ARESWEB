import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { format, parseISO } from "date-fns";
import { DEFAULT_coverImage } from "../../utils/constants";
import { downloadICS } from "../../utils/calendar";
import { Calendar } from "lucide-react";
import { extractAstText } from "../../utils/tiptap";

export interface EventItem {
  id: string;
  title: string;
  dateStart: string;
  dateEnd: string | null;
  location: string | null;
  locationAddress?: string | null;
  description: string;
  coverImage: string | null;
  tbaEventKey: string | null;
  category: "internal" | "outreach" | "external";
  recurringException?: number;
}

export const EventCard = ({ event, isPast }: { event: EventItem; isPast: boolean }) => {
  // EFF-N01: Memoize expensive parsing/formatting
  const startDate = useMemo(() => parseISO(event.dateStart), [event.dateStart]);
  const endDate = useMemo(() => event.dateEnd ? parseISO(event.dateEnd) : null, [event.dateEnd]);
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

  const mapUrl = useMemo(() => {
    if (!event.location && !event.locationAddress) return null;
    const searchString = event.locationAddress || (event.location!.includes('—') ? event.location!.split('—').pop()!.trim() : event.location!);
    const encoded = encodeURIComponent(searchString);
    // Google Maps Static API with Dark Mode styling matching ARESWEB obsidian theme
    const style = `&style=feature:all|element:geometry|color:0x1b1b1b&style=feature:all|element:labels.text.stroke|color:0x1b1b1b&style=feature:all|element:labels.text.fill|color:0x8a8a8a&style=feature:water|element:geometry|color:0x000000`;
    return `https://maps.googleapis.com/maps/api/staticmap?center=${encoded}&zoom=14&size=400x200&markers=color:0xff0000%7C${encoded}&key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''}${style}`;
  }, [event.location, event.locationAddress]);

  return (
    <div className={`relative flex flex-col md:flex-row gap-6 bg-black/40 border ${isPast ? 'border-white/5 opacity-80' : 'border-ares-gold/30 shadow-lg shadow-ares-gold/10'} hero-card overflow-hidden group transition-all duration-300`}>
      {/* Date / Image Block */}
      <div className="md:w-1/3 relative overflow-hidden bg-ares-red/20 min-h-[200px] flex-shrink-0">
        <img
          src={event.coverImage || DEFAULT_coverImage}
          alt={event.title}
          loading="lazy"
          decoding="async"
          className={`absolute inset-0 w-full h-full object-cover transition-transform duration-500 ${isPast ? '' : 'group-hover:scale-105'} ${!event.coverImage ? 'object-contain p-8 bg-black/80' : ''}`}
        />
        <div className="absolute top-4 left-4 bg-black/80 backdrop-blur-md px-4 py-2 ares-cut-sm border border-white/10 text-center z-10">
          <div className={`text-2xl font-bold ${isPast ? 'text-white' : 'text-ares-gold'}`}>{formattedDay}</div>
          <div className={`text-xs font-bold uppercase tracking-widest ${isPast ? 'text-white' : 'text-ares-red'}`}>{formattedMonth}</div>
        </div>
      </div>

      {/* Content Block */}
      <div className="p-6 md:p-8 flex-1 flex flex-col justify-center relative">
        <div className="flex items-center gap-4 mb-3 text-sm font-semibold uppercase tracking-wider text-marble/90 relative z-30">
          <span className="flex items-center gap-1.5">
            <span className={`w-2.5 h-2.5 rounded-full ${event.category === 'internal' ? 'bg-ares-red' : event.category === 'outreach' ? 'bg-ares-gold' : 'bg-ares-cyan'}`}></span> 
            {formattedTime}
          </span>
          {event.location && (
            <a
              href={`https://maps.google.com/maps?q=${encodeURIComponent(event.locationAddress || (event.location.includes('—') ? event.location.split('—').pop()!.trim() : event.location))}`}
              target="_blank"
              rel="noopener noreferrer"
              className="group/location relative flex items-center gap-1.5 pointer-events-auto hover:text-ares-gold transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              <span className={`w-2.5 h-2.5 rounded-full ${event.category === 'internal' ? 'bg-ares-red' : event.category === 'outreach' ? 'bg-ares-gold' : 'bg-ares-cyan'} opacity-50`}></span>
              {event.location} ↗
              
              {/* Map Hover Popover */}
              {mapUrl && (
                <div className="absolute top-full left-0 mt-2 w-64 h-32 opacity-0 invisible group-hover/location:opacity-100 group-hover/location:visible transition-all duration-300 z-50 bg-black border border-white/20 rounded shadow-2xl shadow-black overflow-hidden pointer-events-none">
                  {import.meta.env.VITE_GOOGLE_MAPS_API_KEY ? (
                    <img src={mapUrl} alt="Map preview" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-obsidian text-[10px] text-white/50 text-center p-4">
                      <span>Maps Static API Key Missing</span>
                    </div>
                  )}
                </div>
              )}
            </a>
          )}
        </div>
        
        {/* ACC-F01: Use pseudo-element link to make card clickable without nesting interactive elements */}
        <h3 className={`text-2xl md:text-3xl font-bold mb-4 flex flex-wrap items-center gap-3 ${isPast ? 'text-white' : 'text-white'} group-hover:text-ares-gold transition-colors`}>
          <Link to="/events/$id" params={{ id: event.id }} className="after:absolute after:inset-0 focus:outline-none">
            {event.title}
          </Link>
          {event.recurringException === 1 && (
            <span className="bg-ares-gold/20 text-ares-gold text-[10px] md:text-xs uppercase px-2 py-1 rounded-sm border border-ares-gold/30 flex items-center gap-1 z-20 pointer-events-none" title="This is a modified instance of a recurring series">
              Exception
            </span>
          )}
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


