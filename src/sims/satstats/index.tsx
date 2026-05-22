/** @sim {"name": "Statistics & Data Distributions", "requiresContext": false} */
import React, { useState } from 'react';
import { RefreshCw, CheckCircle2, XCircle, ChevronRight, Plus, Minus } from 'lucide-react';

interface Question {
  id: number;
  text: string;
  options: string[];
  correctIdx: number;
  explanation: string;
  setupData: number[]; // counts for columns 1-10
}

const QUIZ_QUESTIONS: Question[] = [
  {
    id: 1,
    text: "A teacher records the test scores of a class. The distribution of scores has a median of 82 and a mean of 76. Which of the following best describes the shape of the score distribution?",
    options: [
      "Symmetric, because the mean and median represent the center.",
      "Skewed to the right, because the tail extends to larger values and pulls the mean up.",
      "Skewed to the left, because a few very low scores pulled the mean down below the median.",
      "Uniform, because the scores are distributed evenly."
    ],
    correctIdx: 2,
    explanation: "When a distribution has a mean that is lower than the median (76 < 82), it indicates that the distribution is skewed to the left. A few extremely low values (outliers) pull the mean down significantly, while the median remains stable.",
    setupData: [3, 2, 1, 0, 1, 1, 2, 4, 6, 2] // skewed left: high peaks on the right, tail on left
  },
  {
    id: 2,
    text: "A dataset consists of the numbers: 2, 2, 3, 4, 4, 4, 5, 6. If an outlier with a value of 15 is added to this dataset, which of the following statistics will change the most?",
    options: ["Mean", "Median", "Mode", "They will all change by the same amount"],
    correctIdx: 0,
    explanation: "Outliers have a huge effect on the mean, as the mean takes the sum of all elements divided by N. Adding 15 increases the sum significantly. However, the median (the middle value) is highly resistant to outliers and will shift only slightly (or not at all) as it only depends on ordering.",
    setupData: [0, 2, 1, 3, 1, 1, 0, 0, 0, 0] // 2, 2, 3, 4, 4, 4, 5, 6
  },
  {
    id: 3,
    text: "A dot plot displays the number of pets owned by 15 households. If the range of the dataset is 6 and the minimum number of pets is 1, what is the maximum number of pets owned?",
    options: ["5", "6", "7", "8"],
    correctIdx: 2,
    explanation: "Range is defined as the difference between the maximum value and the minimum value: Range = Max - Min. Here, 6 = Max - 1 => Max = 7. Thus, the maximum number of pets is 7.",
    setupData: [3, 4, 3, 2, 1, 1, 1, 0, 0, 0]
  }
];

