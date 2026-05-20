/** @sim {"name": "Cycling Gear Ratios & Cadence", "requiresContext": false} */
import { useState, useMemo, useEffect, useRef } from 'react';
import { Gauge, Milestone } from 'lucide-react';

const WHEEL_PRESETS = [
  { name: 'Road (700x25c)', circumference: 2.105, desc: 'Standard high-pressure skinny road tires.' },
  { name: 'Gravel (700x40c)', circumference: 2.200, desc: 'Wider gravel tires for mixed surfaces.' },
  { name: 'MTB (29" x 2.2")', circumference: 2.300, desc: 'Large diameter mountain bike tires.' },
  { name: 'MTB (26" x 2.0)', circumference: 2.070, desc: 'Classic smaller mountain bike tires.' },
];

export default function CyclingGearRatiosSim() {
  const [frontTeeth, setFrontTeeth] = useState(50); // 30 to 54
  const [rearTeeth, setRearTeeth] = useState(15);   // 11 to 34
  const [cadence, setCadence] = useState(85);       // 40 to 120 RPM
  const [wheelIndex, setWheelIndex] = useState(0);

  const selectedWheel = WHEEL_PRESETS[wheelIndex];

  // Mathematical derivations
  const drivetrainData = useMemo(() => {
    const gearRatio = parseFloat((frontTeeth / rearTeeth).toFixed(2));
    const rollout = parseFloat((gearRatio * selectedWheel.circumference).toFixed(2)); // meters traveled per pedal turn
    
    // speed calculations
    // Cadence (rev/min) * Gear Ratio * wheel circ (meters/rev) * 60 (min/hr) / 1000 (m/km)
    const speedKmh = parseFloat(((cadence * gearRatio * selectedWheel.circumference * 60) / 1000).toFixed(1));
    const speedMph = parseFloat((speedKmh / 1.60934).toFixed(1));

    // Pedaling force / mechanical advantage indicator
    // Higher ratio = harder to pedal. Let's scale it between 1 (easiest) and 5 (hardest)
    const pedalingForceScore = parseFloat(((frontTeeth / rearTeeth) * 1.2).toFixed(1));

    return {
      gearRatio,
      rollout,
      speedKmh,
      speedMph,
      pedalingForceScore
    };
  }, [frontTeeth, rearTeeth, cadence, selectedWheel]);

  // DOM Refs for high-performance sub-render 60fps animations
  const frontSpindleRef = useRef<SVGGElement>(null);
  const rearSpindleRef = useRef<SVGGElement>(null);
  const wheelRef = useRef<SVGGElement>(null);
  const pedalRef = useRef<SVGGElement>(null);
  const chainRef = useRef<SVGLineElement>(null);

  useEffect(() => {
    let animFrameId: number;
    let lastTime = performance.now();
    let frontAngle = 0;
    let rearAngle = 0;
    let chainOffset = 0;

    const update = (time: number) => {
      const deltaSec = (time - lastTime) / 1000;
      lastTime = time;

      // Front spins at cadence RPM (convert to revs per second)
      const frontRps = cadence / 60;
      frontAngle = (frontAngle + frontRps * 360 * deltaSec) % 360;

      // Rear spins proportionally to gear ratio
      const rearRps = frontRps * drivetrainData.gearRatio;
      rearAngle = (rearAngle + rearRps * 360 * deltaSec) % 360;

      if (frontSpindleRef.current) {
        frontSpindleRef.current.style.transform = `rotate(${frontAngle}deg)`;
      }
      if (pedalRef.current) {
        pedalRef.current.style.transform = `rotate(${frontAngle}deg)`;
      }
      if (rearSpindleRef.current) {
        rearSpindleRef.current.style.transform = `rotate(${rearAngle}deg)`;
      }
      if (wheelRef.current) {
        wheelRef.current.style.transform = `rotate(${rearAngle}deg)`;
      }
      if (chainRef.current) {
        // Shifting dash offset to give the illusion of chain links moving
        chainOffset = (chainOffset - frontRps * 180 * deltaSec) % 16;
        chainRef.current.style.strokeDashoffset = `${chainOffset}px`;
      }

      animFrameId = requestAnimationFrame(update);
    };

    animFrameId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(animFrameId);
  }, [cadence, drivetrainData.gearRatio]);

  // Evaluate Cadence zones
  const getCadenceConfig = () => {
    if (cadence < 60) {
      return { text: 'MASHING (Too Slow)', color: 'text-ares-bronze-light', border: 'border-ares-bronze/30', bg: 'bg-ares-bronze/10', state: 'slow' };
    } else if (cadence <= 75) {
      return { text: 'MODERATE (Cruising)', color: 'text-ares-gold', border: 'border-ares-gold/30', bg: 'bg-ares-gold/10', state: 'moderate' };
    } else if (cadence <= 95) {
      return { text: 'OPTIMAL (High Efficiency)', color: 'text-ares-cyan', border: 'border-ares-cyan/30', bg: 'bg-ares-cyan/10', state: 'optimal' };
    } else {
      return { text: 'SPINNING (High Aerobic Load)', color: 'text-ares-gold', border: 'border-ares-gold/30', bg: 'bg-ares-gold/10', state: 'fast' };
    }
  };

  const cadenceZone = getCadenceConfig();

  return (
    <div className="glass-card bg-obsidian border border-white/10 rounded-xl p-6 text-marble shadow-2xl">
      <div className="flex flex-col gap-2 mb-6">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider bg-ares-red/20 text-ares-red border border-ares-red/30">
            Drivetrain Mechanics
          </span>
          <h3 className="text-xl font-heading font-bold text-white tracking-wide">
            Cycling Gear Ratios &amp; Cadence
          </h3>
        </div>
        <p className="text-marble/70 text-sm leading-relaxed max-w-3xl">
          Bicycles leverage leverage. By changing the ratio between the front chainring teeth and rear sprocket teeth, you swap force for speed. High ratios let you reach high speeds, while low ratios offer massive mechanical advantage to crawl up steep mountains.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Panel: Configuration Controls */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          <div className="bg-white/5 border border-white/5 rounded-lg p-5 flex flex-col gap-5">
            <h4 className="text-xs uppercase font-bold tracking-widest text-ares-gold border-b border-white/5 pb-2">
              Parameters
            </h4>

            {/* Slider 1: Front Chainring */}
            <div className="flex flex-col gap-2">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-marble/60">Front Chainring (Chainring Size)</span>
                <span className="text-white font-bold">{frontTeeth} Teeth</span>
              </div>
              <input
                type="range"
                min="30"
                max="54"
                step="1"
                value={frontTeeth}
                onChange={(e) => setFrontTeeth(parseInt(e.target.value, 10))}
                className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-ares-red"
                aria-label="Front chainring tooth count"
              />
              <div className="flex justify-between text-[10px] text-marble/40 font-mono">
                <span>30T (Climbing)</span>
                <span>34T (Compact Inner)</span>
                <span>50T (Compact Outer)</span>
                <span>54T (Pro Sprint)</span>
              </div>
            </div>

            {/* Slider 2: Rear Sprocket */}
            <div className="flex flex-col gap-2">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-marble/60">Rear Cog (Cassette Sprocket)</span>
                <span className="text-white font-bold">{rearTeeth} Teeth</span>
              </div>
              <input
                type="range"
                min="11"
                max="34"
                step="1"
                value={rearTeeth}
                onChange={(e) => setRearTeeth(parseInt(e.target.value, 10))}
                className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-ares-red"
                aria-label="Rear sprocket tooth count"
              />
              <div className="flex justify-between text-[10px] text-marble/40 font-mono">
                <span>11T (Highest Gear)</span>
                <span>15T (Mid Gear)</span>
                <span>28T (Climbing Gear)</span>
                <span>34T (Lowest Gear)</span>
              </div>
            </div>

            {/* Slider 3: Pedal Cadence */}
            <div className="flex flex-col gap-2">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-marble/60">Pedaling Cadence (Pedal RPM)</span>
                <span className="text-white font-bold">{cadence} RPM</span>
              </div>
              <input
                type="range"
                min="40"
                max="120"
                step="5"
                value={cadence}
                onChange={(e) => setCadence(parseInt(e.target.value, 10))}
                className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-ares-red"
                aria-label="Pedal Cadence rate"
              />
              <div className="flex justify-between text-[10px] font-mono text-marble/40">
                <span>40 RPM (Mashing)</span>
                <span>90 RPM (Ideal Target)</span>
                <span>120 RPM (High Spin)</span>
              </div>
            </div>

            {/* Selector: Wheel Presets */}
            <div className="flex flex-col gap-2">
              <label htmlFor="wheelPreset" className="text-xs font-mono text-marble/60">Wheel &amp; Tire Setup</label>
              <select
                id="wheelPreset"
                value={wheelIndex}
                onChange={(e) => setWheelIndex(parseInt(e.target.value, 10))}
                className="w-full bg-black/40 border border-white/10 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-ares-cyan transition-all"
              >
                {WHEEL_PRESETS.map((preset, i) => (
                  <option key={i} value={i} className="bg-obsidian">
                    {preset.name} (Circumference: {preset.circumference}m)
                  </option>
                ))}
              </select>
              <span className="text-[10px] text-marble/40">{selectedWheel.desc}</span>
            </div>
          </div>
        </div>

        {/* Center Panel: SVG Drivetrain Diagram */}
        <div className="lg:col-span-5 flex flex-col items-center justify-center">
          <div className="w-full max-w-[320px] bg-black/40 border border-white/5 rounded-xl p-4 flex flex-col items-center relative overflow-hidden">
            
            <svg
              viewBox="0 0 240 280"
              className="w-full h-[280px]"
              role="img"
              aria-label="Interactive bicycle drivetrain model showing sprockets, chain, and rotating pedal arm."
            >
              <rect width="240" height="280" fill="#0d0f14" rx="8" />

              {/* Rear Wheel (Background spin visualizer) */}
              <g transform="translate(60, 140)">
                <g ref={wheelRef} style={{ transformOrigin: '0px 0px' }}>
                  {/* Tire */}
                  <circle cx="0" cy="0" r="50" fill="none" stroke="rgba(255, 255, 255, 0.04)" strokeWidth="6" />
                  <circle cx="0" cy="0" r="47" fill="none" stroke="rgba(255, 255, 255, 0.1)" strokeWidth="1.5" />
                  {/* Spokes */}
                  {[...Array(12)].map((_, i) => (
                    <line
                      key={i}
                      x1="0"
                      y1="0"
                      x2={47 * Math.cos((i * 30 * Math.PI) / 180)}
                      y2={47 * Math.sin((i * 30 * Math.PI) / 180)}
                      stroke="rgba(255, 255, 255, 0.15)"
                      strokeWidth="1"
                    />
                  ))}
                  {/* Reflective valve stem marker */}
                  <circle cx="40" cy="0" r="2.5" fill="var(--ares-gold)" />
                </g>
              </g>

              {/* Rear Cog (Calculated size based on teeth) */}
              {(() => {
                // Scale radius based on Rear teeth: 11 teeth = ~10px radius, 34 teeth = ~24px radius
                const cogRadius = 10 + ((rearTeeth - 11) / (34 - 11)) * 14;
                // Scale chainring: 30 teeth = ~20px radius, 54 teeth = ~38px radius
                const ringRadius = 20 + ((frontTeeth - 30) / (54 - 30)) * 18;

                const centerRearX = 60;
                const centerRearY = 140;
                const centerFrontX = 180;
                const centerFrontY = 140;

                return (
                  <g>
                    {/* Frame Chainstay tubes */}
                    <line x1={centerRearX} y1={centerRearY} x2={centerFrontX} y2={centerFrontY} stroke="rgba(255,255,255,0.08)" strokeWidth="4" />
                    <line x1={centerRearX} y1={centerRearY} x2={120} y2={70} stroke="rgba(255,255,255,0.08)" strokeWidth="3" />
                    <line x1={centerFrontX} y1={centerFrontY} x2={120} y2={70} stroke="rgba(255,255,255,0.08)" strokeWidth="3" />

                    {/* Chain line (dashed shifting effect) */}
                    {/* Top chain run */}
                    <line
                      ref={chainRef}
                      x1={centerRearX}
                      y1={centerRearY - cogRadius}
                      x2={centerFrontX}
                      y2={centerFrontY - ringRadius}
                      stroke="var(--ares-cyan)"
                      strokeWidth="2.5"
                      strokeDasharray="6 4"
                      style={{ strokeLinecap: 'round' }}
                    />
                    {/* Bottom chain run */}
                    <line
                      x1={centerRearX}
                      y1={centerRearY + cogRadius}
                      x2={centerFrontX}
                      y2={centerFrontY + ringRadius}
                      stroke="var(--ares-cyan)"
                      strokeWidth="2"
                      strokeDasharray="6 4"
                      opacity="0.6"
                    />

                    {/* Rear Cassette (Cog) */}
                    <g transform={`translate(${centerRearX}, ${centerRearY})`}>
                      <g ref={rearSpindleRef} style={{ transformOrigin: '0px 0px' }}>
                        <circle cx="0" cy="0" r={cogRadius} fill="#1e1e1e" stroke="var(--marble)" strokeWidth="1.5" />
                        {/* Sprocket teeth details */}
                        {[...Array(8)].map((_, i) => (
                          <line
                            key={i}
                            x1="0"
                            y1="0"
                            x2={cogRadius * Math.cos((i * 45 * Math.PI) / 180)}
                            y2={cogRadius * Math.sin((i * 45 * Math.PI) / 180)}
                            stroke="rgba(255, 255, 255, 0.4)"
                            strokeWidth="2"
                          />
                        ))}
                      </g>
                    </g>

                    {/* Front Chainring */}
                    <g transform={`translate(${centerFrontX}, ${centerFrontY})`}>
                      <g ref={frontSpindleRef} style={{ transformOrigin: '0px 0px' }}>
                        <circle cx="0" cy="0" r={ringRadius} fill="#1e1e1e" stroke="var(--ares-gold)" strokeWidth="2" />
                        <circle cx="0" cy="0" r={ringRadius - 5} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="2" />
                        {/* Chainring spokes */}
                        {[...Array(5)].map((_, i) => (
                          <line
                            key={i}
                            x1="0"
                            y1="0"
                            x2={(ringRadius - 2) * Math.cos((i * 72 * Math.PI) / 180)}
                            y2={(ringRadius - 2) * Math.sin((i * 72 * Math.PI) / 180)}
                            stroke="var(--ares-gold)"
                            strokeWidth="2.5"
                          />
                        ))}
                      </g>

                      {/* Rotating Pedal Cranks */}
                      <g ref={pedalRef} style={{ transformOrigin: '0px 0px' }}>
                        {/* Left/Rear Pedal Arm (Dimmed) */}
                        <line x1="0" y1="0" x2="-22" y2="-22" stroke="rgba(255, 255, 255, 0.2)" strokeWidth="3" strokeLinecap="round" />
                        <rect x="-27" y="-25" width="10" height="6" fill="rgba(255,255,255,0.3)" rx="1" />

                        {/* Right/Front Pedal Arm */}
                        <line x1="0" y1="0" x2="22" y2="22" stroke="var(--marble)" strokeWidth="3.5" strokeLinecap="round" />
                        <rect x="17" y="19" width="10" height="6" fill="var(--ares-red)" rx="1" stroke="white" strokeWidth="0.5" />
                      </g>
                    </g>
                  </g>
                );
              })()}
            </svg>

            {/* Speed Gauge Float Overlay */}
            <div className="absolute top-4 left-4 bg-obsidian/90 border border-white/10 rounded px-2.5 py-1 text-[10px] font-mono text-center">
              <span className="text-marble/50">Gain Ratio Index:</span>
              <div className="text-white font-bold">{drivetrainData.gearRatio}:1</div>
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
              {/* Card 1: Ratio & Rollout */}
              <div className="bg-black/20 border border-white/5 rounded-lg p-4 flex flex-col justify-between gap-4">
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-marble/40">Rollout Distance</span>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-2xl font-heading font-black text-white">
                      {drivetrainData.rollout}m
                    </span>
                    <span className="text-xs text-marble/50">per turn</span>
                  </div>
                  <span className="text-[10px] text-marble/50 mt-1">
                    In 1 full pedal spin, the bike travels <strong className="text-white">{(drivetrainData.rollout * 3.28084).toFixed(1)} feet</strong> forward.
                  </span>
                </div>
              </div>

              {/* Card 2: Speed Velocity */}
              <div className="bg-black/20 border border-white/5 rounded-lg p-4 flex flex-col justify-between gap-4">
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-marble/40">Bicycle Speed</span>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-2xl font-heading font-black text-ares-cyan">
                      {drivetrainData.speedMph}
                    </span>
                    <span className="text-xs text-ares-cyan/80">MPH</span>
                  </div>
                  <span className="text-[10px] text-marble/50 mt-1">
                    Metric Speed: <strong className="text-white">{drivetrainData.speedKmh} km/h</strong> at selected cadence.
                  </span>
                </div>
              </div>

              {/* Card 3: Cadence Zone Indicator */}
              <div className={`p-4 rounded-lg border text-xs leading-relaxed transition-all flex flex-col justify-between ${cadenceZone.bg} ${cadenceZone.border} ${cadenceZone.color}`}>
                <div>
                  <div className="flex items-center gap-1.5 font-bold mb-1.5">
                    <Gauge className="w-4 h-4" />
                    <span>{cadenceZone.text}</span>
                  </div>
                  <p className="text-[10px] opacity-80 leading-normal font-sans">
                    {cadenceZone.state === 'slow'
                      ? 'Mashing gears at low RPM strains knees and tires muscles quickly due to excessive leg force.'
                      : cadenceZone.state === 'moderate'
                      ? 'Comfortable cruising speed. Good balance of aerobic capacity and leg muscle fatigue.'
                      : cadenceZone.state === 'optimal'
                      ? 'The sweet spot for professional cyclists! Highly efficient, cardiovascular-focused pedaling.'
                      : 'High aerobic spin. Excellent for surges but causes high lung exhaustion over time.'}
                  </p>
                </div>
              </div>

              {/* Card 4: In Other Words Cognitive Breakdown */}
              <div className="bg-white/5 border border-white/5 rounded-lg p-4 flex flex-col justify-between gap-3 text-[10px] leading-relaxed text-marble/50">
                <div>
                  <div className="flex items-center gap-1 text-ares-gold font-bold mb-1.5">
                    <Milestone className="w-3.5 h-3.5" />
                    <span>IN OTHER WORDS</span>
                  </div>
                  Gears are like leverage. A large chainring connected to a tiny rear cog pulls a lot of chain per pedal stroke, spinning the rear wheel multiple times (high gear). A tiny front ring connected to a massive rear sprocket makes pedaling effortless but travels very little distance (climbing gear).
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
