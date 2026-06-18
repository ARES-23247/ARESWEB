/** @sim {"name": "Sim 2: Machine Vision", "requiresContext": false} */
import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { Camera, MousePointerSquareDashed, Eraser, Zap } from 'lucide-react';

// ── 8×8 digit templates ─────────────────────────────────────────────────
const TEMPLATES = [
  ["00111100","01000010","10000001","10000001","10000001","10000001","01000010","00111100"],
  ["00011000","00111000","00011000","00011000","00011000","00011000","00011000","00111100"],
  ["00111100","01000010","00000010","00000100","00001000","00010000","00100000","01111110"],
  ["00111100","01000010","00000010","00011100","00000010","00000010","01000010","00111100"],
  ["00000100","00001100","00010100","00100100","01000100","01111110","00000100","00000100"],
  ["01111110","01000000","01000000","01111100","00000010","00000010","01000010","00111100"],
  ["00111100","01000000","10000000","11111100","10000010","10000010","01000010","00111100"],
  ["01111110","00000010","00000100","00001000","00010000","00100000","00100000","00100000"],
  ["00111100","01000010","01000010","00111100","01000010","01000010","01000010","00111100"],
  ["00111100","01000010","01000010","01000010","00111110","00000010","01000010","00111100"],
];

// ── Tiny NN: 64 inputs → 16 hidden (sigmoid) → 10 outputs (softmax) ──
function buildWeights(templates: string[][]) {
  // Input→Hidden: each hidden node picks up a spatial feature from 2 template digits
  const wIH: number[][] = [];
  for (let h = 0; h < 16; h++) {
    const row: number[] = [];
    const tpl = templates[h % 10].join('');
    // second influencer for more interesting patterns
    const tpl2 = templates[(h + 5) % 10].join('');
    for (let j = 0; j < 64; j++) {
      const v1 = tpl[j] === '1' ? 1.2 : -0.4;
      const v2 = tpl2[j] === '1' ? 0.3 : -0.1;
      row.push(v1 + v2 + (Math.sin(h * 7 + j * 3) * 0.15));
    }
    wIH.push(row);
  }

  // Hidden→Output
  const wHO: number[][] = [];
  for (let o = 0; o < 10; o++) {
    const row: number[] = [];
    for (let h = 0; h < 16; h++) {
      // Strong positive weight when hidden node's primary template matches the output digit
      const primary = h % 10 === o ? 3.0 : -0.5;
      const secondary = (h + 5) % 10 === o ? 1.2 : 0;
      row.push(primary + secondary + (Math.cos(o * 5 + h * 11) * 0.2));
    }
    wHO.push(row);
  }

  // Biases
  const bH = Array.from({ length: 16 }, (_, i) => -8 + (Math.sin(i * 13) * 0.5));
  const bO = Array.from({ length: 10 }, (_, i) => -2 + (Math.cos(i * 7) * 0.3));

  return { wIH, wHO, bH, bO };
}

const sigmoid = (x: number) => 1 / (1 + Math.exp(-Math.max(-20, Math.min(20, x))));

function forwardPass(pixels: number[], wIH: number[][], wHO: number[][], bH: number[], bO: number[]) {
  // Hidden layer
  const hidden = wIH.map((row, i) => {
    const sum = row.reduce((acc, w, j) => acc + w * pixels[j], 0) + bH[i];
    return sigmoid(sum);
  });

  // Output layer (softmax)
  const rawOut = wHO.map((row, i) => {
    return row.reduce((acc, w, j) => acc + w * hidden[j], 0) + bO[i];
  });
  const maxRaw = Math.max(...rawOut);
  const exps = rawOut.map(v => Math.exp(v - maxRaw));
  const sumExps = exps.reduce((a, b) => a + b, 0);
  const outputs = exps.map(e => e / sumExps);

  return { hidden, outputs };
}

