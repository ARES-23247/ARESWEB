/** @sim {"name": "Sim 2.5: Convolutions", "description": "Visualize how a 3x3 filter slides across an image to extract feature maps."} */
import { useState } from 'react';

// 8x8 simple image (e.g. vertical line)
const INITIAL_IMAGE = [
  0,0,0,1,1,0,0,0,
  0,0,0,1,1,0,0,0,
  0,0,0,1,1,0,0,0,
  0,0,0,1,1,0,0,0,
  0,0,0,1,1,0,0,0,
  0,0,0,1,1,0,0,0,
  0,0,0,1,1,0,0,0,
  0,0,0,1,1,0,0,0,
];

// 3x3 Vertical Edge Filter
const VERTICAL_FILTER = [
  -1, 0, 1,
  -1, 0, 1,
  -1, 0, 1
];

// 3x3 Horizontal Edge Filter
const HORIZONTAL_FILTER = [
  -1, -1, -1,
   0,  0,  0,
   1,  1,  1
];

export default function CNNVisualizer() {
  const [filterType, setFilterType] = useState<'vertical' | 'horizontal'>('vertical');
  const [step, setStep] = useState(0); // 0 to 35 (since 6x6 output)
  
  const filter = filterType === 'vertical' ? VERTICAL_FILTER : HORIZONTAL_FILTER;
  
  const row = Math.floor(step / 6);
  const col = step % 6;

  // Compute the full output map
  const outputMap = new Array(36).fill(0);
  for (let r = 0; r < 6; r++) {
    for (let c = 0; c < 6; c++) {
      let sum = 0;
      for (let fr = 0; fr < 3; fr++) {
        for (let fc = 0; fc < 3; fc++) {
          const imgVal = INITIAL_IMAGE[(r + fr) * 8 + (c + fc)];
          const filtVal = filter[fr * 3 + fc];
          sum += imgVal * filtVal;
        }
      }
      outputMap[r * 6 + c] = sum;
    }
  }

  // Determine which pixels in input are currently highlighted by the filter
  const isHighlighted = (r: number, c: number) => {
    return r >= row && r < row + 3 && c >= col && c < col + 3;
  };

  return (
    <div className="bg-obsidian border border-white/10 ares-cut-sm p-6 text-marble font-sans max-w-4xl mx-auto my-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold font-heading text-ares-gold uppercase tracking-wider">Sim 2.5: Convolutions</h2>
          <p className="text-sm text-marble/60">Slide a 3x3 filter across an image to extract features.</p>
        </div>
      </div>

      <div className="mb-6 bg-black/30 p-4 ares-cut-sm border border-white/5">
        <div className="flex gap-4 items-center">
          <span className="text-xs font-bold text-ares-red uppercase tracking-widest">Filter</span>
          <button 
            onClick={() => setFilterType('vertical')}
            className={`px-3 py-1 text-xs font-bold tracking-widest uppercase ares-cut-sm ${filterType === 'vertical' ? 'bg-ares-red text-white' : 'bg-white/10 text-white/60 hover:bg-white/20'}`}
          >
            Vertical Edge
          </button>
          <button 
            onClick={() => setFilterType('horizontal')}
            className={`px-3 py-1 text-xs font-bold tracking-widest uppercase ares-cut-sm ${filterType === 'horizontal' ? 'bg-ares-red text-white' : 'bg-white/10 text-white/60 hover:bg-white/20'}`}
          >
            Horizontal Edge
          </button>
          
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs font-bold text-ares-cyan uppercase">Step {step + 1}/36</span>
            <label htmlFor="step-range" className="sr-only">Step range</label>
            <input 
              id="step-range"
              type="range" min="0" max="35" step="1" 
              value={step} onChange={e => setStep(parseInt(e.target.value))}
              className="w-32 accent-ares-cyan"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center">
        {/* Input Image */}
        <div className="flex flex-col items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-widest text-marble/60">Input Image (8x8)</span>
          <div className="grid grid-cols-8 gap-0 border border-white/20 bg-black">
            {INITIAL_IMAGE.map((val, i) => {
              const r = Math.floor(i / 8);
              const c = i % 8;
              const highlighted = isHighlighted(r, c);
              const filtVal = highlighted ? filter[(r - row) * 3 + (c - col)] : null;
              
              return (
                <div 
                  key={i} 
                  className={`w-8 h-8 flex flex-col items-center justify-center text-[10px] relative transition-colors ${val === 1 ? 'bg-white text-black' : 'bg-transparent text-white/20'}`}
                  style={{
                    boxShadow: highlighted ? 'inset 0 0 0 2px var(--ares-cyan, #00E5FF)' : 'inset 0 0 0 1px rgba(255,255,255,0.05)'
                  }}
                >
                  {highlighted && (
                    <div className={`absolute bottom-0 right-0 p-0.5 text-[8px] font-bold ${val === 1 ? 'text-black' : 'text-ares-cyan'}`}>
                      ×{filtVal}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Math operation */}
        <div className="flex flex-col items-center justify-center text-ares-gold">
          <span className="text-sm font-bold uppercase tracking-widest mb-2">Dot Product</span>
          <div className="text-3xl font-light">→</div>
          <div className="mt-4 text-xs font-mono bg-black/40 p-2 rounded text-marble/80 text-center">
            Sum of (Pixel × Filter)
            <br/><br/>
            Result: <span className="text-ares-gold font-bold text-lg">{outputMap[step]}</span>
          </div>
        </div>

        {/* Feature Map */}
        <div className="flex flex-col items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-widest text-marble/60">Feature Map (6x6)</span>
          <div className="grid grid-cols-6 gap-0 border border-white/20 bg-black">
            {outputMap.map((val, i) => {
              const isCurrent = i === step;
              // Map output value to color intensity (outputs can be positive or negative)
              // Let's normalize it for display: >0 is red, <0 is blue
              const intensity = Math.min(1, Math.abs(val) / 3);
              const bgColor = val > 0 
                ? `rgba(192, 0, 0, ${intensity})` // ares-red
                : val < 0 
                  ? `rgba(0, 229, 255, ${intensity})` // ares-cyan
                  : 'transparent';

              return (
                <div 
                  key={i} 
                  className={`w-10 h-10 flex items-center justify-center text-xs font-bold transition-all`}
                  style={{
                    backgroundColor: i <= step ? bgColor : 'transparent',
                    boxShadow: isCurrent ? 'inset 0 0 0 2px var(--ares-gold, #FFB81C)' : 'inset 0 0 0 1px rgba(255,255,255,0.05)',
                    color: i <= step ? (Math.abs(val) > 1 ? 'white' : 'rgba(255,255,255,0.4)') : 'transparent'
                  }}
                >
                  {val}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
