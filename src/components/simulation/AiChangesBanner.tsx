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
    <div className="flex items-center gap-2 px-3 py-2 bg-ares-gold/10 border-b border-ares-gold/20 shrink-0">
      <GitCompare className="w-4 h-4 text-ares-gold" />
      <span className="text-xs font-bold text-ares-gold uppercase tracking-wider flex-1">
        AI Changes Pending — {Object.keys(pendingAiChanges).length} file(s)
      </span>
      <button
        onClick={handleAcceptAiChanges}
        className="flex items-center gap-1.5 px-3 py-1 bg-ares-success/15 text-ares-success border border-ares-success/30 rounded-md text-xs font-bold uppercase tracking-wider hover:bg-ares-success/30 transition-colors"
      >
        <Check className="w-3.5 h-3.5" /> Accept
      </button>
      <button
        onClick={handleRejectAiChanges}
        className="flex items-center gap-1.5 px-3 py-1 bg-ares-danger/15 text-ares-danger border border-ares-danger/30 rounded-md text-xs font-bold uppercase tracking-wider hover:bg-ares-danger/30 transition-colors"
      >
        <X className="w-3.5 h-3.5" /> Reject
      </button>

    </div>
  );
}
