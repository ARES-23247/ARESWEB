/** @sim {"name": "Hiking Grade Energy Cost", "requiresContext": false} */
import { useState, useMemo } from 'react';
import { Activity, Heart } from 'lucide-react';

export default function HikingGradeEnergySim() {
  const [gradePct, setGradePct] = useState(5); // -30% to +35%
  const [hikerWeight, setHikerWeight] = useState(75); // 50 to 120 kg
  const [hikeDistance, setHikeDistance] = useState(5); // 1 to 15 km
  const [hikingSpeed, setHikingSpeed] = useState(4.0); // 2.0 to 6.0 km/h

  // Minetti Mathematical Model
  // Cm(i) = 280*i^5 + 58*i^4 - 23*i^3 - 5.8*i^2 + 15*i + 4.3
  // where i is fractional slope (gradePct / 100)
  const minettiData = useMemo(() => {
    const i = gradePct / 100;
    
    // Calculate Minetti cost in J/(kg*m)
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

  const getInclineZone = () => {
    if (gradePct < -15) {
      return { text: 'STEEP DESCENT (Braking Strain)', color: 'text-ares-red-light', border: 'border-ares-red/30', bg: 'bg-ares-red/10', state: 'steep-down' };
    } else if (gradePct >= -12 && gradePct <= -6) {
      return { text: 'MINETTI SWEET SPOT (Optimal Grade)', color: 'text-ares-cyan', border: 'border-ares-cyan/30', bg: 'bg-ares-cyan/10', state: 'optimal' };
    } else if (gradePct > -6 && gradePct <= 4) {
      return { text: 'FLAT CRUISING (Steady Energy)', color: 'text-ares-gold', border: 'border-ares-gold/30', bg: 'bg-ares-gold/10', state: 'flat' };
    } else if (gradePct <= 15) {
      return { text: 'MODERATE CLIMB (Aerobic Lift)', color: 'text-ares-bronze-light', border: 'border-ares-bronze/30', bg: 'bg-ares-bronze/10', state: 'climb' };
    } else {
      return { text: 'STEEP ASCENT (Severe Caloric Wall)', color: 'text-ares-red-light', border: 'border-ares-red/30', bg: 'bg-ares-red/10', state: 'steep-up' };
    }
  };

  const zone = getInclineZone();

  return (
    <div className="glass-card bg-obsidian border border-white/10 rounded-xl p-6 text-marble shadow-2xl">
      <div className="flex flex-col gap-2 mb-6">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider bg-ares-red/20 text-ares-red border border-ares-red/30">
            Metabolic Biomechanics
          </span>
          <h3 className="text-xl font-heading font-bold text-white tracking-wide">
            Hiking Grade Energy Cost (Minetti Model)
          </h3>
        </div>
        <p className="text-marble/70 text-sm leading-relaxed max-w-3xl">
          Human walking efficiency is heavily altered by topography. According to the famous Minetti equation, our bodies reach maximum energy efficiency at a gentle -10% downhill grade. Steeper grades increase metabolic demands exponentially, whether hiking uphill or braking downhill.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Panel: Configuration Controls */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          <div className="bg-white/5 border border-white/5 rounded-lg p-5 flex flex-col gap-5">
            <h4 className="text-xs uppercase font-bold tracking-widest text-ares-gold border-b border-white/5 pb-2">
              Parameters
            </h4>

            {/* Slider 1: Grade % */}
            <div className="flex flex-col gap-2">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-marble/60">Trail Grade (Incline %)</span>
                <span className={`font-bold ${gradePct < 0 ? 'text-ares-cyan' : gradePct > 15 ? 'text-ares-red-light' : 'text-white'}`}>
                  {gradePct > 0 ? `+${gradePct}%` : `${gradePct}%`}
                </span>
              </div>
              <input
                type="range"
                min="-30"
                max="35"
                step="1"
                value={gradePct}
                onChange={(e) => setGradePct(parseInt(e.target.value, 10))}
                className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-ares-red"
                aria-label="Hiking trail grade slope percentage"
              />
              <div className="flex justify-between text-[10px] text-marble/40 font-mono">
                <span>-30% (Steep Down)</span>
                <span>-10% (Sweet Spot)</span>
                <span>0% (Flat Ground)</span>
                <span>+35% (Extreme Wall)</span>
              </div>
            </div>

            {/* Slider 2: Hiker Weight */}
            <div className="flex flex-col gap-2">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-marble/60">Hiker Mass (Weight + Pack)</span>
                <span className="text-white font-bold">{hikerWeight} kg</span>
              </div>
              <input
                type="range"
                min="50"
                max="120"
                step="5"
                value={hikerWeight}
                onChange={(e) => setHikerWeight(parseInt(e.target.value, 10))}
                className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-ares-red"
                aria-label="Hiker weight including backpack"
              />
              <span className="text-[10px] text-marble/40">Includes physical gear, boots, and water hydration pack weights.</span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Slider 3: Distance */}
              <div className="flex flex-col gap-2">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-marble/60">Hike Distance</span>
                  <span className="text-white font-bold">{hikeDistance} km</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="15"
                  step="1"
                  value={hikeDistance}
                  onChange={(e) => setHikeDistance(parseInt(e.target.value, 10))}
                  className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-ares-red"
                  aria-label="Trail distance"
                />
              </div>

              {/* Slider 4: Speed */}
              <div className="flex flex-col gap-2">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-marble/60">Walking Speed</span>
                  <span className="text-white font-bold">{hikingSpeed.toFixed(1)} km/h</span>
                </div>
                <input
                  type="range"
                  min="2.0"
                  max="6.0"
                  step="0.5"
                  value={hikingSpeed}
                  onChange={(e) => setHikingSpeed(parseFloat(e.target.value))}
                  className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-ares-red"
                  aria-label="Hiking speed"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Center Panel: SVG Graph & Terrain Incline */}
        <div className="lg:col-span-5 flex flex-col items-center justify-center">
          <div className="w-full max-w-[320px] bg-black/40 border border-white/5 rounded-xl p-4 flex flex-col items-center relative overflow-hidden">
            
            {/* SVG Visualizing the dynamic slope walker & Minetti graph */}
            <svg
              viewBox="0 0 200 280"
              className="w-full h-[280px]"
              role="img"
              aria-label="Minetti U-curve graph plot of metabolic energy cost alongside dynamic hiker walking on a slope."
            >
              <rect width="200" height="280" fill="#0d0f14" rx="8" />

              {/* SECTION A: Slope Visualizer (top half, 0 to 120 height) */}
              <g transform="translate(0, 0)">
                <text x="10" y="20" fill="rgba(255,255,255,0.4)" fontSize="8" fontFamily="monospace">TERRAIN ANGLE</text>
                
                {/* Tilting trail ground */}
                <g transform={`rotate(${gradePct * 0.6}, 100, 75)`}>
                  {/* Trail line */}
                  <line x1="-50" y1="75" x2="250" y2="75" stroke="var(--ares-gold)" strokeWidth="3.5" />
                  <path d="M-50,75 L250,75 L250,110 L-50,110 Z" fill="rgba(255,184,28,0.05)" />

                  {/* Animated Hiker legs walking */}
                  <g transform="translate(100, 75)">
                    {/* Head */}
                    <circle cx="0" cy="-28" r="4.5" fill="var(--marble)" />
                    {/* Torso */}
                    <line x1="0" y1="-23" x2="-2" y2="-10" stroke="var(--marble)" strokeWidth="3" />
                    {/* Arms oscillating */}
                    <line x1="-1" y1="-20" x2="-10" y2="-12" stroke="var(--marble)" strokeWidth="1.5" />
                    {/* Backpack */}
                    <rect x="-9" y="-22" width="6" height="12" fill="var(--ares-red)" rx="1.5" />

                    {/* Dynamic Walking Legs (oscillate slightly based on a simple angle loop or visual lines) */}
                    {/* Leg 1 */}
                    <line x1="-2" y1="-10" x2="-8" y2="0" stroke="var(--marble)" strokeWidth="2.5" />
                    {/* Leg 2 */}
                    <line x1="-2" y1="-10" x2="4" y2="0" stroke="var(--marble)" strokeWidth="2.5" opacity="0.7" />
                  </g>
                </g>
              </g>

              {/* SECTION B: Minetti U-Curve Graph Plot (bottom half, 120 to 280) */}
              <g transform="translate(10, 130)">
                <rect width="180" height="130" fill="#07080b" rx="6" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
                <text x="10" y="15" fill="rgba(255,255,255,0.4)" fontSize="8" fontFamily="monospace">MINETTI CURVE (J/kg/m)</text>

                {/* Draw X/Y axes */}
                <line x1="20" y1="20" x2="20" y2="110" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
                <line x1="20" y1="110" x2="170" y2="110" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
                
                {/* Labels */}
                <text x="12" y="25" fill="rgba(255,255,255,0.2)" fontSize="6" fontFamily="monospace" textAnchor="end">18 -</text>
                <text x="12" y="65" fill="rgba(255,255,255,0.2)" fontSize="6" fontFamily="monospace" textAnchor="end">10 -</text>
                <text x="12" y="105" fill="rgba(255,255,255,0.2)" fontSize="6" fontFamily="monospace" textAnchor="end">2 -</text>

                <text x="20" y="118" fill="rgba(255,255,255,0.2)" fontSize="6" fontFamily="monospace" textAnchor="middle">-30%</text>
                <text x="75" y="118" fill="rgba(255,255,255,0.2)" fontSize="6" fontFamily="monospace" textAnchor="middle">-10%</text>
                <text x="98" y="118" fill="rgba(255,255,255,0.2)" fontSize="6" fontFamily="monospace" textAnchor="middle">0%</text>
                <text x="170" y="118" fill="rgba(255,255,255,0.2)" fontSize="6" fontFamily="monospace" textAnchor="middle">+35%</text>

                {/* Plot the U-curve path */}
                {(() => {
                  // Map X from -30 to +35 to X-coord 20 to 170.
                  // Map Y from 2 to 18 to Y-coord 110 to 20.
                  const getX = (val: number) => 20 + ((val - (-30)) / (35 - (-30))) * 150;
                  const getY = (val: number) => 110 - ((val - 2) / (18 - 2)) * 90;

                  let pathD = '';
                  minettiData.curvePoints.forEach((pt, idx) => {
                    const cx = getX(pt.x);
                    const cy = getY(pt.y);
                    if (idx === 0) pathD += `M ${cx},${cy}`;
                    else pathD += ` L ${cx},${cy}`;
                  });

                  // Tracker dot position
                  const trackerX = getX(gradePct);
                  const trackerY = getY(minettiData.cost);

                  return (
                    <g>
                      {/* Minetti curve line */}
                      <path d={pathD} fill="none" stroke="var(--ares-red)" strokeWidth="2" />
                      
                      {/* Sweet spot indicator overlay (shading) */}
                      <rect x={getX(-12)} y="20" width={getX(-6) - getX(-12)} height="90" fill="var(--ares-cyan)" opacity="0.04" />
                      <line x1={getX(-9)} y1="20" x2={getX(-9)} y2="110" stroke="var(--ares-cyan)" strokeWidth="0.5" strokeDasharray="2 2" opacity="0.4" />

                      {/* Glowing Tracker Dot */}
                      <circle cx={trackerX} cy={trackerY} r="5.5" fill="var(--ares-cyan)" stroke="white" strokeWidth="1.5" />
                      <circle cx={trackerX} cy={trackerY} r="2" fill="white" />
                    </g>
                  );
                })()}
              </g>
            </svg>

            {/* Overlaid gauge */}
            <div className="absolute top-4 left-4 bg-obsidian/90 border border-white/10 rounded px-2.5 py-1 text-[10px] font-mono text-center">
              <span className="text-marble/50">Cost Index:</span>
              <div className="text-white font-bold">{minettiData.cost} J/kg/m</div>
            </div>
          </div>
        </div>

        {/* Bottom Panel: Telemetry Dashboard */}
        <div className="lg:col-span-12 w-full mt-4">
          <div className="bg-white/5 border border-white/5 rounded-lg p-6 flex flex-col gap-6">
            <div>
              <h4 className="text-xs uppercase font-bold tracking-widest text-ares-gold border-b border-white/5 pb-2">
                Mechanical Metrics &amp; Safety Telemetry
              </h4>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch">
              {/* Card 1: Calories expended */}
              <div className="bg-black/20 border border-white/5 rounded-lg p-4 flex flex-col justify-between gap-4">
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-marble/40">Caloric Expenditure</span>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-2xl font-heading font-black text-white">
                      {minettiData.totalCalories} kcal
                    </span>
                  </div>
                  <span className="text-[10px] text-marble/50 mt-1">
                    Total burn over {hikeDistance} km. Active Duration: <strong className="text-white">{minettiData.durationHours.toFixed(1)} hrs</strong>.
                  </span>
                </div>
              </div>

              {/* Card 2: Metabolic Burn Rate */}
              <div className="bg-black/20 border border-white/5 rounded-lg p-4 flex flex-col justify-between gap-4">
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-marble/40">Hourly Burn Rate</span>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-2xl font-heading font-black text-ares-gold">
                      {minettiData.burnRateKcalHr}
                    </span>
                    <span className="text-xs text-marble/50">kcal/hr</span>
                  </div>
                  <span className="text-[10px] text-marble/50 mt-1">
                    Equivalent human power: <strong className="text-white">{ (minettiData.burnRateKcalHr * 1.16222).toFixed(0) } Watts</strong>.
                  </span>
                </div>
              </div>

              {/* Card 3: Slope zone indicator */}
              <div className={`p-4 rounded-lg border text-xs leading-relaxed transition-all flex flex-col justify-between ${zone.bg} ${zone.border} ${zone.color}`}>
                <div>
                  <div className="flex items-center gap-1.5 font-bold mb-1.5">
                    <Heart className="w-4 h-4" />
                    <span>{zone.text}</span>
                  </div>
                  <p className="text-[10px] opacity-80 leading-normal font-sans">
                    {zone.state === 'steep-down'
                      ? 'Walking downhill at steep angles strains leg joints and uses eccentric braking forces that waste metabolic work.'
                      : zone.state === 'optimal'
                      ? 'Minetti efficiency sweet spot! Gravity assists descent. The ideal grade for long, effortless mileage.'
                      : zone.state === 'flat'
                      ? 'Standard flat walking. Stable base metablic cost. The primary zone for normal recovery treks.'
                      : zone.state === 'climb'
                      ? 'Aerobic cardiovascular building zone. Muscle tension increases as you lift your body weight vertically.'
                      : 'High caloric wall! Uphill lift demands immense physical energy. Body is working at 4x flat cost.'}
                  </p>
                </div>
              </div>

              {/* Card 4: In Other Words Cognitive Breakdown */}
              <div className="bg-white/5 border border-white/5 rounded-lg p-4 flex flex-col justify-between gap-3 text-[10px] leading-relaxed text-marble/50">
                <div>
                  <div className="flex items-center gap-1 text-ares-gold font-bold mb-1.5">
                    <Activity className="w-3.5 h-3.5" />
                    <span>IN OTHER WORDS</span>
                  </div>
                  Walking flat requires minor leg work. Going uphill fights gravity, multiplying calorie burn. But going down very steep slopes also burns calories because your thigh muscles must act like brake pads to prevent you from falling over! A gentle 10% downhill is the perfect angle where gravity carries you along with almost no muscle work.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
