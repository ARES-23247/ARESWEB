/** @sim {"name": "Sim 1: Neural Networks Basics", "requiresContext": false} */
import React, { useState, useMemo } from 'react';
import { Cpu } from 'lucide-react';

// Segments: 0:Top, 1:TR, 2:BR, 3:Bot, 4:BL, 5:TL, 6:Mid
const DIGIT_SEGMENTS: number[][] = [
  [0, 1, 2, 3, 4, 5],       // 0
  [1, 2],                   // 1
  [0, 1, 6, 4, 3],          // 2
  [0, 1, 6, 2, 3],          // 3
  [5, 6, 1, 2],             // 4
  [0, 5, 6, 2, 3],          // 5
  [0, 5, 4, 3, 2, 6],       // 6
  [0, 1, 2],                // 7
  [0, 1, 2, 3, 4, 5, 6],    // 8
  [0, 5, 6, 1, 2, 3]        // 9
];

export default function NnIntroSim() {
  const [inputs, setInputs] = useState<number[]>([0,0,0,0,0,0,0]);

  const toggleSegment = (idx: number) => {
    setInputs(prev => {
      const next = [...prev];
      next[idx] = next[idx] === 1 ? 0 : 1;
      return next;
    });
  };

  const weights = useMemo(() => {
    const w: number[][] = [];
    for (let i = 0; i < 10; i++) {
      const row: number[] = [];
      for (let j = 0; j < 7; j++) {
        row.push(DIGIT_SEGMENTS[i].includes(j) ? 5 : -5);
      }
      w.push(row);
    }
    return w;
  }, []);

  const biases = useMemo(() => {
    const b: number[] = [];
    for (let i = 0; i < 10; i++) {
      b.push(-5 * (DIGIT_SEGMENTS[i].length - 0.5));
    }
    return b;
  }, []);

  const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));

  const outputs = useMemo(() => {
    return weights.map((row, i) => {
      const sum = row.reduce((acc, w, j) => acc + (w * inputs[j]), 0);
      return sigmoid(sum + biases[i]);
    });
  }, [inputs, weights, biases]);

  const maxOutput = Math.max(...outputs);
  const predictedDigit = outputs.indexOf(maxOutput);

  const formatNum = (n: number) => n.toFixed(2);
  const getColor = (val: number) => val > 0 ? '#3b82f6' : '#f59e0b';

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
      <div>
        <h1 style={{ fontSize: '28px', fontWeight: 'bold', margin: '0 0 8px 0', color: '#fff', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Cpu className="w-8 h-8 text-blue-500" />
          Sim 1: Neural Networks Basics
        </h1>
        <p style={{ color: '#9ca3af', margin: 0, fontSize: '15px' }}>
          A 7-segment display connected to a 10-node output layer. Click the segments to draw a number!
        </p>
      </div>

      <div style={{ display: 'flex', flex: 1, gap: '40px', alignItems: 'center', justifyContent: 'center' }}>
        
        {/* Input Layer (Interactive 7-Segment) */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
          <h3 style={{ margin: 0, color: '#60a5fa' }}>Input Layer (7)</h3>
          <div style={{ position: 'relative', width: '120px', height: '200px' }}>
            {/* Top (0) */}
            <div 
              role="button"
              tabIndex={0}
              onClick={() => toggleSegment(0)} 
              onKeyDown={(e) => e.key === 'Enter' && toggleSegment(0)}
              aria-label="Toggle top segment"
              style={{ position: 'absolute', top: '10px', left: '20px', width: '80px', height: '20px', background: inputs[0] ? '#ef4444' : '#374151', borderRadius: '10px', cursor: 'pointer', transition: '0.2s', boxShadow: inputs[0] ? '0 0 15px #ef4444' : 'none' }} 
            />
            {/* TR (1) */}
            <div 
              role="button"
              tabIndex={0}
              onClick={() => toggleSegment(1)} 
              onKeyDown={(e) => e.key === 'Enter' && toggleSegment(1)}
              aria-label="Toggle top right segment"
              style={{ position: 'absolute', top: '30px', right: '0', width: '20px', height: '60px', background: inputs[1] ? '#ef4444' : '#374151', borderRadius: '10px', cursor: 'pointer', transition: '0.2s', boxShadow: inputs[1] ? '0 0 15px #ef4444' : 'none' }} 
            />
            {/* BR (2) */}
            <div 
              role="button"
              tabIndex={0}
              onClick={() => toggleSegment(2)} 
              onKeyDown={(e) => e.key === 'Enter' && toggleSegment(2)}
              aria-label="Toggle bottom right segment"
              style={{ position: 'absolute', bottom: '30px', right: '0', width: '20px', height: '60px', background: inputs[2] ? '#ef4444' : '#374151', borderRadius: '10px', cursor: 'pointer', transition: '0.2s', boxShadow: inputs[2] ? '0 0 15px #ef4444' : 'none' }} 
            />
            {/* Bot (3) */}
            <div 
              role="button"
              tabIndex={0}
              onClick={() => toggleSegment(3)} 
              onKeyDown={(e) => e.key === 'Enter' && toggleSegment(3)}
              aria-label="Toggle bottom segment"
              style={{ position: 'absolute', bottom: '10px', left: '20px', width: '80px', height: '20px', background: inputs[3] ? '#ef4444' : '#374151', borderRadius: '10px', cursor: 'pointer', transition: '0.2s', boxShadow: inputs[3] ? '0 0 15px #ef4444' : 'none' }} 
            />
            {/* BL (4) */}
            <div 
              role="button"
              tabIndex={0}
              onClick={() => toggleSegment(4)} 
              onKeyDown={(e) => e.key === 'Enter' && toggleSegment(4)}
              aria-label="Toggle bottom left segment"
              style={{ position: 'absolute', bottom: '30px', left: '0', width: '20px', height: '60px', background: inputs[4] ? '#ef4444' : '#374151', borderRadius: '10px', cursor: 'pointer', transition: '0.2s', boxShadow: inputs[4] ? '0 0 15px #ef4444' : 'none' }} 
            />
            {/* TL (5) */}
            <div 
              role="button"
              tabIndex={0}
              onClick={() => toggleSegment(5)} 
              onKeyDown={(e) => e.key === 'Enter' && toggleSegment(5)}
              aria-label="Toggle top left segment"
              style={{ position: 'absolute', top: '30px', left: '0', width: '20px', height: '60px', background: inputs[5] ? '#ef4444' : '#374151', borderRadius: '10px', cursor: 'pointer', transition: '0.2s', boxShadow: inputs[5] ? '0 0 15px #ef4444' : 'none' }} 
            />
            {/* Mid (6) */}
            <div 
              role="button"
              tabIndex={0}
              onClick={() => toggleSegment(6)} 
              onKeyDown={(e) => e.key === 'Enter' && toggleSegment(6)}
              aria-label="Toggle middle segment"
              style={{ position: 'absolute', top: '90px', left: '20px', width: '80px', height: '20px', background: inputs[6] ? '#ef4444' : '#374151', borderRadius: '10px', cursor: 'pointer', transition: '0.2s', boxShadow: inputs[6] ? '0 0 15px #ef4444' : 'none' }} 
            />
          </div>
          <div style={{ display: 'flex', gap: '4px' }}>
            <button onClick={() => setInputs([0,0,0,0,0,0,0])} style={{ padding: '6px 12px', background: 'transparent', border: '1px solid #4b5563', color: '#9ca3af', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>Clear</button>
            <button onClick={() => setInputs(DIGIT_SEGMENTS[Math.floor(Math.random()*10)].reduce((a,c)=>{a[c]=1;return a}, [0,0,0,0,0,0,0]))} style={{ padding: '6px 12px', background: 'transparent', border: '1px solid #4b5563', color: '#9ca3af', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>Random</button>
          </div>
        </div>

        {/* Weights Visualization (Abstract representation) */}
        <div style={{ flex: 1, height: '400px', position: 'relative', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', background: 'rgba(0,0,0,0.2)', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: '10px', left: '0', width: '100%', textAlign: 'center', fontSize: '12px', color: '#6b7280' }}>
            Dense Connections (70 weights)
          </div>
          <svg style={{ width: '100%', height: '100%' }}>
            {/* Render a subset or stylized lines for effect */}
            {weights.map((row, outIdx) => 
              row.map((w, inIdx) => (
                <line 
                  key={`${outIdx}-${inIdx}`}
                  x1="0%" 
                  y1={`${15 + inIdx * 12}%`} 
                  x2="100%" 
                  y2={`${5 + outIdx * 10}%`} 
                  stroke={getColor(w)} 
                  strokeWidth={Math.abs(w) / 3} 
                  opacity={inputs[inIdx] ? 0.6 : 0.05} 
                />
              ))
            )}
          </svg>
        </div>

        {/* Output Layer (10 Nodes) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px', background: 'rgba(59, 130, 246, 0.05)', borderRadius: '16px', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
          <h3 style={{ margin: '0 0 8px 0', color: '#60a5fa', textAlign: 'center' }}>Output Layer (10)</h3>
          {outputs.map((val, idx) => {
            const isWinner = maxOutput > 0.5 && idx === predictedDigit;
            return (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '24px', fontWeight: 'bold', color: isWinner ? '#fff' : '#9ca3af', textAlign: 'center' }}>{idx}</div>
                <div style={{ flex: 1, height: '12px', background: 'rgba(0,0,0,0.5)', borderRadius: '6px', overflow: 'hidden', minWidth: '100px' }}>
                  <div style={{ height: '100%', width: `${val * 100}%`, background: isWinner ? '#4ade80' : '#3b82f6', transition: '0.3s' }} />
                </div>
                <div style={{ width: '40px', fontSize: '12px', color: isWinner ? '#4ade80' : '#6b7280', textAlign: 'right' }}>
                  {formatNum(val)}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
