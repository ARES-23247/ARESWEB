/** @sim {"name": "Finger Biomechanics & Pulley Strain", "requiresContext": false} */
import { useState } from 'react';
import { ShieldCheck, AlertTriangle, Info } from 'lucide-react';

type GripType = 'crimp' | 'halfCrimp' | 'openHand';

export default function ClimbingFingerBiomechanicsSim() {
  const [grip, setGrip] = useState<GripType>('crimp');
  const [tipForce, setTipForce] = useState<number>(150); // Newtons (applied at finger tip)

  // Finger dimensions (pixels for rendering)
  const L1 = 95; // Proximal phalanx length
  const L2 = 65; // Middle phalanx length
  const L3 = 45; // Distal phalanx length

  // Coordinates and angles based on grip type
  // Joint angles in degrees: MCP, PIP flexion, DIP flexion/hyperextension
  const getGripParameters = (gripType: GripType) => {
    switch (gripType) {
      case 'crimp':
        return {
          mcpAngle: 65,
          pipFlexion: 110,
          dipFlexion: -25, // Hyperextended
          mechanicalDisadvantage: 2.6, // Tendon force multiplier
          name: 'Full Crimp Grip',
          stressMultiplier: 4.1,
          description: 'DIP joint is bent backward (hyperextended) while the PIP joint is bent at a sharp angle. This positions the finger directly over the hold but places extreme outward force on the A2 and A4 pulleys.'
        };
      case 'halfCrimp':
        return {
          mcpAngle: 50,
          pipFlexion: 85,
          dipFlexion: 0, // Flat
          mechanicalDisadvantage: 2.1,
          name: 'Half Crimp Grip',
          stressMultiplier: 2.8,
          description: 'PIP joint is bent at 90 degrees while the DIP joint is kept flat. Offers a balance of high leverage and moderate safety, reducing peak outward shear stress.'
        };
      case 'openHand':
        return {
          mcpAngle: 25,
          pipFlexion: 30,
          dipFlexion: 55, // Flexed to wrap hold
          mechanicalDisadvantage: 1.5,
          name: 'Open Hand Grip',
          stressMultiplier: 0.9,
          description: 'Finger joints drape naturally over the edge. The PIP joint remains open, allowing the flexor tendon to run close to the bones. This minimizes outward pulley tension.'
        };
    }
  };

  const params = getGripParameters(grip);

  // Convert degrees to radians
  const d2r = (deg: number) => (deg * Math.PI) / 180;

  // Compute bone coordinates dynamically
  // MCP is at (30, 270)
  const mcpX = 30;
  const mcpY = 270;

  // Proximal phalanx angle relative to horizontal
  const a1 = d2r(params.mcpAngle);
  const pipX = mcpX + L1 * Math.cos(a1);
  const pipY = mcpY - L1 * Math.sin(a1);

  // Middle phalanx angle relative to horizontal
  const a2 = a1 - d2r(params.pipFlexion);
  const dipX = pipX + L2 * Math.cos(a2);
  const dipY = pipY - L2 * Math.sin(a2);

  // Distal phalanx angle relative to horizontal
  const a3 = a2 - d2r(params.dipFlexion);
  const tipX = dipX + L3 * Math.cos(a3);
  const tipY = dipY - L3 * Math.sin(a3);

  // Tendon mathematical offsets and locations
  // FDP Tendon runs underneath the bones. Let's calculate coordinate offsets normal to each bone segment.
  const getNormalVector = (angle: number) => {
    return { x: -Math.sin(angle), y: -Math.cos(angle) };
  };

  // Normal vectors for each bone
  const n1 = getNormalVector(a1);
  const n2 = getNormalVector(a2);
  const n3 = getNormalVector(a3);

  // Base offsets (pulled close to bone by pulleys)
  const pulleyOffset = 8;
  // Under strain (bowstringing), the tendon pulls away from the PIP joint vertex
  const bowstringAmount = grip === 'crimp' ? 18 : grip === 'halfCrimp' ? 11 : 5;

  // Tendon path key points:
  // 1. Palm origin
  const t0X = mcpX + n1.x * pulleyOffset;
  const t0Y = mcpY + n1.y * pulleyOffset;

  // 2. A2 Pulley region (middle of proximal phalanx)
  const midProxX = (mcpX + pipX) / 2;
  const midProxY = (mcpY + pipY) / 2;
  const tA2X = midProxX + n1.x * (pulleyOffset + (grip === 'crimp' ? 3 : 0));
  const tA2Y = midProxY + n1.y * (pulleyOffset + (grip === 'crimp' ? 3 : 0));

  // 3. PIP Joint bowstring vertex (tendon pulls away here)
  const tPipX = pipX + getNormalVector((a1 + a2) / 2).x * (pulleyOffset + bowstringAmount);
  const tPipY = pipY + getNormalVector((a1 + a2) / 2).y * (pulleyOffset + bowstringAmount);

  // 4. A4 Pulley region (middle of middle phalanx)
  const midMidX = (pipX + dipX) / 2;
  const midMidY = (pipY + dipY) / 2;
  const tA4X = midMidX + n2.x * pulleyOffset;
  const tA4Y = midMidY + n2.y * pulleyOffset;

  // 5. DIP / Insertion point
  const tInsertX = dipX + n3.x * 5;
  const tInsertY = dipY + n3.y * 5;

  // Physics Calculations
  const tendonTension = Math.round(tipForce * params.mechanicalDisadvantage);
  
  // Pulley outward force: F_pulley = 2 * F_tendon * sin(theta_PIP / 2)
  const pipFlexAngle = params.pipFlexion;
  const pulleyForce = Math.round(2 * tendonTension * Math.sin(d2r(pipFlexAngle) / 2));

  // Determine stress and safety zones
  const maxSafePulleyForce = 450; // Newtons threshold before high injury risk
  const stressRatio = pulleyForce / maxSafePulleyForce;

  const getStressLevel = () => {
    if (stressRatio < 0.5) {
      return { text: 'Low Pulley Stress', color: 'text-ares-cyan', bg: 'bg-ares-cyan/10', border: 'border-ares-cyan/30', status: 'Safe' };
    } else if (stressRatio < 0.9) {
      return { text: 'Elevated Tension', color: 'text-ares-gold', bg: 'bg-ares-gold/10', border: 'border-ares-gold/30', status: 'Moderate' };
    } else if (stressRatio < 1.3) {
      return { text: 'HIGH STRESS - Injury Risk!', color: 'text-ares-bronze-light', bg: 'bg-ares-bronze/10', border: 'border-ares-bronze/30', status: 'Dangerous' };
    } else {
      return { text: 'CRITICAL RUPTURE RISK!', color: 'text-ares-red-light', bg: 'bg-ares-red/10', border: 'border-ares-red/30', status: 'Critical' };
    }
  };

  const stress = getStressLevel();

  return (
    <div className="glass-card bg-obsidian border border-white/10 rounded-xl p-6 text-marble shadow-2xl">
      <div className="flex flex-col gap-2 mb-6">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider bg-ares-red/20 text-ares-red border border-ares-red/30">
            STEM Biomechanics
          </span>
          <h3 className="text-xl font-heading font-bold text-white tracking-wide">
            Finger Biomechanics & Tendon Pulley Stress
          </h3>
        </div>
        <p className="text-marble/70 text-sm leading-relaxed max-w-3xl">
          Rock climbers hold tiny edges using different grip styles. Dynamic pulleys (A2 and A4 ligaments) hold flexor tendons close to the finger bones. Crimp positions multiply outward forces, increasing injury risks.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Control Panel */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          <div className="bg-white/5 border border-white/5 rounded-lg p-5 flex flex-col gap-5">
            <h4 className="text-xs uppercase font-bold tracking-widest text-ares-gold border-b border-white/5 pb-2">
              Parameters & Controls
            </h4>

            {/* Grip Selector */}
            <div className="flex flex-col gap-2">
              <span className="text-xs font-mono text-marble/60">Grip Position</span>
              <div className="grid grid-cols-3 gap-2 mt-1">
                <button
                  onClick={() => setGrip('crimp')}
                  className={`px-2 py-2 text-xs font-bold rounded border transition-all ${
                    grip === 'crimp'
                      ? 'bg-ares-red/10 border-ares-red text-ares-red shadow-lg shadow-ares-red/10'
                      : 'bg-transparent border-white/10 hover:border-white/20 text-marble/60'
                  }`}
                >
                  Full Crimp
                </button>
                <button
                  onClick={() => setGrip('halfCrimp')}
                  className={`px-2 py-2 text-xs font-bold rounded border transition-all ${
                    grip === 'halfCrimp'
                      ? 'bg-ares-red/10 border-ares-red text-ares-red shadow-lg shadow-ares-red/10'
                      : 'bg-transparent border-white/10 hover:border-white/20 text-marble/60'
                  }`}
                >
                  Half Crimp
                </button>
                <button
                  onClick={() => setGrip('openHand')}
                  className={`px-2 py-2 text-xs font-bold rounded border transition-all ${
                    grip === 'openHand'
                      ? 'bg-ares-red/10 border-ares-red text-ares-red shadow-lg shadow-ares-red/10'
                      : 'bg-transparent border-white/10 hover:border-white/20 text-marble/60'
                  }`}
                >
                  Open Hand
                </button>
              </div>
            </div>

            {/* Force Slider */}
            <div className="flex flex-col gap-2">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-marble/60">Applied Tip Force</span>
                <span className="text-white font-bold">{tipForce} N (~{(tipForce / 9.81).toFixed(1)} kg)</span>
              </div>
              <input
                type="range"
                min="30"
                max="400"
                step="10"
                value={tipForce}
                onChange={(e) => setTipForce(parseInt(e.target.value, 10))}
                className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-ares-red"
              />
              <div className="flex justify-between text-[10px] text-marble/40 font-mono">
                <span>30 N (Light)</span>
                <span>400 N (Elite Peak Crimp)</span>
              </div>
            </div>

            {/* Explanatory Snippet */}
            <div className="bg-black/30 rounded p-3 text-xs border border-white/5 leading-relaxed text-marble/70">
              <div className="flex items-center gap-1.5 font-bold text-white mb-1">
                <Info className="w-3.5 h-3.5 text-ares-gold" />
                <span>{params.name} Mechanics</span>
              </div>
              <p>{params.description}</p>
            </div>
          </div>
        </div>

        {/* Center Panel - SVG Anatomy Canvas */}
        <div className="lg:col-span-5 flex flex-col items-center justify-center">
          <div className="w-full max-w-[280px] bg-black/40 border border-white/5 rounded-xl p-4 flex flex-col items-center relative overflow-hidden">
            
            <svg viewBox="0 0 240 320" className="w-full h-[320px]" role="img" aria-label="Anatomical cross section of finger showing bones and flexor tendons under load">
              {/* Background Rock Hold */}
              <path d="M 60,110 L 160,110 L 160,135 L 60,135 Z" fill="#2d2d2d" stroke="#1f1f1f" strokeWidth="2" />
              <path d="M 60,110 L 160,110 M 60,135 L 160,135" stroke="rgba(255, 255, 255, 0.08)" strokeWidth="1" />
              <text x="110" y="126" textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize="8" fontFamily="monospace" fontWeight="bold">HOLD</text>

              {/* Bones (Skeletal Underlay) */}
              <g stroke="rgba(255,255,255,0.15)" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round" fill="none">
                {/* Proximal Phalanx */}
                <line x1={mcpX} y1={mcpY} x2={pipX} y2={pipY} />
                {/* Middle Phalanx */}
                <line x1={pipX} y1={pipY} x2={dipX} y2={dipY} />
                {/* Distal Phalanx */}
                <line x1={dipX} y1={dipY} x2={tipX} y2={tipY} />
              </g>

              {/* Joints (white markers) */}
              <circle cx={mcpX} cy={mcpY} r="6" fill="#444" stroke="#222" strokeWidth="2" />
              <circle cx={pipX} cy={pipY} r="5" fill="#444" stroke="#222" strokeWidth="2" />
              <circle cx={dipX} cy={dipY} r="4" fill="#444" stroke="#222" strokeWidth="2" />

              {/* Bone inner core (grey rendering for bone shape) */}
              <g stroke="#888" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" fill="none">
                <line x1={mcpX} y1={mcpY} x2={pipX} y2={pipY} />
                <line x1={pipX} y1={pipY} x2={dipX} y2={dipY} />
                <line x1={dipX} y1={dipY} x2={tipX} y2={tipY} />
              </g>
              <g stroke="#ddd" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none">
                <line x1={mcpX} y1={mcpY} x2={pipX} y2={pipY} />
                <line x1={pipX} y1={pipY} x2={dipX} y2={dipY} />
                <line x1={dipX} y1={dipY} x2={tipX} y2={tipY} />
              </g>

              {/* Flexor Tendon (Deep FDP) */}
              {/* Draws a path starting from palm, under proximal phalanx, bowing around PIP, under middle phalanx, to distal base */}
              <path
                d={`M ${t0X},${t0Y} Q ${tA2X},${tA2Y} ${tPipX},${tPipY} T ${tA4X},${tA4Y} L ${tInsertX},${tInsertY}`}
                fill="none"
                stroke={pulleyForce > maxSafePulleyForce ? 'var(--ares-red)' : 'var(--ares-cyan)'}
                strokeWidth={3 + (tipForce / 150)}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="transition-colors duration-100"
              />

              {/* A2 Pulley Loop (located on proximal phalanx) */}
              <circle cx={midProxX} cy={midProxY} r="10" fill="none" stroke="var(--ares-gold)" strokeWidth="3" strokeDasharray="14 18" strokeDashoffset="5" />
              <text x={midProxX - 14} y={midProxY - 6} fill="var(--ares-gold)" fontSize="8" fontFamily="monospace" fontWeight="bold">A2</text>

              {/* A4 Pulley Loop (located on middle phalanx) */}
              <circle cx={midMidX} cy={midMidY} r="8" fill="none" stroke="var(--ares-gold)" strokeWidth="3" strokeDasharray="12 16" strokeDashoffset="3" />
              <text x={midMidX - 14} y={midMidY - 6} fill="var(--ares-gold)" fontSize="8" fontFamily="monospace" fontWeight="bold">A4</text>

              {/* Bowstring vector arrow (outward shear force) */}
              {pulleyForce > 50 && (
                <g transform={`translate(${tPipX}, ${tPipY}) rotate(${(params.mcpAngle + (params.mcpAngle - params.pipFlexion)) / 2 - 90})`}>
                  {/* Outward vector arrow */}
                  <line x1="0" y1="0" x2="0" y2={Math.min(30, 8 + pulleyForce / 15)} stroke="var(--ares-red)" strokeWidth="3.5" strokeLinecap="round" />
                  <path
                    d={`M -5,${Math.min(30, 8 + pulleyForce / 15) - 4} L 0,${Math.min(30, 8 + pulleyForce / 15)} L 5,${Math.min(30, 8 + pulleyForce / 15) - 4}`}
                    fill="none"
                    stroke="var(--ares-red)"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                  />
                  <text x="8" y="15" fill="var(--ares-red)" fontSize="8" fontFamily="monospace" fontWeight="bold" transform="rotate(90)">
                    SHEAR
                  </text>
                </g>
              )}

              {/* Active force vector at contact tip */}
              <g transform={`translate(${tipX}, ${tipY})`}>
                <line x1="0" y1="0" x2="0" y2={Math.min(40, 10 + tipForce / 10)} stroke="white" strokeWidth="2.5" strokeLinecap="round" />
                <path
                  d={`M -4,${Math.min(40, 10 + tipForce / 10) - 3} L 0,${Math.min(40, 10 + tipForce / 10)} L 4,${Math.min(40, 10 + tipForce / 10) - 3}`}
                  fill="none"
                  stroke="white"
                  strokeWidth="2.5"
                />
                <text x="6" y={Math.min(40, 10 + tipForce / 10) - 5} fill="white" fontSize="8" fontFamily="monospace">
                  F_tip
                </text>
              </g>
            </svg>

            {/* PIP Angle Display overlay */}
            <div className="absolute top-4 right-4 bg-obsidian/90 border border-white/10 rounded px-2 py-0.5 text-[10px] font-mono text-marble/60">
              PIP Flex: {params.pipFlexion}°
            </div>
          </div>
        </div>

        {/* Bottom Panel - Telemetry Dashboard */}
        <div className="lg:col-span-12 w-full mt-4">
          <div className="bg-white/5 border border-white/5 rounded-lg p-6 flex flex-col gap-6">
            <div>
              <h4 className="text-xs uppercase font-bold tracking-widest text-ares-gold border-b border-white/5 pb-2">
                Biomechanics Telemetry & Stress Dashboard
              </h4>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch">
              {/* Stat Card 1: Tendon Tension */}
              <div className="bg-black/20 border border-white/5 rounded-lg p-4 flex flex-col justify-between gap-4">
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-marble/40">Tendon Tension (F_fdp)</span>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-3xl font-heading font-black text-white">{tendonTension}</span>
                    <span className="text-xs text-marble/50">N</span>
                  </div>
                  <span className="text-[10px] text-marble/50 mt-1 leading-relaxed">
                    Lever multiplier: <span className="font-mono bg-black/30 px-1 py-0.5 rounded text-ares-gold">{params.mechanicalDisadvantage}x</span>
                  </span>
                </div>
              </div>

              {/* Stat Card 2: Outward Pulley Stress */}
              <div className="bg-black/20 border border-white/5 rounded-lg p-4 flex flex-col justify-between gap-4">
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-marble/40">Outward Pulley Stress</span>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className={`text-3xl font-heading font-black transition-colors duration-100 ${
                      pulleyForce > maxSafePulleyForce ? 'text-ares-red' : 'text-marble'
                    }`}>
                      {pulleyForce}
                    </span>
                    <span className="text-xs text-marble/50">N</span>
                  </div>
                  <span className="text-[9px] text-marble/40 font-mono mt-1">
                    Formula: 2 &times; F_fdp &times; sin(&theta;_pip/2)
                  </span>
                </div>
              </div>

              {/* Stat Card 3: Stress Meter */}
              <div className="bg-black/20 border border-white/5 rounded-lg p-4 flex flex-col justify-between gap-4">
                <div className="flex flex-col gap-1.5 justify-between h-full">
                  <div className="flex justify-between text-[11px] font-mono">
                    <span className="text-marble/50">Ligament Load Factor</span>
                    <span className={`font-bold ${stress.color}`}>{Math.round(stressRatio * 100)}%</span>
                  </div>
                  <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden mt-1">
                    <div
                      style={{ width: `${Math.min(100, stressRatio * 100)}%` }}
                      className={`h-full transition-[width] duration-300 ease-out ${
                        stressRatio < 0.5
                          ? 'bg-ares-cyan'
                          : stressRatio < 0.9
                          ? 'bg-ares-gold'
                          : 'bg-ares-red'
                      }`}
                    />
                  </div>
                  <span className="text-[9px] text-marble/30 font-mono mt-1 block">Max physiological limit ~450 N.</span>
                </div>
              </div>

              {/* Stat Card 4: Warning Callout */}
              <div className={`p-4 rounded-lg border text-xs leading-relaxed transition-all flex flex-col justify-between ${stress.bg} ${stress.border} ${stress.color}`}>
                <div>
                  <div className="flex items-center gap-1.5 font-bold mb-1.5">
                    {stressRatio > 0.9 ? <AlertTriangle className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
                    <span>{stress.status}: {stress.text}</span>
                  </div>
                  <p className="text-[10px] opacity-80 leading-normal font-sans">
                    {stressRatio > 1.2
                      ? 'Extreme stress! Continuous crimping at this force risks structural pulley ruptures. Rest immediately!'
                      : stressRatio > 0.9
                      ? 'High tendon load. Tendon sheath friction is high. Focus on open-hand positions to build endurance.'
                      : 'Friction angle and rope path are optimal. Pulley load is safely inside structural bounds.'}
                  </p>
                </div>
                
                <div className="text-[9px] opacity-60 border-t border-white/10 pt-2 mt-2 font-mono">
                  Safety Status: {stress.status}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
