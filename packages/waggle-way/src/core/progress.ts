import { parseLevelFile, serializeLevel, type LevelDefinition } from "./level";
import type { DraftStorage } from "./storage";

export const PROGRESS_KEY = "ares.waggle-way.progress.v1";
export interface LevelProgress {
  levelId: string;
  definition: string;
  bestRescued: number;
  completed: boolean;
  skipped: boolean;
  bestPollen?: number;
  fewestTools?: number;
}

export function loadProgress(storage: DraftStorage): LevelProgress[] {
  let raw: string | null;
  try {
    raw = storage.getItem(PROGRESS_KEY);
  } catch {
    throw new Error(
      "Campaign progress cannot be read in this browser. You can still play the available levels.",
    );
  }
  if (raw === null) return [];
  try {
    if (raw.length > 4 * 1024 * 1024) throw new Error("Progress is oversized");
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw new Error("Invalid progress");
    const source = value as Record<string, unknown>;
    if (
      source.version !== 1 ||
      !Array.isArray(source.records) ||
      source.records.length > 100 ||
      Object.keys(source).some((key) => key !== "version" && key !== "records")
    )
      throw new Error("Unsupported progress");
    const ids = new Set<string>();
    return source.records.map((value): LevelProgress => {
      if (!value || typeof value !== "object" || Array.isArray(value))
        throw new Error("Invalid result");
      const record = value as Record<string, unknown>;
      const keys = [
        "levelId",
        "definition",
        "bestRescued",
        "completed",
        "skipped",
      ];
      if (
        Object.keys(record).some(
          (key) => ![...keys, "bestPollen", "fewestTools"].includes(key),
        ) ||
        keys.some((key) => !Object.hasOwn(record, key))
      )
        throw new Error("Invalid fields");
      if (typeof record.definition !== "string")
        throw new Error("Missing revision");
      const level = parseLevelFile(record.definition);
      if (
        record.levelId !== level.id ||
        ids.has(level.id) ||
        serializeLevel(level) !== record.definition
      )
        throw new Error("Invalid identity");
      ids.add(level.id);
      if (
        typeof record.bestRescued !== "number" ||
        !Number.isInteger(record.bestRescued) ||
        record.bestRescued < 0 ||
        record.bestRescued > level.population ||
        typeof record.completed !== "boolean" ||
        typeof record.skipped !== "boolean"
      )
        throw new Error("Invalid result");
      if (
        record.completed !== record.bestRescued >= level.rescueTarget ||
        (record.completed && record.skipped)
      )
        throw new Error("Inconsistent result");
      const extras: Pick<LevelProgress, "bestPollen" | "fewestTools"> = {};
      for (const field of ["bestPollen", "fewestTools"] as const) {
        if (!Object.hasOwn(record, field)) continue;
        const maximum =
          field === "bestPollen"
            ? level.objects.filter((object) => object.kind === "pollen").length
            : level.inventory!.reduce((sum, stock) => sum + stock.count, 0);
        if (
          level.rulesVersion < 5 ||
          !record.completed ||
          typeof record[field] !== "number" ||
          !Number.isInteger(record[field]) ||
          record[field] < 0 ||
          record[field] > maximum
        )
          throw new Error("Invalid optional result");
        extras[field] = record[field];
      }
      return {
        levelId: level.id,
        definition: record.definition,
        bestRescued: record.bestRescued,
        completed: record.completed,
        skipped: record.skipped,
        ...extras,
      };
    });
  } catch {
    throw new Error(
      "Saved campaign progress is unreadable or from an unsupported version. It has been preserved. You can still play the available levels.",
    );
  }
}

export function progressFor(
  records: readonly LevelProgress[],
  level: LevelDefinition,
): LevelProgress | undefined {
  const definition = serializeLevel(level);
  return records.find(
    (record) => record.levelId === level.id && record.definition === definition,
  );
}

export function saveProgress(
  storage: DraftStorage,
  level: LevelDefinition,
  result:
    | {
        type: "completed";
        rescued: number;
        pollen?: number;
        peakTools?: number;
      }
    | { type: "skipped" },
): LevelProgress[] {
  const definition = serializeLevel(level);
  if (
    result.type === "completed" &&
    (!Number.isInteger(result.rescued) ||
      result.rescued < level.rescueTarget ||
      result.rescued > level.population)
  )
    throw new Error("The rescue result does not meet this level's rules.");
  if (result.type === "completed") {
    for (const [field, maximum] of [
      [
        "pollen",
        level.objects.filter((object) => object.kind === "pollen").length,
      ],
      [
        "peakTools",
        (level.inventory ?? []).reduce((sum, stock) => sum + stock.count, 0),
      ],
    ] as const) {
      const value = result[field];
      if (
        value !== undefined &&
        (level.rulesVersion < 5 ||
          !Number.isInteger(value) ||
          value < 0 ||
          value > maximum)
      )
        throw new Error(
          "The optional result does not meet this level's rules.",
        );
    }
  }
  const records = loadProgress(storage);
  const previous = progressFor(records, level);
  const bestRescued = Math.max(
    previous?.bestRescued ?? 0,
    result.type === "completed" ? result.rescued : 0,
  );
  const record: LevelProgress = {
    levelId: level.id,
    definition,
    bestRescued,
    completed: bestRescued >= level.rescueTarget,
    skipped: bestRescued < level.rescueTarget && result.type === "skipped",
  };
  if (
    previous?.bestPollen !== undefined ||
    (result.type === "completed" && result.pollen !== undefined)
  )
    record.bestPollen = Math.max(
      previous?.bestPollen ?? 0,
      result.type === "completed" ? (result.pollen ?? 0) : 0,
    );
  if (
    previous?.fewestTools !== undefined ||
    (result.type === "completed" && result.peakTools !== undefined)
  )
    record.fewestTools = Math.min(
      previous?.fewestTools ?? Infinity,
      result.type === "completed" ? (result.peakTools ?? Infinity) : Infinity,
    );
  const index = records.findIndex((entry) => entry.levelId === level.id);
  if (index < 0) {
    if (records.length >= 100)
      throw new Error(
        "Campaign progress storage is full. Existing records were preserved.",
      );
    records.push(record);
  } else records[index] = record;
  const encoded = JSON.stringify({ version: 1, records });
  if (encoded.length > 4 * 1024 * 1024)
    throw new Error(
      "Campaign progress storage is full. Existing records were preserved.",
    );
  try {
    storage.setItem(PROGRESS_KEY, encoded);
  } catch {
    throw new Error(
      "This result could not be saved in your browser. You can continue playing.",
    );
  }
  return records;
}

export function isLevelUnlocked(
  levels: readonly LevelDefinition[],
  records: readonly LevelProgress[],
  index: number,
): boolean {
  if (!Number.isInteger(index) || index < 0 || index >= levels.length)
    return false;
  if (index === 0) return true;
  const prior = progressFor(records, levels[index - 1]);
  return Boolean(prior?.completed || prior?.skipped);
}
