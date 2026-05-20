/** @sim {"name": "Fall Factor & Impact Force", "requiresContext": false} */
import { useEffect, useRef, useState } from 'react';
import { Play, RotateCcw, AlertTriangle, ShieldCheck } from 'lucide-react';

export default function ClimbingFallFactorSim() {
  const [fallDistance, setFallDistance] = useState(3.0); // distance from last protection to climber (meters)
  const [ropeLength, setRopeLength] = useState(10.0); // active rope length (meters)
  const [climberWeight, setClimberWeight] = useState(80); // kg
  const [ropeType, setRopeType] = useState('dynamic'); // dynamic vs static

  // Simulation run states
  const [isFalling, setIsFalling] = useState(false);
  const [climberYState, setClimberYState] = useState(120); // visual position of climber in SVG
  const climberY = isFalling ? climberYState : (180 - fallDistance * 24);
  const [ropeStretch, setRopeStretch] = useState(0);
  const [maxTension, setMaxTension] = useState(0);
  const [peakGForce, setPeakGForce] = useState(1.0);
  const [fallStatus, setFallStatus] = useState<'idle' | 'freefall' | 'stretch' | 'caught'>('idle');

  // Animation refs
  const requestRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);

  // Constants
  const GRAVITY = 9.81; // m/s^2
  
  // Calculate static mathematical factors
  const fallHeightTotal = fallDistance * 2; // Distance fallen is 2x the distance above the bolt
  const fallFactor = parseFloat((fallHeightTotal / ropeLength).toFixed(2));
  
  // Elastic Modulus E*A (Rope stiffness) in Newtons: Dynamic rope is ~25kN, Static is ~80kN
  const ropeStiffness = ropeType === 'dynamic' ? 25000 : 80000;

  // Theoretical Peak Impact Force using standard climbing rope energy equation
  // F = mg * (1 + sqrt(1 + 2 * E * A * FF / (mg)))
  const weightNewton = climberWeight * GRAVITY;
  const theoreticalForceN = weightNewton * (1 + Math.sqrt(1 + (2 * ropeStiffness * fallFactor) / weightNewton));
  const theoreticalForceKn = parseFloat((theoreticalForceN / 1000).toFixed(2));
  const theoreticalGForce = parseFloat((theoreticalForceN / weightNewton).toFixed(2));
  // Force on anchor is larger due to pulley effect (typically F_anchor = F * 1.6)
  const theoreticalAnchorForceKn = parseFloat((theoreticalForceKn * 1.6).toFixed(2));

  // Determine safety thresholds
  const getSafetyLevel = () => {
    if (fallFactor <= 0.5 && theoreticalGForce < 7) {
      return { text: 'Safe & Comfortable', color: 'text-ares-cyan', bg: 'bg-ares-cyan/10', border: 'border-ares-cyan/30', rating: 'Optimal' };
    } else if (fallFactor <= 1.0 && theoreticalGForce < 10) {
      return { text: 'Significant Catch', color: 'text-ares-gold', bg: 'bg-ares-gold/10', border: 'border-ares-gold/30', rating: 'Moderate Stress' };
    } else if (fallFactor <= 1.5 && theoreticalGForce < 12) {
      return { text: 'HARD CATCH - Injury Risk!', color: 'text-ares-bronze-light', bg: 'bg-ares-bronze/10', border: 'border-ares-bronze/30', rating: 'High Force' };
    } else {
      return { text: 'CRITICAL ANCHOR / SPINE RISK!', color: 'text-ares-red-light', bg: 'bg-ares-red/10', border: 'border-ares-red/30', rating: 'Danger Zone' };
    }
  };

  const safety = getSafetyLevel();

  // Reset the simulation to start state
  const handleReset = () => {
    if (requestRef.current) {
      cancelAnimationFrame(requestRef.current);
      requestRef.current = null;
    }
    setIsFalling(false);
    setClimberYState(180 - fallDistance * 24); // visually place climber above the bolt
    setRopeStretch(0);
    setMaxTension(0);
    setPeakGForce(1.0);
    setFallStatus('idle');
    startTimeRef.current = null;
  };

  // Run the physics simulation step-by-step
  const triggerFall = () => {
    handleReset();
    setIsFalling(true);
    setFallStatus('freefall');
    startTimeRef.current = performance.now();
  };

  useEffect(() => {
    if (!isFalling) return;

    let vel = 0; // m/s
    let yPos = fallDistance; // climber height relative to the protection bolt (meters)
    let maxF = 0;
    let maxG = 1.0;
    
    let lastTime = performance.now();

    const animate = (now: number) => {
      const elapsed = (now - lastTime) / 1000;
      // Cap elapsed to avoid mega physics jumps on background tabs
      const dt = Math.min(elapsed, 0.05);
      lastTime = now;

      // Run multiple sub-steps for physics stability
      const steps = 4;
      const subDt = dt / steps;

      for (let i = 0; i < steps; i++) {
        const fallDistTotal = fallDistance - yPos; // positive values mean climber is below start point
        // The slack height is reached when the climber falls below the protection bolt by the free rope length
        const stretchDist = fallDistTotal - fallHeightTotal;

        let force = 0;
        let status: 'freefall' | 'stretch' | 'caught' = 'freefall';

        if (stretchDist > 0) {
          status = 'stretch';
          // Force calculated as spring model k * dx, where k = E*A / L_rope
          const k = ropeStiffness / ropeLength;
          // Damping factor to bring the climber to rest
          const c = 2.0 * Math.sqrt(k * climberWeight) * 0.18; // underdamped spring
          
          force = k * stretchDist - c * vel;
          if (force < 0) force = 0; // ropes only pull, never push
        }

        // F = m * a  ==> a = (F - mg) / m
        const accel = (force / climberWeight) - GRAVITY;
        
        vel += accel * subDt;
        yPos += vel * subDt;

        const gVal = Math.max(1.0, Math.abs(accel / GRAVITY));
        if (gVal > maxG) {
          maxG = gVal;
        }
        if (force > maxF) {
          maxF = force;
        }

        // Terminate bounce if settled
        if (stretchDist > 0 && Math.abs(vel) < 0.05 && Math.abs(accel) < 0.2) {
          status = 'caught';
          vel = 0;
        }

        // Apply scale factors for visuals: Bolt is at SVG Y = 180.
        // Climber starts above/below bolt. 
        // 1 meter = 24 pixels.
        const climberVisualY = 180 - yPos * 24;
        
        setClimberYState(climberVisualY);
        setRopeStretch(Math.max(0, stretchDist));
        setMaxTension(maxF);
        setPeakGForce(maxG);
        setFallStatus(status);

        if (status === 'caught') {
          setIsFalling(false);
          return;
        }
      }

      requestRef.current = requestAnimationFrame(animate);
    };

    requestRef.current = requestAnimationFrame(animate);

    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [isFalling, fallDistance, ropeLength, climberWeight, ropeStiffness, fallHeightTotal]);

  // Adjust climber initial position visually when fallDistance/ropeLength sliders move

  return (
    <div className="glass-card bg-obsidian border border-white/10 rounded-xl p-6 text-marble shadow-2xl">
      <div className="flex flex-col gap-2 mb-6">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider bg-ares-red/20 text-ares-red border border-ares-red/30">
            STEM Physics
          </span>
          <h3 className="text-xl font-heading font-bold text-white tracking-wide">
            Fall Factor & Impact Force Simulation
          </h3>
        </div>
        <p className="text-marble/70 text-sm leading-relaxed max-w-3xl">
          Lead climbers clip their rope into anchors as they climb. In a fall, rope elasticity stretches to absorb energy. Explore how the ratio of fall distance to rope length determines the force felt by the climber.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Panel: Inputs & Live Telemetry */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          <div className="bg-white/5 border border-white/5 rounded-lg p-5 flex flex-col gap-5">
            <h4 className="text-xs uppercase font-bold tracking-widest text-ares-gold border-b border-white/5 pb-2">
              Parameters
            </h4>

            {/* Slider 1: Climber Distance Above Last Bolt */}
            <div className="flex flex-col gap-2">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-marble/60">Distance Above Anchor</span>
                <span className="text-white font-bold">{fallDistance.toFixed(1)} m</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="8.0"
                step="0.5"
                value={fallDistance}
                onChange={(e) => setFallDistance(parseFloat(e.target.value))}
                disabled={isFalling}
                className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-ares-red"
                aria-label="Distance of climber above the last protection piece"
              />
              <span className="text-[10px] text-marble/40">Total fall height will be 2&times; this distance ({ (fallDistance * 2).toFixed(1) } m).</span>
            </div>

            {/* Slider 2: Active Rope Length */}
            <div className="flex flex-col gap-2">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-marble/60">Active Rope Length</span>
                <span className="text-white font-bold">{ropeLength.toFixed(1)} m</span>
              </div>
              <input
                type="range"
                min="4.0"
                max="30.0"
                step="1.0"
                value={ropeLength}
                // Rope length cannot be less than fallDistance!
                onChange={(e) => setRopeLength(Math.max(fallDistance + 1, parseFloat(e.target.value)))}
                disabled={isFalling}
                className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-ares-red"
                aria-label="Total length of active rope in system"
              />
              <span className="text-[10px] text-marble/40">Amount of active rope paid out by the belayer.</span>
            </div>

            {/* Slider 3: Climber Weight */}
            <div className="flex flex-col gap-2">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-marble/60">Climber Weight</span>
                <span className="text-white font-bold">{climberWeight} kg</span>
              </div>
              <input
                type="range"
                min="45"
                max="110"
                step="5"
                value={climberWeight}
                onChange={(e) => setClimberWeight(parseInt(e.target.value, 10))}
                disabled={isFalling}
                className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-ares-red"
                aria-label="Climber weight in kilograms"
              />
            </div>

            {/* Toggle: Rope Elasticity */}
            <div className="flex flex-col gap-2">
              <span className="text-xs font-mono text-marble/60">Rope Material Type</span>
              <div className="grid grid-cols-2 gap-2 mt-1">
                <button
                  onClick={() => setRopeType('dynamic')}
                  disabled={isFalling}
                  className={`px-3 py-2 text-xs font-bold rounded border transition-all ${
                    ropeType === 'dynamic'
                      ? 'bg-ares-red/10 border-ares-red text-ares-red shadow-lg shadow-ares-red/10'
                      : 'bg-transparent border-white/10 hover:border-white/20 text-marble/60'
                  }`}
                  aria-label="Select elastic dynamic climbing rope"
                >
                  Dynamic Rope (Elastic)
                </button>
                <button
                  onClick={() => setRopeType('static')}
                  disabled={isFalling}
                  className={`px-3 py-2 text-xs font-bold rounded border transition-all ${
                    ropeType === 'static'
                      ? 'bg-ares-red/10 border-ares-red text-ares-red shadow-lg shadow-ares-red/10'
                      : 'bg-transparent border-white/10 hover:border-white/20 text-marble/60'
                  }`}
                  aria-label="Select stiff static rigging rope"
                >
                  Static Rope (Rigid)
                </button>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-3 mt-2">
              <button
                onClick={triggerFall}
                disabled={isFalling}
                className="px-4 py-2.5 rounded-lg bg-ares-red text-white hover:bg-ares-bronze font-bold text-sm tracking-wide shadow-lg shadow-ares-red/30 transition-all flex items-center justify-center gap-2"
                aria-label="Trigger climbing fall simulation"
              >
                <Play className="w-4 h-4 fill-white" />
                Trigger Fall
              </button>
              <button
                onClick={handleReset}
                className="px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 font-bold text-sm text-marble transition-all flex items-center justify-center gap-2"
                aria-label="Reset simulation environment"
              >
                <RotateCcw className="w-4 h-4" />
                Reset
              </button>
            </div>
          </div>
        </div>

        {/* Center Panel: SVG Physics Canvas */}
        <div className="lg:col-span-4 flex flex-col items-center justify-center">
          <div className="w-full max-w-[280px] bg-black/40 border border-white/5 rounded-xl p-4 flex flex-col items-center relative overflow-hidden">
            
            {/* SVG Visual Environment */}
            <svg
              viewBox="0 0 160 400"
              className="w-full h-[400px]"
              role="img"
              aria-label="Visual climbing wall simulation of lead climbing rope stretch"
            >
              {/* Sky / Rock Background */}
              <defs>
                <linearGradient id="rock-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#1e1e1e" />
                  <stop offset="100%" stopColor="#0b0b0b" />
                </linearGradient>
              </defs>
              <rect width="160" height="400" fill="url(#rock-grad)" rx="8" />

              {/* Gridlines */}
              <line x1="80" y1="0" x2="80" y2="400" stroke="rgba(255,255,255,0.03)" strokeWidth="1" strokeDasharray="4 4" />
              <line x1="0" y1="180" x2="160" y2="180" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />

              {/* Climbing Wall texture lines */}
              <path d="M10,50 L40,80 M120,40 L150,60 M0,200 L30,220 M110,250 L140,290" stroke="rgba(255,255,255,0.05)" strokeWidth="2" strokeLinecap="round" />

              {/* Belayer (Bottom right) */}
              <circle cx="100" cy="370" r="6" fill="var(--ares-gray)" />
              <text x="100" y="385" textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize="7" fontFamily="monospace">BELAYER</text>

              {/* Active Protection Bolt (Carabiner anchor at Y = 180) */}
              <circle cx="80" cy="180" r="4" fill="none" stroke="var(--ares-gold)" strokeWidth="2" />
              <path d="M78,176 L82,184 M82,176 L78,184" stroke="var(--ares-gold)" strokeWidth="1.5" />
              <text x="65" y="183" textAnchor="end" fill="var(--ares-gold)" fontSize="8" fontFamily="monospace" fontWeight="bold">ANCHOR</text>

              {/* Rope segment 1: Belayer to Anchor */}
              <line
                x1="100"
                y1="370"
                x2="80"
                y2="180"
                stroke="var(--ares-bronze)"
                strokeWidth="2.5"
                strokeLinecap="round"
              />

              {/* Rope segment 2: Anchor to Climber */}
              {/* Dynamic spline drawing based on state */}
              {isFalling && fallStatus === 'freefall' ? (
                // Freefall means the rope loops in a U-shape because of slack!
                <path
                  d={`M80,180 Q80,${Math.min(300, 180 + (climberY - 180) * 0.6)} ${80},${climberY}`}
                  fill="none"
                  stroke="var(--ares-red)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeDasharray="3 3"
                />
              ) : (
                // Elastic rope stretching under load is straight tension
                <line
                  x1="80"
                  y1="180"
                  x2="80"
                  y2={climberY}
                  stroke={ropeStretch > 0 ? 'var(--ares-red)' : 'var(--ares-cyan)'}
                  strokeWidth={ropeStretch > 0 ? 3.5 : 2.5}
                  strokeLinecap="round"
                />
              )}

              {/* Climber (Drawing dynamic position) */}
              <g transform={`translate(80, ${climberY})`}>
                {/* Visual impact shockwaves */}
                {ropeStretch > 0 && (
                  <circle cx="0" cy="0" r={10 + ropeStretch * 6} fill="none" stroke="var(--ares-red)" strokeWidth="1" opacity={Math.max(0, 0.7 - ropeStretch * 0.2)} />
                )}
                {/* Climber head */}
                <circle cx="0" cy="-14" r="5" fill="var(--marble)" />
                {/* Climber torso */}
                <line x1="0" y1="-9" x2="0" y2="5" stroke="var(--marble)" strokeWidth="3.5" />
                {/* Climber limbs */}
                <line x1="0" y1="-4" x2="-8" y2="-12" stroke="var(--marble)" strokeWidth="2" />
                <line x1="0" y1="-4" x2="8" y2="-12" stroke="var(--marble)" strokeWidth="2" />
                <line x1="0" y1="5" x2="-7" y2="16" stroke="var(--marble)" strokeWidth="2" />
                <line x1="0" y1="5" x2="7" y2="16" stroke="var(--marble)" strokeWidth="2" />
              </g>

              {/* Fall Tracker indicators */}
              <text x="15" y="30" fill="rgba(255,255,255,0.4)" fontSize="9" fontFamily="monospace">STATUS:</text>
              <text x="65" y="30" fill={fallStatus === 'freefall' ? 'var(--ares-red)' : fallStatus === 'stretch' ? 'var(--ares-gold)' : 'var(--ares-cyan)'} fontSize="9" fontFamily="monospace" fontWeight="bold">
                {fallStatus.toUpperCase()}
              </text>
            </svg>

            {/* Overlaid gauge displaying real-time displacement */}
            <div className="absolute bottom-4 left-4 bg-obsidian/90 border border-white/10 rounded px-2.5 py-1 text-[10px] font-mono text-marble/60 flex flex-col">
              <span>Stretch: {ropeStretch.toFixed(2)} m</span>
            </div>
          </div>
        </div>

        {/* Right Panel: Physics Equations & Live Meters */}
        <div className="lg:col-span-3 flex flex-col gap-6">
          <div className="bg-white/5 border border-white/5 rounded-lg p-5 flex flex-col gap-5">
            <h4 className="text-xs uppercase font-bold tracking-widest text-ares-gold border-b border-white/5 pb-2">
              Telemetry & Physics
            </h4>

            {/* Stat: Fall Factor */}
            <div className="flex flex-col">
              <span className="text-[10px] uppercase font-bold tracking-wider text-marble/40">Fall Factor (FF)</span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-3xl font-heading font-black text-white">{fallFactor}</span>
                <span className="text-xs text-marble/50">/ 2.0</span>
              </div>
              <span className="text-[10px] text-marble/50 mt-1 leading-relaxed">
                Formula: <span className="font-mono bg-black/30 px-1 py-0.5 rounded text-ares-gold">H_fall / L_rope</span>
              </span>
            </div>

            {/* Stat: Peak G-Force */}
            <div className="flex flex-col">
              <span className="text-[10px] uppercase font-bold tracking-wider text-marble/40">Peak Deceleration Force</span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className={`text-3xl font-heading font-black transition-colors duration-100 ${
                  isFalling ? 'text-ares-red' : peakGForce > 9 ? 'text-ares-red' : 'text-marble'
                }`}>
                  {isFalling ? peakGForce.toFixed(1) : theoreticalGForce}
                </span>
                <span className="text-xs text-marble/50">G-Force</span>
              </div>
              <span className="text-[10px] text-marble/50 mt-1">
                {theoreticalGForce < 7 ? 'Safe catch standard.' : theoreticalGForce < 10 ? 'Strenuous catch.' : 'Severe whiplash force!'}
              </span>
            </div>

            {/* Meter 1: Impact Force */}
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between text-[11px] font-mono">
                <span className="text-marble/50">Peak Force on Climber</span>
                <span className="text-ares-cyan font-bold">{isFalling ? (maxTension / 1000).toFixed(2) : theoreticalForceKn} kN</span>
              </div>
              <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                <div
                  style={{ width: `${Math.min(100, ((isFalling ? maxTension / 1000 : theoreticalForceKn) / 15) * 100)}%` }}
                  className="h-full bg-ares-cyan transition-[width] duration-300 ease-out"
                />
              </div>
              <span className="text-[9px] text-marble/30 font-mono">Maximum legal limit for climbing ropes is 12 kN.</span>
            </div>

            {/* Meter 2: Force on the Anchor */}
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between text-[11px] font-mono">
                <span className="text-marble/50">Multiplier Force on Anchor</span>
                <span className="text-ares-gold font-bold">
                  {isFalling ? ((maxTension * 1.6) / 1000).toFixed(2) : theoreticalAnchorForceKn} kN
                </span>
              </div>
              <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                <div
                  style={{ width: `${Math.min(100, ((isFalling ? (maxTension * 1.6) / 1000 : theoreticalAnchorForceKn) / 22) * 100)}%` }}
                  className="h-full bg-ares-gold transition-[width] duration-300 ease-out"
                />
              </div>
              <span className="text-[9px] text-marble/30 font-mono">1.6&times; multiplication due to friction pulley effect.</span>
            </div>

            {/* Warning callout panel */}
            <div className={`p-3 rounded border text-xs leading-relaxed transition-all ${safety.bg} ${safety.border} ${safety.color}`}>
              <div className="flex items-center gap-1.5 font-bold mb-1">
                {fallFactor > 1.0 ? <AlertTriangle className="w-3.5 h-3.5" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                <span>{safety.rating}: {safety.text}</span>
              </div>
              <p className="text-[10px] opacity-80 leading-normal font-sans">
                {fallFactor > 1.2 
                  ? 'High fall factors exert extreme force. Dynamic ropes are mandatory to prevent gear blowout.'
                  : 'Rope elasticity stretches safely, keeping decelerations inside physiological boundaries.'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
