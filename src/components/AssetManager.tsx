import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface R2Asset {
  key: string;
  size: number;
  uploaded: string;
  url: string;
}

export default function AssetManager() {
  const queryClient = useQueryClient();
  const [confirmKey, setConfirmKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [syndicateKey, setSyndicateKey] = useState<string | null>(null);
  const [syndicateCaption, setSyndicateCaption] = useState("");
  const [activeFolder, setActiveFolder] = useState<string>("Library");
  const [selectedFolderFilter, setSelectedFolderFilter] = useState<string>("All");
  const [uploadProgress, setUploadProgress] = useState<{current: number, total: number} | null>(null);

  const { data, isLoading } = useQuery<{ media: (R2Asset & { folder: string; tags: string; })[] }>({
    queryKey: ['media'],
    queryFn: async () => {
      const res = await fetch("/api/media", { credentials: "include" });
      const data: { media: (R2Asset & { folder: string; tags: string; })[] } = await res.json();
      return data;
    }
  });
  const assets = data?.media ?? [];

  const uploadMutation = useMutation({
    mutationFn: async (files: File[]) => {
      setUploadProgress({ current: 0, total: files.length });
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const compressed = await compressImage(file);
        const formData = new FormData();
        formData.append("file", compressed, file.name.replace(/\.[^/.]+$/, ".webp"));
        formData.append("folder", activeFolder);
        const res = await fetch("/dashboard/api/admin/upload", { method: "POST", credentials: "include", body: formData });
        if (!res.ok) throw new Error("Upload failed");
        setUploadProgress({ current: i + 1, total: files.length });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["media"] });
      setTimeout(() => setUploadProgress(null), 1000);
    },
    onError: () => setUploadProgress(null)
  });

  const deleteMutation = useMutation({
    mutationFn: async (key: string) => {
      const res = await fetch(`/dashboard/api/admin/media/${key}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error("Delete failed");
      return key;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["media"] });
      setConfirmKey(null);
    },
  });

  const syndicateMutation = useMutation({
    mutationFn: async ({ key, caption }: { key: string, caption: string }) => {
      const res = await fetch(`/dashboard/api/admin/media/syndicate`, { 
        method: "POST", 
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ key, caption }) 
      });
      if (!res.ok) throw new Error("Syndication failed");
      return res.json();
    },
    onSuccess: () => {
      setSyndicateKey(null);
      setSyndicateCaption("");
      // Perhaps a success toast could go here
    },
  });

  const compressImage = (file: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new window.Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const MAX_W = 1920;
          let w = img.width, h = img.height;
          if (w > MAX_W) { h = Math.round(h * MAX_W / w); w = MAX_W; }
          canvas.width = w; canvas.height = h;
          const ctx = canvas.getContext("2d");
          if (!ctx) return reject("Canvas ctx error");
          ctx.drawImage(img, 0, 0, w, h);
          canvas.toBlob((blob) => blob ? resolve(blob) : reject("Blob error"), "image/webp", 0.8);
        };
        img.onerror = () => reject("Image load error");
      };
      reader.onerror = () => reject("Reader error");
    });
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    uploadMutation.mutate(files, {
      onSettled: () => {
        e.target.value = "";
      }
    });
  };

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

  const uniqueFolders = Array.from(new Set(assets.map(a => a.folder))).filter(Boolean);
  const filteredAssets = selectedFolderFilter === "All" ? assets : assets.filter((a: R2Asset & { folder: string; tags: string; }) => a.folder === selectedFolderFilter);

  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tighter">Asset Vault</h2>
          <p className="text-zinc-400 text-sm mt-1">
            {assets.length} asset{assets.length !== 1 && "s"} registered in the Edge.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder="Assign Tag/Folder (e.g., Outreach)"
            value={activeFolder}
            onChange={(e) => setActiveFolder(e.target.value)}
            className="w-48 bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-ares-gold hidden sm:block"
          />
          <label
            htmlFor="asset-upload-input"
            className={`px-6 py-3 rounded-2xl font-bold uppercase tracking-widest text-xs cursor-pointer transition-all flex items-center gap-2 focus-within:ring-2 focus-within:ring-ares-gold ${
              uploadMutation.isPending
                ? "bg-zinc-800 text-zinc-400 pointer-events-none"
                : "bg-ares-gold text-obsidian hover:bg-ares-gold/80 shadow-lg"
            }`}
          >
            {uploadMutation.isPending 
              ? `Uploading ${uploadProgress?.current} / ${uploadProgress?.total}` 
              : "Upload Bulk"}
            <input
              id="asset-upload-input"
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleUpload}
            />
          </label>
        </div>
      </div>

      {isLoading ? (
        <div className="flex-1 flex items-center justify-center min-h-[300px]">
          <div className="w-8 h-8 md:w-12 md:h-12 border-4 border-zinc-800 border-t-ares-gold rounded-full animate-spin"></div>
        </div>
      ) : assets.length === 0 ? (
        <div className="flex-1 flex items-center justify-center min-h-[300px]">
          <p className="text-zinc-400 text-sm italic">No assets found in R2. Upload an image to get started.</p>
        </div>
      ) : (
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
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 overflow-y-auto max-h-[600px] pr-2">
            {filteredAssets.map((asset: R2Asset & { folder: string; tags: string; }) => (
            <div
              key={asset.key}
              className="group relative bg-black/40 border border-zinc-800/60 rounded-xl overflow-hidden hover:border-zinc-700 transition-colors flex flex-col"
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
                      className="px-3 py-1.5 bg-white text-obsidian text-xs font-bold rounded-lg hover:bg-ares-gold transition-colors flex-1 text-center"
                    >
                      {copiedKey === asset.key ? "Copied!" : "Copy URL"}
                    </button>
                    {confirmKey === asset.key ? (
                      <button
                        onClick={() => deleteMutation.mutate(asset.key)}
                        disabled={deleteMutation.isPending}
                        className="px-3 py-1.5 bg-ares-red text-white text-xs font-bold rounded-lg animate-pulse flex-1 text-center"
                      >
                        {deleteMutation.isPending ? "..." : "Confirm"}
                      </button>
                    ) : (
                      <button
                        onClick={() => setConfirmKey(asset.key)}
                        className="px-3 py-1.5 bg-zinc-700 text-zinc-300 text-xs font-bold rounded-lg hover:bg-ares-red hover:text-white transition-colors flex-1 text-center"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                  <button
                    onClick={() => setSyndicateKey(asset.key)}
                    className="w-full mt-2 px-3 py-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white text-xs font-bold rounded-lg hover:from-blue-400 hover:to-purple-500 transition-all text-center shadow-lg"
                  >
                    📢 Broadcast
                  </button>
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
      )}

      {/* Syndication Modal Overlay */}
      {syndicateKey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-obsidian border border-zinc-700 rounded-2xl w-full max-w-md p-6 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 blur-3xl rounded-full pointer-events-none" />
            
            <h3 className="text-xl font-bold text-white mb-2">Broadcast Media</h3>
            <p className="text-sm text-zinc-400 mb-6">
              Dispatch this asset to Instagram, X, Facebook, and Discord securely. Make sure your Integration Keys are populated.
            </p>
            
            <div className="mb-6 bg-black/50 border border-white/10 rounded-lg p-2 flex justify-center">
              <img 
                src={`/api/media/${syndicateKey}`} 
                alt="Broadcast target" 
                className="h-32 object-contain rounded" 
              />
            </div>
            
            <div className="mb-6">
              <label htmlFor="captionInput" className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Social Caption</label>
              <textarea
                id="captionInput"
                value={syndicateCaption}
                onChange={(e) => setSyndicateCaption(e.target.value)}
                rows={4}
                placeholder="Draft an engaging caption for your followers..."
                className="w-full bg-black/60 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors resize-none"
              />
            </div>
            
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => { setSyndicateKey(null); setSyndicateCaption(""); }}
                className="px-4 py-2 font-medium text-zinc-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => syndicateMutation.mutate({ key: syndicateKey, caption: syndicateCaption })}
                disabled={syndicateMutation.isPending || syndicateCaption.trim() === ""}
                className={`px-6 py-2 rounded-xl font-bold transition-all shadow-lg ${
                  syndicateMutation.isPending || syndicateCaption.trim() === ""
                   ? "bg-zinc-800 text-zinc-500 cursor-not-allowed"
                   : "bg-gradient-to-r from-blue-500 to-purple-600 text-white hover:scale-105"
                }`}
              >
                {syndicateMutation.isPending ? "Dispatching..." : "Launch Payload"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
