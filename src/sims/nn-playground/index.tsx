/** @sim {"name": "Sim 6: Neural Playground", "description": "The ultimate sandbox for neural network architecture and experimentation."} */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, RotateCcw, Plus, Minus, Settings2, Brain, Activity, Target } from 'lucide-react';
import { motion } from 'framer-motion';

// --- Math Helpers ---
const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));
const dSigmoid = (x: number) => x * (1 - x); // x is already sigmoid(sum)
const tanh = (x: number) => Math.tanh(x);
const dTanh = (x: number) => 1 - x * x; // x is already tanh(sum)
const relu = (x: number) => Math.max(0, x);
const dRelu = (x: number) => (x > 0 ? 1 : 0);

type Activation = 'sigmoid' | 'tanh' | 'relu';
type DatasetType = 'xor' | 'circles' | 'gaussian' | 'spiral';

interface Point {
  x: number;
  y: number;
  label: number; // 0 or 1
}

// --- Data Generators ---
const generateData = (type: DatasetType, count: number = 200): Point[] => {
  const points: Point[] = [];
  for (let i = 0; i < count; i++) {
    let x, y, label;
    if (type === 'circles') {
      const radius = i < count / 2 ? Math.random() * 2 : 3 + Math.random() * 2;
      const angle = Math.random() * Math.PI * 2;
      x = radius * Math.cos(angle);
      y = radius * Math.sin(angle);
      label = i < count / 2 ? 1 : 0;
    } else if (type === 'xor') {
      x = Math.random() * 10 - 5;
      y = Math.random() * 10 - 5;
      label = (x > 0 && y > 0) || (x < 0 && y < 0) ? 1 : 0;
    } else if (type === 'gaussian') {
      const offset = 2;
      if (i < count / 2) {
        x = Math.random() * 4 - offset - 2;
        y = Math.random() * 4 - offset - 2;
        label = 1;
      } else {
        x = Math.random() * 4 + offset - 2;
        y = Math.random() * 4 + offset - 2;
        label = 0;
      }
    } else { // spiral
      const n = count / 2;
      const j = i % n;
      const angle = j * 0.1;
      const radius = j * 0.05;
      if (i < n) {
        x = radius * Math.sin(angle);
        y = radius * Math.cos(angle);
        label = 1;
      } else {
        x = -radius * Math.sin(angle);
        y = -radius * Math.cos(angle);
        label = 0;
      }
    }
    points.push({ x, y, label });
  }
  return points;
};

const createNetwork = (layers: number[]) => {
  const newWeights: number[][][] = [];
  const newBiases: number[][] = [];
  const allLayers = [2, ...layers, 1];

  for (let i = 1; i < allLayers.length; i++) {
    const layerWeights: number[][] = [];
    const layerBiases: number[] = [];
    for (let j = 0; j < allLayers[i]; j++) {
      const neuronWeights: number[] = [];
      for (let k = 0; k < allLayers[i - 1]; k++) {
        neuronWeights.push(Math.random() * 2 - 1);
      }
      layerWeights.push(neuronWeights);
      layerBiases.push(Math.random() * 2 - 1);
    }
    newWeights.push(layerWeights);
    newBiases.push(layerBiases);
  }
  return { weights: newWeights, biases: newBiases };
};

const WeightConnections = React.memo(({ weights, layers }: { weights: number[][][], layers: number[] }) => {
  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 0 }}>
      {weights.map((layerWeights, lIdx) => {
        const totalLayers = layers.length + 2;
        const x1 = ((lIdx + 1) / totalLayers) * 100;
        const x2 = ((lIdx + 2) / totalLayers) * 100;
        
        const fromSize = lIdx === 0 ? 2 : layers[lIdx - 1];
        const toSize = layerWeights.length;

        return layerWeights.map((neuronWeights, nIdx) => {
          return neuronWeights.map((w, wIdx) => {
            const y1 = ((wIdx + 0.5) / fromSize) * 100;
            const y2 = ((nIdx + 0.5) / toSize) * 100;
            
            return (
              <line 
                key={`${lIdx}-${nIdx}-${wIdx}`}
                x1={`${x1}%`} y1={`${y1}%`}
                x2={`${x2}%`} y2={`${y2}%`}
                stroke={w > 0 ? '#3b82f6' : '#f59e0b'}
                strokeWidth={Math.abs(w) * 2}
                strokeOpacity={0.4 + Math.abs(w) * 0.4}
              />
            );
          });
        });
      })}
    </svg>
  );
});
WeightConnections.displayName = "WeightConnections";

