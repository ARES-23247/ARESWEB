import { describe, expect, it, vi } from "vitest";
import { createBlankLevel, serializeLevel } from "@ares/waggle-way/level";
import {
  isLevelUnlocked,
  loadProgress,
  progressFor,
  PROGRESS_KEY,
  saveProgress,
} from "@ares/waggle-way/progress";
import type { DraftStorage } from "@ares/waggle-way/storage";

function memory(initial: string | null = null): DraftStorage {
  let raw = initial;
  return {
    getItem: vi.fn(() => raw),
    setItem: vi.fn((_key, value) => {
      raw = value;
    }),
  };
}
const level = createBlankLevel();
const second = { ...level, id: "second" };
const record = {
  levelId: level.id,
  definition: serializeLevel(level),
  bestRescued: 0,
  completed: false,
  skipped: true,
};

describe("campaign progress", () => {
  it("unlocks by completion or explicit skip and keeps the best result", () => {
    const storage = memory();
    expect(loadProgress(storage)).toEqual([]);
    expect(isLevelUnlocked([level, second], [], 0)).toBe(true);
    expect(isLevelUnlocked([level, second], [], 1)).toBe(false);
    for (const index of [-1, 2, 0.5])
      expect(isLevelUnlocked([level, second], [], index)).toBe(false);
    const skipped = saveProgress(storage, level, { type: "skipped" });
    expect(isLevelUnlocked([level, second], skipped, 1)).toBe(true);
    expect(progressFor(skipped, level)?.completed).toBe(false);
    const completed = saveProgress(storage, level, {
      type: "completed",
      rescued: 8,
    });
    expect(isLevelUnlocked([level, second], completed, 1)).toBe(true);
    expect(saveProgress(storage, level, { type: "skipped" })).toEqual(
      completed,
    );
    saveProgress(storage, second, { type: "skipped" });
    expect(loadProgress(storage)).toHaveLength(2);
    expect(storage.setItem).toHaveBeenCalledWith(
      PROGRESS_KEY,
      expect.any(String),
    );
  });

  it("does not carry a completion over to changed level content", () => {
    const storage = memory();
    const records = saveProgress(storage, level, {
      type: "completed",
      rescued: 8,
    });
    const revised = { ...level, title: "Changed puzzle" };
    expect(progressFor(records, revised)).toBeUndefined();
    expect(isLevelUnlocked([revised, second], records, 1)).toBe(false);
    const updated = saveProgress(storage, revised, { type: "skipped" });
    expect(updated).toHaveLength(1);
    expect(updated[0].completed).toBe(false);
    expect(progressFor(updated, revised)?.skipped).toBe(true);
  });

  it.each([
    "broken",
    "null",
    "[]",
    '{"version":2,"records":[]}',
    '{"version":1,"records":[],"extra":true}',
    "x".repeat(4 * 1024 * 1024 + 1),
  ])("preserves unreadable envelopes %#", (raw) => {
    const storage = memory(raw);
    expect(() => loadProgress(storage)).toThrow("preserved");
    expect(() => saveProgress(storage, level, { type: "skipped" })).toThrow(
      "preserved",
    );
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it.each([
    null,
    [],
    {},
    { ...record, definition: null },
    { ...record, levelId: "wrong" },
    { ...record, definition: JSON.stringify(level) },
    { ...record, bestRescued: 99 },
    { ...record, completed: true },
    { ...record, bestRescued: 8, completed: true, skipped: true },
  ])("rejects invalid individual results %#", (entry) => {
    expect(() =>
      loadProgress(memory(JSON.stringify({ version: 1, records: [entry] }))),
    ).toThrow("preserved");
  });

  it("bounds records and rejects duplicates without overwriting data", () => {
    expect(() =>
      loadProgress(
        memory(JSON.stringify({ version: 1, records: [record, record] })),
      ),
    ).toThrow("preserved");
    expect(() =>
      loadProgress(
        memory(
          JSON.stringify({ version: 1, records: Array(101).fill(record) }),
        ),
      ),
    ).toThrow("preserved");
    const records = Array.from({ length: 100 }, (_, i) => {
      const garden = { ...level, id: `garden-${i}` };
      return {
        ...record,
        levelId: garden.id,
        definition: serializeLevel(garden),
      };
    });
    const storage = memory(JSON.stringify({ version: 1, records }));
    expect(() => saveProgress(storage, level, { type: "skipped" })).toThrow(
      "storage is full",
    );
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it("reports invalid results and storage failures truthfully", () => {
    for (const rescued of [-1, 7, 9, 8.5, NaN])
      expect(() =>
        saveProgress(memory(), level, { type: "completed", rescued }),
      ).toThrow("does not meet");
    const storage = memory();
    storage.getItem = vi.fn(() => {
      throw new Error("denied");
    });
    expect(() => loadProgress(storage)).toThrow("cannot be read");
    const full = memory();
    full.setItem = vi.fn(() => {
      throw new Error("quota");
    });
    expect(() =>
      saveProgress(full, level, { type: "completed", rescued: 8 }),
    ).toThrow("could not be saved");
    expect(loadProgress(full)).toEqual([]);
  });
});
