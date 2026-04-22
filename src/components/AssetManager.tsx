import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { compressImage } from "../utils/imageProcessor";
import { adminApi } from "../api/adminApi";
import AssetUploader from "./assets/AssetUploader";
import AssetGrid, { R2Asset } from "./assets/AssetGrid";
import AssetSyndicateModal from "./assets/AssetSyndicateModal";

export default function AssetManager() {
  const queryClient = useQueryClient();
  const [syndicateKey, setSyndicateKey] = useState<string | null>(null);
  const [syndicateCaption, setSyndicateCaption] = useState("");
  const [activeFolder, setActiveFolder] = useState<string>("Library");
  const [selectedFolderFilter, setSelectedFolderFilter] = useState<string>("All");
  const [uploadProgress, setUploadProgress] = useState<{current: number, total: number} | null>(null);

  const { data, isLoading } = useQuery<{ media: (R2Asset & { folder: string; tags: string; })[] }>({
    queryKey: ['media'],
    queryFn: async () => {
      const data = await adminApi.get<{ media: (R2Asset & { folder: string; tags: string; })[] }>("/api/admin/media");
      return data;
    }
  });
  const assets = data?.media ?? [];

  const uploadMutation = useMutation({
    mutationFn: async (files: File[]) => {
      setUploadProgress({ current: 0, total: files.length });
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const { blob: compressed, ext } = await compressImage(file);
        const formData = new FormData();
        formData.append("file", compressed, file.name.replace(/\.[^/.]+$/, ext));
        formData.append("folder", activeFolder);
        await adminApi.uploadFile("/api/admin/media/upload", formData);
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
      await adminApi.request(`/api/admin/media/${key}`, { method: "DELETE" });
      return key;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["media"] });
    },
  });

  const moveMutation = useMutation({
    mutationFn: async (data: { key: string, newFolder: string }) => {
      await adminApi.moveMedia(data.key, data.newFolder);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["media"] });
    }
  });

  const syndicateMutation = useMutation({
    mutationFn: async ({ key, caption }: { key: string, caption: string }) => {
      return adminApi.syndicateMedia(key, caption);
    },
    onSuccess: () => {
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
          <p className="text-zinc-400 text-sm mt-1">
            {assets.length} asset{assets.length !== 1 && "s"} registered in the Edge.
          </p>
        </div>
        <AssetUploader
          activeFolder={activeFolder}
          setActiveFolder={setActiveFolder}
          uploadMutation={uploadMutation}
          uploadProgress={uploadProgress}
        />
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
        <AssetGrid
          assets={assets}
          filteredAssets={filteredAssets}
          selectedFolderFilter={selectedFolderFilter}
          setSelectedFolderFilter={setSelectedFolderFilter}
          uniqueFolders={uniqueFolders}
          deleteMutation={deleteMutation}
          moveMutation={moveMutation}
          setSyndicateKey={setSyndicateKey}
        />
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
