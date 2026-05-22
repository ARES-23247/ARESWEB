/** @sim {"name": "SAT Prep: Exponential Functions", "requiresContext": false} */
import React, { useState } from 'react';
import { RefreshCw, CheckCircle2, XCircle, ChevronRight, Sparkles, TrendingUp, TrendingDown } from 'lucide-react';

interface Question {
  id: number;
  text: string;
  options: string[];
  correctIdx: number;
  explanation: string;
  a: number;
  b: number;
  mode: 'growth' | 'decay';
  highlightX?: number;
}

const SAT_QUESTIONS: Question[] = [
  {
    id: 1,
    text: "A robotics startup designs a tracking sensor whose signal power, in milliwatts, is modeled by the function P(t) = 8.0(0.75)^t, where t is the distance in meters from the receiver. Which of the following is the best interpretation of the value 8.0 in this context?",
    options: [
      "The signal power decreases by 8.0 milliwatts per meter.",
      "The initial signal power at a distance of 0 meters is 8.0 milliwatts.",
      "The sensor signal power reaches 0 milliwatts at a distance of 8.0 meters.",
      "The signal power decreases by 80% for every 1 meter of distance."
    ],
    correctIdx: 1,
    explanation: "In an exponential function of the form y = a(b)^x, the constant 'a' represents the initial value when x = 0. Substituting t = 0 into P(t) = 8.0(0.75)^0 yields P(0) = 8.0 * 1 = 8.0 milliwatts. Therefore, the value 8.0 represents the initial signal power at 0 meters.",
    a: 8.0,
    b: 0.75,
    mode: 'decay',
    highlightX: 0
  },
  {
    id: 2,
    text: "The temperature of a high-torque motor during cooling is modeled by the exponential decay function T(t) = 6.0(0.5)^t + 20, where T is the temperature in degrees Celsius above room temperature after t minutes. By what percentage does the motor temperature excess decrease each minute?",
    options: [
      "5%",
      "20%",
      "50%",
      "95%"
    ],
    correctIdx: 2,
    explanation: "For an exponential function y = a(b)^x, the value 'b' is the multiplier. Here, b = 0.5. Since b = 1 - r, where r is the rate of decay, we have 0.5 = 1 - r, which means r = 0.5 or 50%. The motor temperature excess decreases by 50% each minute.",
    a: 6.0,
    b: 0.5,
    mode: 'decay',
    highlightX: 2
  },
  {
    id: 3,
    text: "The number of active teams in a regional robotics league has grown exponentially since 2020. The function N(t) = 1.5(1.4)^t models the number of teams (in hundreds) t years after 2020. Which of the following best describes the growth rate of the league?",
    options: [
      "The number of teams increases by 1.5% each year.",
      "The number of teams increases by 40% each year.",
      "The number of teams increases by exactly 140 teams each year.",
      "The league adds 150 teams every 4 years."
    ],
    correctIdx: 1,
    explanation: "The exponential growth function is N(t) = a(b)^t where b = 1 + r. Here, b = 1.4, which means 1.4 = 1 + r => r = 0.4, or a 40% growth rate. Thus, the number of teams in the league increases by 40% each year.",
    a: 1.5,
    b: 1.4,
    mode: 'growth',
    highlightX: 3
  }
];

interface Preset {
  name: string;
  desc: string;
  a: number;
  b: number;
  mode: 'growth' | 'decay';
  xLabel: string;
  yLabel: string;
}

const PRESET_SYSTEMS: Record<string, Preset> = {
  standard_growth: {
    name: "General Exponential Growth",
    desc: "Demonstrates compound expansion where the quantity multiplies by a factor greater than 1 at each interval.",
    a: 2.0,
    b: 1.5,
    mode: 'growth',
    xLabel: "Time (x)",
    yLabel: "Quantity (y)"
  },
  standard_decay: {
    name: "General Exponential Decay",
    desc: "Demonstrates rapid decay where the quantity is multiplied by a fraction between 0 and 1 at each step.",
    a: 8.0,
    b: 0.5,
    mode: 'decay',
    xLabel: "Interval (x)",
    yLabel: "Quantity (y)"
  },
  motor_cooling: {
    name: "Motor Thermal Dissipation",
    desc: "Models how motor heat excess dissipates exponentially after run cycles (Newton's Law of Cooling decay).",
    a: 7.0,
    b: 0.6,
    mode: 'decay',
    xLabel: "Time (minutes)",
    yLabel: "Temp Above Ambient (°C)"
  },
  league_expansion: {
    name: "Robotics League Growth",
    desc: "Models compounding league signup expansion with a constant annual growth multiplier.",
    a: 1.2,
    b: 1.4,
    mode: 'growth',
    xLabel: "Years from start",
    yLabel: "Teams (hundreds)"
  }
};

