import { begin, exported, piece } from "./authoring";
import { editLevel, updateObject } from "../core/editor";
import type { ToolStock } from "../core/level";

const left: ToolStock = {
  id: "left-dancer",
  kind: "dancer",
  dance: "left",
  count: 1,
  width: 1,
  height: 1,
  direction: 6,
  range: 1,
  strength: 1,
};
const cover: ToolStock = {
  id: "leaf-cover",
  kind: "shelter",
  count: 1,
  width: 3,
  height: 1,
  direction: 0,
  range: 2,
  strength: 1,
};
function garden(
  number: number,
  title: string,
  instructions: string,
  width = 24,
  height = 16,
) {
  const editor = begin(number, title, instructions, "route", 8);
  return editLevel(editor, {
    ...editor.level,
    width,
    height,
    population: 8,
    rescueTarget: 8,
    guideLimit: 2,
    theme: "glasshouse",
    inventory: [left],
  });
}

let sesame = garden(
  6,
  "Open Sesame",
  "Before opening the hive, select the purple switch beyond the shutter and choose Assign operator. You can assign a bee across a closed shutter; the operator holds it open. Place your left dancer beyond the switch, directly below the flowers. Open the hive. Once the swarm is home, release the switch operator first, then release the dancer after the operator reaches the flowers. Use Fit to see the whole garden.",
);
sesame = updateObject(sesame, "hive", { y: 12 });
sesame = updateObject(sesame, "flowers", { x: 19, y: 2, width: 3, height: 3 });
sesame = piece(sesame, "switch", 15, 12);
sesame = piece(sesame, "gate", 10, 0, { height: 16 });
export const OPEN_SESAME = exported(sesame);

let after = garden(
  7,
  "After You",
  "Rescue all eight bees. The operator starts above the partition, away from the swarm. Its safe exit and the final dancer's release both matter.",
);
after = updateObject(after, "hive", { y: 12 });
after = updateObject(after, "flowers", { x: 19, y: 1, width: 3, height: 5 });
after = piece(after, "switch", 6, 3, { direction: 2 });
after = piece(after, "gate", 10, 7, { height: 9 });
after = piece(after, "terrain", 7, 6, { width: 10 });
export const AFTER_YOU = exported(after);

let doors = garden(
  8,
  "Two Doors",
  "Two shutters, two operators, one final turn. Bring all eight bees home. Closing the second shutter too early traps the first operator on the wrong side.",
  32,
  16,
);
doors = editLevel(doors, { ...doors.level, guideLimit: 3 });
doors = updateObject(doors, "hive", { y: 12 });
doors = updateObject(doors, "flowers", { x: 27, y: 2, width: 3, height: 3 });
doors = piece(doors, "switch", 14, 12);
doors = piece(doors, "switch", 24, 12);
doors = piece(doors, "gate", 10, 0, { height: 16 });
doors = piece(doors, "gate", 20, 0, { height: 16, switchId: "switch-2" });
export const TWO_DOORS = exported(doors);

let shift = garden(
  9,
  "Change of Shift",
  "Only one bee may hold a helper job at a time. Gather the hive beyond the shutter, release its operator, then recruit a flying bee for the final left dance. Pause to place the dancer; all eight bees must reach home.",
  28,
  16,
);
shift = editLevel(shift, { ...shift.level, guideLimit: 1 });
shift = updateObject(shift, "hive", { y: 10 });
shift = updateObject(shift, "flowers", { x: 21, y: 2, width: 3, height: 3 });
shift = piece(shift, "switch", 12, 10);
shift = piece(shift, "gate", 8, 0, { height: 16 });
shift = piece(shift, "rally", 16, 10);
export const CHANGE_OF_SHIFT = exported(shift);

let spray = garden(
  10,
  "Two Wet Crossings",
  "Two spray lanes separate the hive from home. You have two covers and one left dance. Find protection for the crossings and a dry place for the helper, then rescue every bee.",
  28,
  16,
);
spray = editLevel(spray, {
  ...spray.level,
  guideLimit: 1,
  inventory: [left, { ...cover, count: 2 }],
});
spray = updateObject(spray, "hive", { y: 12 });
spray = updateObject(spray, "flowers", { x: 23, y: 2, width: 3, height: 3 });
for (const x of [6, 16]) {
  spray = piece(spray, "water", x, 12, { width: 3 });
  spray = piece(spray, "sprinkler", x, 3, {
    width: 3,
    range: 10,
    cycle: {
      dryTicks: 60,
      warningTicks: 30,
      wetTicks: 180,
      offsetTicks: x === 6 ? 0 : 90,
    },
  });
}
export const TWO_WET_CROSSINGS = exported(spray);

let escape = garden(
  11,
  "Glasshouse Escape",
  "Bring the whole hive through two shutters and a spray crossing. Keep each operator's exit open, protect the final crossing, and release the dancer last.",
  32,
  20,
);
escape = editLevel(escape, {
  ...escape.level,
  guideLimit: 3,
  inventory: [left, cover],
});
escape = updateObject(escape, "hive", { y: 16 });
escape = updateObject(escape, "flowers", { x: 29, y: 1, width: 3, height: 3 });
escape = piece(escape, "switch", 14, 16);
escape = piece(escape, "switch", 24, 16);
escape = piece(escape, "gate", 10, 0, { height: 20 });
escape = piece(escape, "gate", 20, 0, { height: 20, switchId: "switch-2" });
escape = piece(escape, "sprinkler", 26, 4, {
  width: 3,
  range: 14,
  cycle: { dryTicks: 60, warningTicks: 30, wetTicks: 180, offsetTicks: 0 },
});
escape = piece(escape, "water", 26, 16, { width: 3 });
export const GLASSHOUSE_ESCAPE = exported(escape);

/** New IDs preserve the original campaign's files, solutions and saved progress. */
export const CHALLENGE_GARDENS = [
  OPEN_SESAME,
  AFTER_YOU,
  TWO_DOORS,
  CHANGE_OF_SHIFT,
  TWO_WET_CROSSINGS,
  GLASSHOUSE_ESCAPE,
];
