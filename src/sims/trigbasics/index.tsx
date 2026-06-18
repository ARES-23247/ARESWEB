/** @sim {"name": "Trigonometry Basics", "requiresContext": false} */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { HelpCircle, RefreshCw, Layers, Info } from 'lucide-react';

type AngleMode = 'degrees' | 'radians';

// List of standard angles in degrees and their radian names for educational snapping
const STANDARD_ANGLES = [
  { deg: 0, rad: '0', label: '0' },
  { deg: 30, rad: 'π/6', label: '30° (π/6)' },
  { deg: 45, rad: 'π/4', label: '45° (π/4)' },
  { deg: 60, rad: 'π/3', label: '60° (π/3)' },
  { deg: 90, rad: 'π/2', label: '90° (π/2)' },
  { deg: 120, rad: '2π/3', label: '120° (2π/3)' },
  { deg: 135, rad: '3π/4', label: '135° (3π/4)' },
  { deg: 150, rad: '5π/6', label: '150° (5π/6)' },
  { deg: 180, rad: 'π', label: '180° (π)' },
  { deg: 210, rad: '7π/6', label: '210° (7π/6)' },
  { deg: 225, rad: '5π/4', label: '225° (5π/4)' },
  { deg: 240, rad: '4π/3', label: '240° (4π/3)' },
  { deg: 270, rad: '3π/2', label: '270° (3π/2)' },
  { deg: 300, rad: '5π/3', label: '300° (5π/3)' },
  { deg: 315, rad: '7π/4', label: '315° (7π/4)' },
  { deg: 330, rad: '11π/6', label: '330° (11π/6)' },
  { deg: 360, rad: '2π', label: '360° (2π)' },
];

