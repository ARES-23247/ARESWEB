export interface AxialCoordinate {
  q: number;
  r: number;
}

export const HEX_DIRECTIONS: ReadonlyArray<AxialCoordinate> = [
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
];

export const HEX_WORD_AXES: ReadonlyArray<AxialCoordinate> = [
  { q: 1, r: 0 },
  { q: 0, r: 1 },
  { q: 1, r: -1 },
];

export function axialKey({ q, r }: AxialCoordinate): string {
  return `${q},${r}`;
}

export function createHexCoordinates(radius: number, order: "row" | "column" = "row"): AxialCoordinate[] {
  if (!Number.isSafeInteger(radius) || radius < 0) {
    throw new RangeError("Hex radius must be a non-negative integer.");
  }
  const coordinates: AxialCoordinate[] = [];
  for (let r = -radius; r <= radius; r += 1) {
    const minimumQ = Math.max(-radius, -r - radius);
    const maximumQ = Math.min(radius, -r + radius);
    for (let q = minimumQ; q <= maximumQ; q += 1) {
      coordinates.push(order === "row" ? { q, r } : { q: r, r: q });
    }
  }
  return coordinates;
}

export function createHexCoordinateIndex(
  coordinates: ReadonlyArray<AxialCoordinate>,
): ReadonlyMap<string, number> {
  return new Map(
    coordinates.map((coordinate, index) => [axialKey(coordinate), index]),
  );
}

export function axialDistance({ q, r }: AxialCoordinate): number {
  return Math.max(Math.abs(q), Math.abs(r), Math.abs(-q - r));
}

export function addAxial(
  coordinate: AxialCoordinate,
  direction: AxialCoordinate,
  distance = 1,
): AxialCoordinate {
  return {
    q: coordinate.q + direction.q * distance,
    r: coordinate.r + direction.r * distance,
  };
}

export function negateAxial({ q, r }: AxialCoordinate): AxialCoordinate {
  return { q: -q, r: -r };
}
