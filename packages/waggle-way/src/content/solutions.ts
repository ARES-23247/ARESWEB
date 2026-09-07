import { WILDFLOWER_SOLUTIONS } from "./wildflower";
import { GLASSHOUSE_SOLUTIONS } from "./glasshouse";
import { RAINY_SOLUTIONS } from "./rainy";
import type { RecordedCommand } from "../core/engine";
import type { Direction } from "../core/level";

export interface CampaignSolution {
  levelId: string;
  name: string;
  actions: RecordedCommand[];
  minimumRescued: number;
  minimumPollen?: number;
  maximumTools?: number;
}
const turn = (
  objectId: string,
  direction: Direction,
  strength = 1,
): RecordedCommand => ({
  tick: 0,
  command: { type: "adjust", objectId, direction, strength },
});
const assign = (objectId: string): RecordedCommand => ({
  tick: 0,
  command: { type: "assign", objectId },
});
const start: RecordedCommand = { tick: 0, command: { type: "start" } };
const release = (objectId: string, tick: number): RecordedCommand => ({
  tick,
  command: { type: "release", objectId },
});
const place = (
  stockId: string,
  objectId: string,
  x: number,
  y: number,
): RecordedCommand => ({
  tick: 0,
  command: { type: "place", stockId, objectId, x, y },
});

/** Original authored solutions. Test imports only; campaign play never applies them automatically. */
export const CAMPAIGN_SOLUTIONS: readonly CampaignSolution[] = [
  ...GLASSHOUSE_SOLUTIONS,
  ...RAINY_SOLUTIONS,
  ...WILDFLOWER_SOLUTIONS,
  {
    levelId: "sunny-06",
    name: "Place the upper turn",
    minimumRescued: 6,
    actions: [
      place("guides", "placed-1", 17, 2),
      turn("fan-1", 6, 2),
      turn("perch-1", 6),
      assign("perch-1"),
      assign("placed-1"),
      start,
      release("perch-1", 600),
      release("placed-1", 900),
    ],
  },
  {
    levelId: "meadow-07",
    name: "Shelter the straight crossing",
    minimumRescued: 6,
    actions: [place("leaves", "placed-1", 7, 8), start],
  },
  {
    levelId: "meadow-08",
    name: "Balanced counterwind",
    minimumRescued: 6,
    actions: [place("fans", "placed-1", 9, 12), turn("placed-1", 6, 2), start],
  },
  {
    levelId: "meadow-09",
    name: "End the lift",
    minimumRescued: 6,
    actions: [place("leaves", "placed-1", 5, 7), start],
  },
  {
    levelId: "meadow-10",
    name: "Above the headwind",
    minimumRescued: 6,
    actions: [
      place("guides", "placed-1", 5, 8),
      place("guides", "placed-2", 5, 2),
      turn("placed-1", 6),
      assign("placed-1"),
      assign("placed-2"),
      start,
      release("placed-1", 600),
      release("placed-2", 1000),
    ],
  },
  {
    levelId: "meadow-11",
    name: "Shorten the stronger stream",
    minimumRescued: 6,
    actions: [place("leaves", "placed-1", 7, 9), start],
  },
  {
    levelId: "meadow-12",
    name: "Sheltered helpers",
    minimumRescued: 6,
    actions: [
      place("leaves", "placed-1", 12, 5),
      place("vertical-leaf", "placed-2", 18, 3),
      place("guides", "placed-3", 17, 1),
      turn("perch-1", 6),
      assign("perch-1"),
      assign("placed-3"),
      start,
      release("perch-1", 700),
      release("placed-3", 1100),
    ],
  },
  {
    levelId: "sunny-01",
    name: "Upward dance",
    minimumRescued: 6,
    actions: [
      turn("perch-1", 6),
      assign("perch-1"),
      start,
      release("perch-1", 350),
    ],
  },
  {
    levelId: "sunny-02",
    name: "Lift and turn",
    minimumRescued: 6,
    actions: [
      turn("fan-1", 6, 2),
      turn("perch-1", 6),
      assign("perch-1"),
      start,
      release("perch-1", 480),
    ],
  },
  {
    levelId: "sunny-03",
    name: "Measured lift",
    minimumRescued: 6,
    actions: [
      turn("fan-1", 6, 2),
      turn("perch-1", 6),
      assign("perch-1"),
      start,
      release("perch-1", 480),
    ],
  },
  {
    levelId: "sunny-04",
    name: "Lower helper first",
    minimumRescued: 6,
    actions: [
      turn("perch-1", 6),
      turn("perch-2", 0),
      assign("perch-1"),
      assign("perch-2"),
      start,
      release("perch-1", 450),
      release("perch-2", 800),
    ],
  },
  {
    levelId: "sunny-05",
    name: "High road",
    minimumRescued: 6,
    actions: [
      turn("perch-1", 6),
      turn("perch-2", 0),
      assign("perch-1"),
      assign("perch-2"),
      start,
      release("perch-1", 450),
      release("perch-2", 800),
    ],
  },
  {
    levelId: "sunny-05",
    name: "Low road",
    minimumRescued: 6,
    actions: [
      turn("perch-1", 2),
      turn("perch-3", 0),
      assign("perch-1"),
      assign("perch-3"),
      start,
      release("perch-1", 450),
      release("perch-3", 800),
    ],
  },
];
