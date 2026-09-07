import { describe, expect, it, vi } from "vitest";
import { createBlankLevel } from "@ares/waggle-way/level";
import {
  DRAFT_KEY,
  loadDrafts,
  recoverDraftLibrary,
  saveDraft,
  type DraftStorage,
} from "@ares/waggle-way/storage";

function memory(initial: string | null = null): DraftStorage {
  let raw = initial;
  return {
    getItem: vi.fn(() => raw),
    setItem: vi.fn((_key, value) => {
      raw = value;
    }),
  };
}

describe("Waggle Way local draft persistence", () => {
  it("loads empty libraries, saves and replaces by ID, and preserves other drafts", () => {
    const storage = memory();
    expect(loadDrafts(storage)).toEqual([]);
    expect(recoverDraftLibrary(storage)).toBe('{"version":1,"levels":[]}');
    const level = createBlankLevel();
    saveDraft(storage, level);
    expect(storage.setItem).toHaveBeenCalledWith(DRAFT_KEY, expect.any(String));
    saveDraft(storage, { ...level, title: "New title" });
    saveDraft(storage, { ...level, id: "another" });
    expect(loadDrafts(storage).map((draft) => draft.title)).toEqual([
      "New title",
      "My garden",
    ]);
    expect(JSON.parse(recoverDraftLibrary(storage)).levels).toHaveLength(2);
  });

  it.each([
    "bad JSON",
    "null",
    "[]",
    '{"version":2,"levels":[]}',
    '{"version":1,"levels":[],"secret":"unexpected"}',
    '{"version":1,"levels":[{}]}',
    "x".repeat(6 * 1024 * 1024 + 1),
  ])("preserves invalid stored data %#", (raw) => {
    const storage = memory(raw);
    expect(() => loadDrafts(storage)).toThrow("preserved");
    expect(() => saveDraft(storage, createBlankLevel())).toThrow("preserved");
    expect(recoverDraftLibrary(storage)).toBe(raw);
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it("rejects duplicate IDs and limits library size", () => {
    const level = createBlankLevel();
    expect(() =>
      loadDrafts(
        memory(JSON.stringify({ version: 1, levels: [level, level] })),
      ),
    ).toThrow("preserved");
    const storage = memory(
      JSON.stringify({
        version: 1,
        levels: Array.from({ length: 20 }, (_, i) => ({
          ...level,
          id: `garden-${i}`,
        })),
      }),
    );
    expect(() => saveDraft(storage, level)).toThrow("20 gardens");
    expect(
      saveDraft(storage, { ...level, id: "garden-0", title: "Updated" })[0]
        .title,
    ).toBe("Updated");
    expect(() =>
      loadDrafts(
        memory(JSON.stringify({ version: 1, levels: Array(21).fill(level) })),
      ),
    ).toThrow("preserved");
  });

  it("exposes read and write failures without claiming success", () => {
    const denied = {
      getItem: vi.fn(() => {
        throw new Error("denied");
      }),
      setItem: vi.fn(),
    };
    expect(() => loadDrafts(denied)).toThrow("unavailable");
    expect(() => recoverDraftLibrary(denied)).toThrow("cannot be read");
    const full = memory();
    full.setItem = vi.fn(() => {
      throw new Error("quota");
    });
    expect(() => saveDraft(full, createBlankLevel())).toThrow(
      "could not be saved",
    );
    expect(loadDrafts(full)).toEqual([]);
  });
});
