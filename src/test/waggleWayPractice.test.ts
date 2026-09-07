import { describe, expect, it } from "vitest";
import { PRACTICE_GARDENS } from "../../packages/waggle-way/src/content/redesign";
import {
  applyCommand,
  createRun,
  populationCounts,
  stepRun,
  type RunCommand,
} from "@ares/waggle-way/engine";
import { captureReplay, replayRun } from "@ares/waggle-way/replay";
import { parseLevelFile, serializeLevel } from "@ares/waggle-way/level";

const place = (
  stockId: string,
  objectId: string,
  x: number,
  y: number,
): RunCommand => ({ type: "place", stockId, objectId, x, y });
const routes: { setup: RunCommand[]; release: string[] }[] = [
  { setup: [place("pointing-dancer", "guide", 10, 7)], release: ["guide"] },
  {
    setup: [
      place("left-dancer", "lower", 7, 7),
      place("right-dancer", "upper", 6, 3),
    ],
    release: ["lower", "upper"],
  },
  { setup: [place("reverse-dancer", "guide", 12, 5)], release: ["guide"] },
  { setup: [place("right-dancer", "guide", 7, 7)], release: ["guide"] },
  {
    setup: [
      place("pointing-dancer", "guide", 10, 7),
      place("leaf-cover", "cover", 6, 5),
    ],
    release: ["guide"],
  },
];

describe("pixel-art teaching slice", () => {
  it("Two Little Turns cannot meet its rescue target with either single dancer at any valid grid cell", () => {
    const level = PRACTICE_GARDENS[1];
    for (const stock of level.inventory!)
      for (let x = 0; x < level.width; x++)
        for (let y = 0; y < level.height; y++) {
          let run = applyCommand(
            level,
            createRun(level),
            place(stock.id, "solo", x, y),
          );
          if (!run.commands.length) continue;
          run = applyCommand(level, run, { type: "start" });
          while (
            run.tick < 800 &&
            populationCounts(run).hive + populationCounts(run).flying > 0
          )
            run = stepRun(level, run);
          run = applyCommand(level, run, { type: "release", objectId: "solo" });
          while (run.tick < 1200 && run.phase !== "finished")
            run = stepRun(level, run);
          expect(run.won, `${stock.id} alone at ${x},${y}`).toBe(false);
        }
  });
  it.each(
    PRACTICE_GARDENS.map((level, index) => ({
      level,
      index,
      title: level.title,
    })),
  )(
    "$title has a builder-round-tripped all-bees solution and identical replay",
    ({ level, index }) => {
      const imported = parseLevelFile(serializeLevel(level));
      expect(imported).toEqual(level);
      let run = createRun(imported);
      for (const action of routes[index].setup) {
        const count = run.commands.length;
        run = applyCommand(imported, run, action);
        expect(run.commands).toHaveLength(count + 1);
      }
      run = applyCommand(imported, run, { type: "start" });
      for (const helper of routes[index].release) {
        const target = level.population - populationCounts(run).assigned;
        while (
          run.tick < 1600 &&
          run.phase !== "finished" &&
          populationCounts(run).rescued < target
        )
          run = stepRun(imported, run);
        expect(
          populationCounts(run),
          `${level.title} before releasing ${helper} at ${run.tick}`,
        ).toMatchObject({ rescued: target, lost: 0 });
        run = applyCommand(imported, run, {
          type: "release",
          objectId: helper,
        });
      }
      while (run.tick < 1800 && run.phase !== "finished")
        run = stepRun(imported, run);
      expect(populationCounts(run)).toEqual({
        hive: 0,
        flying: 0,
        assigned: 0,
        waiting: 0,
        rescued: level.population,
        lost: 0,
      });
      expect(run.won).toBe(true);
      expect(replayRun(imported, captureReplay(imported, run))).toEqual(run);
    },
  );

  it("the spray crossing loses bees without its cover despite ordinary water being safe", () => {
    const level = PRACTICE_GARDENS[4];
    let run = applyCommand(level, createRun(level), routes[4].setup[0]);
    run = applyCommand(level, run, { type: "start" });
    while (run.tick < 600 && run.phase !== "finished")
      run = stepRun(level, run);
    expect(
      run.bees.filter((bee) => bee.lossReason === "rain").length,
    ).toBeGreaterThan(0);
  });
});
