import { Waypoint, RotationTarget, ConstraintZone } from "../../types/planner";

export interface TransformedPathData {
  waypoints: Waypoint[];
  rotationTargets: RotationTarget[];
  constraintZones: ConstraintZone[];
  startHeading: number;
  endHeading: number;
}

export function mirrorPath(
  axis: "x" | "y",
  waypoints: Waypoint[],
  rotationTargets: RotationTarget[],
  constraintZones: ConstraintZone[],
  startHeading: number,
  endHeading: number
): TransformedPathData {
  const newWaypoints = waypoints.map((wp) => ({
    anchor: {
      x: axis === "x" ? 144 - wp.anchor.x : wp.anchor.x,
      y: axis === "y" ? 144 - wp.anchor.y : wp.anchor.y,
    },
    prevControl: wp.prevControl
      ? {
          x: axis === "x" ? 144 - wp.prevControl.x : wp.prevControl.x,
          y: axis === "y" ? 144 - wp.prevControl.y : wp.prevControl.y,
        }
      : null,
    nextControl: wp.nextControl
      ? {
          x: axis === "x" ? 144 - wp.nextControl.x : wp.nextControl.x,
          y: axis === "y" ? 144 - wp.nextControl.y : wp.nextControl.y,
        }
      : null,
  }));

  const newRotationTargets = rotationTargets.map((r) => ({
    ...r,
    x: axis === "x" ? 144 - r.x : r.x,
    y: axis === "y" ? 144 - r.y : r.y,
  }));

  const newConstraintZones = constraintZones.map((z) => ({
    ...z,
    x: axis === "x" ? 144 - z.x : z.x,
    y: axis === "y" ? 144 - z.y : z.y,
  }));

  let newStartHeading = startHeading;
  let newEndHeading = endHeading;

  if (axis === "x") {
    newStartHeading = (180 - startHeading + 360) % 360;
    newEndHeading = (180 - endHeading + 360) % 360;
  } else {
    newStartHeading = (360 - startHeading) % 360;
    newEndHeading = (360 - endHeading) % 360;
  }

  return {
    waypoints: newWaypoints,
    rotationTargets: newRotationTargets,
    constraintZones: newConstraintZones,
    startHeading: newStartHeading,
    endHeading: newEndHeading,
  };
}

export function rotatePath(
  angleDeg: number,
  waypoints: Waypoint[],
  rotationTargets: RotationTarget[],
  constraintZones: ConstraintZone[],
  startHeading: number,
  endHeading: number
): TransformedPathData {
  const rad = angleDeg * (Math.PI / 180);
  const rotatePoint = (x: number, y: number, cx: number, cy: number) => {
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const dx = x - cx;
    const dy = y - cy;
    return {
      x: Math.max(0, Math.min(144, cx + dx * cos - dy * sin)),
      y: Math.max(0, Math.min(144, cy + dx * sin + dy * cos)),
    };
  };

  const newWaypoints = waypoints.map((wp) => ({
    anchor: rotatePoint(wp.anchor.x, wp.anchor.y, 72, 72),
    prevControl: wp.prevControl ? rotatePoint(wp.prevControl.x, wp.prevControl.y, 72, 72) : null,
    nextControl: wp.nextControl ? rotatePoint(wp.nextControl.x, wp.nextControl.y, 72, 72) : null,
  }));

  const newRotationTargets = rotationTargets.map((r) => {
    const rotated = rotatePoint(r.x, r.y, 72, 72);
    return { ...r, x: rotated.x, y: rotated.y };
  });

  const newConstraintZones = constraintZones.map((z) => {
    const rotated = rotatePoint(z.x, z.y, 72, 72);
    const shouldSwap = Math.abs(angleDeg) % 180 === 90;
    return {
      ...z,
      x: rotated.x,
      y: rotated.y,
      width: shouldSwap ? z.height : z.width,
      height: shouldSwap ? z.width : z.height,
    };
  });

  const newStartHeading = (startHeading + angleDeg + 360) % 360;
  const newEndHeading = (endHeading + angleDeg + 360) % 360;

  return {
    waypoints: newWaypoints,
    rotationTargets: newRotationTargets,
    constraintZones: newConstraintZones,
    startHeading: newStartHeading,
    endHeading: newEndHeading,
  };
}
