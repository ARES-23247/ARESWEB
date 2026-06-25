/** @sim {"name": "Scatterplots & Line of Best Fit", "requiresContext": false} */
import React, { useState, useRef } from 'react';
import { RefreshCw, CheckCircle2, XCircle, Info, ChevronRight, TrendingUp, Sparkles } from 'lucide-react';

interface Point {
  id: number;
  x: number;
  y: number;
  label?: string;
}

interface Question {
  id: number;
  text: string;
  options: string[];
  correctIdx: number;
  explanation: string;
  preset: string; // which preset this question is associated with
  highlightX?: number; // visual projection helper X
  highlightY?: number; // visual projection helper Y
}

const PRESET_DATASETS: Record<string, { name: string; desc: string; points: Point[]; xLabel: string; yLabel: string }> = {
  robotics_voltage: {
    name: 'Motor Voltage vs. Speed (Robotics)',
    desc: 'Plotting robot drive motor speed (hundreds of RPM) vs. input battery voltage (V). Demonstrates a strong positive linear relationship.',
    xLabel: 'Voltage (V)',
    yLabel: 'Motor Speed (x100 RPM)',
    points: [
      { id: 1, x: 2.0, y: 1.8, label: 'Point A' },
      { id: 2, x: 3.5, y: 3.2, label: 'Point B' },
      { id: 3, x: 5.0, y: 5.1, label: 'Point C' },
      { id: 4, x: 6.0, y: 5.8, label: 'Point D' },
      { id: 5, x: 7.2, y: 7.0, label: 'Point E' },
      { id: 8, x: 8.5, y: 8.2, label: 'Point F' },
      { id: 9, x: 9.5, y: 9.3, label: 'Point G' }
    ]
  },
  robotics_battery: {
    name: 'Match Time vs. Battery Charge',
    desc: 'Tracking remaining robot battery charge (%) vs. match play time (seconds / 15). Shows a strong negative linear relationship.',
    xLabel: 'Time (x15 seconds)',
    yLabel: 'Battery Charge (%)',
    points: [
      { id: 1, x: 1.0, y: 9.5 },
      { id: 2, x: 2.5, y: 8.2 },
      { id: 3, x: 4.0, y: 6.8 },
      { id: 4, x: 5.5, y: 5.5 },
      { id: 5, x: 7.0, y: 4.1 },
      { id: 6, x: 8.5, y: 2.8 },
      { id: 7, x: 9.8, y: 1.5 }
    ]
  },
  robotics_random: {
    name: 'Robot Weight vs. Auto Score',
    desc: 'Comparing total competition robot weight (lbs / 10) vs. autonomous points scored. Demonstrates no correlation.',
    xLabel: 'Robot Weight (x10 lbs)',
    yLabel: 'Autonomous Score',
    points: [
      { id: 1, x: 2.0, y: 8.0 },
      { id: 2, x: 3.5, y: 2.5 },
      { id: 3, x: 5.0, y: 7.5 },
      { id: 4, x: 6.5, y: 3.0 },
      { id: 5, x: 8.0, y: 9.0 },
      { id: 6, x: 9.0, y: 1.5 }
    ]
  }
};

