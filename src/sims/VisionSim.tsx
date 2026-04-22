import { useEffect, useRef, useState } from 'react';

export default function VisionSim() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const robotPosRef = useRef({ x: 200, y: 200 });
  const isDraggingRef = useRef(false);

  const [tagCount, setTagCount] = useState<number>(1);
  const [yawRate, setYawRate] = useState<number>(0);
  const [tiltVal, setTiltVal] = useState<number>(0);
  const [solverLog, setSolverLog] = useState<{ text: string, color: string }>({ text: "Drag your robot across the field grid.", color: "#aaa" });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const SCALE = 40;
    const APRIL_TAG_1 = { x: 750, y: 150 };
    const APRIL_TAG_2 = { x: 750, y: 250 };
    const FIELD_WIDTH = 750;
    const FIELD_HEIGHT = 400;

    let animationFrameId: number;

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = "#1a1a1a";
      ctx.lineWidth = 1;
      
      for (let i = 0; i < canvas.width; i += SCALE) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, canvas.height); ctx.stroke(); }
      for (let i = 0; i < canvas.height; i += SCALE) { ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(canvas.width, i); ctx.stroke(); }
      
      ctx.strokeStyle = "rgba(41, 182, 246, 0.3)";
      ctx.lineWidth = 2;
      ctx.strokeRect(0, 0, FIELD_WIDTH, FIELD_HEIGHT);
      
      const tagsVisible = tagCount;
      ctx.fillStyle = "white";
      ctx.fillRect(APRIL_TAG_1.x - 5, APRIL_TAG_1.y - 15, 10, 30);
      if (tagsVisible > 1) { ctx.fillRect(APRIL_TAG_2.x - 5, APRIL_TAG_2.y - 15, 10, 30); }
      
      const ROBOT = robotPosRef.current;
      ctx.fillStyle = "rgba(41, 182, 246, 0.8)";
      ctx.fillRect(ROBOT.x - 15, ROBOT.y - 15, 30, 30);
      
      const yaw = yawRate;
      const tilt = tiltVal;
      const dist1 = Math.sqrt(Math.pow(ROBOT.x - APRIL_TAG_1.x, 2) + Math.pow(ROBOT.y - APRIL_TAG_1.y, 2)) / SCALE;
      const dist2 = tagsVisible > 1 ? Math.sqrt(Math.pow(ROBOT.x - APRIL_TAG_2.x, 2) + Math.pow(ROBOT.y - APRIL_TAG_2.y, 2)) / SCALE : dist1;
      const avgDist = (dist1 + dist2) / tagsVisible;
      
      ctx.strokeStyle = "rgba(255,255,255,0.2)";
      ctx.setLineDash([5, 5]);
      ctx.beginPath(); ctx.moveTo(ROBOT.x, ROBOT.y); ctx.lineTo(APRIL_TAG_1.x, APRIL_TAG_1.y); ctx.stroke();
      if (tagsVisible > 1) { ctx.beginPath(); ctx.moveTo(ROBOT.x, ROBOT.y); ctx.lineTo(APRIL_TAG_2.x, APRIL_TAG_2.y); ctx.stroke(); }
      ctx.setLineDash([]);
      
      let rejectReason: string | null = null;
      if (ROBOT.x < 0 || ROBOT.x > FIELD_WIDTH + 20 || ROBOT.y < -20 || ROBOT.y > FIELD_HEIGHT + 20) { 
        rejectReason = "OUT OF BOUNDS";
      } else if (tilt > 15) { 
        rejectReason = "TILT > 15 DEGREES";
      } else if (yaw > 120) { 
        rejectReason = "YAW RATE > 120 DEG/S"; 
      }
      
      if (rejectReason) {
        ctx.fillStyle = "rgba(179, 36, 22, 0.4)";
        ctx.fillRect(ROBOT.x - 20, ROBOT.y - 20, 40, 40);
        ctx.fillStyle = "#ff4d4d"; // var(--mars-red-light)
        ctx.font = "bold 16px 'Orbitron', sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("REJECTED", ROBOT.x, ROBOT.y - 30);
        
        if (!isDraggingRef.current) {
          setSolverLog({ text: `FILTRATION TRIGGERED: ${rejectReason}. Measurement discarded.`, color: "#ff4d4d" });
        }
        ctx.textAlign = "left";
        animationFrameId = requestAnimationFrame(render);
        return;
      }
      
      const baseStdDev = 0.05;
      let linearStdDev = baseStdDev * Math.pow(avgDist, 2);
      if (tagsVisible > 1) linearStdDev *= 0.1;
      
      const radiusPx = (linearStdDev * SCALE) + 5;
      ctx.fillStyle = tagsVisible > 1 ? "rgba(76, 175, 80, 0.15)" : "rgba(41, 182, 246, 0.15)";
      ctx.strokeStyle = tagsVisible > 1 ? "#4caf50" : "#00d0ff";
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(ROBOT.x, ROBOT.y, Math.min(radiusPx, 300), 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      
      ctx.fillStyle = tagsVisible > 1 ? "#4caf50" : "#00d0ff";
      ctx.textAlign = "center";
      ctx.font = "12px 'Orbitron', sans-serif";
      ctx.fillText(`StdDev: ${linearStdDev.toFixed(3)}m`, ROBOT.x, ROBOT.y + Math.min(radiusPx, 300) + 15);
      ctx.textAlign = "left";
      
      if (!isDraggingRef.current) {
        setSolverLog({ 
          text: `Measurement ACCEPTED: Avg Dist = ${avgDist.toFixed(2)}m. Scaling ${baseStdDev} * dist^2. ${tagsVisible > 1 ? '\\nApplied 0.1x Multi-Tag Boost.' : ''}`,
          color: tagsVisible > 1 ? "#4caf50" : "#00d0ff"
        });
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
  }, [tagCount, yawRate, tiltVal]);

  return (
    <div className="simulator-container" style={{ background: '#050505', border: '1px solid var(--ifm-color-emphasis-200)', borderRadius: '12px', padding: '24px', margin: '40px 0', boxShadow: 'inset 0 0 40px rgba(0,0,0,0.8)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h3 style={{ margin: 0, color: 'white', fontFamily: '"Orbitron", sans-serif' }}>Interactive Vision Trust Simulator</h3>
          <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--ifm-color-emphasis-600)' }}>Visualize StdDev scaling and rejection filters in real time.</p>
        </div>
      </div>
      
      <canvas role="img" aria-label="Interactive Physics Simulation Environment" 
        ref={canvasRef}
        width={800} 
        height={400} 
        style={{ width: '100%', height: 'auto', background: '#0a0a0a', borderRadius: '12px', border: '1px solid #333', cursor: 'crosshair', aspectRatio: '2/1' }}
      />
      
      <div style={{ display: 'flex', gap: '20px', marginTop: '20px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ flex: 1, minWidth: '180px' }}>
          <label style={{ color: 'var(--ifm-color-emphasis-600)', fontSize: '0.9rem', fontFamily: '"Orbitron", sans-serif' }}>Tags Visible: <span style={{ color: '#00d0ff' }}>{tagCount === 1 ? "1 Tag" : "2 Tags (MegaTagBoost)"}</span></label>
          <input aria-label="Simulation Configuration Slider" type="range" min="1" max="2" value={tagCount} step="1" onChange={(e) => setTagCount(parseInt(e.target.value))} style={{ width: '100%' }} />
        </div>
        <div style={{ flex: 1, minWidth: '180px' }}>
          <label style={{ color: 'var(--ifm-color-emphasis-600)', fontSize: '0.9rem', fontFamily: '"Orbitron", sans-serif' }}>Robot Spin Rate: <span style={{ color: '#00d0ff' }}>{yawRate}&deg;/s</span></label>
          <input aria-label="Simulation Configuration Slider" type="range" min="0" max="250" value={yawRate} step="5" onChange={(e) => setYawRate(parseFloat(e.target.value))} style={{ width: '100%' }} />
        </div>
        <div style={{ flex: 1, minWidth: '180px' }}>
          <label style={{ color: 'var(--ifm-color-emphasis-600)', fontSize: '0.9rem', fontFamily: '"Orbitron", sans-serif' }}>Robot Pitch (Tilt): <span style={{ color: '#00d0ff' }}>{tiltVal}&deg;</span></label>
          <input aria-label="Simulation Configuration Slider" type="range" min="0" max="30" value={tiltVal} step="1" onChange={(e) => setTiltVal(parseFloat(e.target.value))} style={{ width: '100%' }} />
        </div>
      </div>
      
      <div style={{ marginTop: '15px', padding: '10px', background: 'rgba(0,0,0,0.5)', borderRadius: '6px', fontFamily: '"JetBrains Mono", monospace', fontSize: '0.85rem', color: solverLog.color, border: '1px solid rgba(255,255,255,0.05)', whiteSpace: 'pre-line' }}>
        {solverLog.text}
      </div>
    </div>
  );
}
