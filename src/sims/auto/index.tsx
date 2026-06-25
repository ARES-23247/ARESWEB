/** @sim {"name": "Autonomous Visualizer", "requiresContext": true} */
import { useEffect, useRef, useState } from 'react';

type Point = { x: number, y: number };

// Cubic Hermite Spline calculation
function getSplinePoint(pts: Point[], t: number): Point {
  const p0 = pts[0];
  const p1 = pts[1];
  const p2 = pts[2];
  const p3 = pts[3];
  
  const t2 = t * t;
  const t3 = t2 * t;

  // Catmull-Rom math
  const q0 = -0.5 * t3 + t2 - 0.5 * t;
  const q1 = 1.5 * t3 - 2.5 * t2 + 1.0;
  const q2 = -1.5 * t3 + 2.0 * t2 + 0.5 * t;
  const q3 = 0.5 * t3 - 0.5 * t2;

  const x = p0.x * q0 + p1.x * q1 + p2.x * q2 + p3.x * q3;
  const y = p0.y * q0 + p1.y * q1 + p2.y * q2 + p3.y * q3;

  return { x, y };
}

// Generate dense path
function generatePath(points: Point[]): Point[] {
  if (points.length < 4) return [];
  const path: Point[] = [];
  const pts = [points[0], ...points, points[points.length - 1]];
  
  for (let i = 1; i < pts.length - 2; i++) {
    for (let t = 0; t <= 1; t += 0.05) {
      path.push(getSplinePoint([pts[i-1], pts[i], pts[i+1], pts[i+2]], t));
    }
  }
  return path;
}

export default function AutoSim() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const waypointsRef = useRef<Point[]>([
    { x: 50, y: 300 },
    { x: 250, y: 150 },
    { x: 500, y: 350 },
    { x: 700, y: 100 }
  ]);

  const draggedPointRef = useRef<number | null>(null);
  const robotRef = useRef({ x: 50, y: 300, progress: 0, heading: 0 });
  const playRef = useRef(false);

  useEffect(() => {
    playRef.current = isPlaying;
  }, [isPlaying]);

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
        height = 400; // Fixed canvas decouple
        canvas.width = width;
        canvas.height = height;
      }
    };
    window.addEventListener('resize', resize);
    resize();

    let animationFrameId: number;
    let path = generatePath(waypointsRef.current);

    const handlePointerDown = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      const clickedIdx = waypointsRef.current.findIndex((p: Point) => Math.hypot(p.x - x, p.y - y) < 20);
      if (clickedIdx !== -1) {
        draggedPointRef.current = clickedIdx;
        setIsPlaying(false);
      }
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (draggedPointRef.current !== null) {
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        waypointsRef.current[draggedPointRef.current] = { x, y };
        path = generatePath(waypointsRef.current);
      }
    };

    const handlePointerUp = () => {
      draggedPointRef.current = null;
    };

    canvas.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    function loop() {
      if (playRef.current && path.length > 0) {
        const r = robotRef.current;
        r.progress += 0.005;
        if (r.progress >= 1.0) {
          r.progress = 0;
          setIsPlaying(false);
        } else {
          const idx = Math.floor(r.progress * (path.length - 1));
          const nextIdx = Math.min(idx + 1, path.length - 1);
          const p1 = path[idx];
          const p2 = path[nextIdx];
          
          r.x = p1.x;
          r.y = p1.y;
          
          if (idx !== nextIdx) {
            r.heading = Math.atan2(p2.y - p1.y, p2.x - p1.x);
          }
        }
      } else if (!playRef.current) {
        robotRef.current.progress = 0;
        if (path.length > 0) {
           robotRef.current.x = path[0].x;
           robotRef.current.y = path[0].y;
           const p1 = path[0];
           const p2 = path[1] || p1;
           robotRef.current.heading = Math.atan2(p2.y - p1.y, p2.x - p1.x);
        }
      }

      ctx!.clearRect(0, 0, width, height);
      
      ctx!.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx!.lineWidth = 1;
      const gridSize = 40;
      for(let i = 0; i < width; i += gridSize) {
        ctx!.beginPath(); ctx!.moveTo(i, 0); ctx!.lineTo(i, height); ctx!.stroke();
      }
      for(let i = 0; i < height; i += gridSize) {
        ctx!.beginPath(); ctx!.moveTo(0, i); ctx!.lineTo(width, i); ctx!.stroke();
      }

      if (path.length > 0) {
        ctx!.beginPath();
        ctx!.strokeStyle = 'rgba(41, 182, 246, 0.5)';
        ctx!.lineWidth = 4;
        ctx!.setLineDash([5, 5]);
        ctx!.moveTo(path[0].x, path[0].y);
        for(let i=1; i<path.length; i++) {
          ctx!.lineTo(path[i].x, path[i].y);
        }
        ctx!.stroke();
        ctx!.setLineDash([]);
      }

      waypointsRef.current.forEach((p: Point, i: number) => {
        ctx!.beginPath();
        ctx!.fillStyle = i === 0 || i === waypointsRef.current.length-1 ? 'var(--ares-red)' : 'var(--ares-cyan)';
        ctx!.arc(p.x, p.y, 8, 0, Math.PI * 2);
        ctx!.fill();
        ctx!.strokeStyle = 'rgba(255,255,255,0.8)';
        ctx!.lineWidth = 2;
        ctx!.stroke();
      });

      const rbW = 40;
      const rbH = 40;
      const rx = robotRef.current.x;
      const ry = robotRef.current.y;
      const rh = robotRef.current.heading;

      ctx!.save();
      ctx!.translate(rx, ry);
      
      ctx!.fillStyle = 'rgba(40, 40, 40, 0.9)';
      ctx!.strokeStyle = 'var(--ares-cyan)';
      ctx!.lineWidth = 2;
      ctx!.fillRect(-rbW/2, -rbH/2, rbW, rbH);
      ctx!.strokeRect(-rbW/2, -rbH/2, rbW, rbH);
      
      ctx!.rotate(rh);
      ctx!.strokeStyle = '#9c7bcc';
      ctx!.beginPath(); ctx!.moveTo(0,0); ctx!.lineTo(30, 0); ctx!.stroke();
      
      ctx!.restore();

      animationFrameId = requestAnimationFrame(loop);
    }
    
    setTimeout(() => {
        resize();
        loop();
    }, 100);

    return () => {
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <div style={{ width: '100%', minHeight: '480px', height: 'auto', backgroundColor: 'var(--obsidian)', border: '1px solid #2a2a2a', borderRadius: '8px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <canvas role="img" aria-label="Interactive Physics Simulation Environment" ref={canvasRef} style={{ display: 'block', width: '100%', height: '400px', cursor: 'crosshair' }} />
      <div style={{ padding: '15px', borderTop: '1px solid #2a2a2a', display: 'flex', gap: '20px', background: 'var(--obsidian)', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ color: 'var(--ares-gray)', fontFamily: '"Orbitron", sans-serif', fontSize: '14px' }}>
            <strong style={{ color: 'var(--ares-cyan)' }}>PATHPLANNER</strong> SPLINE GENERATOR
        </div>
        <button 
            onClick={() => setIsPlaying(!isPlaying)} 
            style={{ background: isPlaying ? 'var(--ares-gray)' : 'var(--ares-red)', color: 'var(--marble)', border: 'none', padding: '8px 25px', borderRadius: '4px', cursor: 'pointer', fontFamily: '"Orbitron", sans-serif', fontWeight: 'bold' }}>
            {isPlaying ? 'STOP' : 'FOLLOW SPLINE'}
        </button>
      </div>
    </div>
  );
}
