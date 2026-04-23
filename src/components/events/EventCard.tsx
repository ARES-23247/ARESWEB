import { Link } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { DEFAULT_COVER_IMAGE } from "../../utils/constants";
import { downloadICS } from "../../utils/calendar";
import { Calendar } from "lucide-react";

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

export const EventCard = ({ event, isPast }: { event: EventItem; isPast: boolean }) => {
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
        <div className="mt-6 flex items-center justify-between">
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
              className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-sm text-[10px] font-bold uppercase tracking-widest bg-ares-gold/10 hover:bg-ares-gold text-ares-gold hover:text-black border border-ares-gold/30 hover:border-ares-gold transition-all"
            >
              <Calendar size={12} /> Add to Calendar
            </button>
          )}
        </div>
      </div>
    </Link>
  );
};
