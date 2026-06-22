import { Waypoint, ConstraintZone } from "../../types/planner";
import { generateBezierPath } from "./bezierMath";

export interface TrajectoryAnalyticsResult {
  length: number;
  duration: number;
  velocities: number[];
}

export function computeTrajectoryAnalytics(
  waypoints: Waypoint[],
  constraintZones: ConstraintZone[],
  maxVelocity: number,
  maxAcceleration: number,
  startVelocity: number,
  endVelocity: number
): TrajectoryAnalyticsResult {
  if (waypoints.length < 2) return { length: 0, duration: 0, velocities: [] };

  let totalLengthInches = 0;
  const segments: { ds: number; vMax: number }[] = [];

  const pts = generateBezierPath(waypoints);

  for (let i = 0; i < pts.length - 1; i++) {
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const dsInches = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    totalLengthInches += dsInches;
    const dsMeters = dsInches * 0.0254;

    let segmentVMax = maxVelocity;
    for (const zone of constraintZones) {
      const hw = zone.width / 2;
      const hh = zone.height / 2;
      if (p1.x >= zone.x - hw && p1.x <= zone.x + hw &&
          p1.y >= zone.y - hh && p1.y <= zone.y + hh) {
        segmentVMax = Math.min(segmentVMax, zone.maxVelocity);
      }
    }
    segments.push({ ds: dsMeters, vMax: segmentVMax });
  }

  const n = segments.length;
  const v = new Array(n + 1).fill(0);

  // Forward pass
  v[0] = startVelocity;
  for (let i = 0; i < n; i++) {
    const limit = segments[i].vMax;
    const ds = segments[i].ds;
    const maxReachable = Math.sqrt(v[i] * v[i] + 2 * maxAcceleration * ds);
    v[i + 1] = Math.min(limit, maxReachable);
  }

  // Backward pass
  v[n] = endVelocity;
  for (let i = n - 1; i >= 0; i--) {
    const limit = v[i];
    const ds = segments[i].ds;
    const maxReachable = Math.sqrt(v[i + 1] * v[i + 1] + 2 * maxAcceleration * ds);
    v[i] = Math.min(limit, maxReachable);
  }

  // Calculate duration
  let totalDuration = 0;
  for (let i = 0; i < n; i++) {
    const ds = segments[i].ds;
    const vAvg = (v[i] + v[i + 1]) / 2;
    const dt = vAvg > 0.01 ? ds / vAvg : ds / 0.01;
    totalDuration += dt;
  }

  return {
    length: totalLengthInches,
    duration: totalDuration,
    velocities: v
  };
}
