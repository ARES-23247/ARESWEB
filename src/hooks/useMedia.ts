import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import { toast } from "sonner";

export function useMedia() {
  const queryClient = useQueryClient();
  const [syndicateKey, setSyndicateKey] = useState<string | null>(null);
  const [syndicateCaption, setSyndicateCaption] = useState("");
  const [selectedFolderFilter, setSelectedFolderFilter] = useState<string>("All");

  const { data: mediaResponse, isLoading, isError } = api.media.adminList.useQuery(['media'], {});

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawBody = (mediaResponse?.body as any);
  const assets = (Array.isArray(rawBody) ? rawBody : (Array.isArray(rawBody?.media) ? rawBody.media : [])) ?? [];

  const deleteMutation = api.media.delete.useMutation({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['media'] });
      toast.success("Asset deleted");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Delete failed");
    }
  });

  const uploadMutation = api.media.upload.useMutation({
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
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", selectedFolderFilter === "All" ? "Library" : selectedFolderFilter);
      
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await uploadMutation.mutateAsync({ body: formData as any });
        successCount++;
      } catch (err) {
        console.error("Upload error for file", file.name, err);
      }
    }
    if (successCount > 0) toast.success(`Uploaded ${successCount} assets`);
  };

  const syndicateMutation = api.media.syndicate.useMutation({
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

  const moveMutation = api.media.move.useMutation({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['media'] });
      toast.success("Asset moved");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Move failed");
    }
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const uniqueFolders = Array.from(new Set(assets.map((a: any) => a.folder))).filter(Boolean) as string[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const filteredAssets = selectedFolderFilter === "All" ? assets : assets.filter((a: any) => a.folder === selectedFolderFilter);

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
         // eslint-disable-next-line @typescript-eslint/no-explicit-any
         deleteMutation.mutate({ params: { key }, body: {} } as any);
       }
    },
    isDeleting: deleteMutation.isPending,
    uploadAssets: bulkUpload,
    isUploading: uploadMutation.isPending,
    syndicateMutation,
    moveAsset: (key: string, newFolder: string) => moveMutation.mutate({ params: { key }, body: { folder: newFolder } } as any),
    isMoving: moveMutation.isPending
  };
}
