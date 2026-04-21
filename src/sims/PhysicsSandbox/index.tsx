import { useRef, useEffect, useState } from 'react';

type Ball = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
};

export default function PhysicsSandbox(): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState(0);
  const [log, setLog] = useState("Physics Engine Active: 0 collisions.");

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let balls: Ball[] = [];
    const robot = { x: 370, y: 170, w: 60, h: 60 };
    let isDragging = false;
    let dragOffsetX = 0;
    let dragOffsetY = 0;
    let lastRobotX = 370;
    let lastRobotY = 170;
    let robotVx = 0;
    let robotVy = 0;
    let currentScore = 0;
    const goal = { x: 0, y: 150, w: 30, h: 100 };

    function initWorld() {
      balls = [];
      currentScore = 0;
      setScore(0);
      for (let i = 0; i < 8; i++) {
        balls.push({
          x: 150 + Math.random() * 550,
          y: 50 + Math.random() * 300,
          vx: 0,
          vy: 0,
          radius: 15,
        });
      }
      robot.x = 370;
      robot.y = 170;
    }
    initWorld();

    const handleMouseDown = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const mx = (e.clientX - rect.left) * (canvas.width / rect.width);
      const my = (e.clientY - rect.top) * (canvas.height / rect.height);
      if (mx >= robot.x && mx <= robot.x + robot.w && my >= robot.y && my <= robot.y + robot.h) {
        isDragging = true;
        canvas.style.cursor = 'grabbing';
        dragOffsetX = mx - robot.x;
        dragOffsetY = my - robot.y;
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        const rect = canvas.getBoundingClientRect();
        robot.x = ((e.clientX - rect.left) * (canvas.width / rect.width)) - dragOffsetX;
        robot.y = ((e.clientY - rect.top) * (canvas.height / rect.height)) - dragOffsetY;
      }
    };

    const handleMouseUp = () => {
      isDragging = false;
      canvas.style.cursor = 'grab';
    };

    canvas.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    let animationId: number;
    const render = () => {
      // Physics
      robotVx = robot.x - lastRobotX;
      robotVy = robot.y - lastRobotY;
      lastRobotX = robot.x;
      lastRobotY = robot.y;

      let logMsg = "Dyn4j Simulation Tracking...";

      balls.forEach((b) => {
        if (b.x - b.radius < goal.w && b.y > goal.y && b.y < goal.y + goal.h) {
          currentScore++;
          setScore(currentScore);
          logMsg = "⚽ GOAL SCORED! Resetting ball...";
          b.x = 400 + Math.random() * 300;
          b.y = 50 + Math.random() * 300;
          b.vx = 0;
          b.vy = 0;
          return;
        }

        // Walls
        if (b.x - b.radius < 0) { b.x = b.radius; b.vx *= -0.7; }
        if (b.x + b.radius > canvas.width) { b.x = canvas.width - b.radius; b.vx *= -0.7; }
        if (b.y - b.radius < 0) { b.y = b.radius; b.vy *= -0.7; }
        if (b.y + b.radius > canvas.height) { b.y = canvas.height - b.radius; b.vy *= -0.7; }

        // Robot collision
        let testX = b.x;
        let testY = b.y;
        if (b.x < robot.x) testX = robot.x; else if (b.x > robot.x + robot.w) testX = robot.x + robot.w;
        if (b.y < robot.y) testY = robot.y; else if (b.y > robot.y + robot.h) testY = robot.y + robot.h;
        let distX = b.x - testX;
        let distY = b.y - testY;
        let distance = Math.sqrt((distX * distX) + (distY * distY));

        if (distance < b.radius) {
          logMsg = "💥 CONTINUOUS COLLISION DETECTED";
          const overlap = b.radius - distance;
          if (distance === 0) { distX = 1; distY = 0; distance = 1; }
          const nx = distX / distance;
          const ny = distY / distance;
          b.x += nx * overlap;
          b.y += ny * overlap;
          if (isDragging) {
            b.vx += (robotVx * 0.8) + (nx * 2);
            b.vy += (robotVy * 0.8) + (ny * 2);
          } else {
            b.vx += nx * 2;
            b.vy += ny * 2;
          }
        }

        b.x += b.vx;
        b.y += b.vy;
        b.vx *= 0.92;
        b.vy *= 0.92;
      });

      // Ball to ball collision
      for (let i = 0; i < balls.length; i++) {
        for (let j = i + 1; j < balls.length; j++) {
          const b1 = balls[i]; const b2 = balls[j];
          let dx = b2.x - b1.x; let dy = b2.y - b1.y;
          let dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < b1.radius + b2.radius) {
            const overlap = (b1.radius + b2.radius) - dist;
            if (dist === 0) { dx = 1; dy = 0; dist = 1;}
            const nx = dx / dist; const ny = dy / dist;
            b1.x -= nx * overlap / 2; b1.y -= ny * overlap / 2;
            b2.x += nx * overlap / 2; b2.y += ny * overlap / 2;
            const tx = b1.vx; const ty = b1.vy;
            b1.vx += (b2.vx - b1.vx) * 0.8; b1.vy += (b2.vy - b1.vy) * 0.8;
            b2.vx += (tx - b2.vx) * 0.8; b2.vy += (ty - b2.vy) * 0.8;
          }
        }
      }

      setLog(logMsg);

      // Rendering
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = "#111";
      ctx.lineWidth = 1;
      for (let i = 0; i < canvas.width; i += 40) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, canvas.height); ctx.stroke(); }
      for (let i = 0; i < canvas.height; i += 40) { ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(canvas.width, i); ctx.stroke(); }
      
      // Goal
      ctx.fillStyle = "rgba(41, 182, 246, 0.3)";
      ctx.fillRect(goal.x, goal.y, goal.w, goal.h);
      ctx.save();
      ctx.shadowColor = "#00f2ff";
      ctx.shadowBlur = 15;
      ctx.strokeStyle = "#00f2ff";
      ctx.lineWidth = 3;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(goal.x + goal.w, goal.y);
      ctx.lineTo(goal.x + goal.w, goal.y + goal.h);
      ctx.stroke();
      ctx.restore();

      // Balls
      balls.forEach(b => {
        const grad = ctx.createRadialGradient(b.x, b.y, b.radius * 0.5, b.x, b.y, b.radius * 1.5);
        grad.addColorStop(0, '#ff9800');
        grad.addColorStop(1, 'rgba(255, 152, 0, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath(); ctx.arc(b.x, b.y, b.radius * 1.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#ffb300";
        ctx.beginPath(); ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "#e65100"; ctx.lineWidth = 2; ctx.stroke();
      });

      // Robot
      ctx.fillStyle = "rgba(41, 182, 246, 0.2)";
      ctx.fillRect(robot.x, robot.y, robot.w, robot.h);
      ctx.strokeStyle = "#00f2ff";
      ctx.lineWidth = 2;
      ctx.strokeRect(robot.x, robot.y, robot.w, robot.h);

      animationId = requestAnimationFrame(render);
    };
    render();

    return () => {
      cancelAnimationFrame(animationId);
      canvas.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  return (
    <div className="bg-[#111] border border-zinc-700/50 ares-cut-sm p-5 my-10">
      <div className="flex justify-between items-center mb-5">
        <div>
          <h3 className="m-0 text-white font-bold">Interactive Collision Sandbox</h3>
          <p className="m-0 text-sm text-zinc-400">Drag the blue robot chassis to collide with the Fuel Balls. Hit them into the goal!</p>
        </div>
        <div className="bg-ares-red/20 border border-ares-red px-4 py-2 ares-cut-sm font-heading font-bold text-white">
          SCORE: {score}
        </div>
      </div>
      <canvas role="img" aria-label="Interactive Physics Simulation Environment" ref={canvasRef} width={800} height={400} className="w-full max-w-[800px] aspect-[2/1] h-auto block mx-auto bg-[#050505] ares-cut-sm border border-zinc-800 cursor-grab drop-shadow-2xl shadow-[inset_0_0_40px_rgba(0,0,0,0.8)]" />
      <div className="mt-4 p-3 bg-black/50 ares-cut-sm font-mono text-sm text-zinc-400">
        {log}
      </div>
    </div>
  );
}
