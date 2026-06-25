import React, { useState, useCallback, useEffect, useRef } from 'react';

interface Flower {
  id: number;
  x: number;
  y: number;
  type: 'rose' | 'daisy' | 'tulip' | 'sunflower' | 'lily';
  color: string;
  pollenColor: string;
  hasPollen: boolean;
  isPollinated: boolean;
  size: number;
  bloomPhase: number;
}

interface Bee {
  id: number;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  carryingPollen: boolean;
  pollenSource: string | null;
  speed: number;
  wingPhase: number;
}

interface PollenParticle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

interface PollinatedCount {
  [key: string]: number;
}

const FLOWER_TYPES = [
  { type: 'rose' as const, color: '#e11d48', pollenColor: '#fbbf24', name: 'Rose' },
  { type: 'daisy' as const, color: '#f0f0f0', pollenColor: '#facc15', name: 'Daisy' },
  { type: 'tulip' as const, color: '#a855f7', pollenColor: '#fde68a', name: 'Tulip' },
  { type: 'sunflower' as const, color: '#eab308', pollenColor: '#92400e', name: 'Sunflower' },
  { type: 'lily' as const, color: '#f472b6', pollenColor: '#fcd34d', name: 'Lily' },
];

const CANVAS_W = 800;
const CANVAS_H = 500;

