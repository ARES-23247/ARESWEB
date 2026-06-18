import { useMemo } from 'react';

export interface MinettiData {
  cost: number;
  totalCalories: number;
  durationHours: number;
  burnRateKcalHr: number;
  curvePoints: { x: number; y: number }[];
}

export function useMinettiCost(
  gradePct: number,
  hikerWeight: number,
  hikeDistance: number,
  hikingSpeed: number
): MinettiData {
  return useMemo(() => {
    const i = gradePct / 100;
    
    // Calculate Minetti cost in J/(kg*m)
    // Cm(i) = 280*i^5 + 58*i^4 - 23*i^3 - 5.8*i^2 + 15*i + 4.3
    const cost = parseFloat((
      280 * Math.pow(i, 5) +
      58 * Math.pow(i, 4) -
      23 * Math.pow(i, 3) -
      5.8 * Math.pow(i, 2) +
      15 * i +
      4.3
    ).toFixed(2));

    // Total Energy Expended (Joules) = Cost * Weight * Distance in meters
    const totalJoules = cost * hikerWeight * (hikeDistance * 1000);
    
    // Convert Joules to kcal (Calories) -> 1 kcal = 4184 Joules
    const totalCalories = parseFloat((totalJoules / 4184).toFixed(0));

    // Duration of hike (hours)
    const durationHours = hikeDistance / hikingSpeed;

    // Burn rate in Calories per hour
    const burnRateKcalHr = parseFloat((totalCalories / durationHours).toFixed(0));

    // Calculate curve points for visual plotting (-30% to +35%)
    const curvePoints: { x: number; y: number }[] = [];
    for (let g = -30; g <= 35; g += 2) {
      const frac = g / 100;
      const c = 280 * Math.pow(frac, 5) + 58 * Math.pow(frac, 4) - 23 * Math.pow(frac, 3) - 5.8 * Math.pow(frac, 2) + 15 * frac + 4.3;
      curvePoints.push({ x: g, y: c });
    }

    return {
      cost,
      totalCalories,
      durationHours,
      burnRateKcalHr,
      curvePoints
    };
  }, [gradePct, hikerWeight, hikeDistance, hikingSpeed]);
}
