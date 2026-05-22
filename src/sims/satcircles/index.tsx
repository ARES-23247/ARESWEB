/** @sim {"name": "Coordinate Circles & Sectors", "requiresContext": false} */
import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, CheckCircle2, XCircle, Info, ChevronRight } from 'lucide-react';

interface Question {
  id: number;
  text: string;
  options: string[];
  correctIdx: number;
  explanation: string;
  setupCircle: { h: number; k: number; r: number; theta?: number };
}

const QUIZ_QUESTIONS: Question[] = [
  {
    id: 1,
    text: "A circle in the xy-plane has equation x² + 8x + y² - 6y = 11. What is the length of the radius of this circle?",
    options: ["√11", "4", "5", "6"],
    correctIdx: 3,
    explanation: "Complete the square for both x and y terms: (x² + 8x + 16) + (y² - 6y + 9) = 11 + 16 + 9 => (x + 4)² + (y - 3)² = 36. Comparing this to the standard circle equation (x - h)² + (y - k)² = r², we find r² = 36, which means the radius r = √36 = 6. The center is (-4, 3).",
    setupCircle: { h: -4, k: 3, r: 6 }
  },
  {
    id: 2,
    text: "In a circle with center O, the radius is 6. If a central angle measures 120°, what is the area of the shaded sector formed by this angle?",
    options: ["2π", "4π", "6π", "12π"],
    correctIdx: 3,
    explanation: "The formula for the area of a sector is Area = π * r² * (θ / 360). Here, the radius r = 6, and the central angle θ = 120°. Substituting these: Area = π * 6² * (120 / 360) = π * 36 * (1 / 3) = 12π.",
    setupCircle: { h: 0, k: 0, r: 6, theta: 120 }
  },
  {
    id: 3,
    text: "A circle in the xy-plane has center (3, -2) and passes through the point (3, 2). What is the standard equation of this circle?",
    options: ["(x - 3)² + (y + 2)² = 4", "(x - 3)² + (y + 2)² = 16", "(x + 3)² + (y - 2)² = 16", "(x - 3)² + (y - 2)² = 16"],
    correctIdx: 1,
    explanation: "The standard circle equation is (x - h)² + (y - k)² = r² with center (h, k) = (3, -2). This gives (x - 3)² + (y + 2)² = r². The circle passes through (3, 2). The distance from the center (3, -2) to (3, 2) is the radius: r = √((3-3)² + (2 - (-2))²) = √(0 + 4²) = 4. Since r = 4, then r² = 16. So the equation is (x - 3)² + (y + 2)² = 16.",
    setupCircle: { h: 3, k: -2, r: 4 }
  }
];

