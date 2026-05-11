interface MediaAsset {
  key: string;
  url: string;
  folder?: string;
  tags?: string;
  size?: number;
}
import { useState, useRef } from "react";
import { X, ImagePlus, Plus, UploadCloud, Loader2 } from "lucide-react";
import * as Dialog from "@radix-ui/react-dialog";
import { useGetAdminMedia } from "../api";
import { uploadFile } from "../utils/apiClient";
import { toast } from "sonner";

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
  onSelect: (url: string, altText: string, key?: string) => void;
}) {
  const [selectedFolderFilter, setSelectedFolderFilter] = useState<string>("All");
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: mediaResponse, isLoading, refetch } = useGetAdminMedia({
    enabled: isOpen,
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", "video"); // Default folder for thumbnails
      await uploadFile<{ key?: string, url?: string }>("/api/media/admin/upload", formData);
      toast.success("Asset uploaded successfully");
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to upload asset");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

   
  const assets = (mediaResponse as unknown as { media: MediaAsset[] })?.media ?? [];
  const uniqueFolders = Array.from(new Set(assets.map((a: MediaAsset) => a.folder))).filter(Boolean);
  const filteredAssets = selectedFolderFilter === "All" ? assets : assets.filter((a: MediaAsset) => a.folder === selectedFolderFilter);

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[9999] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content 
          aria-describedby={undefined}
          className="fixed left-[50%] top-[50%] z-[9999] translate-x-[-50%] translate-y-[-50%] bg-obsidian border border-white/10 shadow-2xl ares-cut-lg w-[calc(100%-2rem)] max-w-5xl h-[80vh] flex flex-col overflow-hidden data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] focus:outline-none"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-white/10 bg-black/40">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-ares-gold/20 flex items-center justify-center ares-cut-sm border border-ares-gold/30">
                <ImagePlus className="text-ares-gold" size={20} aria-hidden="true" />
              </div>
              <div>
                <Dialog.Title className="text-xl font-black text-white tracking-widest uppercase m-0">Select Asset</Dialog.Title>
                <Dialog.Description className="text-xs text-white/60 font-mono m-0">Inject multimedia into the rich text block</Dialog.Description>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept="image/*"
                onChange={handleFileUpload}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="px-4 py-2 bg-ares-gold/20 hover:bg-ares-gold/30 text-ares-gold ares-cut-sm text-sm font-bold transition-all border border-ares-gold/30 flex items-center gap-2 disabled:opacity-50"
              >
                {isUploading ? <Loader2 size={16} className="animate-spin" /> : <UploadCloud size={16} />}
                Upload New
              </button>
              <Dialog.Close asChild>
                <button
                  aria-label="Close modal"
                  className="w-10 h-10 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
                >
                  <X size={20} aria-hidden="true" />
                </button>
              </Dialog.Close>
            </div>
          </div>

          {/* Filters */}
          {!isLoading && assets.length > 0 && (
            <div className="px-6 py-4 bg-white/5 border-b border-white/10 flex flex-wrap gap-2 shadow-inner">
              <button 
                onClick={() => setSelectedFolderFilter("All")}
                className={`px-4 py-1.5 text-xs font-bold uppercase tracking-widest ares-cut-sm border transition-all ${selectedFolderFilter === "All" ? "bg-ares-gold border-ares-gold text-black shadow-md" : "bg-black/50 border-white/10 text-white/60 hover:text-white hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"}`}
              >All Assets</button>
              {uniqueFolders.map(folder => (
                <button 
                  key={folder as string}
                  onClick={() => setSelectedFolderFilter(folder as string)}
                  className={`text-[10px] font-bold uppercase tracking-widest px-3 py-1 ares-cut-sm transition-colors
                    ${selectedFolderFilter === folder ? 'bg-ares-cyan text-black' : 'bg-white/5 text-marble/60 hover:text-white hover:bg-white/10 border border-white/10'}
                  `}
                >{folder as string}</button>
              ))}
            </div>
          )}

          {/* Content */}
          <div 
            className="flex-1 overflow-y-auto p-6 bg-obsidian"
            aria-live="polite" // ACC-L01: Announce loading states and search updates
          >
            {isLoading ? (
              <div className="w-full h-full flex flex-col items-center justify-center gap-4">
                <div className="w-10 h-10 border-4 border-white/10 border-t-ares-gold rounded-full animate-spin"></div>
                <p className="text-xs font-bold uppercase tracking-widest text-ares-gold animate-pulse">Scanning R2 Vault...</p>
              </div>
            ) : assets.length === 0 ? (
              <div className="w-full h-full flex flex-col items-center justify-center text-white/20 gap-2">
                <ImagePlus size={48} className="opacity-50" aria-hidden="true" />
                <p className="font-mono text-sm">No assets available in the ARES vault.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {filteredAssets.map((asset: MediaAsset) => (
                  <button
                    key={asset.key}
                    onClick={() => onSelect(asset.url, asset.tags || "ARES Media")}
                    className="relative aspect-video bg-black/50 border border-white/10 ares-cut-sm overflow-hidden group cursor-pointer hover:border-ares-cyan/50 transition-colors"
                  >
                    <div className="absolute inset-0 z-10 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/60 transition-opacity">
                      <Plus className="text-ares-cyan w-8 h-8" />
                    </div>
                      <img src={asset.url} alt={asset.key} className="w-full h-full object-cover" loading="lazy" />
                      <div className="absolute inset-0 bg-ares-gold/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="p-3">
                      <p className="text-white/60 text-xs font-mono truncate">{asset.key}</p>
                      <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/5">
                        <span className="text-xs text-white/60 uppercase font-bold tracking-widest">
                          {((asset.size || 0) / 1024).toFixed(0)} KB
                        </span>
                        {asset.folder && (
                           <span className="text-[9px] bg-white/10 text-white/60 px-1.5 py-0.5 rounded font-bold uppercase">{asset.folder}</span>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
          
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
