import { useState } from "react";
import { X, TerminalSquare, Search } from "lucide-react";
import * as Dialog from "@radix-ui/react-dialog";
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

  const sims = registry.simulators.filter(sim => 
    sim.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    sim.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[9999] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content 
          aria-describedby={undefined}
          className="fixed left-[50%] top-[50%] z-[10000] translate-x-[-50%] translate-y-[-50%] bg-obsidian border border-white/10 shadow-2xl ares-cut-lg w-[calc(100%-2rem)] max-w-4xl h-[70vh] flex flex-col overflow-hidden data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] focus:outline-none"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-white/10 bg-black/40">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-ares-red/20 flex items-center justify-center ares-cut-sm border border-ares-red/30">
                <TerminalSquare className="text-ares-red" size={20} aria-hidden="true" />
              </div>
              <div>
                <Dialog.Title className="text-xl font-black text-white tracking-widest uppercase m-0">Inject Simulator</Dialog.Title>
                <Dialog.Description className="text-xs text-white/60 font-mono m-0">Insert interactive React simulators directly into the page hierarchy.</Dialog.Description>
              </div>
            </div>
            <Dialog.Close asChild>
              <button
                aria-label="Close modal"
                className="w-10 h-10 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
              >
                <X size={20} aria-hidden="true" />
              </button>
            </Dialog.Close>
          </div>

          {/* Search Bar */}
          <div className="px-6 py-4 bg-white/5 border-b border-white/10 flex items-center gap-3 shadow-inner">
             <Search size={18} className="text-white/60" aria-hidden="true" />
             <label htmlFor="simSearch" className="sr-only">Search active simulators</label>
             <input
               id="simSearch"
               type="text"
               placeholder="Search active simulators (e.g., SwerveSim, PowerShedding, PhysicsCanvas)"
               value={searchQuery}
               onChange={e => setSearchQuery(e.target.value)}
               className="w-full bg-transparent border-none text-white placeholder-white/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan font-mono text-sm"
             />
          </div>

          {/* Content */}
          <div 
            className="flex-1 overflow-y-auto p-6 bg-obsidian"
            aria-live="polite"
          >
            {sims.length === 0 ? (
              <div className="w-full h-full flex flex-col items-center justify-center text-white/60 gap-4">
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
                      className="group relative bg-white/5 border border-white/10 ares-cut-sm p-5 hover:border-ares-red transition-all flex flex-col text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan shadow-lg"
                    >
                      <div className="flex items-center gap-2 mb-3">
                         <TerminalSquare size={16} className="text-ares-red" aria-hidden="true" />
                       <p className="text-white text-sm font-black tracking-wider uppercase">{sim.name}</p>
                    </div>
                    <div className="mt-auto pt-3 border-t border-white/10 w-full flex justify-between items-center">
                      <p className="text-white/60 text-xs font-mono">&lt;{sim.id} /&gt;</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
          
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
