import type { TeamEvent } from "@/types/event";

export interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
}

export function eventDetailHref(event: TeamEvent): string {
  const parentId = event.recurrenceOf ?? event.id;
  const path = `/events/${encodeURIComponent(parentId)}`;
  if (!event.recurrenceOf || !event.occurrenceDate) return path;
  const params = new URLSearchParams({ occurrence: event.occurrenceDate });
  return `${path}?${params.toString()}`;
}

export function buildCalendarDays(year: number, month: number): CalendarDay[] {
  const days: CalendarDay[] = [];
  const startDay = new Date(year, month, 1).getDay();
  const previousMonthDayCount = new Date(year, month, 0).getDate();

  for (let index = startDay - 1; index >= 0; index -= 1) {
    days.push({
      date: new Date(year, month - 1, previousMonthDayCount - index),
      isCurrentMonth: false,
    });
  }

  const currentMonthDayCount = new Date(year, month + 1, 0).getDate();
  for (let day = 1; day <= currentMonthDayCount; day += 1) {
    days.push({ date: new Date(year, month, day), isCurrentMonth: true });
  }

  const remaining = 42 - days.length;
  for (let day = 1; day <= remaining; day += 1) {
    days.push({ date: new Date(year, month + 1, day), isCurrentMonth: false });
  }

  return days;
}

export function isSameDay(first: Date, second: Date): boolean {
  return first.getFullYear() === second.getFullYear()
    && first.getMonth() === second.getMonth()
    && first.getDate() === second.getDate();
}

export function formatEventTime(isoString: string): string {
  if (!isoString) return "TBD";
  return new Date(isoString).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatFullDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatIcsUtcTimestamp(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return (
    `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}` +
    `T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`
  );
}

function escapeIcsText(raw: string): string {
  return raw
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

export function buildSingleEventIcsDataUrl(event: TeamEvent): string {
  const start = event.dateStart ? new Date(event.dateStart) : new Date();
  const safeStart = Number.isNaN(start.getTime()) ? new Date() : start;
  const parsedEnd = event.dateEnd ? new Date(event.dateEnd) : null;
  const safeEnd =
    parsedEnd && !Number.isNaN(parsedEnd.getTime()) && parsedEnd.getTime() > safeStart.getTime()
      ? parsedEnd
      : new Date(safeStart.getTime() + 60 * 60 * 1000);

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//ARES Robotics FTC 23247//Team Calendar//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${escapeIcsText(event.id)}@ares-ftc.org`,
    `DTSTAMP:${formatIcsUtcTimestamp(safeStart)}`,
    `DTSTART:${formatIcsUtcTimestamp(safeStart)}`,
    `DTEND:${formatIcsUtcTimestamp(safeEnd)}`,
    `SUMMARY:${escapeIcsText(event.title || "ARES Team Event")}`,
  ];
  if (event.location) {
    lines.push(`LOCATION:${escapeIcsText(event.location)}`);
  }
  if (event.description) {
    lines.push(`DESCRIPTION:${escapeIcsText(event.description)}`);
  }
  lines.push("END:VEVENT", "END:VCALENDAR");
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(lines.join("\r\n"))}`;
}

