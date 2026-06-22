import { FieldConfig } from "../page";
import { FieldObstacle } from "../types";

export interface RobotFieldPoint {
  x: number;
  y: number;
}

export interface RobotFieldObstacle {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  isBlocking: boolean;
  obstacleType: "blocking" | "ramp";
  rampDirection?: "up" | "down" | "left" | "right";
  shape: "rectangle" | "polygon";
  points: RobotFieldPoint[];
  friction: number;
  restitution: number;
  rotation: number;
}

export interface RobotFieldAprilTag {
  id: number;
  x: number;
  y: number;
  z: number;
  yaw: number;
}

export interface RobotFieldElementType {
  id: string;
  name: string;
  shape: "box" | "cylinder" | "sphere";
  width: number;
  height: number;
  depth: number;
  diameter?: number | null;
  color: string;
  massKg: number;
  movable: boolean;
}

export interface RobotFieldElementInstance {
  id: string;
  elementTypeId: string;
  x: number;
  y: number;
  rotation: number;
}

export interface RobotFieldConfig {
  id: string;
  name: string;
  gameYear: string;
  fieldType: "ftc" | "frc";
  xAxisDirection: "up" | "down" | "left" | "right";
  yAxisDirection: "up" | "down" | "left" | "right";
  redDriverStation: "north" | "south" | "east" | "west";
  blueDriverStation: "north" | "south" | "east" | "west";
  obstacles: RobotFieldObstacle[];
  apriltags: RobotFieldAprilTag[];
  elementTypes: RobotFieldElementType[];
  elements: RobotFieldElementInstance[];
}

/**
 * Transforms an ARESWEB FieldConfig into the schema expected by ARESLib RobotFieldConfig.
 */
export function exportToRobotConfig(config: FieldConfig): RobotFieldConfig {
  const obstacles: RobotFieldObstacle[] = (config.obstacles || []).map((obs: FieldObstacle) => ({
    id: obs.id,
    name: obs.name,
    x: obs.x,
    y: obs.y,
    width: obs.width,
    height: obs.height,
    isBlocking: obs.isBlocking,
    obstacleType: obs.obstacleType,
    rampDirection: obs.rampDirection,
    shape: obs.shape || "rectangle",
    points: obs.points || [],
    friction: obs.friction ?? 0.5,
    restitution: obs.restitution ?? 0.3,
    rotation: obs.rotation ?? 0.0,
  }));

  const apriltags: RobotFieldAprilTag[] = (config.apriltags || []).map((tag) => ({
    id: tag.id,
    x: tag.x,
    y: tag.y,
    z: tag.z,
    yaw: tag.yaw,
  }));

  const elementTypes: RobotFieldElementType[] = (config.elementTypes || []).map((t) => ({
    id: t.id,
    name: t.name,
    shape: t.shape,
    width: t.width,
    height: t.height,
    depth: t.depth,
    diameter: t.diameter ?? null,
    color: t.color,
    massKg: t.massKg,
    movable: t.movable,
  }));

  const elements: RobotFieldElementInstance[] = (config.elements || []).map((el) => ({
    id: el.id,
    elementTypeId: el.elementTypeId,
    x: el.x,
    y: el.y,
    rotation: el.rotation,
  }));

  return {
    id: config.id || "",
    name: config.name || "Unnamed Field",
    gameYear: config.gameYear || "2025-2026",
    fieldType: config.fieldType || "ftc",
    xAxisDirection: config.xAxisDirection || "up",
    yAxisDirection: config.yAxisDirection || "left",
    redDriverStation: config.redDriverStation || "south",
    blueDriverStation: config.blueDriverStation || "north",
    obstacles,
    apriltags,
    elementTypes,
    elements,
  };
}

/**
 * Downloads a JSON file containing the RobotFieldConfig.
 */
export function downloadRobotConfigJson(config: FieldConfig) {
  const robotConfig = exportToRobotConfig(config);
  const jsonStr = JSON.stringify(robotConfig, null, 2);
  const blob = new Blob([jsonStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement("a");
  a.href = url;
  a.download = `${config.name.toLowerCase().replace(/\s+/g, "-")}-robot-config.json`;
  document.body.appendChild(a);
  a.click();
  
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
