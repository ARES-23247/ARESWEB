import React from "react";
import { Link } from "react-router-dom";
import { Calendar as CalendarIcon, Info, Pencil, Clock, MapPin, Plus } from "lucide-react";
import { TeamEvent } from "./mockEvents";

interface SelectedEventPanelProps {
  selectedDate: Date;
  selectedDayEvents: TeamEvent[];
  canEdit: boolean;
  formatFullDate: (date: Date) => string;
  formatEventTime: (isoString: string) => string;
  handleOpenInlineCreate: (date?: Date) => void;
  handleOpenInlineEdit: (eventId: string) => void;
}

export function SelectedEventPanel({
  selectedDate,
  selectedDayEvents,
  canEdit,
  formatFullDate,
  formatEventTime,
  handleOpenInlineCreate,
  handleOpenInlineEdit
}: SelectedEventPanelProps) {
  return (
    <div className="bg-black/20 border border-white/10 ares-cut p-6 shadow-2xl flex flex-col justify-between min-h-[220px]">
      <div>
        <span className="text-[9px] font-black uppercase tracking-widest text-ares-bronze flex items-center gap-1.5 mb-2">
          <CalendarIcon size={10} className="text-ares-red" /> Target Schedule Details
        </span>
        <h3 className="text-xl font-black text-white font-heading uppercase leading-tight mt-1">
          {formatFullDate(selectedDate)}
        </h3>
        <p className="text-[10px] text-marble/60 font-mono mt-2 border-t border-white/5 pt-2">
          {selectedDayEvents.length === 0 
            ? "No events or practices scheduled for this day." 
            : `Active Operational Targets: ${selectedDayEvents.length} Event${selectedDayEvents.length === 1 ? "" : "s"}`
          }
        </p>
      </div>

      <div className="mt-6 space-y-3">
        {selectedDayEvents.length === 0 ? (
          <div className="p-4 bg-white/5 border border-white/5 text-center text-marble/45 text-xs font-bold uppercase tracking-wider ares-cut-sm flex items-center justify-center gap-2">
            <Info size={12} className="text-ares-bronze" /> Ready for Booking
          </div>
        ) : (
          selectedDayEvents.map((event) => (
            <Link 
              to={`/events/${event.id}`}
              key={event.id}
              className={`block p-4 border ares-cut-sm space-y-2 text-left relative overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/20 hover:border-white/20 ${
                event.category === "outreach"
                  ? "bg-ares-gold/5 border-ares-gold/20 hover:bg-ares-gold/10"
                  : "bg-ares-red/5 border-ares-red/20 hover:bg-ares-red/10"
              }`}
            >
              <div className="flex justify-between items-center relative z-10">
                <span className={`px-2 py-0.5 rounded text-[7px] font-black uppercase tracking-widest ${
                  event.category === "outreach" ? "bg-ares-gold text-black" : "bg-ares-red text-white"
                }`}>
                  {event.category}
                </span>
                
                <div className="flex items-center gap-2">
                  {canEdit && (
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        handleOpenInlineEdit(event.id);
                      }}
                      className="p-1 bg-white/5 hover:bg-ares-gold/25 border border-white/10 rounded transition-colors text-white cursor-pointer"
                      title="Edit Event"
                    >
                      <Pencil size={8} />
                    </button>
                  )}
                  <span className="text-[8px] font-mono text-marble/45 flex items-center gap-1">
                    <Clock size={8} /> {formatEventTime(event.dateStart)}
                  </span>
                </div>
              </div>
              <h4 className="text-sm font-black text-white leading-tight uppercase font-heading">{event.title}</h4>
              <p className="text-[10px] text-marble/85 leading-relaxed">{event.description}</p>
              
              {event.location && (
                <p className="text-[8px] font-bold text-ares-bronze flex items-center gap-1 mt-1.5">
                  <MapPin size={8} className="text-ares-red" /> {event.location}
                </p>
              )}
            </Link>
          ))
        )}
      </div>
      
      {canEdit && (
        <div className="mt-4 pt-4 border-t border-white/5">
          <button
            type="button"
            onClick={() => handleOpenInlineCreate(selectedDate)}
            className="w-full py-2 bg-ares-red/10 hover:bg-ares-red/20 border border-ares-red/30 text-white hover:text-ares-gold text-[10px] font-black uppercase tracking-wider ares-cut-sm flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow active:scale-98"
          >
            <Plus size={11} /> Schedule Event
          </button>
        </div>
      )}
    </div>
  );
}
