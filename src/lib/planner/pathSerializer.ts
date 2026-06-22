import { Waypoint, EventMarker, ConstraintZone, RotationTarget } from "../../types/planner";

export interface SerializedPathData {
  name: string;
  season: string;
  waypoints: Waypoint[];
  markers: EventMarker[];
  constraintZones: ConstraintZone[];
  rotationTargets: RotationTarget[];
  maxVelocity: number;
  maxAcceleration: number;
  maxAngularVelocity: number;
  maxAngularAcceleration: number;
  startVelocity: number;
  startHeading: number;
  endVelocity: number;
  endHeading: number;
}

export function serializePath(
  pathName: string,
  season: string,
  waypoints: Waypoint[],
  markers: EventMarker[],
  constraintZones: ConstraintZone[],
  rotationTargets: RotationTarget[],
  maxVelocity: number,
  maxAcceleration: number,
  maxAngularVelocity: number,
  maxAngularAcceleration: number,
  startVelocity: number,
  startHeading: number,
  endVelocity: number,
  endHeading: number
): string {
  const output = {
    waypoints: waypoints.map((w) => ({
      anchor: { x: parseFloat(w.anchor.x.toFixed(2)), y: parseFloat(w.anchor.y.toFixed(2)) },
      prevControl: w.prevControl
        ? { x: parseFloat(w.prevControl.x.toFixed(2)), y: parseFloat(w.prevControl.y.toFixed(2)) }
        : null,
      nextControl: w.nextControl
        ? { x: parseFloat(w.nextControl.x.toFixed(2)), y: parseFloat(w.nextControl.y.toFixed(2)) }
        : null,
    })),
    eventMarkers: markers.map((m) => ({
      name: m.name,
      waypointRelativePos: parseFloat((m.progress * (waypoints.length - 1)).toFixed(3)),
      command: {
        type: "named",
        name: m.actions[0] || m.name,
      },
    })),
    markers: markers.map((m) => ({
      id: m.id,
      name: m.name,
      progress: parseFloat(m.progress.toFixed(3)),
      actions: m.actions,
    })),
    constraintZones: constraintZones.map((z) => ({
      id: z.id,
      name: z.name,
      x: parseFloat(z.x.toFixed(2)),
      y: parseFloat(z.y.toFixed(2)),
      width: parseFloat(z.width.toFixed(2)),
      height: parseFloat(z.height.toFixed(2)),
      maxVelocity: z.maxVelocity,
    })),
    rotationTargets: rotationTargets.map((r) => ({
      id: r.id,
      name: r.name,
      x: parseFloat(r.x.toFixed(2)),
      y: parseFloat(r.y.toFixed(2)),
      waypointIndex: r.waypointIndex,
    })),
    maxVelocity,
    maxAcceleration,
    maxAngularVelocity,
    maxAngularAcceleration,
    startVelocity,
    startHeading,
    endVelocity,
    endHeading,
    season,
    name: pathName,
  };

  return JSON.stringify(output, null, 2);
}

export function deserializePath(jsonStr: string): SerializedPathData {
  const data = JSON.parse(jsonStr);
  
  if (!data.waypoints || !Array.isArray(data.waypoints)) {
    throw new Error("Missing waypoints array");
  }

  return {
    name: data.name || "ARES_Auto_Path",
    season: data.season || "decode",
    waypoints: data.waypoints,
    markers: data.markers || [],
    constraintZones: data.constraintZones || [],
    rotationTargets: data.rotationTargets || [],
    maxVelocity: data.maxVelocity ?? 3.0,
    maxAcceleration: data.maxAcceleration ?? 3.0,
    maxAngularVelocity: data.maxAngularVelocity ?? 270.0,
    maxAngularAcceleration: data.maxAngularAcceleration ?? 270.0,
    startVelocity: data.startVelocity ?? 0.0,
    startHeading: data.startHeading ?? 0.0,
    endVelocity: data.endVelocity ?? 0.0,
    endHeading: data.endHeading ?? 0.0,
  };
}
