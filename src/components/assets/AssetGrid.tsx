import { useState } from "react";
import { UseMutationResult } from "@tanstack/react-query";
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
  filteredAssets: R2Asset[];
  selectedFolderFilter: string;
  setSelectedFolderFilter: (f: string) => void;
  uniqueFolders: string[];
  deleteMutation: UseMutationResult<string, Error, string, unknown>;
  moveMutation: UseMutationResult<void, Error, { key: string; newFolder: string }, unknown>;
  setSyndicateKey: (key: string) => void;
}

export default function AssetGrid({
  filteredAssets,
  selectedFolderFilter,
  setSelectedFolderFilter,
  uniqueFolders,
  deleteMutation,
  moveMutation,
  setSyndicateKey
}: AssetGridProps) {
  const modal = useModal();
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [confirmKey, setConfirmKey] = useState<string | null>(null);

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
    <>
      <div className="flex flex-wrap gap-2 mb-4 pb-2 border-b border-zinc-800/80">
        <button 
          onClick={() => setSelectedFolderFilter("All")}
          className={`px-4 py-1.5 text-xs font-bold uppercase tracking-widest rounded-full border transition-all ${selectedFolderFilter === "All" ? "bg-ares-gold border-ares-gold text-black" : "bg-zinc-900 border-zinc-700 text-zinc-400 hover:text-white"}`}
        >All Gallery</button>
        {uniqueFolders.map(folder => (
          <button 
            key={folder}
            onClick={() => setSelectedFolderFilter(folder)}
            className={`px-4 py-1.5 text-xs font-bold uppercase tracking-widest rounded-full border shadow-sm transition-all ${selectedFolderFilter === folder ? "bg-white border-white text-black" : "bg-black/40 border-zinc-700 text-zinc-400 hover:text-white"}`}
          >{folder}</button>
        ))}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 overflow-y-auto flex-1 min-h-0 pr-2 pb-4 custom-scrollbar">
        {filteredAssets.map((asset) => (
        <div
          key={asset.key}
          className="group relative bg-black/40 border border-zinc-800/60 ares-cut-sm overflow-hidden hover:border-zinc-700 transition-colors flex flex-col"
        >
          {/* Thumbnail */}
          <div className="relative aspect-square bg-zinc-900">
            <img
              src={asset.url}
              alt={asset.key}
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
                      deleteMutation.mutate(asset.key);
                      setConfirmKey(null);
                    }}
                    disabled={deleteMutation.isPending}
                    className="px-3 py-1.5 bg-ares-red text-white text-xs font-bold ares-cut-sm animate-pulse flex-1 text-center"
                  >
                    {deleteMutation.isPending ? "..." : "Confirm"}
                  </button>
                ) : (
                  <button
                    onClick={() => setConfirmKey(asset.key)}
                    className="px-3 py-1.5 bg-zinc-700 text-zinc-300 text-xs font-bold ares-cut-sm hover:bg-ares-red hover:text-white transition-colors flex-1 text-center"
                  >
                    Delete
                  </button>
                )}
              </div>
              <div className="flex items-center justify-center gap-2 mt-2">
                <button
                  onClick={() => setSyndicateKey(asset.key)}
                  className="flex-1 px-3 py-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white text-xs font-bold ares-cut-sm hover:from-blue-400 hover:to-purple-500 transition-all text-center shadow-lg"
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
                      moveMutation.mutate({ key: asset.key, newFolder: newFolder.trim() });
                    }
                  }}
                  className="flex-1 px-3 py-2 bg-zinc-700 text-white text-xs font-bold ares-cut-sm hover:bg-ares-gold hover:text-black transition-colors text-center"
                >
                  📁 Move
                </button>
              </div>
            </div>
          </div>

          {/* Info strip */}
          <div className="p-3 bg-zinc-900 border-t border-zinc-800/60">
            <p className="text-white text-xs font-mono font-medium truncate w-full" title={asset.key}>
              {asset.key}
            </p>
            <div className="flex justify-between items-center mt-2 border-t border-zinc-800/50 pt-2">
              <p className="text-zinc-500 text-[10px] tracking-widest uppercase">
                {formatSize(asset.size)}
              </p>
              {asset.folder && (
                <span className="bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider">
                  {asset.folder}
                </span>
              )}
            </div>
          </div>
        </div>
      ))}
      </div>
    </>
  );
}
