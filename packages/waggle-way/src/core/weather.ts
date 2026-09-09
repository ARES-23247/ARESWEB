import type { GardenObject } from "./level";

export type RainZone = Pick<GardenObject, "x" | "y" | "width" | "height">;

/** The displayed phase describes the next simulation step, including while paused. */
export function sprinklerPhase(
  sprinkler: GardenObject,
  tick: number,
): {
  phase: "dry" | "warning" | "rain";
  ticksRemaining: number;
} {
  const { dryTicks, warningTicks, wetTicks, offsetTicks } = sprinkler.cycle!;
  const position = (tick + offsetTicks) % (dryTicks + warningTicks + wetTicks);
  if (position < dryTicks)
    return { phase: "dry", ticksRemaining: dryTicks - position };
  if (position < dryTicks + warningTicks)
    return {
      phase: "warning",
      ticksRemaining: dryTicks + warningTicks - position,
    };
  return {
    phase: "rain",
    ticksRemaining: dryTicks + warningTicks + wetTicks - position,
  };
}

/** Vertical rain stops at the first leaf, branch or closed gate in each column band. */
export function rainZones(
  objects: readonly GardenObject[],
  sprinkler: GardenObject,
  openGates: readonly string[] = [],
): RainZone[] {
  const left = sprinkler.x;
  const right = left + sprinkler.width;
  const top = sprinkler.y + sprinkler.height;
  const bottom = top + sprinkler.range;
  const blockers = objects.filter(
    (object) =>
      (object.kind === "shelter" ||
        (object.kind === "terrain" && object.elevation !== "low") ||
        (object.kind === "gate" && !openGates.includes(object.id))) &&
      object.x < right &&
      object.x + object.width > left &&
      object.y < bottom &&
      object.y + object.height > top,
  );
  const edges = [
    ...new Set([
      left,
      right,
      ...blockers.flatMap((object) => [
        Math.max(left, object.x),
        Math.min(right, object.x + object.width),
      ]),
    ]),
  ].sort((a, b) => a - b);
  const zones: RainZone[] = [];
  for (let index = 0; index < edges.length - 1; index++) {
    const x = edges[index];
    const end = edges[index + 1];
    const stop = blockers.reduce(
      (nearest, object) =>
        object.x < end && object.x + object.width > x
          ? Math.min(nearest, Math.max(top, object.y))
          : nearest,
      bottom,
    );
    if (stop > top)
      zones.push({ x, y: top, width: end - x, height: stop - top });
  }
  return zones;
}
