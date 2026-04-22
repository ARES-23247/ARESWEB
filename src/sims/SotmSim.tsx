import { useEffect, useRef, useState } from 'react';

export default function SotmSim() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [botVelocity, setBotVelocity] = useState<number>(4);
  const [botHeading, setBotHeading] = useState<number>(0);
  const [shotSpeed, setShotSpeed] = useState<number>(15);
  const [solverLogs, setSolverLogs] = useState<string>("Drag your mouse on the canvas to move the robot.");
  const robotPosRef = useRef({ x: 400, y: 320 });
  const isDraggingRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const SCALE = 30;
    const HUB = { x: 400, y: 80 };

    function drawArrow(fromX: number, fromY: number, toX: number, toY: number, color: string, width = 2) {
      const headlen = 10;
      const dx = toX - fromX;
      const dy = toY - fromY;
      const angle = Math.atan2(dy, dx);
      ctx!.beginPath();
      ctx!.strokeStyle = color;
      ctx!.lineWidth = width;
      ctx!.moveTo(fromX, fromY);
      ctx!.lineTo(toX, toY);
      ctx!.lineTo(toX - headlen * Math.cos(angle - Math.PI / 6), toY - headlen * Math.sin(angle - Math.PI / 6));
      ctx!.moveTo(toX, toY);
      ctx!.lineTo(toX - headlen * Math.cos(angle + Math.PI / 6), toY - headlen * Math.sin(angle + Math.PI / 6));
      ctx!.stroke();
    }

    let animationFrameId: number;

    const render = () => {
      if (!ctx || !canvas) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Grid
      ctx.strokeStyle = "#1a1a1a";
      ctx.lineWidth = 1;
      for (let i = 0; i < canvas.width; i += SCALE) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, canvas.height); ctx.stroke(); }
      for (let i = 0; i < canvas.height; i += SCALE) { ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(canvas.width, i); ctx.stroke(); }
      
      // Hub
      ctx.fillStyle = "#ff4d4d"; // var(--mars-red)
      ctx.beginPath(); ctx.arc(HUB.x, HUB.y, 12, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.font = "12px 'Orbitron', sans-serif";
      ctx.fillText("TARGET HUB", HUB.x - 40, HUB.y - 20);
      
      // Robot
      const ROBOT = robotPosRef.current;
      ctx.fillStyle = "#00d0ff"; // var(--ai-cyan)
      ctx.fillRect(ROBOT.x - 15, ROBOT.y - 15, 30, 30);
      
      const rVel = botVelocity;
      const rHdg = botHeading * (Math.PI / 180);
      const mVel = shotSpeed;
      const vx = rVel * Math.sin(rHdg);
      const vy = -rVel * Math.cos(rHdg);
      
      if (rVel > 0) {
        drawArrow(ROBOT.x, ROBOT.y, ROBOT.x + vx * SCALE, ROBOT.y + vy * SCALE, "#00d0ff", 2);
      }
      
      let virtualTarget = { x: HUB.x, y: HUB.y };
      let tof = 0;
      const logs: string[] = [];
      
      ctx.strokeStyle = "#555";
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(virtualTarget.x, virtualTarget.y);
      
      // Iterative Solver Loop
      for (let i = 0; i < 4; i++) {
        const distPx = Math.sqrt(Math.pow(ROBOT.x - virtualTarget.x, 2) + Math.pow(ROBOT.y - virtualTarget.y, 2));
        const distM = distPx / SCALE;
        tof = distM / mVel;
        const nextVirtualTarget = { x: HUB.x - vx * tof * SCALE, y: HUB.y - vy * tof * SCALE };
        ctx.lineTo(nextVirtualTarget.x, nextVirtualTarget.y);
        ctx.fillStyle = `rgba(255, 171, 145, ${0.3 + i * 0.2})`;
        ctx.beginPath(); ctx.arc(nextVirtualTarget.x, nextVirtualTarget.y, 6, 0, Math.PI * 2); ctx.fill();
        virtualTarget = nextVirtualTarget;
        logs.push(`Iteration ${i}: TOF=${tof.toFixed(3)}s, VirtualOffset=(${(-(vx * tof)).toFixed(2)}m, ${(-(vy * tof)).toFixed(2)}m)`);
      }
      ctx.stroke();
      ctx.setLineDash([]);
      
      drawArrow(ROBOT.x, ROBOT.y, virtualTarget.x, virtualTarget.y, "#ffab91", 2);
      const absX = ROBOT.x + (virtualTarget.x - ROBOT.x) + (vx * tof * SCALE);
      const absY = ROBOT.y + (virtualTarget.y - ROBOT.y) + (vy * tof * SCALE);
      drawArrow(ROBOT.x, ROBOT.y, absX, absY, "#ff4d4d", 3);
      
      if (!isDraggingRef.current) {
         setSolverLogs(logs.join('\\n'));
      }
      
      animationFrameId = requestAnimationFrame(render);
    };

    render();

    const updateRobotPos = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      robotPosRef.current = {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY
      };
    };

    const handleMouseDown = (e: MouseEvent) => { isDraggingRef.current = true; updateRobotPos(e); };
    const handleMouseMove = (e: MouseEvent) => { if (isDraggingRef.current) updateRobotPos(e); };
    const handleMouseUp = () => { isDraggingRef.current = false; };
    
    canvas.addEventListener("mousedown", handleMouseDown);
    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("mouseup", handleMouseUp);
    canvas.addEventListener("mouseleave", handleMouseUp);

    return () => {
      cancelAnimationFrame(animationFrameId);
      canvas.removeEventListener("mousedown", handleMouseDown);
      canvas.removeEventListener("mousemove", handleMouseMove);
      canvas.removeEventListener("mouseup", handleMouseUp);
      canvas.removeEventListener("mouseleave", handleMouseUp);
    };
  }, [botVelocity, botHeading, shotSpeed]);

  return (
    <div className="simulator-container" style={{ margin: '2rem 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h3 style={{ margin: 0, color: 'white' }}>Interactive SOTM Solver</h3>
          <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--ifm-color-emphasis-600)' }}>Visualizing Iterative Convergence & Vector Interception</p>
        </div>
      </div>
      
      <canvas role="img" aria-label="Interactive Physics Simulation Environment" 
        ref={canvasRef}
        width={800} 
        height={400} 
        style={{ width: '100%', maxWidth: '800px', aspectRatio: '2/1', height: 'auto', display: 'block', margin: '0 auto', background: '#0a0a0a', borderRadius: '8px', border: '1px solid #333', cursor: 'crosshair' }}
      />
      
      <div style={{ display: 'flex', gap: '20px', marginTop: '20px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ flex: 1, minWidth: '200px' }}>
          <label style={{ color: 'var(--ifm-color-emphasis-600)', fontSize: '0.9rem' }}>Robot Velocity: <span style={{ color: '#00d0ff' }}>{botVelocity.toFixed(1)} m/s</span></label>
          <input aria-label="Simulation Configuration Slider" type="range" min="0" max="8" value={botVelocity} step="0.1" onChange={(e) => setBotVelocity(parseFloat(e.target.value))} style={{ width: '100%' }} />
        </div>
        <div style={{ flex: 1, minWidth: '200px' }}>
          <label style={{ color: 'var(--ifm-color-emphasis-600)', fontSize: '0.9rem' }}>Robot Heading: <span style={{ color: '#00d0ff' }}>{botHeading}&deg;</span></label>
          <input aria-label="Simulation Configuration Slider" type="range" min="-180" max="180" value={botHeading} step="1" onChange={(e) => setBotHeading(parseInt(e.target.value))} style={{ width: '100%' }} />
        </div>
        <div style={{ flex: 1, minWidth: '200px' }}>
          <label style={{ color: 'var(--ifm-color-emphasis-600)', fontSize: '0.9rem' }}>Muzzle Velocity: <span style={{ color: '#00d0ff' }}>{shotSpeed.toFixed(1)} m/s</span></label>
          <input aria-label="Simulation Configuration Slider" type="range" min="5" max="30" value={shotSpeed} step="0.5" onChange={(e) => setShotSpeed(parseFloat(e.target.value))} style={{ width: '100%' }} />
        </div>
      </div>
      
      <div style={{ marginTop: '15px', padding: '10px', background: 'rgba(0,0,0,0.5)', borderRadius: '6px', fontFamily: '"JetBrains Mono", monospace', fontSize: '0.85rem', color: '#aaa', whiteSpace: 'pre-line' }}>
        {solverLogs}
      </div>
    </div>
  );
}
