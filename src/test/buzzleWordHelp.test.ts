import { describe, expect, it } from "vitest";
import { BUZZLE_COORDINATES, analyzeBuzzlePlay, createBuzzleGame, getBuzzleCellIndex, type BuzzleTile, type BuzzleBoardTile, type BuzzlePlacement } from "@/lib/buzzle";
import { findBuzzleTwoLetterHints, twoLetterWords, wordsOnBuzzleBoard } from "@ares/buzzle/word-help";

const at = (q: number, r: number) => getBuzzleCellIndex(q, r)!;
const tile = (letter: string, id = letter): BuzzleTile => ({ id, letter, points: letter === '?' ? 0 : 1, blank: letter === '?' });
const empty = () => [...createBuzzleGame().board];
const placed = (letter: string): BuzzleBoardTile => ({ ...tile(letter), playedBy: 0 });

describe("BUZZLE word help", () => {
  it("derives only accepted two-letter spellings and complete board words", () => {
    expect(twoLetterWords(new Set(['at', 'aa', 'bee', 'x', 'AT', 'a1']))).toEqual(['aa', 'at']);
    const board = empty();
    board[at(0, 0)] = placed('A'); board[at(1, 0)] = placed('T'); board[at(0, 1)] = placed('N');
    const words = wordsOnBuzzleBoard(board, new Set(['at', 'an']));
    expect(words.map(({ word }) => word)).toEqual(['an', 'at']);
    expect(words.every(({ indices }) => indices.includes(at(0, 0)))).toBe(true);
    board[at(-8, 0)] = placed('A'); board[at(-7, 0)] = placed('T');
    expect(wordsOnBuzzleBoard(board, new Set(['at']))).toHaveLength(2);
    expect(wordsOnBuzzleBoard(board, new Set())).toEqual([]);
  });

  it("finds every center-covering opening across three axes without mutating state", () => {
    const board = empty(); const rack = [tile('A'), tile('T')];
    const before = JSON.stringify({ board, rack });
    const hints = findBuzzleTwoLetterHints(board, rack, [], new Set(['at']), 0);
    expect(hints).toHaveLength(6);
    expect(hints.every((hint) => hint.indices.includes(at(0, 0)) && hint.score === 4)).toBe(true);
    expect(JSON.stringify({ board, rack })).toBe(before);
  });

  it("respects fixed draft tile identities, repeated letters, and blank choices", () => {
    const board = empty(); const rack = [tile('A', 'a1'), tile('A', 'a2'), tile('?')];
    const draft = [{ index: at(1, 0), tile: rack[0] }];
    const hints = findBuzzleTwoLetterHints(board, rack, draft, new Set(['aa']), 0);
    expect(hints).toHaveLength(2);
    expect(hints.every(({ placements }) => placements.some(({ index, tile: t }) => index === at(1, 0) && t.id === 'a1'))).toBe(true);
    expect(hints.some(({ placements }) => placements.some(({ assignedLetter }) => assignedLetter === 'A'))).toBe(true);
    const blankDraft = [{ index: at(0, 0), tile: rack[2], assignedLetter: 'A' }];
    expect(findBuzzleTwoLetterHints(board, rack, blankDraft, new Set(['at']), 0)).toEqual([]);
    expect(findBuzzleTwoLetterHints(board, [tile('A')], [], new Set(['aa']), 0)).toEqual([]);
    expect(findBuzzleTwoLetterHints(board, rack, [...draft, ...draft, ...draft], new Set(['aa']), 0)).toEqual([]);
  });

  it("rejects invalid crossings and handles one-tile plays, board edges and longer boundaries", () => {
    const board = empty(); board[at(0, 0)] = placed('A'); board[at(1, 1)] = placed('X');
    const hints = findBuzzleTwoLetterHints(board, [tile('T')], [], new Set(['at']), 1);
    expect(hints.length).toBeGreaterThan(0);
    expect(hints.every(({ placements }) => placements.length === 1)).toBe(true);
    expect(hints.some(({ placements }) => placements[0].index === at(1, 0))).toBe(false);
    expect(hints.every(({ placements, score }) => analyzeBuzzlePlay(board, placements, new Set(['at']), 1).score === score)).toBe(true);
    const edge = empty(); edge[at(8, 0)] = placed('T');
    expect(findBuzzleTwoLetterHints(edge, [tile('A')], [], new Set(['at']), 0).length).toBeGreaterThan(0);
    edge[at(7, 0)] = placed('A');
    expect(findBuzzleTwoLetterHints(edge, [tile('A')], [], new Set(['at']), 0).some(({ indices }) => indices.join() === [at(6, 0), at(7, 0)].join())).toBe(false);
  });

  it("matches an independent exhaustive one-tile oracle, including longer crossing words", () => {
    const board = empty(); board[at(0, 0)] = placed('A'); board[at(1, 0)] = placed('T');
    const rack = [tile('A'), tile('T')];
    const words = new Set(['aa', 'at', 'ta', 'tt', 'aat', 'ata', 'att', 'tat', 'tta']);
    const expected = new Set<string>();
    for (let index = 0; index < BUZZLE_COORDINATES.length; index++) {
      if (board[index]) continue;
      for (const t of rack) {
        const placements: BuzzlePlacement[] = [{ index, tile: t }];
        try {
          const result = analyzeBuzzlePlay(board, placements, words);
          for (const word of result.words.filter(({ indices }) => indices.length === 2)) expected.add(`${word.word.toLowerCase()}:${index}:${t.id}`);
        } catch { /* Invalid candidates are absent from the oracle. */ }
      }
    }
    const actual = findBuzzleTwoLetterHints(board, rack, [], words, 0).filter(({ placements }) => placements.length === 1);
    expect(new Set(actual.map(({ word, placements }) => `${word}:${placements[0].index}:${placements[0].tile.id}`))).toEqual(expected);
  });
});
