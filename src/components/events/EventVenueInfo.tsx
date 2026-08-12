import React, { useMemo } from "react";
import { MapPin } from "lucide-react";
import { EventItem } from "./types";
import { TeamLocation } from "@/types/location";

interface EventVenueInfoProps {
  event: EventItem;
  locations: TeamLocation[];
}

export default function EventVenueInfo({ event, locations }: EventVenueInfoProps) {
  const { venueName, address, gmapsUrl, description } = useMemo(() => {
    const selected = event.locationId ? locations.find((l) => l.id === event.locationId) : null;
    const name = selected?.name || event.publicVenue?.name || event.location || "Venue not published";
    const addr = selected?.address || event.publicVenue?.address || "";
    const url = selected?.gmapsUrl || `https://maps.google.com/maps?q=${encodeURIComponent(addr || name)}`;
    const desc = selected?.description || "";

    return { venueName: name, address: addr, gmapsUrl: url, description: desc };
  }, [event, locations]);

  if (!event.locationId && !event.location && !event.publicVenue) return null;

  return (
    <div className="glass-card border border-white/10 p-6 rounded-2xl bg-black/20 space-y-4 text-left animate-fade-in">
      <div>
        <h3 className="text-sm font-black text-white uppercase tracking-tight font-heading flex items-center gap-2">
          <MapPin size={16} className="text-ares-gold" /> Venue Information
        </h3>
        <p className="text-[9px] text-marble/50 uppercase font-bold mt-0.5">Directions and facility details</p>
      </div>
      
      <div className="space-y-3">
        <div>
          <h4 className="text-xs font-black text-white uppercase tracking-wider">{venueName}</h4>
          {address && (
            <p className="text-[11px] text-marble/70 leading-relaxed mt-1 font-semibold">{address}</p>
          )}
          {description && (
            <p className="text-[10px] text-marble/40 leading-relaxed italic mt-1.5">{description}</p>
          )}
        </div>
        
        {gmapsUrl && (
          <a
            href={gmapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full text-center block py-2 bg-white/5 hover:bg-ares-gold border border-white/10 hover:border-ares-gold text-marble hover:text-black text-[9px] font-black uppercase tracking-widest ares-cut-sm transition-all cursor-pointer shadow-md"
          >
            Get Directions ↗
          </a>
        )}
      </div>
    </div>
  );
}
