import React, { useRef, useEffect } from 'react';

interface TelemetryPoint {
  time: number;
  value: number;
}

interface TelemetryPanelProps {
  data: Record<string, TelemetryPoint[]>;
}

export function TelemetryPanel({ data }: TelemetryPanelProps) {
  const keys = Object.keys(data).sort();

  if (keys.length === 0) {
    return (
      <div className="p-4 border-t border-white/10 bg-obsidian text-white/40 text-xs italic text-center">
        No telemetry data. Use <code className="text-ares-gold">useTelemetry(&apos;key&apos;, value)</code> in your simulation.
      </div>
    );
  }

  return (
    <div className="flex flex-col border-t border-white/10 bg-obsidian min-h-[150px] max-h-[250px] overflow-y-auto">
      <div className="px-3 py-1.5 border-b border-white/10 bg-[#1e1e1e] flex items-center gap-2 sticky top-0 z-10">
        <span className="text-white/40 text-xs font-mono uppercase tracking-widest">Telemetry</span>
      </div>
      <div className="p-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {keys.map(key => (
          <TelemetryGraph key={key} title={key} points={data[key]} />
        ))}
      </div>
    </div>
  );
}

function TelemetryGraph({ title, points }: { title: string, points: TelemetryPoint[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current || points.length === 0) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Support high DPI displays
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;

    ctx.clearRect(0, 0, width, height);

    // Find min and max
    let min = Infinity;
    let max = -Infinity;
    for (const p of points) {
      if (p.value < min) min = p.value;
      if (p.value > max) max = p.value;
    }

    // Add some padding to min/max
    const range = max - min;
    const paddedMin = range === 0 ? min - 1 : min - range * 0.1;
    const paddedMax = range === 0 ? max + 1 : max + range * 0.1;
    const paddedRange = paddedMax - paddedMin;

    // Draw baseline if 0 is in range
    if (paddedMin < 0 && paddedMax > 0) {
      const zeroY = height - ((0 - paddedMin) / paddedRange) * height;
      ctx.strokeStyle = 'rgba(255,255,255,0.1)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, zeroY);
      ctx.lineTo(width, zeroY);
      ctx.stroke();
    }

    // Draw path
    ctx.strokeStyle = '#d4a030'; // ares-gold
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.beginPath();

    const tMin = points[0].time;
    const tMax = points[points.length - 1].time;
    const tRange = Math.max(tMax - tMin, 1);

    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      const x = ((p.time - tMin) / tRange) * width;
      const y = height - ((p.value - paddedMin) / paddedRange) * height;

      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

  }, [points]);

  const latestValue = points[points.length - 1]?.value || 0;

  return (
    <div className="bg-ares-gray-dark border border-white/5 rounded-md p-2 flex flex-col gap-1">
      <div className="flex justify-between items-center px-1">
        <span className="text-white/60 text-[10px] font-mono">{title}</span>
        <span className="text-white font-mono text-xs">{latestValue.toFixed(3)}</span>
      </div>
      <div className="relative h-12 w-full mt-1">
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" style={{ width: '100%', height: '100%' }} />
      </div>
    </div>
  );
}
