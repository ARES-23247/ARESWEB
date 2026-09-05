import {
  BUZZLE_COORDINATES,
  BUZZLE_RACK_SIZE,
  analyzeBuzzlePlay,
  getBuzzleMultiplier,
  type BuzzleDifficulty,
  type BuzzleGameState,
  type BuzzlePlacement,
  type BuzzlePlayAnalysis,
  type BuzzleTile,
} from "./rules";
import type { BuzzleDictionary, BuzzleTrieNode } from "./dictionary";

export interface BuzzleAiMove {
  placements: BuzzlePlacement[];
  analysis: BuzzlePlayAnalysis;
}

interface SearchOptions {
  now?: () => number;
  random?: () => number;
  timeBudgetMs?: number;
}

const BOARD_LINES: ReadonlyArray<ReadonlyArray<number>> = (() => {
  const lines: number[][] = [];
  for (let axis = 0; axis < 3; axis += 1) {
    const groups = new Map<number, number[]>();
    BUZZLE_COORDINATES.forEach(({ q, r }, index) => {
      const invariant = axis === 0 ? r : axis === 1 ? q : q + r;
      const group = groups.get(invariant) ?? [];
      group.push(index);
      groups.set(invariant, group);
    });
    for (const group of groups.values()) {
      group.sort((left, right) => {
        const a = BUZZLE_COORDINATES[left];
        const b = BUZZLE_COORDINATES[right];
        return axis === 1 ? a.r - b.r : a.q - b.q;
      });
      lines.push(group);
    }
  }
  return lines;
})();

function difficultyBudget(difficulty: BuzzleDifficulty): number {
  return difficulty === "easy" ? 180 : difficulty === "medium" ? 700 : 2_500;
}

function moveValue(move: BuzzleAiMove, difficulty: BuzzleDifficulty): number {
  if (difficulty === "easy") return move.analysis.score;
  const multiplierCells = move.placements.filter(({ index }) => getBuzzleMultiplier(index) !== "plain").length;
  return move.analysis.score + (difficulty === "medium" ? multiplierCells * 2 : multiplierCells);
}

function chooseTileChoices(rack: ReadonlyArray<BuzzleTile>): Map<string, BuzzleTile[]> {
  const choices = new Map<string, BuzzleTile[]>();
  for (const tile of rack) {
    const key = tile.blank ? "?" : tile.letter.toLowerCase();
    const group = choices.get(key) ?? [];
    group.push(tile);
    choices.set(key, group);
  }
  return choices;
}

export function selectBuzzleAiMove(
  state: BuzzleGameState,
  dictionary: BuzzleDictionary,
  difficulty: BuzzleDifficulty,
  options: SearchOptions = {},
): BuzzleAiMove | null {
  if (state.finished) return null;
  const now = options.now ?? performance.now.bind(performance);
  const random = options.random ?? Math.random;
  const deadline = now() + (options.timeBudgetMs ?? difficultyBudget(difficulty));
  const rack = state.players[state.currentPlayer].rack;
  const rackChoices = chooseTileChoices(rack);
  const boardIsEmpty = state.board.every((tile) => tile === null);
  const centerIndex = BUZZLE_COORDINATES.findIndex(({ q, r }) => q === 0 && r === 0);
  let best: BuzzleAiMove | null = null;
  let bestValue = Number.NEGATIVE_INFINITY;
  let tied = 0;

  outer: for (const line of BOARD_LINES) {
    for (let start = 0; start < line.length; start += 1) {
      for (let end = start + 1; end < line.length; end += 1) {
        if (now() >= deadline) break outer;
        const span = line.slice(start, end + 1);
        if (span.length > 13 || (difficulty === "easy" && span.length > 4) || (difficulty === "medium" && span.length > 6)) continue;
        if (boardIsEmpty && !span.includes(centerIndex)) continue;
        if (start > 0 && state.board[line[start - 1]]) continue;
        if (end + 1 < line.length && state.board[line[end + 1]]) continue;
        const emptyCount = span.filter((index) => !state.board[index]).length;
        if (emptyCount < 1 || emptyCount > BUZZLE_RACK_SIZE) continue;

        const placements: BuzzlePlacement[] = [];
        const remaining = new Map(
          [...rackChoices].map(([letter, tiles]) => [letter, [...tiles]]),
        );

        const visit = (offset: number, node: BuzzleTrieNode) => {
          if (now() >= deadline) return;
          if (offset === span.length) {
            if (!node.terminal || placements.length === 0) return;
            try {
              const analysis = analyzeBuzzlePlay(
                state.board,
                placements,
                dictionary.words,
                state.currentPlayer,
              );
              if (difficulty === "easy" && analysis.score > 15) return;
              const move = { placements: placements.map((placement) => ({ ...placement })), analysis };
              const value = moveValue(move, difficulty);
              if (value > bestValue) {
                best = move;
                bestValue = value;
                tied = 1;
              } else if (value === bestValue) {
                tied += 1;
                if (random() < 1 / tied) best = move;
              }
            } catch {
              // Cross words and connectivity are authoritative in the engine.
            }
            return;
          }
          const index = span[offset];
          const fixed = state.board[index];
          if (fixed) {
            const child = node.children.get(fixed.letter.toLowerCase());
            if (child) visit(offset + 1, child);
            return;
          }
          for (const [letter, child] of node.children) {
            const exact = remaining.get(letter);
            const blank = remaining.get("?");
            const tile = exact?.at(-1) ?? blank?.at(-1);
            if (!tile) continue;
            const group = tile.blank ? blank! : exact!;
            group.pop();
            placements.push({ index, tile, ...(tile.blank ? { assignedLetter: letter.toUpperCase() } : {}) });
            visit(offset + 1, child);
            placements.pop();
            group.push(tile);
          }
        };
        visit(0, dictionary.trie.root);
      }
    }
  }
  return best;
}
