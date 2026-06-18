import React from "react";

export interface GenericRevision {
  id: string;
  timestamp: string;
  editedByName: string;
  editedByAvatar?: string;
  status?: string;
  title?: string;
  description?: string;
  details?: string;
  snippet?: string;
}

interface RevisionHistoryTableProps<T extends GenericRevision> {
  revisions: T[];
  isLoading: boolean;
  onRevert: (revision: T) => void;
}

export default function RevisionHistoryTable<T extends GenericRevision>({
  revisions,
  isLoading,
  onRevert,
}: RevisionHistoryTableProps<T>) {
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-2">
        <span className="w-6 h-6 border-2 border-ares-gold border-t-transparent rounded-full animate-spin"></span>
        <span className="text-[10px] text-marble/55">Loading revision history...</span>
      </div>
    );
  }

  if (revisions.length === 0) {
    return (
      <div className="py-16 text-center text-xs font-mono text-marble/45 border border-dashed border-white/10 rounded-lg bg-black/15">
        No past revision logs recorded.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {revisions.map((rev) => {
        const avatar = rev.editedByAvatar;
        const avatarUrl = avatar
          ? avatar.startsWith("http") || avatar.includes("/")
            ? avatar
            : `https://api.dicebear.com/7.x/bottts/svg?seed=${avatar}`
          : `https://api.dicebear.com/7.x/bottts/svg?seed=${rev.editedByName}`;

        return (
          <div
            key={rev.id}
            className="bg-black/25 hover:bg-white/5 border border-white/10 rounded-lg p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition-all"
          >
            <div className="flex items-start gap-3 min-w-0 flex-1">
              <img
                src={avatarUrl}
                alt=""
                className="w-8 h-8 rounded-full border border-white/10 shrink-0 bg-black/40 mt-0.5"
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span className="text-xs font-extrabold text-white block uppercase tracking-tight">
                    {rev.editedByName}
                  </span>
                  <span className="text-[10px] text-marble/50 font-mono">
                    {new Date(rev.timestamp).toLocaleString()}
                  </span>
                </div>
                {rev.title && (
                  <span className="text-xs font-bold text-ares-gold uppercase block mt-1 truncate">
                    {rev.title}
                  </span>
                )}
                {(rev.description || rev.details || rev.snippet) && (
                  <p className="text-[10px] text-marble/60 line-clamp-2 mt-0.5 leading-relaxed break-words">
                    {rev.description || rev.details || rev.snippet}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-4 w-full md:w-auto justify-end shrink-0">
              {rev.status && (
                <span
                  className={`text-[8px] font-black uppercase px-2 py-0.5 border rounded ${
                    rev.status === "published"
                      ? "bg-ares-cyan/15 border-ares-cyan/30 text-ares-cyan"
                      : "bg-ares-gold/15 border-ares-gold/30 text-ares-gold"
                  }`}
                >
                  {rev.status}
                </span>
              )}
              <button
                type="button"
                onClick={() => onRevert(rev)}
                className="px-3 py-1 bg-white/5 border border-white/15 text-white hover:text-black hover:bg-ares-gold transition-colors font-bold text-[10px] uppercase ares-cut-sm cursor-pointer"
              >
                Revert
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
