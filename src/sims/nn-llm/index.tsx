/** @sim {"name": "Sim 3: LLM Attention", "requiresContext": false} */
import React, { useState, useMemo } from 'react';
import { MessageSquare } from 'lucide-react';

const SENTENCES = [
  "The robot passed the programming test.",
  "I sat on the bank of the river.",
  "I deposited money in the bank.",
  "The quick brown fox jumps over the lazy dog."
];

// Helper to generate a fake but visually interesting attention matrix (NxN)
// Words close to each other attend more, but nouns/verbs attend to each other strongly.
const generateAttentionMatrix = (tokens: string[]) => {
  const N = tokens.length;
  const matrix: number[][] = [];
  
  const importantTags = ['robot', 'passed', 'test', 'bank', 'river', 'deposited', 'money', 'fox', 'jumps', 'dog'];
  
  for (let i = 0; i < N; i++) {
    const row: number[] = [];
    let sum = 0;
    for (let j = 0; j < N; j++) {
      let weight = 1 / (Math.abs(i - j) + 1); // Local context
      
      const t1 = tokens[i].toLowerCase().replace(/[^a-z]/g, '');
      const t2 = tokens[j].toLowerCase().replace(/[^a-z]/g, '');
      
      // Artificial boosting for semantic connections
      if (importantTags.includes(t1) && importantTags.includes(t2) && i !== j) {
        weight += 2.0; // Strong semantic link
      }
      
      // Self attention is usually high
      if (i === j) weight += 3.0;

      // Add a little noise
      weight += Math.random() * 0.5;
      
      row.push(weight);
      sum += weight;
    }
    // Softmax-ish normalization
    matrix.push(row.map(w => w / sum));
  }
  return matrix;
};

export default function NnLlmSim() {
  const [selectedIdx, setSelectedIdx] = useState<number>(0);
  const [hoverToken, setHoverToken] = useState<number | null>(null);

  const tokens = useMemo(() => SENTENCES[selectedIdx].split(' '), [selectedIdx]);
  const attentionMatrix = useMemo(() => generateAttentionMatrix(tokens), [tokens]);

  const formatNum = (n: number) => n.toFixed(2);

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
          <MessageSquare className="w-8 h-8 text-yellow-500" />
          Sim 3: LLM Attention Mechanism
        </h1>
        <p style={{ color: '#9ca3af', margin: 0, fontSize: '15px' }}>
          Large Language Models process sequences by attending to other words in the context. Hover over words to see their attention weights.
        </p>
      </div>

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {SENTENCES.map((s, i) => (
          <button 
            key={i}
            onClick={() => setSelectedIdx(i)}
            style={{ 
              padding: '8px 16px', 
              borderRadius: '20px', 
              border: '1px solid #eab308', 
              background: selectedIdx === i ? '#eab308' : 'transparent', 
              color: selectedIdx === i ? '#000' : '#eab308', 
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: '14px'
            }}
          >
            Example {i + 1}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', flex: 1, gap: '40px' }}>
        
        {/* Token Visualization */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <h3 style={{ margin: 0, color: '#eab308', borderBottom: '1px solid rgba(234, 179, 8, 0.2)', paddingBottom: '8px' }}>Context Window (Tokens)</h3>
          
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', background: 'rgba(0,0,0,0.2)', padding: '24px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
            {tokens.map((token, i) => {
              // Calculate highlight intensity based on the currently hovered token
              let intensity = 0;
              if (hoverToken !== null) {
                // If hovering over token A, show how much A attends to B (i.e. matrix[hoverToken][i])
                intensity = attentionMatrix[hoverToken][i];
              }

              return (
                <div 
                  key={i}
                  onMouseEnter={() => setHoverToken(i)}
                  onMouseLeave={() => setHoverToken(null)}
                  style={{
                    padding: '12px 20px',
                    background: hoverToken === i ? '#eab308' : `rgba(234, 179, 8, ${intensity})`,
                    color: hoverToken === i ? '#000' : '#fff',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    border: '1px solid',
                    borderColor: hoverToken === i ? '#eab308' : 'rgba(234, 179, 8, 0.3)',
                    position: 'relative',
                    transform: hoverToken === i ? 'scale(1.05)' : 'scale(1)',
                    boxShadow: hoverToken === i ? '0 0 20px rgba(234, 179, 8, 0.4)' : 'none'
                  }}
                >
                  <span style={{ fontSize: '18px', fontWeight: 'bold' }}>{token}</span>
                  {hoverToken !== null && hoverToken !== i && (
                    <div style={{ position: 'absolute', top: '-25px', left: '50%', transform: 'translateX(-50%)', background: '#000', color: '#eab308', padding: '2px 6px', borderRadius: '4px', fontSize: '11px', border: '1px solid #eab308' }}>
                      {(intensity * 100).toFixed(0)}%
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div style={{ background: 'rgba(234, 179, 8, 0.05)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(234, 179, 8, 0.2)', fontSize: '14px', lineHeight: 1.5 }}>
            <strong>How it works:</strong> In a transformer, the <span style={{ color: '#eab308' }}>Attention Mechanism</span> computes a weight between every pair of words. 
            When you hover over a word (the &quot;Query&quot;), the highlighting shows which other words (the &quot;Keys&quot;) it is focusing on to understand its own context. This allows words like &quot;bank&quot; to change meaning depending on whether they attend to &quot;river&quot; or &quot;money&quot;.
          </div>
        </div>

        {/* Matrix Visualization */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '24px' }}>
           <h3 style={{ margin: 0, color: '#eab308', borderBottom: '1px solid rgba(234, 179, 8, 0.2)', paddingBottom: '8px' }}>Attention Matrix (Softmax(Q×K^T))</h3>
           
           <div style={{ overflowX: 'auto', background: 'rgba(0,0,0,0.2)', padding: '24px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)', flex: 1 }}>
              <div style={{ display: 'flex', gap: '2px' }}>
                <div style={{ width: '80px' }} /> {/* Corner */}
                {tokens.map((t, i) => (
                  <div key={`col-${i}`} style={{ width: '40px', fontSize: '11px', color: '#9ca3af', transform: 'rotate(-45deg)', transformOrigin: 'bottom left', height: '60px', display: 'flex', alignItems: 'flex-end' }}>
                    {t}
                  </div>
                ))}
              </div>
              
              {attentionMatrix.map((row, i) => (
                <div key={`row-${i}`} style={{ display: 'flex', gap: '2px', marginBottom: '2px' }}>
                  <div style={{ width: '80px', fontSize: '12px', color: '#9ca3af', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: '8px' }}>
                    {tokens[i]}
                  </div>
                  {row.map((val, j) => (
                    <div 
                      key={`cell-${i}-${j}`}
                      onMouseEnter={() => setHoverToken(i)}
                      onMouseLeave={() => setHoverToken(null)}
                      style={{
                        width: '40px',
                        height: '40px',
                        background: `rgba(234, 179, 8, ${val})`,
                        border: '1px solid rgba(255,255,255,0.05)',
                        borderRadius: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '10px',
                        color: val > 0.5 ? '#000' : 'rgba(255,255,255,0.5)',
                        fontWeight: val > 0.5 ? 'bold' : 'normal',
                        cursor: 'crosshair',
                        boxShadow: (hoverToken === i || hoverToken === j) ? 'inset 0 0 0 2px #fff' : 'none'
                      }}
                    >
                      {formatNum(val)}
                    </div>
                  ))}
                </div>
              ))}
           </div>
        </div>

      </div>
    </div>
  );
}
