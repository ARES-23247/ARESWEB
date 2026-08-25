import { describe, expect, it, vi } from "vitest";
import {
  ACADEMY_PROGRESS_STORAGE_KEY,
  MAX_COMPLETED_LESSONS,
  emptyAcademyProgress,
  parseAcademyProgress,
  readAcademyProgress,
  toggleAcademyLesson,
  writeAcademyProgress,
} from "@/lib/academyProgress";

describe("Academy progress storage", () => {
  it("falls back to an empty schema for missing, malformed, or future data", () => {
    expect(parseAcademyProgress(null)).toEqual(emptyAcademyProgress());
    expect(parseAcademyProgress("not json")).toEqual(emptyAcademyProgress());
    expect(parseAcademyProgress(JSON.stringify({ version: 2, completedSlugs: ["lesson-one"] })))
      .toEqual(emptyAcademyProgress());
  });

  it("keeps only bounded, unique public slugs", () => {
    const completedSlugs = Array.from({ length: MAX_COMPLETED_LESSONS + 5 }, (_, index) => `lesson-${index}`);
    const parsed = parseAcademyProgress(JSON.stringify({
      version: 1,
      completedSlugs: ["lesson-one", "lesson-one", "Invalid Slug", ...completedSlugs],
    }));

    expect(parsed.completedSlugs).toHaveLength(MAX_COMPLETED_LESSONS);
    expect(parsed.completedSlugs[0]).toBe("lesson-one");
    expect(parsed.completedSlugs).not.toContain("Invalid Slug");
  });

  it("toggles a valid lesson without adding identity or activity metadata", () => {
    const completed = toggleAcademyLesson(emptyAcademyProgress(), "robot-safety-basics");
    expect(completed).toEqual({ version: 1, completedSlugs: ["robot-safety-basics"] });
    expect(toggleAcademyLesson(completed, "robot-safety-basics")).toEqual(emptyAcademyProgress());
    expect(toggleAcademyLesson(completed, "../unsafe")).toBe(completed);
  });

  it("uses only the versioned local-storage key and propagates storage failures", () => {
    const getItem = vi.fn().mockReturnValue(JSON.stringify({ version: 1, completedSlugs: ["lesson-one"] }));
    expect(readAcademyProgress({ getItem })).toEqual({ version: 1, completedSlugs: ["lesson-one"] });
    expect(getItem).toHaveBeenCalledWith(ACADEMY_PROGRESS_STORAGE_KEY);

    const setItem = vi.fn();
    writeAcademyProgress({ setItem }, { version: 1, completedSlugs: ["lesson-one"] });
    expect(setItem).toHaveBeenCalledWith(
      ACADEMY_PROGRESS_STORAGE_KEY,
      JSON.stringify({ version: 1, completedSlugs: ["lesson-one"] }),
    );

    expect(() => readAcademyProgress({ getItem: () => { throw new Error("blocked"); } })).toThrow("blocked");
    expect(() => writeAcademyProgress({ setItem: () => { throw new Error("full"); } }, emptyAcademyProgress()))
      .toThrow("full");
  });
});
