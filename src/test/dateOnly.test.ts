import { describe, expect, it } from "vitest";
import { formatDateOnly, parseDateOnly } from "@/lib/dateOnly";

describe("date-only calendar values", () => {
  it("parses the stored day in local time instead of UTC midnight", () => {
    const parsed = parseDateOnly("2026-04-29");

    expect(parsed).not.toBeNull();
    expect(parsed?.getFullYear()).toBe(2026);
    expect(parsed?.getMonth()).toBe(3);
    expect(parsed?.getDate()).toBe(29);
    expect(
      formatDateOnly("2026-04-29", {
        month: "long",
        day: "numeric",
        year: "numeric",
      }),
    ).toBe("April 29, 2026");
  });

  it("rejects malformed and impossible calendar dates", () => {
    expect(parseDateOnly("2026-02-29")).toBeNull();
    expect(parseDateOnly("04/29/2026")).toBeNull();
    expect(formatDateOnly("invalid", { year: "numeric" })).toBe(
      "Date unavailable",
    );
  });
});
