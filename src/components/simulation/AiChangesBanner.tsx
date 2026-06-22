import { GitCompare, Check, X } from "lucide-react";

interface AiChangesBannerProps {
  pendingAiChanges: Record<string, string> | null;
  handleAcceptAiChanges: () => void;
  handleRejectAiChanges: () => void;
}

export function AiChangesBanner({
  pendingAiChanges,
  handleAcceptAiChanges,
  handleRejectAiChanges,
}: AiChangesBannerProps) {
  if (!pendingAiChanges) return null;

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-indigo-900/30 border-b border-indigo-500/30 shrink-0">
      <GitCompare className="w-4 h-4 text-indigo-400" />
      <span className="text-xs font-bold text-indigo-300 uppercase tracking-wider flex-1">
        AI Changes Pending — {Object.keys(pendingAiChanges).length} file(s)
      </span>
      <button
        onClick={handleAcceptAiChanges}
        className="flex items-center gap-1.5 px-3 py-1 bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 rounded-md text-xs font-bold uppercase tracking-wider hover:bg-emerald-600/50 transition-colors"
      >
        <Check className="w-3.5 h-3.5" /> Accept
      </button>
      <button
        onClick={handleRejectAiChanges}
        className="flex items-center gap-1.5 px-3 py-1 bg-red-600/20 text-red-400 border border-red-500/30 rounded-md text-xs font-bold uppercase tracking-wider hover:bg-red-600/40 transition-colors"
      >
        <X className="w-3.5 h-3.5" /> Reject
      </button>
    </div>
  );
}
