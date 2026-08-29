/** @sim {"name":"Autonomous Path Clearance Lab","requiresContext":false,"academyApproved":true,"fidelity":"conceptual"} */
import { useMemo, useState } from "react";
import { RotateCcw } from "lucide-react";

type Point = { x: number; y: number };
export type PathClearanceResult = { pathLength: number; obstacleClearance: number; requiredClearance: number; safe: boolean };
const START = { x: 0.5, y: 0.5 } as const;
const OBSTACLE = { x: 2.5, y: 1.5, radius: 0.45 } as const;
const DEFAULTS = { goalX: 4.5, goalY: 2.5, robotRadius: 0.3 } as const;

function distanceToSegment(point: Point, start: Point, end: Point) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  const projection = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared));
  return Math.hypot(point.x - (start.x + projection * dx), point.y - (start.y + projection * dy));
}

export function calculatePathClearance(goalX: number, goalY: number, robotRadius: number): PathClearanceResult {
  if (![goalX, goalY, robotRadius].every(Number.isFinite) || robotRadius < 0) throw new Error("Path inputs must be finite and robot radius cannot be negative.");
  const goal = { x: goalX, y: goalY };
  const pathLength = Math.hypot(goal.x - START.x, goal.y - START.y);
  const obstacleClearance = Math.max(0, distanceToSegment(OBSTACLE, START, goal) - OBSTACLE.radius);
  const requiredClearance = robotRadius + 0.05;
  const inBounds = goal.x >= 0 && goal.x <= 5 && goal.y >= 0 && goal.y <= 3;
  return { pathLength, obstacleClearance, requiredClearance, safe: inBounds && obstacleClearance >= requiredClearance };
}

