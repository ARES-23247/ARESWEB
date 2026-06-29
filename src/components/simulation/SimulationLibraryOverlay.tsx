import { X, Clock, Loader2, Globe } from "lucide-react";
import { SavedSim, GithubSim } from "../../hooks/useSimulationFiles";

interface SimulationLibraryOverlayProps {
  showLibrary: boolean;
  setShowLibrary: (show: boolean) => void;
  savedSims: SavedSim[];
  githubSims: GithubSim[];
  isLoadingSims: boolean;
  isLoadingGithubSims: boolean;
  handleLoadSim: (
    id: string,
    setFiles: React.Dispatch<React.SetStateAction<Record<string, string>>>,
    setActiveFile: React.Dispatch<React.SetStateAction<string>>
  ) => void;
  handleLoadGithubSim: (
    sim: GithubSim,
    setFiles: React.Dispatch<React.SetStateAction<Record<string, string>>>,
    setActiveFile: React.Dispatch<React.SetStateAction<string>>
  ) => void;
  setFiles: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  setActiveFile: React.Dispatch<React.SetStateAction<string>>;
}

export function SimulationLibraryOverlay({
  showLibrary,
  setShowLibrary,
  savedSims,
  githubSims,
  isLoadingSims,
  isLoadingGithubSims,
  handleLoadSim,
  handleLoadGithubSim,
  setFiles,
  setActiveFile,
}: SimulationLibraryOverlayProps) {
  if (!showLibrary) return null;

  return (
    <div className="absolute inset-0 z-50 bg-obsidian/95 backdrop-blur-sm overflow-y-auto p-4 md:p-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-white">Simulation Library</h2>
          <button
            onClick={() => setShowLibrary(false)}
            className="p-2 text-marble/60 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            aria-label="Close library"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Saved Simulations */}
        <div className="mb-8">
          <h3 className="text-sm font-bold text-ares-gold uppercase tracking-widest mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4" /> Your Saved Simulations
          </h3>
          {isLoadingSims ? (
            <div className="flex items-center gap-2 text-marble/60 text-sm py-4">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading...
            </div>
          ) : savedSims.length === 0 ? (
            <p className="text-marble/40 text-sm py-4">No saved simulations yet. Create one and hit Save!</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {savedSims.map((sim) => (
                <button
                  key={sim.id}
                  onClick={() => {
                    handleLoadSim(sim.id, setFiles, setActiveFile);
                    setShowLibrary(false);
                  }}
                  className="text-left p-4 bg-ares-gray-dark/50 border border-white/10 rounded-xl hover:border-ares-gold/40 hover:bg-ares-gray-dark transition-all group"
                >
                  <div className="font-semibold text-white text-sm group-hover:text-ares-gold transition-colors truncate">
                    {sim.name}
                  </div>
                  <div className="text-[11px] text-marble/40 mt-1">
                    {sim.type && <span className="text-ares-cyan/60 mr-2">{sim.type}</span>}
                    {new Date(sim.updatedAt).toLocaleDateString()}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* GitHub Official Sims */}
        <div>
          <h3 className="text-sm font-bold text-ares-gold uppercase tracking-widest mb-3 flex items-center gap-2">
            <Globe className="w-4 h-4" /> Official ARES Simulations
          </h3>
          {isLoadingGithubSims ? (
            <div className="flex items-center gap-2 text-marble/60 text-sm py-4">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading from GitHub...
            </div>
          ) : githubSims.length === 0 ? (
            <p className="text-marble/40 text-sm py-4">No official simulations found in the repository.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {githubSims.map((sim) => (
                <button
                  key={sim.id}
                  onClick={() => {
                    handleLoadGithubSim(sim, setFiles, setActiveFile);
                    setShowLibrary(false);
                  }}
                  className="text-left p-4 bg-ares-red/10 border border-ares-red/20 rounded-xl hover:border-ares-gold/40 hover:bg-ares-red/20 transition-all group"
                >
                  <div className="font-semibold text-white text-sm group-hover:text-ares-gold transition-colors truncate">
                    {sim.name}
                  </div>
                  <div className="text-[11px] text-marble/40 mt-1">Official • {sim.path}</div>
                </button>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
