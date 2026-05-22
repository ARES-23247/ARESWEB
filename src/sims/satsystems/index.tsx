/** @sim {"name": "SAT Prep: Systems of Linear Equations", "requiresContext": false} */
import React, { useState } from 'react';
import { RefreshCw, CheckCircle2, XCircle, ChevronRight, Sparkles, Sliders, Crosshair } from 'lucide-react';

interface Question {
  id: number;
  text: string;
  options: string[];
  correctIdx: number;
  explanation: string;
  m1: number;
  b1: number;
  m2: number;
  b2: number;
  presetKey: string;
}

const SAT_QUESTIONS: Question[] = [
  {
    id: 1,
    text: "A system of two linear equations is given by y = 0.75x + 3 and y = kx - 5. For which value of the constant k will the system of equations have no solution?",
    options: [
      "-5",
      "0.75",
      "3",
      "1.33"
    ],
    correctIdx: 1,
    explanation: "A system of two linear equations has no solution if the lines are parallel and do not overlap. Parallel lines have the exact same slope but different y-intercepts. The slope of the first line is 0.75, and its y-intercept is 3. The slope of the second line is k, and its y-intercept is -5. Since the y-intercepts are different, the system will have no solution when the slopes are equal, which means k = 0.75.",
    m1: 0.75,
    b1: 3,
    m2: 0.75,
    b2: -5,
    presetKey: "no_solution"
  },
  {
    id: 2,
    text: "Two autonomous robots travel along paths modeled by the equations y = -1.5x + 4 (Robot A) and y = 0.5x - 4 (Robot B). If the robots collide, what are the coordinates (x, y) of the collision point?",
    options: [
      "(2, 1)",
      "(4, -2)",
      "(-4, -6)",
      "(0, 4)"
    ],
    correctIdx: 1,
    explanation: "To find the collision (intersection) point, set the two equations equal to each other: -1.5x + 4 = 0.5x - 4. Adding 1.5x to both sides gives 4 = 2x - 4. Adding 4 to both sides gives 8 = 2x, which simplifies to x = 4. Substitute x = 4 back into either path equation to find y: y = 0.5(4) - 4 = 2 - 4 = -2. The collision point is at (4, -2).",
    m1: -1.5,
    b1: 4,
    m2: 0.5,
    b2: -4,
    presetKey: "robot_collision"
  },
  {
    id: 3,
    text: "Consider the linear system y = 1.25x - 2 and 4y = ax - 8. For which value of the constant a will the system have infinitely many solutions?",
    options: [
      "1.25",
      "4",
      "5",
      "8"
    ],
    correctIdx: 2,
    explanation: "A system has infinitely many solutions if the two equations represent the exact same line (identical lines). Let's write the second equation in slope-intercept form by dividing both sides by 4: y = (a/4)x - 2. For this line to be identical to y = 1.25x - 2, their slopes must be equal: a/4 = 1.25. Multiplying by 4 gives a = 5. Therefore, a = 5 gives infinitely many solutions.",
    m1: 1.25,
    b1: -2,
    m2: 1.25,
    b2: -2,
    presetKey: "infinite_solutions"
  }
];

interface Preset {
  name: string;
  desc: string;
  m1: number;
  b1: number;
  m2: number;
  b2: number;
  label1: string;
  label2: string;
}

const PRESETS: Record<string, Preset> = {
  one_solution: {
    name: "One Solution",
    desc: "Lines with different slopes intersect at exactly one coordinate point (x, y). This is the most common system case.",
    m1: 1.0,
    b1: 1.0,
    m2: -0.5,
    b2: 4.0,
    label1: "y = 1.0x + 1.0",
    label2: "y = -0.5x + 4.0"
  },
  no_solution: {
    name: "No Solution",
    desc: "Parallel lines share the exact same slope but have different y-intercepts. Since they never cross, there is no solution.",
    m1: 0.75,
    b1: 3.0,
    m2: 0.75,
    b2: -3.0,
    label1: "y = 0.75x + 3.0",
    label2: "y = 0.75x - 3.0"
  },
  infinite_solutions: {
    name: "Infinite Solutions",
    desc: "Lines are identical and lie directly on top of each other. Every point along the line represents a valid system solution.",
    m1: 1.25,
    b1: -2.0,
    m2: 1.25,
    b2: -2.0,
    label1: "y = 1.25x - 2.0",
    label2: "4y = 5.0x - 8.0"
  },
  robot_collision: {
    name: "Robot Collision Path",
    desc: "Models collision diagnostics. The intersection point of Robot A and Robot B paths gives the exact space coord of their collision.",
    m1: -1.5,
    b1: 4.0,
    m2: 0.5,
    b2: -4.0,
    label1: "Robot A path",
    label2: "Robot B path"
  }
};

