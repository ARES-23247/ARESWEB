import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { FolderOpen } from "lucide-react";
import { adminApi } from "../api/adminApi";
import AssetUploader from "./assets/AssetUploader";
import AssetGrid, { R2Asset } from "./assets/AssetGrid";
import AssetSyndicateModal from "./assets/AssetSyndicateModal";

export default function AssetManager() {
  const queryClient = useQueryClient();
  const [syndicateKey, setSyndicateKey] = useState<string | null>(null);
  const [syndicateCaption, setSyndicateCaption] = useState("");
  const [selectedFolderFilter, setSelectedFolderFilter] = useState<string>("All");

  const { data, isLoading, isError } = useQuery<{ media: (R2Asset & { folder: string; tags: string; })[] }>({
    queryKey: ['media'],
    queryFn: async () => {
      const data = await adminApi.get<{ media: (R2Asset & { folder: string; tags: string; })[] }>("/api/admin/media");
      return data;
    }
  });

  const assets = data?.media ?? [];

  const deleteMutation = useMutation({
    mutationFn: async (key: string) => adminApi.deleteMedia(key),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['media'] }),
  });

  const uploadMutation = useMutation({
    mutationFn: async (files: File[]) => {
      for (const file of files) {
        await adminApi.uploadMedia(file, selectedFolderFilter === "All" ? "general" : selectedFolderFilter);
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['media'] }),
  });

  const syndicateMutation = useMutation({
    mutationFn: async ({ key, caption }: { key: string; caption: string }) => 
      adminApi.syndicateMedia(key, caption),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['media'] });
      setSyndicateKey(null);
      setSyndicateCaption("");
    },
  });

  const uniqueFolders = Array.from(new Set(assets.map(a => a.folder))).filter(Boolean);
  const filteredAssets = selectedFolderFilter === "All" ? assets : assets.filter((a) => a.folder === selectedFolderFilter);

  return (
    <div className="flex-1 w-full flex flex-col min-h-0">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tighter">Asset Vault</h2>
          <p className="text-marble/40 text-sm mt-1">
            {assets.length} asset{assets.length !== 1 && "s"} registered in the Edge.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <AssetUploader 
            activeFolder={selectedFolderFilter === "All" ? "" : selectedFolderFilter}
            setActiveFolder={setSelectedFolderFilter}
            uploadMutation={uploadMutation}
            uploadProgress={null}
          />
        </div>
      </div>

      {isError && (
        <div className="bg-ares-red/10 border border-ares-red/30 p-4 ares-cut-sm text-ares-red text-xs font-bold mb-6 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-ares-red animate-pulse" />
          TELEMETRY FAULT: Failed to synchronize R2 asset metadata.
        </div>
      )}

      {isLoading ? (
        <div className="flex-1 flex items-center justify-center min-h-[300px]">
          <div className="w-8 h-8 md:w-12 md:h-12 border-4 border-white/10 border-t-ares-gold rounded-full animate-spin"></div>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2 custom-scrollbar">
             <button 
                onClick={() => setSelectedFolderFilter("All")}
                className={`px-4 py-1.5 ares-cut-sm text-xs font-bold uppercase tracking-widest transition-all ${selectedFolderFilter === "All" ? "bg-white text-black" : "bg-white/5 text-marble/90 border border-white/5 hover:bg-white/10"}`}
             >
                All Assets
             </button>
             {uniqueFolders.map(folder => (
                <button 
                  key={folder}
                  onClick={() => setSelectedFolderFilter(folder)}
                  className={`px-4 py-1.5 ares-cut-sm text-xs font-bold uppercase tracking-widest transition-all flex items-center gap-2 ${selectedFolderFilter === folder ? "bg-ares-gold text-black" : "bg-white/5 text-marble/90 border border-white/5 hover:bg-white/10"}`}
                >
                  <FolderOpen size={12} />
                  {folder}
                </button>
             ))}
          </div>

          <AssetGrid 
            assets={filteredAssets} 
            onDelete={(key) => {
              if (confirm("Permanently purge this asset from R2?")) {
                deleteMutation.mutate(key);
              }
            }} 
            onSyndicate={(key) => setSyndicateKey(key)}
          />
        </>
      )}

      <AssetSyndicateModal 
        syndicateKey={syndicateKey}
        setSyndicateKey={setSyndicateKey}
        syndicateCaption={syndicateCaption}
        setSyndicateCaption={setSyndicateCaption}
        syndicateMutation={syndicateMutation}
      />
    </div>
  );
}
