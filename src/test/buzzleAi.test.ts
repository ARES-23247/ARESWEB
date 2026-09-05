import { describe, expect, it } from "vitest";
import { createBuzzleGame, type BuzzleTile } from "@/lib/buzzle";
import { selectBuzzleAiMove } from "@/lib/buzzleAi";
import { BuzzleTrie } from "@ares/buzzle/dictionary";

function tile(letter: string, points: number, id = letter): BuzzleTile {
  return { id, letter, points, blank: false };
}

describe("BUZZLE AI", () => {
  it("uses the trie to find a legal opening word through the star", () => {
    const game = createBuzzleGame(2, () => 0);
    game.players[0].rack = [tile("C", 3), tile("A", 1), tile("T", 1)];
    const trie = new BuzzleTrie();
    trie.insert("cat");
    const move = selectBuzzleAiMove(
      game,
      { words: new Set(["cat"]), trie },
      "master",
      { now: () => 0, random: () => 0.5 },
    );
    expect(move).not.toBeNull();
    expect(move?.analysis.words.map(({ word }) => word)).toContain("CAT");
    expect(move?.placements).toHaveLength(3);
  });

  it("returns no move for a finished game", () => {
    const game = { ...createBuzzleGame(2), finished: true };
    const trie = new BuzzleTrie();
    expect(selectBuzzleAiMove(game, { words: new Set(), trie }, "easy")).toBeNull();
  });
});
