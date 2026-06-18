/** @sim {"name": "System Identification Optimizer", "requiresContext": false} */
import { useRef, useState, useEffect } from 'react';

export default function SysIdSim() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [testMode, setTestMode] = useState<'idle' | 'quasistatic' | 'dynamic'>('idle');
  
  const stateRef = useRef({ mode: 'idle', time: 0, voltage: 0, velocity: 0 });
  const historyRef = useRef<{t: number, v: number, vel: number}[]>([]);

  // Simple motor model parameters
  const kS = 1.0;  // Volts to break static friction
  const kV = 0.12; // Volts per rad/s
  const kA = 0.05; // Volts per rad/s^2
  
  useEffect(() => {
    if (testMode !== 'idle' && stateRef.current.mode === 'idle') {
      // Starting new test
      stateRef.current.time = 0;
      stateRef.current.voltage = 0;
      stateRef.current.velocity = 0;
      historyRef.current = [];
    }
    stateRef.current.mode = testMode;
  }, [testMode]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = 0;
    let height = 0;

    const resize = () => {
      const parent = canvas.parentElement;
      if (parent) {
        width = parent.clientWidth;
        height = 300;
        canvas.width = width;
        canvas.height = height;
      }
    };
    window.addEventListener('resize', resize);
    resize();

    let animationFrameId: number;
    const dt = 0.02; // 20ms loop

    function loop() {
      const state = stateRef.current;
      
      if (state.mode !== 'idle') {
        state.time += dt;
        
        let targetVoltage = 0;
        if (state.mode === 'quasistatic') {
            // Ramps at 1V per second
            targetVoltage = state.time * 1.0; 
            if (targetVoltage > 8) {
                setTestMode('idle');
            }
        } else if (state.mode === 'dynamic') {
            // Step voltage 6V instantly
            targetVoltage = 6.0;
            if (state.time > 4) {
                setTestMode('idle');
            }
        }
        state.voltage = targetVoltage;

        // Physics engine using V = kS + kV * vel + kA * acc
        // -> acc = (V - kS - kV * vel) / kA
        // Note: kS only applies if velocity > 0 or V > kS
        
        let acc = 0;
        const effectiveVoltage = Math.max(0, state.voltage - kS);
        
        if (state.voltage > kS || state.velocity > 0) {
           acc = (effectiveVoltage - (kV * state.velocity)) / kA;
        }

        state.velocity += acc * dt;
        
        historyRef.current.push({ t: state.time, v: state.voltage, vel: state.velocity });
      }

      ctx!.clearRect(0, 0, width, height);
      
      // Draw Grid
      ctx!.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx!.lineWidth = 1;
      for (let i = 0; i < height; i += 40) {
        ctx!.beginPath(); ctx!.moveTo(0, i); ctx!.lineTo(width, i); ctx!.stroke();
      }

      // Draw Axes
      const offsetX = 50;
      const offsetY = height - 30;
      const graphW = width - 70;
      const graphH = height - 60;
      
      ctx!.strokeStyle = 'var(--ifm-color-emphasis-400)';
      ctx!.lineWidth = 2;
      ctx!.beginPath();
      ctx!.moveTo(offsetX, offsetY);
      ctx!.lineTo(width - 20, offsetY);
      ctx!.moveTo(offsetX, offsetY);
      ctx!.lineTo(offsetX, 20);
      ctx!.stroke();

      // Plot
      if (historyRef.current.length > 0) {
        // Voltage
        ctx!.beginPath();
        ctx!.strokeStyle = 'var(--ares-gold)'; // ARES Gold
        ctx!.lineWidth = 2;
        const scaleX = graphW / 8.0; // Max 8 seconds
        const scaleV = graphH / 12.0; // Max 12 volts
        const scaleVel = graphH / 100.0; // Max 100 rad/s
        
        for(let i = 0; i < historyRef.current.length; i++) {
          const pt = historyRef.current[i];
          const px = offsetX + pt.t * scaleX;
          const py = offsetY - pt.v * scaleV;
          if(i === 0) ctx!.moveTo(px, py);
          else ctx!.lineTo(px, py);
        }
        ctx!.stroke();

        // Velocity
        ctx!.beginPath();
        ctx!.strokeStyle = 'var(--ares-cyan)'; // ARES Cyan
        ctx!.lineWidth = 2;
        for(let i = 0; i < historyRef.current.length; i++) {
          const pt = historyRef.current[i];
          const px = offsetX + pt.t * scaleX;
          const py = offsetY - pt.vel * scaleVel;
          if(i === 0) ctx!.moveTo(px, py);
          else ctx!.lineTo(px, py);
        }
        ctx!.stroke();
      }
      
      // Labels
      ctx!.fillStyle = 'var(--ares-muted)';
      ctx!.font = '11px sans-serif';
      ctx!.fillText('Time (s)', width / 2, height - 10);
      
      ctx!.save();
      ctx!.translate(20, height / 2);
      ctx!.rotate(-Math.PI / 2);
      ctx!.fillText('Magnitude', -20, 0);
      ctx!.restore();

      animationFrameId = requestAnimationFrame(loop);
    }
    
    setTimeout(() => {
        resize();
        loop();
    }, 100);

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <div style={{ width: '100%', backgroundColor: 'var(--obsidian)', border: '1px solid var(--ifm-color-emphasis-200)', borderRadius: '8px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <canvas role="img" aria-label="Interactive Physics Simulation Environment" ref={canvasRef} style={{ display: 'block', width: '100%', touchAction: 'none' }} />
      <div style={{ padding: '15px', borderTop: '1px solid var(--ifm-color-emphasis-200)', display: 'flex', gap: '20px', background: 'var(--obsidian)', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '15px' }}>
            <button 
                onClick={() => setTestMode('quasistatic')} 
                disabled={testMode !== 'idle'}
                style={{ background: 'var(--ares-cyan)', color: '#000', border: 'none', padding: '8px 20px', borderRadius: '4px', cursor: testMode !== 'idle' ? 'not-allowed' : 'pointer', fontFamily: '"Orbitron", sans-serif', fontWeight: 'bold', opacity: testMode !== 'idle' ? 0.5 : 1 }}>
                RUN QUASISTATIC
            </button>
            <button 
                onClick={() => setTestMode('dynamic')} 
                disabled={testMode !== 'idle'}
                style={{ background: 'var(--ares-gold)', color: '#000', border: 'none', padding: '8px 20px', borderRadius: '4px', cursor: testMode !== 'idle' ? 'not-allowed' : 'pointer', fontFamily: '"Orbitron", sans-serif', fontWeight: 'bold', opacity: testMode !== 'idle' ? 0.5 : 1 }}>
                RUN DYNAMIC
            </button>
        </div>
        <div style={{ display: 'flex', gap: '15px', fontFamily: '"Orbitron", sans-serif', fontSize: '13px' }}>
           <span style={{ color: 'var(--ares-gold)' }}>■ Voltage (V)</span>
           <span style={{ color: 'var(--ares-cyan)' }}>■ Velocity (rad/s)</span>
        </div>
      </div>
    </div>
  );
}