export default function CirclesSim() {
  const [activeTab, setActiveTab] = useState<'equations' | 'sectors' | 'practice'>('equations');

  // Circle properties
  const [vH, setVH] = useState<number>(1); // Center H
  const [vK, setVK] = useState<number>(2); // Center K
  const [radius, setRadius] = useState<number>(4); // Radius R
  const [theta, setTheta] = useState<number>(90); // Sector angle

  // Dragging states
  const [activeDrag, setActiveDrag] = useState<'center' | 'circumference' | null>(null);

  // Practice quiz states
  const [currentQIdx, setCurrentQIdx] = useState<number>(0);
  const [selectedOpt, setSelectedOpt] = useState<number | null>(null);
  const [isAnswered, setIsAnswered] = useState<boolean>(false);

  // Grid SVG setup
  const canvasWidth = 360;
  const canvasHeight = 360;
  const cx = 180;
  const cy = 180;
  const scale = 16; // 16 pixels per 1 unit

  // Coordinates mapping
  const toCanvasX = (gx: number) => cx + gx * scale;
  const toCanvasY = (gy: number) => cy - gy * scale;
  const toGridX = (cxVal: number) => (cxVal - cx) / scale;
  const toGridY = (cyVal: number) => (cy - cyVal) / scale;

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

    // Clamp inside [-10, 10]
    gx = Math.max(-10, Math.min(10, gx));
    gy = Math.max(-10, Math.min(10, gy));

    if (activeDrag === 'center') {
      setVH(gx);
      setVK(gy);
    } else if (activeDrag === 'circumference') {
      // Calculate distance between center (vH, vK) and pointer to get new radius
      const dx = gx - vH;
      const dy = gy - vK;
      const dist = Math.round(Math.sqrt(dx * dx + dy * dy));
      setRadius(Math.max(1, Math.min(8, dist)));
    }
  }, [activeDrag, vH, vK]);

  useEffect(() => {
    const handleGlobalPointerUp = () => {
      setActiveDrag(null);
    };
    window.addEventListener('pointerup', handleGlobalPointerUp);
    return () => window.removeEventListener('pointerup', handleGlobalPointerUp);
  }, []);

  const handleReset = () => {
    setVH(1);
    setVK(2);
    setRadius(4);
    setTheta(90);
    setSelectedOpt(null);
    setIsAnswered(false);
  };

  const handleTabChange = (tab: 'equations' | 'sectors' | 'practice') => {
    setActiveTab(tab);
    setSelectedOpt(null);
    setIsAnswered(false);

    if (tab === 'practice') {
      applyQuestionSetup(QUIZ_QUESTIONS[currentQIdx]);
    } else {
      setVH(1);
      setVK(2);
      setRadius(4);
      setTheta(90);
    }
  };

  const applyQuestionSetup = (q: Question) => {
    setVH(q.setupCircle.h);
    setVK(q.setupCircle.k);
    setRadius(q.setupCircle.r);
    setTheta(q.setupCircle.theta ?? 90);
    setSelectedOpt(null);
    setIsAnswered(false);
  };

  const handleAnswerSubmit = (idx: number) => {
    if (isAnswered) return;
    setSelectedOpt(idx);
    setIsAnswered(true);
  };

  const handleNextQuestion = () => {
    const nextIdx = (currentQIdx + 1) % QUIZ_QUESTIONS.length;
    setCurrentQIdx(nextIdx);
    applyQuestionSetup(QUIZ_QUESTIONS[nextIdx]);
  };

  // Sector SVG Arc path drawing
  const getSectorArcPath = () => {
    const rVal = radius * scale;
    const centerCanvasX = toCanvasX(vH);
    const centerCanvasY = toCanvasY(vK);

    // Starting coordinate (at angle 0, i.e., horizontal right relative to center)
    const startX = centerCanvasX + rVal;
    const startY = centerCanvasY;

    // Angle theta in radians
    const thetaRad = (theta * Math.PI) / 180;
    const endX = centerCanvasX + Math.cos(thetaRad) * rVal;
    const endY = centerCanvasY - Math.sin(thetaRad) * rVal; // SVG Invert Y

    const largeArcFlag = theta > 180 ? 1 : 0;

    return `M ${centerCanvasX} ${centerCanvasY} L ${startX} ${startY} A ${rVal} ${rVal} 0 ${largeArcFlag} 0 ${endX} ${endY} Z`;
  };

  // Math equations derivation
  const arcLength = 2 * Math.PI * radius * (theta / 360);
  const sectorArea = Math.PI * radius * radius * (theta / 360);

  return (
    <div className="sim-container flex flex-col gap-6 p-4 sm:p-6 text-ares-offwhite bg-ares-gray-deep/40 rounded-xl border border-white/5 max-w-2xl mx-auto w-full">
      
      {/* Header Tabs */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-white/5 pb-4">
        <div>
          <span className="font-heading font-black text-ares-gold uppercase tracking-wider text-xs block mb-1">
            ARES Academy Math Prep
          </span>
          <h2 className="text-xl font-bold font-heading text-white">Coordinate Circles & Sector Geometry</h2>
        </div>
        
        {/* Navigation Tabs */}
        <div className="flex gap-1 bg-obsidian-darker p-1 rounded-lg border border-white/5 w-full sm:w-auto">
          <button
            onClick={() => handleTabChange('equations')}
            className={`flex-1 sm:flex-none text-xs font-bold px-3 py-1.5 rounded transition-all ${
              activeTab === 'equations'
                ? 'bg-ares-red text-white'
                : 'text-ares-muted hover:text-white hover:bg-white/5'
            }`}
          >
            Circle Equations
          </button>
          <button
            onClick={() => handleTabChange('sectors')}
            className={`flex-1 sm:flex-none text-xs font-bold px-3 py-1.5 rounded transition-all ${
              activeTab === 'sectors'
                ? 'bg-ares-red text-white'
                : 'text-ares-muted hover:text-white hover:bg-white/5'
            }`}
          >
            Arc & Sectors
          </button>
          <button
            onClick={() => handleTabChange('practice')}
            className={`flex-1 sm:flex-none text-xs font-bold px-3 py-1.5 rounded transition-all ${
              activeTab === 'practice'
                ? 'bg-ares-red text-white'
                : 'text-ares-muted hover:text-white hover:bg-white/5'
            }`}
          >
            Practice Quiz
          </button>
        </div>
      </div>

      {/* Main Workspace workspace */}
      <div className="w-full flex flex-col items-center gap-4 bg-obsidian/40 p-4 rounded-xl border border-white/5 relative">
        <div className="w-full flex justify-between items-center text-xs text-ares-muted">
          <div className="flex items-center gap-1.5">
            <Info size={12} className="text-ares-gold" />
            <span>
              {activeTab === 'sectors'
                ? 'Adjust the central angle slider to see arc fractions'
                : activeTab === 'practice'
                ? 'Seeded circle problems and square completion guide'
                : 'Drag the center handle to translate, and side handle to resize'}
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
            {/* Grid Line Increments (every 2 units) */}
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

            {/* Labels */}
            <text x="352" y={cy - 4} fill="rgba(255,255,255,0.5)" fontSize="9" fontFamily="monospace">x</text>
            <text x={cx + 6} y="14" fill="rgba(255,255,255,0.5)" fontSize="9" fontFamily="monospace">y</text>

            <text x={toCanvasX(5)} y={cy + 12} fill="rgba(255,255,255,0.3)" fontSize="8" textAnchor="middle">5</text>
            <text x={toCanvasX(-5)} y={cy + 12} fill="rgba(255,255,255,0.3)" fontSize="8" textAnchor="middle">-5</text>
            <text x={cx + 6} y={toCanvasY(5) + 3} fill="rgba(255,255,255,0.3)" fontSize="8">5</text>
            <text x={cx + 6} y={toCanvasY(-5) + 3} fill="rgba(255,255,255,0.3)" fontSize="8">-5</text>

            {/* Shaded Sector Arc (Sectors Tab) */}
            {activeTab === 'sectors' && (
              <path
                d={getSectorArcPath()}
                fill="rgba(192, 0, 0, 0.2)"
                stroke="#C00000"
                strokeWidth="1.5"
              />
            )}

            {/* Standard Circle Outline */}
            <circle
              cx={toCanvasX(vH)}
              cy={toCanvasY(vK)}
              r={radius * scale}
              fill="none"
              stroke="#FFB81C"
              strokeWidth="3"
            />
            <circle
              cx={toCanvasX(vH)}
              cy={toCanvasY(vK)}
              r={radius * scale}
              fill="none"
              stroke="#FFB81C"
              strokeWidth="1"
              strokeDasharray="2,2"
              opacity="0.5"
            />

            {/* Draggable Circle Center handle */}
            {activeTab !== 'practice' && (
              <>
                <circle
                  cx={toCanvasX(vH)}
                  cy={toCanvasY(vK)}
                  r="7"
                  fill="#C00000"
                  className="cursor-move hover:fill-white transition-colors"
                  onPointerDown={() => setActiveDrag('center')}
                />
                <circle cx={toCanvasX(vH)} cy={toCanvasY(vK)} r="2.5" fill="#1b1c1e" pointerEvents="none" />
                <text
                  x={toCanvasX(vH)}
                  y={toCanvasY(vK) - 12}
                  fill="#ffffff"
                  fontSize="9"
                  fontWeight="bold"
                  textAnchor="middle"
                  pointerEvents="none"
                >
                  ({vH}, {vK})
                </text>
              </>
            )}

            {/* Center Label (When Quiz active) */}
            {activeTab === 'practice' && (
              <circle cx={toCanvasX(vH)} cy={toCanvasY(vK)} r="3" fill="#ffffff" />
            )}

            {/* Circumference boundary handle to resize radius */}
            {activeTab === 'equations' && (
              <>
                <circle
                  cx={toCanvasX(vH + radius)}
                  cy={toCanvasY(vK)}
                  r="7"
                  fill="#CD7F32"
                  className="cursor-ew-resize hover:fill-white transition-colors"
                  onPointerDown={() => setActiveDrag('circumference')}
                />
                <circle cx={toCanvasX(vH + radius)} cy={toCanvasY(vK)} r="2" fill="#1b1c1e" pointerEvents="none" />
                <line
                  x1={toCanvasX(vH)}
                  y1={toCanvasY(vK)}
                  x2={toCanvasX(vH + radius)}
                  y2={toCanvasY(vK)}
                  stroke="#CD7F32"
                  strokeWidth="1.5"
                  strokeDasharray="3,3"
                  pointerEvents="none"
                />
                <text
                  x={toCanvasX(vH + radius / 2)}
                  y={toCanvasY(vK) - 6}
                  fill="#CD7F32"
                  fontSize="9"
                  fontWeight="bold"
                  textAnchor="middle"
                  pointerEvents="none"
                >
                  r={radius}
                </text>
              </>
            )}
          </svg>
        </div>

        {/* Dynamic Controls based on tab */}
        <div className="w-full flex flex-col gap-4">
          
          {/* Angle Slider (Sectors Tab) */}
          {activeTab === 'sectors' && (
            <div className="grid grid-cols-1 gap-3 bg-obsidian-surface/60 p-4 rounded-lg border border-white/5 text-xs">
              <div className="flex justify-between font-bold">
                <span className="text-ares-gold">Central Angle (θ)</span>
                <span className="text-white">{theta}° ({(theta * Math.PI / 180).toFixed(2)} rad)</span>
              </div>
              <input
                type="range"
                min="10"
                max="350"
                step="5"
                value={theta}
                onChange={e => setTheta(parseInt(e.target.value))}
                className="w-full accent-ares-red"
              />
            </div>
          )}

          {/* Formulas Display Block */}
          {activeTab === 'equations' && (
            <div className="bg-obsidian-darker/60 border border-white/10 p-4 rounded-lg flex flex-col gap-2 text-xs leading-relaxed">
              <span className="text-ares-muted text-[10px] uppercase font-bold tracking-wider mb-1">Standard Equation Form</span>
              <p className="text-sm font-heading font-black text-white">
                (x - h)² + (y - k)² = r²
              </p>
              <div className="h-px bg-white/5 my-1" />
              <p className="text-marble/80">
                Substituting H = <span className="text-ares-gold font-bold">{vH}</span>, K = <span className="text-ares-gold font-bold">{vK}</span>, and R = <span className="text-ares-red font-bold">{radius}</span>:
              </p>
              <p className="font-monospace text-xs text-white/95 bg-obsidian-darker px-3 py-2 rounded border border-white/5">
                (x {vH >= 0 ? `- ${vH}` : `+ ${Math.abs(vH)}`})² + (y {vK >= 0 ? `- ${vK}` : `+ ${Math.abs(vK)}`})² = {radius * radius}
              </p>
            </div>
          )}

          {activeTab === 'sectors' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* ARC LENGTH */}
              <div className="bg-obsidian-surface/60 border border-white/5 p-3 rounded-lg flex flex-col text-xs leading-relaxed">
                <span className="text-ares-muted font-bold text-[10px] uppercase mb-1">Arc Length</span>
                <span className="font-heading font-black text-ares-red">s = 2πr * (θ/360)</span>
                <div className="my-1.5 h-px bg-white/5" />
                <span className="font-monospace text-[11px] text-white/90">
                  s = 2π * {radius} * ({theta}/360)
                </span>
                <span className="font-monospace font-black text-white text-sm mt-1">
                  s = {((theta / 360) * 2 * radius).toFixed(2)}π ≈ {arcLength.toFixed(2)}
                </span>
              </div>

              {/* SECTOR AREA */}
              <div className="bg-obsidian-surface/60 border border-white/5 p-3 rounded-lg flex flex-col text-xs leading-relaxed">
                <span className="text-ares-muted font-bold text-[10px] uppercase mb-1">Sector Area</span>
                <span className="font-heading font-black text-ares-gold">A = πr² * (θ/360)</span>
                <div className="my-1.5 h-px bg-white/5" />
                <span className="font-monospace text-[11px] text-white/90">
                  A = π * {radius * radius} * ({theta}/360)
                </span>
                <span className="font-monospace font-black text-white text-sm mt-1">
                  A = {((theta / 360) * radius * radius).toFixed(2)}π ≈ {sectorArea.toFixed(2)}
                </span>
              </div>
            </div>
          )}

          {/* PRACTICE QUIZ CARD */}
          {activeTab === 'practice' && (
            <div className="w-full flex flex-col gap-4 bg-obsidian-surface/60 border border-white/5 p-4 rounded-lg">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-ares-gold uppercase tracking-wider">
                  Practice Question {currentQIdx + 1} of {QUIZ_QUESTIONS.length}
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
                {QUIZ_QUESTIONS[currentQIdx].text}
              </p>

              {/* Options list */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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
                    {QUIZ_QUESTIONS[currentQIdx].explanation}
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
    </div>
  );
}
