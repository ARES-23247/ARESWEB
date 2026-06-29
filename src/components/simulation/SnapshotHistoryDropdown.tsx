import { History, X } from "lucide-react";

export interface Snapshot {
  files: Record<string, string>;
  simName: string;
  simId: string | null;
  timestamp: number;
}

interface SnapshotHistoryDropdownProps {
  showHistory: boolean;
  setShowHistory: (show: boolean | ((prev: boolean) => boolean)) => void;
  getSnapshots: () => Snapshot[];
  restoreSnapshot: (snapshot: Snapshot) => void;
}

export function SnapshotHistoryDropdown({
  showHistory,
  setShowHistory,
  getSnapshots,
  restoreSnapshot,
}: SnapshotHistoryDropdownProps) {
  const snapshots = getSnapshots();

  return (
    <div className="relative">
      <button
        onClick={() => setShowHistory(prev => !prev)}
        aria-label="Snapshot history"
        className="flex items-center gap-1.5 px-3 py-1.5 bg-ares-gray-dark text-marble/60 border border-white/10 rounded-md text-xs font-bold uppercase tracking-wider hover:text-white transition-colors"
      >
        <History className="w-3.5 h-3.5" />
      </button>
      {showHistory && (
        <div className="absolute right-0 top-full mt-1 w-72 bg-obsidian-surface border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden">
          <div className="px-3 py-2 border-b border-white/10 flex items-center justify-between">
            <span className="text-xs font-bold text-white/60 uppercase tracking-wider">Snapshots</span>
            <button
              onClick={() => setShowHistory(false)}
              className="text-marble/45 hover:text-white transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          {snapshots.length === 0 ? (
            <p className="text-marble/45 text-xs p-3">No snapshots yet. They auto-save every 60s.</p>
          ) : (
            <div className="max-h-60 overflow-y-auto">
              {snapshots.map((snap, i) => (
                <button
                  key={snap.timestamp}
                  onClick={() => restoreSnapshot(snap)}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-white/5 transition-colors flex items-center justify-between gap-2 ${
                    i > 0 ? "border-t border-white/5" : ""
                  }`}
                >
                  <span className="text-white/80 truncate">{snap.simName || "Untitled"}</span>
                  <span className="text-[10px] text-marble/45 font-mono shrink-0">
                    {new Date(snap.timestamp).toLocaleTimeString()}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
