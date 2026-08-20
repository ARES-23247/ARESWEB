import { describe, expect, it } from "vitest";
import {
  formatLocalDateTimeInput,
  localDateTimeInputToIso,
  storedDateTimeToLocalInput,
} from "@/lib/localDateTime";

describe("formatLocalDateTimeInput", () => {
  it("preserves local wall-clock values instead of converting them to UTC", () => {
    expect(formatLocalDateTimeInput(new Date(2026, 0, 15, 7, 5))).toBe(
      "2026-01-15T07:05",
    );
    expect(formatLocalDateTimeInput(new Date(2026, 6, 15, 19, 45))).toBe(
      "2026-07-15T19:45",
    );
  });

  it("fails closed for an invalid date", () => {
    expect(() => formatLocalDateTimeInput(new Date(Number.NaN))).toThrow(
      "valid date",
    );
  });

  it("round-trips stored timestamps through the browser's local timezone", () => {
    const input = storedDateTimeToLocalInput("2026-08-20T18:30:00.000Z");
    expect(input).toMatch(/^2026-08-20T\d{2}:30$/);
    expect(localDateTimeInputToIso(input)).toBe("2026-08-20T18:30:00.000Z");
    expect(storedDateTimeToLocalInput(null)).toBe("");
  });

  it("rejects malformed local inputs at the API boundary", () => {
    expect(() => localDateTimeInputToIso("not-a-date")).toThrow();
  });
});
