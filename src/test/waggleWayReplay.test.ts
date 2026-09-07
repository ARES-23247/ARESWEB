import { describe, expect, it } from "vitest";
import { createBlankLevel, makeObject } from "@ares/waggle-way/level";
import { applyCommand, createRun, stepRun } from "@ares/waggle-way/engine";
import {
  captureReplay,
  createReplayPlayback,
  seekReplay,
  MAX_REPLAY_ACTIONS,
  MAX_REPLAY_TICKS,
  parseRunCommand,
  replayRun,
  validateReplay,
} from "@ares/waggle-way/replay";

const level = createBlankLevel();
const empty = captureReplay(level, createRun(level));

describe("bounded deterministic replays", () => {
  it("seeks forward and backward across every rules version without changing the live attempt", () => {
    for (const version of [1, 2, 3, 4, 5] as const) {
      const garden = createBlankLevel(version);
      let run = applyCommand(garden, createRun(garden), { type: "start" });
      const atZero = run;
      while (run.tick < 70) run = stepRun(garden, run);
      const atSeventy = run;
      while (run.phase !== "finished") run = stepRun(garden, run);
      const liveBefore = JSON.stringify(run);
      const recorded = captureReplay(garden, run);
      let playback = createReplayPlayback(garden, recorded);
      expect(playback.run).toEqual(atZero);
      playback = seekReplay(playback, 70);
      expect(playback.run).toEqual(atSeventy);
      const previous = playback;
      playback = seekReplay(playback, recorded.endTick);
      expect(playback.run).toEqual(run);
      expect(previous.run).toEqual(atSeventy);
      playback = seekReplay(playback, 0);
      expect(playback.run).toEqual(atZero);
      expect(seekReplay(playback, 0).run).toBe(playback.run);
      expect(JSON.stringify(run)).toBe(liveBefore);
      for (const tick of [-1, 0.5, recorded.endTick + 1, NaN])
        expect(() => seekReplay(playback, tick)).toThrow("out-of-range");
      // Playback owns its command and level copies, not the caller's mutable objects.
      garden.objects[0].x = 12;
      recorded.commands[0].command = { type: "finish" };
      expect(seekReplay(playback, 70).run).toEqual(atSeventy);
    }
  });
  it("reproduces setup, movement, adjustments, releases and explicit finish", () => {
    const garden = {
      ...level,
      rescueTarget: 7,
      objects: [
        ...level.objects,
        {
          ...makeObject("guide", "perch", 6, 7),
          permission: "movable" as const,
        },
      ],
    };
    let run = createRun(garden);
    for (const command of [
      { type: "move", objectId: "guide", x: 7, y: 7 },
      { type: "adjust", objectId: "guide", direction: 0, strength: 1 },
      { type: "assign", objectId: "guide" },
      { type: "start" },
    ] as const)
      run = applyCommand(garden, run, command);
    for (let tick = 0; tick < 500; tick++) run = stepRun(garden, run);
    run = applyCommand(garden, run, { type: "release", objectId: "guide" });
    run = applyCommand(garden, run, { type: "finish" });
    expect(replayRun(garden, captureReplay(garden, run))).toEqual(run);
    expect(replayRun(level, empty)).toEqual(createRun(level));
  });

  it.each([
    null,
    [],
    {},
    { type: "explode" },
    { type: "start", extra: true },
    { type: "assign", objectId: "!" },
    { type: "adjust", objectId: "fan", direction: 8, strength: 1 },
    { type: "move", objectId: "fan", x: -1, y: 0 },
  ])("rejects invalid commands %#", (command) => {
    expect(() => parseRunCommand(command)).toThrow();
  });

  it.each([
    null,
    [],
    {},
    { ...empty, version: 2 },
    { ...empty, rulesVersion: 999 },
    { ...empty, levelDefinition: "changed" },
    { ...empty, endTick: MAX_REPLAY_TICKS + 1 },
    { ...empty, commands: null },
    {
      ...empty,
      commands: Array(MAX_REPLAY_ACTIONS + 1).fill({
        tick: 0,
        command: { type: "start" },
      }),
    },
    {
      ...empty,
      endTick: 4,
      commands: [
        { tick: 3, command: { type: "start" } },
        { tick: 2, command: { type: "finish" } },
      ],
    },
  ])("rejects incompatible or unbounded payloads %#", (replay) => {
    expect(() => validateReplay(level, replay)).toThrow();
  });

  it("rejects legal command shapes that cannot execute in the recorded state", () => {
    expect(() =>
      replayRun(level, {
        ...empty,
        commands: [
          { tick: 0, command: { type: "release", objectId: "missing" } },
        ],
      }),
    ).toThrow("was rejected");
    expect(() => replayRun(level, { ...empty, endTick: 1 })).toThrow(
      "beyond an active attempt",
    );
    expect(() =>
      replayRun(level, {
        ...empty,
        endTick: 1,
        commands: [
          { tick: 0, command: { type: "start" } },
          { tick: 0, command: { type: "finish" } },
        ],
      }),
    ).toThrow("was rejected");
  });
});
