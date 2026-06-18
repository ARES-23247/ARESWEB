/** @sim {"name": "Capstan Friction & Belay Dynamics", "requiresContext": false} */
import { useState, useEffect, useRef, useMemo } from 'react';
import { Play, Flame, Thermometer, ShieldAlert, Sparkles } from 'lucide-react';

export default function ClimbingCapstanFrictionSim() {
  const [wrapDegrees, setWrapDegrees] = useState(180); // wrap angle in degrees (0 to 540)
  const [frictionCoef, setFrictionCoef] = useState(0.3); // coefficient of friction (0.1 to 0.6)
  const [climberWeight, setClimberWeight] = useState(80); // kg
  const [lowerSpeed, setLowerSpeed] = useState(2.0); // m/s lowering speed

  // Animation & Heating states
  const [isLowering, setIsLowering] = useState(false);
  const [deviceTemp, setDeviceTemp] = useState(22.0); // start at ambient 22°C
  const [totalHeatJoules, setTotalHeatJoules] = useState(0);
  const [lowerProgress, setLowerProgress] = useState(0); // 0% to 100% of 15m lower

  const animRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);

  const GRAVITY = 9.81;
  const weightN = climberWeight * GRAVITY;

  // Calculate static Capstan friction forces
  const capstanData = useMemo(() => {
    const wrapRadians = (wrapDegrees * Math.PI) / 180;
    
    // Friction multiplier = e^(mu * theta)
    const multiplier = Math.exp(frictionCoef * wrapRadians);
    
    // Required holding force = Load / Multiplier
    const holdingForceN = weightN / multiplier;
    
    const holdingForceLbs = parseFloat((holdingForceN * 0.2248).toFixed(1));
    const climberForceLbs = parseFloat((weightN * 0.2248).toFixed(1));

    return {
      wrapRadians,
      multiplier,
      holdingForceN,
      holdingForceLbs,
      climberForceLbs
    };
  }, [wrapDegrees, frictionCoef, weightN]);

  // Handle lowered rope friction heat accumulation
  // Carabiner mass = 0.08 kg (80 grams of aluminum)
  // Specific Heat Capacity of Aluminum = 900 J/(kg*°C)
  const CARABINER_MASS = 0.08;
  const HEAT_CAPACITY = 900;

  const triggerLower = () => {
    setIsLowering(true);
    setLowerProgress(0);
    setTotalHeatJoules(0);
    lastTimeRef.current = performance.now();
  };

  useEffect(() => {
    if (!isLowering) {
      // Natural cooling over time (exponential decay to ambient 22°C)
      const coolingInterval = setInterval(() => {
        setDeviceTemp(t => {
          if (t <= 22.1) return 22.0;
          return t - (t - 22.0) * 0.05;
        });
      }, 500);
      return () => clearInterval(coolingInterval);
    }

    const animateLowering = (now: number) => {
      if (!lastTimeRef.current) lastTimeRef.current = now;
      const elapsed = (now - lastTimeRef.current) / 1000;
      lastTimeRef.current = now;

      // Cap dt
      const dt = Math.min(elapsed, 0.1);

      // Lowering progress (lower 15 meters total)
      const TOTAL_DISTANCE = 15; // meters
      const distanceLowered = lowerSpeed * dt;
      
      setLowerProgress(p => {
        const nextP = p + (distanceLowered / TOTAL_DISTANCE) * 100;
        if (nextP >= 100) {
          setIsLowering(false);
          return 100;
        }
        return nextP;
      });

      // Heat generated: Q = Friction Force * distance
      // Friction force is the load difference: F_fric = Weight - HoldingForce
      const frictionForce = Math.max(0, weightN - capstanData.holdingForceN);
      const heatQ = frictionForce * distanceLowered;

      setTotalHeatJoules(q => q + heatQ);

      // Temperature increase delta_T = Q / (m * c)
      const deltaT = heatQ / (CARABINER_MASS * HEAT_CAPACITY);
      setDeviceTemp(t => Math.min(150, t + deltaT));

      animRef.current = requestAnimationFrame(animateLowering);
    };

    animRef.current = requestAnimationFrame(animateLowering);

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [isLowering, lowerSpeed, weightN, capstanData.holdingForceN]);

  // Determine hot warning states
  const getTempWarning = () => {
    if (deviceTemp >= 90) {
      return { text: 'BURN RISK! (Extremely Hot)', color: 'text-ares-red-light', bg: 'bg-ares-red/10', border: 'border-ares-red/30' };
    } else if (deviceTemp >= 50) {
      return { text: 'Device Hot (Friction Heating)', color: 'text-ares-gold', bg: 'bg-ares-gold/10', border: 'border-ares-gold/30' };
    } else {
      return { text: 'Optimal Operating Temp', color: 'text-ares-cyan', bg: 'bg-ares-cyan/10', border: 'border-ares-cyan/30' };
    }
  };

  const tempWarning = getTempWarning();

  return (
    <div className="glass-card bg-obsidian border border-white/10 rounded-xl p-6 text-marble shadow-2xl">
      <div className="flex flex-col gap-2 mb-6">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider bg-ares-red/20 text-ares-red border border-ares-red/30">
            Tribology & Thermodynamics
          </span>
          <h3 className="text-xl font-heading font-bold text-white tracking-wide">
            Capstan Friction & Belay Dynamics
          </h3>
        </div>
        <p className="text-marble/70 text-sm leading-relaxed max-w-3xl">
          Ever wonder how a small belayer can hold a climber twice their size? The <strong>Capstan Equation</strong> explains how wrapping a rope around a curved surface multiplies friction exponentially. Explore the math, and see how dynamic friction converts kinetic energy into intense heat.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Panel: Parameters */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          <div className="bg-white/5 border border-white/5 rounded-lg p-5 flex flex-col gap-5">
            <h4 className="text-xs uppercase font-bold tracking-widest text-ares-gold border-b border-white/5 pb-2">
              Parameters
            </h4>

            {/* Slider 1: Wrap Angle */}
            <div className="flex flex-col gap-2">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-marble/60">Rope Wrap Angle (&theta;)</span>
                <span className="text-white font-bold">{wrapDegrees}&deg; ({ (wrapDegrees / 360).toFixed(2) } wraps)</span>
              </div>
              <input
                type="range"
                min="0"
                max="540"
                step="30"
                value={wrapDegrees}
                onChange={(e) => setWrapDegrees(parseInt(e.target.value, 10))}
                disabled={isLowering}
                className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-ares-red"
                aria-label="Wrap angle in degrees around the cylinder"
              />
              <span className="text-[10px] text-marble/40">Wrapping the rope further multiplies friction exponentially!</span>
            </div>

            {/* Slider 2: Friction Coef */}
            <div className="flex flex-col gap-2">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-marble/60">Friction Coefficient (&mu;)</span>
                <span className="text-white font-bold">{frictionCoef.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0.10"
                max="0.60"
                step="0.05"
                value={frictionCoef}
                onChange={(e) => setFrictionCoef(parseFloat(e.target.value))}
                disabled={isLowering}
                className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-ares-red"
                aria-label="Friction coefficient between rope and steel/aluminum cylinder"
              />
            </div>

            {/* Slider 3: Climber Weight */}
            <div className="flex flex-col gap-2">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-marble/60">Climber Weight (Load)</span>
                <span className="text-white font-bold">{climberWeight} kg</span>
              </div>
              <input
                type="range"
                min="50"
                max="100"
                step="5"
                value={climberWeight}
                onChange={(e) => setClimberWeight(parseInt(e.target.value, 10))}
                disabled={isLowering}
                className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-ares-red"
                aria-label="Climber weight load"
              />
            </div>

            {/* Slider 4: Lowering Speed */}
            <div className="flex flex-col gap-2">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-marble/60">Lowering Speed (Heat Generation)</span>
                <span className="text-white font-bold">{lowerSpeed.toFixed(1)} m/s</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="4.0"
                step="0.5"
                value={lowerSpeed}
                onChange={(e) => setLowerSpeed(parseFloat(e.target.value))}
                disabled={isLowering}
                className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-ares-red"
                aria-label="Lowering speed of the climber"
              />
            </div>

            {/* Lower Climber Trigger */}
            <button
              onClick={triggerLower}
              disabled={isLowering}
              className="px-4 py-2.5 rounded-lg bg-ares-red text-white hover:bg-ares-bronze font-bold text-sm tracking-wide disabled:opacity-50 transition-all flex items-center justify-center gap-2"
              aria-label="Lower the climber to simulate heat generation"
            >
              <Play className="w-4 h-4 fill-white" />
              Lower Climber (Friction Run)
            </button>
          </div>
        </div>

        {/* Center Panel: SVG cylinder wraps */}
        <div className="lg:col-span-5 flex flex-col items-center justify-center">
          <div className="w-full max-w-[320px] bg-black/40 border border-white/5 rounded-xl p-4 flex flex-col items-center relative overflow-hidden">
            
            {/* SVG Visualizing the Capstan Cylindrical Wrap */}
            <svg
              viewBox="0 0 200 280"
              className="w-full h-[280px]"
              role="img"
              aria-label="Capstan cylinder and rope winding path diagram"
            >
              <rect width="200" height="280" fill="#0d0f14" rx="8" />

              {/* Draw Center Cylinder (Carabiner/Belay Pin) */}
              {/* Center at (100, 140), radius 30 px */}
              <circle
                cx="100"
                cy="140"
                r="35"
                fill={deviceTemp > 50 ? 'url(#hot-cylinder-grad)' : 'var(--ares-gray)'}
                stroke="var(--ares-gray-dark)"
                strokeWidth="4"
              />
              <circle cx="100" cy="140" r="20" fill="#0d0f14" />

              {/* Define hot glowing gradient */}
              <defs>
                <radialGradient id="hot-cylinder-grad">
                  <stop offset="0%" stopColor="#C00000" />
                  <stop offset="70%" stopColor="#CD7F32" />
                  <stop offset="100%" stopColor="#4a4a4a" />
                </radialGradient>
              </defs>

              {/* Heat Sparks overlay if lowering */}
              {isLowering && (
                <g className="animate-pulse">
                  <circle cx="130" cy="120" r="1.5" fill="var(--ares-gold)" />
                  <circle cx="70" cy="160" r="1" fill="var(--ares-gold)" />
                  <circle cx="110" cy="180" r="2" fill="var(--ares-red)" />
                </g>
              )}

              {/* Draw Rope Path around the cylinder */}
              {(() => {
                // Draw incoming rope (leads to climber)
                // Climber is at bottom-left: Y = 280, X = 65
                // Rope exits pin tangentially
                const ropePath = [];
                
                // Straight segment from climber to left edge of cylinder
                ropePath.push("M 65 280");
                ropePath.push("L 65 140");

                // Wrap around cylinder based on wrapDegrees
                // Center is (100,140), radius is 35 px.
                // Left tangent is at (65, 140) which is 180 degrees in polar coordinates (angle from right is PI)
                const startAngle = Math.PI;
                const wrapRad = (wrapDegrees * Math.PI) / 180;

                // Build arc segments
                const steps = 30;
                for (let i = 0; i <= steps; i++) {
                  const currAngle = startAngle - (wrapRad * (i / steps));
                  const px = 100 + 35 * Math.cos(currAngle);
                  const py = 140 - 35 * Math.sin(currAngle);
                  
                  // For the first step, move to or line to
                  if (i === 0) {
                    ropePath.push(`L ${px} ${py}`);
                  } else {
                    ropePath.push(`L ${px} ${py}`);
                  }
                }

                // Straight segment from wrap endpoint to belayer/brake hand
                const endAngle = startAngle - wrapRad;
                const endPx = 100 + 35 * Math.cos(endAngle);
                const endPy = 140 - 35 * Math.sin(endAngle);
                
                // Exit vector tangential to cylinder
                const exitDx = -Math.sin(endAngle);
                const exitDy = -Math.cos(endAngle);
                
                const exitPx = endPx + exitDx * 70;
                const exitPy = endPy + exitDy * 70;

                ropePath.push(`L ${exitPx} ${exitPy}`);

                return (
                  <path
                    d={ropePath.join(" ")}
                    fill="none"
                    stroke="var(--ares-bronze)"
                    strokeWidth="4"
                    strokeLinecap="round"
                  />
                );
              })()}

              {/* Force tags */}
              <text x="50" y="270" textAnchor="end" fill="var(--marble)" fontSize="8" fontFamily="monospace">CLIMBER LOAD</text>
              
              {/* Brake hand representation */}
              <text x="135" y="235" fill="var(--ares-cyan)" fontSize="8" fontFamily="monospace">BRAKE HAND</text>
            </svg>

            {/* Live progress indicator if lowering */}
            {isLowering && (
              <div className="absolute bottom-4 left-4 right-4 bg-obsidian/90 border border-white/10 rounded px-2 py-1 text-[10px] font-mono flex flex-col gap-1">
                <div className="flex justify-between">
                  <span>Lowering Progress:</span>
                  <span>{lowerProgress.toFixed(0)}%</span>
                </div>
                <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                  <div style={{ width: `${lowerProgress}%` }} className="h-full bg-ares-red" />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Bottom Panel: Telemetry Dashboard */}
        <div className="lg:col-span-12 w-full mt-4">
          <div className="bg-white/5 border border-white/5 rounded-lg p-6 flex flex-col gap-6">
            <div>
              <h4 className="text-xs uppercase font-bold tracking-widest text-ares-gold border-b border-white/5 pb-2">
                Mechanical Metrics & Safety Telemetry
              </h4>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 items-stretch">
              {/* Stat Card 1: Friction Multiplier */}
              <div className="bg-black/20 border border-white/5 rounded-lg p-4 flex flex-col justify-between gap-4">
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-marble/40">Friction Multiplier (e^&mu;&theta;)</span>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-3xl font-heading font-black text-white">
                      {capstanData.multiplier.toFixed(1)}&times;
                    </span>
                  </div>
                  <span className="text-[10px] text-marble/50 mt-1">
                    Holding force is reduced by this factor!
                  </span>
                </div>
              </div>

              {/* Stat Card 2: Brake force required */}
              <div className="bg-black/20 border border-white/5 rounded-lg p-4 flex flex-col justify-between gap-4">
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-marble/40">Brake Hand Force Required</span>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-3xl font-heading font-black text-ares-cyan">
                      {capstanData.holdingForceLbs.toFixed(1)}
                    </span>
                    <span className="text-xs text-marble/50">lbs</span>
                  </div>
                  <span className="text-[10px] text-marble/50 mt-1">
                    Standard Load: <strong className="text-white">{capstanData.climberForceLbs.toFixed(1)} lbs</strong>
                  </span>
                </div>
              </div>

              {/* Stat Card 3: Thermal Sensor */}
              <div className="bg-black/20 border border-white/5 rounded-lg p-4 flex flex-col justify-between gap-4">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-marble/60 flex items-center gap-1">
                      <Thermometer className="w-4 h-4 text-ares-red" />
                      Thermal Sensor
                    </span>
                    <span className={`font-bold ${deviceTemp > 50 ? 'text-ares-red' : 'text-ares-cyan'}`}>
                      {deviceTemp.toFixed(1)} &deg;C
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] text-marble/40 mt-1">
                    <Flame className="w-3.5 h-3.5" />
                    <span>Heat Energy: {totalHeatJoules.toFixed(0)} J</span>
                  </div>
                </div>
              </div>

              {/* Stat Card 4: Heat safety callout */}
              <div className={`p-4 rounded-lg border text-xs leading-relaxed transition-all flex flex-col justify-between ${tempWarning.bg} ${tempWarning.border} ${tempWarning.color}`}>
                <div>
                  <div className="flex items-center gap-1.5 font-bold mb-1.5">
                    <ShieldAlert className="w-4 h-4" />
                    <span>{tempWarning.text}</span>
                  </div>
                  <p className="text-[10px] opacity-80 leading-normal font-sans">
                    {deviceTemp > 80
                      ? 'Friction heat has built up significantly! Touching the carabiner immediately after a fast lower can cause severe burns!'
                      : deviceTemp > 40
                      ? 'Lowering friction is dissipating as thermal energy. Ambient cooling is actively normalizing temperatures.'
                      : 'Friction surfaces remain in stable thermal equilibrium.'}
                  </p>
                </div>
              </div>

              {/* Stat Card 5: Cognitive Breakdown */}
              <div className="bg-white/5 border border-white/5 rounded-lg p-4 flex flex-col justify-between gap-3 text-[10px] leading-relaxed text-marble/50">
                <div>
                  <div className="flex items-center gap-1 text-ares-gold font-bold mb-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>COGNITIVE BREAKDOWN</span>
                  </div>
                  <span className="block font-bold text-white mb-0.5">&quot;In Other Words&quot;</span>
                  Wrapping a rope around a post lets friction do the heavy lifting. A single wrap multiplies your grip so much that holding a full-grown adult takes less effort than holding a bag of groceries!
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
