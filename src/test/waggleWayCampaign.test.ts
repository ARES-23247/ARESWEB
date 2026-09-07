import { describe, expect, it } from "vitest";
import { CAMPAIGN } from "@ares/waggle-way/campaign";
import { CAMPAIGN_SOLUTIONS } from "../../packages/waggle-way/src/content/solutions";
import {
  applyCommand,
  createRun,
  populationCounts,
  pollenCounts,
  stepRun,
} from "@ares/waggle-way/engine";
import { captureReplay, replayRun } from "@ares/waggle-way/replay";
import { parseLevelFile, serializeLevel } from "@ares/waggle-way/level";

describe("builder-authored campaign solutions", () => {
  it("exports distinct validated levels with truthful teaching content", () => {
    expect(CAMPAIGN).toHaveLength(30);
    expect(new Set(CAMPAIGN.map((puzzle) => puzzle.level.id)).size).toBe(30);
    const gardens = new Set(CAMPAIGN.map((puzzle) => puzzle.garden));
    expect(gardens.size).toBe(5);
    for (const garden of gardens)
      expect(
        CAMPAIGN.filter((puzzle) => puzzle.garden === garden),
      ).toHaveLength(6);
    for (const puzzle of CAMPAIGN) {
      expect(parseLevelFile(serializeLevel(puzzle.level))).toEqual(
        puzzle.level,
      );
      expect(puzzle.level.instructions).not.toBe("");
      expect(puzzle.hints.length).toBeGreaterThan(0);
      const solutions = CAMPAIGN_SOLUTIONS.filter(
        (solution) => solution.levelId === puzzle.level.id,
      );
      expect(solutions.length).toBeGreaterThan(0);
      if (puzzle.level.objectives) {
        expect(
          solutions.some(
            (solution) =>
              (solution.minimumPollen ?? 0) >= puzzle.level.objectives!.pollen,
          ),
        ).toBe(true);
        const maximum = puzzle.level.objectives.maxTools;
        if (maximum !== undefined)
          expect(
            solutions.some(
              (solution) =>
                solution.maximumTools !== undefined &&
                solution.maximumTools <= maximum,
            ),
          ).toBe(true);
      }
    }
  });

  it.each(CAMPAIGN_SOLUTIONS)(
    "$levelId: $name saves every bee and replays identically",
    (solution) => {
      const level = CAMPAIGN.find(
        (puzzle) => puzzle.level.id === solution.levelId,
      )!.level;
      let run = createRun(level);
      let cursor = 0;
      for (let tick = 0; tick < 1800 && run.phase !== "finished"; tick++) {
        while (solution.actions[cursor]?.tick === run.tick) {
          const action = solution.actions[cursor++];
          const next = applyCommand(level, run, action.command);
          expect(next.commands.length, next.notice).toBe(
            run.commands.length + 1,
          );
          run = next;
        }
        run = stepRun(level, run);
      }
      expect(populationCounts(run), JSON.stringify(run.bees)).toMatchObject({
        rescued: solution.minimumRescued,
        lost: 0,
        assigned: 0,
      });
      if (solution.minimumPollen !== undefined)
        expect(pollenCounts(run).delivered).toBeGreaterThanOrEqual(
          solution.minimumPollen,
        );
      if (solution.maximumTools !== undefined)
        expect(run.peakToolsPlaced).toBeLessThanOrEqual(solution.maximumTools);
      expect(cursor).toBe(solution.actions.length);
      expect(run.phase).toBe("finished");
      const replay = captureReplay(level, run);
      expect(replayRun(level, replay)).toEqual(run);
    },
  );
  it("new garden hazards require a deliberate solution", () => {
    for (const puzzle of CAMPAIGN.slice(5)) {
      let run = applyCommand(puzzle.level, createRun(puzzle.level), {
        type: "start",
      });
      for (let tick = 0; tick < 1800; tick++) run = stepRun(puzzle.level, run);
      expect(run.won, puzzle.level.title).toBe(false);
    }
  });
});