function rand(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function dist(x1: number, y1: number, x2: number, y2: number): number {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

function lightenColor(hex: string, amount: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, ((num >> 16) & 0xff) + Math.round(255 * amount));
  const g = Math.min(255, ((num >> 8) & 0xff) + Math.round(255 * amount));
  const b = Math.min(255, (num & 0xff) + Math.round(255 * amount));
  return `rgb(${r},${g},${b})`;
}

function generateFlowers(count: number): Flower[] {
  const flowers: Flower[] = [];
  const margin = 60;
  for (let i = 0; i < count; i++) {
    const typeDef = FLOWER_TYPES[Math.floor(Math.random() * FLOWER_TYPES.length)];
    flowers.push({
      id: i,
      x: rand(margin, CANVAS_W - margin),
      y: rand(margin, CANVAS_H - margin),
      type: typeDef.type,
      color: typeDef.color,
      pollenColor: typeDef.pollenColor,
      hasPollen: true,
      isPollinated: false,
      size: rand(18, 30),
      bloomPhase: rand(0, Math.PI * 2),
    });
  }
  for (let pass = 0; pass < 50; pass++) {
    let moved = false;
    for (let i = 0; i < flowers.length; i++) {
      for (let j = i + 1; j < flowers.length; j++) {
        const d = dist(flowers[i].x, flowers[i].y, flowers[j].x, flowers[j].y);
        if (d < 60) {
          const angle = Math.atan2(flowers[j].y - flowers[i].y, flowers[j].x - flowers[i].x);
          const push = (60 - d) / 2 + 1;
          flowers[i].x -= Math.cos(angle) * push;
          flowers[i].y -= Math.sin(angle) * push;
          flowers[j].x += Math.cos(angle) * push;
          flowers[j].y += Math.sin(angle) * push;
          moved = true;
        }
      }
    }
    if (!moved) break;
  }
  for (const f of flowers) {
    f.x = Math.max(margin, Math.min(CANVAS_W - margin, f.x));
    f.y = Math.max(margin, Math.min(CANVAS_H - margin, f.y));
  }
  return flowers;
}

function drawFlower(ctx: CanvasRenderingContext2D, flower: Flower, time: number): void {
  const { x, y, color, pollenColor, size, isPollinated, hasPollen, bloomPhase } = flower;
  const sway = Math.sin(time * 0.002 + bloomPhase) * 3;

  ctx.strokeStyle = '#2d7a1e';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, y + size);
  ctx.quadraticCurveTo(x + sway, y + size + 20, x + sway * 0.5, y + size + 40);
  ctx.stroke();

  ctx.fillStyle = '#3a8a28';
  ctx.beginPath();
  ctx.ellipse(x + sway * 0.3 + 6, y + size + 20, 8, 4, Math.PI / 4, 0, Math.PI * 2);
  ctx.fill();

  const petalCount = flower.type === 'daisy' ? 12 : flower.type === 'sunflower' ? 16 : flower.type === 'tulip' ? 3 : 5;
  ctx.fillStyle = isPollinated ? lightenColor(color, 0.3) : color;
  for (let i = 0; i < petalCount; i++) {
    const angle = (i / petalCount) * Math.PI * 2 + Math.sin(time * 0.001 + bloomPhase) * 0.05;
    const px = x + Math.cos(angle) * size * 0.5 + sway * 0.3;
    const py = y + Math.sin(angle) * size * 0.5;
    ctx.beginPath();
    ctx.ellipse(px, py, size * 0.35, size * 0.2, angle, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = isPollinated ? '#4ade80' : pollenColor;
  ctx.beginPath();
  ctx.arc(x + sway * 0.3, y, size * 0.25, 0, Math.PI * 2);
  ctx.fill();

  if (hasPollen && !isPollinated) {
    for (let i = 0; i < 3; i++) {
      const angle = (i / 3) * Math.PI * 2 + time * 0.003;
      const pr = size * 0.15;
      ctx.fillStyle = pollenColor;
      ctx.beginPath();
      ctx.arc(
        x + sway * 0.3 + Math.cos(angle) * pr,
        y + Math.sin(angle) * pr,
        2, 0, Math.PI * 2
      );
      ctx.fill();
    }
  }

  if (isPollinated) {
    const sparkleAlpha = 0.5 + Math.sin(time * 0.005 + bloomPhase) * 0.3;
    ctx.globalAlpha = sparkleAlpha;
    ctx.fillStyle = '#4ade80';
    ctx.font = `${size * 0.6}px serif`;
    ctx.textAlign = 'center';
    ctx.fillText('✓', x + sway * 0.3, y + size * 0.15);
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
  }
}

function drawBee(ctx: CanvasRenderingContext2D, bee: Bee, time: number): void {
  const { x, y, carryingPollen, wingPhase } = bee;

  const wingFlap = Math.sin(wingPhase * 2) * 0.4;
  ctx.fillStyle = 'rgba(200,220,255,0.5)';
  ctx.beginPath();
  ctx.ellipse(x - 4, y - 8 + wingFlap * 5, 8, 5, -0.3 + wingFlap, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(x + 4, y - 8 + wingFlap * 5, 8, 5, 0.3 - wingFlap, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#fbbf24';
  ctx.beginPath();
  ctx.ellipse(x, y, 10, 7, 0, 0, Math.PI * 2);
  ctx.fill();

  // Stripes
  ctx.fillStyle = '#1a1a1a';
  for (let i = -1; i <= 1; i++) {
    ctx.fillRect(x + i * 5 - 1, y - 6, 2, 12);
  }

  // Head
  ctx.fillStyle = '#1a1a1a';
  ctx.beginPath();
  ctx.arc(x + 9, y, 4, 0, Math.PI * 2);
  ctx.fill();

  // Eyes
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(x + 10.5, y - 1.5, 1.5, 0, Math.PI * 2);
  ctx.fill();

  // Antennae
  ctx.strokeStyle = '#1a1a1a';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x + 10, y - 4);
  ctx.lineTo(x + 14, y - 10);
  ctx.moveTo(x + 8, y - 4);
  ctx.lineTo(x + 12, y - 12);
  ctx.stroke();

  // Pollen indicator
  if (carryingPollen) {
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.arc(x - 6, y + 2, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fde68a';
    ctx.beginPath();
    ctx.arc(x - 6, y + 2, 2, 0, Math.PI * 2);
    ctx.fill();

    // Glow
    ctx.globalAlpha = 0.3 + Math.sin(time * 0.008) * 0.15;
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.arc(x, y, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

export default function SimComponent() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const [flowers, setFlowers] = useState<Flower[]>([]);
  const [bees, setBees] = useState<Bee[]>([]);
  const [particles, setParticles] = useState<PollenParticle[]>([]);
  const [score, setScore] = useState(0);
  const [_totalPollinated, setTotalPollinated] = useState(0);
  const [mode, setMode] = useState<'idle' | 'playing' | 'won'>('idle');
  const [beeCount, setBeeCount] = useState(3);
  const [flowerCount, setFlowerCount] = useState(12);
  const [speed, setSpeed] = useState(1);
  const [pollinatedByType, setPollinatedByType] = useState<PollinatedCount>({});
  const [showInfo, setShowInfo] = useState(false);
  const [dragBee, setDragBee] = useState<number | null>(null);

  const flowersRef = useRef(flowers);
  const beesRef = useRef(bees);
  const particlesRef = useRef(particles);
  const scoreRef = useRef(score);
  const modeRef = useRef(mode);
  const speedRef = useRef(speed);

  useEffect(() => { flowersRef.current = flowers; }, [flowers]);
  useEffect(() => { beesRef.current = bees; }, [bees]);
  useEffect(() => { particlesRef.current = particles; }, [particles]);
  useEffect(() => { scoreRef.current = score; }, [score]);
  useEffect(() => { modeRef.current = mode; }, [mode]);
  useEffect(() => { speedRef.current = speed; }, [speed]);

  const spawnParticles = useCallback((x: number, y: number, color: string, count: number) => {
    const newParticles: PollenParticle[] = [];
    for (let i = 0; i < count; i++) {
      const angle = rand(0, Math.PI * 2);
      const spd = rand(0.5, 2.5);
      newParticles.push({
        id: Date.now() + i + Math.random(),
        x, y,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        life: rand(30, 60),
        maxLife: 60,
        color,
        size: rand(2, 5),
      });
    }
    setParticles(prev => [...prev, ...newParticles]);
  }, []);

  const startGame = useCallback(() => {
    const newFlowers = generateFlowers(flowerCount);
    const newBees: Bee[] = [];
    for (let i = 0; i < beeCount; i++) {
      newBees.push({
        id: i,
        x: rand(100, CANVAS_W - 100),
        y: rand(50, 150),
        targetX: rand(100, CANVAS_W - 100),
        targetY: rand(100, CANVAS_H - 100),
        carryingPollen: false,
        pollenSource: null,
        speed: rand(1.2, 2.2),
        wingPhase: 0,
      });
    }
    setFlowers(newFlowers);
    setBees(newBees);
    setParticles([]);
    setScore(0);
    setTotalPollinated(0);
    setPollinatedByType({});
    setMode('playing');
    setDragBee(null);
  }, [flowerCount, beeCount]);

  // Main game loop
  useEffect(() => {
    if (mode !== 'playing') return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let lastTime = performance.now();

    const loop = (time: number) => {
      const dt = Math.min((time - lastTime) / 16.67, 3) * speedRef.current;
      lastTime = time;

      const currentBees = beesRef.current;
      const currentFlowers = flowersRef.current;
      const currentParticles = particlesRef.current;

      const newBees = currentBees.map(bee => {
        if (dragBee === bee.id) return { ...bee, wingPhase: bee.wingPhase + 0.3 * dt };

        const b = { ...bee };
        b.wingPhase += 0.3 * dt;

        const dx = b.targetX - b.x;
        const dy = b.targetY - b.y;
        const d = Math.sqrt(dx * dx + dy * dy);

        if (d < 5) {
          const nearbyFlowers = currentFlowers.filter(f => {
            const fd = dist(f.x, f.y, b.x, b.y);
            return fd < 300;
          });

          if (nearbyFlowers.length > 0 && Math.random() > 0.3) {
            let target: Flower;
            if (b.carryingPollen) {
              const compatible = nearbyFlowers.filter(f => f.type !== b.pollenSource && !f.isPollinated);
              target = compatible.length > 0
                ? compatible[Math.floor(Math.random() * compatible.length)]
                : nearbyFlowers[Math.floor(Math.random() * nearbyFlowers.length)];
            } else {
              const withPollen = nearbyFlowers.filter(f => f.hasPollen);
              target = withPollen.length > 0
                ? withPollen[Math.floor(Math.random() * withPollen.length)]
                : nearbyFlowers[Math.floor(Math.random() * nearbyFlowers.length)];
            }
            b.targetX = target.x + rand(-10, 10);
            b.targetY = target.y + rand(-10, 10);
          } else {
            b.targetX = rand(50, CANVAS_W - 50);
            b.targetY = rand(50, CANVAS_H - 50);
          }
        } else {
          const moveSpeed = b.speed * dt;
          b.x += (dx / d) * moveSpeed;
          b.y += (dy / d) * moveSpeed;
          b.x += Math.sin(time * 0.005 + b.id * 10) * 0.5 * dt;
          b.y += Math.cos(time * 0.007 + b.id * 10) * 0.3 * dt;
        }

        b.x = Math.max(10, Math.min(CANVAS_W - 10, b.x));
        b.y = Math.max(10, Math.min(CANVAS_H - 10, b.y));

        return b;
      });

      const newFlowers = currentFlowers.map(f => ({ ...f }));
      let newScore = scoreRef.current;
      const newPollinatedByType: PollinatedCount = {};

      for (const bee of newBees) {
        for (const flower of newFlowers) {
          const d = dist(bee.x, bee.y, flower.x, flower.y);
          if (d < flower.size + 8) {
            if (!bee.carryingPollen && flower.hasPollen) {
              bee.carryingPollen = true;
              bee.pollenSource = flower.type;
              flower.hasPollen = false;
              spawnParticles(flower.x, flower.y, flower.pollenColor, 8);
            } else if (bee.carryingPollen && bee.pollenSource !== flower.type && !flower.isPollinated) {
              flower.isPollinated = true;
              bee.carryingPollen = false;
              bee.pollenSource = null;
              newScore += 10;
              spawnParticles(flower.x, flower.y, '#4ade80', 15);
              spawnParticles(flower.x, flower.y, flower.pollenColor, 10);
            }
          }
        }
      }

      let totalPoll = 0;
      for (const f of newFlowers) {
        if (f.isPollinated) {
          totalPoll++;
          newPollinatedByType[f.type] = (newPollinatedByType[f.type] || 0) + 1;
        }
      }

      if (newScore !== scoreRef.current) setScore(newScore);
      if (totalPoll !== currentFlowers.filter(f => f.isPollinated).length) {
        setTotalPollinated(totalPoll);
        setPollinatedByType(newPollinatedByType);
      }
      if (totalPoll >= currentFlowers.length && modeRef.current === 'playing') {
        setMode('won');
      }

      const updatedParticles = currentParticles
        .map(p => ({
          ...p,
          x: p.x + p.vx * dt,
          y: p.y + p.vy * dt,
          vy: p.vy + 0.02 * dt,
          life: p.life - dt,
        }))
        .filter(p => p.life > 0);

      setBees(newBees);
      setFlowers(newFlowers);
      setParticles(updatedParticles);

      // === DRAW ===
      ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

      const skyGrad = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
      skyGrad.addColorStop(0, '#1a3a5c');
      skyGrad.addColorStop(0.6, '#2a5a3a');
      skyGrad.addColorStop(1, '#1a3a2a');
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

      const groundGrad = ctx.createLinearGradient(0, CANVAS_H - 80, 0, CANVAS_H);
      groundGrad.addColorStop(0, '#2d5a1e');
      groundGrad.addColorStop(1, '#1a3a12');
      ctx.fillStyle = groundGrad;
      ctx.fillRect(0, CANVAS_H - 80, CANVAS_W, 80);

      ctx.strokeStyle = '#3a7a28';
      ctx.lineWidth = 1;
      for (let i = 0; i < CANVAS_W; i += 8) {
        const h = rand(10, 30);
        const sw = Math.sin(time * 0.002 + i * 0.1) * 3;
        ctx.beginPath();
        ctx.moveTo(i, CANVAS_H - 80);
        ctx.quadraticCurveTo(i + sw, CANVAS_H - 80 - h / 2, i + sw * 1.5, CANVAS_H - 80 - h);
        ctx.stroke();
      }

      for (const flower of newFlowers) {
        drawFlower(ctx, flower, time);
      }

      for (const p of updatedParticles) {
        const alpha = p.life / p.maxLife;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      for (const bee of newBees) {
        drawBee(ctx, bee, time);
      }

      // HUD
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(10, 10, 220, 36);
      ctx.strokeStyle = 'rgba(0,200,255,0.3)';
      ctx.strokeRect(10, 10, 220, 36);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 14px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`🌸 Pollinated: ${totalPoll}/${newFlowers.length}`, 20, 33);

      const progress = newFlowers.length > 0 ? totalPoll / newFlowers.length : 0;
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(CANVAS_W - 210, 10, 200, 20);
      ctx.fillStyle = 'rgba(74,222,128,0.3)';
      ctx.fillRect(CANVAS_W - 210, 10, 200 * progress, 20);
      ctx.strokeStyle = 'rgba(74,222,128,0.5)';
      ctx.strokeRect(CANVAS_W - 210, 10, 200, 20);
      ctx.fillStyle = '#4ade80';
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${Math.round(progress * 100)}%`, CANVAS_W - 110, 24);
      ctx.textAlign = 'left';

      animRef.current = requestAnimationFrame(loop);
    };

    animRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animRef.current);
  }, [mode, dragBee, spawnParticles]);

  // Idle / Won screen
  useEffect(() => {
    if (mode !== 'idle' && mode !== 'won') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const drawStatic = (time: number) => {
      ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

      const skyGrad = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
      skyGrad.addColorStop(0, '#1a3a5c');
      skyGrad.addColorStop(0.6, '#2a5a3a');
      skyGrad.addColorStop(1, '#1a3a2a');
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

      const groundGrad = ctx.createLinearGradient(0, CANVAS_H - 80, 0, CANVAS_H);
      groundGrad.addColorStop(0, '#2d5a1e');
      groundGrad.addColorStop(1, '#1a3a12');
      ctx.fillStyle = groundGrad;
      ctx.fillRect(0, CANVAS_H - 80, CANVAS_W, 80);

      for (let i = 0; i < 15; i++) {
        const f: Flower = {
          id: i,
          x: 50 + (i * 53) % CANVAS_W,
          y: CANVAS_H - 90 + Math.sin(i * 2) * 30,
          type: FLOWER_TYPES[i % 5].type,
          color: FLOWER_TYPES[i % 5].color,
          pollenColor: FLOWER_TYPES[i % 5].pollenColor,
          hasPollen: true,
          isPollinated: false,
          size: 15 + (i % 3) * 5,
          bloomPhase: i,
        };
        drawFlower(ctx, f, time);
      }

      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(CANVAS_W / 2 - 180, CANVAS_H / 2 - 60, 360, 120);
      ctx.strokeStyle = 'rgba(0,200,255,0.4)';
      ctx.lineWidth = 2;
      ctx.strokeRect(CANVAS_W / 2 - 180, CANVAS_H / 2 - 60, 360, 120);

      ctx.fillStyle = '#fbbf24';
      ctx.font = 'bold 28px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('🐝 POLLINATION', CANVAS_W / 2, CANVAS_H / 2 - 15);

      if (mode === 'won') {
        ctx.fillStyle = '#4ade80';
        ctx.font = 'bold 18px monospace';
        ctx.fillText('🎉 ALL FLOWERS POLLINATED!', CANVAS_W / 2, CANVAS_H / 2 + 15);
        ctx.fillStyle = '#fff';
        ctx.font = '14px monospace';
        ctx.fillText(`Score: ${score}`, CANVAS_W / 2, CANVAS_H / 2 + 40);
      } else {
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.font = '14px monospace';
        ctx.fillText('Configure & press START to begin!', CANVAS_W / 2, CANVAS_H / 2 + 20);
      }
      ctx.textAlign = 'left';

      animRef.current = requestAnimationFrame(drawStatic);
    };

    animRef.current = requestAnimationFrame(drawStatic);
    return () => cancelAnimationFrame(animRef.current);
  }, [mode, score]);

  // Mouse handlers for dragging bees
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (mode !== 'playing') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = CANVAS_W / rect.width;
    const scaleY = CANVAS_H / rect.height;
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleY;

    for (const bee of beesRef.current) {
      if (dist(mx, my, bee.x, bee.y) < 20) {
        setDragBee(bee.id);
        return;
      }
    }
  }, [mode]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (dragBee === null || mode !== 'playing') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = CANVAS_W / rect.width;
    const scaleY = CANVAS_H / rect.height;
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleY;

    setBees(prev => prev.map(b =>
      b.id === dragBee
        ? { ...b, x: mx, y: my, targetX: mx + rand(-50, 50), targetY: my + rand(-50, 50) }
        : b
    ));
  }, [dragBee, mode]);

  const handleMouseUp = useCallback(() => {
    setDragBee(null);
  }, []);

  return (
    <div className="sim-container" style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      padding: '20px',
      gap: '14px',
      overflow: 'auto',
      color: 'var(--ares-offwhite)',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', flexWrap: 'wrap' }}>
        <span className="sim-title" style={{ margin: 0, fontSize: '22px' }}>🐝 POLLINATION GAME</span>
        <span style={{ fontSize: '12px', color: 'var(--ares-muted)', fontFamily: 'monospace' }}>
          {mode === 'idle' ? 'SETUP' : mode === 'playing' ? 'PLAYING' : 'COMPLETE!'}
        </span>
        {mode === 'playing' && (
          <span style={{ fontSize: '12px', color: '#fbbf24', fontFamily: 'monospace' }}>
            Score: {score}
          </span>
        )}
      </div>

      {/* Info */}
      {showInfo && (
        <div style={{
          background: 'rgba(0,200,255,0.05)',
          border: '1px solid rgba(0,200,255,0.15)',
          borderRadius: '8px',
          padding: '12px 16px',
          fontSize: '13px',
          lineHeight: '1.6',
          color: 'rgba(255,255,255,0.7)',
        }}>
          <strong style={{ color: '#fbbf24' }}>🌻 How Pollination Works:</strong> Bees visit flowers to collect nectar and pollen.
          Pollen grains stick to their fuzzy bodies. When the bee visits <em>another flower of a different type</em>,
          some of that pollen transfers to the new flower&apos;s stigma, cross-pollinating it so it can produce seeds and fruit.
          <br /><br />
          <strong style={{ color: 'var(--ares-cyan)' }}>🎮 How to Play:</strong> Bees automatically fly between flowers.
          They pick up pollen (yellow particles) from flowers, then pollinate different-type flowers they visit next.
          <strong>Drag bees</strong> with your mouse to guide them! Pollinate all flowers to win.
          <button
            onClick={() => setShowInfo(false)}
            style={{
              marginLeft: '8px',
              background: 'transparent',
              border: '1px solid var(--ares-gray-dark)',
              color: 'var(--ares-muted)',
              padding: '2px 8px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '11px',
            }}
          >
            Close
          </button>
        </div>
      )}

      {!showInfo && (
        <button
          onClick={() => setShowInfo(true)}
          style={{
            alignSelf: 'flex-start',
            background: 'transparent',
            border: '1px solid rgba(0,200,255,0.3)',
            color: 'var(--ares-cyan)',
            padding: '4px 12px',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '11px',
            fontFamily: 'monospace',
          }}
        >
          ℹ️ How to Play
        </button>
      )}

      {/* Canvas */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        border: '1px solid var(--ares-gray-dark)',
        borderRadius: '12px',
        overflow: 'hidden',
        background: '#0a1a0a',
      }}>
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          style={{
            width: '100%',
            maxWidth: `${CANVAS_W}px`,
            height: 'auto',
            cursor: dragBee !== null ? 'grabbing' : mode === 'playing' ? 'crosshair' : 'default',
          }}
        />
      </div>

      {/* Stats */}
      {mode === 'playing' && (
        <div style={{
          display: 'flex',
          gap: '16px',
          justifyContent: 'center',
          flexWrap: 'wrap',
          padding: '8px',
          background: 'rgba(0,0,0,0.2)',
          borderRadius: '8px',
          border: '1px solid var(--ares-gray-dark)',
        }}>
          {FLOWER_TYPES.map(ft => (
            <div key={ft.type} style={{ textAlign: 'center', minWidth: '60px' }}>
              <div style={{ fontSize: '9px', fontFamily: 'monospace', color: ft.color, marginBottom: '2px' }}>
                {ft.name.toUpperCase()}
              </div>
              <div style={{ fontSize: '14px', fontFamily: 'monospace', color: '#4ade80' }}>
                {pollinatedByType[ft.type] || 0}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Controls */}
      <div style={{
        display: 'flex',
        gap: '20px',
        justifyContent: 'center',
        alignItems: 'center',
        flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontFamily: 'monospace', fontSize: '11px', color: 'var(--ares-muted)' }}>🐝 Bees:</span>
          <input
            type="range"
            min={1}
            max={8}
            value={beeCount}
            onChange={e => setBeeCount(parseInt(e.target.value, 10))}
            disabled={mode === 'playing'}
            aria-label="Number of bees in simulation"
            style={{ width: '80px' }}
          />
          <span style={{ fontFamily: 'monospace', fontSize: '13px', fontWeight: 'bold', color: 'var(--ares-cyan)' }}>{beeCount}</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontFamily: 'monospace', fontSize: '11px', color: 'var(--ares-muted)' }}>🌸 Flowers:</span>
          <input
            type="range"
            min={6}
            max={30}
            value={flowerCount}
            onChange={e => setFlowerCount(parseInt(e.target.value, 10))}
            disabled={mode === 'playing'}
            aria-label="Number of flowers in simulation"
            style={{ width: '80px' }}
          />
          <span style={{ fontFamily: 'monospace', fontSize: '13px', fontWeight: 'bold', color: 'var(--ares-cyan)' }}>{flowerCount}</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontFamily: 'monospace', fontSize: '11px', color: 'var(--ares-muted)' }}>⚡ Speed:</span>
          <input
            type="range"
            min={0.5}
            max={3}
            step={0.25}
            value={speed}
            onChange={e => setSpeed(parseFloat(e.target.value))}
            aria-label="Simulation speed multiplier"
            style={{ width: '80px' }}
          />
          <span style={{ fontFamily: 'monospace', fontSize: '13px', fontWeight: 'bold', color: 'var(--ares-cyan)' }}>{speed}x</span>
        </div>

        <button
          onClick={mode === 'playing' ? () => { setMode('idle'); cancelAnimationFrame(animRef.current); } : startGame}
          style={{
            padding: '10px 24px',
            fontFamily: 'monospace',
            fontSize: '13px',
            fontWeight: 'bold',
            background: mode === 'playing'
              ? 'rgba(239,68,68,0.15)'
              : 'rgba(74,222,128,0.15)',
            border: `1px solid ${mode === 'playing' ? '#ef4444' : '#4ade80'}`,
            color: mode === 'playing' ? '#ef4444' : '#4ade80',
            borderRadius: '6px',
            cursor: 'pointer',
          }}
        >
          {mode === 'playing' ? '⏹ STOP' : mode === 'won' ? '🔄 RESTART' : '▶ START'}
        </button>
      </div>
    </div>
  );
}