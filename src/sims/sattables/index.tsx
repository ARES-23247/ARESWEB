/** @sim {"name": "Two-Way Tables & Probability", "requiresContext": false} */
import React, { useState } from 'react';
import { RefreshCw, CheckCircle2, XCircle, ChevronRight, Sparkles, Percent } from 'lucide-react';

interface Question {
  id: number;
  text: string;
  options: string[];
  correctIdx: number;
  explanation: string;
  presetKey: string;
  numeratorSelector: (data: TableData) => number;
  denominatorSelector: (data: TableData) => number;
  prompt: string;
}

interface TableData {
  cell11: number; // Row 1, Col 1
  cell12: number; // Row 1, Col 2
  cell21: number; // Row 2, Col 1
  cell22: number; // Row 2, Col 2
}

const QUIZ_QUESTIONS: Question[] = [
  {
    id: 1,
    text: "A quality control engineer inspects robotics structural parts manufactured on two separate assembly lines. Based on the current values in the table, if a component is selected at random from Line A, what is the probability that the component is defective?",
    prompt: "Defective given Line A",
    options: [], // populated dynamically
    correctIdx: 0,
    explanation: "To find the probability that a component is defective given it is from Line A, look only at the Line A row. The total number of components from Line A is the sum of defective and functional components on Line A. The number of defective components on Line A is the numerator. Therefore, the probability is defective components on Line A divided by the total components on Line A.",
    presetKey: "quality_control",
    numeratorSelector: (data) => data.cell11,
    denominatorSelector: (data) => data.cell11 + data.cell12
  },
  {
    id: 2,
    text: "A robotics vision neural network classifies objects on the field as Cones or Cubes. Based on the classification table, if an object that was actually a Cone is chosen at random, what is the probability that the vision model predicted it to be a Cube (representing a False Negative / missing detection)?",
    prompt: "Predicted Cube given Actually Cone",
    options: [],
    correctIdx: 0,
    explanation: "This is a conditional probability where the condition is 'actually a Cone'. We look only at the 'Actually Cone' column. The total number of actual Cones is the column total. The number of actual Cones predicted as Cubes is the cell intersection. Dividing this cell value by the column total yields the probability.",
    presetKey: "vision_confusion",
    numeratorSelector: (data) => data.cell21,
    denominatorSelector: (data) => data.cell11 + data.cell21
  },
  {
    id: 3,
    text: "Based on the component defect data, if a defective component is chosen at random, what is the probability that it was manufactured on Line B?",
    prompt: "Line B given Defective",
    options: [],
    correctIdx: 0,
    explanation: "We are given that the selected component is defective, so the denominator is the total number of defective components (column total for Defective). The numerator is the defective components manufactured on Line B. Dividing this cell value by the total defective components yields the probability.",
    presetKey: "quality_control",
    numeratorSelector: (data) => data.cell21,
    denominatorSelector: (data) => data.cell11 + data.cell21
  }
];

interface Preset {
  name: string;
  desc: string;
  rowNames: string[];
  colNames: string[];
  rowHeader: string;
  colHeader: string;
  initialData: TableData;
}

const PRESETS: Record<string, Preset> = {
  quality_control: {
    name: "Component QC",
    desc: "Analyzes component defects across two robotics production lines. Perfect for practice on standard conditional probability questions.",
    rowHeader: "Production Line",
    colHeader: "Defect Status",
    rowNames: ["Line A", "Line B"],
    colNames: ["Defective", "Functional"],
    initialData: {
      cell11: 15,
      cell12: 135,
      cell21: 25,
      cell22: 225
    }
  },
  vision_confusion: {
    name: "Vision Confusion Matrix",
    desc: "A computer vision model classifying FTC game pieces (Cones vs Cubes). Click cells to analyze neural network Precision and Recall.",
    rowHeader: "Model Prediction",
    colHeader: "Actual Field Object",
    rowNames: ["Predicted Cone", "Predicted Cube"],
    colNames: ["Actually Cone", "Actually Cube"],
    initialData: {
      cell11: 180,
      cell12: 20,
      cell21: 15,
      cell22: 185
    }
  }
};

