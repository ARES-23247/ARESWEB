import { describe, expect, it } from "vitest";
import { buildCalendarDays, formatEventTime, formatFullDate, isSameDay } from "@/app/calendar/calendarView";

describe("calendar view utilities", () => {
  it("builds a stable six-week calendar grid", () => {
    const days = buildCalendarDays(2026, 7);
    expect(days).toHaveLength(42);
    expect(days.filter((day) => day.isCurrentMonth)).toHaveLength(31);
    expect(days[0]?.date.getDay()).toBe(0);
    expect(days[41]?.date.getDay()).toBe(6);
  });

  it("compares calendar dates without comparing their times", () => {
    expect(isSameDay(new Date(2026, 7, 10, 9), new Date(2026, 7, 10, 18))).toBe(true);
    expect(isSameDay(new Date(2026, 7, 10), new Date(2026, 7, 11))).toBe(false);
  });

  it("formats event times and empty values", () => {
    expect(formatEventTime("")).toBe("TBD");
    expect(formatEventTime("2026-08-10T12:34:00")).toMatch(/12:34\s*PM/i);
  });

  it("formats a full accessible date label", () => {
    expect(formatFullDate(new Date(2026, 7, 10))).toBe("Monday, August 10, 2026");
  });
});
