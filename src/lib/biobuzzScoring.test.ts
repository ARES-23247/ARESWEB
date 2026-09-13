import { describe, expect, it } from "vitest";
import { emptyMatch, scoreMatch, scoreFlower, validateMatch, validThresholds, STANDARD_THRESHOLDS, type Element } from "./biobuzzScoring";

describe("BIOBUZZ V1 scoring", () => {
  it("starts with zero match points and a qualification tie", () => {
    const match = emptyMatch();
    expect(scoreMatch(match).red).toMatchObject({ total: 0, totalRP: 1, auto: 0, teleop: 0 });
    match.red.leave = 2;
    expect(match.blue.leave).toBe(0);
  });
  it("adds independent AUTO and TELEOP parking and counts only additional TELEOP tips", () => {
    const match = emptyMatch();
    match.red = { leave: 2, autoPark: 2, autoTips: 2, teleopTips: 5, cell: 3, garden: 4, teleopPark: 2, minorFouls: 0, majorFouls: 0 };
    // AUTO 6+10+40=56; TELEOP 100+6+4+10=120.
    expect(scoreMatch(match).red).toMatchObject({ auto: 56, teleop: 120, total: 176, movement: 26, tips: 7, totalRP: 6 });
  });
  it.each([
    [[], null, null, 0],
    [["pollen", "pollen"], null, null, 0],
    [["red"], "red", "red", 2],
    [["pollen", "red", "pollen", "blue", "pollen"], "blue", "red", 10],
    [["blue", "red"], "red", "blue", 4],
  ])("scores bottom and top NECTAR independently: %j", (stack, owner, bottom, points) => {
    expect(scoreFlower(stack as Element[])).toEqual({ owner, bottom, points });
  });
  it("transfers all FLOWER elements on an ownership change while preserving the bottom bonus", () => {
    const match = emptyMatch();
    match.flowers[0] = ["red", "pollen"];
    expect(scoreMatch(match).red.total).toBe(9);
    match.flowers[0].push("blue");
    const score = scoreMatch(match);
    expect(score.red).toMatchObject({ total: 5, flowerBonus: 5, flowerElements: 0 });
    expect(score.blue).toMatchObject({ total: 6, flowerBonus: 0, flowerElements: 6 });
    expect(score.winner).toBe("blue");
  });
  it("credits fouls to the opponent and includes those points in the outcome", () => {
    const match = emptyMatch();
    match.red.autoTips = 1;
    match.red.minorFouls = 1;
    match.red.majorFouls = 1;
    match.blue.minorFouls = 2;
    expect(scoreMatch(match)).toMatchObject({ winner: "red", red: { total: 30, penalties: 10, resultRP: 3 }, blue: { total: 25, penalties: 25, resultRP: 0 } });
    match.blue.minorFouls = 1;
    expect(scoreMatch(match)).toMatchObject({ winner: "tie", red: { resultRP: 1 }, blue: { resultRP: 1 } });
  });
  it.each([ [3, false, false], [4, true, false], [6, true, false], [7, true, true] ])("checks inclusive tip boundaries at %i", (tips, pollinator1, pollinator2) => {
    const match = emptyMatch();
    match.red.autoTips = 1;
    match.red.teleopTips = Number(tips) - 1;
    expect(scoreMatch(match).red.achievements).toMatchObject({ pollinator1, pollinator2 });
  });
  it("earns SWARM at 16 movement points and never from fouls", () => {
    const match = emptyMatch();
    match.red.autoPark = 2;
    match.red.teleopPark = 1;
    match.blue.majorFouls = 3;
    expect(scoreMatch(match).red.achievements?.swarm).toBe(false);
    match.red.teleopPark = 0;
    match.red.leave = 2;
    expect(scoreMatch(match).red.achievements?.swarm).toBe(true);
  });
  it("keeps match points and result RP available when championship thresholds are unknown", () => {
    const match = emptyMatch();
    match.red.autoTips = 10;
    expect(scoreMatch(match, null).red).toMatchObject({ total: 200, achievements: null, totalRP: null, resultRP: 3 });
    expect(scoreMatch(match, { swarm: 26, pollinator1: 11, pollinator2: 12 }).red.bonusRP).toBe(0);
  });
  it.each([-1, 0.5, NaN, Infinity, 3])("rejects invalid robot counts: %s", value => {
    const match = emptyMatch();
    match.red.leave = value;
    expect(validateMatch(match).length).toBeGreaterThan(0);
    expect(() => scoreMatch(match)).toThrow(RangeError);
  });
  it("rejects impossible element inventory and malformed flowers", () => {
    const match = emptyMatch();
    match.flowers = [Array<Element>(41).fill("pollen"), Array<Element>(9).fill("red"), Array<Element>(9).fill("blue")];
    expect(validateMatch(match)).toEqual(expect.arrayContaining([
      "Enter exactly four FLOWERS.", "There are only 40 POLLEN in a V1 match.", "There are only 8 red NECTAR in a V1 match.", "There are only 8 blue NECTAR in a V1 match.", "Only 56 scoring elements are available. Count each element in just one final location.",
    ]));
    match.flowers = [["invalid" as Element], [], [], []];
    expect(validateMatch(match)).toContain("Unknown FLOWER element.");
  });
  it("identifies invalid blue counts and enforces the input bound for tips", () => {
    const match = emptyMatch();
    match.blue.autoTips = 10000;
    expect(validateMatch(match)).toContain("Blue: AUTO HIVE tips needs a whole number from 0 to 9999.");
  });
  it("allows the full inventory across final locations and prevents double-counting", () => {
    const match = emptyMatch();
    match.red.cell = 20;
    match.blue.cell = 20;
    match.red.garden = 8;
    match.blue.garden = 8;
    expect(validateMatch(match)).toEqual([]);
    match.flowers[0].push("red");
    expect(validateMatch(match)).toHaveLength(1);
  });
  it("validates positive ordered custom thresholds", () => {
    expect(validThresholds(STANDARD_THRESHOLDS)).toBe(true);
    for (const thresholds of [{ swarm: 0, pollinator1: 4, pollinator2: 7 }, { swarm: NaN, pollinator1: 4, pollinator2: 7 }, { swarm: 16, pollinator1: 8, pollinator2: 7 }]) {
      expect(validThresholds(thresholds)).toBe(false);
      expect(() => scoreMatch(emptyMatch(), thresholds)).toThrow("Invalid RP thresholds.");
    }
  });
});
