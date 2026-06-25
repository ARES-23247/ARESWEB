/** @sim {"name": "Arm Kinematics Gravity Model", "requiresContext": false} */
import { useEffect, useRef, useState } from 'react';

export default function ArmKgSim() {
  const aCanvasRef = useRef<HTMLCanvasElement>(null);
  
  const [armSet, setArmSet] = useState(0);
  const [armKg, setArmKg] = useState(0.6);
  const [armKp, setArmKp] = useState(0.05);

  const stateRef = useRef({ armSet, armKg, armKp });
  useEffect(() => { stateRef.current = { armSet, armKg, armKp }; }, [armSet, armKg, armKp]);

  const [currentAngle, setCurrentAngle] = useState(0);
  const [cosThetaDisplay, setCosThetaDisplay] = useState(1);
  const [ffVoltageDisplay, setFfVoltageDisplay] = useState(0);

  useEffect(() => {
    const aCanvas = aCanvasRef.current;
    if (!aCanvas) return;

    const aCtx = aCanvas.getContext('2d');
    if (!aCtx) return;

    let armAng = -45; 
    let armVel = 0;
    
    let frameId: number;

    // Physics constants
    const GRAVITY_COEFF = 0.6; // Gravity compensation coefficient
    const DT = 0.02; // 20ms timestep (50Hz)
    const FRICTION_COEFF = 0.85; // Damping factor for arm velocity

    function simArm() {
      const { armSet: setTarget, armKg: kG, armKp: kP } = stateRef.current;

      const error = setTarget - armAng;

      const radians = armAng * (Math.PI / 180);
      const cosTheta = Math.cos(radians);

      const ffVoltage = kG * cosTheta;
      const pidVoltage = kP * error;

      const voltage = ffVoltage + pidVoltage;

      const GRAVITY_PULL = -GRAVITY_COEFF * cosTheta;
      const MOTOR_PUSH = voltage * 1.0;

      const accel = MOTOR_PUSH + GRAVITY_PULL;
      armVel += accel * DT;
      armVel *= FRICTION_COEFF;

      armAng += armVel;

      // Update React state loosely for the UI panel (every 2 frames to avoid mega React re-renders)
      if (Math.random() > 0.5) {
        setCurrentAngle(armAng);
        setCosThetaDisplay(cosTheta);
        setFfVoltageDisplay(ffVoltage);
      }
    }
    
    function drawArm() {
      aCtx!.clearRect(0,0,aCanvas!.width,aCanvas!.height);
      const cx = aCanvas!.width/2;
      const cy = aCanvas!.height/2;

      const aresRed = getComputedStyle(document.documentElement).getPropertyValue('--ares-red').trim() || 'var(--ares-red)';
      const aresCyan = getComputedStyle(document.documentElement).getPropertyValue('--ares-cyan').trim() || 'var(--ares-cyan)';
      
      aCtx!.fillStyle = 'var(--ares-gray)';
      aCtx!.beginPath(); aCtx!.arc(cx,cy, 15, 0, Math.PI*2); aCtx!.fill();
      
      aCtx!.strokeStyle = 'var(--ares-gray-dark)';
      aCtx!.lineWidth = 1;
      aCtx!.beginPath(); aCtx!.moveTo(0,cy); aCtx!.lineTo(200,cy); aCtx!.stroke(); 
      aCtx!.beginPath(); aCtx!.moveTo(cx,0); aCtx!.lineTo(cx,200); aCtx!.stroke(); 
      
      aCtx!.save();
      aCtx!.translate(cx, cy);
      // Invert angle for visually standard display (0 is horizontal right)
      aCtx!.rotate(-armAng * Math.PI/180); 
      
      aCtx!.fillStyle = aresRed;
      aCtx!.fillRect(0, -10, 80, 20); 
      
      aCtx!.fillStyle = aresCyan;
      aCtx!.beginPath(); aCtx!.arc(0,0, 6, 0, Math.PI*2); aCtx!.fill();
      
      aCtx!.restore();
      
      frameId = requestAnimationFrame(drawArm);
    }

    const intervalId = window.setInterval(simArm, 20);
    drawArm();

    return () => {
      window.clearInterval(intervalId);
      cancelAnimationFrame(frameId);
    };
  }, []);

  return (
    <div className="bg-obsidian border border-white/10 rounded-lg overflow-hidden flex flex-col text-marble mt-6">
      <div className="p-[15px] border-b border-white/10 flex gap-[20px] bg-obsidian flex-wrap items-end">
        <div className="flex-1 min-w-[150px]">
            <div className="flex justify-between font-mono text-[12px] text-marble/60 mb-[5px]">
                <span>Target Angle &deg;</span><span>{armSet}&deg;</span>
            </div>
            <input aria-label="Arm target angle in degrees" type="range" min="-90" max="90" step="1" value={armSet} onChange={e => setArmSet(parseInt(e.target.value, 10))} className="w-full" />
        </div>
        <div className="flex-1 min-w-[150px]">
            <div className="flex justify-between font-mono text-[12px] text-marble/60 mb-[5px]">
                <span>kG (Gravity Max)</span><span>{armKg.toFixed(2)}</span>
            </div>
            <input aria-label="Gravity feedforward gain" type="range" min="0" max="2.0" step="0.1" value={armKg} onChange={e => setArmKg(parseFloat(e.target.value))} className="w-full" />
        </div>
        <div className="flex-1 min-w-[150px]">
            <div className="flex justify-between font-mono text-[12px] text-marble/60 mb-[5px]">
                <span>kP (Proportional)</span><span>{armKp.toFixed(2)}</span>
            </div>
            <input aria-label="Proportional gain" type="range" min="0" max="0.2" step="0.01" value={armKp} onChange={e => setArmKp(parseFloat(e.target.value))} className="w-full" />
        </div>
      </div>
      <div className="flex p-[20px] gap-[40px] items-center flex-col sm:flex-row">
        <div>
          <canvas role="img" aria-label="Interactive Physics Simulation Environment" ref={aCanvasRef} width="200" height="200" className="bg-black/20 rounded-[4px] border border-white/5" />
        </div>
        <div className="flex-1 font-mono text-sm leading-relaxed">
          <p className="my-1">Current Angle: <strong className="text-ares-cyan">{currentAngle.toFixed(2)}&deg;</strong></p>
          <p className="my-1">cos({currentAngle.toFixed(1)}&deg;) = <strong className="text-white">{cosThetaDisplay.toFixed(3)}</strong></p>
          <p className="my-1">FF Voltage = kG * cos(&theta;) = <strong className="text-ares-red">{ffVoltageDisplay.toFixed(2)}v</strong></p>
          <div className="w-full h-2 bg-white/10 rounded-full my-[15px] overflow-hidden">
            <div style={{ width: `${Math.abs(cosThetaDisplay) * 100}%` }} className="h-full bg-ares-red transition-[width] duration-100 ease-linear" />
          </div>
          <p className="m-0 text-xs text-marble/60 font-bold uppercase tracking-wider">Gravity Counter-Force Vector</p>
        </div>
      </div>
    </div>
  );
}
