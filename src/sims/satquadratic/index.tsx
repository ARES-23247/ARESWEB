/** @sim {"name": "SAT Prep: Parabolas & Quadratics", "requiresContext": false} */
import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, CheckCircle2, XCircle, Info, ChevronRight } from 'lucide-react';

interface Question {
  id: number;
  text: string;
  options: string[];
  correctIdx: number;
  explanation: string;
  setupParams: { form: 'vertex' | 'factored' | 'standard'; a: number; h: number; k: number; r1?: number; r2?: number; b?: number; c?: number };
}

const SAT_QUESTIONS: Question[] = [
  {
    id: 1,
    text: "The graph of y = (x - 3)² - 4 is a parabola in the xy-plane. What are the coordinates of the vertex of this parabola?",
    options: ["(3, 4)", "(3, -4)", "(-3, -4)", "(3, 2)"],
    correctIdx: 1,
    explanation: "The vertex form of a quadratic equation is y = a(x - h)² + k, where the vertex is located at (h, k). In this equation, h = 3 and k = -4. Therefore, the vertex of the parabola is (3, -4).",
    setupParams: { form: 'vertex', a: 1, h: 3, k: -4 }
  },
  {
    id: 2,
    text: "For what value of c does the quadratic equation y = x² - 6x + c intersect the x-axis at exactly one point?",
    options: ["c = 0", "c = 3", "c = 9", "c = -9"],
    correctIdx: 2,
    explanation: "A parabola intersects the x-axis at exactly one point when its discriminant (b² - 4ac) is exactly equal to 0. In the equation y = x² - 6x + c, a = 1 and b = -6. Setting the discriminant to 0: (-6)² - 4(1)(c) = 0 => 36 - 4c = 0 => 4c = 36 => c = 9. In this state, the parabola is y = (x - 3)², resting its vertex at (3, 0).",
    setupParams: { form: 'standard', a: 1, h: 3, k: 0, b: -6, c: 9 }
  },
  {
    id: 3,
    text: "The equation of a parabola is y = -(x + 2)(x - 4). What are the x-intercepts (roots) of this parabola?",
    options: ["(-2, 0) and (4, 0)", "(2, 0) and (-4, 0)", "(2, 0) and (4, 0)", "(-2, 0) and (-4, 0)"],
    correctIdx: 0,
    explanation: "The factored form of a parabola is y = a(x - r1)(x - r2), where the roots (x-intercepts) occur at (r1, 0) and (r2, 0). Here, the terms are (x + 2), which implies r1 = -2, and (x - 4), which implies r2 = 4. Thus, the x-intercepts are (-2, 0) and (4, 0). The vertex lies at the midpoint x = 1.",
    setupParams: { form: 'factored', a: -1, h: 1, k: 9, r1: -2, r2: 4 }
  }
];

