import { useState } from "react";
import { ChevronRight, ChevronDown, Plus, Code2, Cpu, Wrench } from "lucide-react";

export interface ComponentLibraryItem {
  id: string;
  name: string;
  description: string;
  icon: "physics" | "controller" | "mechanism";
  codeSnippet: string;
}

const COMPONENT_LIBRARY: Record<string, ComponentLibraryItem[]> = {
  "Physics (Matter.js)": [
    {
      id: "matter-world",
      name: "Matter.js World",
      description: "Initialize a basic 2D physics world with gravity.",
      icon: "physics",
      codeSnippet: `import Matter from "matter-js";

// Initialize physics engine
const engine = Matter.Engine.create();
engine.gravity.y = 1; // Standard gravity

// Create renderer
const render = Matter.Render.create({
  element: document.body,
  engine: engine,
  options: {
    width: 800,
    height: 600,
    wireframes: false,
    background: '#0f172a'
  }
});

Matter.Render.run(render);
Matter.Runner.run(Matter.Runner.create(), engine);
`
    },
    {
      id: "matter-box",
      name: "Rigid Body (Box)",
      description: "Create a standard rectangular rigid body.",
      icon: "physics",
      codeSnippet: `const box = Matter.Bodies.rectangle(400, 200, 80, 80, { 
  restitution: 0.8, // Bounciness
  friction: 0.05
});
Matter.Composite.add(engine.world, [box]);
`
    }
  ],
  "Controllers": [
    {
      id: "pid-controller",
      name: "PID Controller",
      description: "A standard Proportional-Integral-Derivative controller.",
      icon: "controller",
      codeSnippet: `class PIDController {
  constructor(public kP: number, public kI: number, public kD: number) {
    this.integral = 0;
    this.prevError = 0;
  }
  
  private integral: number;
  private prevError: number;

  calculate(setpoint: number, measurement: number, dt: number): number {
    const error = setpoint - measurement;
    this.integral += error * dt;
    const derivative = (error - this.prevError) / dt;
    this.prevError = error;
    
    return (this.kP * error) + (this.kI * this.integral) + (this.kD * derivative);
  }
}

// Usage:
// const pid = new PIDController(0.1, 0.0, 0.01);
// const output = pid.calculate(100, currentPosition, 0.016);
`
    },
    {
      id: "feedforward-elevator",
      name: "Elevator Feedforward",
      description: "Feedforward model for an elevator mechanism.",
      icon: "controller",
      codeSnippet: `class ElevatorFeedforward {
  constructor(public kS: number, public kG: number, public kV: number, public kA: number) {}

  calculate(velocity: number, acceleration: number): number {
    return this.kS * Math.sign(velocity) + 
           this.kG + 
           this.kV * velocity + 
           this.kA * acceleration;
  }
}
`
    }
  ],
  "Mechanisms": [
    {
      id: "mech-elevator",
      name: "1D Elevator Sim",
      description: "Simulate a 1D elevator with gravity and applied voltage.",
      icon: "mechanism",
      codeSnippet: `class ElevatorSim {
  public position = 0;
  public velocity = 0;
  
  // Constants
  private readonly mass = 5.0; // kg
  private readonly gravity = 9.81;
  private readonly kV = 0.5; // Back-EMF constant
  
  update(voltage: number, dt: number) {
    // F = ma -> a = F/m
    // Force = (Voltage - kV * velocity) - gravity * mass
    const force = Math.max(-12, Math.min(12, voltage)) - (this.kV * this.velocity) - (this.gravity * this.mass);
    const acceleration = force / this.mass;
    
    this.velocity += acceleration * dt;
    this.position += this.velocity * dt;
    
    // Floor limit
    if (this.position < 0) {
      this.position = 0;
      this.velocity = 0;
    }
  }
}
`
    }
  ]
};

interface SimComponentLibraryProps {
  onInsertCode: (code: string) => void;
}

export function SimComponentLibrary({ onInsertCode }: SimComponentLibraryProps) {
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>(
    Object.keys(COMPONENT_LIBRARY).reduce((acc, cat) => ({ ...acc, [cat]: true }), {})
  );

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => ({ ...prev, [category]: !prev[category] }));
  };

  const renderIcon = (type: string) => {
    switch (type) {
      case "physics": return <Code2 className="w-3.5 h-3.5 text-blue-400" />;
      case "controller": return <Cpu className="w-3.5 h-3.5 text-emerald-400" />;
      case "mechanism": return <Wrench className="w-3.5 h-3.5 text-ares-gold" />;
      default: return <Code2 className="w-3.5 h-3.5 text-white/50" />;
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#161b22] overflow-y-auto">
      <div className="p-3 border-b border-white/10 flex items-center justify-between sticky top-0 bg-[#161b22] z-10">
        <span className="text-xs font-bold text-white/80 uppercase tracking-wider">Component Library</span>
      </div>

      <div className="p-2 space-y-4">
        {Object.entries(COMPONENT_LIBRARY).map(([category, items]) => (
          <div key={category} className="space-y-1">
            <button
              onClick={() => toggleCategory(category)}
              className="flex items-center gap-1.5 w-full text-left px-2 py-1.5 hover:bg-white/5 rounded-md transition-colors"
            >
              {expandedCategories[category] ? (
                <ChevronDown className="w-3.5 h-3.5 text-white/50" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-white/50" />
              )}
              <span className="text-xs font-semibold text-white/70">{category}</span>
            </button>
            
            {expandedCategories[category] && (
              <div className="pl-3 pr-1 space-y-1 mt-1">
                {items.map(item => (
                  <button 
                    key={item.id} 
                    type="button"
                    className="group bg-black/20 border border-white/5 hover:border-white/20 rounded-md p-2 transition-all cursor-pointer text-left w-full"
                    onClick={() => onInsertCode(item.codeSnippet)}
                    title="Click to insert at cursor"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        {renderIcon(item.icon)}
                        <span className="text-xs text-white/90 font-medium">{item.name}</span>
                      </div>
                      <span 
                        className="opacity-0 group-hover:opacity-100 transition-opacity bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/40 p-1 rounded"
                      >
                        <Plus className="w-3 h-3" />
                      </span>
                    </div>
                    <p className="text-[10px] text-white/40 leading-snug">
                      {item.description}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
      
      <div className="mt-auto p-4 text-center border-t border-white/10">
        <p className="text-[10px] text-white/30">
          Click any component to insert it at your cursor position in the active editor.
        </p>
      </div>
    </div>
  );
}
