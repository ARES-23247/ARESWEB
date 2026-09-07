import { chooseHexAction, type HexDifficulty } from "./ai";
import type { HexState } from "./rules";

self.onmessage = (
  event: MessageEvent<{ game: HexState; difficulty: HexDifficulty }>,
) => {
  self.postMessage(chooseHexAction(event.data.game, event.data.difficulty));
};
