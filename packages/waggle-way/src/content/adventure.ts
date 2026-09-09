import { PRACTICE_GARDENS } from "./redesign";
import { CHALLENGE_GARDENS } from "./challenges";
import { ADVANCED_GARDENS } from "./advanced";

/** The public campaign uses one consistent set of flight and placement rules. */
export const ADVENTURE_CHAPTERS = [
  {
    title: "Learn the dances",
    detail: "5 short lessons",
    start: 0,
    levels: PRACTICE_GARDENS,
  },
  {
    title: "Glasshouse challenges",
    detail: "6 puzzles · rescue every bee",
    start: 5,
    levels: CHALLENGE_GARDENS,
  },
  {
    title: "City gardens",
    detail: "6 hard puzzles · tight turns and helper routes",
    start: 11,
    levels: ADVANCED_GARDENS.slice(0, 6),
  },
  {
    title: "Rain gardens",
    detail: "6 hard puzzles · exposed crossings and limited shelter",
    start: 17,
    levels: ADVANCED_GARDENS.slice(6, 12),
  },
  {
    title: "Factory escape",
    detail: "7 expert puzzles · every operator must escape",
    start: 23,
    levels: ADVANCED_GARDENS.slice(12),
  },
];
export const ADVENTURE_GARDENS = ADVENTURE_CHAPTERS.flatMap(
  (chapter) => chapter.levels,
);
