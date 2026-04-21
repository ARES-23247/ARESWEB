import { useState } from "react";
import { motion } from "framer-motion";
import { Settings, Save, AlertCircle, RefreshCw } from "lucide-react";

export default function ConfigVisualizer() {
  const [activeTab, setActiveTab] = useState("constants");
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="my-6 border border-white/10 ares-cut-sm overflow-hidden bg-ares-zinc-deep shadow-xl">
      <div className="bg-ares-zinc-dark px-4 py-3 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Settings size={18} className="text-ares-gold" />
          <span className="font-mono text-sm font-bold text-white">ARESLib Tuner (Live)</span>
        </div>
        <button onClick={handleSave} className="flex items-center gap-2 text-xs font-bold px-3 py-1 bg-ares-red/20 hover:bg-ares-red/40 text-white rounded transition-colors">
          {saved ? <RefreshCw size={14} className="animate-spin text-ares-gold" /> : <Save size={14} />}
          {saved ? "SYNCING..." : "DEPLOY"}
        </button>
      </div>

      <div className="flex flex-col sm:flex-row">
        {/* Sidebar */}
        <div className="w-full sm:w-48 border-b sm:border-b-0 sm:border-r border-white/10 bg-ares-zinc-deep/50 p-2 flex flex-col gap-1">
          {["constants", "pid_gains", "kinematics", "vision"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`text-left px-3 py-2 rounded text-sm font-mono transition-colors ${activeTab === tab ? "bg-white/10 text-white font-bold" : "text-white/50 hover:text-white/80 hover:bg-white/5"}`}
            >
              {tab}.yaml
            </button>
          ))}
        </div>

        {/* Content Panel */}
        <div className="p-4 flex-1 font-mono text-sm overflow-x-auto min-h-[160px]">
          {activeTab === "constants" && (
            <motion.div initial={{opacity:0}} animate={{opacity:1}}>
              <div className="text-ares-red">drive:</div>
              <div className="pl-4">
                <div className="mb-2"><span className="text-ares-cyan">max_velocity:</span> <span className="text-ares-gold block sm:inline bg-white/5 px-2 py-0.5 rounded border border-white/10" contentEditable suppressContentEditableWarning>4.5</span> <span className="text-white/40 italic"># m/s</span></div>
                <div className="mb-2"><span className="text-ares-cyan">max_acceleration:</span> <span className="text-ares-gold block sm:inline bg-white/5 px-2 py-0.5 rounded border border-white/10" contentEditable suppressContentEditableWarning>3.0</span> <span className="text-white/40 italic"># m/s²</span></div>
                <div className="mb-2"><span className="text-ares-cyan">track_width:</span> <span className="text-ares-gold block sm:inline bg-white/5 px-2 py-0.5 rounded border border-white/10">0.55</span></div>
              </div>
            </motion.div>
          )}
          {activeTab !== "constants" && (
            <motion.div initial={{opacity:0}} animate={{opacity:1}} className="flex items-center justify-center p-8 text-white/30 italic">
              <AlertCircle size={16} className="mr-2" /> Select a parameter file to edit
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
