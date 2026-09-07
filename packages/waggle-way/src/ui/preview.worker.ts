import { previewRoute, type RunState } from "../core/engine";
import type { LevelDefinition } from "../core/level";

// This worker receives bounded state from the local game, never imported file bodies.
self.onmessage = (
  event: MessageEvent<{ level: LevelDefinition; run: RunState; beeId: number }>,
) => {
  try {
    const { level, run, beeId } = event.data;
    self.postMessage({ route: previewRoute(level, run, beeId), error: null });
  } catch {
    self.postMessage({
      route: [],
      error:
        "The route preview could not be calculated. You can continue playing.",
    });
  }
};
