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

    function simArm() {
      const { armSet: setTarget, armKg: kG, armKp: kP } = stateRef.current;
      
      const error = setTarget - armAng;
      
      const radians = armAng * (Math.PI / 180);
      const cosTheta = Math.cos(radians);
      
      const ffVoltage = kG * cosTheta;
      const pidVoltage = kP * error;
      
      const voltage = ffVoltage + pidVoltage;
      
      const GRAVITY_PULL = -0.6 * cosTheta; 
      const MOTOR_PUSH = voltage * 1.0; 
      
      const accel = MOTOR_PUSH + GRAVITY_PULL;
      armVel += accel * 0.02;
      armVel *= 0.85; 
      
      armAng += armVel;

      // Update React state loosely for the UI panel (every 2 frames to avoid mega React re-renders)
      if (Math.random() > 0.5) {
        setCurrentAngle(armAng);
        setCosThetaDisplay(cosTheta);
        setFfVoltageDisplay(ffVoltage);
      }
    }
    
    function drawArm() {
      // @ts-expect-error -- D1 untyped response
      aCtx!.clearRect(0,0,aCanvas.width,aCanvas.height);
      // @ts-expect-error -- D1 untyped response
      const cx = aCanvas.width/2;
      // @ts-expect-error -- D1 untyped response
      const cy = aCanvas.height/2;

      const aresRed = getComputedStyle(document.documentElement).getPropertyValue('--ares-red').trim() || '#C00000';
      const aresCyan = getComputedStyle(document.documentElement).getPropertyValue('--ares-cyan').trim() || '#29b6f6';
      
      aCtx!.fillStyle = '#444';
      aCtx!.beginPath(); aCtx!.arc(cx,cy, 15, 0, Math.PI*2); aCtx!.fill();
      
      aCtx!.strokeStyle = '#222';
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
    <div style={{ backgroundColor: '#0a0a0a', border: '1px solid #2a2a2a', borderRadius: '8px', overflow: 'hidden', display: 'flex', flexDirection: 'column', color: '#e8e8e8', marginTop: '20px' }}>
      <div style={{ padding: '15px', borderBottom: '1px solid #2a2a2a', display: 'flex', gap: '20px', background: '#111', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ flex: 1, minWidth: '150px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'monospace', fontSize: '12px', color: '#ccc', marginBottom: '5px' }}>
                <span>Target Angle &deg;</span><span>{armSet}&deg;</span>
            </div>
            <input aria-label="Simulation Configuration Slider" type="range" min="-90" max="90" step="1" value={armSet} onChange={e => setArmSet(parseInt(e.target.value))} style={{ width: '100%' }} />
        </div>
        <div style={{ flex: 1, minWidth: '150px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'monospace', fontSize: '12px', color: '#ccc', marginBottom: '5px' }}>
                <span>kG (Gravity Max)</span><span>{armKg.toFixed(2)}</span>
            </div>
            <input aria-label="Simulation Configuration Slider" type="range" min="0" max="2.0" step="0.1" value={armKg} onChange={e => setArmKg(parseFloat(e.target.value))} style={{ width: '100%' }} />
        </div>
        <div style={{ flex: 1, minWidth: '150px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'monospace', fontSize: '12px', color: '#ccc', marginBottom: '5px' }}>
                <span>kP (Proportional)</span><span>{armKp.toFixed(2)}</span>
            </div>
            <input aria-label="Simulation Configuration Slider" type="range" min="0" max="0.2" step="0.01" value={armKp} onChange={e => setArmKp(parseFloat(e.target.value))} style={{ width: '100%' }} />
        </div>
      </div>
      <div style={{ display: 'flex', padding: '20px', gap: '40px', alignItems: 'center' }}>
        <div>
          <canvas role="img" aria-label="Interactive Physics Simulation Environment" ref={aCanvasRef} width="200" height="200" style={{ background: '#1a1a1a', borderRadius: '4px' }} />
        </div>
        <div style={{ flex: 1, fontFamily: 'monospace', fontSize: '14px', lineHeight: '1.8' }}>
          <p style={{ margin: '5px 0' }}>Current Angle: <strong style={{ color: '#29b6f6' }}>{currentAngle.toFixed(2)}&deg;</strong></p>
          <p style={{ margin: '5px 0' }}>cos({currentAngle.toFixed(1)}&deg;) = <strong>{cosThetaDisplay.toFixed(3)}</strong></p>
          <p style={{ margin: '5px 0' }}>FF Voltage = kG * cos(&theta;) = <strong style={{ color: '#B32416' }}>{ffVoltageDisplay.toFixed(2)}v</strong></p>
          <div style={{ width: '100%', height: '8px', background: '#222', borderRadius: '4px', margin: '15px 0', overflow: 'hidden' }}>
            <div style={{ width: `${Math.abs(cosThetaDisplay) * 100}%`, height: '100%', background: '#B32416', transition: 'width 0.1s linear' }} />
          </div>
          <p style={{ margin: 0, fontSize: '12px', color: '#888' }}>Gravity Counter-Force Vector</p>
        </div>
      </div>
    </div>
  );
}
