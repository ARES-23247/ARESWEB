/** @sim {"name": "Kayaking Hydrodynamics", "requiresContext": false} */
import { useState, useMemo } from 'react';
import { Waves, Eye } from 'lucide-react';

const KAYAK_PRESETS = [
  { name: 'Whitewater Playboat (8 ft)', lengthFeet: 8, desc: 'Short and highly maneuverable, but slow.' },
  { name: 'Recreational Kayak (12 ft)', lengthFeet: 12, desc: 'Standard stable kayak for lakes and calm rivers.' },
  { name: 'Touring Sea Kayak (15 ft)', lengthFeet: 15, desc: 'Designed for longer treks, balancing speed and cargo.' },
  { name: 'Racing Surfski (18 ft)', lengthFeet: 18, desc: 'Extremely long and narrow, built for maximum raw speed.' },
];

export default function KayakingHydrodynamicsSim() {
  const [presetIndex, setPresetIndex] = useState(1); // Default to Recreational
  const [speedKnots, setSpeedKnots] = useState(4.0); // 1.0 to 8.0 knots

  const selectedKayak = KAYAK_PRESETS[presetIndex];
  const lengthFeet = selectedKayak.lengthFeet;

  const hydroData = useMemo(() => {
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

  const getPowerConfig = () => {
    const watts = hydroData.powerWatts;
    if (watts < 80) {
      return { text: 'SUSTAINED (Recreational Paddle)', color: 'text-ares-cyan', border: 'border-ares-cyan/30', bg: 'bg-ares-cyan/10', state: 'sustained' };
    } else if (watts <= 200) {
      return { text: 'FITNESS (Aerobic Workout)', color: 'text-ares-gold', border: 'border-ares-gold/30', bg: 'bg-ares-gold/10', state: 'fitness' };
    } else if (watts <= 350) {
      return { text: 'THRESHOLD (Heavy Strain)', color: 'text-ares-bronze-light', border: 'border-ares-bronze/30', bg: 'bg-ares-bronze/10', state: 'threshold' };
    } else {
      return { text: 'SPRINT BURNOUT (Max Anaerobic)', color: 'text-ares-red-light', border: 'border-ares-red/30', bg: 'bg-ares-red/10', state: 'critical' };
    }
  };

  const powerState = getPowerConfig();

  return (
    <div className="glass-card bg-obsidian border border-white/10 rounded-xl p-6 text-marble shadow-2xl">
      <div className="flex flex-col gap-2 mb-6">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider bg-ares-red/20 text-ares-red border border-ares-red/30">
            Fluid Hydrodynamics
          </span>
          <h3 className="text-xl font-heading font-bold text-white tracking-wide">
            Kayaking Hydrodynamics &amp; Hull Drag
          </h3>
        </div>
        <p className="text-marble/70 text-sm leading-relaxed max-w-3xl">
          Displacement hulls (like kayaks) create waves as they push water aside. As your speed increases, these waves grow longer. When speed reaches the Hull Speed, the kayak is trapped in a trough between its own bow and stern wave. Going faster requires climbing over your own wave!
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Panel: Configuration Controls */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          <div className="bg-white/5 border border-white/5 rounded-lg p-5 flex flex-col gap-5">
            <h4 className="text-xs uppercase font-bold tracking-widest text-ares-gold border-b border-white/5 pb-2">
              Parameters
            </h4>

            {/* Selector: Kayak Preset */}
            <div className="flex flex-col gap-2">
              <label htmlFor="kayakPreset" className="text-xs font-mono text-marble/60">Kayak Design / Waterline Length</label>
              <select
                id="kayakPreset"
                value={presetIndex}
                onChange={(e) => setPresetIndex(parseInt(e.target.value, 10))}
                className="w-full bg-black/40 border border-white/10 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-ares-cyan transition-all"
              >
                {KAYAK_PRESETS.map((preset, i) => (
                  <option key={i} value={i} className="bg-obsidian">
                    {preset.name}
                  </option>
                ))}
              </select>
              <span className="text-[10px] text-marble/40">{selectedKayak.desc}</span>
            </div>

            {/* Slider: Paddling Speed */}
            <div className="flex flex-col gap-2">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-marble/60">Paddling Speed (Velocity)</span>
                <span className="text-white font-bold">{speedKnots} knots</span>
              </div>
              <input
                type="range"
                min="1.0"
                max="8.0"
                step="0.2"
                value={speedKnots}
                onChange={(e) => setSpeedKnots(parseFloat(e.target.value))}
                className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-ares-red"
                aria-label="Paddling speed in knots"
              />
              <div className="flex justify-between text-[10px] font-mono text-marble/40">
                <span>1.0 knot (Drift)</span>
                <span>{hydroData.hullSpeedKnots} knots (Hull Speed)</span>
                <span>8.0 knots (Sprint)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Center Panel: SVG Fluid Analysis */}
        <div className="lg:col-span-5 flex flex-col items-center justify-center">
          <div className="w-full max-w-[320px] bg-black/40 border border-white/5 rounded-xl p-4 flex flex-col items-center relative overflow-hidden">
            
            <svg
              viewBox="0 0 200 280"
              className="w-full h-[280px]"
              role="img"
              aria-label="Interactive fluid dynamic simulation of a kayak creating gravity waves."
            >
              <rect width="200" height="280" fill="#0d0f14" rx="8" />

              {/* Sky background / water divider */}
              <rect width="200" height="150" fill="#0b0b0f" />
              <rect y="150" width="200" height="130" fill="#08101a" />

              {/* Dynamic Water Waves */}
              {(() => {
                // Wave properties based on speed ratio
                // At high ratios, wave is large and has long wavelength
                const ratio = hydroData.speedRatio;
                const waveHeight = 5 + Math.min(20, Math.max(0, ratio - 0.4) * 18);
                
                // Wavelength changes: low speed = many small waves. High speed = 1 wave equal to boat length
                const numWaves = ratio < 0.6 ? 4 : ratio < 0.9 ? 2 : 1;
                
                // Build SVG path for water wave
                // Left boundary is X=-10, Right is X=210
                let d = 'M -10,150';
                for (let x = -10; x <= 210; x += 10) {
                  // Phase/wave function
                  const angle = (x / 200) * Math.PI * 2 * numWaves - (ratio * Math.PI * 0.5);
                  const y = 150 + Math.sin(angle) * waveHeight;
                  d += ` L ${x},${y}`;
                }
                d += ' L 210,280 L -10,280 Z';

                return (
                  <path
                    d={d}
                    fill="url(#water-gradient)"
                    stroke="var(--ares-cyan)"
                    strokeWidth="1.5"
                    opacity="0.85"
                  />
                );
              })()}

              {/* DEFINITIONS FOR GRADIENTS */}
              <defs>
                <linearGradient id="water-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#082b4a" />
                  <stop offset="100%" stopColor="#030c14" />
                </linearGradient>
              </defs>

              {/* Kayak Graphic group (tilted by dynamic pitch angle) */}
              {(() => {
                // Kayak visual width scales with waterline length: 8ft = ~90px, 18ft = ~160px
                const kayakW = 80 + ((lengthFeet - 8) / (18 - 8)) * 70;
                const centerStartX = 100 - kayakW / 2;

                return (
                  <g transform={`translate(100, 142) rotate(${-hydroData.tiltAngle}, 0, 0) translate(-100, -142)`}>
                    {/* Kayak hull */}
                    {/* Top deck line */}
                    <path
                      d={`M ${centerStartX},142 C ${centerStartX + 10},137 ${centerStartX + kayakW - 10},137 ${centerStartX + kayakW},142 C ${centerStartX + kayakW - 5},147 ${centerStartX + 5},147 ${centerStartX},142 Z`}
                      fill="var(--ares-red)"
                      stroke="white"
                      strokeWidth="1"
                    />

                    {/* Paddler representation */}
                    <g transform={`translate(100, 140)`}>
                      {/* Body */}
                      <rect x="-3" y="-20" width="6" height="15" fill="var(--marble)" rx="2" />
                      <circle cx="0" cy="-24" r="4.5" fill="var(--marble)" />
                      {/* Paddle Shaft */}
                      <line x1="-25" y1="-8" x2="25" y2="-8" stroke="var(--ares-gold)" strokeWidth="2.5" />
                      {/* Paddle blades */}
                      <polygon points="-25,-12 -33,-8 -25,-4" fill="var(--ares-gold)" />
                      <polygon points="25,-12 33,-8 25,-4" fill="var(--ares-gold)" />
                    </g>
                  </g>
                );
              })()}

              {/* Force indicator overlays */}
              {hydroData.speedRatio >= 1.0 && (
                <g>
                  {/* Warning barrier bar */}
                  <line x1="160" y1="90" x2="160" y2="135" stroke="var(--ares-red)" strokeWidth="3" strokeDasharray="3 3" />
                  <text x="155" y="85" textAnchor="end" fill="var(--ares-red)" fontSize="7" fontFamily="monospace">HULL SPEED WALL</text>
                </g>
              )}
            </svg>

            {/* Overlaid gauge */}
            <div className="absolute top-4 left-4 bg-obsidian/90 border border-white/10 rounded px-2.5 py-1 text-[10px] font-mono text-center">
              <span className="text-marble/50">Speed Ratio:</span>
              <div className="text-white font-bold">{hydroData.speedRatio}x Hull</div>
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
              {/* Card 1: Power Required */}
              <div className="bg-black/20 border border-white/5 rounded-lg p-4 flex flex-col justify-between gap-4">
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-marble/40">Human Power Needed</span>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-2xl font-heading font-black text-white">
                      {hydroData.powerWatts} Watts
                    </span>
                  </div>
                  <span className="text-[10px] text-marble/50 mt-1">
                    Equates to <strong className="text-white">{(hydroData.powerWatts / 745.7).toFixed(2)} HP</strong> of continuous human engine output.
                  </span>
                </div>
              </div>

              {/* Card 2: Hull Speed limits */}
              <div className="bg-black/20 border border-white/5 rounded-lg p-4 flex flex-col justify-between gap-4">
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-marble/40">Hull Speed Barrier</span>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-2xl font-heading font-black text-ares-gold">
                      {hydroData.hullSpeedKnots} kts
                    </span>
                    <span className="text-xs text-marble/50">limit</span>
                  </div>
                  <span className="text-[10px] text-marble/50 mt-1">
                    Imperial limit: <strong className="text-white">{hydroData.hullSpeedMph} MPH</strong>. Wavelength matches hull.
                  </span>
                </div>
              </div>

              {/* Card 3: Power State Indicator */}
              <div className={`p-4 rounded-lg border text-xs leading-relaxed transition-all flex flex-col justify-between ${powerState.bg} ${powerState.border} ${powerState.color}`}>
                <div>
                  <div className="flex items-center gap-1.5 font-bold mb-1.5">
                    <Waves className="w-4 h-4" />
                    <span>{powerState.text}</span>
                  </div>
                  <p className="text-[10px] opacity-80 leading-normal font-sans">
                    {powerState.state === 'sustained'
                      ? 'Comfortable touring pace. Can be maintained for hours. Ideal for sightseeing or exploring.'
                      : powerState.state === 'fitness'
                      ? 'High aerobic workout pace. Excellent for cardiovascular fitness. Maintainable for 1-2 hours.'
                      : powerState.state === 'threshold'
                      ? 'Exceeds anaerobic threshold. Wastes massive energy creating tall waves. Maintainable for 10-20 minutes.'
                      : 'Severe sprint! Wavelength climbs past the hull. Almost all your effort goes into pushing waves aside.'}
                  </p>
                </div>
              </div>

              {/* Card 4: In Other Words Cognitive Breakdown */}
              <div className="bg-white/5 border border-white/5 rounded-lg p-4 flex flex-col justify-between gap-3 text-[10px] leading-relaxed text-marble/50">
                <div>
                  <div className="flex items-center gap-1 text-ares-gold font-bold mb-1.5">
                    <Eye className="w-3.5 h-3.5" />
                    <span>IN OTHER WORDS</span>
                  </div>
                  A moving kayak generates wave ripples. The maximum speed a wave can travel depends on its length. Once your speed causes the wave crests to match the length of your boat, the kayak gets trapped. To go any faster, you must climb up your own bow wave, which requires exponential power!
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
