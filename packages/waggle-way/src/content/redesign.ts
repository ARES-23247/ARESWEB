import { begin, exported, piece } from "./authoring";
import { editLevel, updateObject } from "../core/editor";
import type { DanceType, Direction, ToolStock } from "../core/level";

let editor = begin(
  1,
  "First Waggle",
  "Drag a pointing dancer onto the flight path below the flowers. Its arrow points north. Open the hive, then release the dancer once the others are home. The pond is safe to fly over.",
  "pixel",
  8,
);
editor = updateObject(editor, "hive", { x: 2, y: 7 });
editor = updateObject(editor, "flowers", { x: 9, y: 1, width: 3, height: 2 });
editor = editLevel(editor, {
  ...editor.level,
  width: 16,
  height: 10,
  guideLimit: 1,
  inventory: [
    {
      id: "pointing-dancer",
      kind: "dancer",
      dance: "point",
      count: 1,
      width: 1,
      height: 1,
      direction: 6,
      range: 1,
      strength: 1,
    },
  ],
});
editor = piece(editor, "water", 4, 7, { width: 3 });
editor = piece(editor, "terrain", 14, 5, { height: 4 });

/** First lesson in the current campaign ruleset. */
export const FIRST_FLIGHT = exported(editor);

function danceStock(
  id: string,
  dance: DanceType,
  direction: Direction,
  range = 1,
): ToolStock {
  return {
    id,
    kind: "dancer",
    dance,
    count: 1,
    width: 1,
    height: 1,
    direction,
    range,
    strength: 1,
  };
}

function lesson(number: number, title: string, instructions: string) {
  let draft = begin(number, title, instructions, "pixel", 8);
  draft = updateObject(draft, "flowers", { x: 11, y: 3, width: 3, height: 3 });
  return editLevel(draft, { ...draft.level, width: 16, height: 10 });
}

let turns = lesson(
  2,
  "Two Little Turns",
  "Dancers need dry ground, though the hive can fly across water. Use a left dance to turn north before the pond, then a right dance above it to reach the flowers. Release the lower helper first, then the upper helper. Each helper follows the last bee it guided; no release arrow is needed.",
);
turns = editLevel(turns, {
  ...turns.level,
  inventory: [
    danceStock("left-dancer", "left", 6),
    danceStock("right-dancer", "right", 0, 2),
  ],
});
turns = piece(turns, "water", 4, 7, { width: 2 });
turns = piece(turns, "water", 10, 6, { width: 6, height: 4 });
export const TWO_TURNS = exported(turns);

let reverse = lesson(
  3,
  "Turn It Around",
  "The hive faces away from home. Place a reverse dancer ahead of it to send the bees back toward the flowers. Each bee turns once per visit, so it can leave the dance. Release the helper after the others arrive; it follows the last bee it guided.",
);
reverse = updateObject(reverse, "hive", { x: 9, y: 5 });
reverse = updateObject(reverse, "flowers", { x: 1, y: 4, width: 3, height: 3 });
reverse = editLevel(reverse, {
  ...reverse.level,
  guideLimit: 1,
  inventory: [danceStock("reverse-dancer", "reverse", 4)],
});
export const TURN_AROUND = exported(reverse);

let bounce = lesson(
  4,
  "Bounce Back",
  "The solid partition turns bees around safely. Let them fly toward it, then use a right-turn dancer on the return path to send them north to the flowers. Put the dancer behind the hive so it only catches returning bees. When released, the helper follows the last bee it guided.",
);
bounce = updateObject(bounce, "hive", { x: 9, y: 7 });
bounce = updateObject(bounce, "flowers", { x: 6, y: 1, width: 3, height: 2 });
bounce = editLevel(bounce, {
  ...bounce.level,
  guideLimit: 1,
  inventory: [danceStock("right-dancer", "right", 6)],
});
bounce = piece(bounce, "terrain", 13, 6, { height: 3 });
export const BOUNCE_BACK = exported(bounce);

let spray = lesson(
  5,
  "Watch the Spray",
  "The fan blows along the flight path. Ordinary water below is safe, but the marked sprinkler spray can lose bees when active. Place the leaf cover below the nozzle to shelter the crossing, then a pointing dancer beyond the spray to lead north. Pause to inspect the spray cycle and rescue your last helper.",
);
spray = updateObject(spray, "flowers", { x: 9, y: 1, width: 3, height: 2 });
spray = editLevel(spray, {
  ...spray.level,
  guideLimit: 1,
  inventory: [
    danceStock("pointing-dancer", "point", 6),
    {
      id: "leaf-cover",
      kind: "shelter",
      count: 1,
      width: 3,
      height: 1,
      direction: 0,
      range: 2,
      strength: 1,
    },
  ],
});
spray = piece(spray, "water", 6, 7, { width: 3 });
spray = piece(spray, "sprinkler", 6, 3, {
  width: 3,
  range: 6,
  cycle: { dryTicks: 60, warningTicks: 30, wetTicks: 180, offsetTicks: 0 },
});
spray = piece(spray, "fan", 1, 7, {
  direction: 0,
  range: 4,
  permission: "fixed",
});
export const WATCH_THE_SPRAY = exported(spray);

/** The five introductory lessons shared with the current campaign. */
export const PRACTICE_GARDENS = [
  FIRST_FLIGHT,
  TWO_TURNS,
  TURN_AROUND,
  BOUNCE_BACK,
  WATCH_THE_SPRAY,
];
