import {
  selectBuzzelloAiMove,
  type BuzzelloBoard,
  type BuzzelloDifficulty,
  type BuzzelloPlayer,
} from "@/lib/buzzello";

interface BuzzelloAiRequest {
  requestId: number;
  board: BuzzelloBoard;
  player: BuzzelloPlayer;
  difficulty: BuzzelloDifficulty;
}

interface BuzzelloAiResponse {
  requestId: number;
  moveIndex: number | null;
}

self.addEventListener("message", (event: MessageEvent<BuzzelloAiRequest>) => {
  const { requestId, board, player, difficulty } = event.data;
  const move = selectBuzzelloAiMove(board, player, difficulty);
  const response: BuzzelloAiResponse = {
    requestId,
    moveIndex: move?.index ?? null,
  };
  self.postMessage(response);
});

export {};
