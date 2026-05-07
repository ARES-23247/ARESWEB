/**
 * EditorSkeleton.tsx
 *
 * Loading placeholder for Monaco Editor with ARES branding.
 * Maintains layout stability to prevent Cumulative Layout Shift (CLS).
 * Uses shimmer animation matching ARES brand colors.
 */

// Pre-generate deterministic widths for skeleton lines to avoid impure Math.random() calls during render
const SKELETON_WIDTHS = Array.from({ length: 15 }, (_, i) => {
  // Use a simple hash of index to generate deterministic pseudo-random widths
  return 60 + ((i * 37) % 40);
});

export default function EditorSkeleton() {
  return (
    <div className="flex flex-col h-full w-full bg-[#1e1e1e] animate-pulse" role="status" aria-label="Loading code editor">
      {/* Toolbar placeholder */}
      <div className="h-10 border-b border-white/10 flex items-center px-3 gap-2 shrink-0">
        <div className="w-3 h-3 rounded-full bg-ares-red/30" />
        <div className="w-3 h-3 rounded-full bg-ares-gold/30" />
        <div className="w-3 h-3 rounded-full bg-ares-bronze/30" />
        <div className="flex-1 h-6 bg-white/5 rounded mx-2" />
      </div>

      {/* Line numbers gutter placeholder */}
      <div className="flex flex-1 overflow-hidden">
        <div className="w-12 h-full bg-[#252526] border-r border-white/5 flex flex-col gap-1.5 p-2">
          {Array.from({ length: 20 }).map((_, i) => (
            <div key={i} className="h-3.5 bg-white/5 rounded w-full" />
          ))}
        </div>

        {/* Code area placeholder */}
        <div className="flex-1 p-4 space-y-2">
          {SKELETON_WIDTHS.map((width, i) => (
            <div
              key={i}
              className="h-4 bg-white/5 rounded"
              style={{ width: `${width}%` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
