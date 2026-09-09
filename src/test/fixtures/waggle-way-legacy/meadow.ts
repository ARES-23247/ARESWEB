import { editLevel, updateObject, type EditorState } from "../../../../packages/waggle-way/src/core/editor";
import type { ToolStock } from "../../../../packages/waggle-way/src/core/level";
import { begin, exported, piece } from "../../../../packages/waggle-way/src/content/authoring";
import type { CampaignPuzzle } from "./campaign";

const leaf: ToolStock = {
  id: "leaves",
  kind: "shelter",
  count: 1,
  width: 4,
  height: 1,
  direction: 0,
  range: 2,
  strength: 1,
};
const guides: ToolStock = {
  ...leaf,
  id: "guides",
  kind: "perch",
  width: 1,
  count: 2,
  range: 1,
};
const fan: ToolStock = { ...leaf, id: "fans", kind: "fan", width: 1, range: 8 };
const supply = (editor: EditorState, inventory: ToolStock[]) =>
  editLevel(editor, { ...editor.level, inventory });

function leavingNest() {
  let e = begin(
    6,
    "Leaving the Nest",
    "Place your supplied guide perch for the final turn. Use lift and two dances to clear the pond, then bring both helpers home.",
    "sunny",
    2,
  );
  e = updateObject(e, "hive", { x: 2, y: 10 });
  e = updateObject(e, "flowers", { x: 22, y: 2, width: 2, height: 3 });
  e = piece(e, "fan", 5, 12, { direction: 6 });
  e = piece(e, "perch", 17, 7, { range: 1 });
  e = piece(e, "water", 8, 8, { width: 10, height: 4 });
  return exported(supply(e, [{ ...guides, count: 1, range: 2 }]));
}
function inTheLee() {
  let e = begin(
    7,
    "In the Lee",
    "Place a shelter leaf between the upward fan and the flight path. Leaves block wind, while bees can fly through them.",
    "meadow",
    2,
  );
  e = updateObject(e, "flowers", { x: 20, y: 7, width: 3, height: 2 });
  e = piece(e, "fan", 8, 10, {
    direction: 6,
    strength: 3,
    permission: "fixed",
  });
  return exported(supply(e, [leaf]));
}
function crosswind() {
  let e = begin(
    8,
    "Crosswind",
    "The fixed fan pushes the swarm down. Place and tune your own fan so their combined wind keeps the flight path level.",
    "meadow",
    2,
  );
  e = updateObject(e, "hive", { x: 2, y: 6 });
  e = updateObject(e, "flowers", { x: 20, y: 6, width: 3, height: 2 });
  e = piece(e, "fan", 9, 2, {
    direction: 2,
    strength: 2,
    range: 10,
    permission: "fixed",
  });
  return exported(supply(e, [fan]));
}
function gentleLanding() {
  let e = begin(
    9,
    "Gentle Landing",
    "Use the strong lift, then shelter the last part of its stream so the swarm levels out beside the flowers. The leaf's height matters.",
    "meadow",
    2,
  );
  e = updateObject(e, "hive", { x: 2, y: 11 });
  e = updateObject(e, "flowers", { x: 19, y: 7, width: 4, height: 2 });
  e = piece(e, "fan", 6, 13, {
    direction: 6,
    strength: 3,
    range: 12,
    permission: "fixed",
  });
  return exported(supply(e, [leaf]));
}
function longWayRound() {
  let e = begin(
    10,
    "The Long Way Round",
    "The headwind defeats a straight crossing. Place two guides to take a longer path above the stream, then release them in order.",
    "meadow",
    2,
  );
  e = updateObject(e, "hive", { x: 2, y: 8 });
  e = updateObject(e, "flowers", { x: 21, y: 2, width: 2, height: 2 });
  e = piece(e, "fan", 18, 7, {
    direction: 4,
    strength: 3,
    range: 10,
    permission: "fixed",
  });
  e = piece(e, "water", 8, 10, { width: 10, height: 3 });
  return exported(supply(e, [{ ...guides, range: 1 }]));
}
function twoBreezes() {
  let e = begin(
    11,
    "Two Breezes",
    "The two upward streams add together where they overlap. Shelter the stronger fan partway through the climb to avoid rising past the flower field.",
    "meadow",
    2,
  );
  e = updateObject(e, "hive", { x: 2, y: 11 });
  e = updateObject(e, "flowers", { x: 20, y: 9, width: 3, height: 2 });
  e = piece(e, "fan", 6, 13, {
    direction: 6,
    strength: 1,
    range: 12,
    permission: "fixed",
  });
  e = piece(e, "fan", 8, 13, {
    direction: 6,
    strength: 2,
    range: 12,
    permission: "fixed",
  });
  return exported(supply(e, [leaf]));
}
function meadowCrossing() {
  let e = begin(
    12,
    "Meadow Crossing",
    "Connect a sheltered pond crossing to a high flower field. Use your horizontal leaf, vertical leaf, and supplied guide to keep both helpers' routes open.",
    "meadow",
    2,
  );
  e = updateObject(e, "hive", { x: 2, y: 11 });
  e = updateObject(e, "flowers", { x: 21, y: 1, width: 2, height: 2 });
  e = piece(e, "fan", 5, 13, {
    direction: 6,
    strength: 2,
    range: 12,
    permission: "fixed",
  });
  e = piece(e, "fan", 14, 3, {
    direction: 2,
    strength: 3,
    range: 8,
    permission: "fixed",
  });
  e = piece(e, "fan", 20, 4, {
    direction: 4,
    strength: 2,
    range: 8,
    permission: "fixed",
  });
  e = piece(e, "perch", 17, 7, { range: 1 });
  e = piece(e, "water", 8, 9, { width: 10, height: 4 });
  return exported(
    supply(e, [
      leaf,
      { ...leaf, id: "vertical-leaf", width: 1, height: 4 },
      { ...guides, count: 1 },
    ]),
  );
}

