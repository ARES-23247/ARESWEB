/** @sim {"name": "Systems of Inequalities", "requiresContext": false} */
import React, { useState, useRef } from 'react';
import { RefreshCw, CheckCircle2, XCircle, ChevronRight, Sparkles } from 'lucide-react';

type Operator = '>=' | '>' | '<=' | '<';

interface Inequality {
  m: number;
  b: number;
  op: Operator;
  color: string;
  name: string;
}

interface Question {
  id: number;
  text: string;
  options: string[];
  correctIdx: number;
  explanation: string;
  setup: {
    line1: { m: number; b: number; op: Operator };
    line2: { m: number; b: number; op: Operator };
    tester: { x: number; y: number };
  };
}
interface PresetSystem {
  name: string;
  desc: string;
  line1: { m: number; b: number; op: Operator };
  line2: { m: number; b: number; op: Operator };
  tester: { x: number; y: number };
}

const PRESET_SYSTEMS: Record<string, PresetSystem> = {
  sat_standard: {
    name: 'Standard System',
    desc: 'A classic system: y ≥ -x + 2 and y < 2x - 3. Explore where their shaded halves intersect.',
    line1: { m: -1, b: 2, op: '>=' },
    line2: { m: 2, b: -3, op: '<' },
    tester: { x: 4.0, y: 1.0 }
  },
  robotics_envelope: {
    name: 'Robotics Torque & Speed Envelope',
    desc: 'Robotic motor speed (x) vs. load torque (y). Constraints: y ≤ 6 (max torque) and y ≥ -1.2x + 4 (speed threshold).',
    line1: { m: 0, b: 6, op: '<=' },
    line2: { m: -1.2, b: 4, op: '>=' },
    tester: { x: 2.0, y: 4.0 }
  }
};

const QUIZ_QUESTIONS: Question[] = [
  {
    id: 1,
    text: "Which of the following coordinate points is a solution to the system of inequalities graphed: y ≥ -x + 2 and y < 2x - 3?",
    options: [
      "(0, 0)",
      "(3, 0)",
      "(4, 1)",
      "(1, 5)"
    ],
    correctIdx: 2,
    explanation: "To satisfy the system, the point must make BOTH inequality statements true. Let's test (4, 1): For y ≥ -x + 2 => 1 ≥ -4 + 2 => 1 ≥ -2 (True!). For y < 2x - 3 => 1 < 2(4) - 3 => 1 < 5 (True!). Both are true, so (4, 1) is a solution. On the graph, you can drag the green tester point to (4, 1) and see that it lies exactly in the golden-bronze overlapping solution region.",
    setup: {
      line1: { m: -1, b: 2, op: '>=' },
      line2: { m: 2, b: -3, op: '<' },
      tester: { x: 4.0, y: 1.0 }
    }
  },
  {
    id: 2,
    text: "A robotics routine requires motor controls to stay in the torque-speed envelope defined by y ≤ 6 (torque limit) and y ≥ -1.2x + 4 (minimum speed-power ratio). Which of the following statements is true about the motor operating point (1.0, 5.0)?",
    options: [
      "It satisfies both inequalities and represents a valid operating state.",
      "It violates both inequalities.",
      "It satisfies y ≤ 6 but violates y ≥ -1.2x + 4.",
      "It satisfies y ≥ -1.2x + 4 but violates y ≤ 6."
    ],
    correctIdx: 0,
    explanation: "Let's substitute x = 1.0 and y = 5.0 into both inequalities: 1) 5.0 ≤ 6 (True, it satisfies torque limits). 2) 5.0 ≥ -1.2(1.0) + 4 => 5.0 ≥ 2.8 (True, it satisfies speed ratios). Since it satisfies both conditions, it is a valid operating state. Dragging the tester point to (1, 5) shows it comfortably in the blended overlap region.",
    setup: {
      line1: { m: 0, b: 6, op: '<=' },
      line2: { m: -1.2, b: 4, op: '>=' },
      tester: { x: 1.0, y: 5.0 }
    }
  },
  {
    id: 3,
    text: "For the system y > x + 3 and y < x - 1, which of the following best describes the solution set of the system?",
    options: [
      "The solution set consists of all points lying between the two boundary lines.",
      "The solution set is infinite and covers the upper right quadrant.",
      "There are no solutions to the system because the shaded regions do not overlap.",
      "The solution set consists of all points resting directly on the line y = x."
    ],
    correctIdx: 2,
    explanation: "The two boundary lines y = x + 3 and y = x - 1 have the exact same slope (m = 1), meaning they are parallel. The first inequality shades EVERYTHING ABOVE y = x + 3, while the second shades EVERYTHING BELOW y = x - 1. Because these shaded regions face away from each other and the lines never cross, there is absolutely no overlapping intersection. Thus, the system has zero real solutions.",
    setup: {
      line1: { m: 1, b: 3, op: '>' },
      line2: { m: 1, b: -1, op: '<' },
      tester: { x: 0.0, y: 0.0 }
    }
  }
];

