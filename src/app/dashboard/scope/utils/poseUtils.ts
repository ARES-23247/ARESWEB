import { TelemetryFrame } from "../store/scopeStore";

export interface CameraPose {
  x: number;
  y: number;
  yaw: number;
}

export interface SwerveAngles {
  fl: number;
  fr: number;
  bl: number;
  br: number;
}

/**
 * Extracts camera configurations from telemetry frame values.
 */
export const getCameraPoses = (frame: TelemetryFrame | null): CameraPose[] => {
  if (!frame || !frame.values) {
    return [{ x: 0.18, y: 0.0, yaw: 0.0 }];
  }
  const poses: CameraPose[] = [];
  let i = 0;
  while (true) {
    const prefix1 = `Vision/Camera_${i}`;
    const prefix2 = `Vision/CameraPoses/${i}`;
    const prefix3 = `camera_pose_${i}`;
    
    const getValByKeywords = (keys: string[]): number | undefined => {
      for (const k of keys) {
        if (frame.values[k] !== undefined) return frame.values[k];
      }
      return undefined;
    };
    
    const cx = getValByKeywords([
      `${prefix1}_X`, `${prefix1}_x`, 
      `${prefix2}/Translation_X`, `${prefix2}/Translation_x`, 
      `${prefix2}/x`, `${prefix3}_x`
    ]);
    const cy = getValByKeywords([
      `${prefix1}_Y`, `${prefix1}_y`, 
      `${prefix2}/Translation_Y`, `${prefix2}/Translation_y`, 
      `${prefix2}/y`, `${prefix3}_y`
    ]);
    const cyaw = getValByKeywords([
      `${prefix1}_Yaw`, `${prefix1}_yaw`, 
      `${prefix2}/Rotation_Z`, `${prefix2}/Rotation_z`, 
      `${prefix2}/yaw`, `${prefix3}_yaw`
    ]);
    
    if (cx === undefined || cy === undefined) {
      break;
    }
    
    poses.push({ x: cx, y: cy, yaw: cyaw ?? 0 });
    i++;
    if (i > 10) break;
  }
  
  if (poses.length === 0) {
    // Default single front camera
    return [{ x: 0.18, y: 0.0, yaw: 0.0 }];
  }
  return poses;
};

/**
 * Extracts swerve module angles from telemetry frame values.
 */
export const getSwerveAngles = (frame: TelemetryFrame | null): SwerveAngles => {
  if (!frame || !frame.values) return { fl: 0, fr: 0, bl: 0, br: 0 };
  const getVal = (prefixes: string[]): number => {
    for (const p of prefixes) {
      if (frame.values[p] !== undefined) return frame.values[p];
    }
    return 0;
  };
  return {
    fl: getVal(["Drive/Swerve/Angle_FL", "Drive/Swerve/Module_FL/Angle", "Drive/Swerve/FL_Angle", "Drive/Swerve/FL/Angle", "swerve/angle/fl", "swerve/fl/angle"]),
    fr: getVal(["Drive/Swerve/Angle_FR", "Drive/Swerve/Module_FR/Angle", "Drive/Swerve/FR_Angle", "Drive/Swerve/FR/Angle", "swerve/angle/fr", "swerve/fr/angle"]),
    bl: getVal(["Drive/Swerve/Angle_BL", "Drive/Swerve/Module_BL/Angle", "Drive/Swerve/BL_Angle", "Drive/Swerve/BL/Angle", "swerve/angle/bl", "swerve/bl/angle"]),
    br: getVal(["Drive/Swerve/Angle_BR", "Drive/Swerve/Module_BR/Angle", "Drive/Swerve/BR_Angle", "Drive/Swerve/BR/Angle", "swerve/angle/br", "swerve/br/angle"])
  };
};
