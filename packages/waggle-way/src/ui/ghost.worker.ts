import { populationCounts, pollenCounts, type RunState } from "../core/engine";
import {
  createReplayPlayback,
  seekReplay,
  type ReplayPlayback,
  type RunReplay,
} from "../core/replay";
import type { LevelDefinition } from "../core/level";

export interface GhostFrame {
  tick: number;
  endTick: number;
  bees: RunState["bees"];
  counts: ReturnType<typeof populationCounts>;
  pollen: ReturnType<typeof pollenCounts>;
}
export interface GhostResponse {
  requestedTick: number;
  frame: GhostFrame | null;
  error: string;
  pending?: boolean;
}
let playback: ReplayPlayback | undefined;
// Only local command recordings enter here. Replay validation still enforces
// exact revision identity, action shape/order, and tick/action bounds.
self.onmessage = (
  event: MessageEvent<{
    tick: number;
    level?: LevelDefinition;
    replay?: RunReplay;
  }>,
) => {
  try {
    const { tick, level, replay } = event.data;
    if (level && replay) playback = createReplayPlayback(level, replay);
    if (!playback || !Number.isSafeInteger(tick) || tick < 0)
      throw new Error("Invalid ghost request");
    const target = Math.min(tick, playback.replay.endTick);
    if (target < playback.run.tick) playback = seekReplay(playback, 0);
    // Yield between short chunks so a new scrub target can replace a long seek.
    playback = seekReplay(playback, Math.min(target, playback.run.tick + 120));
    if (playback.run.tick < target) {
      self.postMessage({
        requestedTick: tick,
        frame: null,
        error: "",
        pending: true,
      } satisfies GhostResponse);
      return;
    }
    self.postMessage({
      requestedTick: tick,
      error: "",
      frame: {
        tick: playback.run.tick,
        endTick: playback.replay.endTick,
        bees: playback.run.bees,
        counts: populationCounts(playback.run),
        pollen: pollenCounts(playback.run),
      },
    } satisfies GhostResponse);
  } catch {
    self.postMessage({
      requestedTick: event.data.tick,
      frame: null,
      error:
        "The previous attempt could not be replayed. You can continue playing.",
    } satisfies GhostResponse);
  }
};
