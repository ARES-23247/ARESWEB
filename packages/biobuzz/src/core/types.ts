import type { Alliance, Element, MatchInput, scoreMatch } from "./scoring";
export type { Alliance, Element };
export interface Pose { x: number; y: number; heading: number }
export type SeatKind = "human" | "easy" | "standard" | "empty";
export type Phase = "practice" | "auto" | "transition" | "teleop" | "settling" | "finished" | "interrupted";
export type MatchMode = "auto" | "teleop" | "combined";
export type MechanismSide = "front" | "back";
export interface RobotSetup { shooter:MechanismSide; deposit:MechanismSide; intake:MechanismSide|"both"; intakeContents?:"pollen"|"both"; turret?:boolean; driveSpeed?:number; turnSpeed?:number }
export interface Input { x: number; y: number; turn: number; intake: boolean; shoot: boolean; speed: number; release: boolean; aimHive?:boolean; aimFlower?:boolean; deposit?:boolean; aim?:boolean; turretTurn?:number; lockOn?:boolean; shootHeld?:boolean; depositHeld?:boolean }
export const NEUTRAL: Input = { x: 0, y: 0, turn: 0, intake: false, shoot: false, speed: 5.8, release: false };
export interface AutoProgram { version: 1; name: string; alliance: Alliance; start: Pose; steps: AutoStep[]; robotSetup?:RobotSetup }
export type AutoStep = { kind: "drive"; target: Pose; preset: "safe" | "balanced" }
  | { kind: "wait"; seconds: number } | { kind: "intake"; enabled: boolean } | { kind: "lockOn"; enabled: boolean }
  | { kind: "shoot"; count: number; speed: number };
export interface Config { timed: boolean; matchMode?: MatchMode; seats: SeatKind[]; autos?: (AutoProgram | null)[]; robotSetups?: (RobotSetup|null)[] }
export type Location = "floor" | "air" | "robot" | "flower" | "hive" | "reserve" | "out";
export interface Ball { id: number; kind: Element; x: number; y: number; z: number; vx: number; vy: number; vz: number; location: Location; container: number; returnAt: number }
export interface Robot extends Pose { id: number; alliance: Alliance; controller: SeatKind; inventory: number[]; setup:RobotSetup; turretAngle?:number; shotStatus?:"aiming"|"ready"|"blocked"; shotTarget?:"hive"|"flower"; shotSpeed?:number }
export interface Flower { x: number; y: number; balls: number[] }
export interface Hive { alliance: Alliance; x: number; y: number; angle: number; upward: number; progress: number; tipping: boolean; dumped: boolean; cells: number[][]; tips: number }
export interface GameEvent { tick: number; type: "tip" | "shot" | "intake" | "foul" | "phase" | "release" | "warning"; message: string }
export interface Snapshot { version: 1; tick: number; phase: Phase; remaining: number; robots: Robot[]; balls: Ball[]; flowers: Flower[]; hives: Hive[]; tally: MatchInput; score: ReturnType<typeof scoreMatch>; events: GameEvent[]; credits: Record<Alliance, number> }
export const DT = 1 / 60;
export const SIZE = 3.6576;
export const HALF = SIZE / 2;
export const ROBOT_HALF = 0.225;
export const FLOWER_TOP = 0.5461;
export const FLOWER_MIDDLE = 0.09017;
export const FLOWER_BASE = 0.010922;
export const BALL = { pollen: { diameter: 0.07112, pounds: 0.055 }, red: { diameter: 0.09144, pounds: 0.091 }, blue: { diameter: 0.09144, pounds: 0.091 } } as const;
export function clamp(value: number, low: number, high: number) { return Math.max(low, Math.min(high, value)); }
export function angle(value: number) { return Math.atan2(Math.sin(value), Math.cos(value)); }
export function distance(a: { x: number; y: number }, b: { x: number; y: number }) { return Math.hypot(a.x - b.x, a.y - b.y); }
export function startingPose(seat: number): Pose {
  const sign = seat < 2 ? 1 : -1;
  return { x: sign * (seat % 2 === 0 ? -1.1 : 0.25), y: sign * (HALF - ROBOT_HALF), heading: -sign * Math.PI / 2 };
}
