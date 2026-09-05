import { findBuzzleTwoLetterHints } from "@/lib/buzzleWordHelp";
import type { BuzzleBoard, BuzzlePlacement, BuzzleTile } from "@/lib/buzzle";

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