export default function InequalitiesSim() {
  const [selectedPreset, setSelectedPreset] = useState<string>('sat_standard');

  // Inequality parameters
  const [line1, setLine1] = useState<Inequality>({
    m: -1.0,
    b: 2.0,
    op: '>=',
    color: '#FFB81C', // Gold
    name: 'Inequality 1 (Gold)'
  });

  const [line2, setLine2] = useState<Inequality>({
    m: 2.0,
    b: -3.0,
    op: '<',
    color: '#FF4F4F', // Red
    name: 'Inequality 2 (Red)'
  });

  // Draggable tester point
  const [tester, setTester] = useState<{ x: number; y: number }>({ x: 4.0, y: 1.0 });
  const [isDraggingTester, setIsDraggingTester] = useState<boolean>(false);
  const svgRef = useRef<SVGSVGElement | null>(null);

  // Practice quiz states
  const [currentQIdx, setCurrentQIdx] = useState<number>(0);
  const [selectedOpt, setSelectedOpt] = useState<number | null>(null);
  const [isAnswered, setIsAnswered] = useState<boolean>(false);

  // SVG dimensions
  const width = 360;
  const height = 360;
  const padding = 30;

  // Scales
  const xScale = (xVal: number) => {
    return padding + ((xVal + 10) / 20) * (width - 2 * padding);
  };

  const yScale = (yVal: number) => {
    return height - padding - ((yVal + 10) / 20) * (height - 2 * padding);
  };

  const xInverse = (screenX: number) => {
    const dataX = ((screenX - padding) / (width - 2 * padding)) * 20 - 10;
    return Math.max(-10, Math.min(10, Math.round(dataX * 2) / 2)); // snap to nearest 0.5
  };

  const yInverse = (screenY: number) => {
    const dataY = 10 - ((screenY - padding) / (height - 2 * padding)) * 20;
    return Math.max(-10, Math.min(10, Math.round(dataY * 2) / 2)); // snap to nearest 0.5
  };

  // Preset switch handler
  const handlePresetChange = (presetKey: string) => {
    setSelectedPreset(presetKey);
    const data = PRESET_SYSTEMS[presetKey];
    setLine1(prev => ({ ...prev, m: data.line1.m, b: data.line1.b, op: data.line1.op }));
    setLine2(prev => ({ ...prev, m: data.line2.m, b: data.line2.b, op: data.line2.op }));
    setTester({ ...data.tester });
    setSelectedOpt(null);
    setIsAnswered(false);

    // Sync quiz question
    const qIdx = QUIZ_QUESTIONS.findIndex(q => q.setup.line1.m === data.line1.m && q.setup.line2.m === data.line2.m);
    if (qIdx !== -1) {
      setCurrentQIdx(qIdx);
    }
  };

  const handleReset = () => {
    const data = PRESET_SYSTEMS[selectedPreset];
    setLine1(prev => ({ ...prev, m: data.line1.m, b: data.line1.b, op: data.line1.op }));
    setLine2(prev => ({ ...prev, m: data.line2.m, b: data.line2.b, op: data.line2.op }));
    setTester({ ...data.tester });
    setSelectedOpt(null);
    setIsAnswered(false);
  };

  // Evaluate if a coordinate satisfies a line
  const testInequality = (x: number, y: number, ineq: Inequality) => {
    const rhs = ineq.m * x + ineq.b;
    // Account for micro rounding floats
    const diff = y - rhs;
    const margin = 0.0001;

    switch (ineq.op) {
      case '>=':
        return diff >= -margin;
      case '>':
        return diff > margin;
      case '<=':
        return diff <= margin;
      case '<':
        return diff < -margin;
      default:
        return false;
    }
  };

  const satisfies1 = testInequality(tester.x, tester.y, line1);
  const satisfiesLine2Corrected = testInequality(tester.x, tester.y, line2);
  const satisfiesSystem = satisfies1 && satisfiesLine2Corrected;

  // Build polygon coordinates for shaded inequality representation
  const getShadedPolygonPoints = (ineq: Inequality) => {
    // Generate y values at borders x = -11 and x = 11 to safely clip
    const yLeft = ineq.m * -11 + ineq.b;
    const yRight = ineq.m * 11 + ineq.b;

    // We draw borders extending slightly beyond visible canvas (-12, 12) for perfect clipping boundary coverage
    if (ineq.op === '>=' || ineq.op === '>') {
      // Shading above: left-bottom line, right-bottom line, right-top, left-top
      return `${xScale(-11)},${yScale(yLeft)} ${xScale(11)},${yScale(yRight)} ${xScale(11)},${yScale(12)} ${xScale(-11)},${yScale(12)}`;
    } else {
      // Shading below: left-top line, right-top line, right-bottom, left-bottom
      return `${xScale(-11)},${yScale(yLeft)} ${xScale(11)},${yScale(yRight)} ${xScale(11)},${yScale(-12)} ${xScale(-11)},${yScale(-12)}`;
    }
  };

  // Draggable tester handler
  const handleTesterPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    (e.target as Element).setPointerCapture(e.pointerId);
    setIsDraggingTester(true);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingTester || !svgRef.current) return;

    const rect = svgRef.current.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;

    const newX = xInverse(clientX);
    const newY = yInverse(clientY);

    setTester({ x: newX, y: newY });
  };

  const handleTesterPointerUp = (e: React.PointerEvent) => {
    if (isDraggingTester) {
      (e.target as Element).releasePointerCapture(e.pointerId);
      setIsDraggingTester(false);
    }
  };

  const handleAnswerSubmit = (idx: number) => {
    if (isAnswered) return;
    setSelectedOpt(idx);
    setIsAnswered(true);
  };

  const handleNextQuestion = () => {
    const nextQIdx = (currentQIdx + 1) % QUIZ_QUESTIONS.length;
    setCurrentQIdx(nextQIdx);
    
    // Apply question state preset
    const qData = QUIZ_QUESTIONS[nextQIdx];
    setLine1(prev => ({ ...prev, m: qData.setup.line1.m, b: qData.setup.line1.b, op: qData.setup.line1.op }));
    setLine2(prev => ({ ...prev, m: qData.setup.line2.m, b: qData.setup.line2.b, op: qData.setup.line2.op }));
    setTester({ ...qData.setup.tester });
    setSelectedOpt(null);
    setIsAnswered(false);
  };

  const ticks = [-10, -8, -6, -4, -2, 0, 2, 4, 6, 8, 10];

  return (
    <div className="sim-container flex flex-col gap-6 p-4 sm:p-6 text-ares-offwhite bg-ares-gray-deep/40 rounded-xl border border-white/5 max-w-2xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-white/5 pb-4">
        <div>
          <span className="font-heading font-black text-ares-gold uppercase tracking-wider text-xs block mb-1">
            ARES Academy Math Prep
          </span>
          <h2 className="text-xl font-bold font-heading text-white flex items-center gap-2">
            <Sparkles size={20} className="text-ares-gold" />
            Systems of Inequalities
          </h2>
        </div>
        <button
          onClick={handleReset}
          className="text-xs font-bold text-ares-red hover:text-white hover:bg-ares-red/10 px-2.5 py-1.5 rounded border border-ares-red/20 flex items-center gap-1 transition-all self-end sm:self-auto"
        >
          <RefreshCw size={12} /> Reset System
        </button>
      </div>

      {/* Preset tabs */}
      <div className="grid grid-cols-2 gap-1 bg-obsidian-darker p-1 rounded-lg border border-white/5">
        {Object.entries(PRESET_SYSTEMS).map(([key, preset]) => (
          <button
            key={key}
            onClick={() => handlePresetChange(key)}
            className={`text-xs font-bold py-2 px-3 rounded transition-all text-center ${
              selectedPreset === key
                ? 'bg-ares-red text-white font-black shadow-md'
                : 'text-ares-muted hover:text-white hover:bg-white/5'
            }`}
          >
            {preset.name}
          </button>
        ))}
      </div>

      {/* Workspace: SVG Grid & Sliders */}
      <div className="flex flex-col md:flex-row gap-6 items-center">
        
        {/* SVG Graphing Area */}
        <div className="relative bg-obsidian-darker p-3 rounded-xl border border-white/10 shadow-2xl shrink-0">
          <svg
            ref={svgRef}
            width={width}
            height={height}
            onPointerMove={handlePointerMove}
            className="select-none touch-none rounded-lg"
          >
            {/* Clipping path for grid boundary */}
            <defs>
              <clipPath id="grid-clip">
                <rect
                  x={padding}
                  y={padding}
                  width={width - 2 * padding}
                  height={height - 2 * padding}
                />
              </clipPath>
            </defs>

            {/* Shaded Inequality Polygons (Blended overlap shading) */}
            {/* Inequality 1 (Gold) */}
            <polygon
              points={getShadedPolygonPoints(line1)}
              fill={line1.color}
              opacity="0.18"
              clipPath="url(#grid-clip)"
            />
            {/* Inequality 2 (Red) */}
            <polygon
              points={getShadedPolygonPoints(line2)}
              fill={line2.color}
              opacity="0.18"
              clipPath="url(#grid-clip)"
            />

            {/* Grid ticks & axis numbers */}
            {ticks.map(tick => {
              const xPos = xScale(tick);
              const yPos = yScale(tick);
              return (
                <g key={tick}>
                  {/* Vertical lines */}
                  <line
                    x1={xPos}
                    y1={padding}
                    x2={xPos}
                    y2={height - padding}
                    stroke={tick === 0 ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.06)'}
                    strokeWidth={tick === 0 ? '2' : '1'}
                  />
                  {/* Horizontal lines */}
                  <line
                    x1={padding}
                    y1={yPos}
                    x2={width - padding}
                    y2={yPos}
                    stroke={tick === 0 ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.06)'}
                    strokeWidth={tick === 0 ? '2' : '1'}
                  />
                  {/* Labels on center axis */}
                  {tick !== 0 && (
                    <>
                      <text
                        x={xPos}
                        y={yScale(0) + 12}
                        fill="rgba(255,255,255,0.4)"
                        fontSize="8"
                        fontFamily="monospace"
                        textAnchor="middle"
                      >
                        {tick}
                      </text>
                      <text
                        x={xScale(0) - 8}
                        y={yPos + 3}
                        fill="rgba(255,255,255,0.4)"
                        fontSize="8"
                        fontFamily="monospace"
                        textAnchor="end"
                      >
                        {tick}
                      </text>
                    </>
                  )}
                </g>
              );
            })}

            {/* Boundary Line 1 (Gold) */}
            {(() => {
              const yLeft = line1.m * -10 + line1.b;
              const yRight = line1.m * 10 + line1.b;
              const isDashed = line1.op === '>' || line1.op === '<';
              return (
                <line
                  x1={xScale(-10)}
                  y1={yScale(yLeft)}
                  x2={xScale(10)}
                  y2={yScale(yRight)}
                  stroke={line1.color}
                  strokeWidth="2.5"
                  strokeDasharray={isDashed ? '5,5' : 'none'}
                  clipPath="url(#grid-clip)"
                />
              );
            })()}

            {/* Boundary Line 2 (Red) */}
            {(() => {
              const yLeft = line2.m * -10 + line2.b;
              const yRight = line2.m * 10 + line2.b;
              const isDashed = line2.op === '>' || line2.op === '<';
              return (
                <line
                  x1={xScale(-10)}
                  y1={yScale(yLeft)}
                  x2={xScale(10)}
                  y2={yScale(yRight)}
                  stroke={line2.color}
                  strokeWidth="2.5"
                  strokeDasharray={isDashed ? '5,5' : 'none'}
                  clipPath="url(#grid-clip)"
                />
              );
            })()}

            {/* Draggable tester point */}
            {(() => {
              const cx = xScale(tester.x);
              const cy = yScale(tester.y);
              const color = satisfiesSystem ? '#10B981' : '#EF4444'; // green vs red
              return (
                <g>
                  {/* Glowing validation halo */}
                  <circle
                    cx={cx}
                    cy={cy}
                    r="15"
                    fill={color}
                    opacity="0.25"
                    className="animate-pulse"
                  />
                  {/* Core handle dot */}
                  <circle
                    cx={cx}
                    cy={cy}
                    r="8.5"
                    fill={color}
                    stroke="#1b1c1e"
                    strokeWidth="1.5"
                    className="cursor-move hover:fill-white transition-colors"
                    onPointerDown={handleTesterPointerDown}
                    onPointerUp={handleTesterPointerUp}
                  />
                  {/* Visual satisfy coordinate label */}
                  <g transform={`translate(${cx}, ${cy - 18})`}>
                    <rect x="-26" y="-12" width="52" height="15" rx="3" fill="#1b1c1e" stroke={color} strokeWidth="1" />
                    <text x="0" y="-2" fill="#ffffff" fontSize="8" fontWeight="bold" textAnchor="middle" fontFamily="monospace">
                      ({tester.x.toFixed(1)}, {tester.y.toFixed(1)})
                    </text>
                  </g>
                </g>
              );
            })()}
          </svg>
        </div>

        {/* Dynamic Parameter Sliders & Details */}
        <div className="w-full flex flex-col gap-4">
          
          {/* Inequality 1 Sliders */}
          <div className="bg-obsidian-surface/50 border border-white/5 p-3 rounded-lg flex flex-col gap-2">
            <span className="text-[10px] text-ares-gold font-bold uppercase tracking-wider block">Inequality 1 (Gold)</span>
            
            {/* Algebraic Display */}
            <div className="text-xs font-monospace font-semibold text-white">
              {"y "}{line1.op}{" "}{line1.m.toFixed(1)}{"x "}{line1.b >= 0 ? '+ ' : '- '}{Math.abs(line1.b).toFixed(1)}
            </div>

            {/* Operator toggle buttons */}
            <div className="grid grid-cols-4 gap-1 mt-1">
              {(['>=', '>', '<=', '<'] as Operator[]).map(op => (
                <button
                  key={op}
                  onClick={() => setLine1(prev => ({ ...prev, op }))}
                  className={`text-[10px] font-bold py-1.5 rounded transition-all text-center border ${
                    line1.op === op
                      ? 'bg-ares-gold/20 text-ares-gold border-ares-gold/50'
                      : 'text-ares-muted border-white/5 hover:text-white'
                  }`}
                >
                  {op}
                </button>
              ))}
            </div>

            {/* Slope (m) slider */}
            <div className="flex flex-col gap-1 mt-1 text-[10px]">
              <div className="flex justify-between font-bold">
                <span className="text-ares-muted">Slope (m1):</span>
                <span className="text-white">{line1.m.toFixed(1)}</span>
              </div>
              <input
                type="range"
                min="-3.0"
                max="3.0"
                step="0.1"
                value={line1.m}
                onChange={(e) => setLine1(prev => ({ ...prev, m: parseFloat(e.target.value) }))}
                className="w-full accent-ares-gold bg-obsidian-darker"
              />
            </div>

            {/* Intercept (b) slider */}
            <div className="flex flex-col gap-1 text-[10px]">
              <div className="flex justify-between font-bold">
                <span className="text-ares-muted">Y-Intercept (b1):</span>
                <span className="text-white">{line1.b.toFixed(1)}</span>
              </div>
              <input
                type="range"
                min="-8.0"
                max="8.0"
                step="0.5"
                value={line1.b}
                onChange={(e) => setLine1(prev => ({ ...prev, b: parseFloat(e.target.value) }))}
                className="w-full accent-ares-gold bg-obsidian-darker"
              />
            </div>
          </div>

          {/* Inequality 2 Sliders */}
          <div className="bg-obsidian-surface/50 border border-white/5 p-3 rounded-lg flex flex-col gap-2">
            <span className="text-[10px] text-ares-red font-bold uppercase tracking-wider block">Inequality 2 (Red)</span>
            
            {/* Algebraic Display */}
            <div className="text-xs font-monospace font-semibold text-white">
              {"y "}{line2.op}{" "}{line2.m.toFixed(1)}{"x "}{line2.b >= 0 ? '+ ' : '- '}{Math.abs(line2.b).toFixed(1)}
            </div>

            {/* Operator buttons */}
            <div className="grid grid-cols-4 gap-1 mt-1">
              {(['>=', '>', '<=', '<'] as Operator[]).map(op => (
                <button
                  key={op}
                  onClick={() => setLine2(prev => ({ ...prev, op }))}
                  className={`text-[10px] font-bold py-1.5 rounded transition-all text-center border ${
                    line2.op === op
                      ? 'bg-ares-red/20 text-ares-red border-ares-red/50'
                      : 'text-ares-muted border-white/5 hover:text-white'
                  }`}
                >
                  {op}
                </button>
              ))}
            </div>

            {/* Slope slider */}
            <div className="flex flex-col gap-1 mt-1 text-[10px]">
              <div className="flex justify-between font-bold">
                <span className="text-ares-muted">Slope (m2):</span>
                <span className="text-white">{line2.m.toFixed(1)}</span>
              </div>
              <input
                type="range"
                min="-3.0"
                max="3.0"
                step="0.1"
                value={line2.m}
                onChange={(e) => setLine2(prev => ({ ...prev, m: parseFloat(e.target.value) }))}
                className="w-full accent-ares-red bg-obsidian-darker"
              />
            </div>

            {/* Intercept slider */}
            <div className="flex flex-col gap-1 text-[10px]">
              <div className="flex justify-between font-bold">
                <span className="text-ares-muted">Y-Intercept (b2):</span>
                <span className="text-white">{line2.b.toFixed(1)}</span>
              </div>
              <input
                type="range"
                min="-8.0"
                max="8.0"
                step="0.5"
                value={line2.b}
                onChange={(e) => setLine2(prev => ({ ...prev, b: parseFloat(e.target.value) }))}
                className="w-full accent-ares-red bg-obsidian-darker"
              />
            </div>
          </div>

        </div>
      </div>

      {/* Live validation summary */}
      <div className={`w-full border p-3.5 rounded-lg text-xs leading-relaxed flex flex-col gap-1.5 transition-all ${
        satisfiesSystem
          ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
          : 'bg-red-500/10 border-red-500/20 text-red-300'
      }`}>
        <span className="text-[10px] text-ares-muted font-bold tracking-wider uppercase block">Test Point Diagnostic</span>
        <div className="flex items-center gap-1.5 font-bold text-white">
          {satisfiesSystem ? (
            <>
              <CheckCircle2 size={16} className="text-emerald-400" />
              <span>TEST POINT IS A VALID SOLUTION TO THE SYSTEM</span>
            </>
          ) : (
            <>
              <XCircle size={16} className="text-red-400" />
              <span>TEST POINT IS NOT A VALID SOLUTION</span>
            </>
          )}
        </div>
        <p className="text-marble/85 mt-0.5">
          {satisfiesSystem
            ? `Point (${tester.x.toFixed(1)}, ${tester.y.toFixed(1)}) makes BOTH inequality statements algebraically true. It sits within the color-blended intersection of both shaded half-planes.`
            : `Point (${tester.x.toFixed(1)}, ${tester.y.toFixed(1)}) violates one or both inequality conditions. Slide parameter bars or drag the tester handle directly inside the overlapping shaded zone to find a solution!`
          }
        </p>
      </div>

      {/* Practice Quiz module */}
      {currentQIdx >= 0 && (
        <div className="w-full flex flex-col gap-4 bg-obsidian-surface/60 border border-white/5 p-4 rounded-xl mt-2">
          <div className="flex justify-between items-center text-xs">
            <span className="font-bold text-ares-gold uppercase tracking-wider">
              Algebra Practice: Question {currentQIdx + 1} of {QUIZ_QUESTIONS.length}
            </span>
            <button
              onClick={handleNextQuestion}
              className="text-ares-red font-bold flex items-center gap-0.5 hover:text-white"
            >
              Skip Question <ChevronRight size={14} />
            </button>
          </div>

          {/* Question Text */}
          <p className="text-sm font-semibold text-white leading-relaxed">
            {QUIZ_QUESTIONS[currentQIdx].text}
          </p>

          {/* Options */}
          <div className="grid grid-cols-1 gap-2">
            {QUIZ_QUESTIONS[currentQIdx].options.map((opt, idx) => {
              const isSelected = selectedOpt === idx;
              const isCorrect = idx === QUIZ_QUESTIONS[currentQIdx].correctIdx;

              let optClass = 'border-white/5 hover:border-white/20 text-ares-muted bg-obsidian-darker/40';
              if (isAnswered) {
                if (isCorrect) {
                  optClass = 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300';
                } else if (isSelected) {
                  optClass = 'border-red-500/50 bg-red-500/10 text-red-300';
                }
              } else if (isSelected) {
                optClass = 'border-ares-gold bg-ares-gold/10 text-white';
              }

              return (
                <button
                  key={idx}
                  onClick={() => handleAnswerSubmit(idx)}
                  disabled={isAnswered}
                  className={`text-left p-3 rounded-lg border text-xs font-semibold flex justify-between items-center transition-all ${optClass}`}
                >
                  <span>{opt}</span>
                  {isAnswered && isCorrect && <CheckCircle2 size={14} className="text-emerald-400 font-bold shrink-0" />}
                  {isAnswered && !isCorrect && isSelected && <XCircle size={14} className="text-red-400 font-bold shrink-0" />}
                </button>
              );
            })}
          </div>

          {/* Answer details */}
          {isAnswered && (
            <div className="bg-obsidian-darker border border-white/10 p-3.5 rounded-lg text-xs leading-relaxed transition-all">
              <div className="flex items-center gap-1.5 font-bold text-ares-gold mb-1">
                <CheckCircle2 size={12} />
                <span>STEP-BY-STEP EXPLANATION</span>
              </div>
              <p className="text-marble/95 leading-relaxed">
                {QUIZ_QUESTIONS[currentQIdx].explanation}
              </p>
              <div className="mt-3 flex justify-end">
                <button
                  onClick={handleNextQuestion}
                  className="bg-ares-red/20 border border-ares-red/40 hover:bg-ares-red hover:text-white text-ares-red text-xs font-bold px-3 py-1.5 rounded transition-all flex items-center gap-1"
                >
                  Next Practice Question <ChevronRight size={12} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
