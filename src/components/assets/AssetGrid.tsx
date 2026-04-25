import { useRef, useState, useEffect, useMemo } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useModal } from "../../contexts/ModalContext";

export interface R2Asset {
  key: string;
  size: number;
  uploaded: string;
  url: string;
  folder: string;
  tags: string;
}

interface AssetGridProps {
  assets: R2Asset[];
  onDelete: (key: string) => void;
  onSyndicate: (key: string) => void;
  onMove?: (key: string, newFolder: string) => void;
  isDeleting?: boolean;
}

export default function AssetGrid({
  assets,
  onDelete,
  onSyndicate,
  onMove,
  isDeleting
}: AssetGridProps) {
  const modal = useModal();
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [confirmKey, setConfirmKey] = useState<string | null>(null);
  
  const parentRef = useRef<HTMLDivElement>(null);

  const [columns, setColumns] = useState(2);
  useEffect(() => {
    const updateColumns = () => {
      if (window.innerWidth >= 768) setColumns(4);
      else if (window.innerWidth >= 640) setColumns(3);
      else setColumns(2);
    };
    updateColumns();
    window.addEventListener("resize", updateColumns);
    return () => window.removeEventListener("resize", updateColumns);
  }, []);

  const rows = useMemo(() => {
    const r = [];
    for (let i = 0; i < assets.length; i += columns) {
      r.push(assets.slice(i, i + columns));
    }
    return r;
  }, [assets, columns]);

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 280, // Approximate height of a row
    overscan: 5,
  });

  const copyUrl = (url: string, key: string) => {
    const fullUrl = `${window.location.origin}${url}`;
    navigator.clipboard.writeText(fullUrl);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div 
      ref={parentRef}
      className="overflow-y-auto flex-1 min-h-0 pr-2 pb-4 custom-scrollbar"
    >
      <div
        style={{
          height: `${rowVirtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {rowVirtualizer.getVirtualItems().map((virtualRow) => (
          <div
            key={virtualRow.key}
            data-index={virtualRow.index}
            ref={rowVirtualizer.measureElement}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              transform: `translateY(${virtualRow.start}px)`,
            }}
            className={`grid gap-4 py-2 ${
              columns === 4 ? "grid-cols-4" : 
              columns === 3 ? "grid-cols-3" : 
              "grid-cols-2"
            }`}
          >
            {rows[virtualRow.index].map((asset) => (
              <div
                key={asset.key}
                className="group relative bg-black/40 border border-white/10 ares-cut-sm overflow-hidden hover:border-white/60 transition-colors flex flex-col"
              >
                {/* Thumbnail */}
                <div className="relative aspect-square bg-black">
                  <img
                    src={asset.url}
                    alt={`Asset thumbnail for ${asset.key}`}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  {/* Overlay on hover */}
                  <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-center gap-2 p-4">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => copyUrl(asset.url, asset.key)}
                        className="px-3 py-1.5 bg-white text-obsidian text-xs font-bold ares-cut-sm hover:bg-ares-gold transition-colors flex-1 text-center"
                      >
                        {copiedKey === asset.key ? "Copied!" : "Copy URL"}
                      </button>
                      {confirmKey === asset.key ? (
                        <button
                          onClick={() => {
                            onDelete(asset.key);
                            setConfirmKey(null);
                          }}
                          disabled={isDeleting}
                          className="px-3 py-1.5 bg-ares-red text-white text-xs font-bold ares-cut-sm animate-pulse flex-1 text-center"
                        >
                          {isDeleting ? "..." : "Confirm"}
                        </button>
                      ) : (
                        <button
                          onClick={() => setConfirmKey(asset.key)}
                          className="px-3 py-1.5 bg-white/10 text-marble text-xs font-bold ares-cut-sm hover:bg-ares-red hover:text-white transition-colors flex-1 text-center"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                    <div className="flex items-center justify-center gap-2 mt-2">
                      <button
                        onClick={() => onSyndicate(asset.key)}
                        className="flex-1 px-3 py-2 bg-ares-red text-white text-xs font-bold ares-cut-sm hover:bg-ares-gold hover:text-black transition-all text-center shadow-lg"
                      >
                        📢 Broadcast
                      </button>
                      <button
                        onClick={async () => {
                          const newFolder = await modal.prompt({
                            title: "Move Asset",
                            description: "Enter new folder name to move this asset:",
                            defaultValue: asset.folder || "Library",
                            submitText: "Move",
                          });
                          if (newFolder !== null && newFolder.trim() !== "") {
                            if (onMove) onMove(asset.key, newFolder.trim());
                          }
                        }}
                        className="flex-1 px-3 py-2 bg-white/10 text-white text-xs font-bold ares-cut-sm hover:bg-ares-gold hover:text-black transition-colors text-center"
                      >
                        📁 Move
                      </button>
                    </div>
                  </div>
                </div>

                {/* Info strip */}
                <div className="p-3 bg-black/60 border-t border-white/10">
                  <p className="text-white text-xs font-mono font-medium truncate w-full" title={asset.key}>
                    {asset.key}
                  </p>
                  <div className="flex justify-between items-center mt-2 border-t border-white/5 pt-2">
                    <p className="text-marble/30 text-xs tracking-widest uppercase">
                      {formatSize(asset.size)}
                    </p>
                    {asset.folder && (
                      <span className="bg-white/5 text-marble/90 px-2 py-0.5 rounded text-xs uppercase font-bold tracking-wider">
                        {asset.folder}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
