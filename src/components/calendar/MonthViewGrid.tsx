import { useMemo } from "react";
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

interface MonthViewGridProps {
  currentDate: Date;
  events: CalendarEvent[];
}

export const MonthViewGrid = ({ currentDate, events }: MonthViewGridProps) => {
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
            className="py-3 text-center text-xs font-bold uppercase tracking-widest text-marble/60"
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
              className={`min-h-[120px] p-2 border-r border-b border-white/5 transition-colors ${
                !isCurrentMonth ? "bg-black/40 opacity-50" : "bg-transparent"
              } ${idx % 7 === 6 ? "border-r-0" : ""} hover:bg-white/5`}
            >
              <div className="flex justify-between items-start mb-2">
                <span
                  className={`text-sm font-bold w-7 h-7 flex items-center justify-center rounded-full ${
                    isCurrentDay
                      ? "bg-ares-red text-white"
                      : "text-marble"
                  }`}
                >
                  {format(day, "d")}
                </span>
              </div>
              <div className="flex flex-col gap-1 overflow-y-auto max-h-[80px] scrollbar-thin scrollbar-thumb-white/10">
                {dayEvents.slice(0, 3).map((event) => (
                  <div
                    key={event.id}
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded-sm truncate ${getEventColor(
                      event.type
                    )}`}
                    title={event.title}
                  >
                    {format(event.start, "h:mm a")} - {event.title}
                  </div>
                ))}
                {dayEvents.length > 3 && (
                  <div className="text-[10px] font-bold text-marble/50 px-1">
                    +{dayEvents.length - 3} more
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
