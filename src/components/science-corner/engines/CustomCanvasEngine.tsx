import React, { useEffect, useRef } from 'react';

interface CustomCanvasEngineProps {
  initialState?: { x?: number; y?: number; [key: string]: unknown } | null;
  onStateChange: (state: { x: number; y: number; [key: string]: unknown }) => void;
}

export const CustomCanvasEngine: React.FC<CustomCanvasEngineProps> = ({ initialState, onStateChange }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // A simple animation loop example (e.g. a bouncing ball or math plotter)
    let animationId: number;
    let x = initialState?.x || 50;
    let y = initialState?.y || 50;
    let dx = 2;
    let dy = 2;

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Draw background
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw ball
      ctx.beginPath();
      ctx.arc(x, y, 20, 0, Math.PI * 2);
      ctx.fillStyle = '#38bdf8';
      ctx.fill();
      ctx.closePath();

      // Bounce logic
      if (x + 20 > canvas.width || x - 20 < 0) dx = -dx;
      if (y + 20 > canvas.height || y - 20 < 0) dy = -dy;

      x += dx;
      y += dy;

      animationId = requestAnimationFrame(draw);
    };

    draw();

    // Sync state periodically
    const stateInterval = setInterval(() => {
      onStateChange({ x, y });
    }, 1000);

    return () => {
      cancelAnimationFrame(animationId);
      clearInterval(stateInterval);
    };
  }, [initialState, onStateChange]);

  return (
    <div className="w-full flex justify-center">
      <canvas 
        ref={canvasRef} 
        width={800} 
        height={600} 
        className="rounded-lg overflow-hidden border border-slate-700 shadow-xl"
      />
    </div>
  );
};
