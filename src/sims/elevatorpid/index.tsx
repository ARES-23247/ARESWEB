/** @sim {"name": "Elevator PID Tuning", "requiresContext": false} */
import { useEffect, useRef, useState } from 'react';

export default function ElevatorPidSim() {
  const eCanvasRef = useRef<HTMLCanvasElement>(null);
  const gCanvasRef = useRef<HTMLCanvasElement>(null);
  
  const [kp, setKp] = useState(0.2);
  const [ki, setKi] = useState(0.0);
  const [kd, setKd] = useState(0.05);
  const [kg, setKg] = useState(0.0);
  const [setpoint, setSetpoint] = useState(0.8);

  const stateRef = useRef({ kp, ki, kd, kg, setpoint });
  useEffect(() => { stateRef.current = { kp, ki, kd, kg, setpoint }; }, [kp, ki, kd, kg, setpoint]);

  useEffect(() => {
    const eCanvas = eCanvasRef.current;
    const gCanvas = gCanvasRef.current;
    if (!eCanvas || !gCanvas) return;

    const eCtx = eCanvas.getContext('2d');
    const gCtx = gCanvas.getContext('2d');
    if (!eCtx || !gCtx) return;

    const resize = () => {
      if (gCanvas.parentElement) {
        gCanvas.width = gCanvas.parentElement.clientWidth;
      }
    };
    window.addEventListener('resize', resize);
    resize();

    // Physics constants
    const DT = 0.02; // 20ms timestep (50Hz)
    const GRAVITY_FORCE = -0.5; // Downward force due to gravity
    const MOTOR_EFFICIENCY = 0.1; // Motor force per volt
    const FRICTION_COEFF = 0.88; // Damping factor for velocity

    let position = 0.2;
    let velocity = 0;
    let lastError = 0;
    let integral = 0;

    const history: {p: number, s: number}[] = [];

    let frameId: number;

    function simulate() {
      const { kp: kP, ki: kI, kd: kD, kg: kG, setpoint: s } = stateRef.current;

      const error = s - position;
      const errorRate = (error - lastError) / DT;
      lastError = error;

      integral += error * DT;
      if (integral > 2) integral = 2;
      if (integral < -2) integral = -2;

      let voltage = (kP * error * 50) + (kI * integral * 20) + (kD * errorRate * 1.5);
      voltage += kG;

      const motorForce = voltage * MOTOR_EFFICIENCY;
      const force = motorForce + GRAVITY_FORCE;

      velocity += force * DT;
      velocity *= FRICTION_COEFF;

      position += velocity * DT;
      
      if(position <= 0) { position = 0; velocity = 0; integral = 0; }
      if(position >= 1) { position = 1; velocity = 0; integral = 0; }
      
      history.push({p: position, s});
      if(history.length > 300) history.shift();
    }

    function draw() {
      // Draw Elevator
      eCtx!.clearRect(0,0,eCanvas!.width,eCanvas!.height);
      const eH = eCanvas!.height;

      const aresRed = getComputedStyle(document.documentElement).getPropertyValue('--ares-red').trim() || 'var(--ares-red)';
      const aresCyan = getComputedStyle(document.documentElement).getPropertyValue('--ares-cyan').trim() || 'var(--ares-cyan)';
      
      eCtx!.fillStyle = '#222';
      eCtx!.fillRect(35, 10, 10, eH-20);
      
      const trackH = eH - 40;
      const yPx = (1 - position) * trackH + 10;
      const { setpoint: s } = stateRef.current;
      const syPx = (1 - s) * trackH + 10;
      
      eCtx!.strokeStyle = aresCyan;
      eCtx!.lineWidth = 2;
      eCtx!.beginPath(); eCtx!.moveTo(10, syPx+10); eCtx!.lineTo(70, syPx+10); eCtx!.stroke();
      
      eCtx!.fillStyle = aresRed;
      eCtx!.fillRect(20, yPx, 40, 20);
      eCtx!.fillStyle = aresRed; // Reusing aresRed instead of hardcoded lighter shade
      eCtx!.fillRect(25, yPx+5, 30, 10);
      
      // Draw Graph
      gCtx!.clearRect(0,0,gCanvas!.width,gCanvas!.height);
      const gW = gCanvas!.width;
      const gH = gCanvas!.height;
      
      gCtx!.strokeStyle = '#222';
      gCtx!.lineWidth = 1;
      for(let i=0; i<=4; i++){ gCtx!.beginPath(); gCtx!.moveTo(0, i*(gH/4)); gCtx!.lineTo(gW, i*(gH/4)); gCtx!.stroke(); }
      
      if(history.length === 0) { frameId = requestAnimationFrame(draw); return; }
      
      const slice = gW / 300;
      
      // Setpoint line
      gCtx!.beginPath();
      gCtx!.strokeStyle = aresCyan;
      gCtx!.lineWidth = 2;
      for(let i=0; i<history.length; i++) {
          const x = i * slice;
          const y = (1 - history[i].s) * gH;
          if(i===0) gCtx!.moveTo(x,y); else gCtx!.lineTo(x,y);
      }
      gCtx!.stroke();
      
      // Position line
      gCtx!.beginPath();
      gCtx!.strokeStyle = aresRed;
      gCtx!.lineWidth = 2;
      for(let i=0; i<history.length; i++) {
          const x = i * slice;
          const y = (1 - history[i].p) * gH;
          if(i===0) gCtx!.moveTo(x,y); else gCtx!.lineTo(x,y);
      }
      gCtx!.stroke();
      
      frameId = requestAnimationFrame(draw);
    }
    
    const intervalId = window.setInterval(simulate, 20);
    draw();

    return () => {
      window.removeEventListener('resize', resize);
      window.clearInterval(intervalId);
      cancelAnimationFrame(frameId);
    };
  }, []);

  return (
    <div className="bg-obsidian border border-white/10 rounded-lg overflow-hidden flex flex-col text-marble">
      <div className="p-[15px] border-b border-white/10 flex gap-[20px] bg-obsidian flex-wrap items-end">
        <div className="flex-1 min-w-[150px]">
            <div className="flex justify-between font-mono text-[12px] text-marble/60 mb-[5px]">
                <span>kP (Proportional)</span><span>{kp.toFixed(2)}</span>
            </div>
            <input aria-label="Proportional gain" type="range" min="0" max="25" step="0.01" value={kp} onChange={e => setKp(parseFloat(e.target.value))} className="w-full" />
        </div>
        <div className="flex-1 min-w-[150px]">
            <div className="flex justify-between font-mono text-[12px] text-marble/60 mb-[5px]">
                <span>kI (Integral)</span><span>{ki.toFixed(2)}</span>
            </div>
            <input aria-label="Integral gain" type="range" min="0" max="25" step="0.01" value={ki} onChange={e => setKi(parseFloat(e.target.value))} className="w-full" />
        </div>
        <div className="flex-1 min-w-[150px]">
            <div className="flex justify-between font-mono text-[12px] text-marble/60 mb-[5px]">
                <span>kD (Derivative)</span><span>{kd.toFixed(2)}</span>
            </div>
            <input aria-label="Derivative gain" type="range" min="0" max="25" step="0.01" value={kd} onChange={e => setKd(parseFloat(e.target.value))} className="w-full" />
        </div>
        <div className="flex-1 min-w-[150px]">
            <div className="flex justify-between font-mono text-[12px] text-marble/60 mb-[5px]">
                <span>kG (Gravity FF)</span><span>{kg.toFixed(1)}</span>
            </div>
            <input aria-label="Gravity feedforward" type="range" min="0" max="10" step="0.1" value={kg} onChange={e => setKg(parseFloat(e.target.value))} className="w-full" />
        </div>
        <div className="flex items-center">
            <button 
                onClick={() => setSetpoint(setpoint > 0.5 ? 0.2 : 0.8)} 
                className="bg-ares-cyan text-black border-none px-[15px] py-[8px] rounded-[4px] cursor-pointer font-bold uppercase text-[12px] tracking-widest font-sans hover:bg-white transition-colors duration-200">
                FLIP SETPOINT
            </button>
        </div>
      </div>
      <div className="flex p-[20px] gap-[20px] flex-col sm:flex-row">
        <div>
          <canvas role="img" aria-label="Interactive Physics Simulation Environment" ref={eCanvasRef} width="80" height="260" className="bg-black/20 rounded-[4px] border border-white/5" />
        </div>
        <div className="flex-1 relative">
          <canvas role="img" aria-label="Interactive Physics Simulation Environment" ref={gCanvasRef} width="100" height="260" className="display-block w-full bg-black/20 rounded-[4px] border border-white/5" />
          <div className="absolute top-[10px] right-[10px] flex gap-[15px] font-sans text-[12px] font-bold tracking-wider">
            <span className="text-ares-cyan">■ Setpoint</span>
            <span className="text-ares-red">■ Actual</span>
          </div>
        </div>
      </div>
    </div>
  );
}
