import { useState } from "react";
import { X, Images } from "lucide-react";
import * as Dialog from "@radix-ui/react-dialog";
import { useCreateAlbum, useUpdateAlbum, type Album } from "../api/albums";
import { useQueryClient } from "@tanstack/react-query";
import { uploadFile } from "../utils/apiClient";
import { toast } from "sonner";
import { toastApiError } from "../api/honoClient";

interface AlbumEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  albumToEdit?: Album | null;
}

export default function AlbumEditorModal({
  isOpen,
  onClose,
  albumToEdit,
}: AlbumEditorModalProps) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [heroImageFile, setHeroImageFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const [prevAlbumId, setPrevAlbumId] = useState<string | undefined>(undefined);

  // Pre-fill form when editing
  if (albumToEdit?.id !== prevAlbumId) {
    setPrevAlbumId(albumToEdit?.id);
    if (albumToEdit) {
      setTitle(albumToEdit.title);
      setDescription(albumToEdit.description || "");
      setHeroImageFile(null);
    } else {
      setTitle("");
      setDescription("");
      setHeroImageFile(null);
    }
  }

  const createMutation = useCreateAlbum({
    onSuccess: () => {
      setTitle("");
      setDescription("");
      setHeroImageFile(null);
      toast.success("Album created successfully");
      onClose();
    },
    onError: (error) => {
      toastApiError(error, "Failed to create album");
    }
  });

  const updateMutation = useUpdateAlbum({
    onSuccess: () => {
      setTitle("");
      setDescription("");
      setHeroImageFile(null);
      queryClient.invalidateQueries({ queryKey: ["albums"] });
      toast.success("Album updated successfully");
      onClose();
    },
    onError: (error) => {
      toastApiError(error, "Failed to update album");
    }
  });

  const handleSave = async () => {
    if (!title.trim()) return;

    let coverImageId: string | undefined;
    if (heroImageFile) {
      setIsUploading(true);
      try {
        const formData = new FormData();
        formData.append("file", heroImageFile);
        formData.append("folder", "album");
        const data = await uploadFile<{ key?: string }>("/api/media/admin/upload", formData);
        coverImageId = data.key;
      } catch {
        setIsUploading(false);
        return;
      }
      setIsUploading(false);
    }

    const payload = {
      title: title.trim(),
      description: description.trim() || undefined,
      coverImageId,
    };

    if (albumToEdit) {
      updateMutation.mutate({ id: albumToEdit.id, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setTitle("");
      setDescription("");
      setHeroImageFile(null);
      onClose();
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending || isUploading;

  return (
    <Dialog.Root open={isOpen} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed left-[50%] top-[50%] z-50 translate-x-[-50%] translate-y-[-50%] bg-obsidian border border-white/10 shadow-2xl ares-cut-lg w-[calc(100%-2rem)] max-w-3xl max-h-[80vh] flex flex-col overflow-hidden data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] focus:outline-none"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-white/10 bg-black/40">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-ares-gold/20 flex items-center justify-center ares-cut-sm border border-ares-gold/30">
                <Images className="text-ares-gold" size={20} aria-hidden="true" />
              </div>
              <div>
                <Dialog.Title className="text-xl font-black text-white tracking-widest uppercase m-0">
                  {albumToEdit ? "Edit Album" : "Create Album"}
                </Dialog.Title>
                <Dialog.Description className="text-xs text-white/60 font-mono m-0">
                  {albumToEdit ? "Update album details" : "Add a new photo album"}
                </Dialog.Description>
              </div>
            </div>
            <Dialog.Close asChild>
              <button
                aria-label="Close modal"
                className="w-10 h-10 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
              >
                <X size={20} aria-hidden="true" />
              </button>
            </Dialog.Close>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 bg-obsidian">
            <div className="space-y-4">
              <div>
                <label htmlFor="title" className="block text-xs font-bold text-ares-gold uppercase tracking-wider mb-2">
                  Album Title *
                </label>
                <input
                  id="title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. 2025 Season Kickoff"
                  className="w-full bg-black border border-white/10 ares-cut-sm px-4 py-3 text-white placeholder-white/30 focus:border-ares-gold focus:outline-none focus:ring-1 focus:ring-ares-gold transition-all"
                />
              </div>
              <div>
                <label htmlFor="description" className="block text-xs font-bold text-ares-gold uppercase tracking-wider mb-2">
                  Description
                </label>
                <textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief description of this album..."
                  rows={3}
                  className="w-full bg-black border border-white/10 ares-cut-sm px-4 py-3 text-white placeholder-white/30 focus:border-ares-gold focus:outline-none focus:ring-1 focus:ring-ares-gold transition-all resize-none"
                />
              </div>

              <div>
                <label htmlFor="heroImageFile" className="block text-xs font-bold text-ares-gold uppercase tracking-wider mb-2">
                  Cover Image
                </label>
                <div className="flex items-center gap-4">
                  <label className="flex-1">
                    <input
                      id="heroImageFile"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => setHeroImageFile(e.target.files?.[0] || null)}
                    />
                    <div className="px-4 py-3 bg-black border border-dashed border-white/20 ares-cut-sm text-center cursor-pointer hover:border-ares-gold/50 transition-colors">
                      {heroImageFile ? (
                        <span className="text-ares-gold text-sm">{heroImageFile.name}</span>
                      ) : (
                        <span className="text-white/40 text-sm">Click to select a cover image...</span>
                      )}
                    </div>
                  </label>
                </div>
              </div>
              <button
                onClick={handleSave}
                disabled={!title.trim() || isPending}
                className="w-full px-6 py-3 bg-ares-gold hover:bg-ares-gold/80 text-black font-black uppercase tracking-widest ares-cut-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isPending
                  ? albumToEdit
                    ? "Updating..."
                    : "Creating..."
                  : albumToEdit
                    ? "Update Album"
                    : "Create Album"}
              </button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
