import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { Calendar as CalendarIcon, Pencil } from "lucide-react";
import { GreekMeander } from "@/components/GreekMeander";
import { EventItem } from "./types";
import { TeamLocation } from "@/types/location";

interface EventHeroProps {
  event: EventItem;
  isPast: boolean;
  isVerified: boolean;
  locations: TeamLocation[];
  handleDownloadIcs: () => void;
  gcalSingleUrl: string;
  handleOpenInlineEdit: () => void;
}

export default function EventHero({
  event,
  isPast,
  isVerified,
  locations,
  handleDownloadIcs,
  gcalSingleUrl,
  handleOpenInlineEdit
}: EventHeroProps) {
  const startDate = new Date(event.dateStart);

  const topGmapsUrl = useMemo(() => {
    if (!event.location) return "";
    const selected = event.locationId ? locations.find((l) => l.id === event.locationId) : null;
    const venueName = selected ? selected.name : event.location;
    const address = selected ? selected.address : (event.locationId === "mars-building" || event.location === "MARS Building") ? "123 Science Way, Morgantown, WV" : "";
    return selected?.gmapsUrl || `https://maps.google.com/maps?q=${encodeURIComponent(address || venueName)}`;
  }, [event, locations]);

  return (
    <section className="relative w-full h-[45vh] min-h-[350px] flex items-center overflow-hidden bg-obsidian border-b-4 border-ares-bronze">
      <GreekMeander variant="thick" opacity="opacity-50" className="absolute bottom-[-1px] left-0 z-10" />
      
      {event.coverImage ? (
        <img
          src={event.coverImage}
          alt={event.title}
          className="absolute inset-0 w-full h-full object-cover opacity-60 mix-blend-luminosity"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-ares-red/15 via-transparent to-ares-gold/15 opacity-40" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-obsidian via-obsidian/60 to-transparent"></div>
      
      <div className="relative z-10 max-w-5xl mx-auto px-6 w-full mt-16">
        <Link
          to="/calendar"
          className="text-ares-gold hover:text-white uppercase tracking-widest text-[10px] font-black transition-all flex items-center gap-2 mb-6 w-fit"
        >
          <span>&larr;</span> Back to calendar
        </Link>
        
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <span
            className={`w-fit px-3 py-1 text-[9px] font-black uppercase tracking-widest rounded ${
              isPast
                ? "bg-white/10 text-marble/60"
                : "bg-ares-red/20 text-white border border-ares-red/35 shadow-[0_0_15px_rgba(192,0,0,0.3)] animate-pulse"
            }`}
          >
            {isPast ? "Historical Record" : "Upcoming Event"}
          </span>
          
          {!isPast && (
            <>
              <button
                type="button"
                onClick={handleDownloadIcs}
                className="w-fit flex items-center gap-1.5 px-3 py-1 rounded text-[9px] font-black uppercase tracking-widest bg-black/80 hover:bg-ares-gold text-white hover:text-black border border-white/15 hover:border-ares-gold transition-all cursor-pointer"
              >
                <CalendarIcon size={12} /> Add to calendar (.ics)
              </button>
              {gcalSingleUrl && (
                <a
                  href={gcalSingleUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-fit flex items-center gap-1.5 px-3 py-1 rounded text-[9px] font-black uppercase tracking-widest bg-black/80 hover:bg-ares-gold text-white hover:text-black border border-white/15 hover:border-ares-gold transition-all cursor-pointer"
                >
                  Add to Google Calendar
                </a>
              )}
            </>
          )}

          {isVerified && (
            <button
              type="button"
              onClick={handleOpenInlineEdit}
              className="w-fit flex items-center gap-1.5 px-3 py-1 rounded text-[9px] font-black uppercase tracking-widest bg-black/80 hover:bg-ares-gold text-white hover:text-black border border-white/15 hover:border-ares-gold transition-all cursor-pointer"
            >
              <Pencil size={12} /> Edit Event
            </button>
          )}
        </div>

        <h1 className="text-4xl md:text-6xl font-black text-white leading-tight uppercase font-heading drop-shadow-2xl">
          {event.title}
        </h1>

        <div className="mt-6 flex flex-col md:flex-row gap-x-8 gap-y-2 text-marble/80 font-bold text-sm md:text-base">
          <div className="flex flex-col">
            <p className="flex items-center gap-1.5 text-ares-bronze">
              <span className="text-white font-extrabold uppercase text-xs tracking-wider">Start:</span>{" "}
              {startDate.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}{" "}
              at {startDate.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
            </p>
            {event.dateEnd && (
              <p className="flex items-center gap-1.5 text-ares-bronze">
                <span className="text-white font-extrabold uppercase text-xs tracking-wider">End:</span>{" "}
                {new Date(event.dateEnd).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}{" "}
                at {new Date(event.dateEnd).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
              </p>
            )}
          </div>
          {event.location && (
            <div className="flex items-start md:items-center gap-1.5">
              <span className="text-white font-extrabold uppercase text-xs tracking-wider">Location:</span>
              <a
                href={topGmapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2 text-ares-bronze hover:text-white transition-colors"
              >
                {event.location} ↗
              </a>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
