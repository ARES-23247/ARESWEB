export interface FieldObstacle {
  id: string;
  name: string;
  x: number;      // EKF X in meters (centroid for polygons)
  y: number;      // EKF Y in meters (centroid for polygons)
  width: number;  // Width in meters
  height: number; // Height in meters
  isBlocking: boolean;
  obstacleType: "blocking" | "ramp";
  rampDirection?: "up" | "down" | "left" | "right";
  shape?: "rectangle" | "polygon";
  points?: { x: number; y: number }[];
}

export interface ElementType {
  id: string;
  name: string;
  shape: "box" | "cylinder" | "sphere";
  width: number;       // For box (width along Y axis)
  height: number;      // For box (height along X axis)
  depth: number;       // Z axis height/thickness
  diameter?: number;   // For cylinder / sphere
  color: string;       // Hex color
  massKg: number;      // weight in kg
  movable: boolean;    // true = dynamic physics, false = static
}

export interface FieldElementInstance {
  id: string;
  elementTypeId: string; // references ElementType.id
  x: number;             // EKF X
  y: number;             // EKF Y
  rotation: number;      // rotation in degrees
}

export interface FieldAprilTag {
  id: number;
  x: number;
  y: number;
  z: number;
  yaw: number; // in degrees
}

export interface CoordinateHelpers {
  ekfToScreen: (x_ekf: number, y_ekf: number) => { x: number; y: number };
  toEkfX: (pxX: number, pxY: number) => number;
  toEkfY: (pxX: number, pxY: number) => number;
}

