import { Sparkles, FolderOpen, Play, Check, Copy, Save, Loader2, Download, Share2, Minimize, Maximize } from "lucide-react";
import { SnapshotHistoryDropdown, Snapshot } from "./SnapshotHistoryDropdown";

interface PlaygroundHeaderBarProps {
  simName: string;
  setSimName: (name: string) => void;
  simId: string | null;
  handleReset: () => void;
  handleToggleLibrary: () => void;
  handleRun: () => void;
  handleCopy: () => void;
  copied: boolean;
  handleSave: () => void;
  isSaving: boolean;
  handleDownloadZip: () => void;
  handleShareGist: () => void;
  isSharingGist: boolean;
  showHistory: boolean;
  setShowHistory: (show: boolean | ((prev: boolean) => boolean)) => void;
  getSnapshots: () => Snapshot[];
  restoreSnapshot: (snapshot: Snapshot) => void;
  isFullscreen: boolean;
  setIsFullscreen: (isFullscreen: boolean) => void;
}

export function PlaygroundHeaderBar({
  simName,
  setSimName,
  simId,
  handleReset,
  handleToggleLibrary,
  handleRun,
  handleCopy,
  copied,
  handleSave,
  isSaving,
  handleDownloadZip,
  handleShareGist,
  isSharingGist,
  showHistory,
  setShowHistory,
  getSnapshots,
  restoreSnapshot,
  isFullscreen,
  setIsFullscreen,
}: PlaygroundHeaderBarProps) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10 bg-obsidian shrink-0">
      <div className="flex items-center gap-2 flex-1">
        <span className="text-ares-gold font-black text-xs uppercase tracking-[0.2em]">⚡ Sim Playground</span>
        <input
          type="text"
          value={simName}
          onChange={e => setSimName(e.target.value)}
          className="bg-transparent border border-white/10 text-white text-sm px-3 py-1.5 rounded-md focus:border-ares-gold/50 focus:outline-none transition-colors max-w-[250px]"
          placeholder="Simulation name..."
        />
        {simId && <span className="text-white/20 text-[10px] font-mono">#{simId}</span>}
      </div>

      <div className="flex items-center gap-2">
        <button onClick={handleReset} className="flex items-center gap-1.5 px-3 py-1.5 bg-ares-gold/20 text-ares-gold border border-ares-gold/30 rounded-md text-xs font-bold uppercase tracking-wider hover:bg-ares-gold/30 transition-colors">
          <Sparkles className="w-3.5 h-3.5" />
          New Sim
        </button>

        <button onClick={handleToggleLibrary} className="flex items-center gap-1.5 px-3 py-1.5 bg-ares-gold/20 text-ares-gold border border-ares-gold/30 rounded-md text-xs font-bold uppercase tracking-wider hover:bg-ares-gold/30 transition-colors">
          <FolderOpen className="w-3.5 h-3.5" />
          Open Library
        </button>

        <button onClick={handleRun} className="flex items-center gap-1.5 px-3 py-1.5 bg-ares-cyan/20 text-ares-cyan border border-ares-cyan/30 rounded-md text-xs font-bold uppercase tracking-wider hover:bg-ares-cyan/30 transition-colors">
          <Play className="w-3.5 h-3.5" /> Run
        </button>

        <button onClick={handleCopy} aria-label="Copy code" className="flex items-center gap-1.5 px-3 py-1.5 bg-ares-gray-dark text-marble/60 border border-white/10 rounded-md text-xs font-bold uppercase tracking-wider hover:text-white transition-colors">
          {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
        </button>

        <button onClick={handleSave} disabled={isSaving} className="flex items-center gap-1.5 px-3 py-1.5 bg-ares-gold/20 text-ares-gold border border-ares-gold/30 rounded-md text-xs font-bold uppercase tracking-wider hover:bg-ares-gold/30 transition-colors disabled:opacity-50">
          {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          {simId ? 'Update' : 'Save'}
        </button>

        <button onClick={handleDownloadZip} aria-label="Download as ZIP" className="flex items-center gap-1.5 px-3 py-1.5 bg-ares-gray-dark text-marble/60 border border-white/10 rounded-md text-xs font-bold uppercase tracking-wider hover:text-white transition-colors">
          <Download className="w-3.5 h-3.5" />
        </button>

        <button onClick={handleShareGist} disabled={isSharingGist} aria-label="Share as Gist" className="flex items-center gap-1.5 px-3 py-1.5 bg-ares-gray-dark text-marble/60 border border-white/10 rounded-md text-xs font-bold uppercase tracking-wider hover:text-white transition-colors disabled:opacity-50">
          {isSharingGist ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Share2 className="w-3.5 h-3.5" />}
        </button>


        <SnapshotHistoryDropdown
          showHistory={showHistory}
          setShowHistory={setShowHistory}
          getSnapshots={getSnapshots}
          restoreSnapshot={restoreSnapshot}
        />

        <button onClick={() => setIsFullscreen(!isFullscreen)} aria-label={isFullscreen ? "Exit full screen" : "Enter full screen"} className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 text-white/80 border border-white/10 rounded-md text-xs font-bold uppercase tracking-wider hover:bg-white/10 transition-colors">
          {isFullscreen ? <Minimize className="w-3.5 h-3.5" /> : <Maximize className="w-3.5 h-3.5" />}
        </button>
      </div>
    </div>
  );
}