export default function SatExponentialSim() {
  const [selectedPreset, setSelectedPreset] = useState<string>('standard_growth');
  
  // Exponential parameters: y = a * b^x
  const [coeffA, setCoeffA] = useState<number>(2.0); // Initial value
  const [coeffB, setCoeffB] = useState<number>(1.5); // Base factor
  const [mode, setMode] = useState<'growth' | 'decay'>('growth');

  // Interactive tester pointer X coordinate
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

  // Scales mapping data [0, 8] to screen
  const xScale = (xVal: number) => {
    return paddingLeft + (xVal / 8) * (width - paddingLeft - paddingRight);
  };

  const yScale = (yVal: number) => {
    return height - paddingBottom - (yVal / 10) * (height - paddingTop - paddingBottom);
  };

  const xInverse = (screenX: number) => {
    const dataX = ((screenX - paddingLeft) / (width - paddingLeft - paddingRight)) * 8;
    return Math.max(0, Math.min(8, Math.round(dataX * 10) / 10));
  };

  const handlePresetChange = (presetKey: string) => {
    setSelectedPreset(presetKey);
    const p = PRESET_SYSTEMS[presetKey];
    setCoeffA(p.a);
    setCoeffB(p.b);
    setMode(p.mode);
    setHoverX(2.0);
    setSelectedOpt(null);
    setIsAnswered(false);

    // Sync quiz if appropriate
    const quizIdx = SAT_QUESTIONS.findIndex(q => q.a === p.a && q.b === p.b);
    if (quizIdx !== -1) {
      setCurrentQIdx(quizIdx);
    }
  };

  const handleReset = () => {
    const p = PRESET_SYSTEMS[selectedPreset];
    setCoeffA(p.a);
    setCoeffB(p.b);
    setMode(p.mode);
    setHoverX(2.0);
    setSelectedOpt(null);
    setIsAnswered(false);
  };

  // SVG Pointer move handler for dynamic coordinate readout
  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const scaledX = (clientX / rect.width) * width;
    const newX = xInverse(scaledX);
    setHoverX(newX);
  };

  // Exponential value calculation
  const getYValue = (xVal: number, aVal: number, bVal: number) => {
    const yVal = aVal * Math.pow(bVal, xVal);
    return Math.max(0, Math.min(12, yVal)); // clamp ceiling
  };

  // Generate SVG Path coordinates
  const generateCurvePath = () => {
    const points: string[] = [];
    const steps = 40;
    for (let i = 0; i <= steps; i++) {
      const xVal = (i / steps) * 8;
      const yVal = getYValue(xVal, coeffA, coeffB);
      points.push(`${xScale(xVal).toFixed(1)},${yScale(yVal).toFixed(1)}`);
    }
    return `M ${points.join(' L ')}`;
  };

  // Compare linear equation: same initial value, matching standard linear rate
  const generateLinearPath = () => {
    // Linear matches rate at x = 0 and x = 4
    const y0 = coeffA;
    const y4 = getYValue(4, coeffA, coeffB);
    const slope = (y4 - y0) / 4;

    const points: string[] = [];
    for (let xVal = 0; xVal <= 8; xVal += 0.5) {
      const yVal = Math.max(0, y0 + slope * xVal);
      points.push(`${xScale(xVal).toFixed(1)},${yScale(yVal).toFixed(1)}`);
    }
    return `M ${points.join(' L ')}`;
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
    setCoeffA(q.a);
    setCoeffB(q.b);
    setMode(q.mode);
    setHoverX(q.highlightX ?? 2.0);
    setSelectedOpt(null);
    setIsAnswered(false);
  };

  const gridTicksX = [0, 1, 2, 3, 4, 5, 6, 7, 8];
  const gridTicksY = [0, 2, 4, 6, 8, 10];

  const currentY = getYValue(hoverX, coeffA, coeffB);
  
  return (
    <div className="sim-container flex flex-col gap-6 p-4 sm:p-6 text-ares-offwhite bg-ares-gray-deep/40 rounded-xl border border-white/5 max-w-2xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-white/5 pb-4">
        <div>
          <span className="font-heading font-black text-ares-gold uppercase tracking-wider text-xs block mb-1">
            ARES Academy Math Prep
          </span>
          <h2 className="text-xl font-bold font-heading text-white flex items-center gap-2">
            {mode === 'growth' ? (
              <TrendingUp size={20} className="text-emerald-400" />
            ) : (
              <TrendingDown size={20} className="text-ares-red" />
            )}
            Exponential Functions & Slopes
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
        {Object.entries(PRESET_SYSTEMS).map(([key, preset]) => (
          <button
            key={key}
            onClick={() => handlePresetChange(key)}
            className={`text-[10px] sm:text-xs font-bold py-2 rounded transition-all text-center ${
              selectedPreset === key
                ? 'bg-ares-red text-white font-black shadow-md'
                : 'text-ares-muted hover:text-white hover:bg-white/5'
            }`}
          >
            {preset.name.split(' ')[0]}
          </button>
        ))}
      </div>

      {/* Description info */}
      <div className="bg-obsidian/20 border border-white/5 p-3 rounded-lg text-xs leading-relaxed text-marble/90">
        <p>{PRESET_SYSTEMS[selectedPreset].desc}</p>
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
            {/* Grid ticks */}
            {gridTicksX.map(tick => {
              const xPos = xScale(tick);
              return (
                <g key={`x-${tick}`}>
                  <line
                    x1={xPos}
                    y1={paddingTop}
                    x2={xPos}
                    y2={height - paddingBottom}
                    stroke={tick === 0 ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.06)'}
                    strokeWidth={tick === 0 ? '2' : '1'}
                  />
                  <text
                    x={xPos}
                    y={height - paddingBottom + 16}
                    fill="rgba(255,255,255,0.4)"
                    fontSize="9"
                    fontFamily="monospace"
                    textAnchor="middle"
                  >
                    {tick}
                  </text>
                </g>
              );
            })}

            {gridTicksY.map(tick => {
              const yPos = yScale(tick);
              return (
                <g key={`y-${tick}`}>
                  <line
                    x1={paddingLeft}
                    y1={yPos}
                    x2={width - paddingRight}
                    y2={yPos}
                    stroke={tick === 0 ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.06)'}
                    strokeWidth={tick === 0 ? '2' : '1'}
                  />
                  <text
                    x={paddingLeft - 10}
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

            {/* Linear Reference Comparison (dashed) */}
            <path
              d={generateLinearPath()}
              fill="none"
              stroke="#CD7F32"
              strokeWidth="2.0"
              strokeDasharray="4,4"
              opacity="0.5"
            />

            {/* Exponential Curve (Glowing red/emerald) */}
            <path
              d={generateCurvePath()}
              fill="none"
              stroke={mode === 'growth' ? '#10B981' : '#FF4F4F'}
              strokeWidth="3.5"
              strokeLinecap="round"
              className="drop-shadow-[0_0_3px_rgba(16,185,129,0.3)]"
            />

            {/* Active coordinates tracking helpers */}
            <g>
              <line
                x1={xScale(hoverX)}
                y1={yScale(0)}
                x2={xScale(hoverX)}
                y2={yScale(currentY)}
                stroke="#FFB81C"
                strokeWidth="1.5"
                strokeDasharray="3,3"
              />
              <line
                x1={paddingLeft}
                y1={yScale(currentY)}
                x2={xScale(hoverX)}
                y2={yScale(currentY)}
                stroke="#FFB81C"
                strokeWidth="1.5"
                strokeDasharray="3,3"
              />
              <circle cx={xScale(hoverX)} cy={yScale(currentY)} r="5.5" fill="#FFB81C" />
            </g>

            {/* Axes titles */}
            <text
              transform={`translate(14, ${height / 2}) rotate(-90)`}
              fill="rgba(255,255,255,0.5)"
              fontSize="9.5"
              fontWeight="bold"
              textAnchor="middle"
            >
              {PRESET_SYSTEMS[selectedPreset].yLabel}
            </text>
            <text
              x={width / 2 + 10}
              y={height - 8}
              fill="rgba(255,255,255,0.5)"
              fontSize="9.5"
              fontWeight="bold"
              textAnchor="middle"
            >
              {PRESET_SYSTEMS[selectedPreset].xLabel}
            </text>
          </svg>
        </div>

        {/* Adjustments & Formulas Panel */}
        <div className="w-full flex flex-col gap-4">
          <span className="text-[10px] text-ares-muted font-bold tracking-wider uppercase">Live Model Adjustments</span>

          {/* Equation display */}
          <div className="bg-obsidian-surface/60 border border-white/5 p-3 rounded-lg flex flex-col gap-1">
            <span className="text-[9px] text-ares-muted font-bold">MATHEMATICAL FUNCTION</span>
            <div className="text-base font-monospace font-black text-white">
              {"y = "}{coeffA.toFixed(2)}{" * ("}{coeffB.toFixed(2)}{")^x"}
            </div>
            <span className="text-[9.5px] text-marble/75 leading-tight mt-1">
              At $x = 0$, $y = {coeffA.toFixed(2)}$. Each $+1$ increase in $x$ multiplies $y$ by a factor of ${coeffB.toFixed(2)}$ ({mode === 'growth' ? `+${Math.round((coeffB - 1) * 100)}%` : `-${Math.round((1 - coeffB) * 100)}%`} rate).
            </span>
          </div>

          {/* Real-time coordinates readout */}
          <div className="bg-obsidian-surface/60 border border-white/5 p-3 rounded-lg flex justify-between items-center text-xs">
            <div>
              <span className="text-[9px] text-ares-muted font-bold block">TRACKED POINT</span>
              <span className="font-monospace text-white font-bold">({hoverX.toFixed(1)}, {currentY.toFixed(2)})</span>
            </div>
            <div className="text-right">
              <span className="text-[9px] text-ares-muted font-bold block">RATE OF CHANGE</span>
              <span className={`font-semibold ${mode === 'growth' ? 'text-emerald-400' : 'text-red-400'}`}>
                {mode === 'growth' ? 'Compounding Growth' : 'Exponential Decay'}
              </span>
            </div>
          </div>

          {/* Sliders */}
          <div className="flex flex-col gap-3 bg-obsidian-darker p-3 rounded-lg border border-white/5 text-xs">
            <div className="flex flex-col gap-1">
              <div className="flex justify-between font-bold">
                <span className="text-ares-gold">Initial Value (a)</span>
                <span className="text-white">{coeffA.toFixed(1)}</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="8.0"
                step="0.1"
                value={coeffA}
                onChange={e => setCoeffA(parseFloat(e.target.value))}
                className="w-full accent-ares-red"
              />
            </div>

            <div className="flex flex-col gap-1">
              <div className="flex justify-between font-bold">
                <span className="text-ares-gold">Growth/Decay Factor (b)</span>
                <span className="text-white">{coeffB.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="2.5"
                step="0.05"
                value={coeffB}
                onChange={e => {
                  const val = parseFloat(e.target.value);
                  setCoeffB(val);
                  setMode(val >= 1.0 ? 'growth' : 'decay');
                }}
                className="w-full accent-ares-red"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Tip Block */}
      <div className="w-full bg-obsidian-darker/60 border border-white/10 p-3 rounded-lg text-xs leading-relaxed">
        <span className="text-ares-gold text-[10px] uppercase font-bold tracking-wider mb-1 block flex items-center gap-1">
          <Sparkles size={12} />
          dSAT Strategy: Linear vs. Exponential
        </span>
        <p className="text-marble/85">
          Linear models grow/decay by a **constant amount** per unit time (represented by the dashed bronze line). Exponential models grow/decay by a **constant percentage multiplier** per unit time. Look for terms like &quot;increases by 5% every hour&quot; (exponential) vs &quot;increases by 5 teams every hour&quot; (linear).
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