export default function TrigBasicsSim() {
  const [angleMode, setAngleMode] = useState<AngleMode>('degrees');
  const [angleDeg, setAngleDeg] = useState<number>(45); // Active angle in degrees [0, 360]
  const [isSnapping, setIsSnapping] = useState<boolean>(true);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Derive coordinates and ratios
  const radians = (angleDeg * Math.PI) / 180;
  const sinValue = Math.sin(radians);
  const cosValue = Math.cos(radians);
  // Tangent is undefined at 90 and 270 degrees
  const isTanUndefined = angleDeg === 90 || angleDeg === 270;
  const tanValue = isTanUndefined ? Infinity : Math.tan(radians);

  // Unit circle center and rendering radius inside a 400x400 SVG viewport
  const cx = 200;
  const cy = 200;
  const R = 130; // 130px represents 1.0 unit radius

  // Interactive handler for pointer dragging
  const handlePointerMove = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    if (!isDragging) return;

    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();

    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;

    // Viewport coordinates inside 400x400 box
    const viewX = (clientX / rect.width) * 400;
    const viewY = (clientY / rect.height) * 400;

    // Grid coordinates relative to center (0,0)
    const dx = viewX - cx;
    const dy = cy - viewY; // Invert Y axis

    let rawRad = Math.atan2(dy, dx);
    if (rawRad < 0) {
      rawRad += Math.PI * 2;
    }

    let rawDeg = (rawRad * 180) / Math.PI;

    // Snap to nearest 1 degree
    rawDeg = Math.round(rawDeg);

    if (isSnapping) {
      // Find closest standard angle within 6 degrees threshold
      let bestAngle = rawDeg;
      let minDiff = Infinity;
      for (const std of STANDARD_ANGLES) {
        const diff = Math.abs(std.deg - rawDeg);
        if (diff < minDiff && diff <= 6) {
          minDiff = diff;
          bestAngle = std.deg;
        }
      }
      setAngleDeg(bestAngle % 360);
    } else {
      setAngleDeg(rawDeg % 360);
    }
  }, [isDragging, isSnapping]);

  useEffect(() => {
    const handleGlobalPointerUp = () => {
      setIsDragging(false);
    };
    window.addEventListener('pointerup', handleGlobalPointerUp);
    return () => window.removeEventListener('pointerup', handleGlobalPointerUp);
  }, []);

  const handleReset = () => {
    setAngleMode('degrees');
    setAngleDeg(45);
    setIsSnapping(true);
  };

  // Format angle string for rendering
  const formatAngle = () => {
    if (angleMode === 'degrees') {
      return `${angleDeg}°`;
    }
    // Match to a standard fraction of pi if possible
    const match = STANDARD_ANGLES.find(std => std.deg === angleDeg);
    if (match) {
      return match.rad;
    }
    const radVal = (angleDeg * Math.PI) / 180;
    return `${radVal.toFixed(3)} rad`;
  };

  // SVG coordinate conversions
  const px = cx + cosValue * R;
  const py = cy - sinValue * R;

  // Tangent intersection coordinate: secant meets vertical tangent line at x = 1 (cx + R)
  // Target position is: x = cx + R, y = cy - tan * R
  // Clamp tangent rendering height for view safety
  const maxTanHeight = 4.0;
  const safeTanVal = Math.max(-maxTanHeight, Math.min(maxTanHeight, tanValue));
  const tx = cx + R;
  const ty = cy - safeTanVal * R;

  // Arc path representing the angle sector
  const drawAngleArc = () => {
    if (angleDeg === 0) return null;
    const arcRadius = 35;
    // Determine SVG large arc flag (1 if angle > 180 degrees)
    const largeArcFlag = angleDeg > 180 ? 1 : 0;
    // Sweep flag is 0 because SVG coordinate Y goes down, so counter-clockwise rotation is negative sweep in standard coords
    // Target coordinate for the arc path
    const ax = cx + Math.cos(radians) * arcRadius;
    const ay = cy - Math.sin(radians) * arcRadius;

    return (
      <path
        d={`M ${cx + arcRadius} ${cy} A ${arcRadius} ${arcRadius} 0 ${largeArcFlag} 0 ${ax} ${ay}`}
        fill="rgba(192, 0, 0, 0.15)"
        stroke="#C00000"
        strokeWidth="1.5"
      />
    );
  };

  return (
    <div
      ref={containerRef}
      className="sim-container flex flex-col gap-6 p-4 sm:p-6 text-ares-offwhite bg-ares-gray-deep/40 rounded-xl border border-white/5 max-w-2xl mx-auto w-full"
      style={{ minHeight: '620px' }}
    >
      {/* Interactive Canvas Area */}
      <div className="w-full flex flex-col items-center gap-4 bg-obsidian/40 p-4 rounded-xl border border-white/5 relative">
        <div className="w-full flex justify-between items-center mb-2">
          <div className="flex items-center gap-2">
            <span className="font-heading font-black text-ares-gold uppercase tracking-wider text-sm sm:text-base">
              Unit Circle Visualizer
            </span>
            <div className="group relative">
              <Info size={14} className="text-ares-muted/60 hover:text-ares-gold cursor-help" />
              <div className="absolute left-0 bottom-6 hidden group-hover:block bg-obsidian-surface border border-white/10 p-3 rounded shadow-xl text-xs w-64 z-10 leading-relaxed text-marble/90">
                Drag the glowing red coordinate handle around the circle perimeter. Observe how Sine (vertical red height), Cosine (horizontal gold width), and Tangent (bronze line) transform dynamically!
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
            <defs>
              <marker id="trig-arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 2 L 10 5 L 0 8 z" fill="rgba(255,255,255,0.4)" />
              </marker>
            </defs>

            {/* Grid background ticks */}
            <line x1="20" y1={cy} x2="380" y2={cy} stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" markerEnd="url(#trig-arrow)" markerStart="url(#trig-arrow)" />
            <line x1={cx} y1="20" x2={cx} y2="380" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" markerEnd="url(#trig-arrow)" markerStart="url(#trig-arrow)" />

            <text x="390" y={cy + 4} fill="rgba(255,255,255,0.4)" fontSize="10" fontFamily="monospace" textAnchor="end">X</text>
            <text x={cx + 6} y="18" fill="rgba(255,255,255,0.4)" fontSize="10" fontFamily="monospace">Y</text>

            {/* Label coordinate limits */}
            <text x={cx + R} y={cy + 14} fill="rgba(255,255,255,0.3)" fontSize="9" fontFamily="monospace" textAnchor="middle">1.0</text>
            <text x={cx - R} y={cy + 14} fill="rgba(255,255,255,0.3)" fontSize="9" fontFamily="monospace" textAnchor="middle">-1.0</text>
            <text x={cx - 15} y={cy - R} fill="rgba(255,255,255,0.3)" fontSize="9" fontFamily="monospace" alignmentBaseline="middle">1.0</text>
            <text x={cx - 19} y={cy + R} fill="rgba(255,255,255,0.3)" fontSize="9" fontFamily="monospace" alignmentBaseline="middle">-1.0</text>

            {/* The Unit Circle Outer Circumference */}
            <circle cx={cx} cy={cy} r={R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="2.5" />
            <circle cx={cx} cy={cy} r={R} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="1" strokeDasharray="3,3" />

            {/* Active Angle Arc */}
            {drawAngleArc()}

            {/* Secant (Hypotenuse) line from origin to outer boundary */}
            <line x1={cx} y1={cy} x2={px} y2={py} stroke="rgba(255,255,255,0.35)" strokeWidth="2.5" />
            
            {/* Secant line extension to meet Tangent line at (1, tan) */}
            {!isTanUndefined && Math.abs(tanValue) <= maxTanHeight && (
              <line x1={px} y1={py} x2={tx} y2={ty} stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" strokeDasharray="3,3" />
            )}

            {/* Trigonometric Segment Highlights */}
            {/* 1. Cosine (Gold) - adjacent horizontal side */}
            <line x1={cx} y1={cy} x2={px} y2={cy} stroke="#FFB81C" strokeWidth="4" strokeLinecap="round" />

            {/* 2. Sine (Red) - opposite vertical side */}
            <line x1={px} y1={cy} x2={px} y2={py} stroke="#C00000" strokeWidth="4" strokeLinecap="round" />

            {/* 3. Tangent (Bronze) - line tangent at (1,0) meeting secant */}
            {!isTanUndefined && Math.abs(tanValue) <= maxTanHeight && (
              <line x1={tx} y1={cy} x2={tx} y2={ty} stroke="#CD7F32" strokeWidth="3" strokeLinecap="round" />
            )}

            {/* Active coordinates labels */}
            <text x={cx + 8} y={cy - 8} fill="rgba(255,255,255,0.3)" fontSize="10" fontFamily="monospace">θ = {formatAngle()}</text>

            {/* Tangent intersection handle indicator */}
            {!isTanUndefined && Math.abs(tanValue) <= maxTanHeight && (
              <circle cx={tx} cy={ty} r="4" fill="#CD7F32" />
            )}

            {/* Draggable perimeter point (cos, sin) */}
            <circle
              cx={px}
              cy={py}
              r="8"
              fill="#C00000"
              stroke="#fff"
              strokeWidth="2.5"
              cursor="grab"
              className="hover:fill-white hover:stroke-[#C00000] transition-colors duration-150 active:cursor-grabbing"
              onPointerDown={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
            />

            {/* Visual indicator coordinates text */}
            <text
              x={px + (cosValue >= 0 ? 12 : -12)}
              y={py + (sinValue >= 0 ? -12 : 12)}
              fill="white"
              fontSize="10"
              fontFamily="monospace"
              fontWeight="bold"
              textAnchor={cosValue >= 0 ? "start" : "end"}
            >
              ({cosValue.toFixed(2)}, {sinValue.toFixed(2)})
            </text>
          </svg>
        </div>
        <p className="text-[10px] text-ares-muted/40 uppercase tracking-widest font-mono select-none">
          ARES Interactive Math Engine // Unit Circle Trigonometry
        </p>
      </div>

      {/* Control Module & Mathematics Cards */}
      <div className="w-full flex flex-col gap-5">
        {/* Degree vs Radian switcher */}
        <div className="grid grid-cols-2 bg-obsidian-darker p-1 rounded-lg border border-white/5 shadow">
          {(['degrees', 'radians'] as const).map((mode) => {
            const isActive = angleMode === mode;
            return (
              <button
                key={mode}
                onClick={() => setAngleMode(mode)}
                className={`py-2 px-1 text-xs sm:text-sm font-heading font-bold rounded-md transition-all select-none uppercase tracking-wider ${
                  isActive
                    ? 'bg-ares-red text-white shadow-md'
                    : 'text-ares-muted hover:text-white hover:bg-white/5'
                }`}
              >
                {mode}
              </button>
            );
          })}
        </div>

        {/* Sliders Container */}
        <div className="bg-obsidian-surface/60 border border-white/5 rounded-xl p-5 shadow-lg flex flex-col gap-4">
          <div className="flex justify-between items-center mb-1">
            <h3 className="font-heading font-black text-xs uppercase tracking-widest text-ares-gold flex items-center gap-2">
              <Layers size={14} /> Control Panel
            </h3>
            <label className="flex items-center gap-1.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isSnapping}
                onChange={(e) => setIsSnapping(e.target.checked)}
                className="rounded accent-ares-red border-white/10"
              />
              <span className="text-[10px] font-mono uppercase tracking-wider text-ares-muted">Snap Standard</span>
            </label>
          </div>

          <div>
            <div className="flex justify-between items-center font-mono text-xs mb-2">
              <span className="text-ares-red font-bold uppercase tracking-wider">Angle (θ)</span>
              <span className="bg-white/5 border border-white/10 px-2 py-0.5 rounded font-bold text-sm text-white">
                {formatAngle()}
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="359"
              step="1"
              value={angleDeg}
              onChange={(e) => setAngleDeg(parseInt(e.target.value, 10))}
              className="w-full accent-ares-red cursor-ew-resize"
              aria-label="Circle rotation angle"
            />
            <div className="flex justify-between text-[10px] text-ares-muted/40 font-mono mt-1 select-none">
              <span>0° (0 rad)</span>
              <span>180° (π rad)</span>
              <span>360° (2π rad)</span>
            </div>
          </div>
        </div>

        {/* Live Synchronized Formulas */}
        <div className="bg-obsidian-surface/60 border border-white/5 rounded-xl p-5 shadow-lg">
          <h3 className="font-heading font-black text-xs uppercase tracking-widest text-ares-red mb-3 flex items-center gap-2">
            <Layers size={14} /> Trigonometric Ratios
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            {/* Sine Card */}
            <div className="p-3 rounded-lg border border-ares-red/35 bg-ares-red/10">
              <div className="flex justify-between items-center mb-1">
                <span className="text-[10px] font-mono text-white/50 uppercase tracking-widest">
                  Sine (sin)
                </span>
                <span className="text-[9px] font-mono text-ares-red font-bold">Opp/Hyp</span>
              </div>
              <div className="font-mono text-base font-bold text-white leading-tight">
                sin(θ) = <span className="text-ares-red font-black">{sinValue.toFixed(3)}</span>
              </div>
            </div>

            {/* Cosine Card */}
            <div className="p-3 rounded-lg border border-ares-gold/35 bg-ares-gold/10">
              <div className="flex justify-between items-center mb-1">
                <span className="text-[10px] font-mono text-white/50 uppercase tracking-widest">
                  Cosine (cos)
                </span>
                <span className="text-[9px] font-mono text-ares-gold font-bold">Adj/Hyp</span>
              </div>
              <div className="font-mono text-base font-bold text-white leading-tight">
                cos(θ) = <span className="text-ares-gold font-black">{cosValue.toFixed(3)}</span>
              </div>
            </div>

            {/* Tangent Card */}
            <div className={`p-3 rounded-lg border transition-all ${isTanUndefined ? 'border-white/10 bg-white/5' : 'border-ares-bronze/35 bg-ares-bronze/10'}`}>
              <div className="flex justify-between items-center mb-1">
                <span className="text-[10px] font-mono text-white/50 uppercase tracking-widest">
                  Tangent (tan)
                </span>
                <span className="text-[9px] font-mono text-ares-bronze font-bold">Opp/Adj</span>
              </div>
              <div className="font-mono text-base font-bold text-white leading-tight">
                tan(θ) = <span className="text-ares-bronze font-black">{isTanUndefined ? 'Undefined' : tanValue.toFixed(3)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Real-time Mathematical Breakdown */}
        <div className="bg-obsidian-surface/60 border border-white/5 rounded-xl p-5 shadow-lg">
          <h3 className="font-heading font-black text-xs uppercase tracking-widest text-ares-gold mb-3 flex items-center gap-2">
            <HelpCircle size={14} /> Geometric Breakdown
          </h3>

          <div className="text-xs sm:text-sm font-sans leading-relaxed text-marble/80 space-y-3">
            <p>
              In a **Unit Circle** (where the radius $R = 1$), any angle $\theta$ defines a unique terminal coordinate $(x,y)$ on the circle circumference:
            </p>
            <ul className="list-disc pl-4 space-y-2 text-marble/70">
              <li>
                The <strong className="text-ares-gold font-mono">Cosine</strong> represents the horizontal displacement: <span className="text-ares-gold font-mono font-bold">x = cos(θ) = {cosValue.toFixed(3)}</span>.
              </li>
              <li>
                The <strong className="text-ares-red font-mono">Sine</strong> represents the vertical displacement: <span className="text-ares-red font-mono font-bold">y = sin(θ) = {sinValue.toFixed(3)}</span>.
              </li>
              <li>
                The <strong className="text-ares-bronze font-mono">Tangent</strong> represents the ratio of vertical rise to horizontal run: <span className="text-ares-bronze font-mono font-bold">y/x = tan(θ) = {isTanUndefined ? 'Undefined (vertical line)' : tanValue.toFixed(3)}</span>.
              </li>
              <li>
                <strong className="text-white">Pythagorean Identity</strong>: Because the coordinates $(x,y)$ reside on a circle of radius 1, their squared sum is always exactly 1:
                <div className="font-mono bg-black/20 p-2 rounded text-center text-xs font-bold text-white mt-1 border border-white/5">
                  x² + y² = cos²(θ) + sin²(θ) = ({cosValue.toFixed(2)})² + ({sinValue.toFixed(2)})² = {(cosValue * cosValue + sinValue * sinValue).toFixed(3)}
                </div>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
