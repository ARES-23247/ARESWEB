import { BUZZLE_COORDINATES, analyzeBuzzlePlay, getBuzzleCellIndex, type BuzzleBoard, type BuzzlePlacement, type BuzzleTile } from "./buzzle";
import { HEX_WORD_AXES } from "./games/hexGrid";

export interface BuzzleBoardWord { word: string; indices: number[] }
export interface BuzzleHint extends BuzzleBoardWord { placements: BuzzlePlacement[]; score: number }

export function twoLetterWords(words: ReadonlySet<string>): string[] {
  return [...words].filter((word) => /^[a-z]{2}$/u.test(word)).sort();
}

export function wordsOnBuzzleBoard(board: BuzzleBoard, words: ReadonlySet<string>): BuzzleBoardWord[] {
  const result: BuzzleBoardWord[] = [];
  for (const { q: dq, r: dr } of HEX_WORD_AXES) {
    BUZZLE_COORDINATES.forEach(({ q, r }, start) => {
      const previous = getBuzzleCellIndex(q - dq, r - dr);
      if (!board[start] || (previous !== null && board[previous])) return;
      const indices: number[] = [];
      let index: number | null = start;
      let offset = 0;
      while (index !== null && board[index]) {
        indices.push(index);
        offset++;
        index = getBuzzleCellIndex(q + dq * offset, r + dr * offset);
      }
      const word = indices.map((cell) => board[cell]!.letter).join("").toLowerCase();
      if (indices.length > 1 && words.has(word)) result.push({ word, indices });
    });
  }
  return result.sort((a, b) => a.word.localeCompare(b.word));
}

/** Exhaustive two-cell spans only. All resulting crossing words use the game validator. */
export function findBuzzleTwoLetterHints(
  board: BuzzleBoard,
  rack: readonly BuzzleTile[],
  draft: readonly BuzzlePlacement[],
  words: ReadonlySet<string>,
  player: number,
): BuzzleHint[] {
  if (draft.length > 2) return [];
  const result: BuzzleHint[] = [];
  const shortWords = twoLetterWords(words);
  for (const { q: dq, r: dr } of HEX_WORD_AXES) {
    for (const [start, { q, r }] of BUZZLE_COORDINATES.entries()) {
      const end = getBuzzleCellIndex(q + dq, r + dr);
      const before = getBuzzleCellIndex(q - dq, r - dr);
      const after = getBuzzleCellIndex(q + dq * 2, r + dr * 2);
      if (end === null || (before !== null && board[before]) || (after !== null && board[after])) continue;
      const indices = [start, end];
      if (indices.every((index) => board[index]) || draft.some(({ index }) => !indices.includes(index))) continue;
      for (const word of shortWords) {
        const placements: BuzzlePlacement[] = [];
        const used = new Set<string>();
        const visit = (offset: number) => {
          if (offset === 2) {
            try {
              const analysis = analyzeBuzzlePlay(board, placements, words, player);
              result.push({ word, indices, score: analysis.score, placements: placements.map((item) => ({ ...item })) });
            } catch {
              // A two-letter spelling can still fail connectivity or a crossing word.
            }
            return;
          }
          const index = indices[offset];
          const letter = word[offset].toUpperCase();
          if (board[index]) {
            if (board[index]!.letter === letter) visit(offset + 1);
            return;
          }
          const fixed = draft.find((item) => item.index === index);
          const equivalent = new Set<string>();
          for (const tile of rack) {
            if (used.has(tile.id) || (fixed && fixed.tile.id !== tile.id)) continue;
            if (draft.some((item) => item.tile.id === tile.id && item.index !== index)) continue;
            if (fixed && (fixed.assignedLetter ?? tile.letter) !== letter) continue;
            if (!tile.blank && tile.letter !== letter) continue;
            // Interchangeable copies do not create distinct previews; blanks do.
            const identity = `${tile.blank}:${tile.letter}:${tile.points}`;
            if (equivalent.has(identity)) continue;
            equivalent.add(identity);
            used.add(tile.id);
            placements.push({ index, tile, ...(tile.blank ? { assignedLetter: letter } : {}) });
            visit(offset + 1);
            placements.pop();
            used.delete(tile.id);
          }
        };
        visit(0);
      }
    }
  }
  return result.sort((a, b) => a.word.localeCompare(b.word) || b.score - a.score);
}