const generateQuizOptions = (qIdx: number, currentData: TableData) => {
  const q = QUIZ_QUESTIONS[qIdx];
  const n = q.numeratorSelector(currentData);
  const d = q.denominatorSelector(currentData);

  const correctFrac = `${n}/${d}`;
  const correctVal = n / d;

  // Generate smart distractor fractions using other values from table
  const r1t = currentData.cell11 + currentData.cell12;
  const r2t = currentData.cell21 + currentData.cell22;
  const c1t = currentData.cell11 + currentData.cell21;
  const c2t = currentData.cell12 + currentData.cell22;
  const gt = r1t + r2t;

  const distractorsRaw = [
    { num: n, den: gt },
    { num: n === currentData.cell11 ? currentData.cell12 : currentData.cell11, den: d },
    { num: n, den: d === r1t ? r2t : r1t },
    { num: n, den: d === c1t ? c2t : c1t },
    { num: currentData.cell11, den: gt },
    { num: currentData.cell22, den: gt }
  ];

  // Filter duplicates and identical values to correct option
  const uniqueDistractors = distractorsRaw
    .filter(x => x.num > 0 && x.den > 0 && Math.abs(x.num / x.den - correctVal) > 0.01)
    .map(x => `${x.num}/${x.den}`);

  const pool = Array.from(new Set(uniqueDistractors)).slice(0, 3);
  
  // Fallbacks if not enough distractors
  while (pool.length < 3) {
    const randomNum = Math.floor(Math.random() * 20) + 5;
    const randomDen = gt;
    pool.push(`${randomNum}/${randomDen}`);
  }

  const options = [correctFrac, ...pool];
  
  // Shuffle options and find index of correct one
  const shuffled = [...options].sort(() => Math.random() - 0.5);
  const correctIdx = shuffled.indexOf(correctFrac);

  return {
    shuffledOptions: shuffled,
    correctOptionIdx: correctIdx
  };
};

