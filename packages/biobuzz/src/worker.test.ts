import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Snapshot } from "./core/types";

let latest: Snapshot | undefined;
let messageCount = 0;
let failure = "";
const scope = {
  onmessage: null as ((event: MessageEvent) => void) | null,
  postMessage(message: { type: string; state?: Snapshot; message?: string }) {
    messageCount++;
    if (message.state) latest = message.state;
    if (message.message) failure = message.message;
  },
};
function send(data: object) { scope.onmessage!({ data } as MessageEvent); }
beforeEach(async () => {
  vi.resetModules();
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "performance"] });
  latest = undefined; messageCount = 0; failure = "";
  vi.stubGlobal("self", scope);
  await import("./worker");
});
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("BIOBUZZ worker snapshots", () => {
  it("publishes the real match's final score between snapshot intervals and stops repeating it", () => {
    send({ type: "start", config: { timed: true, seats: ["human", "standard", "standard", "standard"] } });
    vi.advanceTimersByTime(170000);
    expect(latest?.phase).toBe("finished");
    expect(latest!.tick % 3).not.toBe(0);
    expect(latest?.score.red.total).toBe(83);
    expect(latest?.score.blue.total).toBe(100);
    const delivered = messageCount;
    vi.advanceTimersByTime(1000);
    expect(messageCount).toBe(delivered);
  }, 20000);

  it("preserves pause, reset, input handling, and explicit invalid-configuration errors", () => {
    vi.advanceTimersByTime(32);
    expect(latest).toBeUndefined();
    send({ type: "start", config: { timed: false, seats: ["human", "empty", "empty", "empty"] } });
    const originalY = latest!.robots[0].y;
    send({ type: "input", id: 0, input: { x: 0, y: -1, turn: 0, intake: false, shoot: false, release: false, speed: 5.8 } });
    vi.advanceTimersByTime(200);
    expect(latest!.robots[0].y).toBeLessThan(originalY);
    send({ type: "pause", paused: true });
    const pausedTick = latest!.tick;
    vi.advanceTimersByTime(1000);
    expect(latest!.tick).toBe(pausedTick);
    send({ type: "pause", paused: false });
    vi.advanceTimersByTime(100);
    expect(latest!.tick).toBeGreaterThan(pausedTick);
    send({ type: "start", config: { timed: false, seats: ["human", "empty", "empty", "empty"] } });
    expect(latest!.tick).toBe(0);
    send({ type: "start", config: { timed: false, seats: [] } });
    expect(failure).toBe("Select four valid seats.");
  });
});
