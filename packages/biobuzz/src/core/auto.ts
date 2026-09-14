import type { AutoProgram, AutoStep, Pose } from "./types";
import { FIELD, ZONES, inZone } from "./field";
import { HALF, ROBOT_HALF } from "./types";
import { validateRobotSetup } from "./robot";

function pose(value: unknown): value is Pose {
  if (!value || typeof value !== "object") return false;
  const p = value as Pose;
  const extent = ROBOT_HALF * (Math.abs(Math.cos(p.heading)) + Math.abs(Math.sin(p.heading)));
  return [p.x, p.y, p.heading].every(Number.isFinite) && Math.abs(p.x) <= HALF - extent + 1e-9
    && Math.abs(p.y) <= HALF - extent + 1e-9 && Math.abs(p.heading) <= Math.PI * 2;
}
export function validateAuto(value: unknown): AutoProgram {
  if (!value || typeof value !== "object") throw new Error("Invalid auto program.");
  const a = value as AutoProgram;
  if (a.version !== 1 || typeof a.name !== "string" || !a.name.trim() || a.name.length > 80
    || !["red", "blue"].includes(a.alliance) || !pose(a.start) || !Array.isArray(a.steps) || a.steps.length > 128) throw new Error("Invalid auto setup.");

  const extent = ROBOT_HALF * (Math.abs(Math.cos(a.start.heading)) + Math.abs(Math.sin(a.start.heading)));
  if (Math.abs(Math.abs(a.start.x) + extent - HALF) > 0.015 && Math.abs(Math.abs(a.start.y) + extent - HALF) > 0.015) throw new Error("Starting robot must touch a field wall.");
  if ((a.alliance === "red" ? a.start.y : -a.start.y) < extent) throw new Error("Starting robot must be fully in your alliance half.");
  if (inZone(a.start, ZONES[a.alliance].loading, extent) || FIELD.fieldWaypoints.slice(0, 4).some(f => Math.hypot(f.x-a.start.x, f.y-a.start.y) < extent + 0.065)) throw new Error("Starting robot must clear flowers and the loading zone.");
  for (const step of a.steps) {
    if (!step || typeof step !== "object") throw new Error("Invalid auto step.");
    const valid = step.kind === "drive" ? pose(step.target) && ["safe", "balanced"].includes(step.preset)
      : step.kind === "wait" ? Number.isFinite(step.seconds) && step.seconds >= 0 && step.seconds <= 30
      : step.kind === "intake" ? typeof step.enabled === "boolean"
      : step.kind === "shoot" && Number.isInteger(step.count) && step.count >= 1 && step.count <= 4
        && Number.isFinite(step.speed) && step.speed >= 2 && step.speed <= 5.8;
    if (!valid) throw new Error("Invalid auto step.");
  }
  const validated=structuredClone(a);
  if(a.robotSetup!==undefined)validated.robotSetup=validateRobotSetup(a.robotSetup);
  return validated;
}
export const ACTIONS = {
  intake: "subsystem.biobuzz-intake.set.intakeVoltage",
  flywheel: "subsystem.biobuzz-shooter.set.flywheelVoltage",
  transfer: "subsystem.biobuzz-shooter.set.transferVoltage",
} as const;
export function nativeAuto(program: AutoProgram, documentId: string) {
  const auto = validateAuto(program);
  const setup=validateRobotSetup(auto.robotSetup);
  if(setup.shooter!=="front"||setup.deposit!=="front"||setup.intake!=="front")throw new Error("Studio export requires the reference robot's front-facing mechanisms. Custom layouts can be saved and replayed in the browser.");
  if (!/^[a-z][a-z0-9-]{0,63}$/.test(documentId)) throw new Error("Invalid routine identifier.");
  const steps: Record<string, unknown>[] = [];
  // Native Gson decoding does not apply Kotlin constructor defaults to absent collections.
  const append = (step: Record<string, unknown>) => steps.push({ arguments: {}, children: [], elseChildren: [], ...step, stepId: "step-" + (steps.length + 1) });
  const action = (key: string, voltage: number) => append({ kind: "ACTION", actionKey: key, arguments: { value: String(voltage) } });
  const wait = (seconds: number) => append({ kind: "WAIT", durationSeconds: seconds });
  const nativePose = (p: Pose) => ({ xMeters: p.x, yMeters: p.y, headingRadians: p.heading });
  const drive = (target: Pose, preset: string) => append({ kind: "DRIVE_TO", drive: { target: nativePose(target), motionPresetKey: preset, markers: [], duringActionKeys: [], arrivalActionKeys: [] } });
  let previous = auto.start;
  for (const step of auto.steps) {
    if (step.kind === "drive") {
      // Studio uses heading as the Hermite tangent. Rotate, translate along the chord, then
      // set the requested heading so a holonomic waypoint never exports a bowed path.
      if (Math.hypot(step.target.x - previous.x, step.target.y - previous.y) > 1e-6) {
        const heading = Math.atan2(step.target.y - previous.y, step.target.x - previous.x);
        drive({ ...previous, heading }, step.preset);
        drive({ ...step.target, heading }, step.preset);
      }
      drive(step.target, step.preset);
      previous = step.target;
    }
    else if (step.kind === "wait") wait(step.seconds);
    else if (step.kind === "intake") action(ACTIONS.intake, step.enabled ? 12 : 0);
    else {
      action(ACTIONS.flywheel, step.speed / 5.8 * 12); wait(0.5);
      for (let i = 0; i < step.count; i++) { action(ACTIONS.transfer, 12); wait(0.12); action(ACTIONS.transfer, 0); wait(0.28); }
      action(ACTIONS.flywheel, 0);
    }
  }
  action(ACTIONS.intake, 0); action(ACTIONS.transfer, 0); action(ACTIONS.flywheel, 0);
  return {
    routine: { schemaVersion: 2, documentId, revision: 1, name: auto.name, steps },
    catalog: { schemaVersion: 1, projectId: "biobuzz-reference", revision: 1, defaultEntryId: documentId,
      entries: [{ entryId: documentId, displayName: auto.name, routineId: documentId, startingPose: nativePose(auto.start),
        authoredAlliance: auto.alliance.toUpperCase(), mirrorForOppositeAlliance: false, sortOrder: 0, enabled: true }] },
  };
}
export function autoDuration(steps: AutoStep[]) { return steps.reduce((total, step) => total + (step.kind === "wait" ? step.seconds : step.kind === "shoot" ? 0.5 + step.count * 0.4 : 0), 0); }
