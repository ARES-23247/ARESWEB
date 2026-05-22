/** @sim {"name": "SAT Prep: Solving Right Triangles", "requiresContext": false} */
import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, CheckCircle2, XCircle, Info, ChevronRight } from 'lucide-react';

interface Question {
  id: number;
  text: string;
  options: string[];
  correctIdx: number;
  explanation: string;
  setupTriangle: { a: number; b: number; hideA?: boolean; hideB?: boolean; hideC?: boolean; angleLabel?: string };
}

const SAT_QUESTIONS: Question[] = [
  {
    id: 1,
    text: "In right triangle ABC, angle C is 90° and sin(A) = 0.6. If the hypotenuse AB has a length of 15, what is the length of side BC (opposite to angle A)?",
    options: ["6", "9", "12", "10"],
    correctIdx: 1,
    explanation: "Recall that sin(A) = Opposite / Hypotenuse. Here, the side opposite to angle A is BC, and the hypotenuse is AB = 15. So, sin(A) = BC / AB => 0.6 = BC / 15. Solving for BC gives BC = 15 * 0.6 = 9.",
    setupTriangle: { a: 90, b: 120, hideA: false, hideB: true, hideC: false }
  },
  {
    id: 2,
    text: "In a 30°-60°-90° right triangle, the hypotenuse has a length of 12. What is the length of the side opposite the 60° angle?",
    options: ["6", "6√2", "6√3", "12√3"],
    correctIdx: 2,
    explanation: "In a 30°-60°-90° special right triangle, the side lengths are in the ratio x : x√3 : 2x. Since the hypotenuse is 2x = 12, the shorter leg (opposite 30°) is x = 6. The longer leg (opposite 60°) is x√3 = 6√3.",
    setupTriangle: { a: 104, b: 60 } // close to 30-60-90 (ratio ~ 1.73)
  },
  {
    id: 3,
    text: "In right triangle ABC, tan(A) = 3/4. If side AC (adjacent to angle A) is 8, what is the length of the hypotenuse AB?",
    options: ["6", "10", "12", "14"],
    correctIdx: 1,
    explanation: "Recall that tan(A) = Opposite / Adjacent = BC / AC = BC / 8. Since tan(A) = 3/4, we have BC / 8 = 3/4 => BC = 6. This is a classic 6-8-10 right triangle! Using the Pythagorean theorem, the hypotenuse AB = √(6² + 8²) = √(36 + 64) = √100 = 10.",
    setupTriangle: { a: 60, b: 80 }
  }
];