const QUIZ_QUESTIONS: Question[] = [
  {
    id: 1,
    text: "A robotics student uses the 'Motor Voltage vs. Speed' dataset to model drive performance. Based on the calculated line of best fit, what is the predicted speed of the motor (in hundreds of RPM) when the input voltage is 8.0 volts?",
    options: [
      "Approximately 5.8",
      "Approximately 7.8",
      "Approximately 8.5",
      "Approximately 9.2"
    ],
    correctIdx: 1,
    explanation: "For the voltage dataset, the line of best fit has a slope of approx 1.0 and a y-intercept near 0 (yielding y ≈ 1.0x). Substituting x = 8.0 V into the equation y = mx + b yields an estimated y of approximately 7.8 (or 780 RPM). On the graph, you can trace up from 8.0 on the X-axis to the line of best fit, which corresponds to around 7.8 on the Y-axis.",
    preset: 'robotics_voltage',
    highlightX: 8.0,
    highlightY: 7.8
  },
  {
    id: 2,
    text: "For the 'Match Time vs. Battery Charge' dataset, which of the following is the best interpretation of the slope of the line of best fit in the context of the study?",
    options: [
      "The robot starts the match with a battery charge of approximately 10.5%.",
      "For every additional 15 seconds of match play, the remaining battery charge decreases by approximately 0.9%.",
      "The total time of a standard robotics match is exactly 150 seconds.",
      "The remaining battery charge decreases by 10% for every 1 second of teleop play."
    ],
    correctIdx: 1,
    explanation: "The slope of a line of best fit represents the average change in the dependent variable (Y) per unit increase in the independent variable (X). Here, the slope is approximately -0.9, meaning that for each unit increase in match time interval (1 unit = 15 seconds), the remaining battery charge decreases by about 0.9 percentage points.",
    preset: 'robotics_battery'
  },
  {
    id: 3,
    text: "Suppose a data point is added to the 'Robot Weight vs. Auto Score' scatterplot at coordinate (5.0, 7.5). If we then add an outlier at (10.0, 0.5), how would this new point affect the slope of the line of best fit and the correlation coefficient (r)?",
    options: [
      "The slope would increase, and r would become closer to +1.0.",
      "The slope would decrease, and r would become more negative.",
      "The slope would remain exactly identical, and r would drop to 0.0.",
      "The slope would become vertical, and r would be undefined."
    ],
    correctIdx: 1,
    explanation: "Adding a point far to the right and at the bottom (10.0, 0.5) acts as an outlier with a strong leverage. Because it lies below the general trend of weight vs. autonomous scores, it pulls the right side of the regression line downward, making the slope (m) more negative. Concurrently, it creates a negative correlation trend, driving the correlation coefficient (r) to become more negative.",
    preset: 'robotics_random',
    highlightX: 10.0,
    highlightY: 0.5
  }
];

