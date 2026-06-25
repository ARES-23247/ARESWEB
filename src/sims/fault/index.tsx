/** @sim {"name": "Fault Tolerant State Manager", "requiresContext": true} */
import { useState, useEffect, useRef } from 'react';

export default function FaultSim() {
  const [canHealthy, setCanHealthy] = useState(true);
  const [speed, setSpeed] = useState(0);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef({ canHealthy, speed, targetSpeed: 100 });
  const hardwareSpeedRef = useRef(0);
  const simSpeedRef = useRef(0);

  useEffect(() => {
    stateRef.current = { canHealthy, speed, targetSpeed: speed > 0 ? 100 : 0 };
  }, [canHealthy, speed]);

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
        height = 320; // Fixed inner simulation container size
        canvas.width = width;
        canvas.height = height;
      }
    };
    window.addEventListener('resize', resize);
    resize();

    let animationFrameId: number;
    let time = 0;
    
    // Motor rotor angle visuals
    let hwAngle = 0;
    let simAngle = 0;

    function loop() {
      const { canHealthy: healthy, targetSpeed } = stateRef.current;
      time += 0.02;

      // Hardware logic
      if (healthy) {
        // Accelerate hardware towards target
        hardwareSpeedRef.current += (targetSpeed - hardwareSpeedRef.current) * 0.1;
      } else {
        // Hardware dies (coasts to stop very slowly, no active brake)
        hardwareSpeedRef.current *= 0.98;
      }
      hwAngle += hardwareSpeedRef.current * 0.05;

      // Simulation logic (always runs inside IO layer)
      simSpeedRef.current += (targetSpeed - simSpeedRef.current) * 0.1;
      simAngle += simSpeedRef.current * 0.05;

      ctx!.clearRect(0, 0, width, height);
      
      const cx = width / 2;
      const cy = height / 2;

      // Draw RIO
      ctx!.fillStyle = 'var(--obsidian)';
      ctx!.strokeStyle = 'var(--ares-gray)';
      ctx!.lineWidth = 2;
      ctx!.fillRect(cx - 150, cy - 40, 80, 80);
      ctx!.strokeRect(cx - 150, cy - 40, 80, 80);
      ctx!.fillStyle = 'var(--ares-cyan)';
      ctx!.font = '12px "Orbitron", sans-serif';
      ctx!.fillText('RoboRIO', cx - 140, cy + 5);

      // Draw Motor
      ctx!.fillStyle = 'var(--obsidian)';
      ctx!.strokeStyle = healthy ? 'var(--ares-cyan)' : 'var(--ares-red)';
      ctx!.lineWidth = 2;
      ctx!.beginPath();
      ctx!.arc(cx + 100, cy, 40, 0, Math.PI * 2);
      ctx!.fill();
      ctx!.stroke();
      ctx!.fillText('Kraken X60', cx + 70, cy + 55);

      // Draw Can Bus Wire
      ctx!.beginPath();
      ctx!.moveTo(cx - 70, cy);
      // Zigzag wire
      ctx!.lineTo(cx - 40, cy);
      
      if (!healthy) {
         ctx!.strokeStyle = 'var(--ares-red)';
         ctx!.setLineDash([5, 5]);
         // Draw snapped wire
         ctx!.lineTo(cx, cy - 10);
         ctx!.moveTo(cx + 10, cy + 10);
      } else {
         ctx!.strokeStyle = (time % 0.5 < 0.25) ? 'var(--ares-gold)' : '#28c035'; // Blinking CAN colors
         ctx!.setLineDash([]);
         ctx!.lineTo(cx, cy);
      }
      
      ctx!.lineTo(cx + 60, cy);
      ctx!.lineWidth = 3;
      ctx!.stroke();
      ctx!.setLineDash([]);

      // Draw Hardware Rotor
      ctx!.save();
      ctx!.translate(cx + 100, cy);
      ctx!.rotate(hwAngle);
      ctx!.fillStyle = healthy ? 'var(--marble)' : 'var(--ares-red)';
      ctx!.fillRect(-5, -30, 10, 60);
      ctx!.restore();

      // Draw Software IO Ghost / Simulation node floating above
      ctx!.save();
      ctx!.translate(cx + 100, cy - 100);
      
      // Wire from RIO to Ghost
      ctx!.globalCompositeOperation = 'destination-over';
      ctx!.beginPath();
      ctx!.moveTo(-250, 40);
      ctx!.lineTo(-250, 0);
      ctx!.lineTo(-40, 0);
      ctx!.strokeStyle = 'rgba(41, 182, 246, 0.4)';
      ctx!.lineWidth = 2;
      ctx!.stroke();
      ctx!.globalCompositeOperation = 'source-over';

      ctx!.rotate(simAngle);
      ctx!.strokeStyle = 'rgba(41, 182, 246, 0.5)';
      ctx!.lineWidth = 2;
      ctx!.strokeRect(-30, -30, 60, 60);
      ctx!.fillStyle = 'rgba(41, 182, 246, 0.2)';
      ctx!.beginPath();
      ctx!.arc(0, 0, 20, 0, Math.PI * 2);
      ctx!.fill();
      ctx!.restore();

      // Ghost text
      ctx!.fillStyle = 'var(--ares-cyan)';
      ctx!.fillText('IO Abstraction (Sim Node)', cx + 40, cy - 140);
      
      // Readout Box
      ctx!.fillStyle = 'rgba(10,10,10,0.8)';
      ctx!.fillRect(20, 20, 200, 80);
      ctx!.strokeStyle = 'var(--ares-gray)';
      ctx!.strokeRect(20, 20, 200, 80);
      
      ctx!.fillStyle = 'var(--marble)';
      ctx!.fillText(`HW Velocity: ${hardwareSpeedRef.current.toFixed(1)}`, 30, 45);
      ctx!.fillText(`SW Velocity: ${simSpeedRef.current.toFixed(1)}`, 30, 65);
      
      // The crucial logic metric: what does the robot code ACTUALLY read?
      const reportedVelocity = healthy ? hardwareSpeedRef.current : simSpeedRef.current;
      ctx!.fillStyle = healthy ? '#28c035' : 'var(--ares-red)';
      ctx!.fillText(`Reported to Subsystem:`, 30, 85);
      ctx!.fillText(`${reportedVelocity.toFixed(1)}`, 180, 85);

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
    <div style={{ width: '100%', minHeight: '400px', height: 'auto', backgroundColor: 'var(--obsidian)', border: '1px solid #2a2a2a', borderRadius: '8px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <canvas role="img" aria-label="Interactive Physics Simulation Environment" ref={canvasRef} style={{ display: 'block', width: '100%', height: '320px', cursor: 'pointer' }} />
      <div style={{ padding: '15px', borderTop: '1px solid #2a2a2a', display: 'flex', gap: '20px', background: 'var(--obsidian)', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '15px' }}>
            <button 
                onClick={() => setSpeed(speed === 0 ? 100 : 0)} 
                style={{ background: 'var(--ares-cyan)', color: '#000', border: 'none', padding: '8px 20px', borderRadius: '4px', cursor: 'pointer', fontFamily: '"Orbitron", sans-serif', fontWeight: 'bold' }}>
                {speed === 0 ? 'START MOTOR' : 'STOP MOTOR'}
            </button>
            <button 
                onClick={() => setCanHealthy(!canHealthy)} 
                style={{ background: canHealthy ? 'var(--ares-red)' : '#28c035', color: 'var(--marble)', border: 'none', padding: '8px 20px', borderRadius: '4px', cursor: 'pointer', fontFamily: '"Orbitron", sans-serif', fontWeight: 'bold' }}>
                {canHealthy ? 'SEVER CAN WIRE' : 'REPAIR CAN WIRE'}
            </button>
        </div>
        <div style={{ color: canHealthy ? 'var(--ares-cyan)' : 'var(--ares-red)', fontFamily: '"Orbitron", sans-serif', fontSize: '14px', letterSpacing: '1px' }}>
            STATUS: {canHealthy ? 'NOMINAL' : 'FALLBACK ENGAGED'}
        </div>
      </div>
    </div>
  );
}
