/** @sim {"name": "Sim 1.5: Activation Functions", "description": "Visualize how non-linear activation functions (ReLU, Sigmoid, Tanh) warp linear outputs."} */
import { useState } from 'react';
import { motion } from 'framer-motion';

type ActivationType = 'linear' | 'step' | 'sigmoid' | 'tanh' | 'relu';

export default function ActivationVisualizer() {
  const [activation, setActivation] = useState<ActivationType>('relu');
  const [inputX, setInputX] = useState<number>(1.0);
  
  const calculateActivation = (x: number, type: ActivationType) => {
    switch(type) {
      case 'linear': return x;
      case 'step': return x >= 0 ? 1 : 0;
      case 'sigmoid': return 1 / (1 + Math.exp(-x));
      case 'tanh': return Math.tanh(x);
      case 'relu': return Math.max(0, x);
    }
  };

  const outputY = calculateActivation(inputX, activation);

  // Generate SVG path for the graph
  const points = [];
  for (let x = -5; x <= 5; x += 0.1) {
    const y = calculateActivation(x, activation);
    // Map x in [-5, 5] to [0, 400]
    // Map y in [-2, 2] to [400, 0] (for step, sigmoid, tanh, relu)
    const px = ((x + 5) / 10) * 400;
    const py = 400 - ((y + 2) / 4) * 400; 
    points.push(`${px},${py}`);
  }
  const pathData = `M ${points.join(' L ')}`;

  const currentPx = ((inputX + 5) / 10) * 400;
  const currentPy = 400 - ((outputY + 2) / 4) * 400;

  return (
    <div className="bg-obsidian border border-white/10 ares-cut-sm p-6 text-marble font-sans max-w-4xl mx-auto my-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold font-heading text-ares-gold uppercase tracking-wider">Sim 1.5: Activation Functions</h2>
          <p className="text-sm text-marble/60">Watch how non-linear functions warp the output of a neuron.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="col-span-1 space-y-6">
          <div className="space-y-2">
            <span className="text-xs font-bold text-ares-red uppercase tracking-widest block mb-2">Select Function</span>
            <div className="flex flex-col gap-2">
              {(['linear', 'step', 'sigmoid', 'tanh', 'relu'] as const).map(type => (
                <button
                  key={type}
                  onClick={() => setActivation(type)}
                  className={`px-4 py-2 ares-cut-sm text-left uppercase font-bold text-sm tracking-wider transition-colors ${
                    activation === type 
                      ? 'bg-ares-red text-white border-none' 
                      : 'bg-white/5 border border-white/10 text-marble/60 hover:text-marble hover:bg-white/10'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-black/30 p-4 ares-cut-sm border border-white/5 space-y-4">
            <div>
              <div className="flex justify-between text-xs text-marble/60 mb-1">
                <span>Input (x)</span>
                <span className="font-mono text-ares-cyan">{inputX.toFixed(2)}</span>
              </div>
              <label htmlFor="input-x-range" className="sr-only">Input X value</label>
              <input 
                id="input-x-range"
                type="range" min="-5" max="5" step="0.1" 
                value={inputX} onChange={e => setInputX(parseFloat(e.target.value))}
                className="w-full accent-ares-cyan"
              />
            </div>
            
            <div className="pt-2 border-t border-white/10">
              <div className="flex justify-between text-xs text-marble/60 mb-1">
                <span>Output f(x)</span>
                <span className="font-mono text-ares-gold text-lg">{outputY.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="col-span-2 bg-black/50 border border-white/10 rounded-lg p-4 relative flex items-center justify-center min-h-[400px]">
          <svg viewBox="0 0 400 400" className="w-full max-w-[400px] h-auto overflow-visible">
            {/* Grid & Axes */}
            <line x1="0" y1="200" x2="400" y2="200" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
            <line x1="200" y1="0" x2="200" y2="400" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
            <text x="385" y="215" fill="rgba(255,255,255,0.4)" fontSize="10">x</text>
            <text x="205" y="15" fill="rgba(255,255,255,0.4)" fontSize="10">f(x)</text>

            {/* Function Line */}
            <path 
              d={pathData} 
              fill="none" 
              stroke="var(--ares-red, #C00000)" 
              strokeWidth="3" 
              strokeLinejoin="round"
            />

            {/* Current Point */}
            <motion.circle 
              cx={currentPx} 
              cy={currentPy} 
              r="6" 
              fill="var(--ares-gold, #FFB81C)"
              animate={{ cx: currentPx, cy: currentPy }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
            />
            <motion.text
              x={currentPx + 10}
              y={currentPy - 10}
              fill="var(--ares-gold, #FFB81C)"
              fontSize="12"
              fontFamily="monospace"
              animate={{ x: currentPx + 10, y: currentPy - 10 }}
            >
              ({inputX.toFixed(1)}, {outputY.toFixed(2)})
            </motion.text>
          </svg>
        </div>
      </div>
    </div>
  );
}
