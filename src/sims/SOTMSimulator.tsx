import { useEffect, useRef, useState, useCallback, MouseEvent as ReactMouseEvent } from "react";

export default function SOTMSimulator() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [botVelocity, setBotVelocity] = useState(2);
  const [botHeading, setBotHeading] = useState(45);
  const [shotSpeed, setShotSpeed] = useState(10);
  const [robotPos, setRobotPos] = useState({ x: 500, y: 300 });
  const isDragging = useRef(false);
  const [logMessages, setLogMessages] = useState<string[]>(["Click and drag inside the canvas to reposition the robot."]);

  const updateRobotPos = useCallback((e: ReactMouseEvent | MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    // Support both React synthetic events and native MouseEvent
    const clientX = 'clientX' in e ? e.clientX : 0;
    const clientY = 'clientY' in e ? e.clientY : 0;

    setRobotPos({
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    });
  }, []);

  const handleMouseDown = (e: ReactMouseEvent) => {
    isDragging.current = true;
    updateRobotPos(e);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging.current) updateRobotPos(e);
    };
    const handleMouseUp = () => {
      isDragging.current = false;
    };
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [updateRobotPos]);

  const renderSim = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const SCALE = 40;
    const HUB = { x: 400, y: 100 };

    function drawArrow(fromX: number, fromY: number, toX: number, toY: number, color: string, width = 2) {
      if(!ctx) return;
      const headlen = 10;
      const dx = toX - fromX;
      const dy = toY - fromY;
      const angle = Math.atan2(dy, dx);
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.moveTo(fromX, fromY);
      ctx.lineTo(toX, toY);
      ctx.lineTo(toX - headlen * Math.cos(angle - Math.PI / 6), toY - headlen * Math.sin(angle - Math.PI / 6));
      ctx.moveTo(toX, toY);
      ctx.lineTo(toX - headlen * Math.cos(angle + Math.PI / 6), toY - headlen * Math.sin(angle + Math.PI / 6));
      ctx.stroke();
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    ctx.strokeStyle = "rgba(255,255,255,0.03)";
    for(let i=0; i<canvas.width; i+=SCALE) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, canvas.height); ctx.stroke(); }
    for(let i=0; i<canvas.height; i+=SCALE) { ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(canvas.width, i); ctx.stroke(); }

    ctx.fillStyle = "#B32416";
    ctx.beginPath(); ctx.arc(HUB.x, HUB.y, 15, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle = "white"; ctx.stroke();
    ctx.fillStyle = "white"; ctx.fillText("TARGET GOAL", HUB.x - 45, HUB.y - 25);

    ctx.fillStyle = "#CD7F32";
    ctx.save();
    ctx.translate(robotPos.x, robotPos.y);
    ctx.rotate(botHeading * Math.PI / 180);
    ctx.fillRect(-15, -15, 30, 30);
    ctx.fillStyle = "white"; ctx.fillRect(-2, -18, 4, 10);
    ctx.restore();

    const vRobotX = botVelocity * Math.sin(botHeading * Math.PI / 180);
    const vRobotY = -botVelocity * Math.cos(botHeading * Math.PI / 180);
    
    const dx = (HUB.x - robotPos.x) / SCALE;
    const dy = (HUB.y - robotPos.y) / SCALE;
    const vs = shotSpeed;

    const a = vRobotX*vRobotX + vRobotY*vRobotY - vs*vs;
    const b = -2 * (dx*vRobotX + dy*vRobotY);
    const c = dx*dx + dy*dy;

    const disc = b*b - 4*a*c;
    const logs = [];

    if (disc >= 0 && a !== 0) {
        let tof = (-b - Math.sqrt(disc)) / (2*a);
        if (tof < 0) tof = (-b + Math.sqrt(disc)) / (2*a);
        
        if (tof > 0) {
            const aimX = HUB.x - vRobotX * tof * SCALE;
            const aimY = HUB.y - vRobotY * tof * SCALE;
            
            ctx.setLineDash([5, 5]);
            ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
            ctx.beginPath(); ctx.moveTo(HUB.x, HUB.y); ctx.lineTo(aimX, aimY); ctx.stroke();
            ctx.setLineDash([]);
            
            ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
            ctx.beginPath(); ctx.arc(aimX, aimY, 5, 0, Math.PI*2); ctx.fill();
            ctx.fillText("VIRTUAL TARGET", aimX + 10, aimY + 5);

            drawArrow(robotPos.x, robotPos.y, robotPos.x + vRobotX * SCALE, robotPos.y + vRobotY * SCALE, "#4169E1");
            drawArrow(robotPos.x, robotPos.y, HUB.x, HUB.y, "#B32416", 3);
            drawArrow(robotPos.x, robotPos.y, aimX, aimY, "#CD7F32");
            
            logs.push("TOF: " + tof.toFixed(3) + "s");
            logs.push("Aim: " + ((Math.atan2(aimY - robotPos.y, aimX - robotPos.x) * 180 / Math.PI) + 90).toFixed(1) + "°");
        } else logs.push("Unreachable velocity.");
    } else logs.push("No solution.");

    setLogMessages(logs);

  }, [botVelocity, botHeading, shotSpeed, robotPos]);

  useEffect(() => {
    renderSim();
  }, [renderSim]);

  return (
    <div className="glass-card hero-card p-5 my-8 select-none">
      <canvas 
        ref={canvasRef} 
        onMouseDown={handleMouseDown}
        width={800} height={400} 
        className="w-full h-[400px] bg-obsidian ares-cut-sm border border-white/10 cursor-crosshair touch-none" 
      />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-6">
        <div>
          <label className="text-white/60 text-sm block mb-2">Robot Velocity: <span className="text-ares-gold">{botVelocity.toFixed(1)} m/s</span></label>
          <input type="range" min="0" max="5" value={botVelocity} step="0.1" className="w-full ares-slider" onChange={(e) => setBotVelocity(parseFloat(e.target.value))} />
        </div>
        <div>
          <label className="text-white/60 text-sm block mb-2">Robot Heading: <span className="text-ares-gold">{botHeading}&deg;</span></label>
          <input type="range" min="-180" max="180" value={botHeading} step="1" className="w-full ares-slider" onChange={(e) => setBotHeading(parseFloat(e.target.value))} />
        </div>
        <div>
          <label className="text-white/60 text-sm block mb-2">Muzzle Velocity: <span className="text-ares-gold">{shotSpeed.toFixed(1)} m/s</span></label>
          <input type="range" min="3" max="20" value={shotSpeed} step="0.5" className="w-full ares-slider" onChange={(e) => setShotSpeed(parseFloat(e.target.value))} />
        </div>
      </div>
      <div className="mt-4 p-3 bg-black/40 ares-cut-sm border border-white/5 text-sm font-mono text-white/60 flex flex-wrap gap-4 justify-center">
        {logMessages.map((msg, i) => (
          <span key={i}>{msg}</span>
        ))}
      </div>
    </div>
  );
}
