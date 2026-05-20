/** @sim {"name": "Center of Mass & Friction Vectors", "requiresContext": false} */
import { useState, useMemo } from 'react';
import { ShieldAlert, Award, Compass } from 'lucide-react';

export default function ClimbingCenterOfMassSim() {
  const [wallAngle, setWallAngle] = useState(90); // degrees (75 slab, 90 vertical, 120 overhang)
  const [hipDistance, setHipDistance] = useState(0.4); // meters from wall (0.1 to 0.8)
  const [frictionCoef, setFrictionCoef] = useState(0.6); // coefficient of friction (0.2 to 1.0)
  const [climberWeight, setClimberWeight] = useState(70); // kg

  const GRAVITY = 9.81;
  const weightN = climberWeight * GRAVITY;

  // Derive kinematics and forces using simple rigid body static equilibrium model
  const physics = useMemo(() => {
    // Kinematic coordinates inside virtual space (in meters)
    // Foot is origin (0, 0)
    const wallAngleRad = (wallAngle * Math.PI) / 180;
    
    // Hand hold is at height of 1.6 meters, following the wall angle
    const handX = 1.6 * Math.cos(wallAngleRad);
    const handY = 1.6 * Math.sin(wallAngleRad);

    // Center of Mass (Hips) position relative to the wall line
    // Wall line vector: (cos(theta), sin(theta))
    // Perpendicular vector (outwards): (sin(theta), -cos(theta))
    const comBaseHeight = 0.8; // mid body height
    const wallBaseX = comBaseHeight * Math.cos(wallAngleRad);
    const wallBaseY = comBaseHeight * Math.sin(wallAngleRad);

    // Shift Com away along the normal vector
    const comX = wallBaseX + hipDistance * Math.sin(wallAngleRad);
    const comY = wallBaseY - hipDistance * Math.cos(wallAngleRad);

    // Sum of torques around foot contact point:
    // Torque due to gravity: W * comX (pulls down and clockwise)
    // Countered by hand horizontal force (pulling inward to wall)
    // F_pull_horizontal = W * comX / handY
    const fingerPullH = (weightN * comX) / handY;
    
    // Total vertical force is distributed between hand and foot.
    // For simplicity, let's distribute vertical load:
    const verticalHandLoadRatio = Math.max(0.1, 0.5 - (wallAngle - 90) / 60); // higher wall angle (overhang) places more vertical load on hands
    const handYForce = weightN * verticalHandLoadRatio;
    const footYForce = weightN * (1 - verticalHandLoadRatio);

    // Foot forces
    // Normal force to the wall, shear force parallel to the wall
    const footNormalForce = footYForce * Math.sin(wallAngleRad) + fingerPullH * Math.cos(wallAngleRad);
    const footShearForce = footYForce * Math.cos(wallAngleRad) - fingerPullH * Math.sin(wallAngleRad);

    // Calculate required coefficient of friction at feet: mu_req = Shear / Normal
    const feetCut = footNormalForce <= 5;
    const requiredMu = feetCut ? 999 : Math.abs(footShearForce / footNormalForce);
    const feetSlipping = feetCut ? true : requiredMu > frictionCoef;

    // Adjust finger holding tension
    // If feet cut, hands hold 100% of climber weight!
    const effectiveFingerPull = feetCut 
      ? weightN 
      : Math.sqrt(fingerPullH * fingerPullH + handYForce * handYForce);

    const fingerPullPercentage = parseFloat(((effectiveFingerPull / weightN) * 100).toFixed(0));

    return {
      handX, handY,
      comX, comY,
      fingerPullH,
      effectiveFingerPull,
      fingerPullPercentage,
      footNormalForce,
      footShearForce,
      requiredMu,
      feetSlipping,
      feetCut
    };
  }, [wallAngle, hipDistance, frictionCoef, weightN]);

  // Determine wall status text and color themes
  const getFrictionStatus = () => {
    if (physics.feetCut) {
      return { text: 'FEET CUT (100% ARM LOAD!)', color: 'text-ares-red-light', border: 'border-ares-red/30', bg: 'bg-ares-red/10', state: 'danger' };
    } else if (physics.feetSlipping) {
      return { text: 'FOOT SLIP RISK (Slipping!)', color: 'text-ares-bronze-light', border: 'border-ares-bronze/30', bg: 'bg-ares-bronze/10', state: 'warning' };
    } else {
      return { text: 'STABLE EQUILIBRIUM', color: 'text-ares-cyan', border: 'border-ares-cyan/30', bg: 'bg-ares-cyan/10', state: 'stable' };
    }
  };

  const status = getFrictionStatus();

  return (
    <div className="glass-card bg-obsidian border border-white/10 rounded-xl p-6 text-marble shadow-2xl">
      <div className="flex flex-col gap-2 mb-6">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider bg-ares-red/20 text-ares-red border border-ares-red/30">
            Static Mechanics
          </span>
          <h3 className="text-xl font-heading font-bold text-white tracking-wide">
            Center of Mass & Friction Vectors
          </h3>
        </div>
        <p className="text-marble/70 text-sm leading-relaxed max-w-3xl">
          Climbing is a dance of static equilibrium. By keeping your hips close to the wall, you minimize the torque (lever effect) that tries to peel your hands off the holds. Watch how shifting your weight changes the load on your fingers.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Panel: Simulation Controls */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          <div className="bg-white/5 border border-white/5 rounded-lg p-5 flex flex-col gap-5">
            <h4 className="text-xs uppercase font-bold tracking-widest text-ares-gold border-b border-white/5 pb-2">
              Configuration
            </h4>

            {/* Slider 1: Wall Angle */}
            <div className="flex flex-col gap-2">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-marble/60">Wall Slope / Angle</span>
                <span className="text-white font-bold">
                  {wallAngle}&deg; ({wallAngle === 90 ? 'Vertical' : wallAngle > 90 ? `${wallAngle - 90}° Overhang` : `${90 - wallAngle}° Slab`})
                </span>
              </div>
              <input
                type="range"
                min="70"
                max="135"
                step="5"
                value={wallAngle}
                onChange={(e) => setWallAngle(parseInt(e.target.value, 10))}
                className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-ares-red"
                aria-label="Climbing wall inclination angle"
              />
              <span className="text-[10px] text-marble/40">Slab leans inward (easier on hands), overhangs lean outwards.</span>
            </div>

            {/* Slider 2: Hips Distance (CoM) */}
            <div className="flex flex-col gap-2">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-marble/60">Hips Distance from Wall</span>
                <span className="text-white font-bold">{hipDistance.toFixed(2)} m</span>
              </div>
              <input
                type="range"
                min="0.10"
                max="0.80"
                step="0.05"
                value={hipDistance}
                onChange={(e) => setHipDistance(parseFloat(e.target.value))}
                className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-ares-red"
                aria-label="Distance of climber hips and center of mass from the wall"
              />
              <span className="text-[10px] text-marble/40">Keep your hips close to the rock to save your forearm muscles!</span>
            </div>

            {/* Slider 3: Foot Hold Friction */}
            <div className="flex flex-col gap-2">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-marble/60">Foot Hold Friction Coefficient (Static &mu;)</span>
                <span className="text-white font-bold">{frictionCoef.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0.30"
                max="0.95"
                step="0.05"
                value={frictionCoef}
                onChange={(e) => setFrictionCoef(parseFloat(e.target.value))}
                className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-ares-red"
                aria-label="Friction coefficient of climbing shoe rubber on footholds"
              />
              <span className="text-[10px] text-marble/40">Simulates rubber quality, chalk usage, or hold size.</span>
            </div>

            {/* Slider 4: Climber Weight */}
            <div className="flex flex-col gap-2">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-marble/60">Climber Weight</span>
                <span className="text-white font-bold">{climberWeight} kg</span>
              </div>
              <input
                type="range"
                min="50"
                max="100"
                step="5"
                value={climberWeight}
                onChange={(e) => setClimberWeight(parseInt(e.target.value, 10))}
                className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-ares-red"
                aria-label="Climber weight"
              />
            </div>
          </div>
        </div>

        {/* Center Panel: Vector Diagram SVG */}
        <div className="lg:col-span-4 flex flex-col items-center justify-center">
          <div className="w-full max-w-[280px] bg-black/40 border border-white/5 rounded-xl p-4 flex flex-col items-center relative overflow-hidden">
            
            {/* SVG Vector Drawing */}
            <svg
              viewBox="0 0 200 320"
              className="w-full h-[320px]"
              role="img"
              aria-label="Vector mechanics analysis diagram of climber normal, gravity, and shear friction forces"
            >
              <rect width="200" height="320" fill="#0d0f14" rx="8" />

              {/* Draw Wall Line */}
              {/* Foot origin is at (100, 260). Hands are at wall angle. */}
              {(() => {
                const angleRad = (wallAngle * Math.PI) / 180;
                // Draw wall extending past hand and foot
                const wallStartX = 100 - 0.4 * 120 * Math.cos(angleRad);
                const wallStartY = 260 + 0.4 * 120 * Math.sin(angleRad);
                const wallEndX = 100 + 1.8 * 120 * Math.cos(angleRad);
                const wallEndY = 260 - 1.8 * 120 * Math.sin(angleRad);

                return (
                  <line
                    x1={wallStartX}
                    y1={wallStartY}
                    x2={wallEndX}
                    y2={wallEndY}
                    stroke="var(--ares-gray)"
                    strokeWidth="8"
                    strokeLinecap="round"
                    opacity="0.3"
                  />
                );
              })()}

              {/* Draw Hold Points */}
              {(() => {
                const angleRad = (wallAngle * Math.PI) / 180;
                const hx = 100 + 1.6 * 120 * Math.cos(angleRad);
                const hy = 260 - 1.6 * 120 * Math.sin(angleRad);
                return (
                  <>
                    {/* Hand Hold */}
                    <path d={`M${hx - 8},${hy} Q${hx},${hy - 6} ${hx + 8},${hy}`} fill="var(--ares-gold)" />
                    {/* Foot Hold */}
                    <path d="M92,260 Q100,256 108,260" fill="var(--ares-gold)" />
                  </>
                );
              })()}

              {/* Climber Skeleton Figure */}
              {(() => {
                const angleRad = (wallAngle * Math.PI) / 180;
                const hx = 100 + 1.6 * 120 * Math.cos(angleRad);
                const hy = 260 - 1.6 * 120 * Math.sin(angleRad);

                // Hip Center of Mass (CoM)
                const cx = 100 + physics.comX * 120;
                const cy = 260 - physics.comY * 120;

                // Shoulder position
                const shx = 100 + (1.3 * Math.cos(angleRad) + (hipDistance * 0.4) * Math.sin(angleRad)) * 120;
                const shy = 260 - (1.3 * Math.sin(angleRad) - (hipDistance * 0.4) * Math.cos(angleRad)) * 120;

                return (
                  <g>
                    {/* Gravity Center of Mass (CoM) Dot */}
                    <circle cx={cx} cy={cy} r="8" fill="var(--ares-red)" className="animate-pulse" />
                    <circle cx={cx} cy={cy} r="4" fill="white" />

                    {/* Torso (Hip to Shoulder) */}
                    <line x1={cx} y1={cy} x2={shx} y2={shy} stroke="white" strokeWidth="4" strokeLinecap="round" />
                    {/* Head */}
                    <circle cx={shx + 4 * Math.cos(angleRad)} cy={shy - 14} r="6" fill="white" />
                    
                    {/* Arms (Shoulder to Hand Hold) */}
                    <line x1={shx} y1={shy} x2={hx} y2={hy} stroke="white" strokeWidth="2.5" strokeLinecap="round" />

                    {/* Legs (Hip to Foot Hold at 100, 260) */}
                    {/* Draw knee bent slightly outwards */}
                    <line x1={cx} y1={cy} x2={(cx + 100) / 2 + 10} y2={(cy + 260) / 2 + 5} stroke="white" strokeWidth="3" strokeLinecap="round" />
                    <line x1={(cx + 100) / 2 + 10} y1={(cy + 260) / 2 + 5} x2="100" y2="260" stroke="white" strokeWidth="3" strokeLinecap="round" />

                    {/* Vector Arrow: Gravity (downward from CoM) */}
                    <line x1={cx} y1={cy} x2={cx} y2={cy + 50} stroke="var(--ares-red)" strokeWidth="2.5" strokeLinecap="round" />
                    <polygon points={`${cx},${cy + 52} ${cx - 4},${cy + 46} ${cx + 4},${cy + 46}`} fill="var(--ares-red)" />
                    <text x={cx + 8} y={cy + 45} fill="var(--ares-red)" fontSize="8" fontFamily="monospace" fontWeight="bold">GRAVITY</text>

                    {/* Vector Arrow: Finger Pull (horizontal pull toward wall) */}
                    {physics.effectiveFingerPull > 10 && (
                      <g>
                        <line x1={hx} y1={hy} x2={hx - Math.min(45, physics.fingerPullH * 0.15)} y2={hy} stroke="var(--ares-cyan)" strokeWidth="2" strokeLinecap="round" />
                        <polygon points={`${hx - Math.min(45, physics.fingerPullH * 0.15) - 2},${hy} ${hx - Math.min(45, physics.fingerPullH * 0.15) + 3},${hy - 3} ${hx - Math.min(45, physics.fingerPullH * 0.15) + 3},${hy + 3}`} fill="var(--ares-cyan)" />
                        <text x={hx - 10} y={hy - 6} textAnchor="end" fill="var(--ares-cyan)" fontSize="7" fontFamily="monospace">TENSION</text>
                      </g>
                    )}

                    {/* Vector Arrow: Foot normal & friction shear forces */}
                    {!physics.feetCut && (
                      <g>
                        {/* Normal force arrow (perpendicular to wall) */}
                        <line x1="100" y1="260" x2={100 + Math.sin(angleRad) * 35} y2={260 - Math.cos(angleRad) * 35} stroke="var(--ares-gold)" strokeWidth="2" strokeLinecap="round" />
                        <text x={105 + Math.sin(angleRad) * 20} y={255 - Math.cos(angleRad) * 20} fill="var(--ares-gold)" fontSize="7" fontFamily="monospace">NORMAL</text>
                      </g>
                    )}
                  </g>
                );
              })()}
            </svg>

            {/* Live Indicator Overlay */}
            <div className="absolute top-4 right-4 bg-obsidian/90 border border-white/10 rounded px-2.5 py-1 text-[10px] font-mono text-center">
              <span className="text-marble/50">Required Friction (&mu;):</span>
              <div className="text-white font-bold">{physics.feetCut ? 'Infinite' : physics.requiredMu.toFixed(2)}</div>
            </div>
          </div>
        </div>

        {/* Right Panel: Telemetry Dashboard */}
        <div className="lg:col-span-3 flex flex-col gap-6">
          <div className="bg-white/5 border border-white/5 rounded-lg p-5 flex flex-col gap-5">
            <h4 className="text-xs uppercase font-bold tracking-widest text-ares-gold border-b border-white/5 pb-2">
              Mechanical Metrics
            </h4>

            {/* Metric: Finger Pull */}
            <div className="flex flex-col">
              <span className="text-[10px] uppercase font-bold tracking-wider text-marble/40">Finger Holding Tension</span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className={`text-3xl font-heading font-black transition-colors ${
                  physics.fingerPullPercentage > 75 ? 'text-ares-red' : physics.fingerPullPercentage > 50 ? 'text-ares-gold' : 'text-marble'
                }`}>
                  {physics.fingerPullPercentage}%
                </span>
                <span className="text-xs text-marble/50">of weight</span>
              </div>
              <span className="text-[10px] text-marble/50 mt-1">
                Equal to <strong className="text-white">{physics.effectiveFingerPull.toFixed(0)} N</strong> of force.
              </span>
            </div>

            {/* Metric: Foot Status Gauge */}
            <div className="flex flex-col gap-2">
              <span className="text-[10px] uppercase font-bold tracking-wider text-marble/40">Friction Limit Gauge</span>
              <div className="flex justify-between text-xs font-mono text-marble/60">
                <span>Shear Friction / Available</span>
                <span>{physics.feetCut ? 'N/A' : `${physics.requiredMu.toFixed(2)} / ${frictionCoef.toFixed(2)}`}</span>
              </div>
              <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                <div
                  style={{ width: `${physics.feetCut ? 100 : Math.min(100, (physics.requiredMu / frictionCoef) * 100)}%` }}
                  className={`h-full transition-all duration-300 ${
                    physics.feetCut ? 'bg-ares-red' : physics.feetSlipping ? 'bg-ares-gold' : 'bg-ares-cyan'
                  }`}
                />
              </div>
            </div>

            {/* Static EQ Safety Banner */}
            <div className={`p-3 rounded border text-xs leading-relaxed transition-all ${status.bg} ${status.border} ${status.color}`}>
              <div className="flex items-center gap-1.5 font-bold mb-1">
                {status.state === 'danger' || status.state === 'warning' ? (
                  <ShieldAlert className="w-4 h-4" />
                ) : (
                  <Compass className="w-4 h-4" />
                )}
                <span>{status.text}</span>
              </div>
              <p className="text-[10px] opacity-80 leading-normal font-sans">
                {physics.feetCut 
                  ? 'Severe overhanging and hip displacement completely unloaded your feet. Forearms are draining fast!'
                  : physics.feetSlipping 
                  ? 'The foot friction requirement exceeds available rubber grip. Shift your hips closer to restore normal force!'
                  : 'Center of gravity aligns optimally with available holds. Good static footing allows indefinitely sustained locks.'}
              </p>
            </div>

            {/* Pro Tips */}
            <div className="p-3 bg-white/5 border border-white/5 rounded text-[10px] leading-relaxed text-marble/50">
              <div className="flex items-center gap-1 text-ares-gold font-bold mb-1">
                <Award className="w-3.5 h-3.5" />
                <span>COGNITIVE BREAKDOWN</span>
              </div>
              <span className="block font-bold text-white mb-0.5">&quot;In Other Words&quot;</span>
              Imagine holding a heavy bucket of water. If you hold it close to your chest (Center of Mass near the wall), it feels light. If you hold it far out in front of you (hips sagged out), your fingers get tired in seconds! Keep your hips tucked.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
