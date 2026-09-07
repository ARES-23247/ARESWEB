import { describe, expect, it } from "vitest";
import { CAMPAIGN } from "../../../../packages/waggle-way/src/content/campaign";
import { CAMPAIGN_SOLUTIONS } from "../../../../packages/waggle-way/src/content/solutions";
import {
  createBlankLevel,
  makeObject,
  validateLevel,
} from "../../generated/games/waggle-way/level";
import {
  applyCommand,
  createRun,
  stepRun,
  type RecordedCommand,
} from "../../generated/games/waggle-way/engine";
import {
  captureReplay,
  type RunReplay,
} from "../../generated/games/waggle-way/replay";
import {
  evaluateWaggleProof,
  WAGGLE_SUBMISSION_BYTES,
  WaggleVerificationSchema,
} from "../waggleProof";

function record(
  level: ReturnType<typeof createBlankLevel>,
  actions: readonly RecordedCommand[] = [
    { tick: 0, command: { type: "start" } },
  ],
): RunReplay {
  let run = createRun(level);
  let cursor = 0;
  while (run.phase !== "finished" && run.tick < 1800) {
    while (actions[cursor]?.tick === run.tick) {
      const next = applyCommand(level, run, actions[cursor++].command);
      expect(next.commands.length, next.notice).toBe(run.commands.length + 1);
      run = next;
    }
    run = stepRun(level, run);
  }
  expect(cursor).toBe(actions.length);
  return captureReplay(level, run);
}
describe("server Waggle Way completion evidence", () => {
  it.each(CAMPAIGN)(
    "verifies all advertised goals for $level.title with the canonical engine",
    ({ level }) => {
      const proofs = CAMPAIGN_SOLUTIONS.filter(
        (solution) => solution.levelId === level.id,
      ).map((solution) => record(level, solution.actions));
      const result = evaluateWaggleProof(
        JSON.stringify({ level, replays: proofs }),
      );
      expect(result.bestRescued).toBe(level.population);
      expect(result.allBeesProven).toBe(true);
      expect(result.rulesVersion).toBe(level.rulesVersion);
      expect(result.bestPollen).toBeGreaterThanOrEqual(
        level.objectives?.pollen ?? 0,
      );
      if (level.objectives?.maxTools !== undefined)
        expect(result.fewestTools).toBeLessThanOrEqual(
          level.objectives.maxTools,
        );
      expect(WaggleVerificationSchema.parse(result)).toEqual(result);
    },
  );

  it("accepts separate successful pollen and tool witnesses and binds changes to a new identity", () => {
    const base = CAMPAIGN.find((puzzle) => puzzle.number === 28)!.level;
    const level = validateLevel({
      ...base,
      inventory: [
        {
          id: "fan",
          kind: "fan",
          count: 1,
          width: 1,
          height: 1,
          direction: 0,
          range: 1,
          strength: 1,
        },
      ],
      objectives: { pollen: 1, maxTools: 0 },
    });
    const [direct, detour] = CAMPAIGN_SOLUTIONS.filter(
      (solution) => solution.levelId === base.id,
    );
    const zeroTools = record(level, direct.actions);
    const pollen = record(level, [
      {
        tick: 0,
        command: {
          type: "place",
          stockId: "fan",
          objectId: "placed",
          x: 0,
          y: 0,
        },
      },
      ...detour.actions,
    ]);
    expect(() =>
      evaluateWaggleProof(JSON.stringify({ level, replays: [zeroTools] })),
    ).toThrow("pollen");
    expect(() =>
      evaluateWaggleProof(JSON.stringify({ level, replays: [pollen] })),
    ).toThrow("tool goal");
    const result = evaluateWaggleProof(
      JSON.stringify({ level, replays: [zeroTools, pollen] }),
    );
    expect(result).toMatchObject({
      bestPollen: 1,
      fewestTools: 0,
      allBeesProven: true,
    });
    expect(
      result.witnesses.map((proof) => [proof.pollenDelivered, proof.peakTools]),
    ).toEqual([
      [0, 0],
      [1, 1],
    ]);
    const noPollenGoal = { ...level, objectives: { pollen: 0, maxTools: 0 } };
    const revised = evaluateWaggleProof(
      JSON.stringify({
        level: noPollenGoal,
        replays: [record(noPollenGoal, direct.actions)],
      }),
    );
    expect(revised.contentHash).not.toBe(result.contentHash);
    expect(revised.bindingHash).not.toBe(result.bindingHash);
    expect(() =>
      evaluateWaggleProof(
        JSON.stringify({ level: noPollenGoal, replays: [zeroTools] }),
      ),
    ).toThrow("revision");
  });

  it("rejects forged, oversized, unsupported, duplicate and incomplete submissions", () => {
    const level = createBlankLevel();
    const replay = record(level);
    for (const payload of [
      "{",
      "null",
      "[]",
      JSON.stringify({ level, replays: [] }),
      JSON.stringify({ level, replays: [replay], success: true }),
      JSON.stringify({ level, replays: [replay, replay, replay, replay] }),
    ])
      expect(() => evaluateWaggleProof(payload)).toThrow("one to three");
    expect(() =>
      evaluateWaggleProof(" ".repeat(WAGGLE_SUBMISSION_BYTES + 1)),
    ).toThrow("768 KiB");
    expect(() =>
      evaluateWaggleProof(
        JSON.stringify({
          level: { ...level, rulesVersion: 99 },
          replays: [replay],
        }),
      ),
    ).toThrow("supported");
    for (const bad of [
      { ...replay, won: true },
      { ...replay, endTick: 54001 },
      {
        ...replay,
        commands: [
          { tick: 0, command: { type: "release", objectId: "missing" } },
        ],
      },
      { ...replay, rulesVersion: 4 },
    ])
      expect(() =>
        evaluateWaggleProof(JSON.stringify({ level, replays: [bad] })),
      ).toThrow("cannot be replayed");
    expect(() =>
      evaluateWaggleProof(JSON.stringify({ level, replays: [replay, replay] })),
    ).toThrow("cannot be replayed");
    expect(() =>
      evaluateWaggleProof(
        JSON.stringify({
          level,
          replays: [captureReplay(level, createRun(level))],
        }),
      ),
    ).toThrow("rescue target");
    const pond = validateLevel({
      ...level,
      objects: [...level.objects, makeObject("pond", "water", 4, 7)],
    });
    expect(() =>
      evaluateWaggleProof(
        JSON.stringify({ level: pond, replays: [record(pond)] }),
      ),
    ).toThrow("rescue target");
  });
});
