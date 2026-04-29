import { useOthers } from "@liveblocks/react/suspense";

export default function PresenceAvatars() {
  const others = useOthers();
  const currentUserCount = others.length;

  if (currentUserCount === 0) return null;

  return (
    <div className="flex items-center gap-2">
      <div className="flex -space-x-2 overflow-hidden">
        {others.slice(0, 3).map(({ connectionId, info }) => {
          return (
            <div
              key={connectionId}
              className="inline-block h-8 w-8 rounded-full ring-2 ring-obsidian bg-ares-gray-dark border border-white/20 flex items-center justify-center relative group"
              title={info?.name || "Anonymous"}
            >
              {info?.avatar ? (
                <img src={info.avatar} alt={info.name || "User"} className="h-full w-full rounded-full object-cover" />
              ) : (
                <span className="text-xs font-bold text-white">
                  {(info?.name || "A").charAt(0).toUpperCase()}
                </span>
              )}
              {/* Tooltip */}
              <div className="absolute top-10 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-black text-white text-[10px] font-bold px-2 py-1 rounded ares-cut-sm pointer-events-none whitespace-nowrap z-50">
                {info?.name || "Anonymous"}
              </div>
            </div>
          );
        })}

        {currentUserCount > 3 && (
          <div className="inline-flex h-8 w-8 items-center justify-center rounded-full ring-2 ring-obsidian bg-black/80 border border-white/20 text-xs font-bold text-white">
            +{currentUserCount - 3}
          </div>
        )}
      </div>
      <span className="text-[10px] font-bold text-ares-cyan uppercase tracking-wider">
        {currentUserCount} {currentUserCount === 1 ? 'Editor' : 'Editors'}
      </span>
    </div>
  );
}