export default function SatSystemsSim() {
  const [selectedPreset, setSelectedPreset] = useState<string>('one_solution');
  
  // Line 1 parameters: y = m1 * x + b1
  const [m1, setM1] = useState<number>(1.0);
  const [b1, setB1] = useState<number>(1.0);

  // Line 2 parameters: y = m2 * x + b2
  const [m2, setM2] = useState<number>(-0.5);
  const [b2, setB2] = useState<number>(4.0);

  // Custom coordinate readout
  const [hoverX, setHoverX] = useState<number>(2.0);

  // SAT practice quiz states
  const [currentQIdx, setCurrentQIdx] = useState<number>(0);
  const [selectedOpt, setSelectedOpt] = useState<number | null>(null);
  const [isAnswered, setIsAnswered] = useState<boolean>(false);

  // SVG coordinate dimensions
  const width = 360;
  const height = 360;
  const paddingLeft = 45;
  const paddingBottom = 45;
  const paddingRight = 20;
  const paddingTop = 20;

  // Scales mapping data [-8, 8] to screen
  const xScale = (xVal: number) => {
    return paddingLeft + ((xVal + 8) / 16) * (width - paddingLeft - paddingRight);
  };

  const yScale = (yVal: number) => {
    return height - paddingBottom - ((yVal + 8) / 16) * (height - paddingTop - paddingBottom);
  };

  const xInverse = (screenX: number) => {
    const dataX = ((screenX - paddingLeft) / (width - paddingLeft - paddingRight)) * 16 - 8;
    return Math.max(-8, Math.min(8, Math.round(dataX * 10) / 10));
  };

  const handlePresetChange = (presetKey: string) => {
    setSelectedPreset(presetKey);
    const p = PRESETS[presetKey];
    setM1(p.m1);
    setB1(p.b1);
    setM2(p.m2);
    setB2(p.b2);
    setHoverX(2.0);
    setSelectedOpt(null);
    setIsAnswered(false);

    // Sync quiz if appropriate
    const quizIdx = SAT_QUESTIONS.findIndex(q => q.presetKey === presetKey);
    if (quizIdx !== -1) {
      setCurrentQIdx(quizIdx);
    }
  };

  const handleReset = () => {
    const p = PRESETS[selectedPreset];
    setM1(p.m1);
    setB1(p.b1);
    setM2(p.m2);
    setB2(p.b2);
    setHoverX(2.0);
    setSelectedOpt(null);
    setIsAnswered(false);
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const scaledX = (clientX / rect.width) * width;
    const newX = xInverse(scaledX);
    setHoverX(newX);
  };

  // Generate SVG Line Path coordinates
  const generateLinePath = (m: number, b: number) => {
    const yStart = m * -8 + b;
    const yEnd = m * 8 + b;
    return `M ${xScale(-8).toFixed(1)},${yScale(yStart).toFixed(1)} L ${xScale(8).toFixed(1)},${yScale(yEnd).toFixed(1)}`;
  };

  // Find intersection point of the system
  const getIntersection = () => {
    const isParallel = Math.abs(m1 - m2) < 0.001;
    const isIdentical = isParallel && Math.abs(b1 - b2) < 0.001;

    if (isParallel) {
      return {
        hasSolution: false,
        isInfinite: isIdentical,
        x: 0,
        y: 0
      };
    }

    // m1 * x + b1 = m2 * x + b2
    // (m1 - m2) * x = b2 - b1
    const x = (b2 - b1) / (m1 - m2);
    const y = m1 * x + b1;

    return {
      hasSolution: true,
      isInfinite: false,
      x: Math.round(x * 100) / 100,
      y: Math.round(y * 100) / 100
    };
  };

  const handleAnswerSubmit = (idx: number) => {
    if (isAnswered) return;
    setSelectedOpt(idx);
    setIsAnswered(true);
  };

  const handleNextQuestion = () => {
    const nextIdx = (currentQIdx + 1) % SAT_QUESTIONS.length;
    setCurrentQIdx(nextIdx);
    const q = SAT_QUESTIONS[nextIdx];
    setM1(q.m1);
    setB1(q.b1);
    setM2(q.m2);
    setB2(q.b2);
    setHoverX(2.0);
    setSelectedOpt(null);
    setIsAnswered(false);
    setSelectedPreset(q.presetKey);
  };

  const gridTicks = [-8, -6, -4, -2, 0, 2, 4, 6, 8];
  const intersection = getIntersection();

  return (
    <div className="sim-container flex flex-col gap-6 p-4 sm:p-6 text-ares-offwhite bg-ares-gray-deep/40 rounded-xl border border-white/5 max-w-2xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-white/5 pb-4">
        <div>
          <span className="font-heading font-black text-ares-gold uppercase tracking-wider text-xs block mb-1">
            ARES Academy Math Prep
          </span>
          <h2 className="text-xl font-bold font-heading text-white flex items-center gap-2">
            <Crosshair size={20} className="text-ares-red animate-pulse" />
            Systems of Linear Equations
          </h2>
        </div>
        <button
          onClick={handleReset}
          className="text-xs font-bold text-ares-red hover:text-white hover:bg-ares-red/10 px-2.5 py-1.5 rounded border border-ares-red/20 flex items-center gap-1 transition-all"
        >
          <RefreshCw size={12} /> Reset Parameters
        </button>
      </div>

      {/* Preset tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 bg-obsidian-darker p-1 rounded-lg border border-white/5">
        {Object.entries(PRESETS).map(([key, p]) => (
          <button
            key={key}
            onClick={() => handlePresetChange(key)}
            className={`text-[10px] sm:text-xs font-bold py-2 rounded transition-all text-center ${
              selectedPreset === key
                ? 'bg-ares-red text-white font-black shadow-md'
                : 'text-ares-muted hover:text-white hover:bg-white/5'
            }`}
          >
            {p.name}
          </button>
        ))}
      </div>

      {/* Description info */}
      <div className="bg-obsidian/20 border border-white/5 p-3 rounded-lg text-xs leading-relaxed text-marble/90">
        <p>{PRESETS[selectedPreset].desc}</p>
      </div>

      {/* Layout split */}
      <div className="flex flex-col md:flex-row gap-6 items-center">
        {/* Interactive SVG Cartesian plane */}
        <div className="relative bg-obsidian-darker p-3 rounded-xl border border-white/10 shadow-2xl shrink-0">
          <svg
            width={width}
            height={height}
            onPointerMove={handlePointerMove}
            className="select-none touch-none rounded-lg"
          >
            {/* Grid lines & ticks */}
            {gridTicks.map(tick => {
              const xPos = xScale(tick);
              const yPos = yScale(tick);
              return (
                <g key={`ticks-${tick}`}>
                  {/* Vertical lines */}
                  <line
                    x1={xPos}
                    y1={paddingTop}
                    x2={xPos}
                    y2={height - paddingBottom}
                    stroke={tick === 0 ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.06)'}
                    strokeWidth={tick === 0 ? '2' : '1'}
                  />
                  {/* Horizontal lines */}
                  <line
                    x1={paddingLeft}
                    y1={yPos}
                    x2={width - paddingRight}
                    y2={yPos}
                    stroke={tick === 0 ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.06)'}
                    strokeWidth={tick === 0 ? '2' : '1'}
                  />
                  {/* X Axis Labels */}
                  <text
                    x={xPos}
                    y={height - paddingBottom + 14}
                    fill="rgba(255,255,255,0.4)"
                    fontSize="9"
                    fontFamily="monospace"
                    textAnchor="middle"
                  >
                    {tick}
                  </text>
                  {/* Y Axis Labels */}
                  <text
                    x={paddingLeft - 8}
                    y={yPos + 3}
                    fill="rgba(255,255,255,0.4)"
                    fontSize="9"
                    fontFamily="monospace"
                    textAnchor="end"
                  >
                    {tick}
                  </text>
                </g>
              );
            })}

            {/* Clipping container to keep lines inside grid limits */}
            <defs>
              <clipPath id="grid-clip">
                <rect
                  x={paddingLeft}
                  y={paddingTop}
                  width={width - paddingLeft - paddingRight}
                  height={height - paddingTop - paddingBottom}
                />
              </clipPath>
            </defs>

            {/* Rendered Lines */}
            <g clipPath="url(#grid-clip)">
              {/* Line 1 (Red Accent) */}
              <path
                d={generateLinePath(m1, b1)}
                fill="none"
                stroke="#C00000"
                strokeWidth={selectedPreset === 'infinite_solutions' ? '5' : '3'}
                strokeLinecap="round"
                className="drop-shadow-[0_0_2px_rgba(192,0,0,0.4)]"
              />

              {/* Line 2 (Bronze/Gold Accent) */}
              <path
                d={generateLinePath(m2, b2)}
                fill="none"
                stroke={selectedPreset === 'infinite_solutions' ? '#FFB81C' : '#CD7F32'}
                strokeWidth="3.0"
                strokeLinecap="round"
                strokeDasharray={selectedPreset === 'infinite_solutions' ? '5,5' : 'none'}
                className="drop-shadow-[0_0_2px_rgba(255,184,28,0.4)]"
              />

              {/* Intersection Coordinate Circle */}
              {intersection.hasSolution && (
                <g>
                  <circle
                    cx={xScale(intersection.x)}
                    cy={yScale(intersection.y)}
                    r="8.5"
                    fill="rgba(0, 229, 255, 0.2)"
                    stroke="#00E5FF"
                    strokeWidth="2"
                  />
                  <circle
                    cx={xScale(intersection.x)}
                    cy={yScale(intersection.y)}
                    r="3.5"
                    fill="#00E5FF"
                  />
                </g>
              )}

              {/* Active hover vertical tracking line & coordinate dots */}
              <g>
                <line
                  x1={xScale(hoverX)}
                  y1={yScale(-8)}
                  x2={xScale(hoverX)}
                  y2={yScale(8)}
                  stroke="#FFB81C"
                  strokeWidth="1.5"
                  strokeDasharray="3,3"
                  opacity="0.6"
                />
                {Math.abs(m1 * hoverX + b1) <= 8 && (
                  <circle
                    cx={xScale(hoverX)}
                    cy={yScale(m1 * hoverX + b1)}
                    r="5"
                    fill="#C00000"
                    stroke="#ffffff"
                    strokeWidth="1.2"
                  />
                )}
                {Math.abs(m2 * hoverX + b2) <= 8 && (
                  <circle
                    cx={xScale(hoverX)}
                    cy={yScale(m2 * hoverX + b2)}
                    r="5"
                    fill={selectedPreset === 'infinite_solutions' ? '#FFB81C' : '#CD7F32'}
                    stroke="#ffffff"
                    strokeWidth="1.2"
                  />
                )}
              </g>
            </g>

            {/* Axes titles */}
            <text
              transform={`translate(14, ${height / 2}) rotate(-90)`}
              fill="rgba(255,255,255,0.5)"
              fontSize="9.5"
              fontWeight="bold"
              textAnchor="middle"
            >
              Position Y
            </text>
            <text
              x={width / 2 + 10}
              y={height - 8}
              fill="rgba(255,255,255,0.5)"
              fontSize="9.5"
              fontWeight="bold"
              textAnchor="middle"
            >
              Time / Position X
            </text>
          </svg>
        </div>

        {/* Adjustments & Formulas Panel */}
        <div className="w-full flex flex-col gap-4">
          <span className="text-[10px] text-ares-muted font-bold tracking-wider uppercase flex items-center gap-1">
            <Sliders size={12} /> Live Path Adjustments
          </span>

          {/* Formulas display */}
          <div className="bg-obsidian-surface/60 border border-white/5 p-3 rounded-lg flex flex-col gap-2">
            <div>
              <span className="text-[9px] text-ares-red font-extrabold uppercase">LINE A (RED)</span>
              <div className="text-sm font-monospace font-bold text-white leading-none mt-1">
                y = {m1.toFixed(2)}x {b1 >= 0 ? `+ ${b1.toFixed(2)}` : `- ${Math.abs(b1).toFixed(2)}`}
              </div>
            </div>
            <div>
              <span className="text-[9px] text-ares-gold font-extrabold uppercase">LINE B (BRONZE)</span>
              <div className="text-sm font-monospace font-bold text-white leading-none mt-1">
                y = {m2.toFixed(2)}x {b2 >= 0 ? `+ ${b2.toFixed(2)}` : `- ${Math.abs(b2).toFixed(2)}`}
              </div>
            </div>
          </div>

          {/* Real-time pointer tracker coordinates */}
          <div className="bg-obsidian-surface/60 border border-white/5 p-3 rounded-lg flex justify-between items-center text-xs">
            <div>
              <span className="text-[9px] text-ares-muted font-bold block">TRACKER X</span>
              <span className="font-monospace text-white font-bold">x = {hoverX.toFixed(1)}</span>
            </div>
            <div className="text-center">
              <span className="text-[9px] text-ares-red-light font-bold block">LINE A Y</span>
              <span className="font-monospace text-white font-bold">y = {(m1 * hoverX + b1).toFixed(2)}</span>
            </div>
            <div className="text-right">
              <span className="text-[9px] text-ares-gold font-bold block">LINE B Y</span>
              <span className="font-monospace text-white font-bold">y = {(m2 * hoverX + b2).toFixed(2)}</span>
            </div>
          </div>

          {/* System status readout */}
          <div className="bg-obsidian-surface/60 border border-white/5 p-3 rounded-lg flex justify-between items-center text-xs">
            <div>
              <span className="text-[9px] text-ares-muted font-bold block">INTERSECTION STATUS</span>
              <span className="font-semibold text-white">
                {intersection.isInfinite
                  ? "Infinitely Many Solutions"
                  : intersection.hasSolution
                  ? `One Solution (Intersecting)`
                  : "No Solution (Parallel Lines)"}
              </span>
            </div>
            <div className="text-right">
              <span className="text-[9px] text-ares-muted font-bold block">SYSTEM SOL (x, y)</span>
              <span className="font-monospace text-ares-cyan font-black">
                {intersection.isInfinite
                  ? "Overlapping Lines"
                  : intersection.hasSolution
                  ? `(${intersection.x.toFixed(2)}, ${intersection.y.toFixed(2)})`
                  : "No Intersection"}
              </span>
            </div>
          </div>

          {/* Sliders for Line A */}
          <div className="flex flex-col gap-3 bg-obsidian-darker p-3 rounded-lg border border-white/5 text-xs">
            <span className="text-[10px] text-ares-red font-bold uppercase tracking-wider">Line A (Red) Sliders</span>
            <div className="flex flex-col gap-1">
              <div className="flex justify-between font-bold">
                <span className="text-ares-muted">Slope (m1)</span>
                <span className="text-white">{m1.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="-2.0"
                max="2.0"
                step="0.25"
                value={m1}
                onChange={e => {
                  setM1(parseFloat(e.target.value));
                  setSelectedPreset('custom');
                }}
                className="w-full accent-ares-red"
              />
            </div>

            <div className="flex flex-col gap-1">
              <div className="flex justify-between font-bold">
                <span className="text-ares-muted">Y-Intercept (b1)</span>
                <span className="text-white">{b1.toFixed(1)}</span>
              </div>
              <input
                type="range"
                min="-6.0"
                max="6.0"
                step="0.5"
                value={b1}
                onChange={e => {
                  setB1(parseFloat(e.target.value));
                  setSelectedPreset('custom');
                }}
                className="w-full accent-ares-red"
              />
            </div>
          </div>

          {/* Sliders for Line B */}
          <div className="flex flex-col gap-3 bg-obsidian-darker p-3 rounded-lg border border-white/5 text-xs">
            <span className="text-[10px] text-ares-gold font-bold uppercase tracking-wider">Line B (Bronze) Sliders</span>
            <div className="flex flex-col gap-1">
              <div className="flex justify-between font-bold">
                <span className="text-ares-muted">Slope (m2)</span>
                <span className="text-white">{m2.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="-2.0"
                max="2.0"
                step="0.25"
                value={m2}
                onChange={e => {
                  setM2(parseFloat(e.target.value));
                  setSelectedPreset('custom');
                }}
                className="w-full accent-ares-bronze"
              />
            </div>

            <div className="flex flex-col gap-1">
              <div className="flex justify-between font-bold">
                <span className="text-ares-muted">Y-Intercept (b2)</span>
                <span className="text-white">{b2.toFixed(1)}</span>
              </div>
              <input
                type="range"
                min="-6.0"
                max="6.0"
                step="0.5"
                value={b2}
                onChange={e => {
                  setB2(parseFloat(e.target.value));
                  setSelectedPreset('custom');
                }}
                className="w-full accent-ares-bronze"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Strategy and Robotics Integration Tip */}
      <div className="w-full bg-obsidian-darker/60 border border-white/10 p-3 rounded-lg text-xs leading-relaxed">
        <span className="text-ares-gold text-[10px] uppercase font-bold tracking-wider mb-1 block flex items-center gap-1">
          <Sparkles size={12} />
          dSAT Strategy & Robotics Connection
        </span>
        <p className="text-marble/85">
          In FIRST® Robotics, linear systems determine paths of sensor readings or path collisions. For the dSAT, remember: 
          1) **One Solution** means slopes are different ($m_1 \neq m_2$).
          2) **No Solution** means parallel lines ($m_1 = m_2$, $b_1 \neq b_2$).
          3) **Infinite Solutions** means identical lines ($m_1 = m_2$, $b_1 = b_2$).
        </p>
      </div>

      {/* SAT Practice Quiz */}
      {currentQIdx >= 0 && (
        <div className="w-full flex flex-col gap-4 bg-obsidian-surface/60 border border-white/5 p-4 rounded-xl mt-2">
          <div className="flex justify-between items-center text-xs">
            <span className="font-bold text-ares-gold uppercase tracking-wider">
              SAT practice: Question {currentQIdx + 1} of {SAT_QUESTIONS.length}
            </span>
            <button
              onClick={handleNextQuestion}
              className="text-ares-red font-bold flex items-center gap-0.5 hover:text-white"
            >
              Skip Question <ChevronRight size={14} />
            </button>
          </div>

          <p className="text-sm font-semibold text-white leading-relaxed">
            {SAT_QUESTIONS[currentQIdx].text}
          </p>

          <div className="grid grid-cols-1 gap-2">
            {SAT_QUESTIONS[currentQIdx].options.map((opt, idx) => {
              const isSelected = selectedOpt === idx;
              const isCorrect = idx === SAT_QUESTIONS[currentQIdx].correctIdx;

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

          {isAnswered && (
            <div className="bg-obsidian-darker border border-white/10 p-3.5 rounded-lg text-xs leading-relaxed transition-all">
              <div className="flex items-center gap-1.5 font-bold text-ares-gold mb-1">
                <CheckCircle2 size={12} />
                <span>STEP-BY-STEP EXPLANATION</span>
              </div>
              <p className="text-marble/95 leading-relaxed">
                {SAT_QUESTIONS[currentQIdx].explanation}
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