export default function AutonomousPathLab() {
  const [goalX, setGoalX] = useState<number>(DEFAULTS.goalX);
  const [goalY, setGoalY] = useState<number>(DEFAULTS.goalY);
  const [robotRadius, setRobotRadius] = useState<number>(DEFAULTS.robotRadius);
  const result = useMemo(() => calculatePathClearance(goalX, goalY, robotRadius), [goalX, goalY, robotRadius]);
  const reset = () => { setGoalX(DEFAULTS.goalX); setGoalY(DEFAULTS.goalY); setRobotRadius(DEFAULTS.robotRadius); };
  const sx = (value: number) => 30 + value * 68;
  const sy = (value: number) => 220 - value * 60;

  return <section aria-labelledby="autonomous-path-title" className="my-8 rounded-xl border border-ares-cyan/30 bg-black/35 p-4 sm:p-6">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-widest text-ares-cyan">Concept model</p><h3 id="autonomous-path-title" className="mt-1 text-xl font-black text-white">Autonomous Path Clearance Lab</h3><p className="mt-2 max-w-3xl text-sm leading-relaxed text-marble/80">Check one straight center-line path against one circular obstacle and a bumper margin.</p></div><button type="button" onClick={reset} className="inline-flex min-h-11 items-center justify-center gap-2 rounded border border-white/20 px-4 py-2 text-sm font-bold text-white hover:border-ares-cyan focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"><RotateCcw aria-hidden="true" size={16} /> Reset</button></div>
    <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(16rem,0.8fr)_minmax(0,1.2fr)]"><fieldset className="grid gap-5 rounded-lg border border-white/10 bg-white/5 p-4"><legend className="px-2 text-sm font-bold text-ares-gold">Choose a goal and robot radius</legend><NumberControl label="Goal field X" unit="m" value={goalX} min={0.5} max={4.8} step={0.1} onChange={setGoalX} /><NumberControl label="Goal field Y" unit="m" value={goalY} min={0.2} max={2.8} step={0.1} onChange={setGoalY} /><NumberControl label="Robot bumper radius" unit="m" value={robotRadius} min={0.1} max={0.6} step={0.05} onChange={setRobotRadius} /></fieldset>
      <div className="rounded-lg border border-white/10 bg-obsidian p-4"><h4 className="text-sm font-bold uppercase tracking-wider text-ares-gold">Concept field</h4><svg viewBox="0 0 400 250" className="mt-3 h-auto w-full" role="img" aria-label={`Straight path length ${result.pathLength.toFixed(2)} meters. Obstacle clearance ${result.obstacleClearance.toFixed(2)} meters. Required clearance ${result.requiredClearance.toFixed(2)} meters. Path marked ${result.safe ? "clear" : "blocked"}.`}><rect x="30" y="40" width="340" height="180" fill="none" stroke="currentColor" className="text-white/30" /><circle cx={sx(OBSTACLE.x)} cy={sy(OBSTACLE.y)} r={OBSTACLE.radius * 60} fill="currentColor" className="text-ares-red/50" /><line x1={sx(START.x)} y1={sy(START.y)} x2={sx(goalX)} y2={sy(goalY)} stroke="currentColor" className={result.safe ? "text-ares-cyan" : "text-ares-red"} strokeWidth="5" /><circle cx={sx(START.x)} cy={sy(START.y)} r="7" fill="currentColor" className="text-ares-gold" /><circle cx={sx(goalX)} cy={sy(goalY)} r="7" fill="currentColor" className="text-white" /><text x="36" y="238" fill="currentColor" className="text-[11px] text-white">5 m × 3 m concept field</text></svg><dl aria-live="polite" aria-atomic="true" className="mt-4 grid gap-3 sm:grid-cols-3"><Result label="Decision" value={result.safe ? "Clear" : "Blocked"} /><Result label="Obstacle clearance" value={`${result.obstacleClearance.toFixed(2)} m`} /><Result label="Required clearance" value={`${result.requiredClearance.toFixed(2)} m`} /></dl></div></div>
    <details className="mt-5 rounded border border-white/10 bg-white/5 p-3 text-sm text-white"><summary className="min-h-11 cursor-pointer font-bold text-ares-cyan">Open the path data table</summary><div className="mt-3 overflow-x-auto"><table className="w-full min-w-[30rem] text-left"><thead><tr><th className="p-2">Item</th><th className="p-2">Field X</th><th className="p-2">Field Y</th><th className="p-2">Size</th></tr></thead><tbody><tr className="border-t border-white/10"><td className="p-2">Start</td><td className="p-2">0.50 m</td><td className="p-2">0.50 m</td><td className="p-2">—</td></tr><tr className="border-t border-white/10"><td className="p-2">Goal</td><td className="p-2">{goalX.toFixed(2)} m</td><td className="p-2">{goalY.toFixed(2)} m</td><td className="p-2">—</td></tr><tr className="border-t border-white/10"><td className="p-2">Obstacle</td><td className="p-2">2.50 m</td><td className="p-2">1.50 m</td><td className="p-2">0.45 m radius</td></tr></tbody></table></div></details>
    <p role="note" className="mt-5 border-l-4 border-ares-gold/60 bg-ares-gold/10 p-3 text-sm leading-relaxed text-white"><strong>Model limit:</strong> This invented field checks one straight line against one circle. It does not parse `.aresroutine` files, sample ARES paths, use a costmap, model the robot footprint, check chained segments, execute code, or validate physical clearance.</p>
  </section>;
}

function NumberControl({ label, unit, value, min, max, step, onChange }: { label: string; unit: string; value: number; min: number; max: number; step: number; onChange: (value: number) => void }) { const id = label.toLowerCase().replace(/[^a-z0-9]+/gu, "-"); return <div className="grid gap-2"><label htmlFor={id} className="flex items-center justify-between gap-3 text-sm font-semibold text-white"><span>{label}</span><output htmlFor={id} className="font-mono text-ares-cyan">{value.toFixed(2)} {unit}</output></label><input id={id} aria-label={label} type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.currentTarget.value))} className="min-h-11 w-full cursor-pointer accent-ares-red" /></div>; }
function Result({ label, value }: { label: string; value: string }) { return <div className="rounded border border-white/10 p-3"><dt className="text-xs uppercase tracking-wide text-marble/70">{label}</dt><dd className="mt-1 font-mono text-lg font-bold text-white">{value}</dd></div>; }
