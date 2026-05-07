import React, { useEffect, useRef } from 'react';
import Matter from 'matter-js';

interface MatterEngineProps {
  initialState?: unknown;
  onStateChange: (state: Record<string, unknown>) => void;
}

export const MatterEngine: React.FC<MatterEngineProps> = ({ onStateChange }) => {
  const sceneRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<Matter.Engine | null>(null);
  const renderRef = useRef<Matter.Render | null>(null);

  useEffect(() => {
    if (!sceneRef.current) return;

    // Create engine
    const engine = Matter.Engine.create();
    engineRef.current = engine;

    // Create renderer
    const render = Matter.Render.create({
      element: sceneRef.current,
      engine: engine,
      options: {
        width: 800,
        height: 600,
        wireframes: false,
        background: '#0f172a'
      }
    });
    renderRef.current = render;

    // Add some default bodies based on state or standard demo
    const boxA = Matter.Bodies.rectangle(400, 200, 80, 80);
    const boxB = Matter.Bodies.rectangle(450, 50, 80, 80);
    const ground = Matter.Bodies.rectangle(400, 610, 810, 60, { isStatic: true });

    Matter.Composite.add(engine.world, [boxA, boxB, ground]);

    // Add mouse control
    const mouse = Matter.Mouse.create(render.canvas);
    const mouseConstraint = Matter.MouseConstraint.create(engine, {
      mouse: mouse,
      constraint: {
        stiffness: 0.2,
        render: {
          visible: false
        }
      }
    });
    Matter.Composite.add(engine.world, mouseConstraint);
    
    // Keep the mouse in sync with rendering
    render.mouse = mouse;

    // Run the engine and renderer
    Matter.Runner.run(engine);
    Matter.Render.run(render);

    // Sync state periodically
    const stateInterval = setInterval(() => {
      // In a real implementation we would serialize bodies
      // For now we just demonstrate the callback
      onStateChange({
        timestamp: Date.now(),
        bodyCount: Matter.Composite.allBodies(engine.world).length
      });
    }, 1000);

    return () => {
      clearInterval(stateInterval);
      
      // Cleanup
      Matter.Render.stop(render);
      Matter.Engine.clear(engine);
      if (render.canvas) {
        render.canvas.remove();
      }
      render.canvas = null as unknown as HTMLCanvasElement;
      render.context = null as unknown as CanvasRenderingContext2D;
      render.textures = {};
    };
  }, [onStateChange]);

  return (
    <div className="w-full flex justify-center">
      <div ref={sceneRef} className="rounded-lg overflow-hidden border border-slate-700 shadow-xl" />
    </div>
  );
};
