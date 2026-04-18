import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { X, ImagePlus } from "lucide-react";

export type R2Asset = {
  key: string;
  size: number;
  uploaded: string;
  httpEtag: string;
  url: string;
  folder: string;
  tags: string;
};

export default function AssetPickerModal({
  isOpen,
  onClose,
  onSelect,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (url: string, altText: string) => void;
}) {
  const [selectedFolderFilter, setSelectedFolderFilter] = useState<string>("All");

  const { data: mediaResponse, isLoading } = useQuery<{ media: R2Asset[] }>({
    queryKey: ["assets"],
    queryFn: async () => {
      const res = await fetch("/dashboard/api/admin/media", { credentials: "include" });
      return res.json();
    },
    enabled: isOpen,
  });

  if (!isOpen) return null;

  const assets = mediaResponse?.media ?? [];
  const uniqueFolders = Array.from(new Set(assets.map(a => a.folder))).filter(Boolean);
  const filteredAssets = selectedFolderFilter === "All" ? assets : assets.filter(a => a.folder === selectedFolderFilter);

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
      <div className="bg-zinc-950 border border-zinc-800 shadow-2xl rounded-3xl w-full max-w-5xl h-[80vh] flex flex-col overflow-hidden relative">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-zinc-800 bg-black/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-ares-gold/20 flex items-center justify-center rounded-xl border border-ares-gold/30">
              <ImagePlus className="text-ares-gold" size={20} aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white tracking-widest uppercase">Select Asset</h2>
              <p className="text-xs text-zinc-400 font-mono">Inject multimedia into the rich text block</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="w-10 h-10 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        {/* Filters */}
        {!isLoading && assets.length > 0 && (
          <div className="px-6 py-4 bg-zinc-900 border-b border-zinc-800 flex flex-wrap gap-2 shadow-inner">
            <button 
              onClick={() => setSelectedFolderFilter("All")}
              className={`px-4 py-1.5 text-xs font-bold uppercase tracking-widest rounded-full border transition-all ${selectedFolderFilter === "All" ? "bg-ares-gold border-ares-gold text-black shadow-md" : "bg-black/50 border-zinc-700 text-zinc-400 hover:text-white hover:bg-zinc-800"}`}
            >All Assets</button>
            {uniqueFolders.map(folder => (
              <button 
                key={folder}
                onClick={() => setSelectedFolderFilter(folder)}
                className={`px-4 py-1.5 text-xs font-bold uppercase tracking-widest rounded-full border transition-all ${selectedFolderFilter === folder ? "bg-white border-white text-black shadow-md" : "bg-black/50 border-zinc-700 text-zinc-400 hover:text-white hover:bg-zinc-800"}`}
              >{folder}</button>
            ))}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-zinc-950">
          {isLoading ? (
            <div className="w-full h-full flex items-center justify-center">
              <div className="w-10 h-10 border-4 border-zinc-800 border-t-ares-gold rounded-full animate-spin"></div>
            </div>
          ) : assets.length === 0 ? (
            <div className="w-full h-full flex flex-col items-center justify-center text-zinc-500 gap-2">
              <ImagePlus size={48} className="opacity-50" aria-hidden="true" />
              <p className="font-mono text-sm">No assets available in the ARES vault.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {filteredAssets.map(asset => (
                <button
                  key={asset.key}
                  onClick={() => onSelect(asset.url, asset.tags || "ARES Media")}
                  aria-label={`Select asset ${asset.key}`}
                  className="group relative bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden hover:border-ares-gold transition-colors flex flex-col text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
                >
                  <div className="relative aspect-square w-full">
                    <img src={asset.url} alt={asset.key} className="w-full h-full object-cover" loading="lazy" />
                    <div className="absolute inset-0 bg-ares-gold/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <div className="p-3">
                    <p className="text-zinc-300 text-xs font-mono truncate">{asset.key}</p>
                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-zinc-800">
                      <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">
                        {(asset.size / 1024).toFixed(0)} KB
                      </span>
                      {asset.folder && (
                         <span className="text-[9px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded font-bold uppercase">{asset.folder}</span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
        
      </div>
    </div>
  );
}
