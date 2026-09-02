import { selectBuzzleAiMove } from "@/lib/buzzleAi";
import { loadBuzzleDictionary } from "@/lib/buzzleDictionary";
import type { BuzzleDifficulty, BuzzleGameState } from "@/lib/buzzle";

interface AiRequest {
  requestId: number;
  state: BuzzleGameState;
  difficulty: BuzzleDifficulty;
}

self.addEventListener("message", async (event: MessageEvent<AiRequest>) => {
  const { requestId, state, difficulty } = event.data;
  try {
    const dictionary = await loadBuzzleDictionary();
    const move = selectBuzzleAiMove(state, dictionary, difficulty);
    self.postMessage({ requestId, move, error: null });
  } catch {
    self.postMessage({ requestId, move: null, error: "The BUZZLE AI could not load its dictionary." });
  }
});
