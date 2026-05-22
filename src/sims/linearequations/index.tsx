/** @sim {"name": "Linear Equations", "requiresContext": false} */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { HelpCircle, RefreshCw, Layers, Info } from 'lucide-react';

type SimMode = 'slopeIntercept' | 'standard' | 'pointSlope';

// Math GCD utility
const gcd = (x: number, y: number, z?: number): number => {
  const g = (a: number, b: number): number => {
    while (b) {
      const t = b;
      b = a % b;
      a = t;
    }
    return a;
  };
  let result = g(x, y);
  if (z !== undefined) {
    result = g(result, z);
  }
  return result;
};

export default function SimComponent() {
  const [mode, setMode] = useState<SimMode>('slopeIntercept');

  // Parameters for Slope-Intercept: y = mx + b
  const [m, setM] = useState<number>(1);
  const [b, setB] = useState<number>(2);

  // Parameters for Standard Form: Ax + By = C
  const [A, setA] = useState<number>(1);
  const [B, setBStd] = useState<number>(-1);
  const [C, setC] = useState<number>(2);

  // Parameters for Point-Slope Form: y - y1 = m(x - x1)
  const [x1, setX1] = useState<number>(3);
  const [y1, setY1] = useState<number>(5);
  const [mPs, setMPs] = useState<number>(1);

  // Dragging state
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragTarget, setDragTarget] = useState<'yIntercept' | 'referencePoint' | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  // Synchronizers
  const syncFromSlopeIntercept = useCallback((slope: number, intercept: number) => {
    // 1. Point-Slope Sync: keep x1, update y1
    const newY1 = parseFloat((slope * x1 + intercept).toFixed(2));
    setY1(newY1);
    setMPs(slope);

    // 2. Standard Form Sync: convert slope & intercept to integers
    // Assuming 0.1 step for slope and 0.5 step for intercept, multiply by 10
    const mVal = parseFloat(slope.toFixed(1));
    const bVal = parseFloat(intercept.toFixed(1));
    const tempA = Math.round(mVal * 10);
    const tempB = -10;
    const tempC = Math.round(-bVal * 10);

    const divisor = gcd(Math.abs(tempA), Math.abs(tempB), Math.abs(tempC)) || 1;
    let finalA = tempA / divisor;
    let finalB = tempB / divisor;
    let finalC = tempC / divisor;

    if (finalA < 0 || (finalA === 0 && finalB < 0)) {
      finalA = -finalA;
      finalB = -finalB;
      finalC = -finalC;
    }

    setA(finalA);
    setBStd(finalB);
    setC(finalC);
  }, [x1]);

  const syncFromPointSlope = useCallback((slope: number, px: number, py: number) => {
    // 1. Slope-Intercept Sync
    const newB = parseFloat((py - slope * px).toFixed(2));
    setM(slope);
    setB(newB);

    // 2. Standard Form Sync
    const mVal = parseFloat(slope.toFixed(1));
    const bVal = parseFloat(newB.toFixed(1));
    const tempA = Math.round(mVal * 10);
    const tempB = -10;
    const tempC = Math.round(-bVal * 10);

    const divisor = gcd(Math.abs(tempA), Math.abs(tempB), Math.abs(tempC)) || 1;
    let finalA = tempA / divisor;
    let finalB = tempB / divisor;
    let finalC = tempC / divisor;

    if (finalA < 0 || (finalA === 0 && finalB < 0)) {
      finalA = -finalA;
      finalB = -finalB;
      finalC = -finalC;
    }

    setA(finalA);
    setBStd(finalB);
    setC(finalC);
  }, []);

  const syncFromStandard = useCallback((stdA: number, stdB: number, stdC: number) => {
    if (stdB === 0) {
      // Vertical line: x = C/A
      // Slope is infinite, slope-intercept and point-slope are technically invalid.
      // We set slope to a large value or fallback to 0 for rendering safety.
      return;
    }
    const newM = parseFloat((-stdA / stdB).toFixed(2));
    const newB = parseFloat((stdC / stdB).toFixed(2));

    // 1. Slope-Intercept Sync
    setM(newM);
    setB(newB);

    // 2. Point-Slope Sync
    setMPs(newM);
    const newY1 = parseFloat((newM * x1 + newB).toFixed(2));
    setY1(newY1);
  }, [x1]);

  // Coordinate Plane Mapping (Grid: [-10, 10] inside 400x400 area, padded to 440x440)
  const xPx = (val: number) => 220 + val * 20;
  const yPx = (val: number) => 220 - val * 20;

  // Handles active controls
  const handleSlopeChange = (val: number) => {
    setM(val);
    syncFromSlopeIntercept(val, b);
  };

  const handleInterceptChange = (val: number) => {
    setB(val);
    syncFromSlopeIntercept(m, val);
  };

  const handleStandardAChange = (val: number) => {
    if (val === 0 && B === 0) return; // Prevent invalid line state
    setA(val);
    syncFromStandard(val, B, C);
  };

  const handleStandardBChange = (val: number) => {
    if (val === 0 && A === 0) return;
    setBStd(val);
    syncFromStandard(A, val, C);
  };

  const handleStandardCChange = (val: number) => {
    setC(val);
    syncFromStandard(A, B, val);
  };

  const handlePsSlopeChange = (val: number) => {
    setMPs(val);
    syncFromPointSlope(val, x1, y1);
  };

  const handlePsX1Change = (val: number) => {
    setX1(val);
    syncFromPointSlope(mPs, val, y1);
  };

  const handlePsY1Change = (val: number) => {
    setY1(val);
    syncFromPointSlope(mPs, x1, val);
  };

  // Dragging event handlers (PointerEvents are touch/mouse friendly)
  const startDrag = (e: React.PointerEvent, target: 'yIntercept' | 'referencePoint') => {
    e.preventDefault();
    setIsDragging(true);
    setDragTarget(target);
  };

  const stopDrag = useCallback(() => {
    setIsDragging(false);
    setDragTarget(null);
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    if (!isDragging || !dragTarget) return;

    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();

    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;

    const viewX = (clientX / rect.width) * 440;
    const viewY = (clientY / rect.height) * 440;

    let gridX = (viewX - 220) / 20;
    let gridY = (220 - viewY) / 20;

    // Clamp coordinates
    gridX = Math.max(-10, Math.min(10, gridX));
    gridY = Math.max(-10, Math.min(10, gridY));

    if (dragTarget === 'yIntercept') {
      const newB = Math.round(gridY * 2) / 2; // Snap to 0.5
      setB(newB);
      syncFromSlopeIntercept(m, newB);
    } else if (dragTarget === 'referencePoint') {
      const newX1 = Math.round(gridX * 2) / 2;
      const newY1 = Math.round(gridY * 2) / 2;
      setX1(newX1);
      setY1(newY1);
      syncFromPointSlope(mPs, newX1, newY1);
    }
  }, [isDragging, dragTarget, m, mPs, syncFromSlopeIntercept, syncFromPointSlope]);

  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isDragging) stopDrag();
    };
    window.addEventListener('pointerup', handleGlobalMouseUp);
    return () => window.removeEventListener('pointerup', handleGlobalMouseUp);
  }, [isDragging, stopDrag]);

  // Reset to initial settings
  const handleReset = () => {
    setMode('slopeIntercept');
    setM(1);
    setB(2);
    setA(1);
    setBStd(-1);
    setC(2);
    setX1(3);
    setY1(5);
    setMPs(1);
  };

  // Equations display formats
  const formatSlopeIntercept = () => {
    if (B === 0) {
      return <span className="font-heading text-white">Undefined (Vertical Line)</span>;
    }
    const mStr = m === 1 ? '' : m === -1 ? '-' : m === 0 ? '' : `${m}`;
    const xTerm = m === 0 ? '' : `${mStr}x`;
    const bStr = b > 0 ? (m === 0 ? `${b}` : ` + ${b}`) : b < 0 ? ` - ${Math.abs(b)}` : m === 0 ? '0' : '';
    return (
      <span className="font-mono text-lg font-bold text-white">
        y = <span className="text-ares-red">{xTerm}</span>
        <span className="text-ares-gold">{bStr}</span>
      </span>
    );
  };

  const formatStandard = () => {
    const aStr = A === 1 ? 'x' : A === -1 ? '-x' : A === 0 ? '' : `${A}x`;
    const bSign = B > 0 ? (A === 0 ? '' : ' + ') : B < 0 ? ' - ' : '';
    const bVal = B !== 0 ? (Math.abs(B) === 1 ? 'y' : `${Math.abs(B)}y`) : '';
    const leftSide = A === 0 && B === 0 ? '0' : `${aStr}${bSign}${bVal}`;
    return (
      <span className="font-mono text-lg font-bold text-white">
        {leftSide} = <span className="text-ares-gold">{C}</span>
      </span>
    );
  };

  const formatPointSlope = () => {
    if (B === 0) {
      return <span className="font-heading text-white">Undefined (Vertical Line)</span>;
    }
    const ySign = y1 >= 0 ? '-' : '+';
    const yTerm = y1 === 0 ? 'y' : `y ${ySign} ${Math.abs(y1)}`;
    const xSign = x1 >= 0 ? '-' : '+';
    const xTerm = x1 === 0 ? 'x' : `(x ${xSign} ${Math.abs(x1)})`;
    const mStr = mPs === 1 ? '' : mPs === -1 ? '-' : `${mPs}`;
    return (
      <span className="font-mono text-lg font-bold text-white">
        {yTerm} = <span className="text-ares-red">{mStr}</span>
        <span className="text-ares-bronze">{xTerm}</span>
      </span>
    );
  };

  // Slope triangle calculation (visual rise & run)
  const drawSlopeTriangle = () => {
    if (B === 0 || m === 0) return null;
    const startX = 0;
    const startY = b;
    const runLength = 3; // Horizontal run size
    const endX = startX + runLength;
    const endY = startY + m * runLength;

    return (
      <g>
        {/* Horizontal run line */}
        <line
          x1={xPx(startX)}
          y1={yPx(startY)}
          x2={xPx(endX)}
          y2={yPx(startY)}
          stroke="#CD7F32"
          strokeWidth="2"
          strokeDasharray="4,4"
        />
        {/* Vertical rise line */}
        <line
          x1={xPx(endX)}
          y1={yPx(startY)}
          x2={xPx(endX)}
          y2={yPx(endY)}
          stroke="#C00000"
          strokeWidth="2"
          strokeDasharray="4,4"
        />
        {/* Text for run */}
        <text
          x={xPx((startX + endX) / 2)}
          y={yPx(startY) + 15}
          fill="#CD7F32"
          fontSize="10"
          fontFamily="monospace"
          fontWeight="bold"
          textAnchor="middle"
        >
          Run: +{runLength}
        </text>
        {/* Text for rise */}
        <text
          x={xPx(endX) + 8}
          y={yPx((startY + endY) / 2)}
          fill="#C00000"
          fontSize="10"
          fontFamily="monospace"
          fontWeight="bold"
          textAnchor="start"
          alignmentBaseline="middle"
        >
          Rise: {m > 0 ? '+' : ''}{(m * runLength).toFixed(1)}
        </text>
      </g>
    );
  };

  return (
    <div
      ref={containerRef}
      className="sim-container flex flex-col xl:flex-row gap-6 p-6 overflow-auto text-ares-offwhite bg-ares-gray-deep/40 rounded-xl border border-white/5"
      style={{ minHeight: '620px' }}
    >
      {/* Left side: Interactive Canvas */}
      <div className="flex-1 flex flex-col items-center gap-4 bg-obsidian/40 p-4 rounded-xl border border-white/5 relative">
        <div className="w-full flex justify-between items-center mb-2">
          <div className="flex items-center gap-2">
            <span className="font-heading font-black text-ares-gold uppercase tracking-wider text-sm sm:text-base">
              Interactive Cartesian Plane
            </span>
            <div className="group relative">
              <Info size={14} className="text-ares-muted/60 hover:text-ares-gold cursor-help" />
              <div className="absolute left-0 bottom-6 hidden group-hover:block bg-obsidian-surface border border-white/10 p-3 rounded shadow-xl text-xs w-64 z-10 leading-relaxed text-marble/90">
                {mode === 'slopeIntercept' && "Drag the golden handle along the Y-axis to adjust the Y-intercept 'b'. Use the controls on the right to change slope."}
                {mode === 'pointSlope' && "Drag the bronze handle anywhere on the grid to change the point '(x₁, y₁)'. Use the controls to adjust slope."}
                {mode === 'standard' && "Standard form displays both intercepts. Red circle is X-intercept, Gold circle is Y-intercept. Use controls to shift standard coefficients."}
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
            width="440"
            height="440"
            viewBox="0 0 440 440"
            onPointerMove={handlePointerMove}
            className="select-none touch-none"
          >
            <defs>
              <clipPath id="grid-clip">
                <rect x="20" y="20" width="400" height="400" />
              </clipPath>
              <marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 2 L 10 5 L 0 8 z" fill="rgba(255,255,255,0.4)" />
              </marker>
            </defs>

            {/* Gridlines */}
            {Array.from({ length: 21 }, (_, i) => i - 10).map((i) => {
              if (i === 0) return null;
              return (
                <g key={i}>
                  {/* Vertical lines */}
                  <line
                    x1={xPx(i)}
                    y1="20"
                    x2={xPx(i)}
                    y2="420"
                    stroke="rgba(255,255,255,0.04)"
                    strokeWidth="1"
                  />
                  {/* Horizontal lines */}
                  <line
                    x1="20"
                    y1={yPx(i)}
                    x2="420"
                    y2={yPx(i)}
                    stroke="rgba(255,255,255,0.04)"
                    strokeWidth="1"
                  />
                </g>
              );
            })}

            {/* Thick Axes */}
            <line
              x1="15"
              y1="220"
              x2="425"
              y2="220"
              stroke="rgba(255,255,255,0.3)"
              strokeWidth="2"
              markerEnd="url(#arrow)"
              markerStart="url(#arrow)"
            />
            <line
              x1="220"
              y1="425"
              x2="220"
              y2="15"
              stroke="rgba(255,255,255,0.3)"
              strokeWidth="2"
              markerEnd="url(#arrow)"
              markerStart="url(#arrow)"
            />

            {/* Axes Labels */}
            <text x="430" y="215" fill="rgba(255,255,255,0.5)" fontSize="12" fontFamily="monospace" textAnchor="end">X</text>
            <text x="230" y="15" fill="rgba(255,255,255,0.5)" fontSize="12" fontFamily="monospace" alignmentBaseline="hanging">Y</text>

            {/* Integer Ticks & Numbers */}
            {[-10, -5, 5, 10].map((num) => (
              <g key={num} className="font-mono text-[10px] fill-white/40">
                {/* X labels */}
                <line x1={xPx(num)} y1="216" x2={xPx(num)} y2="224" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" />
                <text x={xPx(num)} y="236" textAnchor="middle">{num}</text>

                {/* Y labels */}
                <line x1="216" y1={yPx(num)} x2="224" y2={yPx(num)} stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" />
                <text x="206" y={yPx(num)} textAnchor="end" alignmentBaseline="middle">{num}</text>
              </g>
            ))}

            {/* Origin indicator */}
            <text x="210" y="233" fill="rgba(255,255,255,0.3)" fontSize="10" fontFamily="monospace">0</text>

            {/* The Active Line */}
            {B === 0 ? (
              // Vertical Line case
              <line
                x1={xPx(C / A)}
                y1="20"
                x2={xPx(C / A)}
                y2="420"
                stroke="#C00000"
                strokeWidth="3.5"
                clipPath="url(#grid-clip)"
              />
            ) : (
              // Standard slope line
              <line
                x1={xPx(-11)}
                y1={yPx(m * -11 + b)}
                x2={xPx(11)}
                y2={yPx(m * 11 + b)}
                stroke="#C00000"
                strokeWidth="3.5"
                clipPath="url(#grid-clip)"
              />
            )}

            {/* Slope Rise/Run staircase visualization */}
            {mode !== 'standard' && drawSlopeTriangle()}

            {/* Mode-Specific Active Handles & Markers */}
            {mode === 'slopeIntercept' && B !== 0 && (
              <g>
                {/* Highlight Point (0, b) */}
                <circle
                  cx="220"
                  cy={yPx(b)}
                  r="7"
                  fill="#FFB81C"
                  stroke="#fff"
                  strokeWidth="2"
                  cursor="ns-resize"
                  onPointerDown={(e) => startDrag(e, 'yIntercept')}
                  className="hover:scale-125 transition-transform"
                />
                <text
                  x="232"
                  y={yPx(b)}
                  fill="#FFB81C"
                  fontSize="11"
                  fontFamily="monospace"
                  fontWeight="bold"
                  alignmentBaseline="middle"
                >
                  y-int (0, {b.toFixed(1)})
                </text>
              </g>
            )}

            {mode === 'pointSlope' && B !== 0 && (
              <g>
                {/* Known point (x1, y1) */}
                <circle
                  cx={xPx(x1)}
                  cy={yPx(y1)}
                  r="7"
                  fill="#CD7F32"
                  stroke="#fff"
                  strokeWidth="2"
                  cursor="move"
                  onPointerDown={(e) => startDrag(e, 'referencePoint')}
                  className="hover:scale-125 transition-transform"
                />
                <text
                  x={xPx(x1) + 10}
                  y={yPx(y1) - 10}
                  fill="#CD7F32"
                  fontSize="11"
                  fontFamily="monospace"
                  fontWeight="bold"
                >
                  ({x1}, {y1})
                </text>
              </g>
            )}

            {mode === 'standard' && (
              <g>
                {/* Draw y-intercept if B !== 0 */}
                {B !== 0 && (
                  <g>
                    <circle cx="220" cy={yPx(C / B)} r="5" fill="#FFB81C" stroke="#fff" strokeWidth="1.5" />
                    <text x="230" y={yPx(C / B)} fill="#FFB81C" fontSize="9" fontFamily="monospace" alignmentBaseline="middle">
                      (0, {(C / B).toFixed(1)})
                    </text>
                  </g>
                )}
                {/* Draw x-intercept if A !== 0 */}
                {A !== 0 && (
                  <g>
                    <circle cx={xPx(C / A)} cy="220" r="5" fill="#CD7F32" stroke="#fff" strokeWidth="1.5" />
                    <text x={xPx(C / A)} y="208" fill="#CD7F32" fontSize="9" fontFamily="monospace" textAnchor="middle">
                      ({(C / A).toFixed(1)}, 0)
                    </text>
                  </g>
                )}
              </g>
            )}
          </svg>
        </div>
        <p className="text-[10px] text-ares-muted/40 uppercase tracking-widest font-mono select-none">
          ARES Interactive Math Engine // Cartesian Coordinate System
        </p>
      </div>

      {/* Right side: Control Module & Step-by-Step Math */}
      <div className="flex-1 flex flex-col gap-5">
        {/* Navigation Mode Tabs */}
        <div className="grid grid-cols-3 bg-obsidian-darker p-1 rounded-lg border border-white/5 shadow">
          {(['slopeIntercept', 'standard', 'pointSlope'] as const).map((mType) => {
            const isActive = mode === mType;
            let label = 'Slope-Int';
            if (mType === 'standard') label = 'Standard';
            if (mType === 'pointSlope') label = 'Point-Slope';

            return (
              <button
                key={mType}
                onClick={() => setMode(mType)}
                className={`py-2 px-1 text-xs sm:text-sm font-heading font-bold rounded-md transition-all select-none uppercase tracking-wider ${
                  isActive
                    ? 'bg-ares-red text-white shadow-md'
                    : 'text-ares-muted hover:text-white hover:bg-white/5'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Core Controls Block */}
        <div className="bg-obsidian-surface/60 border border-white/5 rounded-xl p-5 shadow-lg relative overflow-hidden flex flex-col gap-4">
          <h3 className="font-heading font-black text-xs uppercase tracking-widest text-ares-gold mb-1 flex items-center gap-2">
            <Layers size={14} /> Control Parameters
          </h3>

          {mode === 'slopeIntercept' && (
            <div className="space-y-4">
              <div>
                <div className="flex justify-between items-center font-mono text-xs mb-2">
                  <span className="text-ares-red font-bold uppercase tracking-wider">Slope (m)</span>
                  <span className="bg-white/5 border border-white/10 px-2 py-0.5 rounded font-bold text-sm text-white">
                    {m.toFixed(1)}
                  </span>
                </div>
                <input
                  type="range"
                  min="-5"
                  max="5"
                  step="0.1"
                  value={m}
                  onChange={(e) => handleSlopeChange(parseFloat(e.target.value))}
                  className="w-full accent-ares-red cursor-ew-resize"
                  aria-label="Slope of linear equation"
                />
                <div className="flex justify-between text-[10px] text-ares-muted/40 font-mono mt-1 select-none">
                  <span>-5.0 (Steep Down)</span>
                  <span>0.0 (Flat)</span>
                  <span>+5.0 (Steep Up)</span>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center font-mono text-xs mb-2">
                  <span className="text-ares-gold font-bold uppercase tracking-wider">Y-Intercept (b)</span>
                  <span className="bg-white/5 border border-white/10 px-2 py-0.5 rounded font-bold text-sm text-white">
                    {b.toFixed(1)}
                  </span>
                </div>
                <input
                  type="range"
                  min="-8"
                  max="8"
                  step="0.5"
                  value={b}
                  onChange={(e) => handleInterceptChange(parseFloat(e.target.value))}
                  className="w-full accent-ares-gold cursor-ew-resize"
                  aria-label="Y intercept of linear equation"
                />
                <div className="flex justify-between text-[10px] text-ares-muted/40 font-mono mt-1 select-none">
                  <span>-8.0</span>
                  <span>0.0</span>
                  <span>+8.0</span>
                </div>
              </div>
            </div>
          )}

          {mode === 'pointSlope' && (
            <div className="space-y-4">
              <div>
                <div className="flex justify-between items-center font-mono text-xs mb-2">
                  <span className="text-ares-red font-bold uppercase tracking-wider">Slope (m)</span>
                  <span className="bg-white/5 border border-white/10 px-2 py-0.5 rounded font-bold text-sm text-white">
                    {mPs.toFixed(1)}
                  </span>
                </div>
                <input
                  type="range"
                  min="-5"
                  max="5"
                  step="0.1"
                  value={mPs}
                  onChange={(e) => handlePsSlopeChange(parseFloat(e.target.value))}
                  className="w-full accent-ares-red cursor-ew-resize"
                  aria-label="Slope of point slope linear equation"
                />
              </div>

              <div>
                <div className="flex justify-between items-center font-mono text-xs mb-2">
                  <span className="text-ares-bronze font-bold uppercase tracking-wider">Known Point X (x₁)</span>
                  <span className="bg-white/5 border border-white/10 px-2 py-0.5 rounded font-bold text-sm text-white">
                    {x1.toFixed(1)}
                  </span>
                </div>
                <input
                  type="range"
                  min="-8"
                  max="8"
                  step="0.5"
                  value={x1}
                  onChange={(e) => handlePsX1Change(parseFloat(e.target.value))}
                  className="w-full accent-ares-bronze cursor-ew-resize"
                  aria-label="Known point x coordinate of linear equation"
                />
              </div>

              <div>
                <div className="flex justify-between items-center font-mono text-xs mb-2">
                  <span className="text-ares-bronze font-bold uppercase tracking-wider">Known Point Y (y₁)</span>
                  <span className="bg-white/5 border border-white/10 px-2 py-0.5 rounded font-bold text-sm text-white">
                    {y1.toFixed(1)}
                  </span>
                </div>
                <input
                  type="range"
                  min="-8"
                  max="8"
                  step="0.5"
                  value={y1}
                  onChange={(e) => handlePsY1Change(parseFloat(e.target.value))}
                  className="w-full accent-ares-bronze cursor-ew-resize"
                  aria-label="Known point y coordinate of linear equation"
                />
              </div>
            </div>
          )}

          {mode === 'standard' && (
            <div className="space-y-4">
              <div>
                <div className="flex justify-between items-center font-mono text-xs mb-2">
                  <span className="text-ares-red font-bold uppercase tracking-wider">A Coefficient</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleStandardAChange(A - 1)}
                      className="bg-white/5 hover:bg-white/15 px-2 py-0.5 rounded text-xs select-none"
                    >
                      -
                    </button>
                    <span className="bg-white/5 border border-white/10 px-2.5 py-0.5 rounded font-bold text-sm text-white inline-block text-center w-8">
                      {A}
                    </span>
                    <button
                      onClick={() => handleStandardAChange(A + 1)}
                      className="bg-white/5 hover:bg-white/15 px-2 py-0.5 rounded text-xs select-none"
                    >
                      +
                    </button>
                  </div>
                </div>
                <input
                  type="range"
                  min="-10"
                  max="10"
                  step="1"
                  value={A}
                  onChange={(e) => handleStandardAChange(parseInt(e.target.value, 10))}
                  className="w-full accent-ares-red cursor-ew-resize"
                  aria-label="Standard form A coefficient"
                />
              </div>

              <div>
                <div className="flex justify-between items-center font-mono text-xs mb-2">
                  <span className="text-ares-gold font-bold uppercase tracking-wider">B Coefficient</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleStandardBChange(B - 1)}
                      className="bg-white/5 hover:bg-white/15 px-2 py-0.5 rounded text-xs select-none"
                    >
                      -
                    </button>
                    <span className="bg-white/5 border border-white/10 px-2.5 py-0.5 rounded font-bold text-sm text-white inline-block text-center w-8">
                      {B}
                    </span>
                    <button
                      onClick={() => handleStandardBChange(B + 1)}
                      className="bg-white/5 hover:bg-white/15 px-2 py-0.5 rounded text-xs select-none"
                    >
                      +
                    </button>
                  </div>
                </div>
                <input
                  type="range"
                  min="-10"
                  max="10"
                  step="1"
                  value={B}
                  onChange={(e) => handleStandardBChange(parseInt(e.target.value, 10))}
                  className="w-full accent-ares-gold cursor-ew-resize"
                  aria-label="Standard form B coefficient"
                />
              </div>

              <div>
                <div className="flex justify-between items-center font-mono text-xs mb-2">
                  <span className="text-ares-bronze font-bold uppercase tracking-wider">C Constant</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleStandardCChange(C - 1)}
                      className="bg-white/5 hover:bg-white/15 px-2 py-0.5 rounded text-xs select-none"
                    >
                      -
                    </button>
                    <span className="bg-white/5 border border-white/10 px-2.5 py-0.5 rounded font-bold text-sm text-white inline-block text-center w-8">
                      {C}
                    </span>
                    <button
                      onClick={() => handleStandardCChange(C + 1)}
                      className="bg-white/5 hover:bg-white/15 px-2 py-0.5 rounded text-xs select-none"
                    >
                      +
                    </button>
                  </div>
                </div>
                <input
                  type="range"
                  min="-20"
                  max="20"
                  step="1"
                  value={C}
                  onChange={(e) => handleStandardCChange(parseInt(e.target.value, 10))}
                  className="w-full accent-ares-bronze cursor-ew-resize"
                  aria-label="Standard form C constant"
                />
              </div>
            </div>
          )}
        </div>

        {/* Live Formula Display Module */}
        <div className="bg-obsidian-surface/60 border border-white/5 rounded-xl p-5 shadow-lg">
          <h3 className="font-heading font-black text-xs uppercase tracking-widest text-ares-red mb-3 flex items-center gap-2">
            <Layers size={14} /> Synchronized Equations
          </h3>

          <div className="space-y-3.5">
            {/* Slope Intercept */}
            <div
              className={`p-3 rounded-lg border transition-all ${
                mode === 'slopeIntercept'
                  ? 'bg-ares-red/10 border-ares-red/30 ring-1 ring-ares-red/20'
                  : 'bg-black/10 border-white/5'
              }`}
            >
              <div className="flex justify-between items-center mb-1">
                <span className="text-[10px] font-mono text-ares-gold/70 uppercase tracking-widest">
                  Slope-Intercept Form
                </span>
                <span className="text-[10px] font-mono text-white/30">y = mx + b</span>
              </div>
              <div>{formatSlopeIntercept()}</div>
            </div>

            {/* Standard Form */}
            <div
              className={`p-3 rounded-lg border transition-all ${
                mode === 'standard'
                  ? 'bg-ares-red/10 border-ares-red/30 ring-1 ring-ares-red/20'
                  : 'bg-black/10 border-white/5'
              }`}
            >
              <div className="flex justify-between items-center mb-1">
                <span className="text-[10px] font-mono text-ares-gold/70 uppercase tracking-widest">
                  Standard Form
                </span>
                <span className="text-[10px] font-mono text-white/30">Ax + By = C</span>
              </div>
              <div>{formatStandard()}</div>
            </div>

            {/* Point Slope Form */}
            <div
              className={`p-3 rounded-lg border transition-all ${
                mode === 'pointSlope'
                  ? 'bg-ares-red/10 border-ares-red/30 ring-1 ring-ares-red/20'
                  : 'bg-black/10 border-white/5'
              }`}
            >
              <div className="flex justify-between items-center mb-1">
                <span className="text-[10px] font-mono text-ares-gold/70 uppercase tracking-widest">
                  Point-Slope Form
                </span>
                <span className="text-[10px] font-mono text-white/30">y - y₁ = m(x - x₁)</span>
              </div>
              <div>{formatPointSlope()}</div>
            </div>
          </div>
        </div>

        {/* Real-time Math Explanation */}
        <div className="bg-obsidian-surface/60 border border-white/5 rounded-xl p-5 shadow-lg flex-1">
          <h3 className="font-heading font-black text-xs uppercase tracking-widest text-ares-gold mb-3 flex items-center gap-2">
            <HelpCircle size={14} /> Mathematical Breakdown
          </h3>

          <div className="text-xs sm:text-sm font-sans leading-relaxed text-marble/80 space-y-3">
            {mode === 'slopeIntercept' && (
              <>
                <p>
                  In the <strong className="text-white">Slope-Intercept Form</strong>, the equation directly exposes the rate of change and the starting point:
                </p>
                <ul className="list-disc pl-4 space-y-1.5 text-marble/70">
                  <li>
                    The <strong className="text-ares-red font-mono">Slope (m = {m.toFixed(1)})</strong> determines the steepness. It describes the ratio of vertical change (rise) to horizontal change (run). Every 1 unit right causes y to shift by <span className="text-ares-red font-bold font-mono">{m.toFixed(1)}</span>.
                  </li>
                  <li>
                    The <strong className="text-ares-gold font-mono">Y-Intercept (b = {b.toFixed(1)})</strong> is the precise coordinate where the line crosses the Y-axis: <span className="text-ares-gold font-bold font-mono">(0, {b.toFixed(1)})</span>.
                  </li>
                </ul>
              </>
            )}

            {mode === 'pointSlope' && (
              <>
                <p>
                  The <strong className="text-white">Point-Slope Form</strong> defines a line using its steepness and any single known coordinate:
                </p>
                <ul className="list-disc pl-4 space-y-1.5 text-marble/70">
                  <li>
                    The <strong className="text-ares-red font-mono">Slope (m = {mPs.toFixed(1)})</strong> defines the direction and steepness, identical to slope-intercept form.
                  </li>
                  <li>
                    The <strong className="text-ares-bronze font-mono">Anchor Point (x₁, y₁ = {`(${x1.toFixed(1)}, ${y1.toFixed(1)})`})</strong> is a specific location the line is locked to. You can drag the bronze dot anywhere to watch the line pivot!
                  </li>
                </ul>
              </>
            )}

            {mode === 'standard' && (
              <>
                <p>
                  The <strong className="text-white">Standard Form</strong> uses integer coefficients and is highly useful for computing intercepts:
                </p>
                <ul className="list-disc pl-4 space-y-1.5 text-marble/70">
                  <li>
                    {B !== 0 ? (
                      <span>
                        The slope is calculated as <strong className="font-mono text-ares-red">-A / B = {-A}/{B} = {m.toFixed(2)}</strong>.
                      </span>
                    ) : (
                      <span className="text-ares-red font-bold">Slope is undefined (vertical line) since B = 0.</span>
                    )}
                  </li>
                  <li>
                    {A !== 0 && (
                      <span>
                        The <strong className="text-ares-bronze">X-intercept</strong> is found when y = 0: <strong className="font-mono">x = C / A = {C}/{A} = {(C / A).toFixed(2)}</strong>.
                      </span>
                    )}
                  </li>
                  <li>
                    {B !== 0 && (
                      <span>
                        The <strong className="text-ares-gold">Y-intercept</strong> is found when x = 0: <strong className="font-mono">y = C / B = {C}/{B} = {(C / B).toFixed(2)}</strong>.
                      </span>
                    )}
                  </li>
                </ul>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
