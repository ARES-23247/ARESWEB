import { useState } from "react";
import { X, TerminalSquare, Search } from "lucide-react";
import registry from "../sims/simRegistry.json";

export default function SimPickerModal({
  isOpen,
  onClose,
  onSelect,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (simId: string) => void;
}) {
  const [searchQuery, setSearchQuery] = useState("");

  if (!isOpen) return null;

  const sims = registry.simulators.filter(sim => 
    sim.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    sim.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
      <div className="bg-zinc-950 border border-zinc-800 shadow-2xl rounded-3xl w-full max-w-4xl h-[70vh] flex flex-col overflow-hidden relative">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-zinc-800 bg-black/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-ares-red/20 flex items-center justify-center rounded-xl border border-ares-red/30">
              <TerminalSquare className="text-ares-red" size={20} aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white tracking-widest uppercase">Inject Simulator</h2>
              <p className="text-xs text-zinc-400 font-mono">Insert interactive React simulators directly into the page hierarchy.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="w-10 h-10 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="px-6 py-4 bg-zinc-900 border-b border-zinc-800 flex items-center gap-3 shadow-inner">
           <Search size={18} className="text-zinc-500" aria-hidden="true" />
           <label htmlFor="simSearch" className="sr-only">Search active simulators</label>
           <input
             id="simSearch"
             type="text"
             placeholder="Search active simulators (e.g., SwerveSim, PowerShedding, PhysicsCanvas)"
             value={searchQuery}
             onChange={e => setSearchQuery(e.target.value)}
             className="w-full bg-transparent border-none text-zinc-100 placeholder-zinc-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan font-mono text-sm"
           />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-zinc-950">
          {sims.length === 0 ? (
            <div className="w-full h-full flex flex-col items-center justify-center text-zinc-500 gap-4">
              <TerminalSquare size={48} className="opacity-50" aria-hidden="true" />
              <p className="font-mono text-sm">No simulator matched the query &ldquo;{searchQuery}&rdquo;.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {sims.map(sim => (
                  <button
                    key={sim.id}
                    onClick={() => onSelect(sim.id)}
                    aria-label={`Inject ${sim.name} simulator`}
                    className="group relative bg-zinc-900 border border-zinc-800 rounded-xl p-5 hover:border-ares-red transition-all flex flex-col text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan shadow-lg"
                  >
                    <div className="flex items-center gap-2 mb-3">
                       <TerminalSquare size={16} className="text-ares-red" aria-hidden="true" />
                     <p className="text-white text-sm font-black tracking-wider uppercase">{sim.name}</p>
                  </div>
                  <div className="mt-auto pt-3 border-t border-zinc-800/80 w-full flex justify-between items-center">
                    <p className="text-zinc-400 text-[10px] font-mono">&lt;{sim.id} /&gt;</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
        
      </div>
    </div>
  );
}
