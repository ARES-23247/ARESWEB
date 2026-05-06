import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchJson, uploadFile } from "../api";
import { toast } from "sonner";
import { compressImage } from "../utils/imageProcessor";

export interface R2MediaItem {
  key: string;
  url: string;
  folder: string;
  size?: number;
  type?: string;
  uploadedAt?: string;
}

export function useMedia() {
  const queryClient = useQueryClient();
  const [syndicateKey, setSyndicateKey] = useState<string | null>(null);
  const [syndicateCaption, setSyndicateCaption] = useState("");
  const [selectedFolderFilter, setSelectedFolderFilter] = useState<string>("All");

  const { data: rawBody, isLoading, isError } = useQuery({
    queryKey: ['media'],
    queryFn: () => fetchJson<{ media?: R2MediaItem[] } | R2MediaItem[]>("/api/media/admin")
  });

  const assets: R2MediaItem[] = (Array.isArray(rawBody) ? rawBody : (rawBody?.media || [])) as R2MediaItem[];

  const deleteMutation = useMutation({
    mutationFn: (key: string) => fetchJson<{ success?: boolean }>(`/api/media/${key}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['media'] });
      toast.success("Asset deleted");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Delete failed");
    }
  });

  const uploadMutation = useMutation({
    mutationFn: (formData: FormData) => uploadFile<{ success?: boolean }>("/api/media", formData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['media'] });
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
    mutationFn: ({ key, platforms, caption }: { key: string, platforms: string[], caption?: string }) => fetchJson<{ success?: boolean }>(`/api/media/${key}/syndicate`, {
      method: "POST",
      body: JSON.stringify({ platforms, caption })
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['media'] });
      setSyndicateKey(null);
      setSyndicateCaption("");
      toast.success("Syndicated!");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Syndication failed");
    }
  });

  const moveMutation = useMutation({
    mutationFn: ({ key, folder }: { key: string, folder: string }) => fetchJson<{ success?: boolean }>(`/api/media/${key}/move`, {
      method: "PATCH",
      body: JSON.stringify({ folder })
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['media'] });
      toast.success("Asset moved");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Move failed");
    }
  });

  const uniqueFolders = Array.from(new Set(assets.map((a: R2MediaItem) => a.folder))).filter(Boolean) as string[];
  const filteredAssets = selectedFolderFilter === "All" ? assets : assets.filter((a: R2MediaItem) => a.folder === selectedFolderFilter);

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
         deleteMutation.mutate(encodeURIComponent(key));
       }
    },
    isDeleting: deleteMutation.isPending,
    uploadAssets: bulkUpload,
    isUploading: uploadMutation.isPending,
    syndicateMutation,
    moveAsset: (key: string, newFolder: string) => moveMutation.mutate({ key: encodeURIComponent(key), folder: newFolder }),
    isMoving: moveMutation.isPending
  };
}