// --- Main Component ---
export default function NeuralPlayground() {
  // Config
  const [layers, setLayers] = useState<number[]>([4, 2]); // Hidden layer sizes
  const [activation, setActivation] = useState<Activation>('tanh');
  const [learningRate, setLearningRate] = useState(0.03);
  const [datasetType, setDatasetType] = useState<DatasetType>('xor');
  const [isTraining, setIsTraining] = useState(false);
  const [epoch, setEpoch] = useState(0);
  const [loss, setLoss] = useState(0);

  // Network State
  const [weights, setWeights] = useState<number[][][]>(() => createNetwork([4, 2]).weights);
  const [biases, setBiases] = useState<number[][]>(() => createNetwork([4, 2]).biases);

  const resetWeights = useCallback(() => {
    const { weights: newWeights, biases: newBiases } = createNetwork(layers);
    setWeights(newWeights);
    setBiases(newBiases);
  }, [layers]);

  // Data
  const [points, setPoints] = useState<Point[]>(() => generateData('xor'));
  
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setPoints(generateData(datasetType));
      setEpoch(0);
      setLoss(0);
      const { weights: nw, biases: nb } = createNetwork(layers);
      setWeights(nw);
      setBiases(nb);
    });
    return () => cancelAnimationFrame(frame);
  }, [datasetType, layers]);

  // --- Training Loop ---
  const trainStep = useCallback(() => {
    if (weights.length === 0) return;


    let totalLoss = 0;

    // We'll update weights/biases at the end of a batch (size 10)
    const weightGradients = weights.map(l => l.map(n => n.map(() => 0)));
    const biasGradients = biases.map(l => l.map(() => 0));

    const batchSize = 10;
    for (let b = 0; b < batchSize; b++) {
      const p = points[Math.floor(Math.random() * points.length)];
      if (!p) continue;

      // 1. Forward Pass
      const activations: number[][] = [[p.x, p.y]];

      for (let i = 0; i < weights.length; i++) {
        const layerIn = activations[i];
        const layerOut: number[] = [];
        const layerSums: number[] = [];
        const isOutput = i === weights.length - 1;
        const actFn = isOutput ? sigmoid : (activation === 'sigmoid' ? sigmoid : activation === 'tanh' ? tanh : relu);

        for (let j = 0; j < weights[i].length; j++) {
          let sum = biases[i][j];
          for (let k = 0; k < weights[i][j].length; k++) {
            sum += weights[i][j][k] * layerIn[k];
          }
          layerSums.push(sum);
          layerOut.push(actFn(sum));
        }
        activations.push(layerOut);
      }

      const output = activations[activations.length - 1][0];
      const error = p.label - output;
      totalLoss += error * error;

      // 2. Backward Pass
      const deltas: number[][] = [];
      // Output layer delta
      deltas[weights.length - 1] = [error * dSigmoid(output)];

      // Hidden layers deltas
      for (let i = weights.length - 2; i >= 0; i--) {
        const layerDeltas: number[] = [];
        const nextLayerDeltas = deltas[i + 1];
        const nextLayerWeights = weights[i + 1];
        const actDeriv = activation === 'sigmoid' ? dSigmoid : activation === 'tanh' ? dTanh : dRelu;

        for (let j = 0; j < weights[i].length; j++) {
          let errorSum = 0;
          for (let k = 0; k < nextLayerDeltas.length; k++) {
            errorSum += nextLayerDeltas[k] * nextLayerWeights[k][j];
          }
          layerDeltas.push(errorSum * actDeriv(activations[i + 1][j]));
        }
        deltas[i] = layerDeltas;
      }

      // 3. Accumulate Gradients
      for (let i = 0; i < weights.length; i++) {
        for (let j = 0; j < weights[i].length; j++) {
          for (let k = 0; k < weights[i][j].length; k++) {
            weightGradients[i][j][k] += deltas[i][j] * activations[i][k];
          }
          biasGradients[i][j] += deltas[i][j];
        }
      }
    }

    // 4. Update Weights
    setWeights(prev => prev.map((l, i) => l.map((n, j) => n.map((w, k) => w + learningRate * weightGradients[i][j][k] / batchSize))));
    setBiases(prev => prev.map((l, i) => l.map((b, j) => b + learningRate * biasGradients[i][j] / batchSize)));
    setLoss(totalLoss / batchSize);
    setEpoch(e => e + batchSize);
  }, [weights, biases, activation, learningRate, points]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isTraining) {
      interval = setInterval(trainStep, 30);
    }
    return () => clearInterval(interval);
  }, [isTraining, trainStep]);

  // --- Rendering Decisions ---
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || weights.length === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const imageData = ctx.createImageData(width, height);
    const data = imageData.data;

    for (let i = 0; i < width; i++) {
      for (let j = 0; j < height; j++) {
        const x = (i / width) * 10 - 5;
        const y = (j / height) * 10 - 5;

        // Forward Pass
        let currentActivations = [x, y];
        for (let l = 0; l < weights.length; l++) {
          const nextActivations = [];
          const isOutput = l === weights.length - 1;
          const actFn = isOutput ? sigmoid : (activation === 'sigmoid' ? sigmoid : activation === 'tanh' ? tanh : relu);
          for (let n = 0; n < weights[l].length; n++) {
            let sum = biases[l][n];
            for (let k = 0; k < weights[l][n].length; k++) {
              sum += weights[l][n][k] * currentActivations[k];
            }
            nextActivations.push(actFn(sum));
          }
          currentActivations = nextActivations;
        }

        const output = currentActivations[0];
        const idx = (j * width + i) * 4;
        
        // TF Playground Colors: Blue for +, Orange for -
        // output 0 (Orange) to 1 (Blue)
        const r = Math.floor(245 * (1 - output) + 59 * output);
        const g = Math.floor(158 * (1 - output) + 130 * output);
        const b = Math.floor(11 * (1 - output) + 246 * output);
        
        data[idx] = r;
        data[idx+1] = g;
        data[idx+2] = b;
        data[idx+3] = 120; // Transparency
      }
    }
    ctx.putImageData(imageData, 0, 0);
  }, [weights, biases, activation]);

  const addLayer = () => { if (layers.length < 4) setLayers([...layers, 4]); };
  const removeLayer = () => { if (layers.length > 0) setLayers(layers.slice(0, -1)); };
  const updateLayerSize = (idx: number, delta: number) => {
    setLayers(prev => {
      const next = [...prev];
      next[idx] = Math.max(1, Math.min(8, next[idx] + delta));
      return next;
    });
  };


  return (
    <div className="bg-obsidian border border-white/10 ares-cut-lg p-8 text-marble font-sans max-w-7xl mx-auto my-8 min-h-[800px] flex flex-col gap-8">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-ares-red/20 border border-ares-red/30 ares-cut-sm">
            <Brain className="w-8 h-8 text-ares-red" />
          </div>
          <div>
            <h1 className="text-3xl font-bold font-heading text-white uppercase tracking-tighter">Neural Playground</h1>
            <p className="text-sm text-marble/60">ARES Academy Capstone Project • Deep Learning Sandbox</p>
          </div>
        </div>

        <div className="flex gap-4">
          <div className="bg-black/40 border border-white/5 ares-cut-sm px-6 py-3 flex gap-8">
             <div className="text-center">
                <div className="text-[10px] text-marble/60 uppercase tracking-widest mb-1">Epoch</div>
                <div className="text-xl font-mono text-ares-cyan font-bold">{epoch}</div>
             </div>
             <div className="text-center">
                <div className="text-[10px] text-marble/60 uppercase tracking-widest mb-1">Loss</div>
                <div className="text-xl font-mono text-ares-gold font-bold">{loss.toFixed(4)}</div>
             </div>
          </div>
          
          <button 
            onClick={() => setIsTraining(!isTraining)}
            className={`px-8 py-3 ares-cut-sm font-bold uppercase tracking-widest flex items-center gap-2 transition-all ${isTraining ? 'bg-ares-red text-white shadow-[0_0_20px_rgba(192,0,0,0.4)]' : 'bg-ares-cyan text-black hover:scale-105'}`}
          >
            {isTraining ? <><Pause className="w-5 h-5"/> Stop</> : <><Play className="w-5 h-5"/> Train</>}
          </button>

          <button onClick={() => { setEpoch(0); resetWeights(); }} className="p-3 bg-white/5 border border-white/10 hover:bg-white/10 ares-cut-sm transition-colors">
            <RotateCcw className="w-6 h-6 text-marble/60" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-8 flex-1">
        
        {/* Sidebar: Controls */}
        <div className="col-span-3 space-y-6">
          <section className="space-y-4">
            <div className="flex items-center gap-2 text-ares-gold">
               <Settings2 className="w-4 h-4" />
               <span className="text-xs font-bold uppercase tracking-widest">Hyperparameters</span>
            </div>
            
            <div className="space-y-3">
              <label className="block">
                <span className="text-xs text-marble/60 uppercase mb-2 block">Learning Rate: {learningRate}</span>
                <input type="range" min="0.001" max="0.3" step="0.01" value={learningRate} onChange={e => setLearningRate(parseFloat(e.target.value))} className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-ares-cyan" />
              </label>

              <label className="block">
                <span className="text-xs text-marble/60 uppercase mb-2 block">Activation</span>
                <select value={activation} onChange={e => setActivation(e.target.value as Activation)} className="w-full bg-black/50 border border-white/10 ares-cut-sm p-2 text-sm outline-none focus:border-ares-cyan">
                  <option value="tanh">Tanh</option>
                  <option value="sigmoid">Sigmoid</option>
                  <option value="relu">ReLU</option>
                </select>
              </label>
            </div>
          </section>

          <section className="space-y-4 pt-6 border-t border-white/5">
            <div className="flex items-center gap-2 text-ares-red">
               <Target className="w-4 h-4" />
               <span className="text-xs font-bold uppercase tracking-widest">Dataset</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {(['xor', 'circles', 'gaussian', 'spiral'] as DatasetType[]).map(type => (
                <button 
                  key={type} 
                  onClick={() => setDatasetType(type)}
                  className={`p-2 text-[10px] uppercase font-bold tracking-widest border transition-all ${datasetType === type ? 'bg-ares-red/20 border-ares-red text-white' : 'bg-black/30 border-white/10 text-marble/60 hover:border-white/30'}`}
                >
                  {type}
                </button>
              ))}
            </div>
          </section>

          <div className="bg-ares-cyan/5 border border-ares-cyan/20 p-4 ares-cut-sm space-y-2 mt-auto">
            <div className="flex items-center gap-2 text-ares-cyan">
              <Activity className="w-4 h-4" />
              <span className="text-[10px] font-bold uppercase">Real-time Legend</span>
            </div>
            <div className="flex flex-col gap-2 text-[10px] text-marble/60">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-ares-cyan rounded-sm" />
                <span>Positive Weight / Class A</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-ares-gold rounded-sm" />
                <span>Negative Weight / Class B</span>
              </div>
            </div>
          </div>
        </div>

        {/* Center: Network Graph */}
        <div className="col-span-6 bg-black/20 rounded-2xl border border-white/5 relative overflow-hidden flex flex-col items-center justify-center p-8">
           <div className="absolute top-4 left-4 text-[10px] text-white/20 uppercase tracking-widest">Neural Architecture</div>
           
           <div className="flex gap-16 items-center z-10 w-full justify-between px-4">
              {/* Input Layer */}
              <div className="flex flex-col gap-12">
                 {[0, 1].map(i => (
                   <div key={i} className="w-10 h-10 rounded-full bg-white/10 border-2 border-white/20 flex items-center justify-center text-xs font-bold shadow-[0_0_15px_rgba(255,255,255,0.1)]">
                     X{i+1}
                   </div>
                 ))}
              </div>

              {/* Hidden Layers */}
              {layers.map((size, lIdx) => (
                <div key={lIdx} className="flex flex-col gap-4 items-center">
                   <div className="flex flex-col gap-3">
                      {Array.from({ length: size }).map((_, nIdx) => (
                        <motion.div 
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          key={nIdx} 
                          className="w-8 h-8 rounded-full bg-ares-red/20 border-2 border-ares-red/40" 
                        />
                      ))}
                   </div>
                   <div className="flex gap-1 mt-4">
                      <button onClick={() => updateLayerSize(lIdx, -1)} className="p-1 hover:bg-white/10 rounded text-marble/60"><Minus className="w-3 h-3"/></button>
                      <button onClick={() => updateLayerSize(lIdx, 1)} className="p-1 hover:bg-white/10 rounded text-marble/60"><Plus className="w-3 h-3"/></button>
                   </div>
                </div>
              ))}

              {/* Add Layer Button */}
              {layers.length < 4 && (
                <button onClick={addLayer} className="p-2 border-2 border-dashed border-white/10 hover:border-white/30 rounded-full transition-all group">
                   <Plus className="w-4 h-4 text-white/20 group-hover:text-white/60" />
                </button>
              )}

              {/* Output Layer */}
              <div className="w-12 h-12 rounded-full bg-ares-cyan/20 border-2 border-ares-cyan/40 flex items-center justify-center text-[10px] font-bold shadow-[0_0_20px_rgba(0,229,255,0.2)]">
                OUT
              </div>
           </div>

           {/* Weight Connections (SVG) */}
           <WeightConnections weights={weights} layers={layers} />
        </div>

        {/* Right: Decision Boundary */}
        <div className="col-span-3 space-y-4">
          <div className="relative aspect-square w-full bg-black/60 ares-cut-sm border border-white/10 overflow-hidden shadow-2xl">
             <canvas ref={canvasRef} width="200" height="200" className="absolute inset-0 w-full h-full opacity-60" />
             
             {/* Points */}
             <div className="absolute inset-0 pointer-events-none">
                {points.map((p, i) => (
                  <div 
                    key={i}
                    style={{ 
                      position: 'absolute', 
                      left: `${((p.x + 5) / 10) * 100}%`, 
                      top: `${((p.y + 5) / 10) * 100}%`,
                      width: '6px',
                      height: '6px',
                      background: p.label === 1 ? '#3b82f6' : '#f59e0b',
                      borderRadius: '50%',
                      boxShadow: `0 0 8px ${p.label === 1 ? 'rgba(59, 130, 246, 0.8)' : 'rgba(245, 158, 11, 0.8)'}`,
                      transform: 'translate(-50%, -50%)'
                    }}
                  />
                ))}
             </div>

             <div className="absolute bottom-2 left-2 text-[8px] text-white/20 uppercase tracking-widest font-mono">2D Input Field</div>
          </div>

          <div className="bg-black/30 border border-white/5 ares-cut-sm p-4">
             <div className="text-[10px] text-marble/60 uppercase mb-3 block">Architecture Controls</div>
             <div className="flex gap-2">
                <button onClick={removeLayer} disabled={layers.length === 0} className="flex-1 p-2 bg-white/5 border border-white/10 text-[10px] uppercase font-bold hover:bg-white/10 disabled:opacity-20">Remove Layer</button>
                <button onClick={addLayer} disabled={layers.length >= 4} className="flex-1 p-2 bg-white/5 border border-white/10 text-[10px] uppercase font-bold hover:bg-white/10 disabled:opacity-20">Add Layer</button>
             </div>
          </div>
        </div>

      </div>

      <style>{`
        select { -webkit-appearance: none; appearance: none; }
      `}</style>
    </div>
  );
}