export default function ScatterplotsSim() {
  const [selectedPreset, setSelectedPreset] = useState<string>('robotics_voltage');
  const [points, setPoints] = useState<Point[]>([...PRESET_DATASETS.robotics_voltage.points]);
  
  // Dragging states
  const [activeDragId, setActiveDragId] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  // Practice quiz states
  const [currentQIdx, setCurrentQIdx] = useState<number>(0);
  const [selectedOpt, setSelectedOpt] = useState<number | null>(null);
  const [isAnswered, setIsAnswered] = useState<boolean>(false);

  // SVG Dimension constants
  const width = 360;
  const height = 360;
  const paddingLeft = 45;
  const paddingBottom = 45;
  const paddingRight = 20;
  const paddingTop = 20;

  // Coordinate scales: Map data [0, 10] to screen [padding, dimension-padding]
  const xScale = (xVal: number) => {
    return paddingLeft + (xVal / 10) * (width - paddingLeft - paddingRight);
  };

  const yScale = (yVal: number) => {
    return height - paddingBottom - (yVal / 10) * (height - paddingTop - paddingBottom);
  };

  // Inverse scales for dragging: Screen to data [0, 10]
  const xInverse = (screenX: number) => {
    const dataX = ((screenX - paddingLeft) / (width - paddingLeft - paddingRight)) * 10;
    // Snap to nearest 0.1 for high fidelity and readability
    return Math.max(0, Math.min(10, Math.round(dataX * 10) / 10));
  };

  const yInverse = (screenY: number) => {
    const dataY = ((height - paddingBottom - screenY) / (height - paddingTop - paddingBottom)) * 10;
    return Math.max(0, Math.min(10, Math.round(dataY * 10) / 10));
  };

  // Change preset handler
  const handlePresetChange = (presetKey: string) => {
    setSelectedPreset(presetKey);
    setPoints([...PRESET_DATASETS[presetKey].points]);
    setSelectedOpt(null);
    setIsAnswered(false);

    // Auto align quiz if available
    const quizIdx = QUIZ_QUESTIONS.findIndex(q => q.preset === presetKey);
    if (quizIdx !== -1) {
      setCurrentQIdx(quizIdx);
    }
  };

  // Reset current preset points
  const handleReset = () => {
    setPoints([...PRESET_DATASETS[selectedPreset].points]);
    setSelectedOpt(null);
    setIsAnswered(false);
  };

  // Dynamic OLS & Pearson Regression calculations
  const calculateRegression = () => {
    const N = points.length;
    if (N < 2) return { m: 0, b: 0, r: 0 };

    const xMean = points.reduce((acc, p) => acc + p.x, 0) / N;
    const yMean = points.reduce((acc, p) => acc + p.y, 0) / N;

    let num = 0; // Sum of (x - xMean)(y - yMean)
    let den = 0; // Sum of (x - xMean)^2
    let yDen = 0; // Sum of (y - yMean)^2

    points.forEach(p => {
      const xDiff = p.x - xMean;
      const yDiff = p.y - yMean;
      num += xDiff * yDiff;
      den += xDiff * xDiff;
      yDen += yDiff * yDiff;
    });

    const m = den === 0 ? 0 : num / den;
    const b = yMean - m * xMean;

    let r = 0;
    if (den > 0 && yDen > 0) {
      r = num / Math.sqrt(den * yDen);
    }

    return { m, b, r };
  };

  const { m, b, r } = calculateRegression();

  // Pointer drag event handlers
  const handlePointerDown = (id: number, e: React.PointerEvent) => {
    e.preventDefault();
    (e.target as Element).setPointerCapture(e.pointerId);
    setActiveDragId(id);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (activeDragId === null || !svgRef.current) return;

    const rect = svgRef.current.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;

    // Convert coordinates
    const newX = xInverse(clientX);
    const newY = yInverse(clientY);

    setPoints(prev =>
      prev.map(p => (p.id === activeDragId ? { ...p, x: newX, y: newY } : p))
    );
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (activeDragId !== null) {
      (e.target as Element).releasePointerCapture(e.pointerId);
      setActiveDragId(null);
    }
  };

  // Add a new dot into the sandbox
  const handleAddPoint = () => {
    if (points.length >= 12) return; // limit to prevent overcrowding
    const newId = Date.now();
    // Insert random point in middle region
    const newX = Math.round((4 + Math.random() * 4) * 10) / 10;
    const newY = Math.round((4 + Math.random() * 4) * 10) / 10;
    setPoints([...points, { id: newId, x: newX, y: newY }]);
  };

  // Remove a point
  const handleRemovePoint = (id: number) => {
    if (points.length <= 2) return; // Need at least 2 points for regression
    setPoints(points.filter(p => p.id !== id));
  };

  // Quiz submission
  const handleAnswerSubmit = (idx: number) => {
    if (isAnswered) return;
    setSelectedOpt(idx);
    setIsAnswered(true);
  };

  const handleNextQuestion = () => {
    const nextQIdx = (currentQIdx + 1) % QUIZ_QUESTIONS.length;
    setCurrentQIdx(nextQIdx);
    const targetPreset = QUIZ_QUESTIONS[nextQIdx].preset;
    setSelectedPreset(targetPreset);
    setPoints([...PRESET_DATASETS[targetPreset].points]);
    setSelectedOpt(null);
    setIsAnswered(false);
  };

  // Get qualitative correlation status
  const getCorrelationStatus = () => {
    const absR = Math.abs(r);
    if (absR < 0.2) return { text: 'No Correlation', color: 'text-ares-muted' };
    if (absR < 0.5) return { text: r > 0 ? 'Weak Positive' : 'Weak Negative', color: 'text-orange-400' };
    if (absR < 0.8) return { text: r > 0 ? 'Moderate Positive' : 'Moderate Negative', color: 'text-yellow-400' };
    return { text: r > 0 ? 'Strong Positive' : 'Strong Negative', color: 'text-emerald-400' };
  };

  const corrStatus = getCorrelationStatus();

  // Create grid lines
  const gridTicks = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  return (
    <div className="sim-container flex flex-col gap-6 p-4 sm:p-6 text-ares-offwhite bg-ares-gray-deep/40 rounded-xl border border-white/5 max-w-2xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-white/5 pb-4">
        <div>
          <span className="font-heading font-black text-ares-gold uppercase tracking-wider text-xs block mb-1">
            ARES Academy Math Prep
          </span>
          <h2 className="text-xl font-bold font-heading text-white flex items-center gap-2">
            <TrendingUp size={20} className="text-ares-red" />
            Scatterplots & Line of Best Fit
          </h2>
        </div>
        <button
          onClick={handleReset}
          className="text-xs font-bold text-ares-red hover:text-white hover:bg-ares-red/10 px-2.5 py-1.5 rounded border border-ares-red/20 flex items-center gap-1 transition-all self-end sm:self-auto"
        >
          <RefreshCw size={12} /> Reset Data
        </button>
      </div>

      {/* Dataset Selection Tabs */}
      <div className="grid grid-cols-3 gap-1 bg-obsidian-darker p-1 rounded-lg border border-white/5">
        {Object.entries(PRESET_DATASETS).map(([key, dataset]) => (
          <button
            key={key}
            onClick={() => handlePresetChange(key)}
            className={`text-[10px] sm:text-xs font-bold py-2 px-1 sm:px-2 rounded transition-all text-center ${
              selectedPreset === key
                ? 'bg-ares-red text-white font-black shadow-md'
                : 'text-ares-muted hover:text-white hover:bg-white/5'
            }`}
          >
            {dataset.name.split(' (')[0]}
          </button>
        ))}
      </div>

      {/* Dataset Description */}
      <div className="bg-obsidian/20 border border-white/5 p-3 rounded-lg text-xs leading-relaxed text-marble/90 flex gap-2">
        <Info size={16} className="text-ares-gold shrink-0 mt-0.5" />
        <p>{PRESET_DATASETS[selectedPreset].desc}</p>
      </div>

      {/* Workspace Split: Graph & Sidebar details */}
      <div className="flex flex-col md:flex-row gap-6 items-center">
        
        {/* Interactive SVG Scatterplot */}
        <div className="relative bg-obsidian-darker p-3 rounded-xl border border-white/10 shadow-2xl shrink-0">
          <svg
            ref={svgRef}
            width={width}
            height={height}
            onPointerMove={handlePointerMove}
            className="select-none touch-none rounded-lg"
          >
            {/* Background Grid Lines */}
            {gridTicks.map(tick => {
              const xPos = xScale(tick);
              const yPos = yScale(tick);
              return (
                <g key={tick}>
                  {/* Vertical grids */}
                  <line
                    x1={xPos}
                    y1={paddingTop}
                    x2={xPos}
                    y2={height - paddingBottom}
                    stroke={tick === 0 ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.06)'}
                    strokeWidth={tick === 0 ? '2' : '1'}
                  />
                  {/* Horizontal grids */}
                  <line
                    x1={paddingLeft}
                    y1={yPos}
                    x2={width - paddingRight}
                    y2={yPos}
                    stroke={tick === 0 ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.06)'}
                    strokeWidth={tick === 0 ? '2' : '1'}
                  />
                  
                  {/* X labels */}
                  {tick % 2 === 0 && (
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
                  )}
                  {/* Y labels */}
                  {tick % 2 === 0 && (
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
                  )}
                </g>
              );
            })}

            {/* Regression Line of Best Fit */}
            {(() => {
              // y = mx + b
              // Calculate screen start (x = 0) and end (x = 10)
              const yStartVal = b;
              const yEndVal = m * 10 + b;

              // Clip endpoints to coordinate boundaries [0, 10]
              const xL = 0;
              const yL = yStartVal;
              const xR = 10;
              const yR = yEndVal;

              return (
                <line
                  x1={xScale(xL)}
                  y1={yScale(yL)}
                  x2={xScale(xR)}
                  y2={yScale(yR)}
                  stroke="#FF4F4F"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  opacity="0.9"
                  className="drop-shadow-[0_0_4px_rgba(255,79,79,0.4)]"
                />
              );
            })()}

            {/* Quiz visual helpers */}
            {isAnswered && QUIZ_QUESTIONS[currentQIdx].highlightX !== undefined && (
              <g>
                {(() => {
                  const hX = QUIZ_QUESTIONS[currentQIdx].highlightX as number;
                  const hY = QUIZ_QUESTIONS[currentQIdx].highlightY as number;
                  return (
                    <>
                      {/* Vertical projection line from x axis to fit line */}
                      <line
                        x1={xScale(hX)}
                        y1={yScale(0)}
                        x2={xScale(hX)}
                        y2={yScale(hY)}
                        stroke="#FFB81C"
                        strokeWidth="1.5"
                        strokeDasharray="4,4"
                      />
                      {/* Horizontal projection line to y axis */}
                      <line
                        x1={xScale(0)}
                        y1={yScale(hY)}
                        x2={xScale(hX)}
                        y2={yScale(hY)}
                        stroke="#FFB81C"
                        strokeWidth="1.5"
                        strokeDasharray="4,4"
                      />
                      {/* Intersect point circle indicator */}
                      <circle cx={xScale(hX)} cy={yScale(hY)} r="5" fill="#FFB81C" />
                    </>
                  );
                })()}
              </g>
            )}

            {/* Render Draggable Data Points */}
            {points.map(p => {
              const cx = xScale(p.x);
              const cy = yScale(p.y);
              const isDragging = activeDragId === p.id;

              return (
                <g key={p.id}>
                  {/* Halo glow when dragging */}
                  {isDragging && (
                    <circle cx={cx} cy={cy} r="14" fill="#FFB81C" opacity="0.3" />
                  )}
                  {/* Central interactive point */}
                  <circle
                    cx={cx}
                    cy={cy}
                    r="8.5"
                    fill="#FFB81C"
                    stroke="#1b1c1e"
                    strokeWidth="1.5"
                    className="cursor-move hover:fill-white transition-colors"
                    onPointerDown={(e) => handlePointerDown(p.id, e)}
                    onPointerUp={handlePointerUp}
                  />
                  {/* Tooltip offset display */}
                  {isDragging && (
                    <g transform={`translate(${cx}, ${cy - 18})`}>
                      <rect x="-24" y="-12" width="48" height="15" rx="3" fill="#1b1c1e" stroke="rgba(255,255,255,0.2)" strokeWidth="0.5" />
                      <text x="0" y="-2" fill="#ffffff" fontSize="8" fontWeight="bold" textAnchor="middle" fontFamily="monospace">
                        ({p.x.toFixed(1)}, {p.y.toFixed(1)})
                      </text>
                    </g>
                  )}
                </g>
              );
            })}

            {/* Title Axes labels */}
            {/* Y axis title */}
            <text
              transform={`translate(12, ${height / 2}) rotate(-90)`}
              fill="rgba(255,255,255,0.5)"
              fontSize="9.5"
              fontWeight="bold"
              fontFamily="sans-serif"
              textAnchor="middle"
            >
              {PRESET_DATASETS[selectedPreset].yLabel}
            </text>
            {/* X axis title */}
            <text
              x={width / 2 + 10}
              y={height - 8}
              fill="rgba(255,255,255,0.5)"
              fontSize="9.5"
              fontWeight="bold"
              fontFamily="sans-serif"
              textAnchor="middle"
            >
              {PRESET_DATASETS[selectedPreset].xLabel}
            </text>
          </svg>
        </div>

        {/* Real-time Math Analytics side panel */}
        <div className="w-full flex flex-col gap-3">
          <span className="text-[10px] text-ares-muted font-bold tracking-wider uppercase">Live Regression Metrics</span>
          
          {/* Equation block */}
          <div className="bg-obsidian-surface/60 border border-white/5 p-3 rounded-lg flex flex-col gap-1">
            <span className="text-[9px] text-ares-muted font-bold">LINE OF BEST FIT (OLS)</span>
            <div className="text-base font-monospace font-black text-white">
              {"y = "}{m.toFixed(2)}{"x "}{b >= 0 ? '+ ' : '- '}{Math.abs(b).toFixed(2)}
            </div>
            <span className="text-[9.5px] text-marble/75 leading-tight mt-1">
              For every 1 unit increase in X, Y is predicted to {m >= 0 ? 'increase' : 'decrease'} by {Math.abs(m).toFixed(2)} units.
            </span>
          </div>

          {/* Correlation block */}
          <div className="bg-obsidian-surface/60 border border-white/5 p-3 rounded-lg flex flex-col gap-1">
            <span className="text-[9px] text-ares-muted font-bold">PEARSON&apos;S CORRELATION (r)</span>
            <div className="flex justify-between items-baseline">
              <span className="text-base font-monospace font-black text-white">
                r = {r.toFixed(3)}
              </span>
              <span className={`text-xs font-bold font-heading ${corrStatus.color}`}>
                {corrStatus.text}
              </span>
            </div>
            <div className="w-full bg-obsidian-darker h-1.5 rounded-full overflow-hidden mt-1.5 flex">
              {/* Visual negative r fill bar */}
              <div
                className="bg-ares-red/60 h-full self-end transition-all"
                style={{
                  width: r < 0 ? `${Math.abs(r) * 50}%` : '0%',
                  marginLeft: 'auto'
                }}
              />
              {/* Visual positive r fill bar */}
              <div
                className="bg-emerald-500/60 h-full transition-all"
                style={{
                  width: r > 0 ? `${r * 50}%` : '0%',
                  marginRight: 'auto'
                }}
              />
            </div>
          </div>

          {/* Sandbox point tools */}
          <div className="flex gap-2">
            <button
              onClick={handleAddPoint}
              disabled={points.length >= 12}
              className="flex-1 bg-obsidian-darker hover:bg-white/5 text-marble text-[10px] font-bold py-2 rounded border border-white/10 disabled:opacity-50 transition-all"
            >
              + Add Random Dot
            </button>
            <button
              onClick={() => handleRemovePoint(points[points.length - 1].id)}
              disabled={points.length <= 3}
              className="flex-1 bg-obsidian-darker hover:bg-white/5 text-ares-red text-[10px] font-bold py-2 rounded border border-white/10 disabled:opacity-50 transition-all"
            >
              - Remove Dot
            </button>
          </div>
        </div>
      </div>

      {/* Bottom explanation tips */}
      <div className="w-full bg-obsidian-darker/60 border border-white/10 p-3 rounded-lg text-xs leading-relaxed">
        <span className="text-ares-gold text-[10px] uppercase font-bold tracking-wider mb-1 block flex items-center gap-1">
          <Sparkles size={12} />
          Concept Tip: Graph Reading & Leveraging
        </span>
        <p className="text-marble/85">
          Drag coordinates around the grid! Note how points far to the right or left (high leverage) pull the red line of best fit up or down significantly when moved. Understanding how &quot;outliers&quot; distort the slope of the regression line is extremely useful.
        </p>
      </div>

      {/* Practice Quiz Module */}
      {currentQIdx >= 0 && (
        <div className="w-full flex flex-col gap-4 bg-obsidian-surface/60 border border-white/5 p-4 rounded-xl mt-2">
          <div className="flex justify-between items-center text-xs">
            <span className="font-bold text-ares-gold uppercase tracking-wider">
              Graphing Practice: Question {currentQIdx + 1} of {QUIZ_QUESTIONS.length}
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