export default function SatQuadraticSim() {
  const [activeForm, setActiveForm] = useState<'vertex' | 'factored' | 'standard'>('vertex');

  // Coefficients & parameters
  const [coeffA, setCoeffA] = useState<number>(1); // stretch
  const [vH, setVH] = useState<number>(2); // vertex X (h)
  const [vK, setVK] = useState<number>(-3); // vertex Y (k)

  const [root1, setRoot1] = useState<number>(-2); // factored root 1
  const [root2, setRoot2] = useState<number>(4); // factored root 2

  const [stdB, setStdB] = useState<number>(-4); // standard b
  const [stdC, setStdC] = useState<number>(1); // standard c

  // Drag handles X & Y grid target active states
  const [activeDrag, setActiveDrag] = useState<'vertex' | 'root1' | 'root2' | null>(null);

  // SAT practice quiz states
  const [currentQIdx, setCurrentQIdx] = useState<number>(0);
  const [selectedOpt, setSelectedOpt] = useState<number | null>(null);
  const [isAnswered, setIsAnswered] = useState<boolean>(false);

  // SVG coordinate configuration mapping
  const canvasWidth = 360;
  const canvasHeight = 360;
  const cx = 180; // center origin
  const cy = 180;
  const scale = 16; // 16 pixels per 1 unit on grid [-10, 10]

  // Coordinate conversion helpers
  const toCanvasX = (gx: number) => cx + gx * scale;
  const toCanvasY = (gy: number) => cy - gy * scale; // Invert Y
  const toGridX = (cxVal: number) => (cxVal - cx) / scale;
  const toGridY = (cyVal: number) => (cy - cyVal) / scale;

  // Sync representations depending on active form
  const getDerivedEquations = useCallback(() => {
    let a: number, h: number, k: number, r1: number, r2: number, b: number, c: number;

    if (activeForm === 'vertex') {
      a = coeffA;
      h = vH;
      k = vK;
      // y = a(x - h)^2 + k = ax^2 - 2ahx + ah^2 + k
      b = -2 * a * h;
      c = a * h * h + k;
      // solve roots: a(x-h)^2 + k = 0 => (x-h)^2 = -k/a => x = h +- sqrt(-k/a)
      const rootTerm = -k / a;
      if (rootTerm >= 0) {
        r1 = h - Math.sqrt(rootTerm);
        r2 = h + Math.sqrt(rootTerm);
      } else {
        r1 = NaN;
        r2 = NaN;
      }
    } else if (activeForm === 'factored') {
      a = coeffA;
      r1 = root1;
      r2 = root2;
      // y = a(x - r1)(x - r2) = ax^2 - a(r1+r2)x + a*r1*r2
      h = (r1 + r2) / 2;
      k = -a * ((r1 - r2) / 2) * ((r1 - r2) / 2);
      b = -a * (r1 + r2);
      c = a * r1 * r2;
    } else {
      // standard: y = ax^2 + bx + c
      a = coeffA;
      b = stdB;
      c = stdC;
      // vertex: h = -b/(2a), k = c - b^2/(4a)
      h = -b / (2 * a);
      k = c - (b * b) / (4 * a);
      // roots
      const discriminant = b * b - 4 * a * c;
      if (discriminant >= 0) {
        r1 = (-b - Math.sqrt(discriminant)) / (2 * a);
        r2 = (-b + Math.sqrt(discriminant)) / (2 * a);
      } else {
        r1 = NaN;
        r2 = NaN;
      }
    }

    return { a, h, k, r1, r2, b, c };
  }, [activeForm, coeffA, vH, vK, root1, root2, stdB, stdC]);

  const derived = getDerivedEquations();

  // Pointer dragging handler
  const handlePointerMove = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    if (!activeDrag) return;

    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;

    const viewX = (clientX / rect.width) * canvasWidth;
    const viewY = (clientY / rect.height) * canvasHeight;

    let gx = Math.round(toGridX(viewX));
    let gy = Math.round(toGridY(viewY));

    // Clamps
    gx = Math.max(-10, Math.min(10, gx));
    gy = Math.max(-10, Math.min(10, gy));

    if (activeDrag === 'vertex') {
      setVH(gx);
      setVK(gy);
    } else if (activeDrag === 'root1') {
      setRoot1(gx);
    } else if (activeDrag === 'root2') {
      setRoot2(gx);
    }
  }, [activeDrag]);

  useEffect(() => {
    const handleGlobalPointerUp = () => {
      setActiveDrag(null);
    };
    window.addEventListener('pointerup', handleGlobalPointerUp);
    return () => window.removeEventListener('pointerup', handleGlobalPointerUp);
  }, []);

  const handleReset = () => {
    setCoeffA(1);
    setVH(2);
    setVK(-3);
    setRoot1(-2);
    setRoot2(4);
    setStdB(-4);
    setStdC(1);
    setSelectedOpt(null);
    setIsAnswered(false);
  };

  const handleFormChange = (form: 'vertex' | 'factored' | 'standard') => {
    setActiveForm(form);
    setSelectedOpt(null);
    setIsAnswered(false);
  };

  const applyQuestionSetup = (q: Question) => {
    setActiveForm(q.setupParams.form);
    setCoeffA(q.setupParams.a);
    if (q.setupParams.form === 'vertex') {
      setVH(q.setupParams.h);
      setVK(q.setupParams.k);
    } else if (q.setupParams.form === 'factored') {
      setRoot1(q.setupParams.r1 ?? -2);
      setRoot2(q.setupParams.r2 ?? 4);
    } else {
      setStdB(q.setupParams.b ?? -6);
      setStdC(q.setupParams.c ?? 9);
    }
    setSelectedOpt(null);
    setIsAnswered(false);
  };

  const handleAnswerSubmit = (idx: number) => {
    if (isAnswered) return;
    setSelectedOpt(idx);
    setIsAnswered(true);
  };

  const handleNextQuestion = () => {
    const nextIdx = (currentQIdx + 1) % SAT_QUESTIONS.length;
    setCurrentQIdx(nextIdx);
    applyQuestionSetup(SAT_QUESTIONS[nextIdx]);
  };

  // Generate SVG path for the Parabola curve
  const generateParabolaPath = () => {
    const points: string[] = [];
    const step = 0.2;
    for (let xVal = -11; xVal <= 11; xVal += step) {
      // y = a*(x-h)^2 + k
      const yVal = derived.a * (xVal - derived.h) * (xVal - derived.h) + derived.k;
      // Scale coordinates to viewport grid
      const px = toCanvasX(xVal);
      const py = toCanvasY(yVal);
      // only record points inside bounds
      if (py >= -20 && py <= canvasHeight + 20) {
        points.push(`${px.toFixed(1)},${py.toFixed(1)}`);
      }
    }
    if (points.length === 0) return '';
    return `M ${points.join(' L ')}`;
  };

  // Compute Discriminant
  const discriminant = derived.b * derived.b - 4 * derived.a * derived.c;

  return (
    <div className="sim-container flex flex-col gap-6 p-4 sm:p-6 text-ares-offwhite bg-ares-gray-deep/40 rounded-xl border border-white/5 max-w-2xl mx-auto w-full">
      
      {/* Header Selector */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-white/5 pb-4">
        <div>
          <span className="font-heading font-black text-ares-gold uppercase tracking-wider text-xs block mb-1">
            ARES Academy Math Prep
          </span>
          <h2 className="text-xl font-bold font-heading text-white">Parabolas & Quadratic Forms</h2>
        </div>
        
        {/* Form Selector Tabs */}
        <div className="flex gap-1 bg-obsidian-darker p-1 rounded-lg border border-white/5 w-full sm:w-auto">
          <button
            onClick={() => handleFormChange('vertex')}
            className={`flex-1 sm:flex-none text-xs font-bold px-3 py-1.5 rounded transition-all ${
              activeForm === 'vertex'
                ? 'bg-ares-red text-white'
                : 'text-ares-muted hover:text-white hover:bg-white/5'
            }`}
          >
            Vertex Form
          </button>
          <button
            onClick={() => handleFormChange('factored')}
            className={`flex-1 sm:flex-none text-xs font-bold px-3 py-1.5 rounded transition-all ${
              activeForm === 'factored'
                ? 'bg-ares-red text-white'
                : 'text-ares-muted hover:text-white hover:bg-white/5'
            }`}
          >
            Factored Form
          </button>
          <button
            onClick={() => handleFormChange('standard')}
            className={`flex-1 sm:flex-none text-xs font-bold px-3 py-1.5 rounded transition-all ${
              activeForm === 'standard'
                ? 'bg-ares-red text-white'
                : 'text-ares-muted hover:text-white hover:bg-white/5'
            }`}
          >
            Standard Form
          </button>
        </div>
      </div>

      {/* Main Workspace split vertically */}
      <div className="w-full flex flex-col items-center gap-4 bg-obsidian/40 p-4 rounded-xl border border-white/5 relative">
        <div className="w-full flex justify-between items-center text-xs text-ares-muted">
          <div className="flex items-center gap-1.5">
            <Info size={12} className="text-ares-gold" />
            <span>
              {activeForm === 'vertex'
                ? 'Drag vertex coordinates directly on the grid'
                : activeForm === 'factored'
                ? 'Drag the root markers along the X-axis'
                : 'Adjust coefficients standard form inputs below'}
            </span>
          </div>
          <button
            onClick={handleReset}
            className="text-ares-red hover:text-white hover:bg-ares-red/10 px-2 py-0.5 rounded font-bold flex items-center gap-1 transition-all"
          >
            <RefreshCw size={10} /> RESET
          </button>
        </div>

        {/* 2D Coordinate Grid */}
        <div className="relative bg-obsidian-darker p-3 rounded-lg border border-white/10 shadow-2xl max-w-full overflow-hidden w-full flex justify-center">
          <svg
            width="360"
            height="360"
            viewBox="0 0 360 360"
            onPointerMove={handlePointerMove}
            className="w-full max-w-[360px] h-auto select-none touch-none"
          >
            {/* Grid Line increments (every 2 units) */}
            {[-8, -6, -4, -2, 2, 4, 6, 8].map(gVal => {
              const px = toCanvasX(gVal);
              const py = toCanvasY(gVal);
              return (
                <g key={gVal} opacity="0.12">
                  <line x1={px} y1="0" x2={px} y2={canvasHeight} stroke="#ffffff" strokeWidth="0.8" />
                  <line x1="0" y1={py} x2={canvasWidth} y2={py} stroke="#ffffff" strokeWidth="0.8" />
                </g>
              );
            })}

            {/* Central X & Y Axis */}
            <line x1="0" y1={cy} x2={canvasWidth} y2={cy} stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" />
            <line x1={cx} y1="0" x2={cx} y2={canvasHeight} stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" />

            {/* Axis Arrows */}
            <text x="352" y={cy - 4} fill="rgba(255,255,255,0.5)" fontSize="9" fontFamily="monospace">x</text>
            <text x={cx + 6} y="14" fill="rgba(255,255,255,0.5)" fontSize="9" fontFamily="monospace">y</text>

            {/* Axis Numeric markers */}
            <text x={toCanvasX(5)} y={cy + 12} fill="rgba(255,255,255,0.3)" fontSize="8" textAnchor="middle">5</text>
            <text x={toCanvasX(-5)} y={cy + 12} fill="rgba(255,255,255,0.3)" fontSize="8" textAnchor="middle">-5</text>
            <text x={cx + 6} y={toCanvasY(5) + 3} fill="rgba(255,255,255,0.3)" fontSize="8">5</text>
            <text x={cx + 6} y={toCanvasY(-5) + 3} fill="rgba(255,255,255,0.3)" fontSize="8">-5</text>

            {/* Parabola Curve Outline (Glowing gold) */}
            <path
              d={generateParabolaPath()}
              fill="none"
              stroke="#FFB81C"
              strokeWidth="3.5"
              strokeLinecap="round"
            />

            {/* Axis of Symmetry (Bronze dashed line) */}
            {activeForm !== 'factored' && (
              <line
                x1={toCanvasX(derived.h)}
                y1="0"
                x2={toCanvasX(derived.h)}
                y2={canvasHeight}
                stroke="#CD7F32"
                strokeWidth="1.5"
                strokeDasharray="4,4"
                opacity="0.6"
              />
            )}

            {/* Render Draggable Handles based on mode */}
            {activeForm === 'vertex' && (
              <>
                {/* Vertex Handle */}
                <circle
                  cx={toCanvasX(derived.h)}
                  cy={toCanvasY(derived.k)}
                  r="8"
                  fill="#C00000"
                  className="cursor-move hover:fill-white transition-colors"
                  onPointerDown={() => setActiveDrag('vertex')}
                />
                <circle cx={toCanvasX(derived.h)} cy={toCanvasY(derived.k)} r="3" fill="#1b1c1e" pointerEvents="none" />
                <text
                  x={toCanvasX(derived.h)}
                  y={toCanvasY(derived.k) - 14}
                  fill="#ffffff"
                  fontSize="10"
                  fontWeight="bold"
                  fontFamily="sans-serif"
                  textAnchor="middle"
                  pointerEvents="none"
                >
                  V({derived.h}, {derived.k})
                </text>
              </>
            )}

            {activeForm === 'factored' && (
              <>
                {/* Root 1 Marker */}
                <circle
                  cx={toCanvasX(root1)}
                  cy={cy}
                  r="7"
                  fill="#C00000"
                  className="cursor-ew-resize hover:fill-white transition-colors"
                  onPointerDown={() => setActiveDrag('root1')}
                />
                <circle cx={toCanvasX(root1)} cy={cy} r="2.5" fill="#1b1c1e" pointerEvents="none" />
                <text x={toCanvasX(root1)} y={cy - 12} fill="#ffffff" fontSize="9" fontWeight="bold" textAnchor="middle">r1={root1}</text>

                {/* Root 2 Marker */}
                <circle
                  cx={toCanvasX(root2)}
                  cy={cy}
                  r="7"
                  fill="#C00000"
                  className="cursor-ew-resize hover:fill-white transition-colors"
                  onPointerDown={() => setActiveDrag('root2')}
                />
                <circle cx={toCanvasX(root2)} cy={cy} r="2.5" fill="#1b1c1e" pointerEvents="none" />
                <text x={toCanvasX(root2)} y={cy - 12} fill="#ffffff" fontSize="9" fontWeight="bold" textAnchor="middle">r2={root2}</text>
              </>
            )}
          </svg>
        </div>

        {/* Sliders and Equation Display */}
        <div className="w-full flex flex-col gap-4">
          
          {/* Sliders Container */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-obsidian-surface/60 p-4 rounded-lg border border-white/5 text-xs">
            {/* Stretching Slider A (Always active) */}
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between font-bold">
                <span className="text-ares-gold">Scaling Factor (a)</span>
                <span className="text-white">{coeffA.toFixed(1)}</span>
              </div>
              <input
                type="range"
                min="-3.0"
                max="3.0"
                step="0.1"
                value={coeffA}
                onChange={e => {
                  const val = parseFloat(e.target.value);
                  setCoeffA(val === 0 ? 0.1 : val);
                }}
                className="w-full accent-ares-red"
              />
            </div>

            {/* Standard Form Sliders B & C */}
            {activeForm === 'standard' && (
              <>
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between font-bold">
                    <span className="text-ares-gold">Coefficient (b)</span>
                    <span className="text-white">{stdB}</span>
                  </div>
                  <input
                    type="range"
                    min="-8"
                    max="8"
                    step="1"
                    value={stdB}
                    onChange={e => setStdB(parseInt(e.target.value))}
                    className="w-full accent-ares-red"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between font-bold">
                    <span className="text-ares-gold">Constant (c)</span>
                    <span className="text-white">{stdC}</span>
                  </div>
                  <input
                    type="range"
                    min="-8"
                    max="8"
                    step="1"
                    value={stdC}
                    onChange={e => setStdC(parseInt(e.target.value))}
                    className="w-full accent-ares-red"
                  />
                </div>
              </>
            )}
          </div>

          {/* Equation Display Box */}
          <div className="bg-obsidian-darker/60 border border-white/10 p-3 rounded-lg flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-semibold">
            <div className="flex flex-col gap-1">
              <span className="text-ares-muted text-[10px] uppercase font-bold tracking-wider">Current Equation</span>
              <span className="text-sm font-heading font-black text-white">
                {activeForm === 'vertex' && `y = ${derived.a.toFixed(1)}(x - ${derived.h})² + (${derived.k})`}
                {activeForm === 'factored' && `y = ${derived.a.toFixed(1)}(x - ${derived.r1.toFixed(1)})(x - ${derived.r2.toFixed(1)})`}
                {activeForm === 'standard' && `y = ${derived.a.toFixed(1)}x² + (${derived.b.toFixed(1)})x + (${derived.c.toFixed(1)})`}
              </span>
            </div>
            
            {/* Discriminant Display */}
            <div className="bg-obsidian-surface border border-white/5 px-3 py-1.5 rounded text-right flex flex-col">
              <span className="text-ares-muted text-[9px] uppercase font-bold tracking-wider">Discriminant (b²-4ac)</span>
              <span className={`text-sm font-monospace font-black ${discriminant > 0 ? 'text-emerald-400' : discriminant === 0 ? 'text-ares-gold' : 'text-red-400'}`}>
                {discriminant.toFixed(1)}
              </span>
              <span className="text-[9px] text-marble/60">
                {discriminant > 0 && '2 Real Roots'}
                {discriminant === 0 && '1 Real Root'}
                {discriminant < 0 && '0 Real Roots'}
              </span>
            </div>
          </div>

          {/* SAT PRACTICE QUESTIONS CARD */}
          <div className="w-full flex flex-col gap-4 bg-obsidian-surface/60 border border-white/5 p-4 rounded-lg">
            <div className="flex justify-between items-center text-xs">
              <span className="font-bold text-ares-gold uppercase tracking-wider">
                SAT Question {currentQIdx + 1} of {SAT_QUESTIONS.length}
              </span>
              <button
                onClick={handleNextQuestion}
                className="text-ares-red font-bold flex items-center gap-1 hover:text-white"
              >
                Skip Question <ChevronRight size={14} />
              </button>
            </div>

            {/* Question Text */}
            <p className="text-sm font-semibold text-white leading-relaxed">
              {SAT_QUESTIONS[currentQIdx].text}
            </p>

            {/* Options list */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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
                    {isAnswered && isCorrect && <CheckCircle2 size={14} className="text-emerald-400" />}
                    {isAnswered && !isCorrect && isSelected && <XCircle size={14} className="text-red-400" />}
                  </button>
                );
              })}
            </div>

            {/* Explanation box */}
            {isAnswered && (
              <div className="bg-obsidian-darker border border-white/10 p-3.5 rounded-lg text-xs leading-relaxed">
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
                    Next Question <ChevronRight size={12} />
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
