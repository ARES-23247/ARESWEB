import { useEffect, useRef } from 'react';
import { useControls, button, folder } from 'leva';

export default function FlywheelKvSim() {
  const wCanvasRef = useRef<HTMLCanvasElement>(null);
  const fwGCanvasRef = useRef<HTMLCanvasElement>(null);
  
  const velRef = useRef(0);
  const shoot = () => {
    velRef.current -= 40; 
    if(velRef.current < 0) velRef.current = 0;
  };
  
  const setRef = useRef<((values: Partial<{ kV: number; kP: number; fwSet: number }>) => void) | null>(null);

  const [{ kV, kP, fwSet }, set] = useControls(() => ({
    'Flywheel Physics': folder({
      kV: { value: 0.12, min: 0, max: 0.3, step: 0.01, label: 'kV (Feedforward)' },
      kP: { value: 0.08, min: 0, max: 0.5, step: 0.01, label: 'kP (Proportional)' },
      fwSet: { value: 80, min: 0, max: 150, step: 5, label: 'Setpoint (rad/s)' },
    }),
    'Interactions': folder({
      'Inject Ball': button(() => shoot()),
      'Reset Simulation': button(() => {
        setRef.current?.({ kV: 0.12, kP: 0.08, fwSet: 80 });
        velRef.current = 0;
      })
    })
  }));

  useEffect(() => { setRef.current = set; }, [set]);

  const stateRef = useRef({ kV, kP, fwSet });
  useEffect(() => { stateRef.current = { kV, kP, fwSet }; }, [kV, kP, fwSet]);
  


  useEffect(() => {
    const wCanvas = wCanvasRef.current;
    const fwGCanvas = fwGCanvasRef.current;
    if (!wCanvas || !fwGCanvas) return;

    const wCtx = wCanvas.getContext('2d');
    const fwGCtx = fwGCanvas.getContext('2d');
    if (!wCtx || !fwGCtx) return;

    let fwAngle = 0;
    const fwHist: {v: number, s: number}[] = [];
    
    let frameId: number;

    function simFlywheel() {
      const { kV: curKv, kP: curKp, fwSet: curSet } = stateRef.current;
      let fwVel = velRef.current;
      
      const error = curSet - fwVel;
      let voltage = (curKv * curSet) + (curKp * error);
      
      if(voltage > 12) voltage = 12;
      if(voltage < 0) voltage = 0; 
      
      const ACCELERATION = (voltage * 15); 
      const DRAG = (fwVel * fwVel * 0.0005); 
      
      fwVel += (ACCELERATION - DRAG) * 0.02; 
      if(fwVel < 0) fwVel = 0;
      
      fwAngle += (fwVel * 0.02);
      velRef.current = fwVel;
      
      fwHist.push({v: fwVel, s: curSet});
      if(fwHist.length > 250) fwHist.shift();
    }
    
    function drawFlywheel() {
      wCtx!.clearRect(0,0,wCanvas!.width,wCanvas!.height);
      const cx = wCanvas!.width/2;
      const cy = wCanvas!.height/2;
      
      wCtx!.save();
      wCtx!.translate(cx, cy);
      wCtx!.rotate(fwAngle);
      
      wCtx!.fillStyle = 'var(--obsidian)';
      wCtx!.strokeStyle = 'var(--ares-cyan)'; 
      wCtx!.lineWidth = 4;
      wCtx!.beginPath(); wCtx!.arc(0,0, 50, 0, Math.PI*2); wCtx!.fill(); wCtx!.stroke();
      
      wCtx!.fillStyle = 'var(--ares-gray)';
      for(let i=0; i<3; i++) {
          wCtx!.rotate(Math.PI*2/3);
          wCtx!.beginPath(); wCtx!.arc(35, 0, 8, 0, Math.PI*2); wCtx!.fill();
      }
      wCtx!.restore();
      
      fwGCtx!.clearRect(0,0,fwGCanvas!.width,fwGCanvas!.height);
      const gW = fwGCanvas!.width;
      const gH = fwGCanvas!.height;
      const maxV = 160;
      const slice = gW / 250;
      
      fwGCtx!.strokeStyle = '#222';
      fwGCtx!.lineWidth = 1;
      for(let i=0; i<=4; i++){ fwGCtx!.beginPath(); fwGCtx!.moveTo(0, i*(gH/4)); fwGCtx!.lineTo(gW, i*(gH/4)); fwGCtx!.stroke(); }
      
      if(fwHist.length < 2) { frameId = requestAnimationFrame(drawFlywheel); return; }
      
      fwGCtx!.beginPath();
      fwGCtx!.strokeStyle = 'var(--ares-cyan)';
      fwGCtx!.lineWidth = 2;
      for(let i=0; i<fwHist.length; i++) {
          const x = i * slice;
          const y = gH - (fwHist[i].s / maxV * gH);
          if(i===0) fwGCtx!.moveTo(x,y); else fwGCtx!.lineTo(x,y);
      }
      fwGCtx!.stroke();
      
      fwGCtx!.beginPath();
      fwGCtx!.strokeStyle = 'var(--ares-red)';
      fwGCtx!.lineWidth = 2;
      for(let i=0; i<fwHist.length; i++) {
          const x = i * slice;
          const y = gH - (fwHist[i].v / maxV * gH);
          if(i===0) fwGCtx!.moveTo(x,y); else fwGCtx!.lineTo(x,y);
      }
      fwGCtx!.stroke();
      
      frameId = requestAnimationFrame(drawFlywheel);
    }

    const intervalId = window.setInterval(simFlywheel, 20);
    drawFlywheel();

    return () => {
      window.clearInterval(intervalId);
      cancelAnimationFrame(frameId);
    };
  }, []);

  return (
    <div className="bg-obsidian border border-white/10 overflow-hidden flex flex-col color-marble mt-6 ares-cut-lg" role="region" aria-label="Flywheel kV Tuning Simulator — interactive physics simulation for PID-controlled flywheel velocity recovery">
      <div className="p-4 border-b border-white/5 flex gap-4 bg-black/40 backdrop-blur-md items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-ares-red animate-pulse" />
          <span className="text-[10px] font-black uppercase tracking-widest text-marble/60">Live Telemetry System</span>
        </div>
        <div className="flex gap-4 text-[10px] font-mono text-ares-gold/80">
          <span>KV: {kV.toFixed(2)}</span>
          <span>KP: {kP.toFixed(2)}</span>
          <span>SET: {fwSet}</span>
        </div>
      </div>
      <div className="flex flex-col md:flex-row p-6 gap-6 items-center">
        <div className="shrink-0">
          <canvas role="img" aria-label="Flywheel Visualization" aria-describedby="fw-wheel-desc" ref={wCanvasRef} width="120" height="120" className="bg-black/40 rounded-full border border-white/5 shadow-2xl" />
          <span id="fw-wheel-desc" className="sr-only">Animated spinning flywheel showing current rotational velocity. Speed varies based on kV feedforward and kP proportional gain parameters.</span>
        </div>
        <div className="flex-1 w-full relative">
          <canvas role="img" aria-label="Velocity Graph" aria-describedby="fw-graph-desc" ref={fwGCanvasRef} width="600" height="220" className="block w-full bg-black/40 ares-cut-lg border border-white/5" />
          <span id="fw-graph-desc" className="sr-only">Real-time line graph showing flywheel velocity (red) versus target setpoint (cyan) over time. Demonstrates PID controller response and recovery after ball injection disturbances.</span>
          <div className="absolute top-4 right-4 flex flex-col gap-1">
             <div className="flex items-center gap-2 text-[8px] font-black uppercase tracking-tighter text-ares-cyan">
                <div className="w-2 h-0.5 bg-ares-cyan" /> Target
             </div>
             <div className="flex items-center gap-2 text-[8px] font-black uppercase tracking-tighter text-ares-red">
                <div className="w-2 h-0.5 bg-ares-red" /> Velocity
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
