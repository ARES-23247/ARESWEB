/** @sim {"name": "Anchor Vector Angles", "requiresContext": false} */
import { useState, useMemo } from 'react';
import { ShieldCheck, ShieldAlert, Info } from 'lucide-react';

export default function ClimbingAnchorAnglesSim() {
  const [includedAngle, setIncludedAngle] = useState(60); // included angle in degrees (0 to 160)
  const [climberWeight, setClimberWeight] = useState(80); // kg
  const [asymmetry, setAsymmetry] = useState(0); // master point offset (-50% to +50%)

  const GRAVITY = 9.81;
  const weightN = climberWeight * GRAVITY;

  // Calculate leg forces based on angle and asymmetry
  const anchorData = useMemo(() => {
    // The included angle is theta. In symmetric case, alpha = beta = theta / 2.
    // Asymmetry shifts the share of the angle.
    // Let's model:
    // Left leg angle to vertical: alpha = (includedAngle / 2) + (asymmetry * 0.6)
    // Right leg angle to vertical: beta = (includedAngle / 2) - (asymmetry * 0.6)
    
    // Safety clamp to prevent negative angles or exceeding physical bounds
    const alpha = Math.max(1, Math.min(88, (includedAngle / 2) + (asymmetry * 0.8)));
    const beta = Math.max(1, Math.min(88, (includedAngle / 2) - (asymmetry * 0.8)));
    
    const alphaRad = (alpha * Math.PI) / 180;
    const betaRad = (beta * Math.PI) / 180;
    const thetaRad = alphaRad + betaRad; // effective included angle

    // Solve static truss equations:
    // T_L * sin(alpha) = T_R * sin(beta)  (horizontal balance)
    // T_L * cos(alpha) + T_R * cos(beta) = W (vertical balance)
    //
    // T_L = W * sin(beta) / sin(alpha + beta)
    // T_R = W * sin(alpha) / sin(alpha + beta)
    const sinSum = Math.sin(thetaRad);
    
    const forceLeftN = sinSum > 0.01 ? (weightN * Math.sin(betaRad)) / sinSum : weightN / 2;
    const forceRightN = sinSum > 0.01 ? (weightN * Math.sin(alphaRad)) / sinSum : weightN / 2;

    const forceLeftKn = parseFloat((forceLeftN / 1000).toFixed(2));
    const forceRightKn = parseFloat((forceRightN / 1000).toFixed(2));

    const pctLeft = parseFloat(((forceLeftN / weightN) * 100).toFixed(0));
    const pctRight = parseFloat(((forceRightN / weightN) * 100).toFixed(0));

    // Force multiplier on anchor points
    const forceMultiplier = parseFloat((Math.max(forceLeftN, forceRightN) / weightN).toFixed(2));

    return {
      alpha,
      beta,
      forceLeftKn,
      forceRightKn,
      pctLeft,
      pctRight,
      forceMultiplier,
      effectiveIncludedAngle: parseFloat((thetaRad * 180 / Math.PI).toFixed(0))
    };
  }, [includedAngle, asymmetry, weightN]);

  // Determine safety evaluations
  const getSafetyConfig = () => {
    const maxPct = Math.max(anchorData.pctLeft, anchorData.pctRight);
    const effAngle = anchorData.effectiveIncludedAngle;

    if (effAngle <= 60 && maxPct <= 60) {
      return { text: 'EXCELLENT (Optimal Force Dist.)', color: 'text-ares-cyan', border: 'border-ares-cyan/30', bg: 'bg-ares-cyan/10', state: 'optimal' };
    } else if (effAngle <= 90 && maxPct <= 85) {
      return { text: 'GOOD (Safe, Acceptable)', color: 'text-ares-gold', border: 'border-ares-gold/30', bg: 'bg-ares-gold/10', state: 'safe' };
    } else if (effAngle <= 120) {
      return { text: 'CAUTION (Forces Multiplying!)', color: 'text-ares-bronze-light', border: 'border-ares-bronze/30', bg: 'bg-ares-bronze/10', state: 'warning' };
    } else {
      return { text: 'DANGEROUS (CATASTROPHIC RISK!)', color: 'text-ares-red-light', border: 'border-ares-red/30', bg: 'bg-ares-red/10', state: 'critical' };
    }
  };

  const safety = getSafetyConfig();

  return (
    <div className="glass-card bg-obsidian border border-white/10 rounded-xl p-6 text-marble shadow-2xl">
      <div className="flex flex-col gap-2 mb-6">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider bg-ares-red/20 text-ares-red border border-ares-red/30">
            Vector Truss Analysis
          </span>
          <h3 className="text-xl font-heading font-bold text-white tracking-wide">
            Climbing Anchor Vector Angles
          </h3>
        </div>
        <p className="text-marble/70 text-sm leading-relaxed max-w-3xl">
          Climbing anchors equalise your weight across multiple points. However, as the angle between the anchor legs increases, horizontal vector tension multiplies. At 120&deg;, each anchor point feels 100% of your weight. Exceeding 120&deg; is extremely dangerous!
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Panel: Configuration Controls */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          <div className="bg-white/5 border border-white/5 rounded-lg p-5 flex flex-col gap-5">
            <h4 className="text-xs uppercase font-bold tracking-widest text-ares-gold border-b border-white/5 pb-2">
              Parameters
            </h4>

            {/* Slider 1: Included Angle */}
            <div className="flex flex-col gap-2">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-marble/60">Included Angle (&theta;)</span>
                <span className="text-white font-bold">{anchorData.effectiveIncludedAngle}&deg;</span>
              </div>
              <input
                type="range"
                min="10"
                max="160"
                step="5"
                value={includedAngle}
                onChange={(e) => setIncludedAngle(parseInt(e.target.value, 10))}
                className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-ares-red"
                aria-label="Included angle between anchor legs"
              />
              <div className="flex justify-between text-[10px] text-marble/40">
                <span>0&deg; (Vertical)</span>
                <span>60&deg; (Ideal)</span>
                <span>120&deg; (100% Load)</span>
                <span>160&deg; (Dangerous)</span>
              </div>
            </div>

            {/* Slider 2: Asymmetry (Offset) */}
            <div className="flex flex-col gap-2">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-marble/60">Anchor Asymmetry / Offset</span>
                <span className="text-white font-bold">
                  {asymmetry === 0 ? 'Perfectly Center' : asymmetry > 0 ? `${asymmetry}% Right` : `${Math.abs(asymmetry)}% Left`}
                </span>
              </div>
              <input
                type="range"
                min="-45"
                max="45"
                step="5"
                value={asymmetry}
                onChange={(e) => setAsymmetry(parseInt(e.target.value, 10))}
                className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-ares-red"
                aria-label="Offset load shifting master point left or right"
              />
              <span className="text-[10px] text-marble/40">Moves the master point off-center, distributing forces unequally.</span>
            </div>

            {/* Slider 3: Climber Weight */}
            <div className="flex flex-col gap-2">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-marble/60">Total Load (Climber + Gear)</span>
                <span className="text-white font-bold">{climberWeight} kg</span>
              </div>
              <input
                type="range"
                min="50"
                max="120"
                step="5"
                value={climberWeight}
                onChange={(e) => setClimberWeight(parseInt(e.target.value, 10))}
                className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-ares-red"
                aria-label="Climber weight load"
              />
            </div>
          </div>
        </div>

        {/* Center Panel: SVG Vector Diagram */}
        <div className="lg:col-span-5 flex flex-col items-center justify-center">
          <div className="w-full max-w-[320px] bg-black/40 border border-white/5 rounded-xl p-4 flex flex-col items-center relative overflow-hidden">
            
            {/* SVG Visualizing the Equalized Anchor */}
            <svg
              viewBox="0 0 200 280"
              className="w-full h-[280px]"
              role="img"
              aria-label="Climbing anchor truss diagram of left and right vector tensions"
            >
              <rect width="200" height="280" fill="#0d0f14" rx="8" />

              {/* Anchor points */}
              {/* Left anchor fixed at (45, 60), Right anchor at (155, 60) */}
              <circle cx="45" cy="60" r="6" fill="var(--ares-gold)" />
              <circle cx="155" cy="60" r="6" fill="var(--ares-gold)" />
              
              <text x="45" y="48" textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize="8" fontFamily="monospace">PT A</text>
              <text x="155" y="48" textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize="8" fontFamily="monospace">PT B</text>

              {/* Draw master point relative to angle & asymmetry */}
              {(() => {
                // Calculate master point position visually
                // Center is X = 100.
                const offset = (asymmetry / 100) * 110;
                const masterX = 100 + offset;
                
                // Let's compute height from included angle.
                // At angle = 0, height is large (bottom). At 180, height is 60 (top).
                const halfAngleRad = ((includedAngle / 2) * Math.PI) / 180;
                // Leg length is approx 110 px.
                const legL = 100;
                const masterY = 60 + legL * Math.cos(halfAngleRad);

                // Force arrow scale factor
                const forceScaleL = Math.min(50, anchorData.forceLeftKn * 45);
                const forceScaleR = Math.min(50, anchorData.forceRightKn * 45);

                const getVectorColor = (pct: number) => {
                  if (pct <= 60) return 'var(--ares-cyan)';
                  if (pct <= 85) return 'var(--ares-gold)';
                  if (pct <= 100) return 'var(--ares-bronze)';
                  return 'var(--ares-red)';
                };

                return (
                  <g>
                    {/* Left Leg Rope */}
                    <line
                      x1="45"
                      y1="60"
                      x2={masterX}
                      y2={masterY}
                      stroke={getVectorColor(anchorData.pctLeft)}
                      strokeWidth={anchorData.pctLeft > 100 ? '4' : '2.5'}
                      strokeLinecap="round"
                    />

                    {/* Right Leg Rope */}
                    <line
                      x1="155"
                      y1="60"
                      x2={masterX}
                      y2={masterY}
                      stroke={getVectorColor(anchorData.pctRight)}
                      strokeWidth={anchorData.pctRight > 100 ? '4' : '2.5'}
                      strokeLinecap="round"
                    />

                    {/* Vector Tension Arrows on Left Leg */}
                    <line
                      x1="45"
                      y1="60"
                      x2={45 + ((masterX - 45) / 110) * forceScaleL}
                      y2={60 + ((masterY - 60) / 110) * forceScaleL}
                      stroke="white"
                      strokeWidth="2.5"
                    />

                    {/* Vector Tension Arrows on Right Leg */}
                    <line
                      x1="155"
                      y1="60"
                      x2={155 + ((masterX - 155) / 110) * forceScaleR}
                      y2={60 + ((masterY - 60) / 110) * forceScaleR}
                      stroke="white"
                      strokeWidth="2.5"
                    />

                    {/* Equalization Master Point (Carabiner ring) */}
                    <circle cx={masterX} cy={masterY} r="8" fill="var(--marble)" stroke="var(--ares-black)" strokeWidth="2" />
                    <circle cx={masterX} cy={masterY} r="3" fill="var(--ares-black)" />

                    {/* Climber load line hanging below master point */}
                    <line
                      x1={masterX}
                      y1={masterY}
                      x2={masterX}
                      y2={masterY + 45}
                      stroke="var(--ares-red)"
                      strokeWidth="3.5"
                    />

                    {/* Dynamic Climber Representation */}
                    <g transform={`translate(${masterX}, ${masterY + 45})`}>
                      <circle cx="0" cy="10" r="5" fill="var(--marble)" />
                      <line x1="0" y1="15" x2="0" y2="28" stroke="var(--marble)" strokeWidth="3.5" />
                    </g>

                    {/* Arc indicating angle */}
                    {includedAngle > 20 && (
                      <path
                        d={`M${masterX - 18},${masterY - 10} Q${masterX},${masterY - 24} ${masterX + 18},${masterY - 10}`}
                        fill="none"
                        stroke="rgba(255,255,255,0.3)"
                        strokeWidth="1.5"
                        strokeDasharray="3 3"
                      />
                    )}
                  </g>
                );
              })()}
            </svg>

            {/* Overlaid indicator showing safety index */}
            <div className="absolute top-4 left-4 bg-obsidian/90 border border-white/10 rounded px-2.5 py-1 text-[10px] font-mono text-center">
              <span className="text-marble/50">Tension Multiplier:</span>
              <div className="text-white font-bold">{anchorData.forceMultiplier}x</div>
            </div>
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

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch">
              {/* Stat Card 1: Anchor Point A load */}
              <div className="bg-black/20 border border-white/5 rounded-lg p-4 flex flex-col justify-between gap-4">
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-marble/40">Anchor Point A load</span>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className={`text-2xl font-heading font-black ${
                      anchorData.pctLeft > 100 ? 'text-ares-red' : anchorData.pctLeft > 70 ? 'text-ares-gold' : 'text-marble'
                    }`}>
                      {anchorData.pctLeft}%
                    </span>
                    <span className="text-xs text-marble/50">of weight</span>
                  </div>
                  <span className="text-[10px] text-marble/50 mt-1">
                    Force: <strong className="text-white">{anchorData.forceLeftKn} kN</strong> ({ (anchorData.forceLeftKn * 224.8).toFixed(0) } lbs)
                  </span>
                </div>
              </div>

              {/* Stat Card 2: Anchor Point B load */}
              <div className="bg-black/20 border border-white/5 rounded-lg p-4 flex flex-col justify-between gap-4">
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-marble/40">Anchor Point B load</span>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className={`text-2xl font-heading font-black ${
                      anchorData.pctRight > 100 ? 'text-ares-red' : anchorData.pctRight > 70 ? 'text-ares-gold' : 'text-marble'
                    }`}>
                      {anchorData.pctRight}%
                    </span>
                    <span className="text-xs text-marble/50">of weight</span>
                  </div>
                  <span className="text-[10px] text-marble/50 mt-1">
                    Force: <strong className="text-white">{anchorData.forceRightKn} kN</strong> ({ (anchorData.forceRightKn * 224.8).toFixed(0) } lbs)
                  </span>
                </div>
              </div>

              {/* Stat Card 3: Safety Indicator Banner */}
              <div className={`p-4 rounded-lg border text-xs leading-relaxed transition-all flex flex-col justify-between ${safety.bg} ${safety.border} ${safety.color}`}>
                <div>
                  <div className="flex items-center gap-1.5 font-bold mb-1.5">
                    {safety.state === 'critical' || safety.state === 'warning' ? (
                      <ShieldAlert className="w-4 h-4" />
                    ) : (
                      <ShieldCheck className="w-4 h-4" />
                    )}
                    <span>{safety.text}</span>
                  </div>
                  <p className="text-[10px] opacity-80 leading-normal font-sans">
                    {safety.state === 'optimal' 
                      ? 'Angles under 60° distribute forces safely and keep vector multiplier forces to a minimum.'
                      : safety.state === 'safe'
                      ? 'Standard and robust equalized configuration. Vector forces remain low and well within structural limit.'
                      : safety.state === 'warning'
                      ? 'Anchor angles between 90° and 120° multiply forces. At 120°, each bolt feels 100% of your weight. Avoid!'
                      : 'CRITICAL WARNING! Angles above 120° amplify forces exponentially. A dynamic load will pull anchors out!'}
                  </p>
                </div>
              </div>

              {/* Stat Card 4: Cognitive Breakdown */}
              <div className="bg-white/5 border border-white/5 rounded-lg p-4 flex flex-col justify-between gap-3 text-[10px] leading-relaxed text-marble/50">
                <div>
                  <div className="flex items-center gap-1 text-ares-gold font-bold mb-1.5">
                    <Info className="w-3.5 h-3.5" />
                    <span>IN OTHER WORDS</span>
                  </div>
                  Imagine standing with your legs spread extremely wide in a split. The wider your feet, the harder your muscles have to push outwards to keep you from sliding flat on the floor! Keep the legs close for structural strength.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
