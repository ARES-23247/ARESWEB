export const SIM_TEMPLATES: Record<string, Record<string, string>> = {
  "Default (Robot Arm)": {
    "SimComponent.jsx": `import React, { useState } from 'react';
import { RobotArm } from './RobotArm.jsx';

export default function SimComponent() {
  const [speed, setSpeed] = useState(2);
  
  return (
    <div className="sim-container">
      <div className="sim-title">Robot Arm Visualizer</div>
      <RobotArm speed={speed} />
      <div className="sim-flex" style={{ justifyContent: 'space-between', marginTop: 16 }}>
        <div>
          <div className="sim-label">Speed</div>
          <input type="range" min="0.5" max="10" step="0.5" value={speed} onChange={e => setSpeed(Number(e.target.value))} className="sim-slider" style={{ width: 180 }} />
        </div>
      </div>
    </div>
  );
}`,
    "RobotArm.jsx": `import React, { useRef, useEffect } from 'react';

export function RobotArm({ speed }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let animationFrameId;
    let angle1 = 0;
    let angle2 = 0;

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.translate(canvas.width / 2, canvas.height / 2);

      // Base
      ctx.fillStyle = '#FFC107';
      ctx.fillRect(-20, -10, 40, 20);

      // Link 1
      ctx.rotate(Math.sin(angle1) * 0.5);
      ctx.fillStyle = '#2196F3';
      ctx.fillRect(-10, 0, 20, 80);
      
      // Joint
      ctx.translate(0, 80);
      ctx.beginPath();
      ctx.arc(0, 0, 10, 0, Math.PI * 2);
      ctx.fillStyle = '#F44336';
      ctx.fill();

      // Link 2
      ctx.rotate(Math.sin(angle2) * 1.5);
      ctx.fillStyle = '#4CAF50';
      ctx.fillRect(-5, 0, 10, 60);

      ctx.restore();

      angle1 += 0.02 * speed;
      angle2 += 0.03 * speed;
      animationFrameId = window.requestAnimationFrame(render);
    };

    render();

    return () => window.cancelAnimationFrame(animationFrameId);
  }, [speed]);

  return <canvas ref={canvasRef} width={400} height={300} className="sim-canvas" />;
}`
  },
  "Elevator System": {
    "SimComponent.jsx": `import React, { useState } from 'react';
import { Elevator } from './Elevator.jsx';
import { PidController } from './PidController.js';

export default function SimComponent() {
  const [setpoint, setSetpoint] = useState(0);
  const [currentHeight, setCurrentHeight] = useState(0);
  
  return (
    <div className="sim-container">
      <div className="sim-title">Elevator PID Simulator</div>
      <div className="sim-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <Elevator 
          setpoint={setpoint} 
          currentHeight={currentHeight} 
          onHeightChange={setCurrentHeight} 
        />
        <div style={{ padding: '16px', borderLeft: '1px solid rgba(255,255,255,0.1)' }}>
          <div className="sim-label">Target Height (m)</div>
          <input 
            type="range" min="0" max="2" step="0.1" 
            value={setpoint} onChange={e => setSetpoint(Number(e.target.value))} 
            className="sim-slider" style={{ width: '100%' }} 
          />
          <div className="sim-value" style={{ marginTop: 8 }}>{setpoint.toFixed(2)}m</div>
          
          <div className="sim-label" style={{ marginTop: 24 }}>Actual Height</div>
          <div className="sim-value" style={{ color: '#4CAF50', fontSize: '24px' }}>
            {currentHeight.toFixed(2)}m
          </div>
        </div>
      </div>
    </div>
  );
}`,
    "Elevator.jsx": `import React, { useRef, useEffect } from 'react';
import { PidController } from './PidController.js';

export function Elevator({ setpoint, currentHeight, onHeightChange }) {
  const canvasRef = useRef(null);
  
  // PID constants
  const kp = 0.5;
  const ki = 0.01;
  const kd = 0.1;
  
  const pidRef = useRef(new PidController(kp, ki, kd));
  const posRef = useRef(currentHeight);
  const velRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let animationFrameId;
    let lastTime = performance.now();

    const render = (time) => {
      const dt = Math.min((time - lastTime) / 1000, 0.1);
      lastTime = time;
      
      // Update physics
      const output = pidRef.current.calculate(setpoint, posRef.current, dt);
      
      // Simple mass-spring-damper physics
      const mass = 10;
      const gravity = 9.81;
      const force = Math.max(-12, Math.min(12, output)) * 50; // Motor force
      const netForce = force - (mass * gravity);
      const acceleration = netForce / mass;
      
      velRef.current += acceleration * dt;
      velRef.current *= 0.95; // friction
      posRef.current += velRef.current * dt;
      
      // Limits
      if (posRef.current < 0) {
        posRef.current = 0;
        velRef.current = 0;
      }
      if (posRef.current > 2.5) {
        posRef.current = 2.5;
        velRef.current = 0;
      }
      
      onHeightChange(posRef.current);
      
      // Draw
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Ground
      ctx.fillStyle = '#333';
      ctx.fillRect(0, canvas.height - 20, canvas.width, 20);
      
      // Elevator shaft
      ctx.strokeStyle = '#666';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(100, canvas.height - 20);
      ctx.lineTo(100, 20);
      ctx.moveTo(200, canvas.height - 20);
      ctx.lineTo(200, 20);
      ctx.stroke();
      
      // Map 0-2.5m to pixels
      const pxPerMeter = (canvas.height - 60) / 2.5;
      const carriageY = canvas.height - 20 - (posRef.current * pxPerMeter);
      const setpointY = canvas.height - 20 - (setpoint * pxPerMeter);
      
      // Setpoint line
      ctx.strokeStyle = 'rgba(255, 255, 0, 0.5)';
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(50, setpointY);
      ctx.lineTo(250, setpointY);
      ctx.stroke();
      ctx.setLineDash([]);
      
      // Carriage
      ctx.fillStyle = '#2196F3';
      ctx.fillRect(105, carriageY - 40, 90, 40);

      animationFrameId = window.requestAnimationFrame(render);
    };

    animationFrameId = window.requestAnimationFrame(render);

    return () => window.cancelAnimationFrame(animationFrameId);
  }, [setpoint, onHeightChange]);

  return <canvas ref={canvasRef} width={300} height={400} className="sim-canvas" style={{ width: '100%', height: 'auto', maxHeight: '400px' }} />;
}`,
    "PidController.js": `export class PidController {
  constructor(kp, ki, kd) {
    this.kp = kp;
    this.ki = ki;
    this.kd = kd;
    this.integral = 0;
    this.prevError = 0;
  }
  
  calculate(setpoint, processVariable, dt) {
    if (dt === 0) return 0;
    
    const error = setpoint - processVariable;
    this.integral += error * dt;
    const derivative = (error - this.prevError) / dt;
    this.prevError = error;
    
    return (this.kp * error) + (this.ki * this.integral) + (this.kd * derivative);
  }
}`
  }
};
