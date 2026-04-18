import { useEffect, useRef, useState } from 'react';

export default function SwerveSim() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const [vx, setVx] = useState(0);
  const [vy, setVy] = useState(0);
  const [omega, setOmega] = useState(0);

  const stateRef = useRef({ vx: 0, vy: 0, omega: 0 });

  useEffect(() => {
    stateRef.current = { vx, vy, omega };
  }, [vx, vy, omega]);

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
        height = 400; // Fixed height properly decoupled from wrapper
        canvas.width = width;
        canvas.height = height;
      }
    };
    window.addEventListener('resize', resize);
    resize();

    // Robot state
    let x = width / 2;
    let y = height / 2;
    let heading = 0; // radians

    const history: {x: number, y: number}[] = [];
    const dt = 0.02; // 50hz (20ms)

    let animationFrameId: number;

    function loop() {
      const { vx: curVx, vy: curVy, omega: curOmega } = stateRef.current;
      
      // Update state
      x += (curVx * 10) * dt;
      y += (-curVy * 10) * dt; // Invert y for standard cartesian vs canvas
      heading += curOmega * dt;

      // Keep in bounds
      if (x < 0) x = width;
      if (x > width) x = 0;
      if (y < 0) y = height;
      if (y > height) y = 0;

      history.push({x, y});
      if (history.length > 200) history.shift();

      draw(curVx, curVy, curOmega);
      animationFrameId = requestAnimationFrame(loop);
    }

    function draw(curVx: number, curVy: number, curOmega: number) {
      if (!ctx) return;
      ctx.clearRect(0, 0, width, height);

      // Draw Grid / Field
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.lineWidth = 1;
      const gridSize = 40;
      for(let i = 0; i < width; i += gridSize) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, height); ctx.stroke();
      }
      for(let i = 0; i < height; i += gridSize) {
        ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(width, i); ctx.stroke();
      }

      // Draw Trajectory History
      if (history.length > 1) {
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(41, 182, 246, 0.4)'; // AI Cyan
        ctx.lineWidth = 3;
        ctx.moveTo(history[0].x, history[0].y);
        for(let i = 1; i < history.length; i++) {
          ctx.lineTo(history[i].x, history[i].y);
        }
        ctx.stroke();
      }

      const rbW = 60;
      const rbH = 60;

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(heading);

      // Chassis
      ctx.fillStyle = 'rgba(20, 20, 20, 0.9)';
      ctx.strokeStyle = '#B32416'; // MARS Red
      ctx.lineWidth = 2;
      ctx.fillRect(-rbW/2, -rbH/2, rbW, rbH);
      ctx.strokeRect(-rbW/2, -rbH/2, rbW, rbH);

      // Modules
      const mR = 8;
      const positions = [
        [-rbW/2, -rbH/2], // FL
        [rbW/2, -rbH/2],  // FR
        [-rbW/2, rbH/2],  // BL
        [rbW/2, rbH/2]    // BR
      ];

      // Swerve Kinematics math for module angles
      // In chassis frame
      const vxChassis = curVx * Math.cos(-heading) - (-curVy) * Math.sin(-heading);
      const vyChassis = curVx * Math.sin(-heading) + (-curVy) * Math.cos(-heading);

      positions.forEach(pos => {
        // Module velocity component from chassis rotation
        const mx = vxChassis - curOmega * pos[1] * 0.05;
        const my = vyChassis + curOmega * pos[0] * 0.05;
        const mAngle = Math.atan2(my, mx);
        const mSpeed = Math.sqrt(mx*mx + my*my);

        ctx.save();
        ctx.translate(pos[0], pos[1]);
        
        ctx.fillStyle = '#222';
        ctx.beginPath(); ctx.arc(0, 0, mR, 0, Math.PI * 2); ctx.fill();
        
        // Only point direction if moving or rotating
        if (mSpeed > 0.01) {
            ctx.rotate(mAngle);
        }
        
        ctx.fillStyle = '#29b6f6'; // Cyan wheel
        ctx.fillRect(-mR, -2, mR * 2, 4);
        
        // Velocity vector
        if (mSpeed > 0.1) {
           ctx.strokeStyle = '#9c7bcc'; // Purple vector
           ctx.lineWidth = 2;
           ctx.beginPath();
           ctx.moveTo(0,0);
           ctx.lineTo(mSpeed * 30, 0); // Scale up vector for visual
           ctx.stroke();
        }

        ctx.restore();
      });

      // Direction indicator
      ctx.fillStyle = '#d42e1e';
      ctx.beginPath(); ctx.arc(rbW/2, 0, 4, 0, Math.PI * 2); ctx.fill();

      ctx.restore();

      // UI Overlay
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.font = '12px "Orbitron", sans-serif';
      ctx.fillText(`X: ${x.toFixed(1)}`, 20, 30);
      ctx.fillText(`Y: ${y.toFixed(1)}`, 20, 50);
      let deg = (heading * 180 / Math.PI);
      while(deg < 0) deg += 360;
      deg = deg % 360;
      ctx.fillText(`HEAD: ${deg.toFixed(1)}°`, 20, 70);
    }
    
    // Allow the div to resize before grabbing width
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
    <div style={{ width: '100%', minHeight: '480px', height: 'auto', backgroundColor: '#0a0a0a', border: '1px solid #2a2a2a', borderRadius: '8px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <canvas role="img" aria-label="Interactive Physics Simulation Environment" ref={canvasRef} style={{ display: 'block', width: '100%', height: '400px' }} />
      <div style={{ padding: '15px', borderTop: '1px solid #2a2a2a', display: 'flex', gap: '20px', background: '#111', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ flex: 1, minWidth: '150px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'monospace', fontSize: '12px', color: '#ccc', marginBottom: '5px' }}>
                <span>Vx (Forward/Back)</span>
                <span>{vx.toFixed(1)} m/s</span>
            </div>
            <input type="range" aria-label="Forward/Back Velocity" min="-5" max="5" step="0.1" value={vx} onChange={e => setVx(parseFloat(e.target.value))} style={{ width: '100%' }} />
        </div>
        <div style={{ flex: 1, minWidth: '150px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'monospace', fontSize: '12px', color: '#ccc', marginBottom: '5px' }}>
                <span>Vy (Left/Right)</span>
                <span>{vy.toFixed(1)} m/s</span>
            </div>
            <input type="range" aria-label="Left/Right Velocity" min="-5" max="5" step="0.1" value={vy} onChange={e => setVy(parseFloat(e.target.value))} style={{ width: '100%' }} />
        </div>
        <div style={{ flex: 1, minWidth: '150px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'monospace', fontSize: '12px', color: '#ccc', marginBottom: '5px' }}>
                <span>Omega (Rotation)</span>
                <span>{omega.toFixed(1)} rad/s</span>
            </div>
            <input type="range" aria-label="Rotation Velocity" min="-5" max="5" step="0.1" value={omega} onChange={e => setOmega(parseFloat(e.target.value))} style={{ width: '100%' }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center' }}>
            <button 
                onClick={() => { setVx(0); setVy(0); setOmega(0); }} 
                style={{ background: '#B32416', color: '#fff', border: 'none', padding: '8px 15px', borderRadius: '4px', cursor: 'pointer', fontFamily: '"Orbitron", sans-serif', fontWeight: 'bold' }}>
                ZERO
            </button>
        </div>
      </div>
    </div>
  );
}
