/** @sim {"name": "Dyn4j Physics Subsystem", "requiresContext": true} */
import { useEffect, useRef, useState } from 'react';

export default function PhysicsSim() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [logMsg, setLogMsg] = useState<{ text: string, color: string }>({ text: "Physics Engine Active: 0 collisions.", color: "var(--ares-gray)" });
  const isDraggingRef = useRef(false);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const robotRef = useRef({ x: 370, y: 170, w: 60, h: 60 });
  const lastRobotPosRef = useRef({ x: 370, y: 170 });
  const scoreRef = useRef(0);
  const ballsRef = useRef<{ x: number, y: number, vx: number, vy: number, radius: number }[]>([]);

  const initWorld = () => {
    const newBalls = [];
    scoreRef.current = 0;
    for (let i = 0; i < 8; i++) {
        newBalls.push({
            x: 150 + Math.random() * 550,
            y: 50 + Math.random() * 300,
            vx: 0,
            vy: 0,
            radius: 15
        });
    }
    ballsRef.current = newBalls;
    robotRef.current = { x: 370, y: 170, w: 60, h: 60 };
    lastRobotPosRef.current = { x: 370, y: 170 };
    setLogMsg({ text: "Physics Engine Active: 0 collisions.", color: "var(--ares-gray)" });
  };

  useEffect(() => {
    setTimeout(initWorld, 0);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    const goal = { x: 0, y: 150, w: 30, h: 100 };

    const render = () => {
        const robot = robotRef.current;
        const balls = ballsRef.current;

        const aresRed = getComputedStyle(document.documentElement).getPropertyValue('--ares-red').trim() || 'var(--ares-red)';
        const aresCyan = getComputedStyle(document.documentElement).getPropertyValue('--ares-cyan').trim() || 'var(--ares-cyan)';
        const aresGold = getComputedStyle(document.documentElement).getPropertyValue('--ares-gold').trim() || 'var(--ares-gold)';
        const obsidian = getComputedStyle(document.documentElement).getPropertyValue('--obsidian').trim() || 'var(--obsidian)';
        const marble = getComputedStyle(document.documentElement).getPropertyValue('--marble').trim() || 'var(--marble)';

        // Resolve physics step
        const robotVx = robot.x - lastRobotPosRef.current.x;
        const robotVy = robot.y - lastRobotPosRef.current.y;
        lastRobotPosRef.current.x = robot.x;
        lastRobotPosRef.current.y = robot.y;
        
        let localLogMsg = "Dyn4j Simulation Tracking...";
        let collisionTriggered = false;

        balls.forEach(b => {
            if (b.x - b.radius < goal.w && b.y > goal.y && b.y < goal.y + goal.h) {
                scoreRef.current++;
                localLogMsg = "âš½ GOAL SCORED! Resetting ball...";
                collisionTriggered = true;
                b.x = 400 + Math.random() * 300;
                b.y = 50 + Math.random() * 300;
                b.vx = 0;
                b.vy = 0;
                return; // Early return for this ball
            }
            if (b.x - b.radius < 0) { b.x = b.radius; b.vx *= -0.7; }
            if (b.x + b.radius > canvas.width) { b.x = canvas.width - b.radius; b.vx *= -0.7; }
            if (b.y - b.radius < 0) { b.y = b.radius; b.vy *= -0.7; }
            if (b.y + b.radius > canvas.height) { b.y = canvas.height - b.radius; b.vy *= -0.7; }

            // Robot AABB Collision
            let testX = b.x;
            let testY = b.y;
            if (b.x < robot.x) testX = robot.x; 
            else if (b.x > robot.x + robot.w) testX = robot.x + robot.w;
            if (b.y < robot.y) testY = robot.y; 
            else if (b.y > robot.y + robot.h) testY = robot.y + robot.h;
            
            let distX = b.x - testX;
            let distY = b.y - testY;
            let distance = Math.sqrt((distX * distX) + (distY * distY));
            if (distance < b.radius) {
                collisionTriggered = true;
                localLogMsg = "💥 CONTINUOUS COLLISION DETECTED";
                const overlap = b.radius - distance;
                if (distance === 0) { distX = 1; distY = 0; distance = 1; }
                const nx = distX / distance;
                const ny = distY / distance;
                b.x += nx * overlap;
                b.y += ny * overlap;
                if (isDraggingRef.current) {
                    b.vx += (robotVx * 0.8) + (nx * 2);
                    b.vy += (robotVy * 0.8) + (ny * 2);
                } else {
                    b.vx += nx * 2;
                    b.vy += ny * 2;
                }
            }
            b.x += b.vx;
            b.y += b.vy;
            b.vx *= 0.92; // Friction
            b.vy *= 0.92;
        });

        // Inter-ball collision
        for (let i = 0; i < balls.length; i++) {
            for (let j = i + 1; j < balls.length; j++) {
                const b1 = balls[i]; const b2 = balls[j];
                const dx = b2.x - b1.x; const dy = b2.y - b1.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < b1.radius + b2.radius) {
                    collisionTriggered = true;
                    const overlap = (b1.radius + b2.radius) - dist;
                    const nx = dx / dist; const ny = dy / dist;
                    b1.x -= nx * overlap / 2; b1.y -= ny * overlap / 2;
                    b2.x += nx * overlap / 2; b2.y += ny * overlap / 2;
                    const tx = b1.vx; const ty = b1.vy;
                    b1.vx += (b2.vx - b1.vx) * 0.8; b1.vy += (b2.vy - b1.vy) * 0.8;
                    b2.vx += (tx - b2.vx) * 0.8; b2.vy += (ty - b2.vy) * 0.8;
                }
            }
        }

        if (collisionTriggered && document.hasFocus() && isDraggingRef.current) {
            setLogMsg({ text: localLogMsg, color: aresRed });
        } else if (!isDraggingRef.current && localLogMsg === "Dyn4j Simulation Tracking...") {
            setLogMsg({ text: localLogMsg, color: aresCyan });
        }

        // Draw Frame
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = obsidian;
        ctx.lineWidth = 1;
        for (let i = 0; i < canvas.width; i += 40) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, canvas.height); ctx.stroke(); }
        for (let i = 0; i < canvas.height; i += 40) { ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(canvas.width, i); ctx.stroke(); }
        
        // Goal
        ctx.fillStyle = `${aresCyan}44`;
        ctx.fillRect(goal.x, goal.y, goal.w, goal.h);
        ctx.save();
        ctx.shadowColor = aresCyan;
        ctx.shadowBlur = 15;
        ctx.strokeStyle = aresCyan;
        ctx.lineWidth = 3;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(goal.x + goal.w, goal.y);
        ctx.lineTo(goal.x + goal.w, goal.y + goal.h);
        ctx.stroke();
        ctx.restore();
        
        ctx.fillStyle = marble;
        ctx.font = "bold 16px 'Orbitron', sans-serif";
        ctx.save();
        ctx.translate(goal.x + 15, goal.y + goal.h / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.textAlign = "center";
        ctx.shadowColor = aresCyan;
        ctx.shadowBlur = 10;
        ctx.fillText("GOAL", 0, 0);
        ctx.restore();
        
        // Scorecard
        ctx.save();
        ctx.fillStyle = "rgba(10, 10, 10, 0.9)";
        ctx.strokeStyle = aresCyan;
        ctx.lineWidth = 2;
        ctx.fillRect(canvas.width - 150, 15, 130, 45);
        ctx.strokeRect(canvas.width - 150, 15, 130, 45);
        ctx.fillStyle = marble;
        ctx.font = "bold 20px 'Orbitron', sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(`SCORE: ${scoreRef.current}`, canvas.width - 85, 45);
        ctx.restore();
        
        // Balls
        balls.forEach(b => {
            const grad = ctx.createRadialGradient(b.x, b.y, b.radius * 0.5, b.x, b.y, b.radius * 1.5);
            grad.addColorStop(0, aresGold);
            grad.addColorStop(1, `${aresGold}00`);
            ctx.fillStyle = grad;
            ctx.beginPath(); ctx.arc(b.x, b.y, b.radius * 1.5, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = aresGold;
            ctx.beginPath(); ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = aresGold; ctx.lineWidth = 2; ctx.stroke();
            ctx.fillStyle = marble;
            ctx.font = "10px sans-serif";
            ctx.fillText("FB", b.x - 6, b.y + 3);
        });
        
        // Robot
        ctx.fillStyle = `${aresCyan}33`;
        ctx.fillRect(robot.x, robot.y, robot.w, robot.h);
        ctx.strokeStyle = aresCyan;
        ctx.lineWidth = 2;
        ctx.strokeRect(robot.x, robot.y, robot.w, robot.h);
        ctx.fillStyle = marble;
        ctx.font = "bold 12px 'Orbitron', sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("CHASSIS", robot.x + robot.w / 2, robot.y + robot.h / 2 + 4);

        animationFrameId = requestAnimationFrame(render);
    };
    render();

    // Event handlers
    const handleMouseDown = (e: MouseEvent) => {
        const rect = canvas.getBoundingClientRect();
        const mx = (e.clientX - rect.left) * (canvas.width / rect.width);
        const my = (e.clientY - rect.top) * (canvas.height / rect.height);
        const robot = robotRef.current;
        if (mx >= robot.x && mx <= robot.x + robot.w && my >= robot.y && my <= robot.y + robot.h) {
            isDraggingRef.current = true;
            canvas.style.cursor = "grabbing";
            dragOffsetRef.current = { x: mx - robot.x, y: my - robot.y };
        }
    };

    const handleMouseMove = (e: MouseEvent) => {
        if (isDraggingRef.current) {
            const rect = canvas.getBoundingClientRect();
            const robot = robotRef.current;
            robot.x = ((e.clientX - rect.left) * (canvas.width / rect.width)) - dragOffsetRef.current.x;
            robot.y = ((e.clientY - rect.top) * (canvas.height / rect.height)) - dragOffsetRef.current.y;
        }
    };

    const handleMouseUp = () => { isDraggingRef.current = false; canvas.style.cursor = "grab"; };

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
  }, []);

  return (
    <div className="simulator-container bg-obsidian border border-ares-gray ares-cut p-5 my-10">
      <div className="flex justify-between items-center mb-5">
        <div>
          <h3 className="m-0 text-marble font-black tracking-tighter uppercase text-xl">Interactive Collision Sandbox</h3>
          <p className="m-0 text-sm text-ares-gray">Drag the blue robot chassis to collide with the Fuel Balls. Hit them into the glowing goal on the left!</p>
        </div>
        <button 
          onClick={initWorld}
          className="bg-ares-cyan text-obsidian border-none px-4 py-2 ares-cut-sm cursor-pointer font-bold uppercase tracking-widest text-xs"
        >
          RESET WORLD
        </button>
      </div>
      
      <canvas role="img" aria-label="Interactive Physics Simulation Environment" 
        ref={canvasRef}
        width={800} 
        height={400} 
        className="w-full max-w-[800px] aspect-[2/1] h-auto block mx-auto bg-obsidian ares-cut border border-ares-gray cursor-grab shadow-[inset_0_0_40px_rgba(0,0,0,0.8)]"
      />
      
      <div className="mt-4 p-2.5 bg-black/50 ares-cut-sm font-mono text-sm" style={{ color: logMsg.color }}>
        {logMsg.text}
      </div>
    </div>
  );
}
