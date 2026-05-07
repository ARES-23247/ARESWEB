import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { compressImage } from "../utils/imageProcessor";
import { useGetAdminMedia, useUploadMedia, useMoveMedia, type Asset, type MediaResponse } from "../api/media";

export { type Asset, type MediaResponse };

export function useMedia() {
  const queryClient = useQueryClient();
  const [syndicateKey, setSyndicateKey] = useState<string | null>(null);
  const [syndicateCaption, setSyndicateCaption] = useState("");
  const [selectedFolderFilter, setSelectedFolderFilter] = useState<string>("All");

  // Use the typed API hook for admin media
  const { data: mediaResponse, isLoading, isError } = useGetAdminMedia();
  const assets: Asset[] = mediaResponse?.media || [];

  const deleteMutation = useMutation({
    mutationFn: (key: string) => {
      // Direct fetch for delete since the typed hook expects a different format
      return fetch(`/api/media/admin/${encodeURIComponent(key)}`, {
        method: "DELETE",
        credentials: "include"
      }).then(res => res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-media"] });
      toast.success("Asset deleted");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Delete failed");
    }
  });

  const uploadMutation = useUploadMedia({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-media"] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Upload failed");
    }
  });

  const bulkUpload = async (files: File[]) => {
    let successCount = 0;
    for (const file of files) {
      try {
        console.info(`[useMedia] Processing "${file.name}" (${file.type}, ${(file.size / 1024).toFixed(1)}KB)…`);
        const { blob: compressedBlob, ext } = await compressImage(file);
        const fileName = file.name.replace(/\.[^/.]+$/, ext);
        console.info(`[useMedia] Compressed → "${fileName}" (${(compressedBlob.size / 1024).toFixed(1)}KB)`);

        const formData = new FormData();
        formData.append("file", compressedBlob, fileName);
        formData.append("folder", selectedFolderFilter === "All" ? "Library" : selectedFolderFilter);

        await uploadMutation.mutateAsync(formData);
        successCount++;
      } catch (err) {
        const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
        console.error(`[useMedia] Exception uploading "${file.name}":`, err);
        toast.error(`"${file.name}" failed: ${msg}`);
      }
    }
    if (successCount > 0) toast.success(`Uploaded ${successCount} asset${successCount > 1 ? "s" : ""}`);
  };

  const syndicateMutation = useMutation({
    mutationFn: ({ key, caption }: { key: string, caption?: string }) => {
      return fetch(`/api/media/admin/syndicate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ key, caption })
      }).then(res => res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-media"] });
      setSyndicateKey(null);
      setSyndicateCaption("");
      toast.success("Syndicated!");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Syndication failed");
    }
  });

  const moveMutation = useMoveMedia({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-media"] });
      toast.success("Asset moved");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Move failed");
    }
  });

  const uniqueFolders = Array.from(new Set(assets.map((a: Asset) => a.folder))).filter(Boolean) as string[];
  const filteredAssets = selectedFolderFilter === "All" ? assets : assets.filter((a: Asset) => a.folder === selectedFolderFilter);

  return {
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
    deleteAsset: (key: string) => {
       if (confirm("Permanently purge this asset from R2?")) {
         deleteMutation.mutate(key);
       }
    },
    isDeleting: deleteMutation.isPending,
    uploadAssets: bulkUpload,
    isUploading: uploadMutation.isPending,
    syndicateMutation,
    moveAsset: (key: string, newFolder: string) => moveMutation.mutate({ key, folder: newFolder }),
    isMoving: moveMutation.isPending
  };
}