export default function StatsSim() {
  // Counts of dots in columns 1 to 10 (index 0 maps to value 1, index 9 to value 10)
  const [dataCounts, setDataCounts] = useState<number[]>([1, 2, 4, 3, 2, 1, 0, 0, 0, 0]);
  const [editMode, setEditMode] = useState<'add' | 'remove'>('add');

  // Practice quiz states
  const [currentQIdx, setCurrentQIdx] = useState<number>(0);
  const [selectedOpt, setSelectedOpt] = useState<number | null>(null);
  const [isAnswered, setIsAnswered] = useState<boolean>(false);

  // Derive statistics
  const getDatasetValues = () => {
    const list: number[] = [];
    dataCounts.forEach((count, idx) => {
      const val = idx + 1;
      for (let i = 0; i < count; i++) {
        list.push(val);
      }
    });
    return list.sort((a, b) => a - b);
  };

  const values = getDatasetValues();
  const N = values.length;

  const calculateStats = () => {
    if (N === 0) return { mean: 0, median: 0, mode: 'None', range: 0, stdDev: 0 };

    // Mean
    const sum = values.reduce((acc, curr) => acc + curr, 0);
    const mean = sum / N;

    const mid = Math.floor(N / 2);
    const median = N % 2 === 0 ? (values[mid - 1] + values[mid]) / 2 : values[mid];

    // Mode
    let maxCount = 0;
    let modes: number[] = [];
    dataCounts.forEach((count, idx) => {
      if (count > maxCount) {
        maxCount = count;
        modes = [idx + 1];
      } else if (count === maxCount && count > 0) {
        modes.push(idx + 1);
      }
    });
    const modeStr = maxCount > 0 ? modes.join(', ') : 'None';

    // Range
    const min = values[0];
    const max = values[N - 1];
    const range = max - min;

    // Standard Deviation
    const sqDiffs = values.map(v => (v - mean) * (v - mean));
    const meanSqDiff = sqDiffs.reduce((acc, curr) => acc + curr, 0) / N;
    const stdDev = Math.sqrt(meanSqDiff);

    return { mean, median, mode: modeStr, range, stdDev };
  };

  const stats = calculateStats();

  const handleCellClick = (colIdx: number) => {
    const newCounts = [...dataCounts];
    if (editMode === 'add') {
      if (newCounts[colIdx] < 8) {
        newCounts[colIdx] += 1;
      }
    } else {
      if (newCounts[colIdx] > 0) {
        newCounts[colIdx] -= 1;
      }
    }
    setDataCounts(newCounts);
  };

  const handleReset = () => {
    setDataCounts([1, 2, 4, 3, 2, 1, 0, 0, 0, 0]);
    setEditMode('add');
    setSelectedOpt(null);
    setIsAnswered(false);
  };

  const applyQuestionSetup = (q: Question) => {
    setDataCounts(q.setupData);
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

  // Determine skewness
  const getSkewnessText = () => {
    if (N === 0) {
      return {
        label: 'No Data',
        desc: 'Please add some data points to the dot plot to calculate skewness.',
        color: 'text-ares-muted'
      };
    }
    const diff = stats.mean - stats.median;
    if (Math.abs(diff) < 0.2) {
      return {
        label: 'Symmetric (Normal)',
        desc: 'Mean and Median are nearly identical. Data points are balanced symmetrically around the center.',
        color: 'text-emerald-400'
      };
    } else if (diff > 0) {
      return {
        label: 'Skewed to the Right (Positive Skew)',
        desc: 'Mean is larger than the median. A tail of high values (or outliers) on the right pulls the mean upward.',
        color: 'text-ares-gold'
      };
    } else {
      return {
        label: 'Skewed to the Left (Negative Skew)',
        desc: 'Mean is lower than the median. A tail of low values (or outliers) on the left pulls the mean downward.',
        color: 'text-ares-red'
      };
    }
  };

  const skew = getSkewnessText();

  const colWidth = 32;
  const colSpacing = 6;
  const startX = 20;
  const startY = 200; // base floor

  return (
    <div className="sim-container flex flex-col gap-6 p-4 sm:p-6 text-ares-offwhite bg-ares-gray-deep/40 rounded-xl border border-white/5 max-w-2xl mx-auto w-full">
      
      {/* Visual Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-white/5 pb-4">
        <div>
          <span className="font-heading font-black text-ares-gold uppercase tracking-wider text-xs block mb-1">
            ARES Academy Math Prep
          </span>
          <h2 className="text-xl font-bold font-heading text-white">Statistics & Data Distributions</h2>
        </div>
        
        {/* Toggle tools */}
        <div className="flex gap-2 w-full sm:w-auto">
          <button
            onClick={() => setCurrentQIdx(-1)} // Switch to sandbox mode
            className={`text-xs font-bold px-3 py-1.5 rounded transition-all border ${
              currentQIdx === -1
                ? 'bg-ares-red text-white border-ares-red'
                : 'text-ares-muted border-white/5 hover:text-white hover:bg-white/5'
            }`}
          >
            Sandbox Mode
          </button>
          <button
            onClick={() => {
              setCurrentQIdx(0);
              applyQuestionSetup(QUIZ_QUESTIONS[0]);
            }}
            className={`text-xs font-bold px-3 py-1.5 rounded transition-all border ${
              currentQIdx >= 0
                ? 'bg-ares-red text-white border-ares-red'
                : 'text-ares-muted border-white/5 hover:text-white hover:bg-white/5'
            }`}
          >
            Practice Quiz
          </button>
        </div>
      </div>

      {/* Main Workspace */}
      <div className="w-full flex flex-col items-center gap-4 bg-obsidian/40 p-4 rounded-xl border border-white/5 relative">
        <div className="w-full flex justify-between items-center text-xs">
          {/* Add / Remove toggle for Sandbox Mode */}
          {currentQIdx === -1 ? (
            <div className="flex gap-1 bg-obsidian-darker p-0.5 rounded border border-white/10">
              <button
                onClick={() => setEditMode('add')}
                className={`p-1 px-2.5 rounded text-[10px] font-bold flex items-center gap-1 transition-all ${
                  editMode === 'add' ? 'bg-emerald-500/20 text-emerald-400 font-black' : 'text-ares-muted hover:text-white'
                }`}
              >
                <Plus size={10} /> ADD DOT
              </button>
              <button
                onClick={() => setEditMode('remove')}
                className={`p-1 px-2.5 rounded text-[10px] font-bold flex items-center gap-1 transition-all ${
                  editMode === 'remove' ? 'bg-red-500/20 text-red-400 font-black' : 'text-ares-muted hover:text-white'
                }`}
              >
                <Minus size={10} /> REMOVE DOT
              </button>
            </div>
          ) : (
            <span className="text-ares-muted">Click Sandbox Mode above to design your own dot plots!</span>
          )}
          <button
            onClick={handleReset}
            className="text-ares-red hover:text-white hover:bg-ares-red/10 px-2 py-0.5 rounded font-bold flex items-center gap-1 transition-all"
          >
            <RefreshCw size={10} /> RESET
          </button>
        </div>

        {/* Interactive Dot Plot Canvas */}
        <div className="relative bg-obsidian-darker p-3 rounded-lg border border-white/10 shadow-2xl max-w-full overflow-hidden w-full flex justify-center">
          <svg
            width="380"
            height="240"
            viewBox="0 0 380 240"
            className="w-full max-w-[380px] h-auto select-none touch-none"
          >
            {/* Grid base line */}
            <line x1="10" y1={startY} x2="370" y2={startY} stroke="rgba(255,255,255,0.2)" strokeWidth="2" />

            {/* Vertical guidelines */}
            {[-1, 1].map(direction => (
              <g key={direction} />
            ))}

            {/* Renders Column Dots */}
            {dataCounts.map((count, colIdx) => {
              const xPos = startX + colIdx * (colWidth + colSpacing) + colWidth / 2;
              const colValue = colIdx + 1;

              return (
                <g key={colIdx}>
                  {/* Clickable transparent column background for easy selection */}
                  {currentQIdx === -1 && (
                    <rect
                      x={startX + colIdx * (colWidth + colSpacing)}
                      y="20"
                      width={colWidth}
                      height={startY - 20}
                      fill="transparent"
                      className="cursor-pointer hover:fill-white/5 transition-colors"
                      onClick={() => handleCellClick(colIdx)}
                    />
                  )}

                  {/* Render Stacked Dots */}
                  {Array.from({ length: count }).map((_, dotIdx) => {
                    const dotRadius = 9;
                    const yPos = startY - 14 - dotIdx * 20;

                    return (
                      <circle
                        key={dotIdx}
                        cx={xPos}
                        cy={yPos}
                        r={dotRadius}
                        fill="#FFB81C"
                        stroke="#1b1c1e"
                        strokeWidth="1.5"
                        opacity={currentQIdx === -1 ? 0.95 : 0.85}
                        className={currentQIdx === -1 ? 'cursor-pointer hover:fill-white transition-colors' : ''}
                        onClick={(e) => {
                          if (currentQIdx === -1) {
                            e.stopPropagation(); // prevent adding a dot
                            const newCounts = [...dataCounts];
                            if (newCounts[colIdx] > 0) {
                              newCounts[colIdx] -= 1;
                            }
                            setDataCounts(newCounts);
                          }
                        }}
                      />
                    );
                  })}

                  {/* Column Label */}
                  <text
                    x={xPos}
                    y={startY + 15}
                    fill="rgba(255,255,255,0.5)"
                    fontSize="10"
                    fontFamily="monospace"
                    textAnchor="middle"
                  >
                    {colValue}
                  </text>
                </g>
              );
            })}

            {/* Mean Vertical Line (Red dashed) */}
            {N > 0 && (
              <g>
                {/* Convert grid score coordinate to Canvas coordinate */}
                {/* Min score = 1, Max score = 10 */}
                {(() => {
                  const meanVal = stats.mean;
                  // map [1, 10] to [startX + colWidth/2, startX + 9 * (colWidth+colSpacing) + colWidth/2]
                  const xStart = startX + colWidth / 2;
                  const xEnd = startX + 9 * (colWidth + colSpacing) + colWidth / 2;
                  const meanXPos = xStart + ((meanVal - 1) / 9) * (xEnd - xStart);

                  return (
                    <>
                      <line
                        x1={meanXPos}
                        y1="15"
                        x2={meanXPos}
                        y2={startY}
                        stroke="#C00000"
                        strokeWidth="2.5"
                        strokeDasharray="4,4"
                      />
                      <rect x={meanXPos - 22} y="15" width="44" height="12" rx="3" fill="#C00000" />
                      <text x={meanXPos} y="24" fill="#ffffff" fontSize="8" fontWeight="bold" textAnchor="middle" fontFamily="sans-serif">
                        x̄={meanVal.toFixed(1)}
                      </text>
                    </>
                  );
                })()}
              </g>
            )}

            {/* Median Vertical Line (Bronze dashed) */}
            {N > 0 && (
              <g>
                {(() => {
                  const medianVal = stats.median;
                  const xStart = startX + colWidth / 2;
                  const xEnd = startX + 9 * (colWidth + colSpacing) + colWidth / 2;
                  const medianXPos = xStart + ((medianVal - 1) / 9) * (xEnd - xStart);

                  return (
                    <>
                      <line
                        x1={medianXPos}
                        y1="35"
                        x2={medianXPos}
                        y2={startY}
                        stroke="#CD7F32"
                        strokeWidth="2"
                        strokeDasharray="3,3"
                      />
                      <rect x={medianXPos - 22} y="33" width="44" height="12" rx="3" fill="#CD7F32" />
                      <text x={medianXPos} y="42" fill="#ffffff" fontSize="8" fontWeight="bold" textAnchor="middle" fontFamily="sans-serif">
                        Med={medianVal.toFixed(1)}
                      </text>
                    </>
                  );
                })()}
              </g>
            )}
          </svg>
        </div>

        {/* Real-time statistics summaries */}
        <div className="w-full grid grid-cols-2 sm:grid-cols-5 gap-2.5">
          <div className="bg-obsidian-surface/60 border border-white/5 p-2 rounded flex flex-col items-center">
            <span className="text-[10px] text-ares-muted font-bold">COUNT (N)</span>
            <span className="text-sm font-monospace font-black text-white">{N}</span>
          </div>
          <div className="bg-obsidian-surface/60 border border-white/5 p-2 rounded flex flex-col items-center">
            <span className="text-[10px] text-ares-muted font-bold">MEAN (x̄)</span>
            <span className="text-sm font-monospace font-black text-ares-red">{stats.mean.toFixed(2)}</span>
          </div>
          <div className="bg-obsidian-surface/60 border border-white/5 p-2 rounded flex flex-col items-center">
            <span className="text-[10px] text-ares-muted font-bold">MEDIAN</span>
            <span className="text-sm font-monospace font-black text-ares-bronze">{stats.median.toFixed(1)}</span>
          </div>
          <div className="bg-obsidian-surface/60 border border-white/5 p-2 rounded flex flex-col items-center">
            <span className="text-[10px] text-ares-muted font-bold">MODE</span>
            <span className="text-sm font-monospace font-black text-ares-gold truncate max-w-[80px]">{stats.mode}</span>
          </div>
          <div className="bg-obsidian-surface/60 border border-white/5 p-2 rounded flex flex-col items-center col-span-2 sm:col-span-1">
            <span className="text-[10px] text-ares-muted font-bold">ST. DEV (σ)</span>
            <span className="text-sm font-monospace font-black text-white/90">{stats.stdDev.toFixed(2)}</span>
          </div>
        </div>

        {/* Skew & Shape analysis explanation */}
        <div className="w-full bg-obsidian-darker/60 border border-white/10 p-3 rounded-lg text-xs leading-relaxed">
          <span className="text-ares-muted text-[10px] uppercase font-bold tracking-wider mb-1 block">Distribution Analysis</span>
          <p className="font-heading font-black text-white flex items-center gap-1.5">
            Shape: <span className={skew.color}>{skew.label}</span>
          </p>
          <p className="text-marble/85 mt-1">
            {skew.desc}
          </p>
        </div>

        {/* PRACTICE QUIZ CARD */}
        {currentQIdx >= 0 && (
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
  );
}
