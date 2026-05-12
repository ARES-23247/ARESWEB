import { useMemo, useCallback } from "react";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  format,
  isToday,
} from "date-fns";
import { CalendarEvent } from "./EventMockData";
import { Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { QuickAddEventModal } from "./QuickAddEventModal";
import { useQueryClient } from "@tanstack/react-query";
import { useModalsStore } from "../../store/modalsStore";

interface MonthViewGridProps {
  currentDate: Date;
  events: CalendarEvent[];
}

export const MonthViewGrid = ({ currentDate, events }: MonthViewGridProps) => {
  const queryClient = useQueryClient();
  const { quickAddEvent, openQuickAddEvent, closeModal } = useModalsStore();

  const handleQuickAddSuccess = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["events"] });
  }, [queryClient]);

  const openQuickAdd = useCallback((day: Date) => {
    openQuickAddEvent({ date: day });
  }, [openQuickAddEvent]);

  const closeQuickAdd = useCallback(() => {
    closeModal("quickAddEvent");
  }, [closeModal]);

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentDate));
    const end = endOfWeek(endOfMonth(currentDate));
    return eachDayOfInterval({ start, end });
  }, [currentDate]);

  const getEventsForDay = (day: Date) => {
    return events.filter(
      (event) =>
        isSameDay(event.start, day) ||
        (event.start <= day && event.end >= day)
    );
  };

  const getEventColor = (type: CalendarEvent["type"]) => {
    switch (type) {
      case "internal":
        return "bg-ares-red text-white";
      case "outreach":
        return "bg-ares-gold text-black";
      case "external":
        return "bg-ares-cyan text-black";
      default:
        return "bg-white/20 text-white";
    }
  };

  return (
    <div className="w-full flex flex-col bg-obsidian border border-white/10 ares-cut-sm overflow-hidden">
      {/* Header Row */}
      <div className="grid grid-cols-7 border-b border-white/10 bg-white/5">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
          <div
            key={day}
            className="py-3 text-center text-xs font-bold uppercase tracking-widest text-zinc-300"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Days Grid */}
      <div className="grid grid-cols-7 auto-rows-[minmax(120px,auto)]">
        {days.map((day, idx) => {
          const dayEvents = getEventsForDay(day);
          const isCurrentMonth = isSameMonth(day, currentDate);
          const isCurrentDay = isToday(day);

          return (
            <div
              key={day.toISOString()}
              className={`min-h-[120px] p-2 border-r border-b border-white/5 transition-colors group ${
                !isCurrentMonth ? "bg-black/40" : "bg-transparent"
              } ${idx % 7 === 6 ? "border-r-0" : ""} hover:bg-white/5`}
            >
              <div className="flex justify-between items-start mb-2">
                <span
                  className={`text-sm font-bold w-7 h-7 flex items-center justify-center rounded-full ${
                    isCurrentDay
                      ? "bg-ares-red text-white"
                      : !isCurrentMonth
                      ? "text-zinc-300"
                      : "text-marble"
                  }`}
                >
                  {format(day, "d")}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    openQuickAdd(day);
                  }}
                  aria-label={`Add event on ${format(day, "MMMM d, yyyy")}`}
                  className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-1 hover:bg-ares-red/20 rounded transition-all"
                >
                  <Plus size={14} className="text-ares-red" />
                </button>
              </div>
              <div className="flex flex-col gap-1 relative z-10">
                {dayEvents.slice(0, 3).map((event) => (
                  <Link
                    to="/events/$id" params={{ id: event.id }}
                    key={event.id}
                    onClick={(e) => e.stopPropagation()}
                    className={`relative z-10 text-[10px] font-bold px-1.5 py-0.5 rounded-sm truncate block transition-all hover:scale-105 hover:z-50 hover:shadow-lg origin-left ${getEventColor(
                      event.type
                    )}`}
                    title={event.title}
                  >
                    {event.isException && <span className="font-black mr-1 text-ares-gold bg-black/40 px-1 rounded-sm" title="Exception">!</span>}
                    {format(event.start, "h:mm a")} - {event.title}
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Quick Add Event Modal */}
      <QuickAddEventModal
        isOpen={quickAddEvent.isOpen}
        onClose={closeQuickAdd}
        selectedDate={(quickAddEvent.data as { date?: Date })?.date ?? null}
        onSuccess={handleQuickAddSuccess}
      />
    </div>
  );
};
