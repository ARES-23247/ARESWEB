import { Plus } from "lucide-react";
import { GreekMeander } from "@/components/GreekMeander";

export type CalendarFilter = "all" | "internal" | "outreach";

interface CalendarHeaderProps {
  canEdit: boolean;
  filter: CalendarFilter;
  isLoading: boolean;
  isLive: boolean;
  eventCount: number;
  onCreate: () => void;
  onFilterChange: (filter: CalendarFilter) => void;
}

export function CalendarHeader({ canEdit, filter, isLoading, isLive, eventCount, onCreate, onFilterChange }: CalendarHeaderProps) {
  return (
    <header className="mb-12 border-b border-ares-bronze/30 pb-8 flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6 relative">
      <GreekMeander variant="thin" opacity="opacity-10" className="absolute top-0 left-0 -mt-16 pointer-events-none" />
      <div className="relative z-10">
        <p className="text-ares-bronze uppercase tracking-[0.4em] text-[10px] font-black font-heading mb-4">Operational Schedule & Timelines</p>
        <h1 className="text-4xl md:text-7xl font-black text-white mb-6 uppercase tracking-tight font-heading flex flex-wrap items-center gap-4">
          Team <span className="bg-ares-red px-6 py-1 pb-3 ares-cut shadow-xl text-white font-bold">Calendar</span>
          {isLoading ? (
            <span className="inline-flex items-center rounded-full bg-ares-gold/10 px-3 py-1 text-[8px] font-bold uppercase tracking-wider text-ares-gold ring-1 ring-inset ring-ares-gold/30">Loading schedule</span>
          ) : isLive ? (
            <span className="inline-flex items-center rounded-full bg-ares-gold px-3 py-1 text-[8px] font-bold uppercase tracking-wider text-black ring-1 ring-inset ring-ares-bronze">Published schedule</span>
          ) : eventCount > 0 ? (
            <span className="inline-flex items-center rounded-full bg-ares-gold/10 px-3 py-1 text-[8px] font-bold uppercase tracking-wider text-ares-gold ring-1 ring-inset ring-ares-gold/30">Last confirmed schedule</span>
          ) : (
            <span className="inline-flex items-center rounded-full bg-ares-red px-3 py-1 text-[8px] font-bold uppercase tracking-wider text-white ring-1 ring-inset ring-ares-bronze">Schedule unavailable</span>
          )}
        </h1>
        <p className="text-marble/85 text-base md:text-lg max-w-2xl leading-relaxed">
          Plan and coordinate lab practices, software calibration sprints, and Spark! museum exhibits. Click on days to inspect active event details.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3 shrink-0 relative z-10">
        {canEdit && (
          <button type="button" onClick={onCreate} className="px-4 py-2 bg-ares-red hover:bg-ares-bronze text-white text-[9px] font-black uppercase tracking-wider rounded transition-all cursor-pointer shadow-lg flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-ares-cyan">
            <Plus aria-hidden="true" size={11} /> New Event
          </button>
        )}
        <div className="flex gap-1.5 bg-black/45 p-1 rounded-lg border border-white/5" aria-label="Filter calendar events">
          {(["all", "internal", "outreach"] as const).map((category) => (
            <button
              type="button"
              key={category}
              onClick={() => onFilterChange(category)}
              aria-pressed={filter === category}
              className={`px-4 py-2 text-[9px] font-black uppercase tracking-wider rounded transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan ${filter === category ? "bg-ares-red text-white" : "text-marble/55 hover:text-white hover:bg-white/5"}`}
            >
              {category === "all" ? "All Events" : category === "internal" ? "Practices" : "Outreach"}
            </button>
          ))}
        </div>
      </div>
    </header>
  );
}
