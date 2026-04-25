import { FolderOpen } from "lucide-react";
import AssetUploader from "./assets/AssetUploader";
import AssetGrid from "./assets/AssetGrid";
import AssetSyndicateModal from "./assets/AssetSyndicateModal";
import { useMedia } from "../hooks/useMedia";

export default function AssetManager() {
  const {
    assets,
    filteredAssets,
    uniqueFolders,
    isLoading,
    isError,
    selectedFolderFilter,
    setSelectedFolderFilter,
    syndicateKey,
    setSyndicateKey,
    syndicateCaption,
    setSyndicateCaption,
    deleteAsset,
    isDeleting,
    uploadAssets,
    isUploading,
    syndicateMutation,
    moveAsset
  } = useMedia();

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
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            uploadMutation={{ isPending: isUploading, mutate: uploadAssets } as any}
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
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            assets={filteredAssets as any} 
            isDeleting={isDeleting}
            onDelete={deleteAsset} 
            onSyndicate={(key) => setSyndicateKey(key)}
            onMove={moveAsset}
          />
        </>
      )}

      <AssetSyndicateModal 
        syndicateKey={syndicateKey}
        setSyndicateKey={setSyndicateKey}
        syndicateCaption={syndicateCaption}
        setSyndicateCaption={setSyndicateCaption}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        syndicateMutation={syndicateMutation as any}
      />
    </div>
  );
}