export default function SatTrianglesSim() {
  const [activeTab, setActiveTab] = useState<'sohcahtoa' | 'special' | 'satprep'>('sohcahtoa');
  const [sideA, setSideA] = useState<number>(80); // Height BC
  const [sideB, setSideB] = useState<number>(120); // Base AC
  
  // Dragging states
  const [activeDrag, setActiveDrag] = useState<'A' | 'B' | null>(null);

  // Special triangles states
  const [specialType, setSpecialType] = useState<'30-60-90' | '45-45-90'>('30-60-90');

  // SAT Prep Quiz states
  const [currentQIdx, setCurrentQIdx] = useState<number>(0);
  const [selectedOpt, setSelectedOpt] = useState<number | null>(null);
  const [isAnswered, setIsAnswered] = useState<boolean>(false);

  // Derive mathematical properties
  const hypotenuse = Math.sqrt(sideA * sideA + sideB * sideB);
  const angleARad = Math.atan2(sideA, sideB);

  // Viewport setup inside a 400x320 SVG viewport
  const cx = 320; // right angle C coordinate x
  const cy = 270; // right angle C coordinate y

  // Coordinates of triangle points
  // A is at (cx - sideB, cy)
  // B is at (cx, cy - sideA)
  // C is at (cx, cy)
  const ax = cx - sideB;
  const ay = cy;
  const bx = cx;
  const by = cy - sideA;

  // Reset function
  const handleReset = () => {
    setSideA(80);
    setSideB(120);
    setActiveDrag(null);
    setSelectedOpt(null);
    setIsAnswered(false);
  };

  // Switch tabs
  const handleTabChange = (tab: 'sohcahtoa' | 'special' | 'satprep') => {
    setActiveTab(tab);
    setSelectedOpt(null);
    setIsAnswered(false);

    if (tab === 'special') {
      applySpecialTriangle('30-60-90');
    } else if (tab === 'satprep') {
      applyQuestionSetup(SAT_QUESTIONS[currentQIdx]);
    } else {
      setSideA(80);
      setSideB(120);
    }
  };

  // Set up triangle for specific SAT questions
  const applyQuestionSetup = (q: Question) => {
    // scale to nice display values
    setSideA(q.setupTriangle.a);
    setSideB(q.setupTriangle.b);
    setSelectedOpt(null);
    setIsAnswered(false);
  };

  const applySpecialTriangle = (type: '30-60-90' | '45-45-90') => {
    setSpecialType(type);
    if (type === '30-60-90') {
      // ratio opposite to 30 deg is 1, adjacent is sqrt(3) ~ 1.732
      // base = 138, height = 80 -> angle is approx 30 deg
      setSideB(138);
      setSideA(80);
    } else {
      // 45-45-90 ratio is 1:1
      setSideB(100);
      setSideA(100);
    }
  };

  // Pointer dragging handler
  const handlePointerMove = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    if (!activeDrag || activeTab === 'special') return;

    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;

    // Scale to SVG viewport 400x320
    const viewX = (clientX / rect.width) * 400;
    const viewY = (clientY / rect.height) * 320;

    if (activeDrag === 'B') {
      // Drag B vertically (changes side A)
      const newSideA = Math.max(30, Math.min(220, cy - viewY));
      setSideA(Math.round(newSideA));
    } else if (activeDrag === 'A') {
      // Drag A horizontally (changes side B)
      const newSideB = Math.max(40, Math.min(270, cx - viewX));
      setSideB(Math.round(newSideB));
    }
  }, [activeDrag, activeTab]);

  useEffect(() => {
    const handleGlobalPointerUp = () => {
      setActiveDrag(null);
    };
    window.addEventListener('pointerup', handleGlobalPointerUp);
    return () => window.removeEventListener('pointerup', handleGlobalPointerUp);
  }, []);

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

  // Angle sector arc drawing helper
  const drawAngleArc = () => {
    const r = 25;
    // Angle A arc
    const startX = ax + r;
    const startY = ay;
    const endX = ax + Math.cos(angleARad) * r;
    const endY = ay - Math.sin(angleARad) * r;

    return (
      <path
        d={`M ${startX} ${startY} A ${r} ${r} 0 0 0 ${endX} ${endY}`}
        fill="rgba(192, 0, 0, 0.12)"
        stroke="#C00000"
        strokeWidth="1.5"
      />
    );
  };

  return (
    <div className="sim-container flex flex-col gap-6 p-4 sm:p-6 text-ares-offwhite bg-ares-gray-deep/40 rounded-xl border border-white/5 max-w-2xl mx-auto w-full">
      
      {/* Visual Header / Selector */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-white/5 pb-4">
        <div>
          <span className="font-heading font-black text-ares-gold uppercase tracking-wider text-xs block mb-1">
            ARES Academy Math Prep
          </span>
          <h2 className="text-xl font-bold font-heading text-white">Solving Triangles (SOH-CAH-TOA)</h2>
        </div>
        
        {/* Navigation Tabs */}
        <div className="flex gap-1 bg-obsidian-darker p-1 rounded-lg border border-white/5 w-full sm:w-auto">
          <button
            onClick={() => handleTabChange('sohcahtoa')}
            className={`flex-1 sm:flex-none text-xs font-bold px-3 py-1.5 rounded transition-all ${
              activeTab === 'sohcahtoa'
                ? 'bg-ares-red text-white'
                : 'text-ares-muted hover:text-white hover:bg-white/5'
            }`}
          >
            SOH-CAH-TOA
          </button>
          <button
            onClick={() => handleTabChange('special')}
            className={`flex-1 sm:flex-none text-xs font-bold px-3 py-1.5 rounded transition-all ${
              activeTab === 'special'
                ? 'bg-ares-red text-white'
                : 'text-ares-muted hover:text-white hover:bg-white/5'
            }`}
          >
            Special Triangles
          </button>
          <button
            onClick={() => handleTabChange('satprep')}
            className={`flex-1 sm:flex-none text-xs font-bold px-3 py-1.5 rounded transition-all ${
              activeTab === 'satprep'
                ? 'bg-ares-red text-white'
                : 'text-ares-muted hover:text-white hover:bg-white/5'
            }`}
          >
            SAT Prep Quiz
          </button>
        </div>
      </div>

      {/* Main Interactive Workspace */}
      <div className="w-full flex flex-col items-center gap-4 bg-obsidian/40 p-4 rounded-xl border border-white/5 relative">
        <div className="w-full flex justify-between items-center text-xs">
          <div className="flex items-center gap-1.5 text-ares-muted">
            <Info size={12} className="text-ares-gold" />
            <span>
              {activeTab === 'special'
                ? 'Special Right Triangle formulas and ratio overlays'
                : activeTab === 'satprep'
                ? 'Interactive SAT practice environment'
                : 'Drag handles A or B to adjust base and height'}
            </span>
          </div>
          {activeTab === 'sohcahtoa' && (
            <button
              onClick={handleReset}
              className="text-ares-red hover:text-white hover:bg-ares-red/10 px-2 py-0.5 rounded font-bold flex items-center gap-1 transition-all"
            >
              <RefreshCw size={10} /> RESET
            </button>
          )}
        </div>

        {/* Triangle Render Canvas */}
        <div className="relative bg-obsidian-darker p-3 rounded-lg border border-white/10 shadow-2xl max-w-full overflow-hidden w-full flex justify-center">
          <svg
            width="400"
            height="320"
            viewBox="0 0 400 320"
            onPointerMove={handlePointerMove}
            className="w-full max-w-[400px] h-auto select-none touch-none"
          >
            {/* Grid helper coordinates lines */}
            <line x1="40" y1={cy} x2="360" y2={cy} stroke="rgba(255,255,255,0.06)" strokeDasharray="3,3" />
            <line x1={cx} y1="30" x2={cx} y2="290" stroke="rgba(255,255,255,0.06)" strokeDasharray="3,3" />

            {/* Right Angle Indicator (C) */}
            <path
              d={`M ${cx - 12} ${cy} L ${cx - 12} ${cy - 12} L ${cx} ${cy - 12}`}
              fill="none"
              stroke="rgba(255, 255, 255, 0.25)"
              strokeWidth="1.5"
            />

            {/* Angle Sector (A) */}
            {drawAngleArc()}

            {/* Shaded Triangle Fill */}
            <polygon
              points={`${ax},${ay} ${bx},${by} ${cx},${cy}`}
              fill="rgba(192, 0, 0, 0.03)"
            />

            {/* Triangle Edges */}
            {/* Hypotenuse c (glowing white/bronze) */}
            <line x1={ax} y1={ay} x2={bx} y2={by} stroke="#CD7F32" strokeWidth="3" />
            
            {/* Opposite leg a (opposite to angle A) - Red */}
            <line x1={bx} y1={by} x2={cx} y2={cy} stroke="#C00000" strokeWidth="3" />

            {/* Adjacent leg b (adjacent to angle A) - Gold */}
            <line x1={ax} y1={ay} x2={cx} y2={cy} stroke="#FFB81C" strokeWidth="3" />

            {/* Text Labels for Vertices */}
            <text x={ax - 12} y={ay + 5} fill="#white" fontSize="12" fontWeight="bold" fontFamily="sans-serif">A</text>
            <text x={bx} y={by - 12} fill="#white" fontSize="12" fontWeight="bold" fontFamily="sans-serif" textAnchor="middle">B</text>
            <text x={cx + 10} y={cy + 10} fill="rgba(255,255,255,0.5)" fontSize="12" fontWeight="bold" fontFamily="sans-serif">C (90°)</text>

            {/* Reference Angle Label θ */}
            <text x={ax + 32} y={ay - 6} fill="#C00000" fontSize="10" fontWeight="bold" fontFamily="monospace">θ</text>

            {/* Side Length Labels & Dynamic values */}
            {/* Side a (height) */}
            <text
              x={cx + 12}
              y={(by + cy) / 2}
              fill="#C00000"
              fontSize="11"
              fontWeight="bold"
              fontFamily="monospace"
              alignmentBaseline="middle"
            >
              {activeTab === 'satprep' && SAT_QUESTIONS[currentQIdx].setupTriangle.hideA
                ? 'a = ?'
                : `a = ${(sideA / 10).toFixed(1)}`}
            </text>

            {/* Side b (base) */}
            <text
              x={(ax + cx) / 2}
              y={cy + 18}
              fill="#FFB81C"
              fontSize="11"
              fontWeight="bold"
              fontFamily="monospace"
              textAnchor="middle"
            >
              {activeTab === 'satprep' && SAT_QUESTIONS[currentQIdx].setupTriangle.hideB
                ? 'b = ?'
                : `b = ${(sideB / 10).toFixed(1)}`}
            </text>

            {/* Hypotenuse c */}
            <text
              x={(ax + bx) / 2 - 12}
              y={(ay + by) / 2 - 12}
              fill="#CD7F32"
              fontSize="11"
              fontWeight="bold"
              fontFamily="monospace"
              textAnchor="end"
            >
              {activeTab === 'satprep' && SAT_QUESTIONS[currentQIdx].setupTriangle.hideC
                ? 'c = ?'
                : `c = ${(hypotenuse / 10).toFixed(1)}`}
            </text>

            {/* Special Ratio Overlays (Snapping values visual guide) */}
            {activeTab === 'special' && (
              <g className="text-[10px] font-sans font-bold">
                {specialType === '30-60-90' ? (
                  <>
                    {/* Opposite 30 leg is x */}
                    <text x={cx - 50} y={(by + cy) / 2} fill="#ffffff" textAnchor="end">x (Short Leg)</text>
                    {/* Adjacent 60 leg is x√3 */}
                    <text x={(ax + cx) / 2} y={cy - 10} fill="#ffffff" textAnchor="middle">x√3 (Long Leg)</text>
                    {/* Hypotenuse is 2x */}
                    <text x={(ax + bx) / 2 + 15} y={(ay + by) / 2 + 15} fill="#ffffff">2x (Hypotenuse)</text>
                    {/* Top angle label 60° */}
                    <text x={bx - 20} y={by + 35} fill="#rgba(255,255,255,0.4)" fontSize="9">60°</text>
                    {/* Bottom angle label 30° */}
                    <text x={ax + 32} y={ay - 18} fill="#rgba(255,255,255,0.4)" fontSize="9">30°</text>
                  </>
                ) : (
                  <>
                    {/* 45 leg is x */}
                    <text x={cx - 40} y={(by + cy) / 2} fill="#ffffff" textAnchor="end">x</text>
                    {/* 45 leg is x */}
                    <text x={(ax + cx) / 2} y={cy - 10} fill="#ffffff" textAnchor="middle">x</text>
                    {/* Hypotenuse is x√2 */}
                    <text x={(ax + bx) / 2 + 15} y={(ay + by) / 2 + 15} fill="#ffffff">x√2</text>
                    {/* Angle labels */}
                    <text x={bx - 20} y={by + 35} fill="#rgba(255,255,255,0.4)" fontSize="9">45°</text>
                    <text x={ax + 32} y={ay - 18} fill="#rgba(255,255,255,0.4)" fontSize="9">45°</text>
                  </>
                )}
              </g>
            )}

            {/* Draggable Point Handles */}
            {activeTab !== 'special' && activeTab !== 'satprep' && (
              <>
                {/* Vertex A handle (Drags horizontally) */}
                <circle
                  cx={ax}
                  cy={ay}
                  r="8"
                  fill="#FFB81C"
                  className="cursor-ew-resize hover:fill-white transition-colors"
                  onPointerDown={() => setActiveDrag('A')}
                />
                <circle cx={ax} cy={ay} r="3" fill="#1b1c1e" pointerEvents="none" />

                {/* Vertex B handle (Drags vertically) */}
                <circle
                  cx={bx}
                  cy={by}
                  r="8"
                  fill="#C00000"
                  className="cursor-ns-resize hover:fill-white transition-colors"
                  onPointerDown={() => setActiveDrag('B')}
                />
                <circle cx={bx} cy={by} r="3" fill="#1b1c1e" pointerEvents="none" />
              </>
            )}
          </svg>
        </div>

        {/* Real-time Math Display based on Active Tab */}
        {activeTab === 'sohcahtoa' && (
          <div className="w-full grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* SINE */}
            <div className="bg-obsidian-surface/60 border border-white/5 p-3 rounded-lg flex flex-col items-center">
              <span className="text-xs text-ares-muted font-bold mb-1">SINE (SOH)</span>
              <span className="text-sm font-heading font-black text-ares-red">sin(θ) = Opp / Hyp</span>
              <div className="my-1.5 h-px bg-white/5 w-full" />
              <span className="text-xs font-monospace font-semibold text-white/90">
                {(sideA / 10).toFixed(1)} / {(hypotenuse / 10).toFixed(1)} = <span className="text-ares-red">{(sideA / hypotenuse).toFixed(3)}</span>
              </span>
            </div>

            {/* COSINE */}
            <div className="bg-obsidian-surface/60 border border-white/5 p-3 rounded-lg flex flex-col items-center">
              <span className="text-xs text-ares-muted font-bold mb-1">COSINE (CAH)</span>
              <span className="text-sm font-heading font-black text-ares-gold">cos(θ) = Adj / Hyp</span>
              <div className="my-1.5 h-px bg-white/5 w-full" />
              <span className="text-xs font-monospace font-semibold text-white/90">
                {(sideB / 10).toFixed(1)} / {(hypotenuse / 10).toFixed(1)} = <span className="text-ares-gold">{(sideB / hypotenuse).toFixed(3)}</span>
              </span>
            </div>

            {/* TANGENT */}
            <div className="bg-obsidian-surface/60 border border-white/5 p-3 rounded-lg flex flex-col items-center">
              <span className="text-xs text-ares-muted font-bold mb-1">TANGENT (TOA)</span>
              <span className="text-sm font-heading font-black text-ares-bronze">tan(θ) = Opp / Adj</span>
              <div className="my-1.5 h-px bg-white/5 w-full" />
              <span className="text-xs font-monospace font-semibold text-white/90">
                {(sideA / 10).toFixed(1)} / {(sideB / 10).toFixed(1)} = <span className="text-ares-bronze">{(sideA / sideB).toFixed(3)}</span>
              </span>
            </div>
          </div>
        )}

        {activeTab === 'special' && (
          <div className="w-full flex flex-col gap-3">
            {/* Special Selection Toggle */}
            <div className="flex gap-2 justify-center">
              <button
                onClick={() => applySpecialTriangle('30-60-90')}
                className={`text-xs font-bold px-3 py-1 rounded transition-all border ${
                  specialType === '30-60-90'
                    ? 'bg-white/10 text-ares-gold border-ares-gold/40'
                    : 'text-ares-muted border-white/5 hover:text-white'
                }`}
              >
                30°-60°-90° Triangle
              </button>
              <button
                onClick={() => applySpecialTriangle('45-45-90')}
                className={`text-xs font-bold px-3 py-1 rounded transition-all border ${
                  specialType === '45-45-90'
                    ? 'bg-white/10 text-ares-gold border-ares-gold/40'
                    : 'text-ares-muted border-white/5 hover:text-white'
                }`}
              >
                45°-45°-90° Triangle
              </button>
            </div>

            {/* Mathematical breakdowns */}
            <div className="bg-obsidian-surface/60 border border-white/5 p-4 rounded-lg flex flex-col gap-2 text-xs leading-relaxed text-marble/90">
              {specialType === '30-60-90' ? (
                <>
                  <p>
                    A <strong className="text-white">30°-60°-90° right triangle</strong> is formed by slicing an equilateral triangle down its center.
                  </p>
                  <ul className="list-disc list-inside flex flex-col gap-1 text-ares-muted">
                    <li>The shorter side (opposite 30°) has length <strong className="text-ares-red">x = 8.0</strong>.</li>
                    <li>The longer side (opposite 60°) has length <strong className="text-ares-gold">x√3 = 13.8</strong> (since 8 * 1.732 ≈ 13.8).</li>
                    <li>The hypotenuse is exactly double the short side: <strong className="text-ares-bronze">2x = 16.0</strong>.</li>
                  </ul>
                  <p className="border-t border-white/5 pt-2 mt-1 font-semibold text-white/90">
                    Trig Ratios: sin(30°) = 0.500 | cos(30°) = √3/2 ≈ 0.866 | tan(30°) = 1/√3 ≈ 0.577
                  </p>
                </>
              ) : (
                <>
                  <p>
                    A <strong className="text-white">45°-45°-90° right triangle</strong> is an isosceles right triangle formed by cutting a square diagonally.
                  </p>
                  <ul className="list-disc list-inside flex flex-col gap-1 text-ares-muted">
                    <li>The two perpendicular sides are identical: <strong className="text-ares-red">x = 10.0</strong>.</li>
                    <li>The hypotenuse is the side length times √2: <strong className="text-ares-bronze">x√2 = 14.1</strong> (since 10 * 1.414 ≈ 14.1).</li>
                  </ul>
                  <p className="border-t border-white/5 pt-2 mt-1 font-semibold text-white/90">
                    Trig Ratios: sin(45°) = 1/√2 ≈ 0.707 | cos(45°) = 1/√2 ≈ 0.707 | tan(45°) = 1.000
                  </p>
                </>
              )}
            </div>
          </div>
        )}

        {/* SAT PREP QUIZ CARD */}
        {activeTab === 'satprep' && (
          <div className="w-full flex flex-col gap-4 bg-obsidian-surface/60 border border-white/5 p-4 rounded-lg">
            <div className="flex justify-between items-center text-xs">
              <span className="font-bold text-ares-gold uppercase tracking-wider">
                Question {currentQIdx + 1} of {SAT_QUESTIONS.length}
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
        )}

      </div>
    </div>
  );
}
