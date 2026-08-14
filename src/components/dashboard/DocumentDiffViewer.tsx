import { useMemo, useState } from "react";
import { X, Columns, AlignJustify, RotateCcw, ArrowRight } from "lucide-react";
import { computeLineDiff } from "@/lib/diff";
import { useFocusTrap } from "@/lib/useFocusTrap";

interface DocumentDiffViewerProps {
  isOpen: boolean;
  onClose: () => void;
  currentTitle: string;
  currentContent: string;
  revisionTitle?: string;
  revisionContent: string;
  revisionAuthor: string;
  revisionTimestamp: string;
  onRevert?: () => void;
}

export default function DocumentDiffViewer({
  isOpen,
  onClose,
  currentTitle,
  currentContent,
  revisionTitle,
  revisionContent,
  revisionAuthor,
  revisionTimestamp,
  onRevert,
}: DocumentDiffViewerProps) {
  const [viewMode, setViewMode] = useState<"unified" | "split">("unified");
  const dialogRef = useFocusTrap(isOpen, onClose);

  const diff = useMemo(() => {
    return computeLineDiff(revisionContent, currentContent);
  }, [revisionContent, currentContent]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="diff-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn"
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="bg-obsidian border border-white/15 rounded-xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="px-4 sm:px-6 py-4 border-b border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-zinc-900/60">
          <div>
            <h3 id="diff-dialog-title" className="text-base font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <span>Version Comparison</span>
              <span className="text-xs px-2 py-0.5 rounded bg-ares-gold/20 text-ares-gold border border-ares-gold/40">
                {currentTitle}
              </span>
            </h3>
            <p className="text-xs text-marble/60 mt-1 flex items-center gap-2">
              <span>Revision by <strong className="text-white">{revisionAuthor}</strong> ({new Date(revisionTimestamp).toLocaleString()})</span>
              <ArrowRight size={12} className="text-ares-cyan" aria-hidden="true" />
              <span className="text-ares-cyan font-semibold">Current Active Draft</span>
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* View Mode Toggle */}
            <div className="flex items-center rounded-lg bg-black/40 border border-white/10 p-0.5">
              <button
                type="button"
                onClick={() => setViewMode("unified")}
                aria-pressed={viewMode === "unified"}
                className={`px-3 py-1 text-xs font-bold rounded flex items-center gap-1.5 transition-all ${
                  viewMode === "unified" ? "bg-white/15 text-white" : "text-marble/60 hover:text-white"
                }`}
                title="Unified view"
              >
                <AlignJustify size={13} aria-hidden="true" />
                <span>Unified</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("split")}
                aria-pressed={viewMode === "split"}
                className={`px-3 py-1 text-xs font-bold rounded flex items-center gap-1.5 transition-all ${
                  viewMode === "split" ? "bg-white/15 text-white" : "text-marble/60 hover:text-white"
                }`}
                title="Side by side split view"
              >
                <Columns size={13} aria-hidden="true" />
                <span>Split</span>
              </button>
            </div>

            {/* Close button */}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-marble/60 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
              aria-label="Close diff viewer"
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Diff Stats Banner */}
        <div className="px-6 py-2 bg-black/30 border-b border-white/10 flex items-center justify-between text-xs font-mono">
          <div className="flex items-center gap-3">
            <span className="text-ares-success font-bold">+{diff.addedCount} lines added</span>
            <span className="text-ares-red font-bold">-{diff.removedCount} lines removed</span>
            <span className="text-marble/50">{diff.unchangedCount} unchanged lines</span>
          </div>
          {revisionTitle && revisionTitle !== currentTitle && (
            <span className="text-ares-gold">Title changed: &quot;{revisionTitle}&quot; &rarr; &quot;{currentTitle}&quot;</span>
          )}
        </div>

        {(diff.isSimplified || diff.isTruncated) && (
          <p role="status" className="border-b border-ares-gold/25 bg-ares-gold/10 px-6 py-2 text-xs text-ares-gold">
            This large comparison uses a bounded preview to keep the editor responsive.
            {diff.isTruncated ? " Some unchanged or repeated lines are omitted." : ""}
          </p>
        )}

        {/* Diff Content Body */}
        <div className="flex-1 overflow-y-auto p-4 font-mono text-xs leading-relaxed bg-obsidian">
          {viewMode === "unified" ? (
            <div className="space-y-0.5">
              {diff.lines.map((line, idx) => {
                const isAdded = line.type === "added";
                const isRemoved = line.type === "removed";
                return (
                  <div
                    key={idx}
                    className={`flex items-start px-2 py-0.5 rounded ${
                      isAdded
                        ? "bg-ares-success/15 text-ares-success border-l-2 border-ares-success"
                        : isRemoved
                        ? "bg-ares-red/15 text-ares-red border-l-2 border-ares-red"
                        : "text-marble/80 hover:bg-white/5"
                    }`}
                  >
                    <span className="w-8 select-none text-marble/40 text-[10px] text-right pr-2">
                      {line.comparedLineNumber || line.originalLineNumber || ""}
                    </span>
                    <span className="w-4 select-none font-bold">
                      {isAdded ? "+" : isRemoved ? "-" : " "}
                    </span>
                    <span className="flex-1 whitespace-pre-wrap break-words">{line.line || " "}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            /* Split View */
            <div className="grid grid-cols-2 gap-4">
              {/* Revision (Original) Side */}
              <div className="border border-white/10 rounded-lg p-3 bg-black/40">
                <h4 className="text-[11px] font-bold text-ares-gold uppercase tracking-wider mb-2 border-b border-white/10 pb-1">
                  Revision ({revisionAuthor})
                </h4>
                <div className="space-y-0.5">
                  {revisionContent.split(/\r?\n/).map((line, idx) => (
                    <div key={idx} className="flex items-start text-marble/70">
                      <span className="w-6 select-none text-marble/40 text-[10px]">{idx + 1}</span>
                      <span className="flex-1 whitespace-pre-wrap break-words">{line || " "}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Current Version Side */}
              <div className="border border-white/10 rounded-lg p-3 bg-black/40">
                <h4 className="text-[11px] font-bold text-ares-cyan uppercase tracking-wider mb-2 border-b border-white/10 pb-1">
                  Current Draft
                </h4>
                <div className="space-y-0.5">
                  {currentContent.split(/\r?\n/).map((line, idx) => (
                    <div key={idx} className="flex items-start text-marble/90">
                      <span className="w-6 select-none text-marble/40 text-[10px]">{idx + 1}</span>
                      <span className="flex-1 whitespace-pre-wrap break-words">{line || " "}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-3 border-t border-white/10 flex items-center justify-between bg-zinc-900/60">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-white/5 border border-white/10 rounded text-marble/80 hover:text-white hover:bg-white/10 text-xs font-bold uppercase ares-cut-sm transition-all"
          >
            Close
          </button>

          {onRevert && (
            <button
              type="button"
              onClick={() => {
                onRevert();
                onClose();
              }}
              className="px-5 py-2 bg-ares-gold/20 hover:bg-ares-gold/30 border border-ares-gold/50 text-ares-gold rounded text-xs font-bold uppercase ares-cut-sm flex items-center gap-2 transition-all shadow-[0_0_15px_rgba(229,168,35,0.2)] cursor-pointer"
            >
              <RotateCcw size={14} aria-hidden="true" />
              <span>Restore This Version</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
