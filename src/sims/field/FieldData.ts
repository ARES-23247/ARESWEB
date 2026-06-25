/**
 * FRC Field Dimensions and Data Structures
 *
 * Official field dimensions for recent FRC games.
 * All dimensions in meters unless otherwise specified.
 */

export interface FieldDimensions {
  length: number;  // Field length (meters)
  width: number;   // Field width (meters)
  allianceDepth: number;  // Depth of alliance zone
  sourceDepth: number;   // Depth of source zone
  ampDepth: number;      // Depth of amp zone
}

export interface GamePiece {
  x: number;
  y: number;
  z: number;
  type: 'cube' | 'cone' | 'sphere';
  color: string;
}

export interface RobotPosition {
  x: number;
  y: number;
  heading: number; // radians
}

export const FIELDS = {
  CRESCENDO_2024: {
    name: '2024 Crescendo',
    dimensions: {
      length: 16.541,  // ~54 ft
      width: 8.211,    // ~27 ft
      allianceDepth: 3.0,
      sourceDepth: 2.0,
      ampDepth: 2.5,
    } as FieldDimensions,
    gamePieces: [] as GamePiece[],
  },
  CHARGED_UP_2023: {
    name: '2023 Charged Up',
    dimensions: {
      length: 16.541,
      width: 8.211,
      allianceDepth: 2.5,
      sourceDepth: 1.5,
      ampDepth: 1.5,
    } as FieldDimensions,
    gamePieces: [] as GamePiece[],
  },
  RAPID_REACT_2022: {
    name: '2022 Rapid React',
    dimensions: {
      length: 16.541,
      width: 8.211,
      allianceDepth: 2.0,
      sourceDepth: 2.0,
      ampDepth: 1.0,
    } as FieldDimensions,
    gamePieces: [] as GamePiece[],
  },
};

export const APRIL_TAGS_2024 = [
  // Red alliance tags
  { id: 1, x: 15.013, y: 0.762, heading: 0 },
  { id: 2, x: 15.013, y: 2.743, heading: 0 },
  { id: 3, x: 15.013, y: 4.699, heading: 0 },
  { id: 4, x: 15.013, y: 6.680, heading: 0 },
  { id: 5, x: 14.068, y: 1.194, heading: Math.PI / 2 },
  { id: 6, x: 14.068, y: 6.248, heading: -Math.PI / 2 },

  // Blue alliance tags
  { id: 7, x: 1.528, y: 0.762, heading: Math.PI },
  { id: 8, x: 1.528, y: 2.743, heading: Math.PI },
  { id: 9, x: 1.528, y: 4.699, heading: Math.PI },
  { id: 10, x: 1.528, y: 6.680, heading: Math.PI },
  { id: 11, x: 2.473, y: 1.194, heading: Math.PI / 2 },
  { id: 12, x: 2.473, y: 6.248, heading: -Math.PI / 2 },
];

export function createFieldLayout(field: keyof typeof FIELDS) {
  const fieldData = FIELDS[field];
  const { dimensions } = fieldData;

  return {
    dimensions,
    aprilTags: field === 'CRESCENDO_2024' ? APRIL_TAGS_2024 : [],
    fieldLines: generateFieldLines(dimensions),
    zones: generateZones(dimensions),
  };
}

function generateFieldLines(dimensions: FieldDimensions) {
  const lines = [];
  const { length, width } = dimensions;

  // Outer boundary
  lines.push([
    { x: 0, y: 0 },
    { x: length, y: 0 },
    { x: length, y: width },
    { x: 0, y: width },
    { x: 0, y: 0 },
  ]);

  // Center line
  lines.push([
    { x: length / 2, y: 0 },
    { x: length / 2, y: width },
  ]);

  // Midline
  lines.push([
    { x: 0, y: width / 2 },
    { x: length, y: width / 2 },
  ]);

  return lines;
}

function generateZones(dimensions: FieldDimensions) {
  const zones = [];
  const { length, width, allianceDepth, sourceDepth } = dimensions;

  // Red alliance zone
  zones.push({
    name: 'Red Alliance',
    x: 0,
    y: 0,
    width: allianceDepth,
    height: width,
    color: 'var(--ares-red)',
    alpha: 0.3,
  });

  // Blue alliance zone
  zones.push({
    name: 'Blue Alliance',
    x: length - allianceDepth,
    y: 0,
    width: allianceDepth,
    height: width,
    color: 'var(--ares-cyan)',
    alpha: 0.3,
  });

  // Red source zone
  zones.push({
    name: 'Red Source',
    x: 0,
    y: 0,
    width: sourceDepth,
    height: width,
    color: 'var(--ares-red)',
    alpha: 0.2,
  });

  // Blue source zone
  zones.push({
    name: 'Blue Source',
    x: length - sourceDepth,
    y: 0,
    width: sourceDepth,
    height: width,
    color: 'var(--ares-cyan)',
    alpha: 0.2,
  });

  return zones;
}

export function spawnGamePieces(field: keyof typeof FIELDS, count: number = 10): GamePiece[] {
  const fieldData = FIELDS[field];
  const { dimensions } = fieldData;
  const pieces: GamePiece[] = [];

  const pieceType = field === 'CRESCENDO_2024' ? 'cone' : 'cube';
  const pieceColor = field === 'CRESCENDO_2024' ? 'var(--ares-gold)' : 'var(--ares-gold)';

  for (let i = 0; i < count; i++) {
    pieces.push({
      x: 2 + Math.random() * (dimensions.length - 4),
      y: 2 + Math.random() * (dimensions.width - 4),
      z: 0,
      type: pieceType,
      color: pieceColor,
    });
  }

  return pieces;
}

export function calculateFieldPosition(
  robotX: number,
  robotY: number,
  heading: number
): RobotPosition {
  return {
    x: robotX,
    y: robotY,
    heading: heading,
  };
}

export function isInField(
  x: number,
  y: number,
  dimensions: FieldDimensions
): boolean {
  return x >= 0 && x <= dimensions.length && y >= 0 && y <= dimensions.width;
}

export function getFieldCenter(dimensions: FieldDimensions): { x: number; y: number } {
  return {
    x: dimensions.length / 2,
    y: dimensions.width / 2,
  };
}
