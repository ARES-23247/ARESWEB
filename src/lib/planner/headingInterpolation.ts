import { Waypoint, RotationTarget } from "../../types/planner";

export function interpolateAngles(from: number, to: number, ratio: number): number {
  let diff = to - from;
  while (diff < -Math.PI) diff += Math.PI * 2;
  while (diff > Math.PI) diff -= Math.PI * 2;
  return from + diff * ratio;
}

export function getWaypointRobotHeading(
  idx: number,
  waypoints: Waypoint[],
  rotationTargets: RotationTarget[],
  startHeading: number, // in degrees
  endHeading: number // in degrees
): number {
  const target = rotationTargets.find((r) => r.waypointIndex === idx);
  if (target) {
    const wp = waypoints[idx];
    if (wp) {
      const dx = target.x - wp.anchor.x;
      const dy = target.y - wp.anchor.y;
      return Math.atan2(dy, dx);
    }
  }

  if (idx === 0) {
    return startHeading * (Math.PI / 180);
  }
  if (idx === waypoints.length - 1) {
    return endHeading * (Math.PI / 180);
  }

  let prevIdx = 0;
  let prevHeading = startHeading * (Math.PI / 180);
  for (let i = idx - 1; i >= 0; i--) {
    const prevTarget = rotationTargets.find((r) => r.waypointIndex === i);
    if (prevTarget || i === 0) {
      prevIdx = i;
      if (prevTarget) {
        const wp = waypoints[i];
        prevHeading = Math.atan2(prevTarget.y - wp.anchor.y, prevTarget.x - wp.anchor.x);
      } else {
        prevHeading = startHeading * (Math.PI / 180);
      }
      break;
    }
  }

  let nextIdx = waypoints.length - 1;
  let nextHeading = endHeading * (Math.PI / 180);
  for (let i = idx + 1; i < waypoints.length; i++) {
    const nextTarget = rotationTargets.find((r) => r.waypointIndex === i);
    if (nextTarget || i === waypoints.length - 1) {
      nextIdx = i;
      if (nextTarget) {
        const wp = waypoints[i];
        nextHeading = Math.atan2(nextTarget.y - wp.anchor.y, nextTarget.x - wp.anchor.x);
      } else {
        nextHeading = endHeading * (Math.PI / 180);
      }
      break;
    }
  }

  const ratio = (idx - prevIdx) / (nextIdx - prevIdx);
  return interpolateAngles(prevHeading, nextHeading, ratio);
}

export function getInterpolatedRobotHeading(
  progress: number,
  waypoints: Waypoint[],
  rotationTargets: RotationTarget[],
  startHeading: number,
  endHeading: number
): number {
  if (waypoints.length < 2) return 0;
  const numSegments = waypoints.length - 1;
  const segmentFloat = progress * numSegments;
  const segIdx = Math.max(0, Math.min(numSegments - 1, Math.floor(segmentFloat)));
  const segT = segmentFloat - segIdx;

  const hStart = getWaypointRobotHeading(segIdx, waypoints, rotationTargets, startHeading, endHeading);
  const hEnd = getWaypointRobotHeading(segIdx + 1, waypoints, rotationTargets, startHeading, endHeading);

  return interpolateAngles(hStart, hEnd, segT);
}
