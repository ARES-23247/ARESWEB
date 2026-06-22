import { Waypoint } from "../../types/planner";

// Cubic Bezier evaluation
// B(t) = (1-t)^3*P0 + 3*(1-t)^2*t*P1 + 3*(1-t)*t^2*P2 + t^3*P3
export function getBezierPoint(
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  p3: { x: number; y: number },
  t: number
) {
  const t1 = 1 - t;
  const t1Sq = t1 * t1;
  const t1Cb = t1Sq * t1;
  const tSq = t * t;
  const tCb = tSq * t;

  return {
    x: t1Cb * p0.x + 3 * t1Sq * t * p1.x + 3 * t1 * tSq * p2.x + tCb * p3.x,
    y: t1Cb * p0.y + 3 * t1Sq * t * p1.y + 3 * t1 * tSq * p2.y + tCb * p3.y,
  };
}

// Generate dense points along the Bezier path
export function generateBezierPath(waypoints: Waypoint[]): { x: number; y: number }[] {
  if (waypoints.length < 2) return [];
  const points: { x: number; y: number }[] = [];

  for (let i = 0; i < waypoints.length - 1; i++) {
    const w0 = waypoints[i];
    const w1 = waypoints[i + 1];

    const p0 = w0.anchor;
    const p1 = w0.nextControl || w0.anchor;
    const p2 = w1.prevControl || w1.anchor;
    const p3 = w1.anchor;

    // Subdivide each segment into 40 segments for smooth rendering
    for (let step = 0; step <= 40; step++) {
      const t = step / 40;
      // Avoid duplicate points at segment boundaries
      if (step === 0 && i > 0) continue;
      points.push(getBezierPoint(p0, p1, p2, p3, t));
    }
  }

  return points;
}
