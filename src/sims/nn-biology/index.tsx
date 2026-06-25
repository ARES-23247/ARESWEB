/** @sim {"name": "Sim 0: The Single Neuron", "requiresContext": false} */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, RotateCcw, Brain, Zap, Code } from 'lucide-react';

type Mode = 'single' | 'network';

export default function NnBiologySim() {
  const [mode, setMode] = useState<Mode>('single');
  
  // Single Neuron State
  const [inputs, setInputs] = useState<[number, number]>([1, 0]);
  const [weights, setWeights] = useState<[number, number]>([0.5, -0.5]);
  const [bias, setBias] = useState<number>(0);
  const [target, setTarget] = useState<number>(1);
  const [learningRate] = useState<number>(0.1);
  const [isLearning, setIsLearning] = useState(false);
  const [epochs, setEpochs] = useState(0);
  
  // Network State (2 inputs, 2 hidden, 1 output)
  const [netInputs, setNetInputs] = useState<[number, number]>([1, 1]);
  // Hidden layer weights: [h1_w1, h1_w2, h2_w1, h2_w2]
  const [hWeights, setHWeights] = useState<[number, number, number, number]>([0.5, -0.5, 0.2, 0.8]);
  const [hBiases, setHBiases] = useState<[number, number]>([0, 0]);
  // Output layer weights: [o_w1, o_w2]
  const [oWeights, setOWeights] = useState<[number, number]>([0.5, 0.5]);
  const [oBias, setOBias] = useState<number>(0);
  const [netTarget, setNetTarget] = useState<number>(0); // e.g., XOR problem
  
  const learningInterval = useRef<NodeJS.Timeout | null>(null);

  // Helper: Sigmoid
  const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));
  const sigmoidDerivative = (x: number) => x * (1 - x); // Assuming x is already passed through sigmoid

  // Single Neuron Math
  const singleSum = (inputs[0] * weights[0]) + (inputs[1] * weights[1]) + bias;
  const singleOut = sigmoid(singleSum);
  const singleError = target - singleOut;

  // Network Math
  const h1Sum = (netInputs[0] * hWeights[0]) + (netInputs[1] * hWeights[1]) + hBiases[0];
  const h1Out = sigmoid(h1Sum);
  const h2Sum = (netInputs[0] * hWeights[2]) + (netInputs[1] * hWeights[3]) + hBiases[1];
  const h2Out = sigmoid(h2Sum);
  
  const oSum = (h1Out * oWeights[0]) + (h2Out * oWeights[1]) + oBias;
  const oOut = sigmoid(oSum);
  const netError = netTarget - oOut;

  const stepSingleLearning = useCallback(() => {
    setWeights(prev => {
      const gradient = singleError * sigmoidDerivative(singleOut);
      return [
        prev[0] + (learningRate * gradient * inputs[0]),
        prev[1] + (learningRate * gradient * inputs[1])
      ];
    });
    setBias(prev => prev + (learningRate * singleError * sigmoidDerivative(singleOut)));
    setEpochs(e => e + 1);
  }, [singleError, singleOut, learningRate, inputs]);

  const stepNetworkLearning = useCallback(() => {
    // Backprop for simple network
    const oGradient = netError * sigmoidDerivative(oOut);
    
    // Hidden gradients
    const h1Gradient = oGradient * oWeights[0] * sigmoidDerivative(h1Out);
    const h2Gradient = oGradient * oWeights[1] * sigmoidDerivative(h2Out);

    // Update Output Weights & Bias
    setOWeights(prev => [
      prev[0] + (learningRate * oGradient * h1Out),
      prev[1] + (learningRate * oGradient * h2Out)
    ]);
    setOBias(prev => prev + (learningRate * oGradient));

    // Update Hidden Weights & Biases
    setHWeights(prev => [
      prev[0] + (learningRate * h1Gradient * netInputs[0]),
      prev[1] + (learningRate * h1Gradient * netInputs[1]),
      prev[2] + (learningRate * h2Gradient * netInputs[0]),
      prev[3] + (learningRate * h2Gradient * netInputs[1])
    ]);
    setHBiases(prev => [
      prev[0] + (learningRate * h1Gradient),
      prev[1] + (learningRate * h2Gradient)
    ]);
    
    setEpochs(e => e + 1);
  }, [netError, oOut, oWeights, h1Out, h2Out, learningRate, netInputs]);

  useEffect(() => {
    if (isLearning) {
      learningInterval.current = setInterval(() => {
        if (mode === 'single') stepSingleLearning();
        else stepNetworkLearning();
      }, 50);
    } else if (learningInterval.current) {
      clearInterval(learningInterval.current);
    }
    return () => {
      if (learningInterval.current) clearInterval(learningInterval.current);
    };
  }, [isLearning, mode, stepSingleLearning, stepNetworkLearning]); 

  const toggleLearning = () => setIsLearning(!isLearning);
  const resetSingle = () => {
    setIsLearning(false);
    setWeights([0.5, -0.5]);
    setBias(0);
    setEpochs(0);
  };
  const resetNetwork = () => {
    setIsLearning(false);
    setHWeights([0.5, -0.5, 0.2, 0.8]);
    setHBiases([0, 0]);
    setOWeights([0.5, 0.5]);
    setOBias(0);
    setEpochs(0);
  };

  const formatNum = (n: number) => n.toFixed(2);
  const getColor = (val: number) => val > 0 ? '#3b82f6' : val < 0 ? '#f59e0b' : '#9ca3af';

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      padding: '24px',
      gap: '24px',
      overflow: 'auto',
      color: '#f3f4f6',
      background: '#0f1115',
      fontFamily: 'system-ui, sans-serif'
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 'bold', margin: '0 0 8px 0', color: '#fff', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Brain className="w-8 h-8 text-pink-500" />
            Sim 0: The Single Neuron
          </h1>
          <p style={{ color: '#9ca3af', margin: 0, fontSize: '15px' }}>
            From biological synapses to artificial perceptrons and basic networks.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', background: 'rgba(255,255,255,0.05)', padding: '4px', borderRadius: '8px' }}>
          <button 
            onClick={() => { setMode('single'); setIsLearning(false); }}
            style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', background: mode === 'single' ? '#3b82f6' : 'transparent', color: mode === 'single' ? '#fff' : '#9ca3af', cursor: 'pointer', fontWeight: 600 }}
          >
            1. Single Neuron
          </button>
          <button 
            onClick={() => { setMode('network'); setIsLearning(false); }}
            style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', background: mode === 'network' ? '#8b5cf6' : 'transparent', color: mode === 'network' ? '#fff' : '#9ca3af', cursor: 'pointer', fontWeight: 600 }}
          >
            2. Simple Network
          </button>
        </div>
      </div>

      {mode === 'single' ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', flex: 1 }}>
          
          {/* Biology Side */}
          <div style={{ background: 'rgba(236, 72, 153, 0.05)', border: '1px solid rgba(236, 72, 153, 0.2)', borderRadius: '16px', padding: '24px', display: 'flex', flexDirection: 'column' }}>
            <h2 style={{ color: '#ec4899', margin: '0 0 16px 0', fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Zap className="w-5 h-5" /> Biological Neuron
            </h2>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ flex: 1, textAlign: 'right', color: '#fbcfe8' }}>
                  <strong>Dendrites</strong><br/>
                  <div style={{ display: 'flex', gap: '16px', fontSize: '12px', justifyContent: 'flex-end', margin: '4px 0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><div style={{ width: '12px', height: '12px', background: '#3b82f6' }}/> Excitatory (+)</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><div style={{ width: '12px', height: '12px', background: '#f59e0b' }}/> Inhibitory (-)</div>
                  </div>
                  <strong>Soma (Cell Body)</strong><br/>
                  <span style={{ fontSize: '13px', opacity: 0.7 }}>Accumulates signals (Summation)</span>
                </div>
                <div style={{ width: '60px', height: '60px', background: 'radial-gradient(circle, #f472b6 0%, #be185d 100%)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 20px rgba(236, 72, 153, 0.4)' }}>
                  <div style={{ width: '20px', height: '20px', background: '#831843', borderRadius: '50%' }} />
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ flex: 1, textAlign: 'right', color: '#fbcfe8' }}>
                  <strong>Axon & Synapses</strong><br/>
                  <span style={{ fontSize: '13px', opacity: 0.7 }}>Fires if threshold is met (Activation & Output)</span>
                </div>
                <div style={{ width: '4px', height: '60px', background: '#ec4899', position: 'relative' }}>
                   {singleOut > 0.5 && <div style={{ position: 'absolute', top: 0, left: '-4px', width: '12px', height: '12px', background: '#fff', borderRadius: '50%', boxShadow: '0 0 10px #fff', animation: 'drop 1s infinite' }} />}
                </div>
              </div>
              <style>{`@keyframes drop { 0% { top: 0; opacity: 1; } 100% { top: 60px; opacity: 0; } }`}</style>
            </div>
            <div style={{ fontSize: '13px', color: '#fbcfe8', opacity: 0.8, lineHeight: 1.5, background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '8px' }}>
              In biology, neurons receive neurotransmitters from neighbors. If the total charge exceeds a threshold, it fires an electrical spike down its axon. We model this mathematically!
            </div>
          </div>

          {/* Artificial Side */}
          <div style={{ background: 'rgba(59, 130, 246, 0.05)', border: '1px solid rgba(59, 130, 246, 0.2)', borderRadius: '16px', padding: '24px', display: 'flex', flexDirection: 'column' }}>
            <h2 style={{ color: '#3b82f6', margin: '0 0 16px 0', fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Code className="w-5 h-5" /> Artificial Perceptron
            </h2>
            
            {/* Interactive Graph */}
            <div style={{ flex: 1, position: 'relative', minHeight: '250px' }}>
              {/* Inputs */}
              <div style={{ position: 'absolute', left: '10%', top: '20%', display: 'flex', flexDirection: 'column', gap: '60px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button onClick={() => setInputs(p => [p[0] === 1 ? 0 : 1, p[1]])} style={{ width: '40px', height: '40px', borderRadius: '50%', border: '2px solid #60a5fa', background: inputs[0] ? '#2563eb' : '#1e3a8a', color: '#fff', cursor: 'pointer', fontWeight: 'bold' }}>{inputs[0]}</button>
                  <span style={{ fontSize: '12px', color: '#9ca3af' }}>x₁</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button onClick={() => setInputs(p => [p[0], p[1] === 1 ? 0 : 1])} style={{ width: '40px', height: '40px', borderRadius: '50%', border: '2px solid #60a5fa', background: inputs[1] ? '#2563eb' : '#1e3a8a', color: '#fff', cursor: 'pointer', fontWeight: 'bold' }}>{inputs[1]}</button>
                  <span style={{ fontSize: '12px', color: '#9ca3af' }}>x₂</span>
                </div>
              </div>

              {/* Weights */}
              <div style={{ position: 'absolute', left: '30%', top: '22%', display: 'flex', flexDirection: 'column', gap: '80px', fontSize: '12px' }}>
                <div style={{ color: getColor(weights[0]) }}>w₁: {formatNum(weights[0])}</div>
                <div style={{ color: getColor(weights[1]) }}>w₂: {formatNum(weights[1])}</div>
              </div>

              {/* Connecting Lines */}
              <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 0, pointerEvents: 'none' }}>
                <line x1="20%" y1="28%" x2="60%" y2="50%" stroke={getColor(weights[0])} strokeWidth={Math.max(1, Math.abs(weights[0]) * 5)} opacity={inputs[0] ? 0.8 : 0.2} />
                <line x1="20%" y1="70%" x2="60%" y2="50%" stroke={getColor(weights[1])} strokeWidth={Math.max(1, Math.abs(weights[1]) * 5)} opacity={inputs[1] ? 0.8 : 0.2} />
                <line x1="60%" y1="50%" x2="80%" y2="50%" stroke={getColor(singleOut - 0.5)} strokeWidth="4" />
              </svg>

              {/* Node */}
              <div style={{ position: 'absolute', left: '60%', top: '50%', transform: 'translate(-50%, -50%)', width: '80px', height: '80px', borderRadius: '50%', background: '#1e3a8a', border: '3px solid #60a5fa', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 1, boxShadow: '0 0 20px rgba(59, 130, 246, 0.3)' }}>
                <div style={{ fontSize: '10px', color: '#9ca3af' }}>Σ = {formatNum(singleSum)}</div>
                <div style={{ width: '80%', height: '1px', background: '#3b82f6', margin: '4px 0' }} />
                <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#fff' }}>σ({formatNum(singleOut)})</div>
              </div>

              <div style={{ position: 'absolute', left: '60%', top: '75%', transform: 'translateX(-50%)', fontSize: '12px', color: '#9ca3af', textAlign: 'center' }}>
                Bias (b): <span style={{ color: getColor(bias) }}>{formatNum(bias)}</span>
              </div>

              {/* Output */}
              <div style={{ position: 'absolute', left: '85%', top: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#fff' }}>{formatNum(singleOut)}</div>
                <div style={{ fontSize: '12px', color: '#9ca3af' }}>Output</div>
              </div>
            </div>

            {/* Learning Controls */}
            <div style={{ background: 'rgba(0,0,0,0.3)', padding: '16px', borderRadius: '12px', marginTop: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '14px', color: '#9ca3af' }}>Target:</span>
                  <button onClick={() => setTarget(0)} style={{ padding: '4px 12px', borderRadius: '4px', border: '1px solid #4b5563', background: target === 0 ? '#4b5563' : 'transparent', color: '#fff', cursor: 'pointer' }}>0</button>
                  <button onClick={() => setTarget(1)} style={{ padding: '4px 12px', borderRadius: '4px', border: '1px solid #4b5563', background: target === 1 ? '#4b5563' : 'transparent', color: '#fff', cursor: 'pointer' }}>1</button>
                </div>
                <div style={{ fontSize: '14px', color: '#9ca3af' }}>
                  Error: <span style={{ color: getColor(-Math.abs(singleError)), fontWeight: 'bold' }}>{formatNum(singleError)}</span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <button onClick={toggleLearning} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: 'none', background: isLearning ? '#ef4444' : '#10b981', color: '#fff', fontWeight: 'bold', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
                  {isLearning ? 'Stop Learning' : <><Play className="w-4 h-4"/> Learn (Backprop)</>}
                </button>
                <button onClick={resetSingle} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #4b5563', background: 'transparent', color: '#d1d5db', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                  <RotateCcw className="w-4 h-4" />
                </button>
              </div>
              <div style={{ fontSize: '11px', color: '#6b7280', textAlign: 'center', marginTop: '8px' }}>
                Epochs: {epochs} | Learning Rate: {learningRate}
              </div>
            </div>
          </div>

        </div>
      ) : (
        /* Simple Network View */
        <div style={{ background: 'rgba(139, 92, 246, 0.05)', border: '1px solid rgba(139, 92, 246, 0.2)', borderRadius: '16px', padding: '32px', display: 'flex', flexDirection: 'column', flex: 1 }}>
          <h2 style={{ color: '#8b5cf6', margin: '0 0 24px 0', fontSize: '22px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Brain className="w-6 h-6" /> The Simple Network (XOR Problem)
          </h2>
          <p style={{ color: '#c4b5fd', fontSize: '14px', margin: '0 0 24px 0', maxWidth: '600px' }}>
            A single neuron can only separate data with a straight line. To solve complex problems like XOR (Output 1 only if inputs are different), we must connect them into a network.
          </p>

          <div style={{ flex: 1, position: 'relative', minHeight: '350px' }}>
            {/* Inputs */}
            <div style={{ position: 'absolute', left: '5%', top: '50%', transform: 'translateY(-50%)', display: 'flex', flexDirection: 'column', gap: '100px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button onClick={() => setNetInputs(p => [p[0] === 1 ? 0 : 1, p[1]])} style={{ width: '48px', height: '48px', borderRadius: '50%', border: '2px solid #a78bfa', background: netInputs[0] ? '#7c3aed' : '#4c1d95', color: '#fff', cursor: 'pointer', fontWeight: 'bold', fontSize: '16px' }}>{netInputs[0]}</button>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button onClick={() => setNetInputs(p => [p[0], p[1] === 1 ? 0 : 1])} style={{ width: '48px', height: '48px', borderRadius: '50%', border: '2px solid #a78bfa', background: netInputs[1] ? '#7c3aed' : '#4c1d95', color: '#fff', cursor: 'pointer', fontWeight: 'bold', fontSize: '16px' }}>{netInputs[1]}</button>
              </div>
            </div>

            {/* Connecting Lines */}
            <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 0, pointerEvents: 'none' }}>
              {/* Input to Hidden */}
              <line x1="8%" y1="35%" x2="45%" y2="25%" stroke={getColor(hWeights[0])} strokeWidth={Math.max(1, Math.abs(hWeights[0]) * 5)} opacity={netInputs[0] ? 0.8 : 0.2} />
              <line x1="8%" y1="35%" x2="45%" y2="75%" stroke={getColor(hWeights[2])} strokeWidth={Math.max(1, Math.abs(hWeights[2]) * 5)} opacity={netInputs[0] ? 0.8 : 0.2} />
              
              <line x1="8%" y1="65%" x2="45%" y2="25%" stroke={getColor(hWeights[1])} strokeWidth={Math.max(1, Math.abs(hWeights[1]) * 5)} opacity={netInputs[1] ? 0.8 : 0.2} />
              <line x1="8%" y1="65%" x2="45%" y2="75%" stroke={getColor(hWeights[3])} strokeWidth={Math.max(1, Math.abs(hWeights[3]) * 5)} opacity={netInputs[1] ? 0.8 : 0.2} />

              {/* Hidden to Output */}
              <line x1="45%" y1="25%" x2="85%" y2="50%" stroke={getColor(oWeights[0])} strokeWidth={Math.max(1, Math.abs(oWeights[0]) * 5)} opacity={h1Out > 0.5 ? 0.8 : 0.2} />
              <line x1="45%" y1="75%" x2="85%" y2="50%" stroke={getColor(oWeights[1])} strokeWidth={Math.max(1, Math.abs(oWeights[1]) * 5)} opacity={h2Out > 0.5 ? 0.8 : 0.2} />
            </svg>

            {/* Hidden Nodes */}
            <div style={{ position: 'absolute', left: '45%', top: '50%', transform: 'translateY(-50%)', display: 'flex', flexDirection: 'column', gap: '100px' }}>
              <div style={{ width: '70px', height: '70px', borderRadius: '50%', background: '#4c1d95', border: '3px solid #a78bfa', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1, boxShadow: '0 0 20px rgba(139, 92, 246, 0.3)', color: '#fff', fontWeight: 'bold' }}>
                {formatNum(h1Out)}
              </div>
              <div style={{ width: '70px', height: '70px', borderRadius: '50%', background: '#4c1d95', border: '3px solid #a78bfa', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1, boxShadow: '0 0 20px rgba(139, 92, 246, 0.3)', color: '#fff', fontWeight: 'bold' }}>
                {formatNum(h2Out)}
              </div>
            </div>

            {/* Output Node */}
            <div style={{ position: 'absolute', left: '85%', top: '50%', transform: 'translateY(-50%)' }}>
              <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: '#1e3a8a', border: '3px solid #60a5fa', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 1, boxShadow: '0 0 30px rgba(59, 130, 246, 0.5)' }}>
                <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#fff' }}>{formatNum(oOut)}</div>
                <div style={{ fontSize: '10px', color: '#9ca3af' }}>Output</div>
              </div>
            </div>

          </div>

          {/* Controls */}
          <div style={{ background: 'rgba(0,0,0,0.3)', padding: '24px', borderRadius: '12px', marginTop: 'auto', display: 'flex', alignItems: 'center', gap: '32px' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '14px', color: '#c4b5fd', marginBottom: '8px' }}>Target for [{netInputs[0]}, {netInputs[1]}]:</div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => setNetTarget(0)} style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #6d28d9', background: netTarget === 0 ? '#6d28d9' : 'transparent', color: '#fff', cursor: 'pointer', fontWeight: 'bold' }}>Target: 0</button>
                <button onClick={() => setNetTarget(1)} style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #6d28d9', background: netTarget === 1 ? '#6d28d9' : 'transparent', color: '#fff', cursor: 'pointer', fontWeight: 'bold' }}>Target: 1</button>
              </div>
            </div>
            
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '14px', color: '#9ca3af', marginBottom: '4px' }}>Network Error</div>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: getColor(-Math.abs(netError)) }}>{formatNum(netError)}</div>
            </div>

            <div style={{ flex: 1, display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
               <button onClick={toggleLearning} style={{ padding: '12px 24px', borderRadius: '8px', border: 'none', background: isLearning ? '#ef4444' : '#10b981', color: '#fff', fontWeight: 'bold', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', fontSize: '16px' }}>
                  {isLearning ? 'Stop Backprop' : <><Play className="w-5 h-5"/> Train Network</>}
                </button>
                <button onClick={resetNetwork} style={{ padding: '12px', borderRadius: '8px', border: '1px solid #4b5563', background: 'transparent', color: '#d1d5db', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                  <RotateCcw className="w-5 h-5" />
                </button>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