// ── SVG Neural Network Graph ────────────────────────────────────────────
function NetworkGraph({
  pixels,
  hidden,
  outputs,
  wIH,
  wHO,
  hoveredOutput,
  hoveredHidden,
  onHoverOutput,
  onHoverHidden,
}: {
  pixels: number[];
  hidden: number[];
  outputs: number[];
  wIH: number[][];
  wHO: number[][];
  hoveredOutput: number | null;
  hoveredHidden: number | null;
  onHoverOutput: (i: number | null) => void;
  onHoverHidden: (i: number | null) => void;
}) {
  const W = 700;
  const H = 420;
  const inputX = 60;
  const hiddenX = 350;
  const outputX = 640;

  // We show a sampled subset of input nodes (16 of 64) for readability
  const sampleInputs = [0, 4, 9, 13, 18, 22, 27, 31, 32, 36, 41, 45, 50, 54, 59, 63];
  const inputNodes = sampleInputs.map((idx, i) => ({
    idx,
    x: inputX,
    y: 30 + (i / (sampleInputs.length - 1)) * (H - 60),
    value: pixels[idx],
  }));

  const hiddenNodes = hidden.map((v, i) => ({
    x: hiddenX,
    y: 20 + (i / (hidden.length - 1)) * (H - 40),
    value: v,
  }));

  const outputNodes = outputs.map((v, i) => ({
    x: outputX,
    y: 50 + (i / (outputs.length - 1)) * (H - 100),
    value: v,
  }));

  const maxOut = Math.max(...outputs);

  // Generate connection lines
  const ihConnections: React.ReactNode[] = [];
  const hoConnections: React.ReactNode[] = [];

  // Input → Hidden connections (show only for hovered hidden node, or a sparse set)
  hiddenNodes.forEach((hn, hi) => {
    const isHighlighted = hoveredHidden === hi;
    if (!isHighlighted && hoveredHidden !== null) return;

    inputNodes.forEach((inp, ii) => {
      const w = wIH[hi][inp.idx];
      const absW = Math.abs(w);
      const opacity = isHighlighted ? Math.min(absW / 2.0, 0.8) : 0.04;
      if (opacity < 0.02) return;
      const color = w > 0 ? `rgba(59,130,246,${opacity})` : `rgba(245,158,11,${opacity})`;
      ihConnections.push(
        <line
          key={`ih-${hi}-${ii}`}
          x1={inp.x + 8} y1={inp.y}
          x2={hn.x - 10} y2={hn.y}
          stroke={color}
          strokeWidth={isHighlighted ? Math.max(0.5, absW * 0.8) : 0.3}
        />
      );
    });
  });

  // Hidden → Output connections
  outputNodes.forEach((on, oi) => {
    const isHighlighted = hoveredOutput === oi;
    if (!isHighlighted && hoveredOutput !== null) return;

    hiddenNodes.forEach((hn, hi) => {
      const w = wHO[oi][hi];
      const absW = Math.abs(w);
      const opacity = isHighlighted ? Math.min(absW / 4.0, 0.9) : 0.05;
      if (opacity < 0.02) return;
      const color = w > 0 ? `rgba(16,185,129,${opacity})` : `rgba(239,68,68,${opacity})`;
      hoConnections.push(
        <line
          key={`ho-${oi}-${hi}`}
          x1={hn.x + 10} y1={hn.y}
          x2={on.x - 14} y2={on.y}
          stroke={color}
          strokeWidth={isHighlighted ? Math.max(0.5, absW * 0.5) : 0.3}
        />
      );
    });
  });

  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} style={{ maxHeight: '420px' }}>
      {/* Background */}
      <rect width={W} height={H} fill="transparent" />

      {/* Layer labels */}
      <text x={inputX} y={14} fill="#6b7280" fontSize="10" textAnchor="middle" fontWeight="bold">INPUT</text>
      <text x={inputX} y={H - 4} fill="#6b7280" fontSize="8" textAnchor="middle">(16 of 64)</text>
      <text x={hiddenX} y={14} fill="#6b7280" fontSize="10" textAnchor="middle" fontWeight="bold">HIDDEN</text>
      <text x={hiddenX} y={H - 4} fill="#6b7280" fontSize="8" textAnchor="middle">(16 neurons)</text>
      <text x={outputX} y={14} fill="#6b7280" fontSize="10" textAnchor="middle" fontWeight="bold">OUTPUT</text>
      <text x={outputX} y={H - 4} fill="#6b7280" fontSize="8" textAnchor="middle">(10 classes)</text>

      {/* Connections behind nodes */}
      <g>{ihConnections}</g>
      <g>{hoConnections}</g>

      {/* Input nodes */}
      {inputNodes.map((n, i) => (
        <g key={`in-${i}`}>
          <circle
            cx={n.x} cy={n.y} r={7}
            fill={n.value ? '#fff' : '#1f2937'}
            stroke={n.value ? '#10b981' : '#374151'}
            strokeWidth={1.5}
          />
        </g>
      ))}

      {/* Hidden nodes */}
      {hiddenNodes.map((n, i) => {
        const intensity = Math.round(n.value * 255);
        return (
          <g key={`h-${i}`}
            onMouseEnter={() => onHoverHidden(i)}
            onMouseLeave={() => onHoverHidden(null)}
            style={{ cursor: 'pointer' }}
          >
            <circle
              cx={n.x} cy={n.y} r={9}
              fill={`rgb(${Math.round(59 * n.value)}, ${Math.round(130 * n.value)}, ${Math.round(246 * n.value)})`}
              stroke={hoveredHidden === i ? '#60a5fa' : '#374151'}
              strokeWidth={hoveredHidden === i ? 2.5 : 1}
            />
            <text
              x={n.x} y={n.y + 3.5}
              fill={intensity > 128 ? '#000' : '#9ca3af'}
              fontSize="7" textAnchor="middle" fontWeight="bold"
            >
              {n.value.toFixed(1)}
            </text>
          </g>
        );
      })}

      {/* Output nodes */}
      {outputNodes.map((n, i) => {
        const isWinner = n.value === maxOut && maxOut > 0.15;
        return (
          <g key={`o-${i}`}
            onMouseEnter={() => onHoverOutput(i)}
            onMouseLeave={() => onHoverOutput(null)}
            style={{ cursor: 'pointer' }}
          >
            <circle
              cx={n.x} cy={n.y} r={12}
              fill={isWinner ? '#10b981' : `rgba(16,185,129,${n.value * 0.7})`}
              stroke={hoveredOutput === i ? '#10b981' : isWinner ? '#34d399' : '#374151'}
              strokeWidth={hoveredOutput === i || isWinner ? 2.5 : 1}
            />
            <text
              x={n.x} y={n.y + 4}
              fill="#fff" fontSize="10" textAnchor="middle" fontWeight="bold"
            >
              {i}
            </text>
            {/* Confidence bar */}
            <rect
              x={n.x + 18} y={n.y - 5}
              width={Math.max(0, n.value * 60)} height={10}
              fill={isWinner ? '#10b981' : '#3b82f6'}
              rx={3}
              opacity={0.8}
            />
            <text
              x={n.x + 22 + n.value * 60} y={n.y + 3}
              fill="#9ca3af" fontSize="8" fontWeight="bold"
            >
              {(n.value * 100).toFixed(0)}%
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ── Weight Heatmap Panel ────────────────────────────────────────────────
function WeightHeatmap({ weights, label }: { weights: number[]; label: string }) {
  const maxAbs = Math.max(...weights.map(Math.abs), 0.01);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
      <span style={{ fontSize: '10px', color: '#9ca3af', fontWeight: 'bold' }}>{label}</span>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(8, 1fr)',
        gap: '1px',
        background: '#1f2937',
        padding: '1px',
        borderRadius: '4px',
      }}>
        {weights.slice(0, 64).map((w, i) => {
          const norm = w / maxAbs;
          const bg = norm > 0
            ? `rgba(59,130,246,${norm * 0.9})`
            : `rgba(245,158,11,${-norm * 0.9})`;
          return <div key={i} style={{ width: '10px', height: '10px', background: bg }} />;
        })}
      </div>
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────────
export default function NnVisionSim() {
  const [pixels, setPixels] = useState<number[]>(new Array(64).fill(0));
  const [isDrawing, setIsDrawing] = useState(false);
  const [isErasing, setIsErasing] = useState(false);
  const [hoveredOutput, setHoveredOutput] = useState<number | null>(null);
  const [hoveredHidden, setHoveredHidden] = useState<number | null>(null);

  const gridRef = useRef<HTMLDivElement>(null);

  const { wIH, wHO, bH, bO } = useMemo(() => buildWeights(TEMPLATES), []);
  const { hidden, outputs } = useMemo(() => forwardPass(pixels, wIH, wHO, bH, bO), [pixels, wIH, wHO, bH, bO]);

  const maxOut = Math.max(...outputs);
  const predicted = outputs.indexOf(maxOut);
  const hasInput = pixels.some(p => p > 0);

  // ── Drawing ──
  const updatePixel = useCallback((idx: number, val: number) => {
    setPixels(prev => {
      if (prev[idx] === val) return prev;
      const next = [...prev];
      next[idx] = val;
      return next;
    });
  }, []);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.dataset.index) {
      const idx = parseInt(target.dataset.index);
      const isOn = pixels[idx] === 1;
      setIsErasing(isOn);
      setIsDrawing(true);
      updatePixel(idx, isOn ? 0 : 1);
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDrawing) return;
    const target = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement;
    if (target?.dataset.index) {
      updatePixel(parseInt(target.dataset.index), isErasing ? 0 : 1);
    }
  };

  const handlePointerUp = useCallback(() => setIsDrawing(false), []);

  useEffect(() => {
    document.addEventListener('pointerup', handlePointerUp);
    return () => document.removeEventListener('pointerup', handlePointerUp);
  }, [handlePointerUp]);

  const loadTemplate = (digit: number) => {
    const flat = TEMPLATES[digit].join('');
    setPixels(flat.split('').map(c => (c === '1' ? 1 : 0)));
  };

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      padding: '20px',
      gap: '16px',
      overflow: 'auto',
      color: '#f3f4f6',
      background: '#0f1115',
      fontFamily: 'system-ui, sans-serif',
    }}>
      {/* Header */}
      <div>
        <h1 style={{
          fontSize: '24px', fontWeight: 'bold', margin: '0 0 4px 0',
          color: '#fff', display: 'flex', alignItems: 'center', gap: '10px',
        }}>
          <Camera style={{ width: '24px', height: '24px', color: '#10b981' }} />
          Sim 2: Machine Vision
        </h1>
        <p style={{ color: '#9ca3af', margin: 0, fontSize: '13px' }}>
          Draw a digit on the grid. The 3-layer neural network classifies it in real-time.
          <strong style={{ color: '#60a5fa' }}> Hover over any node</strong> to inspect its weight connections.
        </p>
      </div>

      <div style={{ display: 'flex', flex: 1, gap: '20px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
        {/* ── Left: Drawing Grid ── */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', minWidth: '220px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
            <h3 style={{ margin: 0, color: '#10b981', fontSize: '13px' }}>Input Canvas (8×8)</h3>
            <button
              onClick={() => setPixels(new Array(64).fill(0))}
              style={{
                display: 'flex', alignItems: 'center', gap: '4px',
                padding: '3px 8px', background: 'transparent',
                border: '1px solid #4b5563', color: '#9ca3af',
                borderRadius: '4px', cursor: 'pointer', fontSize: '11px',
              }}
            >
              <Eraser style={{ width: '12px', height: '12px' }} /> Clear
            </button>
          </div>

          <div
            ref={gridRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(8, 1fr)',
              gap: '2px',
              background: '#374151',
              padding: '2px',
              borderRadius: '8px',
              border: '2px solid #10b981',
              touchAction: 'none',
              userSelect: 'none',
            }}
          >
            {pixels.map((p, i) => (
              <div
                key={i}
                data-index={i}
                style={{
                  width: '28px', height: '28px',
                  background: p ? '#fff' : '#0a0a0a',
                  cursor: 'crosshair',
                  transition: 'background 0.08s',
                }}
              />
            ))}
          </div>

          <div style={{ fontSize: '11px', color: '#6b7280', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <MousePointerSquareDashed style={{ width: '14px', height: '14px' }} /> Draw or click
          </div>

          {/* Quick-load template buttons */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', justifyContent: 'center' }}>
            {[0,1,2,3,4,5,6,7,8,9].map(d => (
              <button
                key={d}
                onClick={() => loadTemplate(d)}
                style={{
                  width: '28px', height: '28px',
                  border: '1px solid #374151',
                  background: hasInput && predicted === d ? '#10b981' : '#1f2937',
                  color: hasInput && predicted === d ? '#000' : '#9ca3af',
                  borderRadius: '4px', cursor: 'pointer',
                  fontSize: '12px', fontWeight: 'bold',
                  transition: 'all 0.2s',
                }}
              >
                {d}
              </button>
            ))}
          </div>

          {/* Prediction callout */}
          {hasInput && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '8px 16px', borderRadius: '8px',
              background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)',
            }}>
              <Zap style={{ width: '16px', height: '16px', color: '#10b981' }} />
              <span style={{ fontSize: '13px', color: '#d1d5db' }}>
                Prediction: <strong style={{ color: '#10b981', fontSize: '18px' }}>{predicted}</strong>
                <span style={{ color: '#6b7280', marginLeft: '6px', fontSize: '11px' }}>
                  ({(maxOut * 100).toFixed(1)}%)
                </span>
              </span>
            </div>
          )}
        </div>

        {/* ── Right: Network Visualization ── */}
        <div style={{
          flex: 1,
          minWidth: '450px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}>
          {/* Network graph */}
          <div style={{
            background: 'rgba(0,0,0,0.3)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '12px',
            padding: '8px',
            flex: 1,
            minHeight: '380px',
          }}>
            <NetworkGraph
              pixels={pixels}
              hidden={hidden}
              outputs={outputs}
              wIH={wIH}
              wHO={wHO}
              hoveredOutput={hoveredOutput}
              hoveredHidden={hoveredHidden}
              onHoverOutput={setHoveredOutput}
              onHoverHidden={setHoveredHidden}
            />
          </div>

          {/* Weight heatmaps for hovered node */}
          {hoveredHidden !== null && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '16px',
              padding: '12px', borderRadius: '8px',
              background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)',
            }}>
              <WeightHeatmap weights={wIH[hoveredHidden]} label={`Hidden[${hoveredHidden}] weights`} />
              <div style={{ flex: 1, fontSize: '11px', color: '#9ca3af', lineHeight: 1.5 }}>
                <strong style={{ color: '#60a5fa' }}>Hidden Neuron {hoveredHidden}</strong>
                <br />Activation: <strong style={{ color: '#fff' }}>{hidden[hoveredHidden].toFixed(3)}</strong>
                <br /><span style={{ color: '#6b7280' }}>
                  Blue = excitatory (positive weight), Orange = inhibitory (negative weight).
                  This neuron&apos;s 64 input weights form a spatial filter — a learned &quot;feature map&quot; that responds to specific pixel patterns.
                </span>
              </div>
            </div>
          )}

          {hoveredOutput !== null && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '16px',
              padding: '12px', borderRadius: '8px',
              background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)',
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                <span style={{ fontSize: '10px', color: '#9ca3af', fontWeight: 'bold' }}>H→O[{hoveredOutput}]</span>
                <div style={{ display: 'flex', gap: '2px' }}>
                  {wHO[hoveredOutput].map((w, i) => {
                    const maxW = Math.max(...wHO[hoveredOutput].map(Math.abs), 0.01);
                    const norm = w / maxW;
                    const bg = norm > 0
                      ? `rgba(16,185,129,${norm * 0.9})`
                      : `rgba(239,68,68,${-norm * 0.9})`;
                    return <div key={i} style={{ width: '14px', height: '14px', background: bg, borderRadius: '2px' }} />;
                  })}
                </div>
              </div>
              <div style={{ flex: 1, fontSize: '11px', color: '#9ca3af', lineHeight: 1.5 }}>
                <strong style={{ color: '#34d399' }}>Output Node &quot;{hoveredOutput}&quot;</strong>
                <br />Confidence: <strong style={{ color: '#fff' }}>{(outputs[hoveredOutput] * 100).toFixed(1)}%</strong>
                <br /><span style={{ color: '#6b7280' }}>
                  Green = strong positive connection from hidden neuron, Red = inhibitory.
                  The 16 bars above show this output&apos;s weights from each hidden neuron.
                </span>
              </div>
            </div>
          )}

          {/* Legend */}
          <div style={{
            display: 'flex', gap: '16px', fontSize: '10px', color: '#6b7280',
            justifyContent: 'center', flexWrap: 'wrap',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <div style={{ width: '10px', height: '10px', background: '#3b82f6', borderRadius: '2px' }} /> Excitatory (I→H)
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <div style={{ width: '10px', height: '10px', background: '#f59e0b', borderRadius: '2px' }} /> Inhibitory (I→H)
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <div style={{ width: '10px', height: '10px', background: '#10b981', borderRadius: '2px' }} /> Excitatory (H→O)
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <div style={{ width: '10px', height: '10px', background: '#ef4444', borderRadius: '2px' }} /> Inhibitory (H→O)
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