export const MEADOW_CAMPAIGN: readonly CampaignPuzzle[] = [
  {
    number: 6,
    garden: "Sunny Garden",
    lesson: "Place the final turn",
    hints: [
      "Place the supplied guide at column 17, row 2, pointing right. Turn the existing guide up and assign both.",
      "Set the upward fan to Medium. Release the lower helper after the swarm passes, then the upper helper after the lower bee reaches the flowers.",
    ],
    level: leavingNest(),
  },
  {
    number: 7,
    garden: "Breezy Meadow",
    lesson: "Make a pocket of still air",
    hints: [
      "Place the leaf at column 7, row 8, between the fan and the hive's flight height.",
      "Watch the wind arrows disappear behind the leaf. No dancing guide is needed here.",
    ],
    level: inTheLee(),
  },
  {
    number: 8,
    garden: "Breezy Meadow",
    lesson: "Balance opposing winds",
    hints: [
      "Place your fan at column 9, row 12 and point it up.",
      "Match the fixed fan's Medium strength. Stronger is not always safer.",
    ],
    level: crosswind(),
  },
  {
    number: 9,
    garden: "Breezy Meadow",
    lesson: "Stop the lift at the right height",
    hints: [
      "A leaf too low stops the climb too soon. Put it at column 5, row 7.",
      "The bees can fly through the leaf, but the fan cannot push them farther up once they enter its wind shadow.",
    ],
    level: gentleLanding(),
  },
  {
    number: 10,
    garden: "Breezy Meadow",
    lesson: "Choose a longer calm route",
    hints: [
      "Place one guide at column 5, row 8, pointing up. Put the other at column 5, row 2, pointing right.",
      "Assign both before opening the hive. Release the lower guide first; keep the upper one dancing until it has passed.",
    ],
    level: longWayRound(),
  },
  {
    number: 11,
    garden: "Breezy Meadow",
    lesson: "Control overlapping streams",
    hints: [
      "Place the leaf at column 7, row 9 to shorten the stronger fan's lift.",
      "The remaining gentle stream still lifts the bees a little. The wide flower field gives them room to land.",
    ],
    level: twoBreezes(),
  },
  {
    number: 12,
    garden: "Breezy Meadow",
    lesson: "Connect sheltered pockets",
    hints: [
      "Put the horizontal leaf at column 12, row 5 and the vertical leaf at column 18, row 3.",
      "Place your supplied guide at column 17, row 1, pointing right. Turn the existing guide up and assign both.",
      "Bring the lower helper past the high guide before releasing the final bee.",
    ],
    level: meadowCrossing(),
  },
];
