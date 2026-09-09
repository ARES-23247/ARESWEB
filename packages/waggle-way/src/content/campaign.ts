import { ADVENTURE_CHAPTERS } from "./adventure";
import type { LevelDefinition } from "../core/level";

export interface CampaignPuzzle {
  number: number;
  garden: string;
  lesson: string;
  hints: readonly string[];
  level: LevelDefinition;
}

/** One built-in campaign. All maps use safe water and free dry-ground dancers. */
export const CAMPAIGN: readonly CampaignPuzzle[] = ADVENTURE_CHAPTERS.flatMap(
  (chapter) =>
    chapter.levels.map((level, index) => ({
      number: chapter.start + index + 1,
      garden: chapter.title,
      lesson: chapter.detail,
      hints: [level.instructions],
      level,
    })),
);
