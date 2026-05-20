import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Cpu, Maximize2, Layers, RotateCw, Sparkles, Anchor, Info, Compass, PenTool, CheckCircle } from "lucide-react";

interface Subsystem {
  id: string;
  name: string;
  role: string;
  motors: string;
  ratio: string;
  weight: string;
  features: string[];
  materials: string[];
  cadUrl: string;
}

const SUBSYSTEMS: Subsystem[] = [
  {
    id: "chassis",
    name: "Drive Chassis",
    role: "Omnidirectional high-speed arena mobility & odometry tracking.",
    motors: "4x Neo Brushless Motors",
    ratio: "13.7:1 Planetary Gearbox",
    weight: "8.4 lbs",
    features: [
      "Mecanum wheel drivetrain for lateral strafing",
      "CNC laser-cut 6061-T6 anodized aluminum structural plates",
      "Three-wheel spring-loaded dead-wheel odometry pods for sub-millimeter positioning",
      "Ultra-low center of gravity battery mounts"
    ],
    materials: [
      "6061-T6 Anodized Aluminum (Laser Cut)",
      "High-density polyethylene (HDPE) standoffs",
      "3D Printed TPU wire routing paths"
    ],
    cadUrl: "https://cad.onshape.com/documents/b78bf2d8ec68bd50280eb4c7/w/2c20a46ce59c1626f8eeec9b/e/7880d8bc3a5de0cbe3efdbdf?renderMode=0&ui_labels=false&ui_tree=false&ui_toolbar=false"
  },
  {
    id: "intake",
    name: "Active Roller Intake",
    role: "High-throughput ground sample acquisition and specimen retrieval.",
    motors: "1x Neo 550 Brushless + 1x Core Hex Motor",
    ratio: "4:1 Belt Drive",
    weight: "2.1 lbs",
    features: [
      "Custom compliance wheels for variable sized sample entry",
      "Dynamic dual-pivot linkage to clear field barriers safely",
      "Integrated analog color sensor for autonomous sorting",
      "Direct torque-limited drive to prevent motor stalls"
    ],
    materials: [
      "3D Printed TPU Compliance Wheels (Shore 85A)",
      "3D Printed PETG main pivot brackets",
      "Carbon Fiber composite side plates"
    ],
    cadUrl: "https://cad.onshape.com/documents/b78bf2d8ec68bd50280eb4c7/w/2c20a46ce59c1626f8eeec9b/e/9880d8bc3a5de0cbe3efdcef?renderMode=0&ui_labels=false&ui_tree=false&ui_toolbar=false"
  },
  {
    id: "outtake",
    name: "Linear Outtake Lift",
    role: "Precise high-level chamber scoring and basket sample scoring.",
    motors: "2x Neo Brushless Motors",
    ratio: "9.8:1 Planetary Gearbox",
    weight: "4.3 lbs",
    features: [
      "Three-stage cascading linear slide system",
      "Active servo-driven wrist with 270-degree rotation",
      "Custom carbon fiber spring-loaded specimen claw",
      "Limit switches and magnetic hall effect home sensors"
    ],
    materials: [
      "Carbon Fiber Composite gripper plates",
      "3D Printed Carbon-PETG guide blocks",
      "Dyneema high-tensile slide cables"
    ],
    cadUrl: "https://cad.onshape.com/documents/b78bf2d8ec68bd50280eb4c7/w/2c20a46ce59c1626f8eeec9b/e/8880d8bc3a5de0cbe3efdbef?renderMode=0&ui_labels=false&ui_tree=false&ui_toolbar=false"
  },
  {
    id: "climber",
    name: "Ascent Rig",
    role: "Endgame high-torque Ascent Level 3 pull-up climbing.",
    motors: "1x Neo Brushless Motor",
    ratio: "45:1 High-Torque Gearbox",
    weight: "3.2 lbs",
    features: [
      "Heavy duty double rack-and-pinion extension rail",
      "Self-locking spring latch hooks for structural hold when powered off",
      "Integrated steel support bracket mounting directly to center chassis plate",
      "Sub-2 second level 3 hang execution time"
    ],
    materials: [
      "Aircraft-grade aluminum structural rails",
      "3D Printed Glass-Fiber Nylon locking latches",
      "Hardened steel drive pinions"
    ],
    cadUrl: "https://cad.onshape.com/documents/b78bf2d8ec68bd50280eb4c7/w/2c20a46ce59c1626f8eeec9b/e/6880d8bc3a5de0cbe3efdaef?renderMode=0&ui_labels=false&ui_tree=false&ui_toolbar=false"
  }
];

