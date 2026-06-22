// Waypoint using cubic Bezier formatting
export type Waypoint = {
  anchor: { x: number; y: number };       // in inches (0 to 144)
  prevControl: { x: number; y: number } | null;  // in inches (0 to 144)
  nextControl: { x: number; y: number } | null;  // in inches (0 to 144)
};

// Event Marker / Action trigger along path
export type EventMarker = {
  id: string;
  name: string;
  progress: number; // 0.0 to 1.0
  actions: string[];
};

export type ConstraintZone = {
  id: string;
  name: string;
  x: number;       // Center X in inches (0-144)
  y: number;       // Center Y in inches (0-144)
  width: number;   // Width in inches
  height: number;  // Height in inches
  maxVelocity: number; // in m/s
};

export type RotationTarget = {
  id: string;
  name: string;
  x: number;       // Target face X in inches (0-144)
  y: number;       // Target face Y in inches (0-144)
  waypointIndex: number; // Waypoint index it's linked to (e.g. 0, 1, 2)
};

export interface AresPlannerProps {
  initialPathData?: {
    name: string;
    season: string;
    waypoints: Waypoint[];
    markers: EventMarker[];
    constraintZones?: ConstraintZone[];
    rotationTargets?: RotationTarget[];
    maxVelocity?: number;
    maxAcceleration?: number;
    maxAngularVelocity?: number;
    maxAngularAcceleration?: number;
    startVelocity?: number;
    startHeading?: number;
    endVelocity?: number;
    endHeading?: number;
  };
  cloudPaths?: Array<{
    id: string;
    name: string;
    season: string;
    waypoints: Waypoint[];
    markers: EventMarker[];
    constraintZones?: ConstraintZone[];
    rotationTargets?: RotationTarget[];
    maxVelocity?: number;
    maxAcceleration?: number;
    maxAngularVelocity?: number;
    maxAngularAcceleration?: number;
    startVelocity?: number;
    startHeading?: number;
    endVelocity?: number;
    endHeading?: number;
    updatedAt: any;
  }>;
  onSaveToCloud?: (
    name: string,
    season: string,
    waypoints: Waypoint[],
    markers: EventMarker[],
    constraintZones?: ConstraintZone[],
    rotationTargets?: RotationTarget[],
    maxVelocity?: number,
    maxAcceleration?: number,
    maxAngularVelocity?: number,
    maxAngularAcceleration?: number,
    startVelocity?: number,
    startHeading?: number,
    endVelocity?: number,
    endHeading?: number
  ) => Promise<void>;
  onLoadPath?: (pathId: string) => void;
  isSavingCloud?: boolean;
}
