/** @sim {"name": "Robotics Kinematics", "requiresContext": false} */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { HelpCircle, RefreshCw, Info, Cpu, Sliders } from 'lucide-react';

type KinematicsMode = 'ik' | 'fk';
type ElbowConfig = 'up' | 'down';
type AngleMode = 'degrees' | 'radians';

export default function TrigRoboticsSim() {
  const [mode, setMode] = useState<KinematicsMode>('ik');
  const [elbow, setElbow] = useState<ElbowConfig>('up');
  const [angleMode, setAngleMode] = useState<AngleMode>('degrees');

  // Link Lengths (in pixels/units inside 400x400 grid)
  const [l1, setL1] = useState<number>(100);
  const [l2, setL2] = useState<number>(80);

  // Target coordinates for IK mode
  const [targetX, setTargetX] = useState<number>(110);
  const [targetY, setTargetY] = useState<number>(90);

  // Joint Angles for FK mode (in degrees)
  const [fkTheta1, setFkTheta1] = useState<number>(45);
  const [fkTheta2, setFkTheta2] = useState<number>(45);

  const [isDragging, setIsDragging] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Grid coordinates center
  const cx = 200;
  const cy = 200;

  // Real-time calculated states
  let theta1Deg: number;
  let theta2Deg: number;
  let currentX: number;
  let currentY: number;
  let isOutOfReach: boolean;

  // Forward Kinematics (FK) calculations
  const calculateFK = useCallback((t1Deg: number, t2Deg: number, len1: number, len2: number) => {
    const r1 = (t1Deg * Math.PI) / 180;
    const r2 = (t2Deg * Math.PI) / 180;
    
    // Joint coordinates
    const j1x = len1 * Math.cos(r1);
    const j1y = len1 * Math.sin(r1);
    
    // End effector coordinates (relative to origin)
    const endX = j1x + len2 * Math.cos(r1 + r2);
    const endY = j1y + len2 * Math.sin(r1 + r2);

    return { j1x, j1y, endX, endY };
  }, []);

  // Inverse Kinematics (IK) calculations
  const calculateIK = useCallback((tx: number, ty: number, len1: number, len2: number, elb: ElbowConfig) => {
    const dSq = tx * tx + ty * ty;
    const d = Math.sqrt(dSq);
    
    // Bounds check
    let clampedX = tx;
    let clampedY = ty;
    let outOfReach = false;

    if (d > len1 + len2) {
      outOfReach = true;
      // Clamp to maximum reach boundary
      clampedX = tx * ((len1 + len2 - 0.1) / d);
      clampedY = ty * ((len1 + len2 - 0.1) / d);
    } else if (d < Math.abs(len1 - len2)) {
      outOfReach = true;
      // Clamp to minimum boundary
      const minDist = Math.max(0.1, Math.abs(len1 - len2) + 0.1);
      clampedX = tx * (minDist / d);
      clampedY = ty * (minDist / d);
    }

    const cDistSq = clampedX * clampedX + clampedY * clampedY;
    const cDist = Math.sqrt(cDistSq);

    // Law of cosines for elbow angle: theta2
    // cos(theta2) = (cDist^2 - len1^2 - len2^2) / (2 * len1 * len2)
    let cosTheta2 = (cDistSq - len1 * len1 - len2 * len2) / (2 * len1 * len2);
    // Safety clamp
    cosTheta2 = Math.max(-1, Math.min(1, cosTheta2));
    
    let t2Rad = Math.acos(cosTheta2);
    if (elb === 'down') {
      t2Rad = -t2Rad;
    }

    // Shoulder angle: theta1
    // alpha = atan2(y, x)
    // beta = acos((len1^2 + cDist^2 - len2^2) / (2 * len1 * cDist))
    const alpha = Math.atan2(clampedY, clampedX);
    let cosBeta = (len1 * len1 + cDistSq - len2 * len2) / (2 * len1 * cDist);
    cosBeta = Math.max(-1, Math.min(1, cosBeta));
    const beta = Math.acos(cosBeta);

    const t1Rad = elb === 'up' ? alpha - beta : alpha + beta;

    // Convert back to degrees
    let t1Deg = (t1Rad * 180) / Math.PI;
    const t2Deg = (t2Rad * 180) / Math.PI;

    // Normalize base angle between 0 and 360
    t1Deg = (t1Deg + 360) % 360;

    return {
      t1Deg,
      t2Deg,
      actualX: clampedX,
      actualY: clampedY,
      outOfReach
    };
  }, []);

  if (mode === 'ik') {
    // Solve inverse kinematics based on target coordinates
    const ikResult = calculateIK(targetX, targetY, l1, l2, elbow);
    theta1Deg = ikResult.t1Deg;
    theta2Deg = ikResult.t2Deg;
    currentX = ikResult.actualX;
    currentY = ikResult.actualY;
    isOutOfReach = ikResult.outOfReach;
  } else {
    // Solve forward kinematics based on joint sliders
    const fkResult = calculateFK(fkTheta1, fkTheta2, l1, l2);
    currentX = fkResult.endX;
    currentY = fkResult.endY;
    theta1Deg = fkTheta1;
    theta2Deg = fkTheta2;
    // Check reach envelope limits (virtually impossible to exceed in FK but useful for coordinate display limits)
    const dist = Math.sqrt(currentX * currentX + currentY * currentY);
    isOutOfReach = dist > l1 + l2 || dist < Math.abs(l1 - l2);
  }

  // Derive joint coordinates for SVG visualization
  const r1 = (theta1Deg * Math.PI) / 180;
  const j1x = l1 * Math.cos(r1);
  const j1y = l1 * Math.sin(r1);

  // SVG Positions
  const baseSvgX = cx;
  const baseSvgY = cy;
  const elbowSvgX = cx + j1x;
  const elbowSvgY = cy - j1y; // Invert Y for screen coordinates
  const wristSvgX = cx + currentX;
  const wristSvgY = cy - currentY; // Invert Y for screen coordinates
  const targetSvgX = cx + targetX;
  const targetSvgY = cy - targetY; // Target position in IK mode

  // Handlers for pointer interactions on the SVG Canvas
  const handlePointerMove = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    if (!isDragging || mode !== 'ik') return;

    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();

    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;

    // Map screen scale to 400x400 viewport coordinates
    const viewX = (clientX / rect.width) * 400;
    const viewY = (clientY / rect.height) * 400;

    // Convert relative to base coordinate center
    const dx = viewX - cx;
    const dy = cy - viewY; // Invert SVG axis to standard Cartesian

    setTargetX(Math.round(dx));
    setTargetY(Math.round(dy));
  }, [isDragging, mode]);

  useEffect(() => {
    const handleGlobalPointerUp = () => {
      setIsDragging(false);
    };
    window.addEventListener('pointerup', handleGlobalPointerUp);
    return () => window.removeEventListener('pointerup', handleGlobalPointerUp);
  }, []);

  const handleReset = () => {
    setMode('ik');
    setElbow('up');
    setAngleMode('degrees');
    setL1(100);
    setL2(80);
    setTargetX(110);
    setTargetY(90);
    setFkTheta1(45);
    setFkTheta2(45);
  };

  const formatAngle = (degVal: number) => {
    if (angleMode === 'degrees') {
      return `${degVal.toFixed(1)}°`;
    }
    const radVal = (degVal * Math.PI) / 180;
    return `${radVal.toFixed(3)} rad`;
  };

  return (
    <div
      ref={containerRef}
      className="sim-container flex flex-col gap-6 p-4 sm:p-6 text-ares-offwhite bg-ares-gray-deep/40 rounded-xl border border-white/5 max-w-2xl mx-auto w-full"
      style={{ minHeight: '660px' }}
    >
      {/* Interactive Visual Canvas Area */}
      <div className="w-full flex flex-col items-center gap-4 bg-obsidian/40 p-4 rounded-xl border border-white/5 relative">
        <div className="w-full flex justify-between items-center mb-2">
          <div className="flex items-center gap-2">
            <span className="font-heading font-black text-ares-gold uppercase tracking-wider text-sm sm:text-base">
              Planar 2-DOF Arm Kinematics
            </span>
            <div className="group relative">
              <Info size={14} className="text-ares-muted/60 hover:text-ares-gold cursor-help" />
              <div className="absolute left-0 bottom-6 hidden group-hover:block bg-obsidian-surface border border-white/10 p-3 rounded shadow-xl text-xs w-64 z-10 leading-relaxed text-marble/90">
                Robotic arms use trigonometry to calculate motion. Drag the glowing red target handle around the envelope. Observe how standard angles (θ₁ base, θ₂ elbow) calculate dynamically in real-time!
              </div>
            </div>
          </div>
          <button
            onClick={handleReset}
            className="p-1 text-xs font-bold text-ares-red/80 hover:text-ares-red flex items-center gap-1 transition-all hover:bg-ares-red/10 px-2.5 py-1 rounded"
          >
            <RefreshCw size={12} /> RESET
          </button>
        </div>

        {/* The SVG Cartesian Grid */}
        <div className="relative bg-obsidian-darker p-3 rounded-lg border border-white/10 shadow-2xl max-w-full">
          <svg
            width="400"
            height="400"
            viewBox="0 0 400 400"
            onPointerMove={handlePointerMove}
            className="w-full max-w-[400px] h-auto select-none touch-none"
          >
            {/* Grid background lines */}
            <line x1="20" y1={cy} x2="380" y2={cy} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
            <line x1={cx} y1="20" x2={cx} y2="380" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />

            {/* Grid ticks and limits */}
            <circle cx={cx} cy={cy} r="50" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="1" strokeDasharray="3,3" />
            <circle cx={cx} cy={cy} r="100" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="1" strokeDasharray="3,3" />
            <circle cx={cx} cy={cy} r="150" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="1" strokeDasharray="3,3" />

            {/* Reach boundaries */}
            {/* Inner limits: |L1 - L2| */}
            <circle cx={cx} cy={cy} r={Math.abs(l1 - l2)} fill="none" stroke="rgba(192, 0, 0, 0.15)" strokeWidth="1.5" strokeDasharray="4,4" />
            {/* Outer reach limits: L1 + L2 */}
            <circle cx={cx} cy={cy} r={l1 + l2} fill="rgba(255, 184, 28, 0.02)" stroke="#FFB81C" strokeWidth="1.5" strokeDasharray="3,3" />

            {/* Grid Coordinate text labels */}
            <text x="390" y={cy + 14} fill="rgba(255,255,255,0.25)" fontSize="9" fontFamily="monospace" textAnchor="end">X axis</text>
            <text x={cx + 6} y="22" fill="rgba(255,255,255,0.25)" fontSize="9" fontFamily="monospace">Y axis</text>

            <text x={cx + l1 + l2} y={cy + 14} fill="#FFB81C" fillOpacity="0.4" fontSize="8" fontFamily="monospace" textAnchor="middle">+{l1 + l2}</text>
            <text x={cx - (l1 + l2)} y={cy + 14} fill="#FFB81C" fillOpacity="0.4" fontSize="8" fontFamily="monospace" textAnchor="middle">-{l1 + l2}</text>

            {/* Reachable envelope filled zone (annulus) */}
            <path
              d={`
                M ${cx + (l1 + l2)} ${cy}
                A ${l1 + l2} ${l1 + l2} 0 1 0 ${cx - (l1 + l2)} ${cy}
                A ${l1 + l2} ${l1 + l2} 0 1 0 ${cx + (l1 + l2)} ${cy}
                Z
                M ${cx + Math.abs(l1 - l2)} ${cy}
                A ${Math.abs(l1 - l2)} ${Math.abs(l1 - l2)} 0 1 1 ${cx - Math.abs(l1 - l2)} ${cy}
                A ${Math.abs(l1 - l2)} ${Math.abs(l1 - l2)} 0 1 1 ${cx + Math.abs(l1 - l2)} ${cy}
                Z
              `}
              fill="rgba(255, 184, 28, 0.015)"
              fillRule="evenodd"
            />

            {/* Target position line from base (hypotenuse projection) */}
            {mode === 'ik' && (
              <line
                x1={baseSvgX}
                y1={baseSvgY}
                x2={targetSvgX}
                y2={targetSvgY}
                stroke="rgba(255,255,255,0.12)"
                strokeWidth="1.5"
                strokeDasharray="4,4"
              />
            )}

            {/* Arm Link 1 (Shoulder to Elbow) */}
            <line
              x1={baseSvgX}
              y1={baseSvgY}
              x2={elbowSvgX}
              y2={elbowSvgY}
              stroke="#CD7F32" // Bronze Link 1
              strokeWidth="7"
              strokeLinecap="round"
            />

            {/* Arm Link 2 (Elbow to Wrist) */}
            <line
              x1={elbowSvgX}
              y1={elbowSvgY}
              x2={wristSvgX}
              y2={wristSvgY}
              stroke="#FFB81C" // Gold Link 2
              strokeWidth="4.5"
              strokeLinecap="round"
            />

            {/* Base joint dot */}
            <circle cx={baseSvgX} cy={baseSvgY} r="10" fill="#CD7F32" stroke="#fff" strokeWidth="2" />
            <circle cx={baseSvgX} cy={baseSvgY} r="4" fill="#0A0A0A" />

            {/* Elbow joint dot */}
            <circle cx={elbowSvgX} cy={elbowSvgY} r="7" fill="#FFB81C" stroke="#fff" strokeWidth="1.5" />
            <circle cx={elbowSvgX} cy={elbowSvgY} r="2.5" fill="#0A0A0A" />

            {/* Wrist / end effector dot */}
            <circle cx={wristSvgX} cy={wristSvgY} r="5.5" fill="#C00000" stroke="#fff" strokeWidth="1.5" />

            {/* IK target dragging handle handle */}
            {mode === 'ik' && (
              <g>
                {/* Glowing halo indicator */}
                <circle
                  cx={targetSvgX}
                  cy={targetSvgY}
                  r="14"
                  fill="none"
                  stroke="#C00000"
                  strokeWidth="1.5"
                  strokeDasharray="3,3"
                  className="animate-spin"
                  style={{ transformOrigin: `${targetSvgX}px ${targetSvgY}px`, animationDuration: '6s' }}
                />
                
                {/* Active Interactive handle circle */}
                <circle
                  cx={targetSvgX}
                  cy={targetSvgY}
                  r="9"
                  fill="#C00000"
                  stroke="#fff"
                  strokeWidth="2"
                  cursor="grab"
                  className="hover:fill-white hover:stroke-[#C00000] transition-colors duration-150 active:cursor-grabbing"
                  onPointerDown={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                />
              </g>
            )}

            {/* Realtime angle display arches */}
            {/* Base angle (theta1) sector */}
            {theta1Deg > 0 && (
              <path
                d={`
                  M ${cx + 30} ${cy}
                  A 30 30 0 ${theta1Deg > 180 ? 1 : 0} 0
                  ${cx + 30 * Math.cos(r1)} ${cy - 30 * Math.sin(r1)}
                `}
                fill="none"
                stroke="#CD7F32"
                strokeWidth="2"
              />
            )}
          </svg>

          {/* Out of Reach Alarm Notification */}
          {isOutOfReach && (
            <div className="absolute top-4 left-4 bg-ares-red/90 text-white font-mono text-[10px] font-bold px-2 py-1 rounded shadow-md border border-white/20 select-none animate-pulse">
              ⚠️ REACH BOUNDARY / SINGULARITY
            </div>
          )}

          {/* Target Location coordinate tooltip overlay */}
          <div className="absolute bottom-4 right-4 bg-obsidian-surface/90 border border-white/10 px-2 py-1.5 rounded text-[10px] font-mono text-white select-none">
            <span className="text-ares-muted uppercase">Target: </span>
            X={<span className="font-bold text-white">{Math.round(currentX)}</span>}, 
            Y={<span className="font-bold text-white">{Math.round(currentY)}</span>}
          </div>
        </div>
        <p className="text-[10px] text-ares-muted/40 uppercase tracking-widest font-mono select-none">
          ARES Robotics Engine // 2-DOF Plane Kinematics Model
        </p>
      </div>

      {/* Control Module & Mathematics Cards */}
      <div className="w-full flex flex-col gap-5">
        {/* Toggle Mode: IK (Solver) vs FK (Joint Sliders) */}
        <div className="grid grid-cols-2 bg-obsidian-darker p-1 rounded-lg border border-white/5 shadow">
          {([
            { id: 'ik', label: 'Inverse Kinematics (IK)' },
            { id: 'fk', label: 'Forward Kinematics (FK)' },
          ] as const).map((tMode) => {
            const isActive = mode === tMode.id;
            return (
              <button
                key={tMode.id}
                onClick={() => setMode(tMode.id)}
                className={`py-2 px-1 text-xs sm:text-sm font-heading font-bold rounded-md transition-all select-none uppercase tracking-wider ${
                  isActive
                    ? 'bg-ares-red text-white shadow-md'
                    : 'text-ares-muted hover:text-white hover:bg-white/5'
                }`}
              >
                {tMode.label}
              </button>
            );
          })}
        </div>

        {/* Sliders Container Card */}
        <div className="bg-obsidian-surface/60 border border-white/5 rounded-xl p-5 shadow-lg flex flex-col gap-4">
          <div className="flex justify-between items-center mb-1">
            <h3 className="font-heading font-black text-xs uppercase tracking-widest text-ares-gold flex items-center gap-2">
              <Sliders size={14} /> Control Sliders
            </h3>
            
            {/* Units/Angle display switcher */}
            <div className="flex bg-obsidian-darker p-0.5 rounded border border-white/5">
              {(['degrees', 'radians'] as const).map((amode) => (
                <button
                  key={amode}
                  onClick={() => setAngleMode(amode)}
                  className={`px-2 py-0.5 text-[9px] font-mono uppercase tracking-wider rounded transition-all ${
                    angleMode === amode ? 'bg-ares-red text-white' : 'text-ares-muted hover:text-white'
                  }`}
                >
                  {amode === 'degrees' ? 'deg' : 'rad'}
                </button>
              ))}
            </div>
          </div>

          {/* Link Lengths Adjusters */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-2 border-b border-white/5">
            <div>
              <div className="flex justify-between font-mono text-xs mb-1 text-ares-muted">
                <span>Link 1 Length (L₁)</span>
                <span className="font-bold text-white">{l1}px</span>
              </div>
              <input
                type="range"
                min="60"
                max="140"
                step="1"
                value={l1}
                onChange={(e) => setL1(parseInt(e.target.value))}
                className="w-full accent-ares-bronze cursor-ew-resize"
              />
            </div>
            <div>
              <div className="flex justify-between font-mono text-xs mb-1 text-ares-muted">
                <span>Link 2 Length (L₂)</span>
                <span className="font-bold text-white">{l2}px</span>
              </div>
              <input
                type="range"
                min="40"
                max="120"
                step="1"
                value={l2}
                onChange={(e) => setL2(parseInt(e.target.value))}
                className="w-full accent-ares-gold cursor-ew-resize"
              />
            </div>
          </div>

          {/* Mode-Specific Parameter Sliders */}
          {mode === 'ik' ? (
            <div className="flex flex-col gap-4">
              <div className="flex justify-between items-center mb-1 bg-black/10 p-2 rounded border border-white/5">
                <span className="text-[10px] font-mono text-ares-muted uppercase">Elbow Configuration:</span>
                <div className="flex gap-1">
                  {(['up', 'down'] as const).map((elb) => (
                    <button
                      key={elb}
                      onClick={() => setElbow(elb)}
                      className={`px-3 py-1 text-[10px] font-bold rounded uppercase tracking-wider transition-all ${
                        elbow === elb ? 'bg-ares-gold text-obsidian font-black shadow-md' : 'text-ares-muted hover:text-white hover:bg-white/5'
                      }`}
                    >
                      {elb === 'up' ? 'Elbow Up' : 'Elbow Down'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="flex justify-between font-mono text-xs mb-1 text-ares-red">
                    <span>Target X</span>
                    <span className="font-bold text-white">{targetX}</span>
                  </div>
                  <input
                    type="range"
                    min="-180"
                    max="180"
                    step="1"
                    value={targetX}
                    onChange={(e) => setTargetX(parseInt(e.target.value))}
                    className="w-full accent-ares-red cursor-ew-resize"
                  />
                </div>
                <div>
                  <div className="flex justify-between font-mono text-xs mb-1 text-ares-red">
                    <span>Target Y</span>
                    <span className="font-bold text-white">{targetY}</span>
                  </div>
                  <input
                    type="range"
                    min="-180"
                    max="180"
                    step="1"
                    value={targetY}
                    onChange={(e) => setTargetY(parseInt(e.target.value))}
                    className="w-full accent-ares-red cursor-ew-resize"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <div className="flex justify-between font-mono text-xs mb-1 text-ares-bronze">
                  <span>Base Angle (θ₁)</span>
                  <span className="font-bold text-white">{formatAngle(fkTheta1)}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="360"
                  step="1"
                  value={fkTheta1}
                  onChange={(e) => setFkTheta1(parseInt(e.target.value))}
                  className="w-full accent-ares-bronze cursor-ew-resize"
                />
              </div>
              <div>
                <div className="flex justify-between font-mono text-xs mb-1 text-ares-gold">
                  <span>Elbow Angle (θ₂)</span>
                  <span className="font-bold text-white">{formatAngle(fkTheta2)}</span>
                </div>
                <input
                  type="range"
                  min="-150"
                  max="150"
                  step="1"
                  value={fkTheta2}
                  onChange={(e) => setFkTheta2(parseInt(e.target.value))}
                  className="w-full accent-ares-gold cursor-ew-resize"
                />
              </div>
            </div>
          )}
        </div>

        {/* Dynamic Angles Output Card */}
        <div className="bg-obsidian-surface/60 border border-white/5 rounded-xl p-5 shadow-lg">
          <h3 className="font-heading font-black text-xs uppercase tracking-widest text-ares-red mb-3 flex items-center gap-2">
            <Cpu size={14} /> Solved Kinematic Coordinates
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Theta 1 (Base Joint) Card */}
            <div className="p-3.5 rounded-lg border border-ares-bronze/35 bg-ares-bronze/10">
              <div className="flex justify-between items-center mb-1">
                <span className="text-[10px] font-mono text-white/50 uppercase tracking-widest">
                  Shoulder Angle (θ₁)
                </span>
                <span className="text-[9px] font-mono text-ares-bronze font-bold">Base Joint</span>
              </div>
              <div className="font-mono text-lg font-bold text-white leading-tight">
                θ₁ = <span className="text-ares-bronze font-black">{formatAngle(theta1Deg)}</span>
              </div>
            </div>

            {/* Theta 2 (Elbow Joint) Card */}
            <div className="p-3.5 rounded-lg border border-ares-gold/35 bg-ares-gold/10">
              <div className="flex justify-between items-center mb-1">
                <span className="text-[10px] font-mono text-white/50 uppercase tracking-widest">
                  Elbow Angle (θ₂)
                </span>
                <span className="text-[9px] font-mono text-ares-gold font-bold">Elbow Joint</span>
              </div>
              <div className="font-mono text-lg font-bold text-white leading-tight">
                θ₂ = <span className="text-ares-gold font-black">{formatAngle(theta2Deg)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Real-time Math Kinematics Breakdown */}
        <div className="bg-obsidian-surface/60 border border-white/5 rounded-xl p-5 shadow-lg">
          <h3 className="font-heading font-black text-xs uppercase tracking-widest text-ares-gold mb-3 flex items-center gap-2">
            <HelpCircle size={14} /> Robotics Math breakdown
          </h3>

          <div className="text-xs sm:text-sm font-sans leading-relaxed text-marble/80 space-y-4">
            <p>
              In robotics, standard arm tracking involves translating between **Joint Angles** (the motors) and **Spatial Coordinates** (where the arm tip should grab).
            </p>
            
            <div className="border-l-2 border-ares-bronze pl-3.5 space-y-1.5">
              <h4 className="font-bold text-white text-xs uppercase tracking-wider">1. Forward Kinematics (Angles → Coordinates)</h4>
              <p className="text-marble/70">
                To find the exact target $(x,y)$ location from our motorized joint angles:
              </p>
              <div className="font-mono bg-black/20 p-2.5 rounded text-center text-xs text-white border border-white/5 space-y-1">
                <div>x = L₁·cos(θ₁) + L₂·cos(θ₁ + θ₂)</div>
                <div>x = {l1}·cos({theta1Deg.toFixed(1)}°) + {l2}·cos({(theta1Deg + theta2Deg).toFixed(1)}°) = <span className="text-ares-gold font-bold">{Math.round(currentX)}</span></div>
                <div className="mt-1.5">y = L₁·sin(θ₁) + L₂·sin(θ₁ + θ₂)</div>
                <div>y = {l1}·sin({theta1Deg.toFixed(1)}°) + {l2}·sin({(theta1Deg + theta2Deg).toFixed(1)}°) = <span className="text-ares-gold font-bold">{Math.round(currentY)}</span></div>
              </div>
            </div>

            <div className="border-l-2 border-ares-red pl-3.5 space-y-1.5">
              <h4 className="font-bold text-white text-xs uppercase tracking-wider">2. Inverse Kinematics (Coordinates → Angles)</h4>
              <p className="text-marble/70">
                In actual robotics libraries like **ARESLib**, developers do the opposite: they input a target coordinate (x, y) and use inverse trigonometry to find the required motor angles.
              </p>
              <p className="text-marble/70">
                We calculate the elbow angle θ₂ using the **Law of Cosines**:
              </p>
              <div className="font-mono bg-black/20 p-2 rounded text-center text-xs text-white border border-white/5">
                cos(θ₂) = (x² + y² - L₁² - L₂²) / (2·L₁·L₂) = {( (currentX * currentX + currentY * currentY - l1*l1 - l2*l2) / (2 * l1 * l2) ).toFixed(3)}
              </div>
              <p className="text-marble/70">
                And the shoulder angle θ₁ using the two-argument arctangent function **atan2(y, x)** and arccos boundaries:
              </p>
              <div className="font-mono bg-black/20 p-2 rounded text-center text-xs text-white border border-white/5">
                θ₁ = atan2(y, x) - acos( (L₁² + D² - L₂²) / (2·L₁·D) )
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
