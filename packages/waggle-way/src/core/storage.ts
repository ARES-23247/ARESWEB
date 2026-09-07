import {
  parseLevelFile,
  serializeLevel,
  validateLevel,
  type LevelDefinition,
} from "./level";

export const DRAFT_KEY = "ares.waggle-way.drafts.v1";
export const MAX_DRAFTS = 20;
export interface DraftStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function loadDrafts(storage: DraftStorage): LevelDefinition[] {
  let raw: string | null;
  try {
    raw = storage.getItem(DRAFT_KEY);
  } catch {
    throw new Error(
      "Browser storage is unavailable. You can still edit and export your garden.",
    );
  }
  if (raw === null) return [];
  try {
    if (raw.length > 6 * 1024 * 1024) throw new Error("Oversized library");
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      throw new Error("Invalid library");
    const data = parsed as Record<string, unknown>;
    if (
      data.version !== 1 ||
      !Array.isArray(data.levels) ||
      data.levels.length > MAX_DRAFTS ||
      Object.keys(data).some((key) => key !== "version" && key !== "levels")
    )
      throw new Error("Unsupported library");
    const levels = data.levels.map(validateLevel);
    if (new Set(levels.map((level) => level.id)).size !== levels.length)
      throw new Error("Duplicate draft IDs");
    return levels;
  } catch {
    throw new Error(
      "Saved gardens could not be read. Existing storage has been preserved; export your current garden before recovery.",
    );
  }
}

export function saveDraft(
  storage: DraftStorage,
  level: LevelDefinition,
): LevelDefinition[] {
  const valid = parseLevelFile(serializeLevel(level));
  const levels = loadDrafts(storage);
  const existing = levels.findIndex((entry) => entry.id === valid.id);
  if (existing === -1) {
    if (levels.length >= MAX_DRAFTS)
      throw new Error(
        "The local library has 20 gardens. Export a garden or save over its existing ID.",
      );
    levels.push(valid);
  } else levels[existing] = valid;
  try {
    storage.setItem(DRAFT_KEY, JSON.stringify({ version: 1, levels }));
  } catch {
    throw new Error(
      "The garden could not be saved to this browser. Export a file to keep your changes.",
    );
  }
  return levels;
}

/** Recovery exposes only this game's non-sensitive draft data, never arbitrary browser keys. */
export function recoverDraftLibrary(storage: DraftStorage): string {
  try {
    return storage.getItem(DRAFT_KEY) ?? '{"version":1,"levels":[]}';
  } catch {
    throw new Error(
      "Browser storage cannot be read. Export the open garden instead.",
    );
  }
}
