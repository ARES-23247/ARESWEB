import { useMemo } from 'react';

export interface KayakingHydroData {
  hullSpeedKnots: number;
  hullSpeedMph: number;
  speedRatio: number;
  forceFrictionN: number;
  forceWaveN: number;
  forceTotalN: number;
  powerWatts: number;
  tiltAngle: number;
}

export function useKayakingDrag(
  lengthFeet: number,
  speedKnots: number
): KayakingHydroData {
  return useMemo(() => {
    // 1 knot = 0.514444 m/s
    const speedMs = speedKnots * 0.514444;

    // Theoretical Hull Speed: V_hull = 1.34 * sqrt(L_wl) in knots
    const hullSpeedKnots = parseFloat((1.34 * Math.sqrt(lengthFeet)).toFixed(2));

    // Ratio of current speed to hull speed
    const speedRatio = parseFloat((speedKnots / hullSpeedKnots).toFixed(2));

    // Skin Friction Drag (Quadratically proportional to speed & length visualizer)
    // F_frict = C_f * v^2
    const forceFrictionN = parseFloat((4.5 * Math.sqrt(lengthFeet) * speedMs * speedMs).toFixed(1));

    // Wave-making Drag (exponentially climbs as ratio goes above 0.7)
    let forceWaveN = 0;
    if (speedRatio >= 0.6) {
      // Exponential steepness simulating displacement hull speed barrier
      forceWaveN = parseFloat((18 * Math.sqrt(lengthFeet) * Math.pow(Math.max(0, speedRatio - 0.5), 4.5)).toFixed(1));
    }

    const forceTotalN = parseFloat((forceFrictionN + forceWaveN).toFixed(1));

    // Power required (Watts) = Force (Newtons) * Speed (m/s)
    // Adjust for paddle mechanical transmission efficiency (~80%)
    const rawPowerWatts = forceTotalN * speedMs;
    const powerWatts = parseFloat((rawPowerWatts / 0.80).toFixed(0));

    // Pitch/Tilt angle of kayak (it tilts upward when climbing bow wave)
    // Max tilt around 8 degrees at extreme wave drag ratios
    const tiltAngle = parseFloat((Math.max(0, Math.min(8, (speedRatio - 0.8) * 12))).toFixed(1));

    return {
      hullSpeedKnots,
      hullSpeedMph: parseFloat((hullSpeedKnots * 1.15078).toFixed(2)),
      speedRatio,
      forceFrictionN,
      forceWaveN,
      forceTotalN,
      powerWatts,
      tiltAngle
    };
  }, [lengthFeet, speedKnots]);
}
