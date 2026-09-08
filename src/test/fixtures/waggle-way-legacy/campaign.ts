import { WILDFLOWER_CAMPAIGN } from "./wildflower";
import { editLevel, updateObject } from "../../../../packages/waggle-way/src/core/editor";
import type { LevelDefinition } from "../../../../packages/waggle-way/src/core/level";
import { begin, piece, exported } from "../../../../packages/waggle-way/src/content/authoring";
import { GLASSHOUSE_CAMPAIGN } from "./glasshouse";
import { MEADOW_CAMPAIGN } from "./meadow";
import { RAINY_CAMPAIGN } from "./rainy";

export interface CampaignPuzzle {
  number: number;
  garden: string;
  lesson: string;
  hints: readonly string[];
  level: LevelDefinition;
}

function firstWaggle(): LevelDefinition {
  let editor = begin(
    1,
    "First Waggle",
    "Turn the guide's arrow up and assign a bee before opening the hive. Once the other bees arrive, release your guide to bring everyone home.",
  );
  editor = updateObject(editor, "hive", { x: 2, y: 9 });
  editor = updateObject(editor, "flowers", { x: 5, y: 2, width: 3, height: 2 });
  editor = piece(editor, "perch", 7, 9);
  editor = piece(editor, "water", 11, 8, { width: 10, height: 4 });
  return exported(editor);
}

function acrossThePond(): LevelDefinition {
  let editor = begin(
    2,
    "Across the Pond",
    "Lift the swarm above the pond with an upward fan. A second turn brings them to the flowers. The dancing guide needs a safe route too.",
  );
  editor = updateObject(editor, "hive", { x: 2, y: 10 });
  editor = updateObject(editor, "flowers", {
    x: 14,
    y: 2,
    width: 5,
    height: 2,
  });
  editor = piece(editor, "fan", 5, 12, { direction: 6 });
  editor = piece(editor, "water", 8, 8, { width: 10, height: 4 });
  editor = piece(editor, "perch", 17, 6, { range: 3 });
  return exported(editor);
}

function mindTheBranch(): LevelDefinition {
  let editor = begin(
    3,
    "Mind the Branch",
    "The branch leaves a narrow flight corridor above the water. Watch the wind overlay and tune the fan before setting your guide's turn.",
  );
  editor = updateObject(editor, "hive", { x: 2, y: 10 });
  editor = updateObject(editor, "flowers", {
    x: 16,
    y: 2,
    width: 3,
    height: 2,
  });
  editor = piece(editor, "fan", 5, 12, { direction: 6, strength: 3 });
  editor = piece(editor, "water", 8, 8, { width: 10, height: 4 });
  editor = piece(editor, "perch", 17, 7, { range: 1 });
  editor = piece(editor, "terrain", 4, 5, { width: 8 });
  return exported(editor);
}

function bringEveryone(): LevelDefinition {
  let editor = begin(
    4,
    "Bring Everyone",
    "Two guides make a stair-shaped route. Bring the lower guide to safety while the upper guide is still dancing, then release the final helper.",
  );
  editor = updateObject(editor, "hive", { x: 2, y: 10 });
  editor = updateObject(editor, "flowers", {
    x: 19,
    y: 4,
    width: 2,
    height: 3,
  });
  editor = piece(editor, "perch", 7, 10, { range: 1 });
  editor = piece(editor, "perch", 7, 4, { range: 2, direction: 6 });
  editor = piece(editor, "water", 9, 8, { width: 10, height: 4 });
  return exported(editor);
}

function gardenRoute(): LevelDefinition {
  let editor = begin(
    5,
    "Garden Route",
    "Take the high road or the low road around the water. Only two bees can guide at once. Choose your route, then work out the helpers' release order.",
  );
  editor = editLevel(editor, { ...editor.level, height: 16 });
  editor = updateObject(editor, "flowers", {
    x: 20,
    y: 1,
    width: 2,
    height: 14,
  });
  editor = piece(editor, "perch", 7, 7, { range: 1 });
  editor = piece(editor, "perch", 7, 2, { range: 2, direction: 6 });
  editor = piece(editor, "perch", 7, 12, { range: 2, direction: 2 });
  editor = piece(editor, "water", 10, 5, { width: 6, height: 4 });
  return exported(editor);
}

export const CAMPAIGN: readonly CampaignPuzzle[] = [
  {
    number: 1,
    garden: "Sunny Garden",
    lesson: "Dances and guide rescue",
    hints: [
      "Select the guide perch. Change Direction to Up, then Assign guide.",
      "Release the guide after five bees reach the flowers. Its own upward route also reaches the wide field.",
    ],
    level: firstWaggle(),
  },
  {
    number: 2,
    garden: "Sunny Garden",
    lesson: "Wind changes the flight path",
    hints: [
      "The fan already points up. Gentle wind leaves bees too low; try Medium.",
      "Turn the guide upward, assign a bee, and release it after the swarm reaches the flowers.",
    ],
    level: acrossThePond(),
  },
  {
    number: 3,
    garden: "Sunny Garden",
    lesson: "Tune lift through a narrow gap",
    hints: [
      "Strong wind pushes bees into the branch. Medium wind takes them under the branch and over the pond.",
      "The small guide range needs bees close to its perch. Turn it up and remember its final trip.",
    ],
    level: mindTheBranch(),
  },
  {
    number: 4,
    garden: "Sunny Garden",
    lesson: "Release helpers in order",
    hints: [
      "The lower guide points up; the upper guide points right. Assign both before opening the hive.",
      "Release the lower guide first. Wait for it to reach the flowers, then release the upper one.",
    ],
    level: bringEveryone(),
  },
  {
    number: 5,
    garden: "Sunny Garden",
    lesson: "Choose a route with limited jobs",
    hints: [
      "For the upper path, point the middle guide up and the top guide right. Leave the bottom perch empty.",
      "For the lower path, point the middle guide down and the bottom guide right. Release the middle guide before the outer one.",
    ],
    level: gardenRoute(),
  },
  ...MEADOW_CAMPAIGN,
  ...GLASSHOUSE_CAMPAIGN,
  ...RAINY_CAMPAIGN,
  ...WILDFLOWER_CAMPAIGN,
];
