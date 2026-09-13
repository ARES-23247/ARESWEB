/** BIOBUZZ Competition Manual V1, §§9.7–9.8, 10.5–10.6 (pp. 72–74, 86–93). */
export type Alliance = "red" | "blue";
export type Element = Alliance | "pollen";
export const ALLIANCES = ["red", "blue"] as const;
export const COUNT_FIELDS = {
  leave: { label: "Robots that LEAVE", points: 3, max: 2 },
  autoPark: { label: "Robots parked in AUTO", points: 5, max: 2 },
  autoTips: { label: "AUTO HIVE tips", points: 20, max: 9999 },
  teleopTips: { label: "TELEOP HIVE tips", points: 20, max: 9999 },
  cell: { label: "Elements left in upward CELL", points: 2, max: 56 },
  garden: { label: "Elements in alliance GARDEN", points: 1, max: 56 },
  teleopPark: { label: "Robots parked in TELEOP", points: 5, max: 2 },
  minorFouls: { label: "Minor fouls committed", points: 5, max: 9999 },
  majorFouls: { label: "Major fouls committed", points: 20, max: 9999 },
} as const;
export type CountField = keyof typeof COUNT_FIELDS;
export type AllianceInput = Record<CountField, number>;
export interface MatchInput {
  red: AllianceInput;
  blue: AllianceInput;
  /** Only elements meeting the scoring-volume criteria, ordered bottom to top. */
  flowers: Element[][];
}
export interface Thresholds { swarm: number; pollinator1: number; pollinator2: number }
export const STANDARD_THRESHOLDS: Thresholds = { swarm: 16, pollinator1: 4, pollinator2: 7 };

export function emptyMatch(): MatchInput {
  const alliance: AllianceInput = { leave: 0, autoPark: 0, autoTips: 0, teleopTips: 0, cell: 0, garden: 0, teleopPark: 0, minorFouls: 0, majorFouls: 0 };
  return { red: { ...alliance }, blue: { ...alliance }, flowers: [[], [], [], []] };
}

export function validCount(value: number, max: number): boolean {
  return Number.isInteger(value) && value >= 0 && value <= max;
}

export function scoreFlower(stack: readonly Element[]) {
  const nectar = stack.filter(element => element !== "pollen");
  return { owner: nectar.at(-1) ?? null, bottom: nectar[0] ?? null, points: nectar.length ? stack.length * 2 : 0 };
}

export function validateMatch(input: MatchInput): string[] {
  const errors: string[] = [];
  for (const color of ALLIANCES) {
    for (const key of Object.keys(COUNT_FIELDS) as CountField[]) {
      if (!validCount(input[color][key], COUNT_FIELDS[key].max)) {
        errors.push(`${color === "red" ? "Red" : "Blue"}: ${COUNT_FIELDS[key].label} needs a whole number from 0 to ${COUNT_FIELDS[key].max}.`);
      }
    }
  }
  if (input.flowers.length !== 4) errors.push("Enter exactly four FLOWERS.");
  const elements = input.flowers.flat();
  if (elements.some(element => !["red", "blue", "pollen"].includes(element))) errors.push("Unknown FLOWER element.");
  if (elements.filter(element => element === "pollen").length > 40) errors.push("There are only 40 POLLEN in a V1 match.");
  for (const color of ALLIANCES) {
    if (elements.filter(element => element === color).length > 8) errors.push(`There are only 8 ${color} NECTAR in a V1 match.`);
  }
  const remaining = input.red.cell + input.red.garden + input.blue.cell + input.blue.garden;
  if (remaining + elements.length > 56) errors.push("Only 56 scoring elements are available. Count each element in just one final location.");
  return errors;
}

export function validThresholds(thresholds: Thresholds): boolean {
  return Object.values(thresholds).every(value => validCount(value, 9999) && value > 0)
    && thresholds.pollinator2 >= thresholds.pollinator1;
}

export function scoreMatch(input: MatchInput, thresholds: Thresholds | null = STANDARD_THRESHOLDS) {
  const errors = validateMatch(input);
  if (errors.length) throw new RangeError(errors.join(" "));
  if (thresholds && !validThresholds(thresholds)) throw new RangeError("Invalid RP thresholds.");
  const flowers = input.flowers.map(scoreFlower);
  function allianceScore(color: Alliance) {
    const own = input[color];
    const opponent = input[color === "red" ? "blue" : "red"];
    const auto = own.leave * 3 + own.autoPark * 5 + own.autoTips * 20;
    const flowerElements = flowers.reduce((sum, flower) => sum + (flower.owner === color ? flower.points : 0), 0);
    const flowerBonus = flowers.filter(flower => flower.bottom === color).length * 5;
    const teleop = own.teleopTips * 20 + own.cell * 2 + own.garden + own.teleopPark * 5 + flowerElements + flowerBonus;
    const penalties = opponent.minorFouls * 5 + opponent.majorFouls * 20;
    const movement = own.leave * 3 + (own.autoPark + own.teleopPark) * 5;
    const tips = own.autoTips + own.teleopTips;
    const achievements = thresholds ? {
      swarm: movement >= thresholds.swarm,
      pollinator1: tips >= thresholds.pollinator1,
      pollinator2: tips >= thresholds.pollinator2,
    } : null;
    return { auto, teleop, flowerElements, flowerBonus, penalties, movement, tips, achievements, total: auto + teleop + penalties };
  }
  const red = allianceScore("red");
  const blue = allianceScore("blue");
  const winner: Alliance | "tie" = red.total === blue.total ? "tie" : red.total > blue.total ? "red" : "blue";
  function ranked(score: typeof red, color: Alliance) {
    const resultRP = winner === "tie" ? 1 : winner === color ? 3 : 0;
    const bonusRP = score.achievements ? Object.values(score.achievements).filter(Boolean).length : null;
    return { ...score, resultRP, bonusRP, totalRP: bonusRP === null ? null : resultRP + bonusRP };
  }
  return { red: ranked(red, "red"), blue: ranked(blue, "blue"), winner, flowers };
}
