import { findBuzzleTwoLetterHints } from "./wordHelp";
import type { BuzzleBoard, BuzzlePlacement, BuzzleTile } from "./rules";

self.addEventListener("message", (event: MessageEvent<{
  board: BuzzleBoard; rack: BuzzleTile[]; draft: BuzzlePlacement[]; words: Set<string>; player: number;
}>) => {
  try {
    const { board, rack, draft, words, player } = event.data;
    self.postMessage({ hints: findBuzzleTwoLetterHints(board, rack, draft, words, player), error: null });
  } catch {
    self.postMessage({ hints: [], error: "Could not search this position. Try Help Mode again." });
  }
});
