import {
  Sparkles,
  FolderOpen,
  Play,
  Check,
  Copy,
  Save,
  Loader2,
  Download,
  Share2,
  Minimize,
  Maximize,
} from "lucide-react";
import { SnapshotHistoryDropdown, Snapshot } from "./SnapshotHistoryDropdown";

const toolbarButtonClass =
  "flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-md border px-3 text-xs font-bold uppercase tracking-wider transition-colors";

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
        <span className="text-ares-gold font-black text-xs uppercase tracking-[0.2em]">
          ⚡ Sim Playground
        </span>
        <input
          type="text"
          value={simName}
          onChange={(e) => setSimName(e.target.value)}
          aria-label="Simulation name"
          className="min-h-11 max-w-[250px] rounded-md border border-white/10 bg-transparent px-3 text-sm text-white transition-colors focus:border-ares-gold/50 focus:outline-none"
          placeholder="Simulation name..."
        />
        {simId && (
          <span className="text-white/20 text-[10px] font-mono">#{simId}</span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={handleReset}
          className={`${toolbarButtonClass} border-ares-gold/30 bg-ares-gold/20 text-ares-gold hover:bg-ares-gold/30`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          New Sim
        </button>

        <button
          onClick={handleToggleLibrary}
          className={`${toolbarButtonClass} border-ares-gold/30 bg-ares-gold/20 text-ares-gold hover:bg-ares-gold/30`}
        >
          <FolderOpen className="w-3.5 h-3.5" />
          Open Library
        </button>

        <button
          onClick={handleRun}
          className={`${toolbarButtonClass} border-ares-cyan/30 bg-ares-cyan/20 text-ares-cyan hover:bg-ares-cyan/30`}
        >
          <Play className="w-3.5 h-3.5" /> Run
        </button>

        <button
          onClick={handleCopy}
          aria-label="Copy code"
          className={`${toolbarButtonClass} border-white/10 bg-ares-gray-dark text-marble/60 hover:text-white`}
        >
          {copied ? (
            <Check className="w-3.5 h-3.5" />
          ) : (
            <Copy className="w-3.5 h-3.5" />
          )}
        </button>

        <button
          onClick={handleSave}
          disabled={isSaving}
          className={`${toolbarButtonClass} border-ares-gold/30 bg-ares-gold/20 text-ares-gold hover:bg-ares-gold/30 disabled:opacity-50`}
        >
          {isSaving ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Save className="w-3.5 h-3.5" />
          )}
          {simId ? "Update" : "Save"}
        </button>

        <button
          onClick={handleDownloadZip}
          aria-label="Download as ZIP"
          className={`${toolbarButtonClass} border-white/10 bg-ares-gray-dark text-marble/60 hover:text-white`}
        >
          <Download className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={handleShareGist}
          disabled={isSharingGist}
          aria-label="Share as Gist"
          className={`${toolbarButtonClass} border-white/10 bg-ares-gray-dark text-marble/60 hover:text-white disabled:opacity-50`}
        >
          {isSharingGist ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Share2 className="w-3.5 h-3.5" />
          )}
        </button>

        <SnapshotHistoryDropdown
          showHistory={showHistory}
          setShowHistory={setShowHistory}
          getSnapshots={getSnapshots}
          restoreSnapshot={restoreSnapshot}
        />

        <button
          onClick={() => setIsFullscreen(!isFullscreen)}
          aria-label={isFullscreen ? "Exit full screen" : "Enter full screen"}
          className={`${toolbarButtonClass} border-white/10 bg-white/5 text-white/80 hover:bg-white/10`}
        >
          {isFullscreen ? (
            <Minimize className="w-3.5 h-3.5" />
          ) : (
            <Maximize className="w-3.5 h-3.5" />
          )}
        </button>
      </div>
    </div>
  );
}