export default function TwoWayTablesSim() {
  const [selectedPreset, setSelectedPreset] = useState<string>('quality_control');
  
  // Custom Table Data state
  const [data, setData] = useState<TableData>(PRESETS.quality_control.initialData);

  // Interactive probability tool select
  const [numCell, setNumCell] = useState<string>('cell11');
  const [denCell, setDenCell] = useState<string>('row1_total');

  // Practice quiz states
  const [currentQIdx, setCurrentQIdx] = useState<number>(0);
  const [selectedOpt, setSelectedOpt] = useState<number | null>(null);
  const [isAnswered, setIsAnswered] = useState<boolean>(false);
  
  // Stable options state reactively generated from currentQIdx and data
  const [quizOptions, setQuizOptions] = useState<{
    shuffledOptions: string[];
    correctOptionIdx: number;
  }>(() => generateQuizOptions(0, PRESETS.quality_control.initialData));

  const activePreset = PRESETS[selectedPreset];

  // Derived totals
  const row1Total = data.cell11 + data.cell12;
  const row2Total = data.cell21 + data.cell22;
  const col1Total = data.cell11 + data.cell21;
  const col2Total = data.cell12 + data.cell22;
  const grandTotal = row1Total + row2Total;

  const handlePresetChange = (presetKey: string) => {
    setSelectedPreset(presetKey);
    const p = PRESETS[presetKey];
    setData(p.initialData);
    
    // Sync matching quiz
    const quizIdx = QUIZ_QUESTIONS.findIndex(q => q.presetKey === presetKey);
    const targetQIdx = quizIdx !== -1 ? quizIdx : 0;
    setCurrentQIdx(targetQIdx);
    setQuizOptions(generateQuizOptions(targetQIdx, p.initialData));
    setSelectedOpt(null);
    setIsAnswered(false);
  };

  const handleReset = () => {
    const p = PRESETS[selectedPreset];
    setData(p.initialData);
    setQuizOptions(generateQuizOptions(currentQIdx, p.initialData));
    setSelectedOpt(null);
    setIsAnswered(false);
  };

  const updateCell = (cellKey: keyof TableData, value: number) => {
    const updated = { ...data, [cellKey]: value };
    setData(updated);
    setQuizOptions(generateQuizOptions(currentQIdx, updated));
  };

  const handleAnswerSubmit = (idx: number) => {
    if (isAnswered) return;
    setSelectedOpt(idx);
    setIsAnswered(true);
  };

  const handleNextQuestion = () => {
    const nextIdx = (currentQIdx + 1) % QUIZ_QUESTIONS.length;
    const q = QUIZ_QUESTIONS[nextIdx];
    setSelectedPreset(q.presetKey);
    const p = PRESETS[q.presetKey];
    setData(p.initialData);
    setCurrentQIdx(nextIdx);
    setQuizOptions(generateQuizOptions(nextIdx, p.initialData));
    setSelectedOpt(null);
    setIsAnswered(false);
  };

  // Get dynamic calculation details for custom selector tool
  const getCustomProbability = () => {
    let num = 0;
    let den = 0;
    let numLabel = "";
    let denLabel = "";

    // Numerator resolution
    if (numCell === 'cell11') {
      num = data.cell11;
      numLabel = `${activePreset.rowNames[0]} & ${activePreset.colNames[0]}`;
    } else if (numCell === 'cell12') {
      num = data.cell12;
      numLabel = `${activePreset.rowNames[0]} & ${activePreset.colNames[1]}`;
    } else if (numCell === 'cell21') {
      num = data.cell21;
      numLabel = `${activePreset.rowNames[1]} & ${activePreset.colNames[0]}`;
    } else if (numCell === 'cell22') {
      num = data.cell22;
      numLabel = `${activePreset.rowNames[1]} & ${activePreset.colNames[1]}`;
    }

    // Denominator resolution
    if (denCell === 'row1_total') {
      den = row1Total;
      denLabel = `Total ${activePreset.rowNames[0]}`;
    } else if (denCell === 'row2_total') {
      den = row2Total;
      denLabel = `Total ${activePreset.rowNames[1]}`;
    } else if (denCell === 'col1_total') {
      den = col1Total;
      denLabel = `Total ${activePreset.colNames[0]}`;
    } else if (denCell === 'col2_total') {
      den = col2Total;
      denLabel = `Total ${activePreset.colNames[1]}`;
    } else if (denCell === 'grand_total') {
      den = grandTotal;
      denLabel = "Grand Total";
    }

    const ratio = den > 0 ? num / den : 0;
    const percentage = (ratio * 100).toFixed(1);

    return { num, den, numLabel, denLabel, ratio, percentage };
  };

  const customProb = getCustomProbability();

  // Helper check for custom selector highlights
  const isCellNumerator = (cellName: string) => {
    return numCell === cellName;
  };

  const isCellDenominator = (cellName: string) => {
    if (denCell === 'grand_total') return true;
    if (denCell === 'row1_total' && (cellName === 'cell11' || cellName === 'cell12')) return true;
    if (denCell === 'row2_total' && (cellName === 'cell21' || cellName === 'cell22')) return true;
    if (denCell === 'col1_total' && (cellName === 'cell11' || cellName === 'cell21')) return true;
    if (denCell === 'col2_total' && (cellName === 'cell12' || cellName === 'cell22')) return true;
    return false;
  };

  return (
    <div className="sim-container flex flex-col gap-6 p-4 sm:p-6 text-ares-offwhite bg-ares-gray-deep/40 rounded-xl border border-white/5 max-w-2xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-white/5 pb-4">
        <div>
          <span className="font-heading font-black text-ares-gold uppercase tracking-wider text-xs block mb-1">
            ARES Academy Math Prep
          </span>
          <h2 className="text-xl font-bold font-heading text-white flex items-center gap-2">
            <Percent size={20} className="text-ares-red" />
            Two-Way Contingency Tables
          </h2>
        </div>
        <button
          onClick={handleReset}
          className="text-xs font-bold text-ares-red hover:text-white hover:bg-ares-red/10 px-2.5 py-1.5 rounded border border-ares-red/20 flex items-center gap-1 transition-all"
        >
          <RefreshCw size={12} /> Reset Data
        </button>
      </div>

      {/* Preset tabs */}
      <div className="grid grid-cols-2 gap-1 bg-obsidian-darker p-1 rounded-lg border border-white/5">
        {Object.entries(PRESETS).map(([key, p]) => (
          <button
            key={key}
            onClick={() => handlePresetChange(key)}
            className={`text-xs font-bold py-2 rounded transition-all text-center ${
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
        <p>{activePreset.desc}</p>
      </div>

      {/* Layout split */}
      <div className="flex flex-col gap-6">
        {/* Two-Way Contingency Grid */}
        <div className="w-full overflow-x-auto bg-obsidian-darker/60 p-4 rounded-xl border border-white/10 shadow-2xl">
          <table className="w-full text-center border-collapse text-xs select-none">
            <thead>
              <tr>
                <th className="p-2 text-ares-gold font-bold text-left border-b border-r border-white/10 uppercase tracking-wider">
                  {activePreset.rowHeader}
                </th>
                <th className="p-2 border-b border-white/10 font-semibold text-marble uppercase">
                  {activePreset.colNames[0]}
                </th>
                <th className="p-2 border-b border-white/10 font-semibold text-marble uppercase">
                  {activePreset.colNames[1]}
                </th>
                <th className="p-2 border-b border-white/10 border-l border-white/10 font-bold text-ares-gold">
                  TOTAL
                </th>
              </tr>
            </thead>
            <tbody>
              {/* Row 1 */}
              <tr>
                <td className="p-3 text-left font-semibold border-r border-white/10 text-marble">
                  {activePreset.rowNames[0]}
                </td>
                
                {/* Cell 1,1 */}
                <td
                  className={`p-3 border border-white/5 transition-all cursor-pointer font-monospace font-black text-sm relative ${
                    isCellNumerator('cell11')
                      ? 'bg-ares-red/20 text-ares-red-light border-ares-red shadow-[inset_0_0_8px_rgba(192,0,0,0.3)]'
                      : isCellDenominator('cell11')
                      ? 'bg-ares-bronze/10 text-ares-bronze-light border-ares-bronze/40'
                      : 'text-white hover:bg-white/5'
                  }`}
                  onClick={() => setNumCell('cell11')}
                >
                  {data.cell11}
                  {isCellNumerator('cell11') && (
                    <span className="absolute top-1 right-1 text-[8px] bg-ares-red text-white px-0.5 rounded font-sans scale-75">NUM</span>
                  )}
                </td>

                {/* Cell 1,2 */}
                <td
                  className={`p-3 border border-white/5 transition-all cursor-pointer font-monospace font-black text-sm relative ${
                    isCellNumerator('cell12')
                      ? 'bg-ares-red/20 text-ares-red-light border-ares-red shadow-[inset_0_0_8px_rgba(192,0,0,0.3)]'
                      : isCellDenominator('cell12')
                      ? 'bg-ares-bronze/10 text-ares-bronze-light border-ares-bronze/40'
                      : 'text-white hover:bg-white/5'
                  }`}
                  onClick={() => setNumCell('cell12')}
                >
                  {data.cell12}
                  {isCellNumerator('cell12') && (
                    <span className="absolute top-1 right-1 text-[8px] bg-ares-red text-white px-0.5 rounded font-sans scale-75">NUM</span>
                  )}
                </td>

                {/* Row 1 Total */}
                <td className={`p-3 font-monospace font-black text-sm border-l border-white/10 ${
                  denCell === 'row1_total' ? 'bg-ares-bronze/20 text-ares-bronze-light font-black border border-ares-bronze/50' : 'text-ares-muted'
                }`}>
                  {row1Total}
                </td>
              </tr>

              {/* Row 2 */}
              <tr>
                <td className="p-3 text-left font-semibold border-r border-white/10 text-marble">
                  {activePreset.rowNames[1]}
                </td>

                {/* Cell 2,1 */}
                <td
                  className={`p-3 border border-white/5 transition-all cursor-pointer font-monospace font-black text-sm relative ${
                    isCellNumerator('cell21')
                      ? 'bg-ares-red/20 text-ares-red-light border-ares-red shadow-[inset_0_0_8px_rgba(192,0,0,0.3)]'
                      : isCellDenominator('cell21')
                      ? 'bg-ares-bronze/10 text-ares-bronze-light border-ares-bronze/40'
                      : 'text-white hover:bg-white/5'
                  }`}
                  onClick={() => setNumCell('cell21')}
                >
                  {data.cell21}
                  {isCellNumerator('cell21') && (
                    <span className="absolute top-1 right-1 text-[8px] bg-ares-red text-white px-0.5 rounded font-sans scale-75">NUM</span>
                  )}
                </td>

                {/* Cell 2,2 */}
                <td
                  className={`p-3 border border-white/5 transition-all cursor-pointer font-monospace font-black text-sm relative ${
                    isCellNumerator('cell22')
                      ? 'bg-ares-red/20 text-ares-red-light border-ares-red shadow-[inset_0_0_8px_rgba(192,0,0,0.3)]'
                      : isCellDenominator('cell22')
                      ? 'bg-ares-bronze/10 text-ares-bronze-light border-ares-bronze/40'
                      : 'text-white hover:bg-white/5'
                  }`}
                  onClick={() => setNumCell('cell22')}
                >
                  {data.cell22}
                  {isCellNumerator('cell22') && (
                    <span className="absolute top-1 right-1 text-[8px] bg-ares-red text-white px-0.5 rounded font-sans scale-75">NUM</span>
                  )}
                </td>

                {/* Row 2 Total */}
                <td className={`p-3 font-monospace font-black text-sm border-l border-white/10 ${
                  denCell === 'row2_total' ? 'bg-ares-bronze/20 text-ares-bronze-light font-black border border-ares-bronze/50' : 'text-ares-muted'
                }`}>
                  {row2Total}
                </td>
              </tr>

              {/* Column Totals Row */}
              <tr className="border-t border-white/10">
                <td className="p-3 text-left font-bold text-ares-gold">TOTAL</td>
                
                {/* Col 1 Total */}
                <td className={`p-3 font-monospace font-black text-sm ${
                  denCell === 'col1_total' ? 'bg-ares-bronze/20 text-ares-bronze-light font-black border border-ares-bronze/50' : 'text-ares-muted'
                }`}>
                  {col1Total}
                </td>

                {/* Col 2 Total */}
                <td className={`p-3 font-monospace font-black text-sm ${
                  denCell === 'col2_total' ? 'bg-ares-bronze/20 text-ares-bronze-light font-black border border-ares-bronze/50' : 'text-ares-muted'
                }`}>
                  {col2Total}
                </td>

                {/* Grand Total */}
                <td className={`p-3 font-monospace font-black text-sm border-l border-white/10 ${
                  denCell === 'grand_total' ? 'bg-ares-bronze/20 text-ares-bronze-light font-black border border-ares-bronze/50' : 'text-ares-gold font-extrabold'
                }`}>
                  {grandTotal}
                </td>
              </tr>
            </tbody>
          </table>
          <div className="mt-2 text-[10px] text-marble/60 flex justify-between">
            <span>💡 Click cells to set Numerator</span>
            <span className="text-ares-red-light font-bold">🟥 Highlighted Red: Numerator</span>
            <span className="text-ares-bronze-light font-bold">🟫 Highlighted Bronze: Denominator subset</span>
          </div>
        </div>

        {/* Adjustments & Formulas Panel */}
        <div className="w-full flex flex-col gap-4">
          <div className="bg-obsidian-surface/60 border border-white/5 p-4 rounded-xl flex flex-col gap-4">
            <span className="text-[10px] text-ares-muted font-bold tracking-wider uppercase">Probability Calculator Tool</span>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {/* Numerator select */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="numerator-select" className="text-ares-red-light font-bold">Select Numerator Cell:</label>
                <select
                  id="numerator-select"
                  value={numCell}
                  onChange={e => setNumCell(e.target.value)}
                  className="bg-obsidian-darker border border-white/10 rounded px-2.5 py-1.5 text-white font-bold"
                >
                  <option value="cell11">{activePreset.rowNames[0]} & {activePreset.colNames[0]} ({data.cell11})</option>
                  <option value="cell12">{activePreset.rowNames[0]} & {activePreset.colNames[1]} ({data.cell12})</option>
                  <option value="cell21">{activePreset.rowNames[1]} & {activePreset.colNames[0]} ({data.cell21})</option>
                  <option value="cell22">{activePreset.rowNames[1]} & {activePreset.colNames[1]} ({data.cell22})</option>
                </select>
              </div>

              {/* Denominator select */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="denominator-select" className="text-ares-bronze-light font-bold">Select Denominator (Given condition):</label>
                <select
                  id="denominator-select"
                  value={denCell}
                  onChange={e => setDenCell(e.target.value)}
                  className="bg-obsidian-darker border border-white/10 rounded px-2.5 py-1.5 text-white font-bold"
                >
                  <option value="row1_total">Given: {activePreset.rowNames[0]} (Row total: {row1Total})</option>
                  <option value="row2_total">Given: {activePreset.rowNames[1]} (Row total: {row2Total})</option>
                  <option value="col1_total">Given: {activePreset.colNames[0]} (Col total: {col1Total})</option>
                  <option value="col2_total">Given: {activePreset.colNames[1]} (Col total: {col2Total})</option>
                  <option value="grand_total">Given: Entire Table (Grand total: {grandTotal})</option>
                </select>
              </div>
            </div>

            {/* Fraction & Formula Display */}
            <div className="bg-obsidian-darker/60 border border-white/5 p-3 rounded-lg flex flex-col items-center justify-center gap-2">
              <span className="text-[9px] text-ares-muted font-bold block self-start">DYNAMIC PROBABILITY FORMULA</span>
              
              <div className="flex items-center gap-4 py-2">
                <div className="text-right leading-tight max-w-[150px]">
                  <div className="text-[10px] text-ares-red-light font-bold truncate">{customProb.numLabel}</div>
                  <div className="text-[9px] text-white/40 uppercase tracking-widest my-0.5">divided by</div>
                  <div className="text-[10px] text-ares-bronze-light font-bold truncate">{customProb.denLabel}</div>
                </div>

                <div className="text-3xl font-monospace font-black text-white flex items-center">
                  <span>{customProb.num}</span>
                  <span className="mx-2 text-ares-muted/40">/</span>
                  <span>{customProb.den}</span>
                </div>

                <div className="text-left leading-none border-l border-white/10 pl-4">
                  <div className="text-2xl font-monospace font-black text-ares-gold">{customProb.percentage}%</div>
                  <div className="text-[9px] text-ares-muted font-semibold mt-1">({customProb.ratio.toFixed(4)})</div>
                </div>
              </div>
            </div>
          </div>

          {/* Interactive Cell Sliders */}
          <div className="bg-obsidian-surface/60 border border-white/5 p-4 rounded-xl flex flex-col gap-3">
            <span className="text-[10px] text-ares-muted font-bold tracking-wider uppercase">Live Grid Cell Adjusters</span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="flex flex-col gap-1">
                <div className="flex justify-between font-bold">
                  <span className="text-marble/95">{activePreset.rowNames[0]} & {activePreset.colNames[0]}</span>
                  <span className="text-white font-monospace">{data.cell11}</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="300"
                  step="5"
                  value={data.cell11}
                  onChange={e => updateCell('cell11', parseInt(e.target.value))}
                  className="w-full accent-ares-red"
                />
              </div>

              <div className="flex flex-col gap-1">
                <div className="flex justify-between font-bold">
                  <span className="text-marble/95">{activePreset.rowNames[0]} & {activePreset.colNames[1]}</span>
                  <span className="text-white font-monospace">{data.cell12}</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="300"
                  step="5"
                  value={data.cell12}
                  onChange={e => updateCell('cell12', parseInt(e.target.value))}
                  className="w-full accent-ares-red"
                />
              </div>

              <div className="flex flex-col gap-1">
                <div className="flex justify-between font-bold">
                  <span className="text-marble/95">{activePreset.rowNames[1]} & {activePreset.colNames[0]}</span>
                  <span className="text-white font-monospace">{data.cell21}</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="300"
                  step="5"
                  value={data.cell21}
                  onChange={e => updateCell('cell21', parseInt(e.target.value))}
                  className="w-full accent-ares-red"
                />
              </div>

              <div className="flex flex-col gap-1">
                <div className="flex justify-between font-bold">
                  <span className="text-marble/95">{activePreset.rowNames[1]} & {activePreset.colNames[1]}</span>
                  <span className="text-white font-monospace">{data.cell22}</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="300"
                  step="5"
                  value={data.cell22}
                  onChange={e => updateCell('cell22', parseInt(e.target.value))}
                  className="w-full accent-ares-red"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tip Block */}
      <div className="w-full bg-obsidian-darker/60 border border-white/10 p-3 rounded-lg text-xs leading-relaxed">
        <span className="text-ares-gold text-[10px] uppercase font-bold tracking-wider mb-1 block flex items-center gap-1">
          <Sparkles size={12} />
          Concept Strategy: Conditional Probability
        </span>
        <p className="text-marble/85">
          Conditional probability questions often contain the phrase **&quot;given that&quot;** or **&quot;of the [subset]&quot;**. 
          This restricts your denominator to a specific row total or column total instead of the grand total. 
          Use the dropdown selector above to see how changing the &quot;given condition&quot; highlights different subsets of the table and changes the fraction denominator!
        </p>
      </div>

      {/* Practice Quiz */}
      {currentQIdx >= 0 && quizOptions.shuffledOptions.length > 0 && (
        <div className="w-full flex flex-col gap-4 bg-obsidian-surface/60 border border-white/5 p-4 rounded-xl mt-2">
          <div className="flex justify-between items-center text-xs">
            <span className="font-bold text-ares-gold uppercase tracking-wider">
              Practice Quiz: Question {currentQIdx + 1} of {QUIZ_QUESTIONS.length}
            </span>
            <button
              onClick={handleNextQuestion}
              className="text-ares-red font-bold flex items-center gap-0.5 hover:text-white"
            >
              Skip Question <ChevronRight size={14} />
            </button>
          </div>

          <div className="bg-obsidian-darker border border-white/5 px-3 py-1.5 rounded text-[10px] text-ares-cyan font-bold uppercase self-start">
            Topic: {QUIZ_QUESTIONS[currentQIdx].prompt}
          </div>

          <p className="text-sm font-semibold text-white leading-relaxed">
            {QUIZ_QUESTIONS[currentQIdx].text}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {quizOptions.shuffledOptions.map((opt, idx) => {
              const isSelected = selectedOpt === idx;
              const isCorrect = idx === quizOptions.correctOptionIdx;

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
