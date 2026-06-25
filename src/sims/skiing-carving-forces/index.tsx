/** @sim {"name": "Skiing Carving Forces", "requiresContext": false} */
import { useState, useMemo } from 'react';
import { ShieldCheck, ShieldAlert, Navigation } from 'lucide-react';

export default function SkiingCarvingForcesSim() {
  const [speedKmh, setSpeedKmh] = useState(35); // 10 to 60 km/h
  const [turnRadius, setTurnRadius] = useState(15); // 5 to 35 meters
  const [edgeAngle, setEdgeAngle] = useState(45); // 10 to 80 degrees
  const [slopeGrade, setSlopeGrade] = useState(15); // 0 to 40 degrees (visual tilt)

  const GRAVITY = 9.81;
  const skierMass = 75; // kg (assumed average)

  const carvingData = useMemo(() => {
    const speedMs = speedKmh / 3.6;
    
    // Centripetal Acceleration: a = v^2 / R
    const centripetalAcc = (speedMs * speedMs) / turnRadius;
    
    // Resultant G-Force: G = sqrt(1 + (a/g)^2)
    const gForce = parseFloat(Math.sqrt(1 + Math.pow(centripetalAcc / GRAVITY, 2)).toFixed(2));
    
    // Required Lean Angle relative to vertical: tan(theta) = a / g
    const targetLeanRad = Math.atan(centripetalAcc / GRAVITY);
    const targetLeanDeg = parseFloat(((targetLeanRad * 180) / Math.PI).toFixed(1));

    // Skidding vs Carving Efficiency based on Edge Angle vs Target Lean Angle
    // In a clean carve, edge angle must be at least equal to or slightly greater than lean angle
    const angleDifference = Math.abs(edgeAngle - targetLeanDeg);
    const efficiency = Math.max(0, Math.min(100, Math.round(100 - angleDifference * 3)));

    // Net Forces in Newtons
    const forceCentripetalN = parseFloat((skierMass * centripetalAcc).toFixed(0));
    const forceGravityN = parseFloat((skierMass * GRAVITY).toFixed(0));
    const forceResultantN = parseFloat((skierMass * GRAVITY * gForce).toFixed(0));

    return {
      speedMs,
      centripetalAcc,
      gForce,
      targetLeanDeg,
      efficiency,
      forceCentripetalN,
      forceGravityN,
      forceResultantN
    };
  }, [speedKmh, turnRadius, edgeAngle]);

  const getSafetyConfig = () => {
    const eff = carvingData.efficiency;
    if (eff >= 85) {
      return { text: 'PERFECT CARVE (No Skidding)', color: 'text-ares-cyan', border: 'border-ares-cyan/30', bg: 'bg-ares-cyan/10', state: 'perfect' };
    } else if (eff >= 60) {
      return { text: 'PARTIAL SLIDE (Slight Skidding)', color: 'text-ares-gold', border: 'border-ares-gold/30', bg: 'bg-ares-gold/10', state: 'partial' };
    } else {
      return { text: 'SEVERED CARVE (Severe Skid/Plume)', color: 'text-ares-red-light', border: 'border-ares-red/30', bg: 'bg-ares-red/10', state: 'skid' };
    }
  };

  const safety = getSafetyConfig();

  return (
    <div className="glass-card bg-obsidian border border-white/10 rounded-xl p-6 text-marble shadow-2xl">
      <div className="flex flex-col gap-2 mb-6">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider bg-ares-red/20 text-ares-red border border-ares-red/30">
            Centripetal Dynamics
          </span>
          <h3 className="text-xl font-heading font-bold text-white tracking-wide">
            Skiing &amp; Snowboarding Carving Forces
          </h3>
        </div>
        <p className="text-marble/70 text-sm leading-relaxed max-w-3xl">
          Carving is the art of riding on edge without slipping sideways. To carve cleanly, you must tilt your skis or board, leaning your body inside the turn at the exact angle where the outward push of centripetal force balances the downward pull of gravity!
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Panel: Configuration Controls */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          <div className="bg-white/5 border border-white/5 rounded-lg p-5 flex flex-col gap-5">
            <h4 className="text-xs uppercase font-bold tracking-widest text-ares-gold border-b border-white/5 pb-2">
              Parameters
            </h4>

            {/* Slider 1: Speed */}
            <div className="flex flex-col gap-2">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-marble/60">Skiing Velocity (Speed)</span>
                <span className="text-white font-bold">{speedKmh} km/h</span>
              </div>
              <input
                type="range"
                min="10"
                max="60"
                step="2"
                value={speedKmh}
                onChange={(e) => setSpeedKmh(parseInt(e.target.value, 10))}
                className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-ares-red"
                aria-label="Skiing speed"
              />
              <div className="flex justify-between text-[10px] text-marble/40 font-mono">
                <span>10 km/h (Slow)</span>
                <span>35 km/h (Moderate)</span>
                <span>60 km/h (High Speed)</span>
              </div>
            </div>

            {/* Slider 2: Turn Radius */}
            <div className="flex flex-col gap-2">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-marble/60">Turn Radius (Arc Size)</span>
                <span className="text-white font-bold">{turnRadius} meters</span>
              </div>
              <input
                type="range"
                min="5"
                max="35"
                step="1"
                value={turnRadius}
                onChange={(e) => setTurnRadius(parseInt(e.target.value, 10))}
                className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-ares-red"
                aria-label="Turn arc radius"
              />
              <div className="flex justify-between text-[10px] text-marble/40 font-mono">
                <span>5m (Slalom Hook)</span>
                <span>15m (Medium GS Arc)</span>
                <span>35m (Super-G Wide sweep)</span>
              </div>
            </div>

            {/* Slider 3: Edge Angle */}
            <div className="flex flex-col gap-2">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-marble/60">Ski/Board Edge Tilt Angle</span>
                <span className="text-white font-bold">{edgeAngle}&deg;</span>
              </div>
              <input
                type="range"
                min="10"
                max="80"
                step="2"
                value={edgeAngle}
                onChange={(e) => setEdgeAngle(parseInt(e.target.value, 10))}
                className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-ares-red"
                aria-label="Ski edge angle to ground"
              />
              <div className="flex justify-between text-[10px] text-marble/40 font-mono">
                <span>10&deg; (Flat Base)</span>
                <span>45&deg; (Carved Turn)</span>
                <span>80&deg; (Extreme Extreme Lean)</span>
              </div>
            </div>

            {/* Slider 4: Slope steepness */}
            <div className="flex flex-col gap-2">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-marble/60">Slope Steepness (Grade)</span>
                <span className="text-white font-bold">{slopeGrade}&deg;</span>
              </div>
              <input
                type="range"
                min="0"
                max="40"
                step="5"
                value={slopeGrade}
                onChange={(e) => setSlopeGrade(parseInt(e.target.value, 10))}
                className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-ares-red"
                aria-label="Mountain slope incline angle"
              />
            </div>
          </div>
        </div>

        {/* Center Panel: SVG Vector Balance Diagram */}
        <div className="lg:col-span-5 flex flex-col items-center justify-center">
          <div className="w-full max-w-[320px] bg-black/40 border border-white/5 rounded-xl p-4 flex flex-col items-center relative overflow-hidden">
            
            <svg
              viewBox="0 0 200 280"
              className="w-full h-[280px]"
              role="img"
              aria-label="Ski carving force vector analysis showing center of mass lean and resultant pressure vectors."
            >
              <rect width="200" height="280" fill="#0d0f14" rx="8" />

              {/* Slope Line (rotated around center bottom 100, 240) */}
              <g transform={`rotate(${slopeGrade}, 100, 240)`}>
                {/* Snowy mountain slope */}
                <line x1="-50" y1="240" x2="250" y2="240" stroke="white" strokeWidth="4" />
                <path d="M-50,240 L250,240 L250,300 L-50,300 Z" fill="rgba(255,255,255,0.05)" />

                {/* Carve tracks / snow spray visual effect */}
                {safety.state === 'perfect' ? (
                  <path
                    d="M100,240 Q105,243 115,248 M100,240 Q95,243 85,248"
                    stroke="var(--ares-cyan)"
                    strokeWidth="3"
                    fill="none"
                    opacity="0.8"
                  />
                ) : safety.state === 'partial' ? (
                  <path
                    d="M100,240 Q110,245 125,250 M100,240 Q90,245 75,250"
                    stroke="var(--ares-gold)"
                    strokeWidth="3.5"
                    strokeDasharray="2 3"
                    fill="none"
                    opacity="0.7"
                  />
                ) : (
                  // Massive spray plumes
                  <g opacity="0.8">
                    <circle cx="115" cy="235" r="4" fill="rgba(255,255,255,0.4)" />
                    <circle cx="85" cy="235" r="4" fill="rgba(255,255,255,0.4)" />
                    <circle cx="125" cy="225" r="6" fill="rgba(255,255,255,0.2)" />
                    <circle cx="75" cy="225" r="6" fill="rgba(255,255,255,0.2)" />
                    <line x1="100" y1="240" x2="135" y2="220" stroke="var(--ares-red)" strokeWidth="2.5" />
                    <line x1="100" y1="240" x2="65" y2="220" stroke="var(--ares-red)" strokeWidth="2.5" />
                  </g>
                )}

                {/* Skis / Board edge angle marker */}
                <g transform="translate(100, 240)">
                  <g transform={`rotate(${-edgeAngle}, 0, 0)`}>
                    <line x1="-15" y1="0" x2="15" y2="0" stroke="var(--ares-gold)" strokeWidth="3" />
                    {/* ski tips */}
                    <line x1="15" y1="0" x2="18" y2="-4" stroke="var(--ares-gold)" strokeWidth="2.5" />
                  </g>
                </g>

                {/* Skier body vector diagram leaning */}
                {(() => {
                  // Skier's hip / Center of mass is placed at lean angle
                  const leanRad = (carvingData.targetLeanDeg * Math.PI) / 180;
                  const legL = 90; // visual length
                  
                  // Skier leans left (into turn) visually: X shifts left, Y goes up
                  const skierX = 100 - legL * Math.sin(leanRad);
                  const skierY = 240 - legL * Math.cos(leanRad);

                  return (
                    <g>
                      {/* Skier Legs / Body Line */}
                      <line x1="100" y1="240" x2={skierX} y2={skierY} stroke="var(--marble)" strokeWidth="4" strokeLinecap="round" />
                      
                      {/* Skier Head (COM marker) */}
                      <circle cx={skierX} cy={skierY} r="8" fill="var(--ares-red)" stroke="white" strokeWidth="2" />
                      <circle cx={skierX} cy={skierY} r="3" fill="white" />

                      {/* FORCE VECTORS drawing from skier center of mass */}
                      
                      {/* Gravity Vector (Straight down relative to screen gravity) */}
                      {/* To represent screen vertical, we adjust for slope rotation: slope grade is added or subtracted */}
                      <g transform={`translate(${skierX}, ${skierY})`}>
                        <g transform={`rotate(${-slopeGrade}, 0, 0)`}>
                          {/* Gravity (Straight Down) */}
                          <line x1="0" y1="0" x2="0" y2="55" stroke="var(--ares-red-light)" strokeWidth="2" />
                          <polygon points="0,55 -3,50 3,50" fill="var(--ares-red-light)" />
                          <text x="5" y="45" fill="var(--ares-red-light)" fontSize="7" fontFamily="monospace">GRAV</text>

                          {/* Centripetal Force (Horizontal left) */}
                          <line x1="0" y1="0" x2="45" y2="0" stroke="var(--ares-bronze)" strokeWidth="2" />
                          <polygon points="45,0 40,-3 40,3" fill="var(--ares-bronze)" />
                          <text x="25" y="-5" fill="var(--ares-bronze)" fontSize="7" fontFamily="monospace">CENT</text>
                        </g>

                        {/* Resultant Balance Line (pointing along body alignment back to contact patch) */}
                        <line x1="0" y1="0" x2={100 - skierX} y2={240 - skierY} stroke="var(--ares-cyan)" strokeWidth="1.5" strokeDasharray="3 3" />
                      </g>
                    </g>
                  );
                })()}
              </g>
            </svg>

            {/* Float Indicator */}
            <div className="absolute top-4 left-4 bg-obsidian/90 border border-white/10 rounded px-2.5 py-1 text-[10px] font-mono text-center">
              <span className="text-marble/50">Required Lean:</span>
              <div className="text-white font-bold">{carvingData.targetLeanDeg}&deg;</div>
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
              {/* Card 1: G-Force */}
              <div className="bg-black/20 border border-white/5 rounded-lg p-4 flex flex-col justify-between gap-4">
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-marble/40">G-Force Felt</span>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className={`text-2xl font-heading font-black ${
                      carvingData.gForce > 2.0 ? 'text-ares-red' : carvingData.gForce > 1.4 ? 'text-ares-gold' : 'text-marble'
                    }`}>
                      {carvingData.gForce} Gs
                    </span>
                    <span className="text-xs text-marble/50">load</span>
                  </div>
                  <span className="text-[10px] text-marble/50 mt-1">
                    Skier effective weight: <strong className="text-white">{carvingData.forceResultantN} N</strong> ({ (carvingData.forceResultantN * 0.2248).toFixed(0) } lbs).
                  </span>
                </div>
              </div>

              {/* Card 2: Skidding Centripetal force */}
              <div className="bg-black/20 border border-white/5 rounded-lg p-4 flex flex-col justify-between gap-4">
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-marble/40">Centripetal Force</span>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-2xl font-heading font-black text-white">
                      {carvingData.forceCentripetalN} N
                    </span>
                    <span className="text-xs text-marble/50">lateral</span>
                  </div>
                  <span className="text-[10px] text-marble/50 mt-1">
                    Lateral acceleration: <strong className="text-white">{carvingData.centripetalAcc.toFixed(1)} m/s&sup2;</strong>.
                  </span>
                </div>
              </div>

              {/* Card 3: Carving efficiency */}
              <div className={`p-4 rounded-lg border text-xs leading-relaxed transition-all flex flex-col justify-between ${safety.bg} ${safety.border} ${safety.color}`}>
                <div>
                  <div className="flex items-center gap-1.5 font-bold mb-1.5">
                    {safety.state === 'perfect' ? (
                      <ShieldCheck className="w-4 h-4" />
                    ) : (
                      <ShieldAlert className="w-4 h-4" />
                    )}
                    <span>{safety.text}</span>
                  </div>
                  <p className="text-[10px] opacity-80 leading-normal font-sans">
                    {safety.state === 'perfect'
                      ? 'Optimal balance! Skis cut razor-thin tracks. Kinetic energy is fully preserved in the exit.'
                      : safety.state === 'partial'
                      ? 'Minor skidding. Skis are angled slightly off the force vector, creating drag and reducing exit speed.'
                      : 'Severe skidding! The edge angle is disconnected from centripetal demands, forcing skis to plow sideways.'}
                  </p>
                </div>
              </div>

              {/* Card 4: In Other Words Cognitive Breakdown */}
              <div className="bg-white/5 border border-white/5 rounded-lg p-4 flex flex-col justify-between gap-3 text-[10px] leading-relaxed text-marble/50">
                <div>
                  <div className="flex items-center gap-1 text-ares-gold font-bold mb-1.5">
                    <Navigation className="w-3.5 h-3.5" />
                    <span>IN OTHER WORDS</span>
                  </div>
                  Imagine swinging a bucket of water overhead. The faster you swing it, the harder the water presses outward against the bucket bottom (centripetal force). When carving, you must lean your body inside the turn at the exact angle where this outward swing balances the gravity trying to pull you down!
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