export default function CadExplorer() {
  const [selectedSubsystem, setSelectedSubsystem] = useState<Subsystem>(SUBSYSTEMS[0]);
  const [isFullscreen, setIsFullscreen] = useState(false);

  return (
    <div className={`w-full grid grid-cols-1 lg:grid-cols-12 gap-6 bg-obsidian text-marble p-2 relative overflow-hidden transition-all duration-500 ${
      isFullscreen ? "fixed inset-0 z-50 p-6 bg-obsidian" : ""
    }`}>
      {/* CAD View Panel */}
      <div className="lg:col-span-8 flex flex-col bg-black/60 border border-white/5 ares-cut-lg overflow-hidden h-[60vh] lg:h-[70vh] relative group">
        
        {/* Futuristic HUD overlay */}
        <div className="absolute top-4 left-4 z-10 flex flex-col gap-1 pointer-events-none select-none">
          <div className="flex items-center gap-2 text-[10px] font-black uppercase text-white tracking-widest bg-black/80 px-3 py-1.5 ares-cut-sm border border-white/10">
            <Compass className="text-ares-red animate-spin-slow" size={12} />
            Onshape Live Viewer
          </div>
          <span className="text-[9px] font-mono text-marble/40 tracking-wider">RESOLVING ASSEMBLY: ARES_2526_COMPETITION_ROBOT</span>
        </div>

        <div className="absolute top-4 right-4 z-10 flex gap-2">
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-2 bg-black/85 hover:bg-white/10 text-marble hover:text-white border border-white/10 ares-cut-sm transition-all"
            title={isFullscreen ? "Exit Fullscreen" : "Maximize CAD"}
          >
            <Maximize2 size={14} />
          </button>
        </div>

        {/* Embedded Iframe */}
        <div className="flex-1 w-full h-full relative">
          <iframe
            src={selectedSubsystem.cadUrl}
            title={selectedSubsystem.name}
            className="w-full h-full border-none pointer-events-auto bg-black"
            allowFullScreen
          />
          
          {/* Tech Scanlines / Digital Frame border */}
          <div className="absolute inset-0 border border-ares-red/10 pointer-events-none" />
          <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-ares-red" />
          <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-ares-red" />
          <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-ares-red" />
          <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-ares-red" />
        </div>

        {/* Subsystem Telemetry HUD */}
        <div className="bg-black/80 border-t border-white/5 p-4 flex flex-wrap justify-between items-center gap-4 shrink-0 font-mono text-[10px] text-marble/50">
          <div>MODEL STATE: <span className="text-ares-cyan font-bold">READY</span></div>
          <div>RENDER ENGINE: <span className="text-white">WebGL 2.0 (Onshape cloud)</span></div>
          <div>ACTIVE SUBSYSTEM: <span className="text-ares-gold font-bold uppercase">{selectedSubsystem.name}</span></div>
        </div>

      </div>

      {/* Control / Info Sidebar */}
      <div className="lg:col-span-4 flex flex-col gap-6">
        
        {/* Subsystem Selector Buttons */}
        <div className="bg-white/[0.02] border border-white/5 p-4 ares-cut-lg flex flex-col gap-2">
          <div className="flex items-center gap-2 mb-2">
            <Layers className="text-ares-red" size={16} />
            <h3 className="text-xs font-black uppercase tracking-widest text-white">Select Subsystem</h3>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {SUBSYSTEMS.map((sub) => {
              const isSelected = sub.id === selectedSubsystem.id;
              return (
                <button
                  key={sub.id}
                  onClick={() => setSelectedSubsystem(sub)}
                  className={`p-3 text-[10px] font-black uppercase tracking-widest text-left transition-all ares-cut-sm border flex flex-col gap-1 ${
                    isSelected
                      ? "bg-ares-red/10 border-ares-red/40 text-white"
                      : "bg-black/40 border-white/5 text-marble/50 hover:text-white hover:border-white/10"
                  }`}
                >
                  <span className={isSelected ? "text-ares-gold" : "text-marble/30 font-mono"}>
                    {sub.id.toUpperCase()}
                  </span>
                  <span>{sub.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Dynamic Detail Card */}
        <div className="flex-1 bg-white/[0.02] border border-white/5 p-6 ares-cut-lg flex flex-col gap-4 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-ares-gold/5 blur-[50px] rounded-full pointer-events-none -translate-y-1/2 translate-x-1/4" />
          
          <AnimatePresence mode="wait">
            <motion.div
              key={selectedSubsystem.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col gap-4"
            >
              <div>
                <div className="inline-flex items-center gap-1 bg-ares-gold/10 border border-ares-gold/20 px-2 py-0.5 ares-cut-sm text-[9px] font-black uppercase text-ares-gold tracking-widest mb-2">
                  <Sparkles size={10} /> Active Component
                </div>
                <h2 className="text-lg font-black uppercase tracking-tight text-white">{selectedSubsystem.name}</h2>
                <p className="text-xs text-marble/60 mt-1 leading-relaxed">{selectedSubsystem.role}</p>
              </div>

              {/* Specs Grid */}
              <div className="grid grid-cols-2 gap-4 border-y border-white/5 py-4 font-mono text-[10px]">
                <div>
                  <div className="text-marble/30 font-bold uppercase tracking-wider mb-1 flex items-center gap-1">
                    <Cpu size={10} /> Actuation Motors
                  </div>
                  <div className="text-white font-bold">{selectedSubsystem.motors}</div>
                </div>
                <div>
                  <div className="text-marble/30 font-bold uppercase tracking-wider mb-1 flex items-center gap-1">
                    <RotateCw size={10} /> Gear Ratio
                  </div>
                  <div className="text-white font-bold">{selectedSubsystem.ratio}</div>
                </div>
                <div>
                  <div className="text-marble/30 font-bold uppercase tracking-wider mb-1 flex items-center gap-1">
                    <Anchor size={10} /> Component Weight
                  </div>
                  <div className="text-white font-bold">{selectedSubsystem.weight}</div>
                </div>
                <div>
                  <div className="text-marble/30 font-bold uppercase tracking-wider mb-1 flex items-center gap-1">
                    <PenTool size={10} /> Custom Lib
                  </div>
                  <div className="text-ares-cyan font-bold">ARESLib v2.1</div>
                </div>
              </div>

              {/* Design Features */}
              <div>
                <h4 className="text-[10px] font-black uppercase tracking-widest text-marble/40 mb-3 flex items-center gap-1">
                  <Info size={12} className="text-ares-red" /> Mechanical Innovations
                </h4>
                <ul className="space-y-2">
                  {selectedSubsystem.features.map((feat, i) => (
                    <li key={i} className="text-xs text-marble/70 pl-4 relative">
                      <span className="absolute left-0 top-1.5 w-1.5 h-1.5 ares-cut bg-ares-red/80" />
                      {feat}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Materials */}
              <div>
                <h4 className="text-[10px] font-black uppercase tracking-widest text-marble/40 mb-3 flex items-center gap-1">
                  <Layers size={12} className="text-ares-cyan" /> Materials & Manufacturing
                </h4>
                <div className="flex flex-wrap gap-2">
                  {selectedSubsystem.materials.map((mat, i) => (
                    <span key={i} className="text-[9px] font-bold uppercase bg-white/5 border border-white/10 px-2 py-1 ares-cut-sm text-marble/60 flex items-center gap-1">
                      <CheckCircle size={10} className="text-ares-cyan" />
                      {mat}
                    </span>
                  ))}
                </div>
              </div>

            </motion.div>
          </AnimatePresence>

        </div>

      </div>
    </div>
  );
}
