import React from "react";
import { Clock } from "lucide-react";

export interface TeamEvent {
  id: string;
  title: string;
  dateStart: string;
  dateEnd: string;
  location?: string | null;
  locationId: string;
  description: string;
  category: string;
  isVolunteer: number;
  isDeleted: number;
  status: string;
}

interface PendingVolunteerEventsProps {
  pendingEvents: TeamEvent[];
  formEventId: string | null;
  isCalculatingHours: string | null;
  onLogEvent: (event: TeamEvent) => void;
}

export default function PendingVolunteerEvents({
  pendingEvents,
  formEventId,
  isCalculatingHours,
  onLogEvent,
}: PendingVolunteerEventsProps) {
  if (pendingEvents.length === 0) return null;

  return (
    <div className="bg-white/5 border border-ares-gold/20 p-6 ares-cut space-y-4 mb-6 shadow-xl relative overflow-hidden text-left">
      <div className="absolute top-0 right-0 w-32 h-32 bg-ares-gold/5 blur-2xl pointer-events-none rounded-full"></div>
      <div className="flex items-center justify-between border-b border-white/5 pb-3">
        <h2 className="text-sm font-bold uppercase tracking-wider text-ares-gold flex items-center gap-2 font-heading">
          <Clock size={14} className="text-ares-gold animate-pulse" />
          Unlogged Volunteer Calendar Events ({pendingEvents.length})
        </h2>
        <span className="text-[10px] bg-ares-gold/15 text-ares-gold px-2 py-0.5 font-mono font-bold ares-cut-sm">
          Awaiting Report
        </span>
      </div>
      <p className="text-xs text-marble/60">
        These events were marked as volunteer demos but haven't been logged in your outreach stats. Click <strong>Log Impact</strong> to auto-calculate service hours and prep the entry.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
        {pendingEvents.map((evt) => {
          const isSelected = formEventId === evt.id;
          return (
            <div 
              key={evt.id} 
              className={`border p-4 ares-cut flex flex-col justify-between gap-3 transition-all ${
                isSelected 
                  ? "bg-ares-red/10 border-ares-red/40" 
                  : "bg-white/5 border-white/10 hover:border-white/20"
              }`}
            >
              <div className="space-y-1">
                <h3 className="font-bold text-white text-sm uppercase tracking-tight font-heading truncate" title={evt.title}>
                  {evt.title}
                </h3>
                <p className="text-[10px] text-marble/55 font-mono">
                  {evt.dateStart ? evt.dateStart.split("T")[0] : ""}
                </p>
              </div>
              <button
                onClick={() => onLogEvent(evt)}
                disabled={isCalculatingHours === evt.id}
                className="w-full text-center py-1.5 px-3 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-ares-gold/45 text-[10px] font-black uppercase tracking-wider text-marble hover:text-ares-gold transition-all ares-cut-sm disabled:opacity-50 cursor-pointer font-bold"
              >
                {isCalculatingHours === evt.id ? "Analyzing Attendance..." : "Log Impact"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
