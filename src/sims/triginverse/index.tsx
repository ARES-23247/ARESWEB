/** @sim {"name": "Inverse Trigonometry", "requiresContext": false} */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { HelpCircle, RefreshCw, Layers, Info } from 'lucide-react';

type TrigMode = 'arcsin' | 'arccos' | 'arctan';
type AngleMode = 'degrees' | 'radians';

export default function TrigInverseSim() {
  const [mode, setMode] = useState<TrigMode>('arcsin');
  const [angleMode, setAngleMode] = useState<AngleMode>('degrees');
  
  // Input values: ratios representing inputs to the inverse functions
  const [ratioVal, setRatioVal] = useState<number>(0.5); // Initial input = 0.5
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Math conversions based on mode
  let angleRad = 0;
  let label = 'y'; // Sine input is vertical y, Cosine is horizontal x, Tangent is ratio t
  let minVal = -1.0;
  let maxVal = 1.0;
  let stepVal = 0.01;

  if (mode === 'arcsin') {
    angleRad = Math.asin(ratioVal);
    label = 'y (Sine ratio)';
    minVal = -1.0;
    maxVal = 1.0;
  } else if (mode === 'arccos') {
    angleRad = Math.acos(ratioVal);
    label = 'x (Cosine ratio)';
    minVal = -1.0;
    maxVal = 1.0;
  } else if (mode === 'arctan') {
    angleRad = Math.atan(ratioVal);
    label = 't (Tangent ratio)';
    // Tangent goes from -inf to +inf, let's clamp UI inputs between -4.0 and 4.0 for viewing sanity
    minVal = -4.0;
    maxVal = 4.0;
    stepVal = 0.05;
  }

  const angleDeg = (angleRad * 180) / Math.PI;

  // Viewport setup (400x400 SVG box)
  const cx = 200;
  const cy = 200;
  const R = 130; // 130px represents 1.0 radius

  // Interactive handler for pointer dragging directly on the SVG coordinate space
  const handlePointerMove = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    if (!isDragging) return;

    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();

    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;

    const viewX = (clientX / rect.width) * 400;
    const viewY = (clientY / rect.height) * 400;

    const dx = (viewX - cx) / R;
    const dy = (cy - viewY) / R; // Invert Y axis

    if (mode === 'arcsin') {
      const clampedY = Math.max(-1.0, Math.min(1.0, dy));
      setRatioVal(parseFloat(clampedY.toFixed(2)));
    } else if (mode === 'arccos') {
      const clampedX = Math.max(-1.0, Math.min(1.0, dx));
      setRatioVal(parseFloat(clampedX.toFixed(2)));
    } else if (mode === 'arctan') {
      // In arctan, ratio is y/x, let's derive it directly
      const calculatedT = dy; // Since x coordinate of tangent line is 1.0, dy directly gives tan ratio
      const clampedT = Math.max(-4.0, Math.min(4.0, calculatedT));
      setRatioVal(parseFloat(clampedT.toFixed(2)));
    }
  }, [isDragging, mode]);

  useEffect(() => {
    const handleGlobalPointerUp = () => {
      setIsDragging(false);
    };
    window.addEventListener('pointerup', handleGlobalPointerUp);
    return () => window.removeEventListener('pointerup', handleGlobalPointerUp);
  }, []);

  const handleReset = () => {
    setMode('arcsin');
    setAngleMode('degrees');
    setRatioVal(0.5);
  };

  const formatAngle = () => {
    if (angleMode === 'degrees') {
      return `${angleDeg.toFixed(1)}°`;
    }
    return `${angleRad.toFixed(3)} rad`;
  };

  // SVG drawing helpers
  // 1. Shaded restricted range quadrant sector path
  const getRestrictedPathD = () => {
    if (mode === 'arcsin' || mode === 'arctan') {
      // Shade Right Half (quadrant I & IV) from -90 to +90 degrees
      const xStart = cx;
      const yStart = cy - R;
      const xEnd = cx;
      const yEnd = cy + R;
      return `M ${cx} ${cy} L ${xStart} ${yStart} A ${R} ${R} 0 0 0 ${xEnd} ${yEnd} Z`;
    } else {
      // Shade Top Half (quadrant I & II) from 0 to 180 degrees
      const xStart = cx + R;
      const yStart = cy;
      const xEnd = cx - R;
      const yEnd = cy;
      return `M ${cx} ${cy} L ${xStart} ${yStart} A ${R} ${R} 0 0 0 ${xEnd} ${yEnd} Z`;
    }
  };

  // 2. Active line and handles coordinates
  let lineX = cx;
  let lineY = cy;
  let ratioX = cx;
  let ratioY = cy;

  if (mode === 'arcsin') {
    lineX = cx + Math.cos(angleRad) * R;
    lineY = cy - ratioVal * R;
    ratioX = cx;
    ratioY = cy - ratioVal * R;
  } else if (mode === 'arccos') {
    lineX = cx + ratioVal * R;
    lineY = cy - Math.sin(angleRad) * R;
    ratioX = cx + ratioVal * R;
    ratioY = cy;
  } else if (mode === 'arctan') {
    lineX = cx + Math.cos(angleRad) * R;
    lineY = cy - Math.sin(angleRad) * R;
    ratioX = cx + R;
    ratioY = cy - ratioVal * R;
  }

  return (
    <div
      ref={containerRef}
      className="sim-container flex flex-col gap-6 p-4 sm:p-6 text-ares-offwhite bg-ares-gray-deep/40 rounded-xl border border-white/5 max-w-2xl mx-auto w-full"
      style={{ minHeight: '620px' }}
    >
      {/* Visual Canvas Area */}
      <div className="w-full flex flex-col items-center gap-4 bg-obsidian/40 p-4 rounded-xl border border-white/5 relative">
        <div className="w-full flex justify-between items-center mb-2">
          <div className="flex items-center gap-2">
            <span className="font-heading font-black text-ares-gold uppercase tracking-wider text-sm sm:text-base">
              Principal Inverse Range Grid
            </span>
            <div className="group relative">
              <Info size={14} className="text-ares-muted/60 hover:text-ares-gold cursor-help" />
              <div className="absolute left-0 bottom-6 hidden group-hover:block bg-obsidian-surface border border-white/10 p-3 rounded shadow-xl text-xs w-64 z-10 leading-relaxed text-marble/90">
                The glowing shaded region represents the allowed principal output range for this inverse trigonometric function. Drag the handle to observe ratio boundaries and the computed output angle!
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
            <line x1="20" y1={cy} x2="380" y2={cy} stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" />
            <line x1={cx} y1="20" x2={cx} y2="380" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" />

            <text x="388" y={cy + 4} fill="rgba(255,255,255,0.4)" fontSize="10" fontFamily="monospace">X</text>
            <text x={cx + 6} y="22" fill="rgba(255,255,255,0.4)" fontSize="10" fontFamily="monospace">Y</text>

            {/* Allowed principal range sector shading */}
            <path d={getRestrictedPathD()} fill="rgba(192, 0, 0, 0.08)" stroke="rgba(192,0,0,0.2)" strokeWidth="1" strokeDasharray="3,3" />

            {/* Inactive unpermitted circle circumference */}
            <circle cx={cx} cy={cy} r={R} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="2" />

            {/* Active allowed range circle circumference */}
            <path
              d={
                mode === 'arcsin' || mode === 'arctan'
                  ? `M ${cx} ${cy - R} A ${R} ${R} 0 0 1 ${cx} ${cy + R}`
                  : `M ${cx + R} ${cy} A ${R} ${R} 0 0 0 ${cx - R} ${cy}`
              }
              fill="none"
              stroke="#C00000"
              strokeWidth="2.5"
              strokeLinecap="round"
            />

            {/* Visual labels indicating restricted angles */}
            {mode === 'arccos' ? (
              <g className="font-mono text-[9px] fill-ares-muted/50">
                <text x={cx + R + 8} y={cy + 4} textAnchor="start">0° (0 rad)</text>
                <text x={cx - R - 8} y={cy + 4} textAnchor="end">180° (π rad)</text>
                <text x={cx} y={cy - R - 8} textAnchor="middle">90° (π/2)</text>
              </g>
            ) : (
              <g className="font-mono text-[9px] fill-ares-muted/50">
                <text x={cx} y={cy - R - 8} textAnchor="middle">90° (π/2)</text>
                <text x={cx} y={cy + R + 14} textAnchor="middle">-90° (-π/2)</text>
                <text x={cx + R + 8} y={cy + 4} textAnchor="start">0° (0 rad)</text>
              </g>
            )}

            {/* Projection vector lines */}
            {mode === 'arcsin' && (
              <>
                <line x1={cx} y1={ratioY} x2={lineX} y2={ratioY} stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" strokeDasharray="3,3" />
                <line x1={cx} y1={cy} x2={cx} y2={ratioY} stroke="#C00000" strokeWidth="3" />
              </>
            )}
            {mode === 'arccos' && (
              <>
                <line x1={ratioX} y1={cy} x2={ratioX} y2={lineY} stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" strokeDasharray="3,3" />
                <line x1={cx} y1={cy} x2={ratioX} y2={cy} stroke="#FFB81C" strokeWidth="3" />
              </>
            )}
            {mode === 'arctan' && (
              <>
                <line x1={cx} y1={cy} x2={cx + R * 1.5} y2={cy - ratioVal * R * 1.5} stroke="rgba(255,255,255,0.12)" strokeWidth="1" strokeDasharray="4,4" />
                <line x1={cx + R} y1={cy} x2={cx + R} y2={ratioY} stroke="#CD7F32" strokeWidth="3" />
              </>
            )}

            {/* Active Angle Ray (Hypotenuse) */}
            <line x1={cx} y1={cy} x2={lineX} y2={lineY} stroke="white" strokeWidth="2.5" />

            {/* Angle output circle handle coordinates */}
            <circle cx={lineX} cy={lineY} r="5" fill="white" />

            {/* Interactive draggable input ratio handle */}
            <circle
              cx={ratioX}
              cy={ratioY}
              r="8"
              fill={mode === 'arccos' ? '#FFB81C' : mode === 'arcsin' ? '#C00000' : '#CD7F32'}
              stroke="#fff"
              strokeWidth="2.5"
              cursor="grab"
              className="hover:fill-white hover:stroke-[#C00000] transition-colors duration-150 active:cursor-grabbing"
              onPointerDown={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
            />

            {/* Display ratio text next to input handle */}
            <text
              x={ratioX + (mode === 'arccos' ? 0 : 12)}
              y={ratioY + (mode === 'arccos' ? -12 : 4)}
              fill="white"
              fontSize="10"
              fontFamily="monospace"
              fontWeight="bold"
              textAnchor={mode === 'arccos' ? "middle" : "start"}
            >
              {mode === 'arcsin' && `y = ${ratioVal.toFixed(2)}`}
              {mode === 'arccos' && `x = ${ratioVal.toFixed(2)}`}
              {mode === 'arctan' && `t = ${ratioVal.toFixed(2)}`}
            </text>
          </svg>
        </div>
        <p className="text-[10px] text-ares-muted/40 uppercase tracking-widest font-mono select-none">
          ARES Interactive Math Engine // Inverse Trigonometry Boundaries
        </p>
      </div>

      {/* Control Module & Mathematics Breakdown */}
      <div className="w-full flex flex-col gap-5">
        {/* Navigation Tabs for Inverse Mode */}
        <div className="grid grid-cols-3 bg-obsidian-darker p-1 rounded-lg border border-white/5 shadow">
          {([
            { id: 'arcsin', label: 'arcsin(y)' },
            { id: 'arccos', label: 'arccos(x)' },
            { id: 'arctan', label: 'arctan(t)' },
          ] as const).map((tType) => {
            const isActive = mode === tType.id;
            return (
              <button
                key={tType.id}
                onClick={() => {
                  setMode(tType.id);
                  setRatioVal(tType.id === 'arctan' ? 1.0 : 0.5);
                }}
                className={`py-2 px-1 text-xs sm:text-sm font-heading font-bold rounded-md transition-all select-none uppercase tracking-wider ${
                  isActive
                    ? 'bg-ares-red text-white shadow-md'
                    : 'text-ares-muted hover:text-white hover:bg-white/5'
                }`}
              >
                {tType.label}
              </button>
            );
          })}
        </div>

        {/* Dynamic Controls Card */}
        <div className="bg-obsidian-surface/60 border border-white/5 rounded-xl p-5 shadow-lg flex flex-col gap-4">
          <div className="flex justify-between items-center mb-1">
            <h3 className="font-heading font-black text-xs uppercase tracking-widest text-ares-gold flex items-center gap-2">
              <Layers size={14} /> Control Panel
            </h3>
            {/* Degree vs Radian switcher */}
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

          <div>
            <div className="flex justify-between items-center font-mono text-xs mb-2">
              <span className="text-ares-red font-bold uppercase tracking-wider">{label}</span>
              <span className="bg-white/5 border border-white/10 px-2 py-0.5 rounded font-bold text-sm text-white">
                {ratioVal.toFixed(2)}
              </span>
            </div>
            <input
              type="range"
              min={minVal}
              max={maxVal}
              step={stepVal}
              value={ratioVal}
              onChange={(e) => setRatioVal(parseFloat(e.target.value))}
              className="w-full accent-ares-red cursor-ew-resize"
              aria-label="Inverse trig function input ratio"
            />
            <div className="flex justify-between text-[10px] text-ares-muted/40 font-mono mt-1 select-none">
              <span>{minVal.toFixed(1)}</span>
              <span>0.0</span>
              <span>{maxVal.toFixed(1)}</span>
            </div>
          </div>
        </div>

        {/* Formula output Display Card */}
        <div className="bg-obsidian-surface/60 border border-white/5 rounded-xl p-5 shadow-lg">
          <h3 className="font-heading font-black text-xs uppercase tracking-widest text-ares-red mb-3 flex items-center gap-2">
            <Layers size={14} /> Computed Angle Output
          </h3>

          <div className="p-3.5 rounded-lg border border-ares-red/35 bg-ares-red/10">
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-[10px] font-mono text-white/50 uppercase tracking-widest">
                Inverse Trigonometric Function
              </span>
              <span className="text-[9px] font-mono text-ares-red font-bold">Ratios → Angle</span>
            </div>
            <div className="font-mono text-lg font-bold text-white leading-tight">
              {mode === 'arcsin' && `sin⁻¹(${ratioVal.toFixed(2)})`}
              {mode === 'arccos' && `cos⁻¹(${ratioVal.toFixed(2)})`}
              {mode === 'arctan' && `tan⁻¹(${ratioVal.toFixed(2)})`} = <span className="text-ares-gold font-black">{formatAngle()}</span>
            </div>
          </div>
        </div>

        {/* Mathematics breakdown card explaining range limits */}
        <div className="bg-obsidian-surface/60 border border-white/5 rounded-xl p-5 shadow-lg">
          <h3 className="font-heading font-black text-xs uppercase tracking-widest text-ares-gold mb-3 flex items-center gap-2">
            <HelpCircle size={14} /> The Restricted Range Rule
          </h3>

          <div className="text-xs sm:text-sm font-sans leading-relaxed text-marble/80 space-y-3">
            <p>
              In algebra, standard trigonometric functions map an **Angle** to a **Ratio**. The inverse trigonometric functions ($sin^{-1}$, $cos^{-1}$, $tan^{-1}$) reverse this mapping: they take a **Ratio** and output an **Angle**.
            </p>
            <p className="text-marble/70">
              However, because sine and cosine repeat their ratios infinitely (e.g. $sin(30^\circ) = sin(150^\circ) = 0.5$), the standard inverse operations would map one input to multiple outputs. To satisfy the definition of a mathematical function (which requires each input to have exactly ONE output), mathematicians strictly restrict their range output to standard **Principal Domains**:
            </p>
            <ul className="list-disc pl-4 space-y-2 text-marble/70">
              <li>
                <strong className="text-ares-red font-mono">arcsin(y)</strong>: Restricted to the **right-hand quadrants I & IV** ($[-90^\circ, 90^\circ]$ or $[-\pi/2, \pi/2]$).
              </li>
              <li>
                <strong className="text-ares-gold font-mono">arccos(x)</strong>: Restricted to the **upper-hand quadrants I & II** ($[0^\circ, 180^\circ]$ or $[0, \pi]$).
              </li>
              <li>
                <strong className="text-ares-bronze font-mono">arctan(t)</strong>: Restricted to the **right-hand quadrants I & IV** (excluding vertical asymptotes, $(-90^\circ, 90^\circ)$ or $(-\pi/2, \pi/2)$).
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
