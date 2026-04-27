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

    // Robot state
    let x = 0;
    let y = 0;
    let heading = 0; // radians
    const history: {x: number, y: number}[] = [];

    const resize = () => {
      const parent = canvas.parentElement;
      if (parent) {
        width = parent.clientWidth;
        height = 400;
        canvas.width = width;
        canvas.height = height;
        if (x === 0) {
            x = width / 2;
            y = height / 2;
        }
      }
    };

    window.addEventListener('resize', resize);
    resize();

    const fixedDt = 1 / 60; // 60Hz Physics
    let lastTime = performance.now();
    let accumulator = 0;
    let animationFrameId: number;

    function loop(currentTime: number) {
      // ECON-F01 FIX: Pause simulation when tab is backgrounded
      if (document.hidden) {
        animationFrameId = requestAnimationFrame(loop);
        return;
      }

      const { vx: curVx, vy: curVy, omega: curOmega } = stateRef.current;
      
      const frameTime = (currentTime - lastTime) / 1000;
      lastTime = currentTime;
      
      accumulator += Math.min(frameTime, 0.25);

      while (accumulator >= fixedDt) {
        // PHYS-F01 FIX: Fixed Timestep Integration
        x += (curVx * 10) * fixedDt;
        y += (-curVy * 10) * fixedDt;
        heading += curOmega * fixedDt;

        if (x < 0) x = width;
        if (x > width) x = 0;
        if (y < 0) y = height;
        if (y > height) y = 0;

        accumulator -= fixedDt;
      }

      history.push({x, y});
      if (history.length > 200) history.shift();

      draw(curVx, curVy, curOmega);
      animationFrameId = requestAnimationFrame(loop);
    }

    function draw(curVx: number, curVy: number, curOmega: number) {
      if (!ctx) return;
      ctx.clearRect(0, 0, width, height);

      // Draw Grid
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.lineWidth = 1;
      const gridSize = 40;
      for(let i = 0; i < width; i += gridSize) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, height); ctx.stroke();
      }
      for(let i = 0; i < height; i += gridSize) {
        ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(width, i); ctx.stroke();
      }

      // Draw Trajectory
      if (history.length > 1) {
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(0, 229, 255, 0.4)';
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
      ctx.strokeStyle = '#C00000'; // ares-red
      ctx.lineWidth = 2;
      ctx.fillRect(-rbW/2, -rbH/2, rbW, rbH);
      ctx.strokeRect(-rbW/2, -rbH/2, rbW, rbH);

      // Modules
      const mR = 8;
      const positions = [[-rbW/2, -rbH/2], [rbW/2, -rbH/2], [-rbW/2, rbH/2], [rbW/2, rbH/2]];
      const vxChassis = curVx * Math.cos(-heading) - (-curVy) * Math.sin(-heading);
      const vyChassis = curVx * Math.sin(-heading) + (-curVy) * Math.cos(-heading);

      positions.forEach(pos => {
        const mx = vxChassis - curOmega * pos[1] * 0.05;
        const my = vyChassis + curOmega * pos[0] * 0.05;
        
        // MATH-F01 FIX: Zero-point guard to prevent NaN headings
        const mSpeed = Math.sqrt(mx*mx + my*my);
        const mAngle = mSpeed > 0.001 ? Math.atan2(my, mx) : 0;
        
        ctx.save();
        ctx.translate(pos[0], pos[1]);
        ctx.fillStyle = '#1A1A1A';
        ctx.beginPath(); ctx.arc(0, 0, mR, 0, Math.PI * 2); ctx.fill();
        if (mSpeed > 0.01) ctx.rotate(mAngle);
        ctx.fillStyle = '#00E5FF'; // ares-cyan
        ctx.fillRect(-mR, -2, mR * 2, 4);
        if (mSpeed > 0.1) {
           ctx.strokeStyle = '#FFD700'; // ares-gold
           ctx.lineWidth = 2;
           ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(mSpeed * 30, 0); ctx.stroke();
        }
        ctx.restore();
      });

      // Direction indicator
      ctx.fillStyle = '#C00000';
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
    
    animationFrameId = requestAnimationFrame(loop);

    return () => {
      // LEAK-F01 FIX: Resource Cleanup
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <div className="w-full min-h-[480px] h-auto bg-obsidian border border-ares-gray-dark rounded-lg overflow-hidden flex flex-col">
      <canvas role="img" aria-label="Interactive Physics Simulation Environment" ref={canvasRef} className="block w-full h-[400px]" />
      <div className="p-[15px] border-t border-ares-gray-dark flex gap-[20px] bg-obsidian flex-wrap items-end">
        <div className="flex-1 min-w-[150px]">
            <div className="flex justify-between font-mono text-[12px] text-marble/40 mb-[5px]">
                <span>Vx (Forward/Back)</span>
                <span>{vx.toFixed(1)} m/s</span>
            </div>
            <input type="range" aria-label="Forward/Back Velocity" min="-5" max="5" step="0.1" value={vx} onChange={e => setVx(parseFloat(e.target.value))} className="w-full" />
        </div>
        <div className="flex-1 min-w-[150px]">
            <div className="flex justify-between font-mono text-[12px] text-marble/40 mb-[5px]">
                <span>Vy (Left/Right)</span>
                <span>{vy.toFixed(1)} m/s</span>
            </div>
            <input type="range" aria-label="Left/Right Velocity" min="-5" max="5" step="0.1" value={vy} onChange={e => setVy(parseFloat(e.target.value))} className="w-full" />
        </div>
        <div className="flex-1 min-w-[150px]">
            <div className="flex justify-between font-mono text-[12px] text-marble/40 mb-[5px]">
                <span>Omega (Rotation)</span>
                <span>{omega.toFixed(1)} rad/s</span>
            </div>
            <input type="range" aria-label="Rotation Velocity" min="-5" max="5" step="0.1" value={omega} onChange={e => setOmega(parseFloat(e.target.value))} className="w-full" />
        </div>
        <div className="flex items-center">
            <button 
                onClick={() => { setVx(0); setVy(0); setOmega(0); }} 
                className="bg-ares-red text-white border-none px-[15px] py-[8px] rounded-[4px] cursor-pointer font-bold uppercase text-[12px] tracking-widest">
                ZERO
            </button>
        </div>
      </div>
    </div>
  );
}
